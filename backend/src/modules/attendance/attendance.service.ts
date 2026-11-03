import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import {
  PunchAttendanceDto,
  PunchType,
} from './dto/attendance.dto';
import {
  CreateRemoteRequestDto,
  DecideRemoteRequestDto,
  RemoteRequestDecision,
} from './dto/remote-request.dto';
import {
  ReviewExceptionDto,
  ExceptionReviewDecision,
} from './dto/exception-review.dto';
import { isWithinGeofence } from '../../common/utils/haversine.util';
import {
  getLocalDateIso,
  resolveUserTimezone,
  formatLocalClockTime,
} from '../../common/utils/timezone.util';

@Injectable()
export class AttendanceService {
  private readonly logger = new Logger(AttendanceService.name);

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {}

  /**
   * Evaluates 6-layer anti-spoofing criteria against the incoming punch payload.
   */
  private validateAntiSpoofing(
    dto: PunchAttendanceDto,
    branch: { latitude: number; longitude: number; geofenceRadiusMeters: number; name: string },
  ) {
    const serverNow = Date.now();
    const clientTime = new Date(dto.clientTimestamp).getTime();

    if (!Number.isFinite(dto.latitude) || dto.latitude < -90 || dto.latitude > 90) {
      throw new BadRequestException('Latitude must be a valid value between -90 and 90 degrees.');
    }
    if (!Number.isFinite(dto.longitude) || dto.longitude < -180 || dto.longitude > 180) {
      throw new BadRequestException('Longitude must be a valid value between -180 and 180 degrees.');
    }
    if (!Number.isFinite(dto.accuracyMeters) || dto.accuracyMeters < 0) {
      throw new BadRequestException('GPS accuracy must be a non-negative number.');
    }
    if (!Number.isFinite(clientTime)) {
      throw new BadRequestException('Client timestamp is invalid.');
    }

    // Layer 1: Mock Location Detection
    if (dto.isMockLocation) {
      throw new ForbiddenException(
        'Anti-Spoofing Layer 1 Violation: Mock/Fake GPS location provider detected.',
      );
    }

    // Layer 2: GPS Accuracy Radius <= 50m
    const maxAccuracy = this.configService.get<number>('security.maxAllowedGpsAccuracyMeters') || 50;
    if (dto.accuracyMeters > maxAccuracy) {
      throw new BadRequestException(
        `Anti-Spoofing Layer 2 Violation: GPS accuracy radius (${dto.accuracyMeters.toFixed(1)}m) exceeds maximum allowable ${maxAccuracy}m threshold. Please move to an open area.`,
      );
    }

    // Layer 3: NTP Server Time Synchronization (Drift <= 5 min)
    const maxDriftMinutes = this.configService.get<number>('security.maxAllowedNtpDriftMinutes') || 5;
    const driftMs = Math.abs(serverNow - clientTime);
    if (driftMs > maxDriftMinutes * 60 * 1000) {
      const driftSeconds = Math.round(driftMs / 1000);
      throw new BadRequestException(
        `Anti-Spoofing Layer 3 Violation: Device clock is out of sync by ${driftSeconds}s (max allowed ${maxDriftMinutes * 60}s). Enable Automatic Date & Time.`,
      );
    }

    // Layer 4: Root / Jailbreak Integrity
    if (dto.isDeviceRooted) {
      throw new ForbiddenException(
        'Anti-Spoofing Layer 4 Violation: Tampered or rooted/jailbroken operating system detected.',
      );
    }

    // Layer 5: Branch Geofence Boundary Check (office check-in punches only).
    // Non-blocking checkout creates an exception rather than failing.
    const { isInside, distanceMeters } = isWithinGeofence(
      dto.latitude,
      dto.longitude,
      branch.latitude,
      branch.longitude,
      branch.geofenceRadiusMeters,
    );

    if (dto.workMode !== 'REMOTE' && !isInside && dto.type === PunchType.CHECK_IN) {
      throw new BadRequestException(
        `Anti-Spoofing Layer 5 Violation: You are ${distanceMeters}m away from ${branch.name}. Must be within ${branch.geofenceRadiusMeters}m geofence.`,
      );
    }

    // Layer 6: Biometric Authentication Check
    if (!dto.biometricVerified) {
      throw new UnauthorizedException(
        'Anti-Spoofing Layer 6 Violation: Biometric verification (Face ID / Fingerprint) was not confirmed.',
      );
    }

    return { isInside, distanceMeters };
  }

