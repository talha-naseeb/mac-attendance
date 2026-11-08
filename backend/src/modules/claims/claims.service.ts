import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ClaimCategory,
  ClaimStage,
  ClaimStatus,
  NotificationType,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../../common/services/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PayrollService } from '../payroll/payroll.service';
import { halalasToSar, sarToHalalas } from '../../common/utils/gosi.util';
import {
  ClaimDecisionDto,
  SubmitClaimDto,
  UpdateClaimPolicyDto,
} from './dto/claims.dto';

export interface DefaultPolicySpec {
  category: ClaimCategory;
  monthlyCapHalalas: number;
  annualCapHalalas: number;
  requiresReceipt: boolean;
  allowDirectToHr: boolean;
}

export const DEFAULT_REIMBURSEMENT_POLICIES: DefaultPolicySpec[] = [
  {
    category: ClaimCategory.MEDICAL,
    monthlyCapHalalas: 500_000, // 5,000 SAR
    annualCapHalalas: 2_500_000, // 25,000 SAR
    requiresReceipt: true,
    allowDirectToHr: true,
  },
  {
    category: ClaimCategory.INSURANCE,
    monthlyCapHalalas: 1_000_000, // 10,000 SAR
    annualCapHalalas: 3_000_000, // 30,000 SAR
    requiresReceipt: true,
    allowDirectToHr: true,
  },
  {
    category: ClaimCategory.PETROL,
    monthlyCapHalalas: 150_000, // 1,500 SAR
    annualCapHalalas: 1_800_000, // 18,000 SAR
    requiresReceipt: true,
    allowDirectToHr: false,
  },
  {
    category: ClaimCategory.WIFI,
    monthlyCapHalalas: 50_000, // 500 SAR
    annualCapHalalas: 600_000, // 6,000 SAR
    requiresReceipt: true,
    allowDirectToHr: false,
  },
];

