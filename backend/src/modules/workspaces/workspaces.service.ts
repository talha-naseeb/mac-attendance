import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  LeaveApprovalPolicy,
  Membership,
  MembershipRole,
  MembershipStatus,
  Prisma,
  SessionRevokeReason,
  SsoConnectionStatus,
  Workspace,
  WorkspacePlanCode,
  WorkspaceStatus,
  WorkspaceType,
} from '@prisma/client';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../../common/services/audit.service';
import {
  getEntitlementsForPlan,
  mapMembershipRoleToUserRole,
  mapUserRoleToMembershipRole,
  slugifyWorkspaceName,
  WorkspaceEntitlements,
} from './entitlements';
import {
  ConvertToBusinessDto,
  CreateInviteDto,
  CreateWorkspaceDto,
  UpdateMemberDto,
  UpdateWorkspaceDto,
  UpsertSsoConnectionDto,
  UpsertSsoGroupMappingsDto,
} from './dto/workspaces.dto';

const DEFAULT_WORKSPACE_SLUG = 'macquires';
const DEFAULT_WORKSPACE_NAME = 'Macquires';
const INVITE_TTL_DAYS = 14;

export interface WorkspaceSeatSummary {
  usedSeats: number;
  activeMembers: number;
  pendingInvites: number;
  seatsPurchased: number;
  remainingSeats: number;
  isAtLimit: boolean;
}