  /**
   * Lazily finds or creates the day container for the user's local date.
   */
  private async getOrCreateDay(userId: string, user: any, dateIso: string) {
    if (!this.prisma.attendanceDay) {
      return null;
    }

    let day = await this.prisma.attendanceDay.findUnique({
      where: { userId_dateIso: { userId, dateIso } },
      include: {
        events: { orderBy: { timestamp: 'asc' } },
        exceptions: true,
      },
    });

    if (!day) {
      // Determine initial day mode
      let mode: 'OFFICE' | 'REMOTE' = user.isRemoteAllowed ? 'REMOTE' : 'OFFICE';
      let remoteRequestId: string | null = null;

      if (!user.isRemoteAllowed && this.prisma.remoteWorkRequest) {
        const approvedReq = await this.prisma.remoteWorkRequest.findFirst({
          where: {
            userId,
            status: 'APPROVED',
            startDateIso: { lte: dateIso },
            endDateIso: { gte: dateIso },
          },
        });
        if (approvedReq) {
          mode = 'REMOTE';
          remoteRequestId = approvedReq.id;
        }
      }

      day = await this.prisma.attendanceDay.create({
        data: {
          userId,
          dateIso,
          mode,
          remoteRequestId,
          status: 'INCOMPLETE',
        },
        include: {
          events: { orderBy: { timestamp: 'asc' } },
          exceptions: true,
        },
      });
    }

    return day;
  }

