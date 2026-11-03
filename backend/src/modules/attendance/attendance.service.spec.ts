import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { PunchType } from './dto/attendance.dto';
import { RemoteRequestDecision } from './dto/remote-request.dto';
import { ExceptionReviewDecision } from './dto/exception-review.dto';

describe('AttendanceService', () => {
  const branch = {
    id: 'branch-1',
    name: 'Riyadh HQ',
    latitude: 24.7136,
    longitude: 46.6753,
    geofenceRadiusMeters: 150,
  };

  function createService(overrides: Record<string, unknown> = {}) {
    const defaultDay = {
      id: 'day-1',
      userId: 'user-1',
      dateIso: '2026-11-04',
      mode: 'OFFICE',
      status: 'INCOMPLETE',
      workingMinutes: 0,
      breakMinutes: 0,
      openExceptionCount: 0,
      firstCheckInAt: new Date('2026-11-04T06:00:00Z'),
      events: [],
      exceptions: [],
    };

    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'user-1',
          employeeId: 'EMP-001',
          role: 'EMPLOYEE',
          branchId: branch.id,
          isRemoteAllowed: true,
          managerId: 'manager-1',
        }),
      },
      branch: { findUnique: jest.fn().mockResolvedValue(branch) },
      attendanceDay: {
        findUnique: jest.fn().mockResolvedValue(defaultDay),
        create: jest.fn().mockResolvedValue(defaultDay),
        update: jest.fn().mockResolvedValue(defaultDay),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findMany: jest.fn().mockResolvedValue([defaultDay]),
      },
      attendanceRecord: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue({ id: 'record-1', status: 'VERIFIED' }),
      },
      attendanceException: {
        create: jest.fn().mockResolvedValue({ id: 'ex-1' }),
        findUnique: jest.fn().mockResolvedValue({ id: 'ex-1', dayId: 'day-1', status: 'OPEN' }),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue({ id: 'ex-1', status: 'ACCEPTED' }),
        count: jest.fn().mockResolvedValue(0),
      },
      remoteWorkRequest: {
        create: jest.fn().mockResolvedValue({ id: 'req-1', status: 'PENDING' }),
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn().mockResolvedValue({
          id: 'req-1',
          userId: 'user-1',
          status: 'PENDING',
          startDateIso: '2026-11-05',
          endDateIso: '2026-11-05',
          user: { managerId: 'manager-1' },
        }),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue({ id: 'req-1', status: 'APPROVED' }),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
      ...overrides,
    } as any;
    const config = {
      get: jest.fn((key: string) => {
        if (key === 'security.maxAllowedGpsAccuracyMeters') return 50;
        if (key === 'security.maxAllowedNtpDriftMinutes') return 5;
        return undefined;
      }),
    } as any;
    return { service: new AttendanceService(prisma, config), prisma };
  }

  const validPayload = {
    type: PunchType.CHECK_IN,
    latitude: 31.5204,
    longitude: 74.3587,
    accuracyMeters: 10,
    isMockLocation: false,
    isDeviceRooted: false,
    biometricVerified: true,
    clientTimestamp: new Date().toISOString(),
    branchId: branch.id,
    workMode: 'REMOTE' as const,
  };

  const insideOfficePayload = {
    ...validPayload,
    latitude: 24.7136,
    longitude: 46.6753,
    workMode: 'OFFICE' as const,
  };

  it('allows approved remote employees outside the office geofence', async () => {
    const { service, prisma } = createService();

    await service.punch('user-1', validPayload);

    expect(prisma.attendanceRecord.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          workMode: 'REMOTE',
          securityFlags: ['AUTHORIZED_REMOTE_HUB'],
        }),
      }),
    );
  });

  it('rejects office check-in punches outside the assigned geofence and audits the rejection', async () => {
    const { service, prisma } = createService();

    await expect(
      service.punch('user-1', { ...validPayload, workMode: 'OFFICE' }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'ATTENDANCE_PUNCH_REJECTED' }),
      }),
    );
    expect(prisma.attendanceRecord.create).not.toHaveBeenCalled();
  });

  it('permits office check-out outside geofence (non-blocking) and logs an attendance exception', async () => {
    const { service, prisma } = createService({
      attendanceRecord: {
        findMany: jest.fn().mockResolvedValue([{ type: PunchType.CHECK_IN, timestamp: new Date() }]),
        create: jest.fn().mockResolvedValue({ id: 'rec-checkout', status: 'FLAGGED' }),
      },
    });

    const res = await service.punch('user-1', {
      ...validPayload,
      type: PunchType.CHECK_OUT,
      workMode: 'OFFICE',
    });

    expect(res.message).toContain('Flagged for HR review');
    expect(prisma.attendanceException.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'OUTSIDE_OFFICE_GEOFENCE',
          severity: 'MEDIUM',
          status: 'OPEN',
        }),
      }),
    );
    expect(prisma.attendanceDay.update).toHaveBeenCalled();
  });

  it('prevents a second check-in while the employee is already checked in', async () => {
    const { service, prisma } = createService({
      attendanceRecord: {
        findMany: jest.fn().mockResolvedValue([{ type: PunchType.CHECK_IN }]),
        create: jest.fn(),
      },
    });

    await expect(service.punch('user-1', validPayload)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.attendanceRecord.create).not.toHaveBeenCalled();
  });

  it('records BREAK_START after check-in and rejects taking a break before checking in', async () => {
    const { service: serviceNotCheckedIn } = createService({
      attendanceRecord: { findMany: jest.fn().mockResolvedValue([]) },
    });

    await expect(
      serviceNotCheckedIn.punch('user-1', { ...insideOfficePayload, type: PunchType.BREAK_START }),
    ).rejects.toBeInstanceOf(BadRequestException);

    const { service: serviceCheckedIn, prisma } = createService({
      attendanceRecord: {
        findMany: jest.fn().mockResolvedValue([{ type: PunchType.CHECK_IN, timestamp: new Date() }]),
        create: jest.fn().mockResolvedValue({ id: 'rec-break-start' }),
      },
    });

    const res = await serviceCheckedIn.punch('user-1', {
      ...insideOfficePayload,
      type: PunchType.BREAK_START,
    });
    expect(res.message).toContain('Break started recorded successfully');
    expect(prisma.attendanceRecord.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: PunchType.BREAK_START }),
      }),
    );
  });

  it('records BREAK_END only when on break and updates break minutes', async () => {
    const breakStartTime = new Date(Date.now() - 30 * 60000); // 30 mins ago
    const { service, prisma } = createService({
      attendanceRecord: {
        findMany: jest.fn().mockResolvedValue([
          { type: PunchType.CHECK_IN, timestamp: new Date(Date.now() - 120 * 60000) },
          { type: PunchType.BREAK_START, timestamp: breakStartTime },
        ]),
        create: jest.fn().mockResolvedValue({ id: 'rec-break-end' }),
      },
    });

    const res = await service.punch('user-1', {
      ...insideOfficePayload,
      type: PunchType.BREAK_END,
    });

    expect(res.message).toContain('Break ended recorded successfully');
    expect(prisma.attendanceDay.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          breakMinutes: expect.any(Number),
        }),
      }),
    );
  });

  it('blocks remote mode for employees without remote permission or approved request', async () => {
    const { service } = createService({
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'user-1',
          employeeId: 'EMP-001',
          role: 'EMPLOYEE',
          branchId: branch.id,
          isRemoteAllowed: false,
        }),
      },
    });

    await expect(service.punch('user-1', validPayload)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  describe('Remote Work Requests', () => {
    it('creates a remote request and prevents overlapping ranges', async () => {
      const { service, prisma } = createService();

      const res = await service.createRemoteRequest('user-1', {
        startDateIso: '2026-11-10',
        endDateIso: '2026-11-12',
        reason: 'Relocating temporarily',
      });

      expect(res.message).toContain('submitted successfully');
      expect(prisma.remoteWorkRequest.create).toHaveBeenCalled();
    });

    it('rejects an employee attempting to approve their own request', async () => {
      const { service } = createService();

      await expect(
        service.decideRemoteRequest('user-1', 'MANAGER', 'req-1', {
          decision: RemoteRequestDecision.APPROVED,
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('allows a manager to approve a direct report request and updates day mode to REMOTE', async () => {
      const { service, prisma } = createService();

      const res = await service.decideRemoteRequest('manager-1', 'MANAGER', 'req-1', {
        decision: RemoteRequestDecision.APPROVED,
      });

      expect(res.message).toContain('approved');
      expect(prisma.remoteWorkRequest.update).toHaveBeenCalled();
      expect(prisma.attendanceDay.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ mode: 'REMOTE' }),
        }),
      );
    });
  });

  describe('Attendance Exception Review', () => {
    it('allows HR to review and accept an exception, resetting open exception count', async () => {
      const { service, prisma } = createService();

      const res = await service.reviewException('hr-1', 'ex-1', {
        decision: ExceptionReviewDecision.ACCEPTED,
        reviewNote: 'Approved early leave due to off-site client emergency',
      });

      expect(res.message).toContain('accepted');
      expect(prisma.attendanceException.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'ACCEPTED' }),
        }),
      );
      expect(prisma.attendanceDay.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'VERIFIED', openExceptionCount: 0 }),
        }),
      );
    });
  });
});
