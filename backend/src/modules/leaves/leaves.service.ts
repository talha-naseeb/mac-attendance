import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  SubmitLeaveRequestDto,
  LeaveDecisionDto,
  CancelLeaveRequestDto,
  LeaveType,
  LeaveDecision,
} from './dto/leaves.dto';
import { calculateWorkingDays } from '../../common/utils/leave-calculator.util';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '@prisma/client';

@Injectable()
export class LeavesService {
  private readonly logger = new Logger(LeavesService.name);

  constructor(
    private prisma: PrismaService,
    private notifications?: NotificationsService,
  ) {}

  /**
   * Generates Microsoft Teams Adaptive Card JSON payload for manager approval notifications.
   */
  buildAdaptiveCardPayload(request: {
    id: string;
    employeeName: string;
    employeeEmail: string;
    type: string;
    daysCount: number;
    startDate: string;
    endDate: string;
    reason: string;
    stage: string;
  }) {
    return {
      type: 'message',
      attachments: [
        {
          contentType: 'application/vnd.microsoft.card.adaptive',
          contentUrl: null,
          content: {
            $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
            type: 'AdaptiveCard',
            version: '1.4',
            msteams: { width: 'Full' },
            body: [
              {
                type: 'TextBlock',
                text: '🌴 Leave Request Pending Approval',
                weight: 'Bolder',
                size: 'Medium',
                color: 'Accent',
              },
              {
                type: 'FactSet',
                facts: [
                  { title: 'Employee:', value: request.employeeName },
                  { title: 'Email:', value: request.employeeEmail },
                  { title: 'Leave Type:', value: request.type },
                  {
                    title: 'Dates:',
                    value: `${request.startDate.split('T')[0]} to ${request.endDate.split('T')[0]} (${request.daysCount} days)`,
                  },
                  { title: 'Stage:', value: request.stage },
                  { title: 'Reason:', value: request.reason },
                ],
              },
            ],
            actions: [
              {
                type: 'Action.Http',
                title: '✅ Approve',
                method: 'PATCH',
                url: `https://api.shiftly.app/api/leaves/${request.id}/decision`,
                body: JSON.stringify({ decision: 'APPROVED' }),
              },
              {
                type: 'Action.Http',
                title: '❌ Reject',
                method: 'PATCH',
                url: `https://api.shiftly.app/api/leaves/${request.id}/decision`,
                body: JSON.stringify({ decision: 'REJECTED' }),
              },
            ],
          },
        },
      ],
    };
  }

  /**
   * Returns current leave balances for a user, automatically seeding default
   * Saudi labor law quotas if none exist for the active year.
   */
  async getBalances(userId: string, year?: number) {
    const currentYear = year || new Date().getFullYear();
    let balances = await this.prisma.leaveBalance.findMany({
      where: { userId, year: currentYear },
    });

    if (balances.length === 0) {
      const defaultQuotas = [
        { leaveType: LeaveType.ANNUAL, totalDays: 30 },
        { leaveType: LeaveType.SICK, totalDays: 30 },
        { leaveType: LeaveType.SICK_ON_FILE, totalDays: 15 },
        { leaveType: LeaveType.HAJJ, totalDays: 10 },
        { leaveType: LeaveType.PATERNITY, totalDays: 3 },
        { leaveType: LeaveType.MATERNITY, totalDays: 70 },
        { leaveType: LeaveType.MARRIAGE, totalDays: 5 },
        { leaveType: LeaveType.BEREAVEMENT, totalDays: 5 },
        { leaveType: LeaveType.EMERGENCY, totalDays: 5 },
      ];

      for (const quota of defaultQuotas) {
        const created = await this.prisma.leaveBalance.create({
          data: {
            userId,
            leaveType: quota.leaveType,
            totalDays: quota.totalDays,
            usedDays: 0,
            pendingDays: 0,
            remainingDays: quota.totalDays,
            year: currentYear,
          },
        });

        // Record initial immutable ACCRUAL ledger entry
        await this.prisma.leaveBalanceLedger.create({
          data: {
            balanceId: created.id,
            userId,
            leaveType: quota.leaveType,
            entryType: 'ACCRUAL',
            amount: quota.totalDays,
            balanceBefore: 0,
            balanceAfter: quota.totalDays,
            reason: `Annual ${currentYear} policy accrual grant`,
          },
        });
      }

      balances = await this.prisma.leaveBalance.findMany({
        where: { userId, year: currentYear },
      });
    }

    return balances.map((b) => ({
      ...b,
      remainingDays: b.totalDays - b.usedDays,
    }));
  }

