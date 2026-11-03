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
import { isWithinGeofence } from '../../common/utils/haversine.util';

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

    // Layer 5: Branch Geofence Boundary Check (office punches only).
    // Approved remote employees still undergo the other anti-spoofing layers.
    const { isInside, distanceMeters } = isWithinGeofence(
      dto.latitude,
      dto.longitude,
      branch.latitude,
      branch.longitude,
      branch.geofenceRadiusMeters,
    );

    if (dto.workMode !== 'REMOTE' && !isInside) {
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

    return { distanceMeters };
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

    if (dto.workMode === 'REMOTE' && !user.isRemoteAllowed) {
      throw new ForbiddenException('Remote attendance is not enabled for this account.');
    }

    const todayIso = new Date().toISOString().slice(0, 10);
    const todayPunches = await this.prisma.attendanceRecord.findMany({
      where: { userId, dateIso: todayIso },
      orderBy: { timestamp: 'asc' },
      select: { type: true },
    });
    const lastPunch = todayPunches[todayPunches.length - 1];
    if (dto.type === PunchType.CHECK_IN && lastPunch?.type === PunchType.CHECK_IN) {
      throw new BadRequestException('You are already checked in. Submit a check-out first.');
    }
    if (dto.type === PunchType.CHECK_OUT && (!lastPunch || lastPunch.type !== PunchType.CHECK_IN)) {
      throw new BadRequestException('You must check in before submitting a check-out.');
    }

    // Run 6-layer anti-spoofing engine
    let distanceMeters: number;
    try {
      ({ distanceMeters } = this.validateAntiSpoofing(dto, branch));
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

    const record = await this.prisma.attendanceRecord.create({
      data: {
        userId,
        branchId: branch.id,
        type: dto.type,
        timestamp: new Date(),
        dateIso: new Date().toISOString().slice(0, 10),
        clockInTime: dto.type === PunchType.CHECK_IN ? new Date().toISOString() : null,
        clockOutTime: dto.type === PunchType.CHECK_OUT ? new Date().toISOString() : null,
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
        securityFlags: dto.workMode === 'REMOTE' ? ['AUTHORIZED_REMOTE_HUB'] : [],
        notes: dto.notes,
      },
      include: {
        branch: {
          select: { name: true, nameAr: true, code: true },
        },
      },
    });

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
          },
        },
      });
    } catch (auditError) {
      this.logger.error('Failed to write attendance acceptance audit log.', auditError);
    }

    return {
      message: `${dto.type === PunchType.CHECK_IN ? 'Check-in' : 'Check-out'} recorded successfully.`,
      record,
    };
  }

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
        branch: {
          select: { name: true, nameAr: true, code: true },
        },
      },
    });
  }

  async getTeamAttendance(managerId: string, dateIso?: string) {
    const targetDate = dateIso ? new Date(dateIso) : new Date();
    const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
    const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999));

    // Get direct reports for this manager
    const directReports = await this.prisma.user.findMany({
      where: { managerId, isActive: true },
      select: {
        id: true,
        employeeId: true,
        firstName: true,
        lastName: true,
        jobTitle: true,
        avatarUrl: true,
        department: true,
        branch: { select: { name: true } },
      },
    });

    const reportIds = directReports.map((r) => r.id);

    const punches = await this.prisma.attendanceRecord.findMany({
      where: {
        userId: { in: reportIds },
        timestamp: { gte: startOfDay, lte: endOfDay },
      },
      orderBy: { timestamp: 'asc' },
    });

    // Collate employee attendance statuses
    return directReports.map((employee) => {
      const empPunches = punches.filter((p) => p.userId === employee.id);
      const checkIn = empPunches.find((p) => p.type === 'CHECK_IN');
      const checkOut = empPunches.reverse().find((p) => p.type === 'CHECK_OUT');

      let status = 'ABSENT';
      if (checkIn && !checkOut) status = 'PRESENT_ON_SITE';
      if (checkIn && checkOut) status = 'COMPLETED_DAY';

      return {
        employee,
        status,
        checkInTime: checkIn ? checkIn.timestamp : null,
        checkOutTime: checkOut ? checkOut.timestamp : null,
        punchesCount: empPunches.length,
      };
    });
  }

  async getAllRecords(limit: number = 100) {
    return this.prisma.attendanceRecord.findMany({
      orderBy: { timestamp: 'desc' },
      take: limit,
      include: {
        user: {
          select: {
            employeeId: true,
            firstName: true,
            lastName: true,
            email: true,
            department: true,
            jobTitle: true,
            role: true,
          },
        },
        branch: {
          select: { name: true, code: true },
        },
      },
    });
  }
}