@Injectable()
export class WorkspacesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private hashInviteToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }

  private maskSecret(secret?: string): string | undefined {
    if (!secret || !secret.trim()) return undefined;
    const trimmed = secret.trim();
    if (trimmed.length <= 4) return '****';
    return `${'*'.repeat(Math.min(12, trimmed.length - 4))}${trimmed.slice(-4)}`;
  }

  private async ensureUniqueSlug(baseName: string, tx: Prisma.TransactionClient): Promise<string> {
    const base = slugifyWorkspaceName(baseName);
    let candidate = base;
    let attempt = 0;
    while (attempt < 50) {
      const existing = await tx.workspace.findUnique({
        where: { slug: candidate },
        select: { id: true },
      });
      if (!existing) return candidate;
      attempt += 1;
      candidate = `${base}-${randomBytes(2).toString('hex')}`;
    }
    return `${base}-${Date.now()}`;
  }

  async ensureDefaultWorkspaceAndMembership(userId: string): Promise<{
    workspace: Workspace;
    membership: Membership;
    entitlements: WorkspaceEntitlements;
  }> {
    const existingMembership = await this.prisma.membership.findFirst({
      where: { userId, status: MembershipStatus.ACTIVE },
      include: { workspace: { include: { subscription: true } } },
      orderBy: { joinedAt: 'asc' },
    });

    if (existingMembership) {
      const entitlements = getEntitlementsForPlan(
        existingMembership.workspace.planCode,
        existingMembership.workspace.subscription?.seatsPurchased,
      );
      return {
        workspace: existingMembership.workspace,
        membership: existingMembership,
        entitlements,
      };
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found.');
    }

    return this.prisma.$transaction(async (tx) => {
      let workspace = await tx.workspace.findUnique({
        where: { slug: DEFAULT_WORKSPACE_SLUG },
        include: { subscription: true },
      });

      if (!workspace) {
        workspace = await tx.workspace.create({
          data: {
            type: WorkspaceType.BUSINESS,
            name: DEFAULT_WORKSPACE_NAME,
            nameAr: 'ماكوايرز',
            slug: DEFAULT_WORKSPACE_SLUG,
            country: 'SA',
            timezone: 'Asia/Riyadh',
            currency: 'SAR',
            planCode: WorkspacePlanCode.ENTERPRISE,
            status: WorkspaceStatus.ACTIVE,
            leaveApprovalPolicy: LeaveApprovalPolicy.MANAGER_THEN_HR,
            subscription: {
              create: {
                provider: 'INTERNAL',
                seatsPurchased: 250,
                status: 'ACTIVE',
              },
            },
          },
          include: { subscription: true },
        });
      }

      const role = mapUserRoleToMembershipRole(user.role);
      const membership = await tx.membership.upsert({
        where: {
          workspaceId_userId: { workspaceId: workspace.id, userId: user.id },
        },
        update: {},
        create: {
          workspaceId: workspace.id,
          userId: user.id,
          role,
          status: user.isActive ? MembershipStatus.ACTIVE : MembershipStatus.SUSPENDED,
          employeeId: user.employeeId,
          jobTitle: user.jobTitle,
          titleAr: user.titleAr,
          department: user.department,
          departmentAr: user.departmentAr,
          branchId: user.branchId,
          basicSalarySar: user.basicSalarySar,
          housingAllowanceSar: user.housingAllowanceSar,
          transportAllowanceSar: user.transportAllowanceSar,
          isRemoteAllowed: user.isRemoteAllowed,
        },
      });

      if (!workspace.ownerMembershipId && role === MembershipRole.OWNER) {
        workspace = await tx.workspace.update({
          where: { id: workspace.id },
          data: { ownerMembershipId: membership.id },
          include: { subscription: true },
        });
      }

      const entitlements = getEntitlementsForPlan(
        workspace.planCode,
        workspace.subscription?.seatsPurchased,
      );
      return { workspace, membership, entitlements };
    });
  }

  /**
   * Idempotent backfill from single-company Macquires tables into the
   * workspace/membership model (docs/account-model/README.md §9.3).
   */
  async backfillDefaultWorkspace() {
    return this.prisma.$transaction(async (tx) => {
      let workspace = await tx.workspace.findUnique({
        where: { slug: DEFAULT_WORKSPACE_SLUG },
        include: { subscription: true },
      });

      if (!workspace) {
        workspace = await tx.workspace.create({
          data: {
            type: WorkspaceType.BUSINESS,
            name: DEFAULT_WORKSPACE_NAME,
            nameAr: 'ماكوايرز',
            slug: DEFAULT_WORKSPACE_SLUG,
            country: 'SA',
            timezone: 'Asia/Riyadh',
            currency: 'SAR',
            planCode: WorkspacePlanCode.ENTERPRISE,
            status: WorkspaceStatus.ACTIVE,
            leaveApprovalPolicy: LeaveApprovalPolicy.MANAGER_THEN_HR,
            subscription: {
              create: {
                provider: 'INTERNAL',
                seatsPurchased: 250,
                status: 'ACTIVE',
              },
            },
          },
          include: { subscription: true },
        });
      }

      const users = await tx.user.findMany({ orderBy: { createdAt: 'asc' } });
      const userToMembershipId = new Map<string, string>();
      let firstOwnerMembershipId: string | null = workspace.ownerMembershipId;

      for (const user of users) {
        const role = mapUserRoleToMembershipRole(user.role);
        const m = await tx.membership.upsert({
          where: {
            workspaceId_userId: { workspaceId: workspace.id, userId: user.id },
          },
          update: {
            role,
            status: user.isActive ? MembershipStatus.ACTIVE : MembershipStatus.SUSPENDED,
          },
          create: {
            workspaceId: workspace.id,
            userId: user.id,
            role,
            status: user.isActive ? MembershipStatus.ACTIVE : MembershipStatus.SUSPENDED,
            employeeId: user.employeeId,
            jobTitle: user.jobTitle,
            titleAr: user.titleAr,
            department: user.department,
            departmentAr: user.departmentAr,
            branchId: user.branchId,
            basicSalarySar: user.basicSalarySar,
            housingAllowanceSar: user.housingAllowanceSar,
            transportAllowanceSar: user.transportAllowanceSar,
            isRemoteAllowed: user.isRemoteAllowed,
          },
        });
        userToMembershipId.set(user.id, m.id);
        if (!firstOwnerMembershipId && role === MembershipRole.OWNER) {
          firstOwnerMembershipId = m.id;
        }
      }

      for (const user of users) {
        if (user.managerId && userToMembershipId.has(user.managerId)) {
          const membershipId = userToMembershipId.get(user.id)!;
          const reportsToMembershipId = userToMembershipId.get(user.managerId)!;
          if (membershipId !== reportsToMembershipId) {
            await tx.membership.update({
              where: { id: membershipId },
              data: { reportsToMembershipId },
            });
          }
        }
      }

      if (firstOwnerMembershipId && !workspace.ownerMembershipId) {
        workspace = await tx.workspace.update({
          where: { id: workspace.id },
          data: { ownerMembershipId: firstOwnerMembershipId },
          include: { subscription: true },
        });
      }

      const [
        branchesUpdated,
        attendanceRecordsUpdated,
        attendanceDaysUpdated,
        leaveBalancesUpdated,
        leaveRequestsUpdated,
        payrollRunsUpdated,
        claimsUpdated,
        documentsUpdated,
        auditLogsUpdated,
      ] = await Promise.all([
        tx.branch.updateMany({ where: { workspaceId: null }, data: { workspaceId: workspace.id } }),
        tx.attendanceRecord.updateMany({
          where: { workspaceId: null },
          data: { workspaceId: workspace.id },
        }),
        tx.attendanceDay.updateMany({
          where: { workspaceId: null },
          data: { workspaceId: workspace.id },
        }),
        tx.leaveBalance.updateMany({
          where: { workspaceId: null },
          data: { workspaceId: workspace.id },
        }),
        tx.leaveRequest.updateMany({
          where: { workspaceId: null },
          data: { workspaceId: workspace.id },
        }),
        tx.payrollRun.updateMany({
          where: { workspaceId: null },
          data: { workspaceId: workspace.id },
        }),
        tx.reimbursementClaim.updateMany({
          where: { workspaceId: null },
          data: { workspaceId: workspace.id },
        }),
        tx.employeeDocument.updateMany({
          where: { workspaceId: null },
          data: { workspaceId: workspace.id },
        }),
        tx.auditLog.updateMany({
          where: { workspaceId: null },
          data: { workspaceId: workspace.id },
        }),
      ]);

      return {
        workspaceId: workspace.id,
        slug: workspace.slug,
        membershipsBackfilled: users.length,
        domainRecordsUpdated: {
          branches: branchesUpdated.count,
          attendanceRecords: attendanceRecordsUpdated.count,
          attendanceDays: attendanceDaysUpdated.count,
          leaveBalances: leaveBalancesUpdated.count,
          leaveRequests: leaveRequestsUpdated.count,
          payrollRuns: payrollRunsUpdated.count,
          reimbursementClaims: claimsUpdated.count,
          employeeDocuments: documentsUpdated.count,
          auditLogs: auditLogsUpdated.count,
        },
      };
    });
  }

  async getSeatSummary(workspaceId: string): Promise<WorkspaceSeatSummary> {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: { subscription: true },
    });
    if (!workspace) {
      throw new NotFoundException('Workspace not found.');
    }

    const entitlements = getEntitlementsForPlan(
      workspace.planCode,
      workspace.subscription?.seatsPurchased,
    );
    const now = new Date();

    const [activeMembers, pendingInvites] = await Promise.all([
      this.prisma.membership.count({
        where: {
          workspaceId,
          status: { in: [MembershipStatus.ACTIVE, MembershipStatus.INVITED] },
        },
      }),
      this.prisma.invite.count({
        where: {
          workspaceId,
          acceptedAt: null,
          revokedAt: null,
          expiresAt: { gt: now },
        },
      }),
    ]);

    const seatsPurchased =
      workspace.type === WorkspaceType.PERSONAL ? 1 : entitlements.maxSeats;
    const usedSeats = activeMembers + pendingInvites;
    return {
      usedSeats,
      activeMembers,
      pendingInvites,
      seatsPurchased,
      remainingSeats: Math.max(0, seatsPurchased - usedSeats),
      isAtLimit: usedSeats >= seatsPurchased,
    };
  }

  async listUserWorkspaces(userId: string) {
    let memberships = await this.prisma.membership.findMany({
      where: { userId, status: MembershipStatus.ACTIVE },
      include: {
        workspace: {
          include: {
            subscription: true,
            ssoConnection: { select: { provider: true, enforced: true, status: true } },
          },
        },
      },
      orderBy: { joinedAt: 'asc' },
    });

    if (memberships.length === 0) {
      await this.ensureDefaultWorkspaceAndMembership(userId);
      memberships = await this.prisma.membership.findMany({
        where: { userId, status: MembershipStatus.ACTIVE },
        include: {
          workspace: {
            include: {
              subscription: true,
              ssoConnection: { select: { provider: true, enforced: true, status: true } },
            },
          },
        },
        orderBy: { joinedAt: 'asc' },
      });
    }

    return Promise.all(
      memberships.map(async (m) => {
        const seats = await this.getSeatSummary(m.workspaceId);
        const entitlements = getEntitlementsForPlan(
          m.workspace.planCode,
          m.workspace.subscription?.seatsPurchased,
        );
        return {
          workspace: {
            id: m.workspace.id,
            type: m.workspace.type,
            name: m.workspace.name,
            nameAr: m.workspace.nameAr,
            slug: m.workspace.slug,
            country: m.workspace.country,
            timezone: m.workspace.timezone,
            currency: m.workspace.currency,
            planCode: m.workspace.planCode,
            status: m.workspace.status,
            leaveApprovalPolicy: m.workspace.leaveApprovalPolicy,
          },
          membership: {
            id: m.id,
            role: m.role,
            legacyRole: mapMembershipRoleToUserRole(m.role),
            status: m.status,
            sessionVersion: m.sessionVersion,
            jobTitle: m.jobTitle,
            department: m.department,
          },
          entitlements,
          seats,
        };
      }),
    );
  }

  async createWorkspace(userId: string, dto: CreateWorkspaceDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found.');
    }

    const planCode =
      dto.planCode ??
      (dto.type === WorkspaceType.PERSONAL
        ? WorkspacePlanCode.INDIVIDUAL_FREE
        : WorkspacePlanCode.BUSINESS_STARTER);

    if (
      dto.type === WorkspaceType.PERSONAL &&
      planCode !== WorkspacePlanCode.INDIVIDUAL_FREE &&
      planCode !== WorkspacePlanCode.INDIVIDUAL_PRO
    ) {
      throw new BadRequestException(
        'Personal workspaces only support INDIVIDUAL_FREE or INDIVIDUAL_PRO plans.',
      );
    }

    if (
      dto.type === WorkspaceType.BUSINESS &&
      (planCode === WorkspacePlanCode.INDIVIDUAL_FREE ||
        planCode === WorkspacePlanCode.INDIVIDUAL_PRO)
    ) {
      throw new BadRequestException(
        'Business workspaces require a BUSINESS_STARTER, BUSINESS_GROWTH, or ENTERPRISE plan.',
      );
    }

    const entitlements = getEntitlementsForPlan(planCode);

    return this.prisma.$transaction(async (tx) => {
      const slug = await this.ensureUniqueSlug(dto.name, tx);
      const workspace = await tx.workspace.create({
        data: {
          type: dto.type,
          name: dto.name.trim(),
          nameAr: dto.nameAr?.trim() || null,
          slug,
          country: dto.country?.trim() || 'SA',
          timezone: dto.timezone?.trim() || 'Asia/Riyadh',
          currency: dto.currency?.trim() || 'SAR',
          planCode,
          status: WorkspaceStatus.ACTIVE,
          leaveApprovalPolicy:
            dto.leaveApprovalPolicy ?? LeaveApprovalPolicy.MANAGER_ONLY,
          subscription: {
            create: {
              provider: 'INTERNAL',
              seatsPurchased: entitlements.maxSeats,
              status: 'ACTIVE',
            },
          },
        },
        include: { subscription: true },
      });

      const membership = await tx.membership.create({
        data: {
          workspaceId: workspace.id,
          userId: user.id,
          role: MembershipRole.OWNER,
          status: MembershipStatus.ACTIVE,
          employeeId: `EMP-${randomBytes(3).toString('hex').toUpperCase()}`,
          jobTitle: dto.type === WorkspaceType.PERSONAL ? 'Self' : 'Workspace Owner',
          department: dto.type === WorkspaceType.PERSONAL ? 'Personal' : 'Executive',
          isRemoteAllowed: dto.type === WorkspaceType.PERSONAL ? true : user.isRemoteAllowed,
        },
      });

      const updated = await tx.workspace.update({
        where: { id: workspace.id },
        data: { ownerMembershipId: membership.id },
      });

      await this.audit.record(
        {
          workspaceId: workspace.id,
          actorUserId: userId,
          action: 'WORKSPACE_CREATED',
          resource: 'Workspace',
          details: { type: dto.type, planCode, slug: workspace.slug },
        },
        tx,
      );

      return {
        workspace: updated,
        membership,
        entitlements,
      };
    });
  }

  async convertPersonalToBusiness(
    workspaceId: string,
    actorUserId: string,
    dto: ConvertToBusinessDto,
  ) {
    const actor = await this.requireMembership(workspaceId, actorUserId);
    if (actor.role !== MembershipRole.OWNER) {
      throw new ForbiddenException('Only a workspace owner can convert a workspace to Business.');
    }

    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: { subscription: true },
    });
    if (!workspace) {
      throw new NotFoundException('Workspace not found.');
    }
    if (workspace.type === WorkspaceType.BUSINESS) {
      throw new BadRequestException('This workspace is already a Business workspace.');
    }

    const targetPlan = dto.planCode ?? WorkspacePlanCode.BUSINESS_STARTER;
    if (
      targetPlan === WorkspacePlanCode.INDIVIDUAL_FREE ||
      targetPlan === WorkspacePlanCode.INDIVIDUAL_PRO
    ) {
      throw new BadRequestException('Select a Business or Enterprise plan to convert.');
    }

    const baseEntitlements = getEntitlementsForPlan(targetPlan);
    const seatsPurchased = dto.seatsPurchased ?? baseEntitlements.maxSeats;

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.workspace.update({
        where: { id: workspaceId },
        data: {
          type: WorkspaceType.BUSINESS,
          name: dto.name.trim(),
          planCode: targetPlan,
        },
      });

      await tx.subscription.upsert({
        where: { workspaceId },
        update: { seatsPurchased, status: 'ACTIVE' },
        create: {
          workspaceId,
          provider: 'INTERNAL',
          seatsPurchased,
          status: 'ACTIVE',
        },
      });

      await this.audit.record(
        {
          workspaceId,
          actorUserId,
          action: 'WORKSPACE_CONVERTED_TO_BUSINESS',
          resource: 'Workspace',
          details: { planCode: targetPlan, seatsPurchased },
        },
        tx,
      );

      return {
        workspace: updated,
        entitlements: getEntitlementsForPlan(targetPlan, seatsPurchased),
      };
    });
  }

  async getCurrentWorkspaceContext(workspaceId: string, userId: string) {
    const membership = await this.requireMembership(workspaceId, userId);
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: { subscription: true },
    });
    if (!workspace) {
      throw new NotFoundException('Workspace not found.');
    }
    const seats = await this.getSeatSummary(workspaceId);
    const entitlements = getEntitlementsForPlan(
      workspace.planCode,
      workspace.subscription?.seatsPurchased,
    );
    return {
      workspace,
      membership,
      entitlements,
      seats,
    };
  }

  async updateCurrentWorkspace(workspaceId: string, actorUserId: string, dto: UpdateWorkspaceDto) {
    const actor = await this.requireMembership(workspaceId, actorUserId);
    if (actor.role !== MembershipRole.OWNER && actor.role !== MembershipRole.HR_ADMIN) {
      throw new ForbiddenException('Only Workspace Owners or HR Admins can update workspace settings.');
    }
    if ((dto.planCode !== undefined || dto.seatsPurchased !== undefined) && actor.role !== MembershipRole.OWNER) {
      throw new ForbiddenException('Only a Workspace Owner can change the plan or seat allocation.');
    }

    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: { subscription: true },
    });
    if (!workspace) {
      throw new NotFoundException('Workspace not found.');
    }

    const seats = await this.getSeatSummary(workspaceId);
    if (dto.seatsPurchased !== undefined && dto.seatsPurchased < seats.usedSeats) {
      throw new BadRequestException(
        `Cannot reduce seats below currently used seats (${seats.usedSeats}).`,
      );
    }

    if (
      dto.planCode &&
      (dto.planCode === WorkspacePlanCode.INDIVIDUAL_FREE ||
        dto.planCode === WorkspacePlanCode.INDIVIDUAL_PRO) &&
      seats.activeMembers > 1
    ) {
      throw new BadRequestException(
        'Cannot downgrade to an Individual plan while more than one member belongs to the workspace.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.workspace.update({
        where: { id: workspaceId },
        data: {
          ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
          ...(dto.nameAr !== undefined ? { nameAr: dto.nameAr.trim() } : {}),
          ...(dto.country !== undefined ? { country: dto.country.trim() } : {}),
          ...(dto.timezone !== undefined ? { timezone: dto.timezone.trim() } : {}),
          ...(dto.currency !== undefined ? { currency: dto.currency.trim() } : {}),
          ...(dto.leaveApprovalPolicy !== undefined
            ? { leaveApprovalPolicy: dto.leaveApprovalPolicy }
            : {}),
          ...(dto.planCode !== undefined ? { planCode: dto.planCode } : {}),
        },
        include: { subscription: true },
      });

      const resolvedPlan = dto.planCode ?? updated.planCode;
      const defaultSeats = getEntitlementsForPlan(resolvedPlan).maxSeats;
      const targetSeats =
        dto.seatsPurchased ?? updated.subscription?.seatsPurchased ?? defaultSeats;

      if (dto.planCode !== undefined || dto.seatsPurchased !== undefined) {
        await tx.subscription.upsert({
          where: { workspaceId },
          update: { seatsPurchased: targetSeats },
          create: {
            workspaceId,
            provider: 'INTERNAL',
            seatsPurchased: targetSeats,
            status: 'ACTIVE',
          },
        });
      }

      await this.audit.record(
        {
          workspaceId,
          actorUserId,
          action: 'WORKSPACE_UPDATED',
          resource: 'Workspace',
          details: { ...dto },
        },
        tx,
      );

      return {
        workspace: updated,
        entitlements: getEntitlementsForPlan(resolvedPlan, targetSeats),
      };
    });
  }

  async listMembers(workspaceId: string, actorUserId: string) {
    await this.requireMembership(workspaceId, actorUserId);
    const members = await this.prisma.membership.findMany({
      where: { workspaceId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            fullName: true,
            fullNameAr: true,
            avatarUrl: true,
            avatarInitials: true,
            avatarColor: true,
            updatedAt: true,
          },
        },
        reportsTo: {
          select: {
            id: true,
            role: true,
            user: { select: { firstName: true, lastName: true, fullName: true } },
          },
        },
      },
      orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
    });
    return members;
  }

  async updateMember(
    workspaceId: string,
    targetMembershipId: string,
    actorUserId: string,
    dto: UpdateMemberDto,
  ) {
    const actor = await this.requireMembership(workspaceId, actorUserId);
    if (actor.role !== MembershipRole.OWNER && actor.role !== MembershipRole.HR_ADMIN) {
      throw new ForbiddenException('Only Workspace Owners or HR Admins can manage members.');
    }

    const target = await this.prisma.membership.findFirst({
      where: { id: targetMembershipId, workspaceId },
    });
    if (!target) {
      throw new NotFoundException('Membership not found in this workspace.');
    }

    if (actor.role === MembershipRole.HR_ADMIN) {
      if (target.role === MembershipRole.OWNER || target.role === MembershipRole.HR_ADMIN) {
        throw new ForbiddenException('HR Admins cannot modify Owners or other HR Admins.');
      }
      if (dto.role === MembershipRole.OWNER || dto.role === MembershipRole.HR_ADMIN) {
        throw new ForbiddenException('Only a Workspace Owner can grant OWNER or HR_ADMIN roles.');
      }
    }

    const isDemotingOwner =
      target.role === MembershipRole.OWNER &&
      ((dto.role && dto.role !== MembershipRole.OWNER) ||
        dto.status === MembershipStatus.SUSPENDED);
    if (isDemotingOwner) {
      const otherOwners = await this.prisma.membership.count({
        where: {
          workspaceId,
          role: MembershipRole.OWNER,
          status: MembershipStatus.ACTIVE,
          id: { not: target.id },
        },
      });
      if (otherOwners === 0) {
        throw new BadRequestException(
          'Cannot demote or suspend the last active Owner of this workspace. Transfer ownership first.',
        );
      }
    }

    if (dto.reportsToMembershipId !== undefined && dto.reportsToMembershipId !== null) {
      if (dto.reportsToMembershipId === target.id) {
        throw new BadRequestException('A member cannot report to themselves.');
      }
      const manager = await this.prisma.membership.findFirst({
        where: { id: dto.reportsToMembershipId, workspaceId },
      });
      if (!manager) {
        throw new BadRequestException('Selected reporting manager does not belong to this workspace.');
      }
      await this.assertNoReportingCycle(workspaceId, target.id, dto.reportsToMembershipId);
    }

    const roleOrStatusChanged =
      (dto.role !== undefined && dto.role !== target.role) ||
      (dto.status !== undefined && dto.status !== target.status);

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.membership.update({
        where: { id: target.id },
        data: {
          ...(dto.role !== undefined ? { role: dto.role, managedBySsoGroup: null } : {}),
          ...(dto.status !== undefined ? { status: dto.status } : {}),
          ...(dto.reportsToMembershipId !== undefined
            ? { reportsToMembershipId: dto.reportsToMembershipId }
            : {}),
          ...(dto.jobTitle !== undefined ? { jobTitle: dto.jobTitle } : {}),
          ...(dto.department !== undefined ? { department: dto.department } : {}),
          ...(dto.isRemoteAllowed !== undefined
            ? { isRemoteAllowed: dto.isRemoteAllowed }
            : {}),
          ...(roleOrStatusChanged ? { sessionVersion: { increment: 1 } } : {}),
        },
      });

      if (roleOrStatusChanged) {
        const reason =
          dto.status === MembershipStatus.SUSPENDED
            ? SessionRevokeReason.DEACTIVATED
            : SessionRevokeReason.ROLE_CHANGE;
        await tx.authSession.updateMany({
          where: { membershipId: target.id, revokedAt: null },
          data: { revokedAt: new Date(), revokeReason: reason },
        });
      }

      await this.audit.record(
        {
          workspaceId,
          actorUserId,
          action: 'MEMBERSHIP_UPDATED',
          resource: 'Membership',
          details: {
            targetMembershipId: target.id,
            previousRole: target.role,
            newRole: updated.role,
            previousStatus: target.status,
            newStatus: updated.status,
          },
        },
        tx,
      );

      return updated;
    });
  }

  async createInvite(workspaceId: string, actorUserId: string, dto: CreateInviteDto) {
    const actor = await this.requireMembership(workspaceId, actorUserId);
    if (actor.role !== MembershipRole.OWNER && actor.role !== MembershipRole.HR_ADMIN) {
      throw new ForbiddenException('Only Workspace Owners or HR Admins can invite teammates.');
    }

    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
    });
    if (!workspace) {
      throw new NotFoundException('Workspace not found.');
    }
    if (workspace.type === WorkspaceType.PERSONAL) {
      throw new ForbiddenException({
        code: 'PLAN_SEAT_LIMIT',
        message: 'Individual workspaces cannot invite teammates. Convert to a Business workspace first.',
      });
    }

    const proposedRole = dto.role ?? MembershipRole.EMPLOYEE;
    if (
      actor.role === MembershipRole.HR_ADMIN &&
      (proposedRole === MembershipRole.OWNER || proposedRole === MembershipRole.HR_ADMIN)
    ) {
      throw new ForbiddenException('HR Admins can only invite EMPLOYEE or MANAGER members.');
    }

    const seats = await this.getSeatSummary(workspaceId);
    if (seats.isAtLimit) {
      throw new ForbiddenException({
        code: 'PLAN_SEAT_LIMIT',
        message: `All ${seats.seatsPurchased} seats in this workspace are used. Upgrade or free a seat before inviting.`,
      });
    }

    const email = dto.email.trim().toLowerCase();
    const existingActiveMember = await this.prisma.membership.findFirst({
      where: {
        workspaceId,
        user: { email },
        status: { in: [MembershipStatus.ACTIVE, MembershipStatus.INVITED] },
      },
    });
    if (existingActiveMember) {
      throw new ConflictException(`${email} is already a member of this workspace.`);
    }

    const existingPendingInvite = await this.prisma.invite.findFirst({
      where: {
        workspaceId,
        email,
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
    if (existingPendingInvite) {
      throw new ConflictException(`An active invitation already exists for ${email}.`);
    }

    if (dto.reportsToMembershipId) {
      const manager = await this.prisma.membership.findFirst({
        where: { id: dto.reportsToMembershipId, workspaceId },
      });
      if (!manager) {
        throw new BadRequestException('Selected reporting manager does not belong to this workspace.');
      }
    }

    const rawToken = randomBytes(24).toString('hex');
    const tokenHash = this.hashInviteToken(rawToken);
    const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);

    const invite = await this.prisma.invite.create({
      data: {
        workspaceId,
        email,
        role: proposedRole,
        jobTitle: dto.jobTitle?.trim() || null,
        department: dto.department?.trim() || null,
        reportsToMembershipId: dto.reportsToMembershipId ?? null,
        tokenHash,
        expiresAt,
        invitedByMembershipId: actor.id,
      },
    });

    await this.audit.record({
      workspaceId,
      actorUserId,
      action: 'WORKSPACE_INVITE_CREATED',
      resource: 'Invite',
      details: { inviteId: invite.id, email, role: proposedRole },
    });

    return {
      invite: {
        id: invite.id,
        workspaceId: invite.workspaceId,
        email: invite.email,
        role: invite.role,
        jobTitle: invite.jobTitle,
        department: invite.department,
        expiresAt: invite.expiresAt,
        createdAt: invite.createdAt,
      },
      inviteToken: rawToken,
    };
  }

  async listInvites(workspaceId: string, actorUserId: string) {
    const actor = await this.requireMembership(workspaceId, actorUserId);
    if (actor.role !== MembershipRole.OWNER && actor.role !== MembershipRole.HR_ADMIN) {
      throw new ForbiddenException('Only Workspace Owners or HR Admins can view invitations.');
    }

    return this.prisma.invite.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        workspaceId: true,
        email: true,
        role: true,
        jobTitle: true,
        department: true,
        reportsToMembershipId: true,
        expiresAt: true,
        acceptedAt: true,
        revokedAt: true,
        createdAt: true,
      },
    });
  }

  async revokeInvite(workspaceId: string, inviteId: string, actorUserId: string) {
    const actor = await this.requireMembership(workspaceId, actorUserId);
    if (actor.role !== MembershipRole.OWNER && actor.role !== MembershipRole.HR_ADMIN) {
      throw new ForbiddenException('Only Workspace Owners or HR Admins can revoke invitations.');
    }

    const invite = await this.prisma.invite.findFirst({
      where: { id: inviteId, workspaceId },
    });
    if (!invite) {
      throw new NotFoundException('Invitation not found in this workspace.');
    }
    if (invite.acceptedAt) {
      throw new BadRequestException('Cannot revoke an invitation that has already been accepted.');
    }

    const updated = await this.prisma.invite.update({
      where: { id: invite.id },
      data: { revokedAt: new Date() },
    });

    await this.audit.record({
      workspaceId,
      actorUserId,
      action: 'WORKSPACE_INVITE_REVOKED',
      resource: 'Invite',
      details: { inviteId: invite.id, email: invite.email },
    });

    return updated;
  }

  async acceptInvite(userId: string, userEmail: string, rawToken: string) {
    const tokenHash = this.hashInviteToken(rawToken.trim());
    const invite = await this.prisma.invite.findUnique({
      where: { tokenHash },
      include: { workspace: true },
    });

    if (!invite) {
      throw new NotFoundException('Invitation token is invalid.');
    }
    if (invite.revokedAt) {
      throw new BadRequestException('This invitation has been revoked.');
    }
    if (invite.acceptedAt) {
      throw new ConflictException('This invitation has already been used.');
    }
    if (invite.expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException('This invitation has expired. Ask your workspace admin for a new invite.');
    }
    if (invite.email.toLowerCase() !== userEmail.trim().toLowerCase()) {
      throw new ForbiddenException(
        'This invitation was issued for a different email address.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.membership.findUnique({
        where: {
          workspaceId_userId: { workspaceId: invite.workspaceId, userId },
        },
      });

      const membership = existing
        ? await tx.membership.update({
            where: { id: existing.id },
            data: {
              role: invite.role,
              status: MembershipStatus.ACTIVE,
              reportsToMembershipId: invite.reportsToMembershipId,
              ...(invite.jobTitle ? { jobTitle: invite.jobTitle } : {}),
              ...(invite.department ? { department: invite.department } : {}),
            },
          })
        : await tx.membership.create({
            data: {
              workspaceId: invite.workspaceId,
              userId,
              role: invite.role,
              status: MembershipStatus.ACTIVE,
              employeeId: `EMP-${randomBytes(3).toString('hex').toUpperCase()}`,
              jobTitle: invite.jobTitle,
              department: invite.department,
              reportsToMembershipId: invite.reportsToMembershipId,
            },
          });

      await tx.invite.update({
        where: { id: invite.id },
        data: { acceptedAt: new Date() },
      });

      await this.audit.record(
        {
          workspaceId: invite.workspaceId,
          actorUserId: userId,
          action: 'WORKSPACE_INVITE_ACCEPTED',
          resource: 'Membership',
          details: { inviteId: invite.id, membershipId: membership.id, role: membership.role },
        },
        tx,
      );

      return { workspace: invite.workspace, membership };
    });
  }

  async getSsoConfig(workspaceId: string, actorUserId: string) {
    const actor = await this.requireMembership(workspaceId, actorUserId);
    if (actor.role !== MembershipRole.OWNER && actor.role !== MembershipRole.HR_ADMIN) {
      throw new ForbiddenException('Only Owners and HR Admins can view SSO settings.');
    }

    const [connection, groupMappings] = await Promise.all([
      this.prisma.ssoConnection.findUnique({ where: { workspaceId } }),
      this.prisma.ssoGroupMapping.findMany({
        where: { workspaceId },
        orderBy: { providerGroupName: 'asc' },
      }),
    ]);

    return {
      connection: connection ?? {
        workspaceId,
        provider: 'MICROSOFT',
        status: SsoConnectionStatus.NOT_CONFIGURED,
        enforced: false,
        autoProvision: false,
        allowHrGroupMapping: false,
        defaultRole: MembershipRole.EMPLOYEE,
      },
      groupMappings,
    };
  }

  async upsertSsoConfig(workspaceId: string, actorUserId: string, dto: UpsertSsoConnectionDto) {
    const actor = await this.requireMembership(workspaceId, actorUserId);
    if (actor.role !== MembershipRole.OWNER) {
      throw new ForbiddenException('Only a Workspace Owner can configure SSO connections.');
    }

    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: { subscription: true },
    });
    if (!workspace) {
      throw new NotFoundException('Workspace not found.');
    }
    const entitlements = getEntitlementsForPlan(
      workspace.planCode,
      workspace.subscription?.seatsPurchased,
    );
    if (!entitlements.sso) {
      throw new ForbiddenException({
        code: 'PLAN_ENTITLEMENT_REQUIRED',
        message: 'Upgrade to BUSINESS_GROWTH or ENTERPRISE to enable SSO.',
      });
    }

    if (dto.defaultRole === MembershipRole.OWNER || dto.defaultRole === MembershipRole.HR_ADMIN) {
      throw new BadRequestException('SSO default role may only be EMPLOYEE or MANAGER.');
    }

    const maskedSecret = this.maskSecret(dto.clientSecret);
    const saved = await this.prisma.ssoConnection.upsert({
      where: { workspaceId },
      update: {
        provider: dto.provider,
        ...(dto.domain !== undefined ? { domain: dto.domain.trim().toLowerCase() } : {}),
        ...(dto.tenantId !== undefined ? { tenantId: dto.tenantId.trim() } : {}),
        ...(dto.clientId !== undefined ? { clientId: dto.clientId.trim() } : {}),
        ...(maskedSecret ? { clientSecretMasked: maskedSecret } : {}),
        ...(dto.enforced !== undefined ? { enforced: dto.enforced } : {}),
        ...(dto.autoProvision !== undefined ? { autoProvision: dto.autoProvision } : {}),
        ...(dto.allowHrGroupMapping !== undefined
          ? { allowHrGroupMapping: dto.allowHrGroupMapping }
          : {}),
        ...(dto.defaultRole !== undefined ? { defaultRole: dto.defaultRole } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
      },
      create: {
        workspaceId,
        provider: dto.provider,
        domain: dto.domain?.trim().toLowerCase() ?? null,
        tenantId: dto.tenantId?.trim() ?? null,
        clientId: dto.clientId?.trim() ?? null,
        clientSecretMasked: maskedSecret ?? null,
        enforced: dto.enforced ?? false,
        autoProvision: dto.autoProvision ?? false,
        allowHrGroupMapping: dto.allowHrGroupMapping ?? false,
        defaultRole: dto.defaultRole ?? MembershipRole.EMPLOYEE,
        status: dto.status ?? SsoConnectionStatus.DRAFT,
      },
    });

    await this.audit.record({
      workspaceId,
      actorUserId,
      action: 'WORKSPACE_SSO_UPDATED',
      resource: 'SsoConnection',
      details: {
        provider: saved.provider,
        enforced: saved.enforced,
        autoProvision: saved.autoProvision,
        status: saved.status,
      },
    });

    return saved;
  }

  async upsertGroupMappings(
    workspaceId: string,
    actorUserId: string,
    dto: UpsertSsoGroupMappingsDto,
  ) {
    const actor = await this.requireMembership(workspaceId, actorUserId);
    if (actor.role !== MembershipRole.OWNER) {
      throw new ForbiddenException('Only a Workspace Owner can manage SSO group mappings.');
    }

    const connection = await this.prisma.ssoConnection.findUnique({
      where: { workspaceId },
    });
    for (const item of dto.mappings) {
      if (item.role === MembershipRole.OWNER) {
        throw new BadRequestException('Automatic group mapping to OWNER is never permitted.');
      }
      if (item.role === MembershipRole.HR_ADMIN && !connection?.allowHrGroupMapping) {
        throw new BadRequestException(
          'Mapping a provider group to HR_ADMIN requires explicit allowHrGroupMapping opt-in on the SSO connection.',
        );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.ssoGroupMapping.deleteMany({ where: { workspaceId } });
      if (dto.mappings.length > 0) {
        await tx.ssoGroupMapping.createMany({
          data: dto.mappings.map((m) => ({
            workspaceId,
            providerGroupId: m.providerGroupId.trim(),
            providerGroupName: m.providerGroupName.trim(),
            role: m.role,
          })),
        });
      }
      return tx.ssoGroupMapping.findMany({
        where: { workspaceId },
        orderBy: { providerGroupName: 'asc' },
      });
    });
  }

  async requireMembership(workspaceId: string, userId: string): Promise<Membership> {
    const membership = await this.prisma.membership.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });
    if (!membership || membership.status !== MembershipStatus.ACTIVE) {
      throw new ForbiddenException('You do not have an active membership in this workspace.');
    }
    return membership;
  }

  private async assertNoReportingCycle(
    workspaceId: string,
    targetMembershipId: string,
    proposedManagerMembershipId: string,
  ): Promise<void> {
    let cursor: string | null = proposedManagerMembershipId;
    const visited = new Set<string>([targetMembershipId]);
    while (cursor) {
      if (visited.has(cursor)) {
        throw new BadRequestException('Reporting line update would introduce a hierarchy cycle.');
      }
      visited.add(cursor);
      const row = await this.prisma.membership.findFirst({
        where: { id: cursor, workspaceId },
        select: { reportsToMembershipId: true },
      });
      cursor = row?.reportsToMembershipId ?? null;
    }
  }
}
