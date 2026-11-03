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
  LeaveType,
  LeaveDecision,
} from './dto/leaves.dto';

@Injectable()
export class LeavesService {
  private readonly logger = new Logger(LeavesService.name);

  constructor(private prisma: PrismaService) {}

  private calculateDays(start: Date, end: Date): number {
    const diffTime = Math.abs(end.getTime() - start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  }

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
                text: '🌴 New Leave Request Pending Review',
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
                  { title: 'Reason:', value: request.reason },
                ],
              },
            ],
            actions: [
              {
                type: 'Action.Http',
                title: '✅ Approve Leave',
                method: 'PATCH',
                url: `https://api.macqhr.sa/api/leaves/${request.id}/decision`,
                body: JSON.stringify({ decision: 'APPROVED' }),
              },
              {
                type: 'Action.Http',
                title: '❌ Reject Leave',
                method: 'PATCH',
                url: `https://api.macqhr.sa/api/leaves/${request.id}/decision`,
                body: JSON.stringify({ decision: 'REJECTED' }),
              },
            ],
          },
        },
      ],
    };
  }

  async getBalances(userId: string) {
    const currentYear = new Date().getFullYear();
    let balances = await this.prisma.leaveBalance.findMany({
      where: { userId, year: currentYear },
    });

    // Default seed if no balance initialized yet
    if (balances.length === 0) {
      await this.prisma.leaveBalance.createMany({
        data: [
          { userId, leaveType: 'ANNUAL', totalDays: 30, usedDays: 0, year: currentYear },
          { userId, leaveType: 'SICK', totalDays: 30, usedDays: 0, year: currentYear },
          { userId, leaveType: 'HAJJ', totalDays: 10, usedDays: 0, year: currentYear },
          { userId, leaveType: 'PATERNITY', totalDays: 3, usedDays: 0, year: currentYear },
        ],
      });
      balances = await this.prisma.leaveBalance.findMany({
        where: { userId, year: currentYear },
      });
    }

    return balances.map((b) => ({
      ...b,
      remainingDays: b.totalDays - b.usedDays,
    }));
  }

  async submitRequest(userId: string, dto: SubmitLeaveRequestDto) {
    const start = new Date(dto.startDate);
    const end = new Date(dto.endDate);

    if (end < start) {
      throw new BadRequestException('End date cannot precede start date.');
    }

    const daysCount = this.calculateDays(start, end);
    const currentYear = start.getFullYear();

    // Check balance for trackable leaves
    if (dto.type !== LeaveType.UNPAID) {
      const balance = await this.prisma.leaveBalance.findUnique({
        where: {
          userId_leaveType_year: {
            userId,
            leaveType: dto.type,
            year: currentYear,
          },
        },
      });

      if (balance) {
        const remaining = balance.totalDays - balance.usedDays;
        if (remaining < daysCount) {
          throw new BadRequestException(
            `Insufficient leave balance. Requested ${daysCount} days, but only ${remaining} days available for ${dto.type}.`,
          );
        }
      }
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true, email: true, managerId: true },
    });

    const leaveRequest = await this.prisma.leaveRequest.create({
      data: {
        userId,
        type: dto.type,
        startDate: start,
        endDate: end,
        daysCount,
        reason: dto.reason,
        attachmentUrl: dto.attachmentUrl,
        status: 'PENDING',
      },
      include: {
        user: {
          select: { firstName: true, lastName: true, email: true, department: true },
        },
      },
    });

    const teamsCardPayload = this.buildAdaptiveCardPayload({
      id: leaveRequest.id,
      employeeName: `${user?.firstName} ${user?.lastName}`,
      employeeEmail: user?.email || '',
      type: dto.type,
      daysCount,
      startDate: dto.startDate,
      endDate: dto.endDate,
      reason: dto.reason,
    });

    this.logger.log(
      `Leave request [${dto.type}] submitted by ${user?.email} for ${daysCount} days. Teams card generated.`,
    );

    if (this.prisma.auditLog?.create) {
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
          },
        },
      });
    }

    return {
      message: 'Leave request submitted successfully. Awaiting manager approval.',
      request: leaveRequest,
      teamsNotificationPayload: teamsCardPayload,
    };
  }

  async getMyRequests(userId: string) {
    return this.prisma.leaveRequest.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getPendingForManager(managerId: string, role: string) {
    // If HR_ADMIN or SUPER_ADMIN, show all pending requests in company
    if (role === 'HR_ADMIN' || role === 'SUPER_ADMIN') {
      return this.prisma.leaveRequest.findMany({
        where: { status: 'PENDING' },
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

    // Direct reports for MANAGER
    const directReports = await this.prisma.user.findMany({
      where: { managerId, isActive: true },
      select: { id: true },
    });

    const reportIds = directReports.map((r) => r.id);

    return this.prisma.leaveRequest.findMany({
      where: {
        userId: { in: reportIds },
        status: 'PENDING',
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
      },
      orderBy: { createdAt: 'desc' },
    });
  }

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

    if (leaveRequest.status !== 'PENDING') {
      throw new BadRequestException(
        `Leave request has already been ${leaveRequest.status.toLowerCase()}.`,
      );
    }

    // Check manager authority unless HR or Super Admin
    if (
      decisionUserRole !== 'HR_ADMIN' &&
      decisionUserRole !== 'SUPER_ADMIN' &&
      leaveRequest.user.managerId !== decisionUserId
    ) {
      throw new ForbiddenException(
        'You do not have authorization to review leave requests for this employee.',
      );
    }

    // If APPROVED, deduct balance
    if (dto.decision === LeaveDecision.APPROVED && leaveRequest.type !== 'UNPAID') {
      const year = leaveRequest.startDate.getFullYear();
      await this.prisma.leaveBalance.updateMany({
        where: {
          userId: leaveRequest.userId,
          leaveType: leaveRequest.type,
          year,
        },
        data: {
          usedDays: { increment: leaveRequest.daysCount },
        },
      });
    }

    const updated = await this.prisma.leaveRequest.update({
      where: { id: requestId },
      data: {
        status: dto.decision,
        reviewedBy: decisionUserId,
        reviewedAt: new Date(),
        rejectionReason: dto.decision === LeaveDecision.REJECTED ? dto.comments : null,
      },
      include: {
        user: {
          select: { firstName: true, lastName: true, email: true },
        },
      },
    });

    this.logger.log(
      `Leave request ${requestId} marked ${dto.decision} by user ${decisionUserId}.`,
    );

    if (this.prisma.auditLog?.create) {
      await this.prisma.auditLog.create({
        data: {
          actorUserId: decisionUserId,
          action: `LEAVE_REQUEST_${dto.decision}`,
          resource: 'LeaveRequest',
          detailsJson: {
            requestId,
            employeeUserId: leaveRequest.userId,
            type: leaveRequest.type,
            daysCount: leaveRequest.daysCount,
            decision: dto.decision,
          },
        },
      });
    }

    return {
      message: `Leave request has been ${dto.decision.toLowerCase()}.`,
      request: updated,
    };
  }
}