  async punch(userId: string, dto: PunchAttendanceDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { branch: true },
    });

    if (!user) {
      throw new NotFoundException('Employee record not found.');
    }

    // Super Admin is exempt from punches
    if (user.role === 'SUPER_ADMIN') {
      return {
        message: 'Super Administrator accounts are exempt from daily attendance punches.',
        status: 'EXEMPT',
      };
    }

    const branch = await this.prisma.branch.findUnique({
      where: { id: dto.branchId },
    });

    if (!branch) {
      throw new NotFoundException(`Branch with ID ${dto.branchId} does not exist.`);
    }

    if (user.branchId !== branch.id) {
      throw new ForbiddenException('Attendance can only be recorded against your assigned branch.');
    }

    const userTimezone = resolveUserTimezone(user);
    const todayIso = getLocalDateIso(new Date(), userTimezone);

    // Validate Remote Mode: (1) standing remote OR (2) approved remote request
    if (dto.workMode === 'REMOTE') {
      if (!user.isRemoteAllowed) {
        const approvedRemote = this.prisma.remoteWorkRequest
          ? await this.prisma.remoteWorkRequest.findFirst({
              where: {
                userId,
                status: 'APPROVED',
                startDateIso: { lte: todayIso },
                endDateIso: { gte: todayIso },
              },
            })
          : null;

        if (!approvedRemote) {
          throw new ForbiddenException('Remote attendance is not enabled for this account.');
        }
      }
    }

    const todayDay = await this.getOrCreateDay(userId, user, todayIso);

    // Query today's existing punches
    const todayPunches = await this.prisma.attendanceRecord.findMany({
      where: { userId, dateIso: todayIso },
      orderBy: { timestamp: 'asc' },
    });
    const lastPunch = todayPunches[todayPunches.length - 1];

    // State machine transitions
    if (dto.type === PunchType.CHECK_IN) {
      if (lastPunch && lastPunch.type !== PunchType.CHECK_OUT) {
        throw new BadRequestException('You are already checked in. Submit a check-out first.');
      }
    } else if (dto.type === PunchType.BREAK_START) {
      if (!lastPunch || lastPunch.type === PunchType.CHECK_OUT) {
        throw new BadRequestException('You must check in before taking a break.');
      }
      if (lastPunch.type === PunchType.BREAK_START) {
        throw new BadRequestException('You are already on break.');
      }
    } else if (dto.type === PunchType.BREAK_END) {
      if (!lastPunch || lastPunch.type !== PunchType.BREAK_START) {
        throw new BadRequestException('You are not currently on a break.');
      }
    } else if (dto.type === PunchType.CHECK_OUT) {
      if (!lastPunch || lastPunch.type === PunchType.CHECK_OUT) {
        throw new BadRequestException('You must check in before submitting a check-out.');
      }
    }

    // Run 6-layer anti-spoofing engine
    let isInside = true;
    let distanceMeters = 0;
    try {
      ({ isInside, distanceMeters } = this.validateAntiSpoofing(dto, branch));
    } catch (error) {
      try {
        await this.prisma.auditLog.create({
          data: {
            actorUserId: userId,
            action: 'ATTENDANCE_PUNCH_REJECTED',
            resource: 'AttendanceRecord',
            detailsJson: {
              type: dto.type,
              branchId: dto.branchId,
              workMode: dto.workMode || 'OFFICE',
              reason: error instanceof Error ? error.message : 'Unknown validation failure',
            },
          },
        });
      } catch (auditError) {
        this.logger.error('Failed to write attendance rejection audit log.', auditError);
      }
      throw error;
    }

    const isGeofenceException =
      dto.workMode !== 'REMOTE' && !isInside && dto.type === PunchType.CHECK_OUT;

    const recordStatus = isGeofenceException ? 'FLAGGED' : 'VERIFIED';
    const securityFlags: string[] = [];
    if (dto.workMode === 'REMOTE') securityFlags.push('AUTHORIZED_REMOTE_HUB');
    if (isGeofenceException) securityFlags.push('OUTSIDE_GEOFENCE_CHECKOUT');

    const now = new Date();
    const clockTime = formatLocalClockTime(now, userTimezone);

    const record = await this.prisma.attendanceRecord.create({
      data: {
        userId,
        dayId: todayDay?.id,
        branchId: branch.id,
        type: dto.type,
        timestamp: now,
        dateIso: todayIso,
        clockInTime: dto.type === PunchType.CHECK_IN ? clockTime : null,
        clockOutTime: dto.type === PunchType.CHECK_OUT ? clockTime : null,
        latitude: dto.latitude,
        longitude: dto.longitude,
        accuracyMeters: dto.accuracyMeters,
        distanceToBranch: distanceMeters,
        isMockLocation: dto.isMockLocation,
        isDeviceRooted: dto.isDeviceRooted,
        biometricVerified: dto.biometricVerified,
        workMode: dto.workMode === 'REMOTE' ? 'REMOTE' : 'OFFICE',
        wifiBssid: dto.wifiBssid,
        wasOfflineSynced: false,
        securityFlags,
        status: recordStatus,
        notes: dto.notes,
        clientEventId: dto.clientEventId,
        reasonCode: dto.reasonCode,
      },
      include: {
        branch: {
          select: { name: true, nameAr: true, code: true },
        },
      },
    });

    // Update AttendanceDay and handle duration / exceptions
    if (todayDay && this.prisma.attendanceDay) {
      const updateData: any = {};

      if (dto.type === PunchType.CHECK_IN && !todayDay.firstCheckInAt) {
        updateData.firstCheckInAt = now;
      }

      // Handle break elapsed time on BREAK_END
      if (dto.type === PunchType.BREAK_END && lastPunch?.type === PunchType.BREAK_START) {
        const breakDurationMin = Math.max(
          1,
          Math.round((now.getTime() - new Date(lastPunch.timestamp).getTime()) / 60000),
        );
        updateData.breakMinutes = (todayDay.breakMinutes || 0) + breakDurationMin;
      }

      // Handle checkout: auto-close open break if any, update working time
      if (dto.type === PunchType.CHECK_OUT) {
        updateData.lastCheckOutAt = now;
        let additionalBreakMinutes = 0;

        if (lastPunch?.type === PunchType.BREAK_START) {
          additionalBreakMinutes = Math.max(
            1,
            Math.round((now.getTime() - new Date(lastPunch.timestamp).getTime()) / 60000),
          );
          updateData.breakMinutes = (todayDay.breakMinutes || 0) + additionalBreakMinutes;
        }

        const firstIn = todayDay.firstCheckInAt || now;
        const totalElapsedMin = Math.max(
          0,
          Math.round((now.getTime() - new Date(firstIn).getTime()) / 60000),
        );
        const finalBreakMin = (todayDay.breakMinutes || 0) + additionalBreakMinutes;
        updateData.workingMinutes = Math.max(0, totalElapsedMin - finalBreakMin);
        updateData.status =
          todayDay.openExceptionCount > 0 || isGeofenceException ? 'FLAGGED' : 'VERIFIED';
      }

      // Record non-blocking geofence exception
      if (isGeofenceException && this.prisma.attendanceException) {
        await this.prisma.attendanceException.create({
          data: {
            dayId: todayDay.id,
            recordId: record.id,
            type: 'OUTSIDE_OFFICE_GEOFENCE',
            severity: 'MEDIUM',
            status: 'OPEN',
            detailsJson: {
              distanceMeters: Math.round(distanceMeters),
              geofenceRadiusMeters: branch.geofenceRadiusMeters,
              branchName: branch.name,
            },
          },
        });
        updateData.openExceptionCount = (todayDay.openExceptionCount || 0) + 1;
      }

      if (Object.keys(updateData).length > 0) {
        await this.prisma.attendanceDay.update({
          where: { id: todayDay.id },
          data: updateData,
        });
      }
    }

    this.logger.log(
      `Attendance punch [${dto.type}] recorded for user ${user.employeeId} at ${branch.name} (${distanceMeters}m)`,
    );

    try {
      await this.prisma.auditLog.create({
        data: {
          actorUserId: userId,
          action: 'ATTENDANCE_PUNCH_ACCEPTED',
          resource: 'AttendanceRecord',
          detailsJson: {
            recordId: record.id,
            type: dto.type,
            branchId: branch.id,
            branchName: branch.name,
            workMode: dto.workMode === 'REMOTE' ? 'REMOTE' : 'OFFICE',
            distanceMeters: Math.round(distanceMeters),
            isException: isGeofenceException,
          },
        },
      });
    } catch (auditError) {
      this.logger.error('Failed to write attendance acceptance audit log.', auditError);
    }

    const actionText =
      dto.type === PunchType.CHECK_IN
        ? 'Check-in'
        : dto.type === PunchType.CHECK_OUT
          ? 'Check-out'
          : dto.type === PunchType.BREAK_START
            ? 'Break started'
            : 'Break ended';

    return {
      message: `${actionText} recorded successfully.${isGeofenceException ? ' Flagged for HR review.' : ''}`,
      record,
    };
  }

  /**
   * Returns today's AttendanceDay summary with active break and check-in state.
   */
  async getToday(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { branch: true },
    });
    if (!user) throw new NotFoundException('Employee not found.');

    const userTimezone = resolveUserTimezone(user);
    const todayIso = getLocalDateIso(new Date(), userTimezone);

    const day = this.prisma.attendanceDay
      ? await this.prisma.attendanceDay.findUnique({
          where: { userId_dateIso: { userId, dateIso: todayIso } },
          include: {
            events: { orderBy: { timestamp: 'asc' } },
            exceptions: true,
          },
        })
      : null;

    const lastEvent = day?.events?.[day.events.length - 1];
    const isCheckedIn = !!lastEvent && lastEvent.type !== PunchType.CHECK_OUT;
    const isOnBreak = !!lastEvent && lastEvent.type === PunchType.BREAK_START;

    return {
      dateIso: todayIso,
      timezone: userTimezone,
      day: day || null,
      isCheckedIn,
      isOnBreak,
      firstCheckInAt: day?.firstCheckInAt || null,
      lastCheckOutAt: day?.lastCheckOutAt || null,
      workingMinutes: day?.workingMinutes || 0,
      breakMinutes: day?.breakMinutes || 0,
      openExceptionCount: day?.openExceptionCount || 0,
    };
  }

  // --- Remote Work Requests ---

  async createRemoteRequest(userId: string, dto: CreateRemoteRequestDto) {
    if (dto.startDateIso > dto.endDateIso) {
      throw new BadRequestException('Start date cannot be after end date.');
    }

    if (!this.prisma.remoteWorkRequest) {
      throw new BadRequestException('Remote request feature is not enabled.');
    }

    // Check for existing pending or approved requests overlapping this range
    const overlapping = await this.prisma.remoteWorkRequest.findFirst({
      where: {
        userId,
        status: { in: ['PENDING', 'APPROVED'] },
        startDateIso: { lte: dto.endDateIso },
        endDateIso: { gte: dto.startDateIso },
      },
    });

    if (overlapping) {
      throw new BadRequestException(
        'A remote work request already exists for one or more dates in this range.',
      );
    }

    const request = await this.prisma.remoteWorkRequest.create({
      data: {
        userId,
        startDateIso: dto.startDateIso,
        endDateIso: dto.endDateIso,
        reason: dto.reason,
        status: 'PENDING',
      },
    });

    return {
      message: 'Remote work request submitted successfully. Awaiting manager approval.',
      request,
    };
  }

  async getMyRemoteRequests(userId: string) {
    if (!this.prisma.remoteWorkRequest) return [];
    return this.prisma.remoteWorkRequest.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        decidedBy: { select: { fullName: true, employeeId: true } },
      },
    });
  }

  async getPendingRemoteRequests(actorUserId: string, actorRole: string) {
    if (!this.prisma.remoteWorkRequest) return [];

    if (actorRole === 'SUPER_ADMIN' || actorRole === 'HR_ADMIN') {
      return this.prisma.remoteWorkRequest.findMany({
        where: { status: 'PENDING' },
        include: {
          user: { select: { fullName: true, employeeId: true, department: true } },
        },
        orderBy: { createdAt: 'asc' },
      });
    }

    // Line manager: see direct reports only
    return this.prisma.remoteWorkRequest.findMany({
      where: {
        status: 'PENDING',
        user: { managerId: actorUserId },
      },
      include: {
        user: { select: { fullName: true, employeeId: true, department: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async decideRemoteRequest(
    actorUserId: string,
    actorRole: string,
    requestId: string,
    dto: DecideRemoteRequestDto,
  ) {
    if (!this.prisma.remoteWorkRequest) throw new NotFoundException('Not available.');

    const request = await this.prisma.remoteWorkRequest.findUnique({
      where: { id: requestId },
      include: { user: true },
    });

    if (!request) {
      throw new NotFoundException('Remote work request not found.');
    }

    if (request.status !== 'PENDING') {
      throw new BadRequestException(`Request has already been ${request.status.toLowerCase()}.`);
    }

    if (request.userId === actorUserId) {
      throw new ForbiddenException('You cannot decide your own remote work request.');
    }

    // Role check: manager can only decide for direct reports
    if (actorRole !== 'SUPER_ADMIN' && actorRole !== 'HR_ADMIN') {
      if (request.user.managerId !== actorUserId) {
        throw new ForbiddenException('You can only decide requests for your direct reports.');
      }
    }

    const updated = await this.prisma.remoteWorkRequest.update({
      where: { id: requestId },
      data: {
        status: dto.decision,
        decidedById: actorUserId,
        decidedAt: new Date(),
        rejectionReason: dto.decision === RemoteRequestDecision.REJECTED ? dto.rejectionReason : null,
      },
    });

    // If approved, update existing days in that range to REMOTE
    if (dto.decision === RemoteRequestDecision.APPROVED && this.prisma.attendanceDay) {
      await this.prisma.attendanceDay.updateMany({
        where: {
          userId: request.userId,
          dateIso: { gte: request.startDateIso, lte: request.endDateIso },
        },
        data: {
          mode: 'REMOTE',
          remoteRequestId: request.id,
        },
      });
    }

    return {
      message: `Remote work request has been ${dto.decision.toLowerCase()}.`,
      request: updated,
    };
  }

  // --- Exceptions Management ---

  async getExceptions(status?: string, fromDate?: string, toDate?: string) {
    if (!this.prisma.attendanceException) return [];

    const where: any = {};
    if (status) where.status = status;
    if (fromDate || toDate) {
      where.day = {
        dateIso: {
          gte: fromDate || undefined,
          lte: toDate || undefined,
        },
      };
    }

    return this.prisma.attendanceException.findMany({
      where,
      include: {
        day: {
          include: {
            user: { select: { fullName: true, employeeId: true, department: true } },
          },
        },
        record: true,
        reviewedBy: { select: { fullName: true, employeeId: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async reviewException(
    actorUserId: string,
    exceptionId: string,
    dto: ReviewExceptionDto,
  ) {
    if (!this.prisma.attendanceException) throw new NotFoundException('Not available.');

    const exception = await this.prisma.attendanceException.findUnique({
      where: { id: exceptionId },
      include: { day: true },
    });

    if (!exception) {
      throw new NotFoundException('Attendance exception not found.');
    }

    const updated = await this.prisma.attendanceException.update({
      where: { id: exceptionId },
      data: {
        status: dto.decision,
        reviewedById: actorUserId,
        reviewedAt: new Date(),
        reviewNote: dto.reviewNote,
      },
    });

    // If accepted, update day's open exception count
    if (this.prisma.attendanceDay) {
      const remainingOpen = await this.prisma.attendanceException.count({
        where: { dayId: exception.dayId, status: 'OPEN' },
      });
      await this.prisma.attendanceDay.update({
        where: { id: exception.dayId },
        data: {
          openExceptionCount: remainingOpen,
          status: remainingOpen === 0 ? 'VERIFIED' : 'FLAGGED',
        },
      });
    }

    return {
      message: `Exception marked as ${dto.decision.toLowerCase()}.`,
      exception: updated,
    };
  }

  // --- Offline & Legacy Queries ---

  async syncOfflinePunches() {
    throw new ForbiddenException(
      'Offline attendance sync is disabled until punches can be verified with a registered device signing key.',
    );
  }

  async getMyHistory(userId: string, limit: number = 30) {
    return this.prisma.attendanceRecord.findMany({
      where: { userId },
      orderBy: { timestamp: 'desc' },
      take: limit,
      include: {
        branch: { select: { name: true, nameAr: true, code: true } },
      },
    });
  }

  async getAllAttendance(limit: number = 50) {
    return this.prisma.attendanceRecord.findMany({
      orderBy: { timestamp: 'desc' },
      take: limit,
      include: {
        user: { select: { fullName: true, employeeId: true, role: true, department: true } },
        branch: { select: { name: true, nameAr: true, code: true } },
      },
    });
  }

  async getAllRecords(limit: number = 100) {
    return this.getAllAttendance(limit);
  }

  async getTeamAttendance(_managerUserId: string, date?: string) {
    return this.getTeamStatus(date);
  }

  async getTeamStatus(date?: string) {
    const targetDate = date || getLocalDateIso(new Date());

    if (this.prisma.attendanceDay) {
      const days = await this.prisma.attendanceDay.findMany({
        where: { dateIso: targetDate },
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              employeeId: true,
              role: true,
              department: true,
              branch: { select: { name: true } },
            },
          },
          events: { orderBy: { timestamp: 'asc' } },
          exceptions: true,
        },
      });

      return days.map((day) => {
        const lastEvent = day.events[day.events.length - 1];
        return {
          employeeId: day.user.employeeId,
          fullName: day.user.fullName,
          department: day.user.department,
          branchName: day.user.branch?.name || 'Unassigned',
          mode: day.mode,
          status: day.status,
          firstCheckInAt: day.firstCheckInAt,
          lastCheckOutAt: day.lastCheckOutAt,
          workingMinutes: day.workingMinutes,
          breakMinutes: day.breakMinutes,
          openExceptionCount: day.openExceptionCount,
          currentStatus:
            lastEvent?.type === PunchType.BREAK_START
              ? 'ON_BREAK'
              : lastEvent?.type === PunchType.CHECK_IN
                ? 'CHECKED_IN'
                : 'CHECKED_OUT',
        };
      });
    }

    const records = await this.prisma.attendanceRecord.findMany({
      where: { dateIso: targetDate },
      include: {
        user: { select: { fullName: true, employeeId: true, role: true, department: true } },
      },
    });
    return records;
  }
}
