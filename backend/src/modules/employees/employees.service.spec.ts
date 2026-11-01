import { ForbiddenException, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../../common/services/audit.service';
import { SessionService } from '../auth/session.service';
import { EmployeesService } from './employees.service';
import { OrganizationGuardService } from './organization-guard.service';

function createPrismaMock() {
  const prisma = {
    user: {
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      update: jest.fn(),
    },
    leaveBalance: {
      createMany: jest.fn(),
    },
    leaveRequest: {
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  // Transactions receive this same mock so assertions can inspect the client
  // the service handed to the guard and the audit service.
  prisma.$transaction.mockImplementation((callback: (tx: typeof prisma) => unknown) =>
    callback(prisma),
  );
  return prisma;
}

function createAuditMock() {
  return { record: jest.fn() };
}

function buildService() {
  const prisma = createPrismaMock();
  const organizationGuard = { assertSuperAdminRetained: jest.fn() };
  const sessionService = { revokeAllForUser: jest.fn() };
  const audit = createAuditMock();
  const service = new EmployeesService(
    prisma as unknown as PrismaService,
    organizationGuard as unknown as OrganizationGuardService,
    sessionService as unknown as SessionService,
    audit as unknown as AuditService,
  );
  return { prisma, organizationGuard, sessionService, audit, service };
}

const hrActor = {
  id: 'hr-1',
  employeeId: 'EMP-HR',
  email: 'hr@macqhr.sa',
  role: 'HR_ADMIN',
  name: 'HR Admin',
};

describe('EmployeesService profile access', () => {
  let prisma: ReturnType<typeof createPrismaMock>;
  let service: EmployeesService;

  beforeEach(() => {
    ({ prisma, service } = buildService());
  });

  it('returns only the limited work profile to a colleague', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'emp-2',
      firstName: 'Sara',
      jobTitle: 'Designer',
    });

    const result = await service.findById('emp-2', {
      id: 'emp-1',
      role: 'EMPLOYEE',
    });

    expect(result).toEqual({
      id: 'emp-2',
      firstName: 'Sara',
      jobTitle: 'Designer',
    });

    const query = prisma.user.findUnique.mock.calls[0][0];
    expect(query.select).toBeDefined();
    expect(query.include).toBeUndefined();
    expect(query.select).not.toHaveProperty('basicSalarySar');
    expect(query.select).not.toHaveProperty('housingAllowanceSar');
    expect(query.select).not.toHaveProperty('nationalId');
    expect(query.select).not.toHaveProperty('iqamaNumber');
    expect(query.select).not.toHaveProperty('leaveBalances');
    expect(query.select).not.toHaveProperty('passwordHash');
  });

  it('does not give a manager access to compensation', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'emp-2' });

    await service.findById('emp-2', { id: 'mgr-1', role: 'MANAGER' });

    const query = prisma.user.findUnique.mock.calls[0][0];
    expect(query.select).toBeDefined();
    expect(query.include).toBeUndefined();
  });

  it('returns the full profile to the employee themselves and strips the hash', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'emp-2',
      basicSalarySar: 12000,
      nationalId: '1234567890',
      passwordHash: 'hashed',
      leaveBalances: [],
    });

    const result = await service.findById('emp-2', {
      id: 'emp-2',
      role: 'EMPLOYEE',
    });

    expect(result).toMatchObject({
      id: 'emp-2',
      basicSalarySar: 12000,
    });
    expect(result).not.toHaveProperty('passwordHash');

    const query = prisma.user.findUnique.mock.calls[0][0];
    expect(query.include).toBeDefined();
  });

  it.each(['HR_ADMIN', 'SUPER_ADMIN'])(
    'returns the full profile to %s',
    async (role) => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'emp-2',
        basicSalarySar: 9000,
        passwordHash: 'hashed',
      });

      const result = await service.findById('emp-2', { id: 'admin-1', role });

      expect(result).toMatchObject({ basicSalarySar: 9000 });
      expect(result).not.toHaveProperty('passwordHash');
    },
  );

  it('throws when the employee does not exist', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      service.findById('missing', { id: 'emp-1', role: 'EMPLOYEE' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('checks existence without loading the full record during update', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'emp-2' });
    prisma.user.update.mockResolvedValue({
      id: 'emp-2',
      passwordHash: 'hashed',
      jobTitle: 'Lead Designer',
    });

    const result = await service.update(
      'emp-2',
      { jobTitle: 'Lead Designer' },
      {
        id: 'hr-1',
        employeeId: 'EMP-HR',
        email: 'hr@macqhr.sa',
        role: 'HR_ADMIN',
        name: 'HR Admin',
      },
    );

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'emp-2' },
      select: { id: true },
    });
    expect(result).not.toHaveProperty('passwordHash');
  });
});