@Injectable()
export class ClaimsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit?: AuditService,
    private readonly notifications?: NotificationsService,
    private readonly payrollService?: PayrollService,
  ) {}

  normalizePeriod(period?: string): string {
    const target =
      period?.trim() ||
      `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(target)) {
      throw new BadRequestException(
        `Invalid claim period "${target}". Expected YYYY-MM format.`,
      );
    }
    return target;
  }

  async ensureDefaultPolicies() {
    const existing =
      (await this.prisma.reimbursementPolicy?.findMany({
        orderBy: { category: 'asc' },
      })) ?? [];

    if (existing.length >= DEFAULT_REIMBURSEMENT_POLICIES.length) {
      return existing;
    }

    const results = [];
    for (const spec of DEFAULT_REIMBURSEMENT_POLICIES) {
      const policy = await this.prisma.reimbursementPolicy.upsert({
        where: { category: spec.category },
        create: {
          category: spec.category,
          monthlyCapHalalas: spec.monthlyCapHalalas,
          annualCapHalalas: spec.annualCapHalalas,
          requiresReceipt: spec.requiresReceipt,
          allowDirectToHr: spec.allowDirectToHr,
          isActive: true,
        },
        update: {},
      });
      results.push(policy);
    }
    return results;
  }

  async getPoliciesForUser(userId: string, periodInput?: string) {
    const period = this.normalizePeriod(periodInput);
    const yearPrefix = period.slice(0, 4);
    const policies = await this.ensureDefaultPolicies();

    const userClaims =
      (await this.prisma.reimbursementClaim?.findMany({
        where: {
          userId,
          status: {
            in: [
              ClaimStatus.PENDING_MANAGER,
              ClaimStatus.PENDING_HR,
              ClaimStatus.APPROVED,
            ],
          },
          period: { startsWith: yearPrefix },
        },
      })) ?? [];

    return policies.map((p) => {
      const monthlyUsedHalalas = userClaims
        .filter((c) => c.category === p.category && c.period === period)
        .reduce((acc, c) => acc + c.amountHalalas, 0);
      const annualUsedHalalas = userClaims
        .filter((c) => c.category === p.category)
        .reduce((acc, c) => acc + c.amountHalalas, 0);

      return {
        id: p.id,
        category: p.category,
        monthlyCapSar: halalasToSar(p.monthlyCapHalalas),
        monthlyCapHalalas: p.monthlyCapHalalas,
        annualCapSar: halalasToSar(p.annualCapHalalas),
        annualCapHalalas: p.annualCapHalalas,
        monthlyUsedSar: halalasToSar(monthlyUsedHalalas),
        monthlyRemainingSar: halalasToSar(
          Math.max(0, p.monthlyCapHalalas - monthlyUsedHalalas),
        ),
        annualUsedSar: halalasToSar(annualUsedHalalas),
        annualRemainingSar: halalasToSar(
          Math.max(0, p.annualCapHalalas - annualUsedHalalas),
        ),
        requiresReceipt: p.requiresReceipt,
        allowDirectToHr: p.allowDirectToHr,
        isActive: p.isActive,
      };
    });
  }

  async updatePolicy(
    category: ClaimCategory,
    dto: UpdateClaimPolicyDto,
    actorUserId?: string,
  ) {
    await this.ensureDefaultPolicies();
    const existing = await this.prisma.reimbursementPolicy.findUnique({
      where: { category },
    });
    if (!existing) {
      throw new NotFoundException(`Policy for category ${category} not found.`);
    }

    const updated = await this.prisma.reimbursementPolicy.update({
      where: { category },
      data: {
        monthlyCapHalalas:
          dto.monthlyCapSar !== undefined
            ? sarToHalalas(dto.monthlyCapSar)
            : existing.monthlyCapHalalas,
        annualCapHalalas:
          dto.annualCapSar !== undefined
            ? sarToHalalas(dto.annualCapSar)
            : existing.annualCapHalalas,
        allowDirectToHr:
          dto.allowDirectToHr !== undefined
            ? dto.allowDirectToHr
            : existing.allowDirectToHr,
        isActive: dto.isActive !== undefined ? dto.isActive : existing.isActive,
      },
    });

    await this.audit?.record({
      actorUserId: actorUserId ?? null,
      action: 'CLAIM_POLICY_UPDATED',
      resource: 'ReimbursementPolicy',
      details: {
        category,
        monthlyCapSar: halalasToSar(updated.monthlyCapHalalas),
        annualCapSar: halalasToSar(updated.annualCapHalalas),
        allowDirectToHr: updated.allowDirectToHr,
        isActive: updated.isActive,
      },
    });

    return {
      ...updated,
      monthlyCapSar: halalasToSar(updated.monthlyCapHalalas),
      annualCapSar: halalasToSar(updated.annualCapHalalas),
    };
  }

  private formatClaim(claim: any) {
    return {
      id: claim.id,
      userId: claim.userId,
      employee: claim.user
        ? {
            id: claim.user.id,
            employeeId: claim.user.employeeId,
            fullName: claim.user.fullName,
            department: claim.user.department,
            jobTitle: claim.user.jobTitle,
          }
        : undefined,
      category: claim.category,
      period: claim.period,
      amountSar: halalasToSar(claim.amountHalalas),
      amountHalalas: claim.amountHalalas,
      currency: claim.currency,
      description: claim.description,
      receiptUrl: claim.receiptUrl,
      receiptFileName: claim.receiptFileName,
      exceedsCap: claim.exceedsCap,
      isPrivateMedical: claim.isPrivateMedical,
      status: claim.status,
      stage: claim.stage,
      routedDirectlyToHr: claim.routedDirectlyToHr,
      managerReviewedById: claim.managerReviewedById,
      managerReviewedAt: claim.managerReviewedAt,
      managerComments: claim.managerComments,
      hrReviewedById: claim.hrReviewedById,
      hrReviewedAt: claim.hrReviewedAt,
      hrComments: claim.hrComments,
      payrollRunId: claim.payrollRunId,
      createdAt: claim.createdAt,
      updatedAt: claim.updatedAt,
    };
  }

  /**
   * M11.1–M11.3: Submits a reimbursement claim with receipt validation,
   * policy cap checks, and two-stage or direct-to-HR medical routing.
   */
  async submitClaim(userId: string, dto: SubmitClaimDto) {
    if (!dto.receiptUrl || !dto.receiptUrl.trim()) {
      throw new BadRequestException(
        'A supporting receipt or medical bill attachment is required.',
      );
    }
    if (!dto.amountSar || dto.amountSar <= 0) {
      throw new BadRequestException('Claim amount must be greater than zero.');
    }
    if (!dto.description || dto.description.trim().length < 3) {
      throw new BadRequestException('A valid claim description is required.');
    }

    const period = this.normalizePeriod(dto.period);
    const amountHalalas = sarToHalalas(dto.amountSar);

    // Check if the target payroll period is already LOCKED
    const existingRun = await this.prisma.payrollRun?.findUnique({
      where: { period },
    });
    if (existingRun && existingRun.status === 'LOCKED') {
      throw new ConflictException(
        `Cannot submit claim for LOCKED payroll period ${period}.`,
      );
    }

    const employee = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!employee) {
      throw new NotFoundException('Employee not found.');
    }

    await this.ensureDefaultPolicies();
    const policy = await this.prisma.reimbursementPolicy.findUnique({
      where: { category: dto.category },
    });
    if (!policy || !policy.isActive) {
      throw new BadRequestException(
        `Reimbursement category ${dto.category} is not active.`,
      );
    }

    const yearPrefix = period.slice(0, 4);
    const existingClaims = await this.prisma.reimbursementClaim.findMany({
      where: {
        userId,
        category: dto.category,
        status: {
          in: [
            ClaimStatus.PENDING_MANAGER,
            ClaimStatus.PENDING_HR,
            ClaimStatus.APPROVED,
          ],
        },
        period: { startsWith: yearPrefix },
      },
    });

    const monthlyUsedHalalas = existingClaims
      .filter((c) => c.period === period)
      .reduce((acc, c) => acc + c.amountHalalas, 0);
    const annualUsedHalalas = existingClaims.reduce(
      (acc, c) => acc + c.amountHalalas,
      0,
    );

    const exceedsMonthly =
      monthlyUsedHalalas + amountHalalas > policy.monthlyCapHalalas;
    const exceedsAnnual =
      annualUsedHalalas + amountHalalas > policy.annualCapHalalas;
    const exceedsCap = exceedsMonthly || exceedsAnnual;

    if (exceedsCap && !dto.requestCapException) {
      throw new BadRequestException(
        `Claim amount (${dto.amountSar.toFixed(2)} SAR) exceeds the ${dto.category} policy cap (Monthly remaining: ${halalasToSar(Math.max(0, policy.monthlyCapHalalas - monthlyUsedHalalas)).toFixed(2)} SAR, Annual remaining: ${halalasToSar(Math.max(0, policy.annualCapHalalas - annualUsedHalalas)).toFixed(2)} SAR).`,
      );
    }

    const isMedicalOrInsurance =
      dto.category === ClaimCategory.MEDICAL ||
      dto.category === ClaimCategory.INSURANCE;
    const isPrivateMedical = Boolean(
      isMedicalOrInsurance && dto.isPrivateMedical && policy.allowDirectToHr,
    );

    const hasActiveManager = Boolean(
      employee.managerId && employee.managerId !== employee.id,
    );
    const routeDirectlyToHr =
      isPrivateMedical ||
      !hasActiveManager ||
      employee.role === UserRole.MANAGER ||
      employee.role === UserRole.HR_ADMIN ||
      employee.role === UserRole.SUPER_ADMIN;

    const status = routeDirectlyToHr
      ? ClaimStatus.PENDING_HR
      : ClaimStatus.PENDING_MANAGER;
    const stage = routeDirectlyToHr
      ? ClaimStage.STAGE_2_HR
      : ClaimStage.STAGE_1_MANAGER;

    const created = await this.prisma.reimbursementClaim.create({
      data: {
        userId,
        category: dto.category,
        period,
        amountHalalas,
        currency: 'SAR',
        description: dto.description.trim(),
        receiptUrl: dto.receiptUrl.trim(),
        receiptFileName: dto.receiptFileName?.trim() || null,
        exceedsCap,
        isPrivateMedical,
        status,
        stage,
        routedDirectlyToHr: routeDirectlyToHr,
      },
      include: { user: true },
    });

    await this.audit?.record({
      actorUserId: userId,
      action: 'REIMBURSEMENT_CLAIM_SUBMITTED',
      resource: 'ReimbursementClaim',
      details: {
        claimId: created.id,
        category: created.category,
        period: created.period,
        amountSar: halalasToSar(created.amountHalalas),
        isPrivateMedical: created.isPrivateMedical,
        routedDirectlyToHr: created.routedDirectlyToHr,
        exceedsCap: created.exceedsCap,
      },
    });

    // Notify next approver
    if (!routeDirectlyToHr && employee.managerId) {
      await this.notifications
        ?.createNotification({
          userId: employee.managerId,
          actorId: userId,
          type: NotificationType.SYSTEM,
          title: `New ${created.category} Claim Request`,
          titleAr: `طلب تعويض جديد (${created.category})`,
          body: `${employee.fullName} submitted a ${halalasToSar(created.amountHalalas).toFixed(2)} SAR ${created.category} claim for ${created.period}.`,
          dataJson: { claimId: created.id, category: created.category },
        })
        .catch(() => undefined);
    }

    return this.formatClaim(created);
  }

  async getMyClaims(userId: string) {
    const claims = await this.prisma.reimbursementClaim.findMany({
      where: { userId },
      include: { user: true },
      orderBy: { createdAt: 'desc' },
    });
    return claims.map((c) => this.formatClaim(c));
  }

  /**
   * M11.3: Enforces strict medical privacy — line managers cannot view
   * private Medical/Insurance claims or claims from outside their hierarchy.
   */
  async getClaimById(claimId: string, actorUserId: string, actorRole: string) {
    const claim = await this.prisma.reimbursementClaim.findUnique({
      where: { id: claimId },
      include: { user: true },
    });
    if (!claim) {
      throw new NotFoundException('Reimbursement claim not found.');
    }

    const isOwner = claim.userId === actorUserId;
    const isHrOrSuper =
      actorRole === UserRole.HR_ADMIN || actorRole === UserRole.SUPER_ADMIN;

    if (isOwner || isHrOrSuper) {
      return this.formatClaim(claim);
    }

    if (actorRole === UserRole.MANAGER) {
      if (claim.isPrivateMedical || claim.routedDirectlyToHr) {
        throw new ForbiddenException(
          'Private Medical/Insurance claims are restricted to HR Admin and the employee.',
        );
      }
      if (claim.user?.managerId !== actorUserId) {
        throw new ForbiddenException(
          'You can only view claims for your direct reports.',
        );
      }
      return this.formatClaim(claim);
    }

    throw new ForbiddenException('Access denied to this reimbursement claim.');
  }

  async getPendingClaims(actorUserId: string, actorRole: string) {
    if (
      actorRole === UserRole.HR_ADMIN ||
      actorRole === UserRole.SUPER_ADMIN
    ) {
      const claims = await this.prisma.reimbursementClaim.findMany({
        where: {
          status: {
            in: [ClaimStatus.PENDING_MANAGER, ClaimStatus.PENDING_HR],
          },
        },
        include: { user: true },
        orderBy: { createdAt: 'desc' },
      });
      return claims.map((c) => this.formatClaim(c));
    }

    if (actorRole === UserRole.MANAGER) {
      const claims = await this.prisma.reimbursementClaim.findMany({
        where: {
          status: ClaimStatus.PENDING_MANAGER,
          stage: ClaimStage.STAGE_1_MANAGER,
          isPrivateMedical: false,
          routedDirectlyToHr: false,
          user: { managerId: actorUserId },
        },
        include: { user: true },
        orderBy: { createdAt: 'desc' },
      });
      return claims.map((c) => this.formatClaim(c));
    }

    throw new ForbiddenException('Not authorized to view pending claims.');
  }

  async getAllClaimsForAdmin(period?: string) {
    const where: any = {};
    if (period) {
      where.period = this.normalizePeriod(period);
    }
    const claims = await this.prisma.reimbursementClaim.findMany({
      where,
      include: { user: true },
      orderBy: { createdAt: 'desc' },
    });
    return claims.map((c) => this.formatClaim(c));
  }

  /**
   * M11.3 & M11.4: Two-stage approval pipeline:
   * - Stage 1 (MANAGER): PENDING_MANAGER -> PENDING_HR
   * - Stage 2 (HR_ADMIN / SUPER_ADMIN): PENDING_HR -> APPROVED (and syncs open payroll run)
   * Blocks modification if linked to a LOCKED payroll run.
   */
  async makeDecision(
    claimId: string,
    actorUserId: string,
    actorRole: string,
    dto: ClaimDecisionDto,
  ) {
    const claim = await this.prisma.reimbursementClaim.findUnique({
      where: { id: claimId },
      include: { user: true, payrollRun: true },
    });
    if (!claim) {
      throw new NotFoundException('Reimbursement claim not found.');
    }

    // Rule: Once a claim is linked to a locked payroll run, its amount and status are immutable.
    if (claim.payrollRun && claim.payrollRun.status === 'LOCKED') {
      throw new ConflictException(
        'Claim is linked to a LOCKED payroll run and is immutable.',
      );
    }
    const periodRun = await this.prisma.payrollRun?.findUnique({
      where: { period: claim.period },
    });
    if (periodRun && periodRun.status === 'LOCKED') {
      throw new ConflictException(
        `Payroll period ${claim.period} is LOCKED; claim status is immutable.`,
      );
    }

    if (claim.userId === actorUserId && actorRole !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('You cannot approve or reject your own claim.');
    }

    if (
      claim.status === ClaimStatus.REJECTED ||
      claim.status === ClaimStatus.CANCELLED
    ) {
      throw new BadRequestException(
        `Claim is already ${claim.status} and cannot be decided.`,
      );
    }

    if (claim.status === ClaimStatus.APPROVED) {
      return this.formatClaim(claim);
    }

    const isHrOrSuper =
      actorRole === UserRole.HR_ADMIN || actorRole === UserRole.SUPER_ADMIN;

    // Stage 1: Line Manager decision
    if (claim.stage === ClaimStage.STAGE_1_MANAGER && !isHrOrSuper) {
      if (actorRole !== UserRole.MANAGER) {
        throw new ForbiddenException('Only a Manager or HR Admin can review claims.');
      }
      if (claim.isPrivateMedical || claim.routedDirectlyToHr) {
        throw new ForbiddenException(
          'Private Medical/Insurance claims can only be reviewed by HR Admin.',
        );
      }
      if (claim.user?.managerId !== actorUserId) {
        throw new ForbiddenException(
          'You can only decide claims for your direct reports.',
        );
      }

      if (dto.decision === 'REJECTED') {
        const rejected = await this.prisma.reimbursementClaim.update({
          where: { id: claim.id },
          data: {
            status: ClaimStatus.REJECTED,
            stage: ClaimStage.COMPLETED,
            managerReviewedById: actorUserId,
            managerReviewedAt: new Date(),
            managerComments: dto.comments ?? null,
          },
          include: { user: true },
        });

        await this.audit?.record({
          actorUserId,
          action: 'REIMBURSEMENT_CLAIM_REJECTED_MANAGER',
          resource: 'ReimbursementClaim',
          details: { claimId: claim.id, comments: dto.comments ?? null },
        });

        await this.notifications
          ?.createNotification({
            userId: claim.userId,
            actorId: actorUserId,
            type: NotificationType.SYSTEM,
            title: `${claim.category} Claim Rejected`,
            titleAr: `تم رفض طلب التعويض (${claim.category})`,
            body: `Your ${halalasToSar(claim.amountHalalas).toFixed(2)} SAR ${claim.category} claim was rejected by your manager.${dto.comments ? ` Note: ${dto.comments}` : ''}`,
            dataJson: { claimId: claim.id, status: ClaimStatus.REJECTED },
          })
          .catch(() => undefined);

        return this.formatClaim(rejected);
      }

      const stage1Approved = await this.prisma.reimbursementClaim.update({
        where: { id: claim.id },
        data: {
          status: ClaimStatus.PENDING_HR,
          stage: ClaimStage.STAGE_2_HR,
          managerReviewedById: actorUserId,
          managerReviewedAt: new Date(),
          managerComments: dto.comments ?? null,
        },
        include: { user: true },
      });

      await this.audit?.record({
        actorUserId,
        action: 'REIMBURSEMENT_CLAIM_STAGE1_APPROVED',
        resource: 'ReimbursementClaim',
        details: { claimId: claim.id, comments: dto.comments ?? null },
      });

      await this.notifications
        ?.createNotification({
          userId: claim.userId,
          actorId: actorUserId,
          type: NotificationType.SYSTEM,
          title: `${claim.category} Claim Approved by Manager (Stage 1)`,
          titleAr: `تمت موافقة المدير على طلب التعويض (${claim.category})`,
          body: `Your ${halalasToSar(claim.amountHalalas).toFixed(2)} SAR ${claim.category} claim is now pending final HR approval.`,
          dataJson: { claimId: claim.id, status: ClaimStatus.PENDING_HR },
        })
        .catch(() => undefined);

      return this.formatClaim(stage1Approved);
    }

    // Stage 2 (or HR override): HR_ADMIN / SUPER_ADMIN decision
    if (!isHrOrSuper) {
      throw new ForbiddenException(
        'Only HR Admin or Super Admin can make Stage 2 claim decisions.',
      );
    }

    if (dto.decision === 'REJECTED') {
      const rejected = await this.prisma.reimbursementClaim.update({
        where: { id: claim.id },
        data: {
          status: ClaimStatus.REJECTED,
          stage: ClaimStage.COMPLETED,
          hrReviewedById: actorUserId,
          hrReviewedAt: new Date(),
          hrComments: dto.comments ?? null,
        },
        include: { user: true },
      });

      await this.audit?.record({
        actorUserId,
        action: 'REIMBURSEMENT_CLAIM_REJECTED_HR',
        resource: 'ReimbursementClaim',
        details: { claimId: claim.id, comments: dto.comments ?? null },
      });

      await this.notifications
        ?.createNotification({
          userId: claim.userId,
          actorId: actorUserId,
          type: NotificationType.SYSTEM,
          title: `${claim.category} Claim Rejected by HR`,
          titleAr: `تم رفض طلب التعويض من الموارد البشرية (${claim.category})`,
          body: `Your ${halalasToSar(claim.amountHalalas).toFixed(2)} SAR ${claim.category} claim was rejected by HR.${dto.comments ? ` Note: ${dto.comments}` : ''}`,
          dataJson: { claimId: claim.id, status: ClaimStatus.REJECTED },
        })
        .catch(() => undefined);

      return this.formatClaim(rejected);
    }

    const approved = await this.prisma.reimbursementClaim.update({
      where: { id: claim.id },
      data: {
        status: ClaimStatus.APPROVED,
        stage: ClaimStage.COMPLETED,
        hrReviewedById: actorUserId,
        hrReviewedAt: new Date(),
        hrComments: dto.comments ?? null,
        payrollRunId: periodRun?.id ?? null,
      },
      include: { user: true },
    });

    await this.audit?.record({
      actorUserId,
      action: 'REIMBURSEMENT_CLAIM_APPROVED',
      resource: 'ReimbursementClaim',
      details: {
        claimId: claim.id,
        category: claim.category,
        period: claim.period,
        amountSar: halalasToSar(claim.amountHalalas),
      },
    });

    // If an unlocked payroll run already exists for this period, re-prepare it so payslips reflect the reimbursement immediately
    if (periodRun && periodRun.status !== 'LOCKED' && this.payrollService) {
      await this.payrollService.preparePayrollRun(
        claim.period,
        actorUserId,
        periodRun.notes ?? undefined,
      );
    }

    const refreshed = await this.prisma.reimbursementClaim.findUniqueOrThrow({
      where: { id: approved.id },
      include: { user: true },
    });

    await this.notifications
      ?.createNotification({
        userId: claim.userId,
        actorId: actorUserId,
        type: NotificationType.SYSTEM,
        title: `${claim.category} Claim Approved`,
        titleAr: `تمت الموافقة النهائية على طلب التعويض (${claim.category})`,
        body: `Your ${halalasToSar(claim.amountHalalas).toFixed(2)} SAR ${claim.category} claim has been approved and added to your ${claim.period} payroll.`,
        dataJson: {
          claimId: claim.id,
          status: ClaimStatus.APPROVED,
          period: claim.period,
        },
      })
      .catch(() => undefined);

    return this.formatClaim(refreshed);
  }

  async cancelClaim(claimId: string, actorUserId: string, actorRole: string) {
    const claim = await this.prisma.reimbursementClaim.findUnique({
      where: { id: claimId },
      include: { user: true, payrollRun: true },
    });
    if (!claim) {
      throw new NotFoundException('Reimbursement claim not found.');
    }

    const isOwner = claim.userId === actorUserId;
    const isHrOrSuper =
      actorRole === UserRole.HR_ADMIN || actorRole === UserRole.SUPER_ADMIN;
    if (!isOwner && !isHrOrSuper) {
      throw new ForbiddenException('You can only cancel your own claims.');
    }

    if (claim.payrollRun && claim.payrollRun.status === 'LOCKED') {
      throw new ConflictException(
        'Claim is linked to a LOCKED payroll run and is immutable.',
      );
    }
    const periodRun = await this.prisma.payrollRun?.findUnique({
      where: { period: claim.period },
    });
    if (periodRun && periodRun.status === 'LOCKED') {
      throw new ConflictException(
        `Payroll period ${claim.period} is LOCKED; claim is immutable.`,
      );
    }

    const cancelled = await this.prisma.reimbursementClaim.update({
      where: { id: claim.id },
      data: {
        status: ClaimStatus.CANCELLED,
        stage: ClaimStage.COMPLETED,
        payrollRunId: null,
      },
      include: { user: true },
    });

    if (periodRun && periodRun.status !== 'LOCKED' && this.payrollService) {
      await this.payrollService.preparePayrollRun(
        claim.period,
        actorUserId,
        periodRun.notes ?? undefined,
      );
    }

    await this.audit?.record({
      actorUserId,
      action: 'REIMBURSEMENT_CLAIM_CANCELLED',
      resource: 'ReimbursementClaim',
      details: { claimId: claim.id, period: claim.period },
    });

    return this.formatClaim(cancelled);
  }
}
