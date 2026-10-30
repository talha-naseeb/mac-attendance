import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { PunchType } from './dto/attendance.dto';

describe('AttendanceService', () => {
  const branch = {
    id: 'branch-1',
    name: 'Riyadh HQ',
    latitude: 24.7136,
    longitude: 46.6753,
    geofenceRadiusMeters: 150,
  };

  function createService(overrides: Record<string, unknown> = {}) {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'user-1',
          employeeId: 'EMP-001',
          role: 'EMPLOYEE',
          branchId: branch.id,
          isRemoteAllowed: true,
        }),
      },
      branch: { findUnique: jest.fn().mockResolvedValue(branch) },
      attendanceRecord: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue({ id: 'record-1' }),
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

  it('rejects office punches outside the assigned geofence and audits the rejection', async () => {
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

  it('blocks remote mode for employees without remote permission', async () => {
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
});
