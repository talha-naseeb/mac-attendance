import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Prisma, SessionRevokeReason, UserRole } from '@prisma/client';
import { createPublicKey, verify as verifySignature } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../../common/services/audit.service';
import { LoginDto, SsoLoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtPayload } from './jwt.strategy';
import { SessionService } from './session.service';

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
  ) {}

  async login(loginDto: LoginDto, meta: RequestMeta = {}) {
    const user = await this.authenticateCredentials(loginDto.email, loginDto.password);
    const tokens = await this.establishSession(user, meta);
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
      throw new ForbiddenException(
        'This account is not authorized to access the MacqHR administration console.',
      );
    }
    const tokens = await this.establishSession(user, meta);
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
    return {
      accessToken: this.signAccessToken(user, rotated.sessionId),
      refreshToken: rotated.refreshToken,
      expiresIn: this.configService.get<string>('auth.accessTokenTtl') || '15m',
      user: this.toPublicUser(user),
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
      await this.prisma.user.update({
        where: { id: user.id },
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

    if (user.failedLoginAttempts > 0 || user.lockedUntil) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: 0, lockedUntil: null },
      });
    }

    return user;
  }

  private signAccessToken(user: SessionSubject, sessionId: string): string {
    const payload: JwtPayload = {
      sub: user.id,
      employeeId: user.employeeId,
      email: user.email,
      role: user.role,
      branchId: user.branchId,
      name: `${user.firstName} ${user.lastName}`,
      canAccessWebAdmin: user.canAccessWebAdmin,
      sid: sessionId,
    };
    return this.jwtService.sign(payload);
  }

  private async establishSession(user: SessionSubject, meta: RequestMeta) {
    const issued = await this.sessionService.createSession({
      userId: user.id,
      role: user.role,
      ...meta,
    });
    return {
      accessToken: this.signAccessToken(user, issued.sessionId),
      refreshToken: issued.refreshToken,
      expiresIn: this.configService.get<string>('auth.accessTokenTtl') || '15m',
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