  /**
   * Submits a leave request with two-stage approval routing, Saudi holiday & weekend
   * deduction, half-day calculation, overlap protection, and balance validation.
   */
  async submitRequest(userId: string, dto: SubmitLeaveRequestDto) {
    const start = new Date(dto.startDate);
    const end = new Date(dto.endDate);

    if (end < start) {
      throw new BadRequestException('End date cannot precede start date.');
    }

    if (dto.isHalfDay && dto.startDate.split('T')[0] !== dto.endDate.split('T')[0]) {
      throw new BadRequestException('Half-day leave must be on a single date.');
    }

    // Fetch user details and country schedule
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        managerId: true,
        remoteLocation: true,
        isRemoteAllowed: true,
        subordinates: { select: { id: true } },
      },
    });

    if (!user) {
      throw new NotFoundException(`User ${userId} not found.`);
    }

    const country = user.remoteLocation?.includes('Pakistan') ? 'PK' : 'SA';

    // Fetch any company holidays stored in DB
    const dbHolidays = await this.prisma.companyHoliday.findMany({
      where: { isOffDay: true },
      select: { dateIso: true },
    });
    const extraHolidays = dbHolidays.map((h) => h.dateIso);

    // Calculate actual working days excluding weekends & holidays
    const calc = calculateWorkingDays({
      startDate: start,
      endDate: end,
      country,
      isHalfDay: dto.isHalfDay,
      halfDayPeriod: dto.halfDayPeriod,
      extraHolidays,
    });

    if (calc.daysCount <= 0) {
      throw new BadRequestException(
        'Selected date range contains no billable working days (all selected days fall on weekends or public holidays).',
      );
    }

    const daysCount = calc.daysCount;
    const currentYear = start.getFullYear();

    // Check for overlapping pending or approved requests (LV-04)
    const overlapping = await this.prisma.leaveRequest.findFirst({
      where: {
        userId,
        status: { in: ['PENDING', 'PENDING_MANAGER', 'PENDING_HR', 'APPROVED'] },
        startDate: { lte: end },
        endDate: { gte: start },
      },
    });

    if (overlapping) {
      const startStr = overlapping.startDate.toISOString().split('T')[0];
      const endStr = overlapping.endDate.toISOString().split('T')[0];
      throw new BadRequestException(
        `Request overlaps with an existing ${overlapping.status} leave (${overlapping.type}) from ${startStr} to ${endStr}.`,
      );
    }

    // Validate balance for non-unpaid/non-remote leaves (LV-02)
    if (dto.type !== LeaveType.UNPAID && dto.type !== LeaveType.REMOTE_WORK) {
      let balance = await this.prisma.leaveBalance.findUnique({
        where: {
          userId_leaveType_year: {
            userId,
            leaveType: dto.type,
            year: currentYear,
          },
        },
      });

      if (!balance) {
        await this.getBalances(userId, currentYear);
        balance = await this.prisma.leaveBalance.findUnique({
          where: {
            userId_leaveType_year: {
              userId,
              leaveType: dto.type,
              year: currentYear,
            },
          },
        });
      }

      const available = balance ? balance.totalDays - balance.usedDays : 0;
      if (available < daysCount) {
        throw new BadRequestException(
          `Insufficient leave balance. Requested ${daysCount} days, but only ${available} days available for ${dto.type}.`,
        );
      }
    }

    // Two-stage routing rule (LV-01 & LV-10):
    // If the employee is a manager (has subordinates) or has no manager, self-approval is prevented
    // and the request routes directly to HR Admin.
    const isManagerOrNoManager =
      user.managerId === null || (user.subordinates && user.subordinates.length > 0);

    const initialStatus = isManagerOrNoManager ? 'PENDING_HR' : 'PENDING_MANAGER';
    const initialStage = isManagerOrNoManager ? 'STAGE_2_HR' : 'STAGE_1_MANAGER';

    const leaveRequest = await this.prisma.leaveRequest.create({
      data: {
        userId,
        type: dto.type,
        startDate: start,
        endDate: end,
        daysCount,
        isHalfDay: Boolean(dto.isHalfDay),
        halfDayPeriod: dto.halfDayPeriod || null,
        reason: dto.reason,
        attachmentUrl: dto.attachmentUrl || null,
        status: initialStatus,
        stage: initialStage as any,
        routedDirectlyToHr: isManagerOrNoManager,
      },
      include: {
        user: {
          select: { firstName: true, lastName: true, email: true, department: true },
        },
      },
    });

    const nextApprover = isManagerOrNoManager ? 'HR Admin' : 'Line Manager';

    // Generate Teams notification payload
    const teamsCardPayload = this.buildAdaptiveCardPayload({
      id: leaveRequest.id,
      employeeName: `${user.firstName} ${user.lastName}`,
      employeeEmail: user.email,
      type: dto.type,
      daysCount,
      startDate: dto.startDate,
      endDate: dto.endDate,
      reason: dto.reason,
      stage: initialStage,
    });

    this.logger.log(
      `Leave request [${dto.type}] submitted by ${user.email} for ${daysCount} days. Status: ${initialStatus}, Stage: ${initialStage}`,
    );

    await this.prisma.auditLog.create({
      data: {
        actorUserId: userId,
        action: 'LEAVE_REQUEST_SUBMITTED',
        resource: 'LeaveRequest',
        detailsJson: {
          requestId: leaveRequest.id,
          type: dto.type,
          daysCount,
          startDate: dto.startDate,
          endDate: dto.endDate,
          status: initialStatus,
          stage: initialStage,
          routedDirectlyToHr: isManagerOrNoManager,
          workingDays: calc.workingDates,
          weekendDays: calc.weekendDates,
          holidayDays: calc.holidayDates,
        },
      },
    });

    if (this.notifications) {
      if (!isManagerOrNoManager && user.managerId) {
        await this.notifications.createNotification({
          userId: user.managerId,
          actorId: userId,
          type: NotificationType.LEAVE_REQUEST,
          title: `New Leave Request: ${user.firstName} ${user.lastName}`,
          titleAr: `طلب إجازة جديد: ${user.firstName} ${user.lastName}`,
          body: `${user.firstName} requested ${daysCount} days of ${dto.type}. Stage 1: Line Manager review.`,
          bodyAr: `قدم ${user.firstName} طلباً لإجازة ${dto.type} لمدة ${daysCount} أيام. المرحلة 1: مراجعة المدير المباشر.`,
          dataJson: {
            requestId: leaveRequest.id,
            leaveType: dto.type,
            daysCount,
            route: 'approvals',
          },
        });
      }
    }

    return {
      message: `Leave request submitted successfully. Awaiting approval from ${nextApprover}.`,
      request: leaveRequest,
      calculation: calc,
      nextApprover,
      teamsNotificationPayload: teamsCardPayload,
    };
  }

  /**
   * Review personal leave requests
   */
  async getMyRequests(userId: string) {
    return this.prisma.leaveRequest.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        managerReviewedBy: { select: { id: true, firstName: true, lastName: true } },
        hrReviewedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  /**
   * Pending requests for Line Managers (Stage 1) or HR/Super Admin (Stage 1 & 2)
   */
  async getPendingForManager(managerId: string, role: string) {
    if (role === 'HR_ADMIN' || role === 'SUPER_ADMIN') {
      return this.prisma.leaveRequest.findMany({
        where: {
          status: { in: ['PENDING', 'PENDING_MANAGER', 'PENDING_HR'] },
        },
        include: {
          user: {
            select: {
              id: true,
              employeeId: true,
              firstName: true,
              lastName: true,
              email: true,
              department: true,
              avatarUrl: true,
            },
          },
          managerReviewedBy: { select: { firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'asc' },
      });
    }

    // Direct reports for Line Manager (Stage 1 only)
    const directReports = await this.prisma.user.findMany({
      where: { managerId, isActive: true },
      select: { id: true },
    });

    const reportIds = directReports.map((r) => r.id);

    return this.prisma.leaveRequest.findMany({
      where: {
        userId: { in: reportIds },
        status: { in: ['PENDING', 'PENDING_MANAGER'] },
      },
      include: {
        user: {
          select: {
            id: true,
            employeeId: true,
            firstName: true,
            lastName: true,
            email: true,
            department: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Returns all leave requests with full stage metadata for the Admin Console
   */
  async getAllForAdmin() {
    return this.prisma.leaveRequest.findMany({
      include: {
        user: {
          select: {
            id: true,
            employeeId: true,
            firstName: true,
            lastName: true,
            department: true,
            avatarUrl: true,
          },
        },
        managerReviewedBy: { select: { id: true, firstName: true, lastName: true } },
        hrReviewedBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Core Two-Stage Decision Engine (LV-06, LV-07, LV-08, LV-09, LV-10)
   */
  async makeDecision(
    requestId: string,
    decisionUserId: string,
    decisionUserRole: string,
    dto: LeaveDecisionDto,
  ) {
    const leaveRequest = await this.prisma.leaveRequest.findUnique({
      where: { id: requestId },
      include: {
        user: true,
      },
    });

    if (!leaveRequest) {
      throw new NotFoundException(`Leave request ${requestId} not found.`);
    }

    // Self-approval guard (LV-10): A manager cannot approve their own request
    if (leaveRequest.userId === decisionUserId) {
      throw new ForbiddenException(
        'Self-approval is strictly forbidden. Leave requests must be reviewed by an authorized independent approver.',
      );
    }

    // Idempotency check (LV-07): If already approved, return without double-deduction
    if (
      leaveRequest.status === 'APPROVED' &&
      dto.decision === LeaveDecision.APPROVED
    ) {
      return {
        message: 'Leave request is already approved.',
        request: leaveRequest,
        idempotent: true,
      };
    }

    if (
      leaveRequest.status === 'APPROVED' ||
      leaveRequest.status === 'REJECTED' ||
      leaveRequest.status === 'CANCELLED'
    ) {
      throw new BadRequestException(
        `Leave request has already been ${leaveRequest.status.toLowerCase()}.`,
      );
    }

    const isHrOrSuperAdmin =
      decisionUserRole === 'HR_ADMIN' || decisionUserRole === 'SUPER_ADMIN';

    // ─── REJECTION BRANCH (LV-08, LV-09) ──────────────────────────────────────
    if (dto.decision === LeaveDecision.REJECTED) {
      // Must be line manager or HR
      if (!isHrOrSuperAdmin && leaveRequest.user.managerId !== decisionUserId) {
        throw new ForbiddenException(
          'You do not have authorization to reject this employee leave request.',
        );
      }

      const updated = await this.prisma.leaveRequest.update({
        where: { id: requestId },
        data: {
          status: 'REJECTED',
          stage: 'COMPLETED',
          decidedById: decisionUserId,
          decidedAt: new Date(),
          rejectionReason: dto.comments || 'Rejected by approver',
          ...(leaveRequest.status === 'PENDING_MANAGER'
            ? {
                managerReviewedById: decisionUserId,
                managerReviewedAt: new Date(),
                managerComments: dto.comments,
              }
            : {
                hrReviewedById: decisionUserId,
                hrReviewedAt: new Date(),
                hrComments: dto.comments,
              }),
        },
        include: {
          user: { select: { firstName: true, lastName: true, email: true } },
        },
      });

      await this.prisma.auditLog.create({
        data: {
          actorUserId: decisionUserId,
          action: 'LEAVE_REQUEST_REJECTED',
          resource: 'LeaveRequest',
          detailsJson: {
            requestId,
            employeeUserId: leaveRequest.userId,
            type: leaveRequest.type,
            daysCount: leaveRequest.daysCount,
            comments: dto.comments,
            rejectedAtStage: leaveRequest.stage,
          },
        },
      });

      if (this.notifications) {
        await this.notifications.createNotification({
          userId: leaveRequest.userId,
          actorId: decisionUserId,
          type: NotificationType.LEAVE_REJECTION,
          title: 'Leave Request Rejected',
          titleAr: 'تم رفض طلب الإجازة',
          body: `Your ${leaveRequest.type} leave request (${leaveRequest.daysCount} days) was rejected: ${dto.comments || 'No comment provided'}.`,
          bodyAr: `تم رفض طلب إجازة ${leaveRequest.type} (${leaveRequest.daysCount} أيام): ${dto.comments || 'بدون ملاحظات'}.`,
          dataJson: {
            requestId,
            leaveType: leaveRequest.type,
            comments: dto.comments,
            route: 'approvals',
          },
        });
      }

      return {
        message: 'Leave request has been rejected.',
        request: updated,
      };
    }

    // ─── STAGE 1 APPROVAL (Manager Review -> Advances to PENDING_HR) (LV-06) ──
    if (
      (leaveRequest.status === 'PENDING' ||
        leaveRequest.status === 'PENDING_MANAGER') &&
      !dto.isHrOverride
    ) {
      // Validate that manager is direct manager
      if (!isHrOrSuperAdmin && leaveRequest.user.managerId !== decisionUserId) {
        throw new ForbiddenException(
          'Only the designated line manager or an authorized HR Admin can approve Stage 1.',
        );
      }

      const stage1Updated = await this.prisma.leaveRequest.update({
        where: { id: requestId },
        data: {
          status: 'PENDING_HR',
          stage: 'STAGE_2_HR',
          managerReviewedById: decisionUserId,
          managerReviewedAt: new Date(),
          managerComments: dto.comments || 'Stage 1 approved by Line Manager',
        },
        include: {
          user: { select: { firstName: true, lastName: true, email: true } },
        },
      });

      await this.prisma.auditLog.create({
        data: {
          actorUserId: decisionUserId,
          action: 'LEAVE_STAGE1_APPROVED',
          resource: 'LeaveRequest',
          detailsJson: {
            requestId,
            employeeUserId: leaveRequest.userId,
            type: leaveRequest.type,
            daysCount: leaveRequest.daysCount,
            managerComments: dto.comments,
          },
        },
      });

      if (this.notifications) {
        await this.notifications.createNotification({
          userId: leaveRequest.userId,
          actorId: decisionUserId,
          type: NotificationType.LEAVE_STAGE_1_APPROVED,
          title: 'Stage 1 Approved by Manager',
          titleAr: 'موافقة المرحلة 1 من المدير المباشر',
          body: `Your ${leaveRequest.type} leave (${leaveRequest.daysCount} days) was approved by your line manager and forwarded to HR for final authorization.`,
          bodyAr: `تمت موافقة مديرك المباشر على طلب إجازة ${leaveRequest.type} (${leaveRequest.daysCount} أيام) وتم إحالته للموارد البشرية للاعتماد النهائي.`,
          dataJson: {
            requestId,
            leaveType: leaveRequest.type,
            stage: 'STAGE_2_HR',
            route: 'approvals',
          },
        });
      }

      return {
        message:
          'Stage 1 approved by Line Manager. Request forwarded to HR Admin for final authorization.',
        request: stage1Updated,
      };
    }

    // ─── STAGE 2 APPROVAL (HR Final Authorization & Balance Deduction) (LV-07) ─
    if (!isHrOrSuperAdmin) {
      throw new ForbiddenException(
        'Stage 2 final approval requires HR Admin or Super Admin privileges.',
      );
    }

    const year = leaveRequest.startDate.getFullYear();
    const shouldDeduct =
      leaveRequest.type !== LeaveType.UNPAID &&
      leaveRequest.type !== LeaveType.REMOTE_WORK;

    // Transactionally update status, deduct balance, and create ledger entry
    const finalResult = await this.prisma.$transaction(async (tx) => {
      let balanceRecord = null;

      if (shouldDeduct) {
        balanceRecord = await tx.leaveBalance.findUnique({
          where: {
            userId_leaveType_year: {
              userId: leaveRequest.userId,
              leaveType: leaveRequest.type,
              year,
            },
          },
        });

        if (balanceRecord) {
          const balanceBefore = balanceRecord.totalDays - balanceRecord.usedDays;
          const balanceAfter = balanceBefore - leaveRequest.daysCount;

          await tx.leaveBalance.update({
            where: { id: balanceRecord.id },
            data: {
              usedDays: { increment: leaveRequest.daysCount },
              remainingDays: balanceAfter,
            },
          });

          // Immutable ledger entry (LV-07 & M5.2)
          await tx.leaveBalanceLedger.create({
            data: {
              balanceId: balanceRecord.id,
              userId: leaveRequest.userId,
              leaveType: leaveRequest.type,
              entryType: 'USAGE',
              amount: -leaveRequest.daysCount,
              balanceBefore,
              balanceAfter,
              requestId: leaveRequest.id,
              reason: `Leave approved by HR: ${leaveRequest.type} (${leaveRequest.daysCount} days)`,
              createdById: decisionUserId,
            },
          });
        }
      }

      const approvedRequest = await tx.leaveRequest.update({
        where: { id: requestId },
        data: {
          status: 'APPROVED',
          stage: 'COMPLETED',
          hrReviewedById: decisionUserId,
          hrReviewedAt: new Date(),
          hrComments: dto.comments || 'Final approval granted by HR Admin',
          decidedById: decisionUserId,
          decidedAt: new Date(),
        },
        include: {
          user: { select: { firstName: true, lastName: true, email: true } },
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: decisionUserId,
          action: 'LEAVE_REQUEST_APPROVED',
          resource: 'LeaveRequest',
          detailsJson: {
            requestId,
            employeeUserId: leaveRequest.userId,
            type: leaveRequest.type,
            daysCount: leaveRequest.daysCount,
            isHrOverride: Boolean(dto.isHrOverride),
            comments: dto.comments,
          },
        },
      });

      return approvedRequest;
    });

    if (this.notifications) {
      await this.notifications.createNotification({
        userId: leaveRequest.userId,
        actorId: decisionUserId,
        type: NotificationType.LEAVE_APPROVAL,
        title: 'Leave Request Approved',
        titleAr: 'تم اعتماد طلب الإجازة نهائياً',
        body: `Your ${leaveRequest.type} leave request (${leaveRequest.daysCount} days) has been fully approved by HR.`,
        bodyAr: `تم اعتماد طلب إجازة ${leaveRequest.type} (${leaveRequest.daysCount} أيام) رسمياً من الموارد البشرية.`,
        dataJson: {
          requestId,
          leaveType: leaveRequest.type,
          status: 'APPROVED',
          route: 'approvals',
        },
      });
    }

    return {
      message: 'Leave request fully approved by HR.',
      request: finalResult,
    };
  }

  /**
   * Cancels a pending or pre-start approved leave request and restores balances (LV-11)
   */
  async cancelRequest(
    requestId: string,
    userId: string,
    userRole: string,
    dto: CancelLeaveRequestDto,
  ) {
    const leaveRequest = await this.prisma.leaveRequest.findUnique({
      where: { id: requestId },
      include: {
        user: { select: { firstName: true, lastName: true, managerId: true } },
      },
    });

    if (!leaveRequest) {
      throw new NotFoundException(`Leave request ${requestId} not found.`);
    }

    const isHrOrAdmin = userRole === 'HR_ADMIN' || userRole === 'SUPER_ADMIN';
    if (leaveRequest.userId !== userId && !isHrOrAdmin) {
      throw new ForbiddenException(
        'You do not have authorization to cancel this leave request.',
      );
    }

    if (leaveRequest.status === 'CANCELLED') {
      throw new BadRequestException('Leave request is already cancelled.');
    }

    if (leaveRequest.status === 'REJECTED') {
      throw new BadRequestException('Cannot cancel an already rejected leave request.');
    }

    const wasApproved = leaveRequest.status === 'APPROVED';
    const year = leaveRequest.startDate.getFullYear();
    const shouldRestore =
      wasApproved &&
      leaveRequest.type !== LeaveType.UNPAID &&
      leaveRequest.type !== LeaveType.REMOTE_WORK;

    const cancelledResult = await this.prisma.$transaction(async (tx) => {
      if (shouldRestore) {
        const balance = await tx.leaveBalance.findUnique({
          where: {
            userId_leaveType_year: {
              userId: leaveRequest.userId,
              leaveType: leaveRequest.type,
              year,
            },
          },
        });

        if (balance) {
          const balanceBefore = balance.totalDays - balance.usedDays;
          const balanceAfter = balanceBefore + leaveRequest.daysCount;

          await tx.leaveBalance.update({
            where: { id: balance.id },
            data: {
              usedDays: { decrement: leaveRequest.daysCount },
              remainingDays: balanceAfter,
            },
          });

          // Immutable cancellation restoration ledger entry
          await tx.leaveBalanceLedger.create({
            data: {
              balanceId: balance.id,
              userId: leaveRequest.userId,
              leaveType: leaveRequest.type,
              entryType: 'CANCELLATION_RESTORE',
              amount: leaveRequest.daysCount,
              balanceBefore,
              balanceAfter,
              requestId: leaveRequest.id,
              reason: `Approved leave cancelled: ${dto.reason || 'Requested by employee'}`,
              createdById: userId,
            },
          });
        }
      }

      const updated = await tx.leaveRequest.update({
        where: { id: requestId },
        data: {
          status: 'CANCELLED',
          stage: 'COMPLETED',
          cancelledAt: new Date(),
          cancellationReason: dto.reason || 'Cancelled by employee',
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: userId,
          action: 'LEAVE_REQUEST_CANCELLED',
          resource: 'LeaveRequest',
          detailsJson: {
            requestId,
            employeeUserId: leaveRequest.userId,
            wasApproved,
            restoredDays: shouldRestore ? leaveRequest.daysCount : 0,
            reason: dto.reason,
          },
        },
      });

      return updated;
    });

    if (this.notifications && leaveRequest.user?.managerId) {
      await this.notifications.createNotification({
        userId: leaveRequest.user.managerId,
        actorId: userId,
        type: NotificationType.LEAVE_CANCELLED,
        title: `Leave Cancelled: ${leaveRequest.user.firstName} ${leaveRequest.user.lastName}`,
        titleAr: `إلغاء إجازة: ${leaveRequest.user.firstName} ${leaveRequest.user.lastName}`,
        body: `${leaveRequest.user.firstName} cancelled their ${leaveRequest.type} leave (${leaveRequest.daysCount} days).`,
        bodyAr: `قام ${leaveRequest.user.firstName} بإلغاء إجازة ${leaveRequest.type} (${leaveRequest.daysCount} أيام).`,
        dataJson: {
          requestId,
          leaveType: leaveRequest.type,
          status: 'CANCELLED',
          route: 'approvals',
        },
      });
    }

    return {
      message: wasApproved
        ? 'Approved leave request cancelled and balance successfully restored.'
        : 'Pending leave request cancelled.',
      request: cancelledResult,
    };
  }

  /**
   * Returns immutable audit ledger entries for balance reconciliation
   */
  async getLedger(userId: string, targetUserId?: string, userRole?: string) {
    const isHr = userRole === 'HR_ADMIN' || userRole === 'SUPER_ADMIN';
    const queryUserId = isHr && targetUserId ? targetUserId : userId;

    return this.prisma.leaveBalanceLedger.findMany({
      where: { userId: queryUserId },
      orderBy: { createdAt: 'desc' },
      include: {
        request: { select: { id: true, type: true, startDate: true, endDate: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true, role: true } },
      },
    });
  }
}