describe('EmployeesService deactivation safeguards', () => {
  it('forbids an HR admin from deactivating a Super Admin without opening a transaction', async () => {
    const { prisma, service } = buildService();
    prisma.user.findUnique.mockResolvedValue({ id: 'sa-1' });
    prisma.user.findUniqueOrThrow.mockResolvedValue({ role: 'SUPER_ADMIN' });

    await expect(service.deactivate('sa-1', 'Resigned', hrActor)).rejects.toBeInstanceOf(
      ForbiddenException,
    );

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('guards retention, cancels live leave, and audits inside the deactivation transaction', async () => {
    const { prisma, organizationGuard, sessionService, audit, service } = buildService();
    prisma.user.findUnique.mockResolvedValue({ id: 'emp-2' });
    prisma.user.findUniqueOrThrow.mockResolvedValue({ role: 'EMPLOYEE' });
    prisma.leaveRequest.updateMany.mockResolvedValue({ count: 2 });
    prisma.user.update.mockResolvedValue({ id: 'emp-2', isActive: false });

    const result = await service.deactivate('emp-2', 'Resigned', hrActor);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(organizationGuard.assertSuperAdminRetained).toHaveBeenCalledWith('emp-2', prisma);

    const cancelQuery = prisma.leaveRequest.updateMany.mock.calls[0][0];
    expect(cancelQuery.where).toEqual({ userId: 'emp-2', status: 'PENDING' });
    expect(cancelQuery.data).toMatchObject({ status: 'REJECTED', decidedById: 'hr-1' });
    expect(cancelQuery.data.rejectionReason).toBeTruthy();

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'emp-2' },
      data: { isActive: false },
    });
    expect(audit.record).toHaveBeenCalledWith(
      {
        actorUserId: 'hr-1',
        action: 'EMPLOYEE_DEACTIVATED',
        resource: 'User',
        details: {
          userId: 'emp-2',
          reason: 'Resigned',
          pendingLeaveRequestsCancelled: 2,
        },
      },
      prisma,
    );
    expect(sessionService.revokeAllForUser).toHaveBeenCalledWith('emp-2', 'DEACTIVATED');
    expect(result).toEqual({ deactivated: true, pendingLeaveRequestsCancelled: 2 });
  });

  it('returns not found when reactivating an unknown employee', async () => {
    const { prisma, service } = buildService();
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(service.reactivate('missing', 'Returning', hrActor)).rejects.toBeInstanceOf(
      NotFoundException,
    );

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('reactivates a known employee and audits inside the transaction', async () => {
    const { prisma, sessionService, audit, service } = buildService();
    prisma.user.findUnique.mockResolvedValue({ id: 'emp-2' });
    prisma.user.update.mockResolvedValue({ id: 'emp-2', isActive: true });

    const result = await service.reactivate('emp-2', 'Returning from leave', hrActor);

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'emp-2' },
      data: { isActive: true },
    });
    expect(audit.record).toHaveBeenCalledWith(
      {
        actorUserId: 'hr-1',
        action: 'EMPLOYEE_REACTIVATED',
        resource: 'User',
        details: { userId: 'emp-2', reason: 'Returning from leave' },
      },
      prisma,
    );
    expect(sessionService.revokeAllForUser).not.toHaveBeenCalled();
    expect(result).toEqual({ reactivated: true });
  });
});

