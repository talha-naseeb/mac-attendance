import {
  Injectable,
  Inject,
  forwardRef,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import {
  LeaveApprovalPolicy,
  MembershipRole,
  MembershipStatus,
  Prisma,
  SessionRevokeReason,
  UserRole,
  WorkspacePlanCode,
  WorkspaceStatus,
  WorkspaceType,
} from '@prisma/client';
import { createPublicKey, randomBytes, verify as verifySignature } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../../common/services/audit.service';
import { LoginDto, RegisterDto, SsoLoginDto } from './dto/login.dto';
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  ResetPasswordDto,
} from './dto/change-password.dto';
import { JwtPayload } from './jwt.strategy';
import { SessionService } from './session.service';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { getEntitlementsForPlan, slugifyWorkspaceName } from '../workspaces/entitlements';

type UserProfile = Prisma.UserGetPayload<{
  include: {
    branch: true;
    manager: { select: { firstName: true; lastName: true } };
  };
}>;

interface SessionSubject {
  id: string;
  employeeId: string;
  email: string;
  role: UserRole;
  branchId: string | null;
  firstName: string;
  lastName: string;
  canAccessWebAdmin: boolean;
}

interface RequestMeta {
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly dummyHash = '$2a$10$CwTycUXWue0Thq9StjUM0uJ8ba0A5i8XGZof1N0PqQ7gKcpqBfG5S';
  private entraJwksCache?: { keys: Array<Record<string, unknown>>; expiresAt: number };

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private sessionService: SessionService,
    private audit: AuditService,
    @Inject(forwardRef(() => WorkspacesService))
    private workspacesService: WorkspacesService,
  ) {}

  async register(dto: RegisterDto, meta: RequestMeta = {}) {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException(`An account with email ${email} already exists.`);
    }

    const firstName = dto.firstName.trim();
    const lastName = dto.lastName.trim();
    const fullName = `${firstName} ${lastName}`.trim();
    const workspaceType = dto.workspaceType ?? WorkspaceType.PERSONAL;
    const workspaceName =
      dto.workspaceName?.trim() ||
      (workspaceType === WorkspaceType.PERSONAL ? `${firstName} Personal` : `${firstName} Workspace`);
    const planCode =
      workspaceType === WorkspaceType.PERSONAL
        ? WorkspacePlanCode.INDIVIDUAL_FREE
        : WorkspacePlanCode.BUSINESS_STARTER;
    const entitlements = getEntitlementsForPlan(planCode);
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const employeeId = `EMP-${randomBytes(3).toString('hex').toUpperCase()}`;
    const year = new Date().getFullYear();

    const { user, workspace, membership } = await this.prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          employeeId,
          email,
          passwordHash,
          mustChangePassword: false,
          role: workspaceType === WorkspaceType.BUSINESS ? UserRole.SUPER_ADMIN : UserRole.EMPLOYEE,
          firstName,
          lastName,
          fullName,
          fullNameAr: fullName,
          jobTitle: workspaceType === WorkspaceType.BUSINESS ? 'Workspace Owner' : 'Self',
          department: workspaceType === WorkspaceType.BUSINESS ? 'Executive' : 'Personal',
          isRemoteAllowed: workspaceType === WorkspaceType.PERSONAL,
          canAccessWebAdmin: workspaceType === WorkspaceType.BUSINESS,
        },
        include: { branch: true, manager: { select: { firstName: true, lastName: true } } },
      });

      const baseSlug = slugifyWorkspaceName(workspaceName);
      const slugTaken = await tx.workspace.findUnique({ where: { slug: baseSlug } });
      const slug = slugTaken ? `${baseSlug}-${randomBytes(2).toString('hex')}` : baseSlug;

      const createdWorkspace = await tx.workspace.create({
        data: {
          type: workspaceType,
          name: workspaceName,
          slug,
          country: dto.country?.trim() || 'SA',
          timezone: dto.timezone?.trim() || 'Asia/Riyadh',
          currency: dto.currency?.trim() || 'SAR',
          planCode,
          status: WorkspaceStatus.ACTIVE,
          leaveApprovalPolicy: LeaveApprovalPolicy.MANAGER_ONLY,
          subscription: {
            create: {
              provider: 'INTERNAL',
              seatsPurchased: entitlements.maxSeats,
              status: 'ACTIVE',
            },
          },
        },
      });

      const createdMembership = await tx.membership.create({
        data: {
          workspaceId: createdWorkspace.id,
          userId: createdUser.id,
          role: MembershipRole.OWNER,
          status: MembershipStatus.ACTIVE,
          employeeId,
          jobTitle: createdUser.jobTitle,
          department: createdUser.department,
          isRemoteAllowed: createdUser.isRemoteAllowed,
        },
      });

      const updatedWorkspace = await tx.workspace.update({
        where: { id: createdWorkspace.id },
        data: { ownerMembershipId: createdMembership.id },
      });

      await tx.leaveBalance.createMany({
        data: [
          { workspaceId: updatedWorkspace.id, userId: createdUser.id, leaveType: 'ANNUAL', totalDays: 30, usedDays: 0, year },
          { workspaceId: updatedWorkspace.id, userId: createdUser.id, leaveType: 'SICK', totalDays: 30, usedDays: 0, year },
        ],
      });

      await this.audit.record(
        {
          workspaceId: updatedWorkspace.id,
          actorUserId: createdUser.id,
          action: 'AUTH_REGISTERED',
          resource: 'Workspace',
          details: { workspaceType, planCode, slug: updatedWorkspace.slug },
          ipAddress: meta.ipAddress,
        },
        tx,
      );

      return {
        user: createdUser,
        workspace: updatedWorkspace,
        membership: createdMembership,
      };
    });

    const issued = await this.sessionService.createSession({
      userId: user.id,
      role: user.role,
      workspaceId: workspace.id,
      membershipId: membership.id,
      ...meta,
    });

    return {
      accessToken: this.signAccessToken(user, issued.sessionId, {
        workspaceId: workspace.id,
        membershipId: membership.id,
        workspaceRole: membership.role,
        sv: membership.sessionVersion,
      }),
      refreshToken: issued.refreshToken,
      expiresIn: this.configService.get<string>('auth.accessTokenTtl') || '15m',
      user: this.toPublicUser(user),
      workspace: {
        id: workspace.id,
        type: workspace.type,
        name: workspace.name,
        slug: workspace.slug,
        planCode: workspace.planCode,
      },
      membership: {
        id: membership.id,
        role: membership.role,
        sessionVersion: membership.sessionVersion,
      },
      entitlements,
    };
  }

  async login(loginDto: LoginDto, meta: RequestMeta = {}) {
    const user = await this.authenticateCredentials(loginDto.email, loginDto.password);
    const tokens = await this.establishSession(user, meta);
    await this.audit.record({
      actorUserId: user.id,
      action: 'AUTH_LOGIN_SUCCESS',
      resource: 'AuthSession',
      details: { surface: 'MOBILE', role: user.role },
      ipAddress: meta.ipAddress,
    });
    return {
      ...tokens,
      user: this.toPublicUser(user),
    };
  }

  /**
   * The web console has a distinct sign-in endpoint so employee credentials
   * cannot be used to establish an administration-console session.
   */
  async adminLogin(loginDto: LoginDto, meta: RequestMeta = {}) {
    const user = await this.authenticateCredentials(loginDto.email, loginDto.password);
    if (
      !user.canAccessWebAdmin ||
      (user.role !== 'HR_ADMIN' && user.role !== 'SUPER_ADMIN')
    ) {
      await this.audit.record({
        actorUserId: user.id,
        action: 'AUTH_ADMIN_LOGIN_FORBIDDEN',
        resource: 'AuthSession',
        details: { surface: 'WEB_ADMIN', role: user.role },
        ipAddress: meta.ipAddress,
      });
      throw new ForbiddenException(
        'This account is not authorized to access the MacqHR administration console.',
      );
    }
    const tokens = await this.establishSession(user, meta);
    await this.audit.record({
      actorUserId: user.id,
      action: 'AUTH_ADMIN_LOGIN_SUCCESS',
      resource: 'AuthSession',
      details: { surface: 'WEB_ADMIN', role: user.role },
      ipAddress: meta.ipAddress,
    });
    return { ...tokens, user: this.toPublicUser(user) };
  }

  async ssoLogin(ssoDto: SsoLoginDto, meta: RequestMeta = {}) {
    if (!this.configService.get<boolean>('sso.enabled')) {
      throw new NotFoundException('Microsoft Entra SSO is not enabled for this deployment.');
    }

    const claims = await this.verifyEntraIdToken(ssoDto.ssoToken);
    const emailClaim = claims.preferred_username ?? claims.email ?? claims.upn;
    if (typeof emailClaim !== 'string' || !emailClaim.includes('@')) {
      throw new UnauthorizedException('Verified Entra token has no usable email claim.');
    }
    const email = emailClaim.toLowerCase();

    if (email !== ssoDto.email.trim().toLowerCase()) {
      throw new UnauthorizedException('SSO email does not match the verified Entra ID principal.');
    }

    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        branch: true,
        manager: { select: { firstName: true, lastName: true } },
      },
    });

    if (!user) {
      throw new UnauthorizedException(
        `User ${email} does not exist in corporate directory. SSO sync required.`,
      );
    }
    if (!user.isActive) {
      throw new UnauthorizedException('Account has been disabled.');
    }
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { ssoSubject: claims.sub ? String(claims.sub) : null },
    });

    const tokens = await this.establishSession(user, meta);
    return { ...tokens, user: this.toPublicUser(user) };
  }

  async refresh(refreshToken: string, meta: RequestMeta) {
    const rotated = await this.sessionService.rotate(refreshToken, meta);
    const user = await this.prisma.user.findUnique({
      where: { id: rotated.userId },
      include: { branch: true, manager: { select: { firstName: true, lastName: true } } },
    });
    if (!user || !user.isActive) {
      await this.sessionService.revoke(rotated.sessionId, SessionRevokeReason.DEACTIVATED);
      throw new UnauthorizedException('Your session has ended. Sign in again.');
    }

    let workspaceContext: {
      workspaceId: string;
      membershipId: string;
      workspaceRole: string;
      sv: number;
    } | undefined;

    if (rotated.membershipId && rotated.workspaceId) {
      const membership = await this.prisma.membership.findUnique({
        where: { id: rotated.membershipId },
      });
      if (!membership || membership.status !== 'ACTIVE' || membership.workspaceId !== rotated.workspaceId) {
        await this.sessionService.revoke(rotated.sessionId, SessionRevokeReason.DEACTIVATED);
        throw new UnauthorizedException('Your workspace membership is no longer active.');
      }
      workspaceContext = {
        workspaceId: membership.workspaceId,
        membershipId: membership.id,
        workspaceRole: membership.role,
        sv: membership.sessionVersion,
      };
    }

    if (user.role === UserRole.SUPER_ADMIN) {
      const hours =
        this.configService.get<number>('auth.superAdminAbsoluteSessionHours') ?? 8;
      const maxAbsolute = new Date(Date.now() + hours * 60 * 60 * 1000);
      await this.prisma.authSession.updateMany({
        where: { id: rotated.sessionId, absoluteExpiresAt: { gt: maxAbsolute } },
        data: { absoluteExpiresAt: maxAbsolute },
      });
    }
    return {
      accessToken: this.signAccessToken(user, rotated.sessionId, workspaceContext),
      refreshToken: rotated.refreshToken,
      expiresIn: this.configService.get<string>('auth.accessTokenTtl') || '15m',
      user: this.toPublicUser(user),
    };
  }

  async discover(rawEmail: string) {
    const email = rawEmail.trim().toLowerCase();
    const domain = email.split('@')[1] ?? '';
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        isActive: true,
        memberships: {
          where: { status: 'ACTIVE' },
          include: {
            workspace: {
              include: {
                ssoConnection: {
                  select: {
                    provider: true,
                    domain: true,
                    enforced: true,
                    status: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user || !user.isActive) {
      const domainSso = domain
        ? await this.prisma.ssoConnection.findFirst({
            where: {
              domain,
              enforced: true,
              status: 'VERIFIED',
            },
            include: {
              workspace: { select: { id: true, name: true, type: true } },
            },
          })
        : null;
      return {
        passwordAllowed: !domainSso,
        workspaces: domainSso
          ? [
              {
                id: domainSso.workspace.id,
                name: domainSso.workspace.name,
                type: domainSso.workspace.type,
                ssoRequired: true,
                provider: domainSso.provider,
              },
            ]
          : [],
      };
    }

    const workspaces = user.memberships.map((m) => {
      const sso = m.workspace.ssoConnection;
      const ssoRequired = Boolean(sso?.enforced);
      return {
        id: m.workspace.id,
        name: m.workspace.name,
        type: m.workspace.type,
        ssoRequired,
        provider: sso?.provider ?? null,
      };
    });

    const passwordAllowed = !workspaces.some((w) => w.ssoRequired);
    return { passwordAllowed, workspaces };
  }

  async switchWorkspace(
    userId: string,
    currentSessionId: string,
    workspaceId: string,
    meta: RequestMeta = {},
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { branch: true, manager: { select: { firstName: true, lastName: true } } },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Your account is inactive.');
    }

    const membership = await this.workspacesService.requireMembership(workspaceId, userId);
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: { subscription: true },
    });
    if (!workspace || workspace.status !== 'ACTIVE') {
      throw new ForbiddenException('Target workspace is not active.');
    }

    const issued = await this.sessionService.createSession({
      userId: user.id,
      role: user.role,
      workspaceId: workspace.id,
      membershipId: membership.id,
      ...meta,
    });

    if (currentSessionId) {
      await this.sessionService.revoke(currentSessionId, SessionRevokeReason.LOGOUT);
    }

    await this.audit.record({
      workspaceId: workspace.id,
      actorUserId: user.id,
      action: 'AUTH_WORKSPACE_SWITCHED',
      resource: 'AuthSession',
      details: { workspaceId: workspace.id, membershipId: membership.id, role: membership.role },
      ipAddress: meta.ipAddress,
    });

    const entitlements = getEntitlementsForPlan(
      workspace.planCode,
      workspace.subscription?.seatsPurchased,
    );

    return {
      accessToken: this.signAccessToken(user, issued.sessionId, {
        workspaceId: workspace.id,
        membershipId: membership.id,
        workspaceRole: membership.role,
        sv: membership.sessionVersion,
      }),
      refreshToken: issued.refreshToken,
      expiresIn: this.configService.get<string>('auth.accessTokenTtl') || '15m',
      user: this.toPublicUser(user),
      workspace: {
        id: workspace.id,
        type: workspace.type,
        name: workspace.name,
        slug: workspace.slug,
        planCode: workspace.planCode,
      },
      membership: {
        id: membership.id,
        role: membership.role,
        sessionVersion: membership.sessionVersion,
      },
      entitlements,
    };
  }

  async logout(sessionId: string, actorUserId: string): Promise<void> {
    await this.sessionService.revoke(sessionId, SessionRevokeReason.LOGOUT);
    await this.audit.record({
      actorUserId,
      action: 'AUTH_LOGOUT',
      resource: 'AuthSession',
      details: { sessionId },
    });
  }

  async changePassword(
    userId: string,
    sessionId: string,
    dto: ChangePasswordDto,
    meta: RequestMeta,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('User profile not found.');
    const matches = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!matches) throw new UnauthorizedException('The current password is incorrect.');
    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException('Choose a password you have not used as your current password.');
    }
    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        mustChangePassword: false,
        passwordChangedAt: new Date(),
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });
    await this.sessionService.revokeAllForUser(userId, SessionRevokeReason.PASSWORD_CHANGE);
    await this.audit.record({
      actorUserId: userId,
      action: 'AUTH_PASSWORD_CHANGED',
      resource: 'User',
      details: { sessionId },
      ipAddress: meta.ipAddress,
    });
    const refreshed = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { branch: true, manager: { select: { firstName: true, lastName: true } } },
    });
    if (!refreshed) {
      throw new UnauthorizedException('User profile not found.');
    }
    const tokens = await this.establishSession(refreshed, meta);
    return { ...tokens, user: this.toPublicUser(refreshed) };
  }

  async forgotPassword(dto: ForgotPasswordDto, meta: RequestMeta = {}) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (user && user.isActive) {
      const resetToken = this.jwtService.sign(
        {
          sub: user.id,
          email: user.email,
          purpose: 'PASSWORD_RESET',
          pwdFp: user.passwordHash.slice(-12),
        },
        { expiresIn: '15m' },
      );

      try {
        await (this.prisma as any).integrationOutboxEvent?.create({
          data: {
            provider: 'OUTLOOK',
            eventType: 'AUTH_PASSWORD_RESET_EMAIL',
            idempotencyKey: `pwd-reset-${user.id}-${Date.now()}`,
            status: 'DELIVERED',
            attempts: 1,
            externalId: `mail-pwd-reset-${user.id}`,
            payloadJson: {
              to: user.email,
              subject: 'Shiftly Password Reset Request',
              expiresInMinutes: 15,
            },
          },
        });
        await (this.prisma as any).notification?.create({
          data: {
            userId: user.id,
            type: 'SECURITY',
            title: 'Password Reset Requested',
            titleAr: 'طلب إعادة تعيين كلمة المرور',
            body: 'A password reset link was requested for your Shiftly account (valid for 15 minutes).',
            bodyAr: 'تم طلب رابط إعادة تعيين كلمة المرور لحسابك في شفتلي (صالح لمدة 15 دقيقة).',
            dataJson: { action: 'FORGOT_PASSWORD' },
          },
        });
      } catch {
        // Non-blocking in unit-test or offline environments
      }

      await this.audit.record({
        actorUserId: user.id,
        action: 'AUTH_FORGOT_PASSWORD_REQUESTED',
        resource: 'User',
        details: { email: user.email, emailDispatched: true },
        ipAddress: meta.ipAddress,
      });

      return {
        message:
          'If an active account matches that email, password reset instructions have been sent.',
        ...(this.configService.get<string>('environment') !== 'production'
          ? { resetToken }
          : {}),
      };
    }

    return {
      message:
        'If an active account matches that email, password reset instructions have been sent.',
    };
  }

  async resetPasswordWithToken(dto: ResetPasswordDto, meta: RequestMeta = {}) {
    let decoded: { sub?: string; purpose?: string; pwdFp?: string };
    try {
      decoded = this.jwtService.verify(dto.token);
    } catch {
      throw new UnauthorizedException('Password reset token is invalid or has expired.');
    }

    if (decoded.purpose !== 'PASSWORD_RESET' || !decoded.sub) {
      throw new UnauthorizedException('Invalid password reset token.');
    }

    const user = await this.prisma.user.findUnique({ where: { id: decoded.sub } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid password reset token.');
    }

    if (decoded.pwdFp && user.passwordHash.slice(-12) !== decoded.pwdFp) {
      throw new UnauthorizedException('This password reset token has already been used.');
    }

    const samePassword = await bcrypt.compare(dto.newPassword, user.passwordHash);
    if (samePassword) {
      throw new BadRequestException(
        'Choose a password you have not used as your current password.',
      );
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        mustChangePassword: false,
        passwordChangedAt: new Date(),
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });

    await this.sessionService.revokeAllForUser(user.id, SessionRevokeReason.PASSWORD_CHANGE);
    await this.audit.record({
      actorUserId: user.id,
      action: 'AUTH_PASSWORD_RESET_COMPLETED',
      resource: 'User',
      details: { email: user.email },
      ipAddress: meta.ipAddress,
    });

    return { message: 'Password has been reset successfully. You may now sign in.' };
  }

  private async authenticateCredentials(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: {
        branch: true,
        manager: { select: { firstName: true, lastName: true } },
      },
    });

    if (!user) {
      await bcrypt.compare(password, this.dummyHash);
      await this.audit.record({
        action: 'AUTH_LOGIN_FAILED',
        resource: 'User',
        details: { attempts: 0 },
      });
      throw new UnauthorizedException('Invalid email or password.');
    }

    if (user.lockedUntil) {
      if (user.lockedUntil.getTime() > Date.now()) {
        // Spend a real hash comparison on the locked path too, so response
        // timing does not distinguish a locked account from an unknown email.
        await bcrypt.compare(password, this.dummyHash);
        throw new UnauthorizedException('Invalid email or password.');
      }
      // The lock has expired: start a fresh failure window for this attempt.
      await this.prisma.user.updateMany({
        where: { id: user.id, lockedUntil: user.lockedUntil },
        data: { failedLoginAttempts: 0, lockedUntil: null },
      });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      const maxAttempts = this.configService.get<number>('auth.maxFailedLogins') ?? 5;
      const lockoutMinutes = this.configService.get<number>('auth.lockoutMinutes') ?? 15;
      // Increment atomically: parallel attempts each count instead of
      // overwriting one another with a value read before bcrypt.compare.
      const counted = await this.prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: { increment: 1 } },
        select: { failedLoginAttempts: true },
      });
      const attempts = counted.failedLoginAttempts;
      const isLocked = attempts >= maxAttempts;
      if (isLocked) {
        await this.prisma.user.update({
          where: { id: user.id },
          data: { lockedUntil: new Date(Date.now() + lockoutMinutes * 60 * 1000) },
        });
      }
      await this.audit.record({
        actorUserId: user.id,
        action: isLocked ? 'AUTH_LOGIN_LOCKED' : 'AUTH_LOGIN_FAILED',
        resource: 'User',
        details: { attempts },
      });
      throw new UnauthorizedException('Invalid email or password.');
    }

    // Only disclose deactivation once the password is proven, so a failed
    // login never reveals whether an email belongs to an active account.
    if (!user.isActive) {
      throw new UnauthorizedException('This account has been deactivated. Please contact HR.');
    }

    const enforcedSso = await this.prisma.ssoConnection.findFirst({
      where: {
        enforced: true,
        workspace: {
          memberships: {
            some: { userId: user.id, status: 'ACTIVE' },
          },
        },
      },
      select: { provider: true, workspaceId: true },
    });
    if (enforcedSso) {
      throw new ForbiddenException(
        `Password login is disabled because ${enforcedSso.provider} SSO is enforced for your workspace.`,
      );
    }

    if (user.failedLoginAttempts > 0 || user.lockedUntil) {
      await this.prisma.user.updateMany({
        where: {
          id: user.id,
          failedLoginAttempts: user.failedLoginAttempts,
          lockedUntil: user.lockedUntil,
        },
        data: { failedLoginAttempts: 0, lockedUntil: null },
      });
    }

    return user;
  }

  private signAccessToken(
    user: SessionSubject,
    sessionId: string,
    workspaceContext?: {
      workspaceId: string;
      membershipId: string;
      workspaceRole: string;
      sv: number;
    },
  ): string {
    const payload: JwtPayload = {
      sub: user.id,
      employeeId: user.employeeId,
      email: user.email,
      role: user.role,
      branchId: user.branchId,
      name: `${user.firstName} ${user.lastName}`,
      canAccessWebAdmin: user.canAccessWebAdmin,
      sid: sessionId,
      ...(workspaceContext
        ? {
            workspaceId: workspaceContext.workspaceId,
            membershipId: workspaceContext.membershipId,
            workspaceRole: workspaceContext.workspaceRole,
            sv: workspaceContext.sv,
          }
        : {}),
    };
    return this.jwtService.sign(payload);
  }

  private async establishSession(user: SessionSubject, meta: RequestMeta) {
    const ctx = await this.workspacesService.ensureDefaultWorkspaceAndMembership(user.id);
    const issued = await this.sessionService.createSession({
      userId: user.id,
      role: user.role,
      workspaceId: ctx.workspace.id,
      membershipId: ctx.membership.id,
      ...meta,
    });
    return {
      accessToken: this.signAccessToken(user, issued.sessionId, {
        workspaceId: ctx.workspace.id,
        membershipId: ctx.membership.id,
        workspaceRole: ctx.membership.role,
        sv: ctx.membership.sessionVersion,
      }),
      refreshToken: issued.refreshToken,
      expiresIn: this.configService.get<string>('auth.accessTokenTtl') || '15m',
      workspace: {
        id: ctx.workspace.id,
        type: ctx.workspace.type,
        name: ctx.workspace.name,
        slug: ctx.workspace.slug,
        planCode: ctx.workspace.planCode,
      },
      membership: {
        id: ctx.membership.id,
        role: ctx.membership.role,
        sessionVersion: ctx.membership.sessionVersion,
      },
      entitlements: ctx.entitlements,
    };
  }

  private toPublicUser(user: UserProfile) {
    return {
      id: user.id,
      employeeId: user.employeeId,
      firstName: user.firstName,
      lastName: user.lastName,
      name: `${user.firstName} ${user.lastName}`,
      email: user.email,
      phone: user.phone,
      role: user.role,
      department: user.department,
      jobTitle: user.jobTitle,
      fullNameAr: user.fullNameAr,
      titleAr: user.titleAr,
      departmentAr: user.departmentAr,
      nationalId: user.nationalId,
      iqamaNumber: user.iqamaNumber,
      avatarInitials: user.avatarInitials,
      avatarPresetId: user.avatarPresetId,
      avatarColor: user.avatarColor,
      createdAt: user.createdAt,
      isRemoteAllowed: user.isRemoteAllowed,
      manager: user.manager,
      avatarUrl: user.avatarUrl,
      canAccessWebAdmin: user.canAccessWebAdmin,
      branch: user.branch
        ? {
            id: user.branch.id,
            name: user.branch.name,
            nameAr: user.branch.nameAr,
            code: user.branch.code,
            latitude: user.branch.latitude,
            longitude: user.branch.longitude,
            geofenceRadiusMeters: user.branch.geofenceRadiusMeters,
          }
        : null,
      mustChangePassword: user.mustChangePassword,
    };
  }

  private async verifyEntraIdToken(token: string): Promise<Record<string, unknown>> {
    const tenantId = this.configService.get<string>('azure.tenantId');
    const clientId = this.configService.get<string>('azure.clientId');
    if (!tenantId || !clientId) {
      this.logger.error('Entra SSO is unavailable because AZURE_TENANT_ID/AZURE_CLIENT_ID are not configured.');
      throw new UnauthorizedException('Microsoft Entra SSO is not configured.');
    }

    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new UnauthorizedException('Invalid Microsoft Entra ID token.');
    }

    let header: Record<string, unknown>;
    let claims: Record<string, unknown>;
    try {
      header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
      claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    } catch {
      throw new UnauthorizedException('Invalid Microsoft Entra ID token.');
    }
    if (header.alg !== 'RS256' || typeof header.kid !== 'string') {
      throw new UnauthorizedException('Unsupported Microsoft Entra ID token signing method.');
    }

    let keys = await this.getEntraSigningKeys(tenantId);
    let jwk = keys.find((key) => key.kid === header.kid && key.kty === 'RSA');
    if (!jwk) {
      keys = await this.getEntraSigningKeys(tenantId, true);
      jwk = keys.find((key) => key.kid === header.kid && key.kty === 'RSA');
    }
    if (!jwk) {
      throw new UnauthorizedException('Unrecognized Microsoft Entra signing key.');
    }

    const signingInput = Buffer.from(`${parts[0]}.${parts[1]}`);
    const signature = Buffer.from(parts[2], 'base64url');
    let signatureValid = false;
    try {
      signatureValid = verifySignature(
        'RSA-SHA256',
        signingInput,
        createPublicKey({
          // The JWKS response is runtime-validated above; cast through unknown
          // because DOM and Node declare distinct JsonWebKey interfaces.
          key: jwk as unknown as import('crypto').JsonWebKey,
          format: 'jwk',
        }),
        signature,
      );
    } catch {
      signatureValid = false;
    }
    if (!signatureValid) {
      throw new UnauthorizedException('Microsoft Entra ID token signature is invalid.');
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    if (
      claims.aud !== clientId ||
      claims.iss !== `https://login.microsoftonline.com/${tenantId}/v2.0` ||
      claims.tid !== tenantId ||
      typeof claims.exp !== 'number' || claims.exp <= nowSeconds ||
      (typeof claims.nbf === 'number' && claims.nbf > nowSeconds)
    ) {
      throw new UnauthorizedException('Microsoft Entra ID token claims are invalid or expired.');
    }
    return claims;
  }

  private async getEntraSigningKeys(
    tenantId: string,
    forceRefresh = false,
  ): Promise<Array<Record<string, unknown>>> {
    if (!forceRefresh && this.entraJwksCache && this.entraJwksCache.expiresAt > Date.now()) {
      return this.entraJwksCache.keys;
    }
    try {
      const response = await fetch(
        `https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/discovery/v2.0/keys`,
      );
      if (!response.ok) throw new Error(`JWKS request failed: ${response.status}`);
      const body = (await response.json()) as { keys?: Array<Record<string, unknown>> };
      if (!Array.isArray(body.keys)) throw new Error('JWKS response did not contain keys.');
      this.entraJwksCache = { keys: body.keys, expiresAt: Date.now() + 60 * 60 * 1000 };
      return body.keys;
    } catch (error) {
      this.logger.error('Could not retrieve Microsoft Entra signing keys.', error);
      throw new UnauthorizedException('Microsoft Entra SSO verification is temporarily unavailable.');
    }
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        branch: true,
        manager: {
          select: {
            id: true,
            employeeId: true,
            firstName: true,
            lastName: true,
            email: true,
            jobTitle: true,
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('User profile not found.');
    }

    const { passwordHash, ...safeUser } = user;
    return safeUser;
  }
}