describe('EmployeesService password reset', () => {
  it('stores a bcrypt hash, clears lockout, and audits inside the transaction', async () => {
    const { prisma, sessionService, audit, service } = buildService();
    prisma.user.findUnique.mockResolvedValueOnce({ id: 'emp-2' });
    prisma.user.findUniqueOrThrow.mockResolvedValue({ role: 'EMPLOYEE' });
    prisma.user.update.mockResolvedValue({ id: 'emp-2' });

    const result = await service.resetPassword('emp-2', hrActor);

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'emp-2' },
      select: { id: true },
    });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(result.temporaryPassword).toHaveLength(16);

    const updateQuery = prisma.user.update.mock.calls[0][0];
    expect(updateQuery.where).toEqual({ id: 'emp-2' });
    expect(updateQuery.data).toMatchObject({
      mustChangePassword: true,
      passwordChangedAt: null,
      failedLoginAttempts: 0,
      lockedUntil: null,
    });

    const storedHash: string = updateQuery.data.passwordHash;
    expect(storedHash).not.toBe(result.temporaryPassword);
    expect(storedHash).toMatch(/^\$2[aby]\$/);
    await expect(bcrypt.compare(result.temporaryPassword, storedHash)).resolves.toBe(true);

    expect(audit.record).toHaveBeenCalledWith(
      {
        actorUserId: 'hr-1',
        action: 'EMPLOYEE_PASSWORD_RESET',
        resource: 'User',
        details: { userId: 'emp-2' },
      },
      prisma,
    );
    // The credential itself never reaches the audit ledger.
    expect(JSON.stringify(audit.record.mock.calls[0][0].details)).not.toContain(
      result.temporaryPassword,
    );

    expect(sessionService.revokeAllForUser).toHaveBeenCalledWith('emp-2', 'ADMIN_REVOKE');
    // Sessions are revoked only once the transaction has committed.
    expect(sessionService.revokeAllForUser.mock.invocationCallOrder[0]).toBeGreaterThan(
      audit.record.mock.invocationCallOrder[0],
    );
  });

  it('returns not found for an unknown employee and changes nothing', async () => {
    const { prisma, sessionService, audit, service } = buildService();
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(service.resetPassword('missing', hrActor)).rejects.toBeInstanceOf(
      NotFoundException,
    );

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
    expect(sessionService.revokeAllForUser).not.toHaveBeenCalled();
  });

  it('forbids an HR admin from resetting a Super Admin password', async () => {
    const { prisma, sessionService, audit, service } = buildService();
    prisma.user.findUnique.mockResolvedValueOnce({ id: 'sa-1' });
    prisma.user.findUniqueOrThrow.mockResolvedValue({ role: 'SUPER_ADMIN' });

    await expect(service.resetPassword('sa-1', hrActor)).rejects.toThrow(
      new ForbiddenException('Only a Super Admin can reset a Super Admin password.'),
    );

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
    expect(sessionService.revokeAllForUser).not.toHaveBeenCalled();
  });

  it('lets a Super Admin reset another Super Admin password', async () => {
    const { prisma, sessionService, audit, service } = buildService();
    prisma.user.findUnique.mockResolvedValueOnce({ id: 'sa-2' });
    prisma.user.findUniqueOrThrow.mockResolvedValue({ role: 'SUPER_ADMIN' });
    prisma.user.update.mockResolvedValue({ id: 'sa-2' });

    const result = await service.resetPassword('sa-2', { ...hrActor, role: 'SUPER_ADMIN' });

    expect(result.temporaryPassword).toHaveLength(16);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(audit.record).toHaveBeenCalledWith(
      {
        actorUserId: 'hr-1',
        action: 'EMPLOYEE_PASSWORD_RESET',
        resource: 'User',
        details: { userId: 'sa-2' },
      },
      prisma,
    );
    expect(sessionService.revokeAllForUser).toHaveBeenCalledWith('sa-2', 'ADMIN_REVOKE');
  });
});
