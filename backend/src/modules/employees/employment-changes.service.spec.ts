import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { EmploymentChangesService } from './employment-changes.service';
import { toCompanyDateIso } from '../../common/utils/company-time.util';

function build() {
  const prisma = {
    user: { findUniqueOrThrow: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    branch: { findUnique: jest.fn() },
    employmentChange: { create: jest.fn(), findMany: jest.fn() },
    employeeSalaryRecord: { create: jest.fn() },
    $transaction: jest.fn((cb: any) => cb(prisma)),
  };
  // The service reloads the employee after the transaction to return a safe profile.
  prisma.user.findUniqueOrThrow.mockResolvedValue(user);
  const guards = {
    assertCanAssignManager: jest.fn(),
    assertSuperAdminRetained: jest.fn(),
  };
  const sessions = { revokeAllForUser: jest.fn() };
  const audit = { record: jest.fn() };
  const service = new EmploymentChangesService(
    prisma as any,
    guards as any,
    sessions as any,
    audit as any,
  );
  return { prisma, guards, sessions, audit, service };
}

const actor = { id: 'hr-1', role: 'HR_ADMIN' } as any;

const user = {
  id: 'user-1',
  employeeId: 'EMP-1',
  role: 'EMPLOYEE',
  jobTitle: 'Engineer',
  branchId: 'branch-a',
  managerId: null,
  isRemoteAllowed: false,
  basicSalarySar: 10000,
  housingAllowanceSar: 2000,
  transportAllowanceSar: 1000,
  remoteGrantedById: null,
  remoteGrantedAt: null,
};

const today = toCompanyDateIso();

describe('EmploymentChangesService', () => {
  it('rejects future effective dates', async () => {
    const { service } = build();
    await expect(
      service.apply('user-1', {
        type: 'PROMOTION',
        effectiveDate: '2999-01-01',
        reason: 'Future',
        jobTitle: 'Lead',
      } as any, actor),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an unknown employee with a 404', async () => {
    const { prisma, service } = build();
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      service.apply('missing-user', {
        type: 'PROMOTION',
        effectiveDate: today,
        reason: 'Unknown employee',
        jobTitle: 'Lead',
      } as any, actor),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('revokes sessions when the role changes', async () => {
    const { prisma, sessions, service } = build();
    prisma.user.findUnique.mockResolvedValue(user);
    prisma.employmentChange.create.mockResolvedValue({ id: 'change-1' });
    prisma.user.update.mockResolvedValue({ ...user, role: 'MANAGER' });

    await service.apply('user-1', {
      type: 'ROLE',
      effectiveDate: today,
      reason: 'Promotion to manager track',
      role: 'MANAGER',
    } as any, actor);

    expect(sessions.revokeAllForUser).toHaveBeenCalledWith('user-1', 'ROLE_CHANGE');
  });

  it('writes a salary record and updates current columns', async () => {
    const { prisma, service } = build();
    prisma.user.findUnique.mockResolvedValue(user);
    prisma.employmentChange.create.mockResolvedValue({ id: 'change-2' });
    prisma.employeeSalaryRecord.create.mockResolvedValue({ id: 'salary-2' });
    prisma.user.update.mockResolvedValue(user);

    await service.apply('user-1', {
      type: 'SALARY',
      effectiveDate: today,
      reason: 'Annual review',
      basicSalarySar: 12000,
      housingAllowanceSar: 2500,
      transportAllowanceSar: 1000,
    } as any, actor);

    expect(prisma.employeeSalaryRecord.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ basicSalarySar: 12000, effectiveFrom: today }),
    });
  });

  it('normalises a full ISO timestamp before persisting the effective date', async () => {
    const { prisma, audit, service } = build();
    prisma.user.findUnique.mockResolvedValue(user);
    prisma.employmentChange.create.mockResolvedValue({ id: 'change-2' });
    prisma.employeeSalaryRecord.create.mockResolvedValue({ id: 'salary-2' });
    prisma.user.update.mockResolvedValue(user);

    await service.apply('user-1', {
      type: 'SALARY',
      effectiveDate: '2024-03-01T23:30:00.000Z',
      reason: 'Annual review',
      basicSalarySar: 12000,
      housingAllowanceSar: 2500,
      transportAllowanceSar: 1000,
    } as any, actor);

    expect(prisma.employmentChange.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ effectiveDate: '2024-03-01' }),
    });
    expect(prisma.employeeSalaryRecord.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ effectiveFrom: '2024-03-01' }),
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'EMPLOYMENT_CHANGE_APPLIED',
        details: expect.objectContaining({ effectiveDate: '2024-03-01' }),
      }),
      prisma,
    );
  });

  it('records the before and after state in the ledger', async () => {
    const { prisma, service } = build();
    prisma.user.findUnique.mockResolvedValue(user);
    prisma.employmentChange.create.mockResolvedValue({ id: 'change-3' });
    prisma.user.update.mockResolvedValue(user);

    await service.apply('user-1', {
      type: 'PROMOTION',
      effectiveDate: today,
      reason: 'Team lead',
      jobTitle: 'Lead',
    } as any, actor);

    expect(prisma.employmentChange.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: 'PROMOTION',
        beforeJson: expect.objectContaining({ jobTitle: 'Engineer' }),
        afterJson: { jobTitle: 'Lead' },
        actorUserId: 'hr-1',
      }),
    });
  });

  it('rejects a transfer to a branch that does not exist inside the transaction', async () => {
    const { prisma, service } = build();
    prisma.user.findUnique.mockResolvedValue(user);
    prisma.branch.findUnique.mockResolvedValue(null);

    await expect(
      service.apply('user-1', {
        type: 'TRANSFER',
        effectiveDate: today,
        reason: 'Relocation',
        branchId: 'missing-branch',
      } as any, actor),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(prisma.branch.findUnique).toHaveBeenCalledWith({
      where: { id: 'missing-branch' },
    });
    expect(prisma.employmentChange.create).not.toHaveBeenCalled();
  });

  it('rejects an omitted managerId instead of silently clearing the manager', async () => {
    const { prisma, guards, service } = build();
    prisma.user.findUnique.mockResolvedValue(user);

    await expect(
      service.apply('user-1', {
        type: 'MANAGER',
        effectiveDate: today,
        reason: 'Reporting line update',
      } as any, actor),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(guards.assertCanAssignManager).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('checks a manager assignment inside the transaction with the transaction client', async () => {
    const { prisma, guards, service } = build();
    prisma.user.findUnique.mockResolvedValue(user);
    prisma.employmentChange.create.mockResolvedValue({ id: 'change-4' });
    prisma.user.update.mockResolvedValue(user);

    await service.apply('user-1', {
      type: 'MANAGER',
      effectiveDate: today,
      reason: 'New reporting line',
      managerId: 'mgr-1',
    } as any, actor);

    expect(guards.assertCanAssignManager).toHaveBeenCalledWith('user-1', 'mgr-1', prisma);
    expect(prisma.$transaction.mock.invocationCallOrder[0]).toBeLessThan(
      guards.assertCanAssignManager.mock.invocationCallOrder[0],
    );
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { manager: { connect: { id: 'mgr-1' } } },
    });
  });

  it('allows clearing the manager when managerId is explicitly null', async () => {
    const { prisma, guards, service } = build();
    prisma.user.findUnique.mockResolvedValue({ ...user, managerId: 'mgr-1' });
    prisma.employmentChange.create.mockResolvedValue({ id: 'change-5' });
    prisma.user.update.mockResolvedValue(user);

    await service.apply('user-1', {
      type: 'MANAGER',
      effectiveDate: today,
      reason: 'Manager left',
      managerId: null,
    } as any, actor);

    expect(guards.assertCanAssignManager).toHaveBeenCalledWith('user-1', null, prisma);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { manager: { disconnect: true } },
    });
  });

  it('rejects an empty-string managerId instead of silently clearing the manager', async () => {
    const { prisma, guards, service } = build();
    prisma.user.findUnique.mockResolvedValue({ ...user, managerId: 'mgr-1' });

    await expect(
      service.apply('user-1', {
        type: 'MANAGER',
        effectiveDate: today,
        reason: 'Reporting line update',
        managerId: '',
      } as any, actor),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(guards.assertCanAssignManager).not.toHaveBeenCalled();
    expect(prisma.employmentChange.create).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('checks that a demoted Super Admin is retained inside the transaction', async () => {
    const { prisma, guards, service } = build();
    const superAdmin = { ...user, role: 'SUPER_ADMIN' };
    prisma.user.findUnique.mockResolvedValue(superAdmin);
    prisma.employmentChange.create.mockResolvedValue({ id: 'change-6' });
    prisma.user.update.mockResolvedValue({ ...superAdmin, role: 'MANAGER' });

    await service.apply('user-1', {
      type: 'ROLE',
      effectiveDate: today,
      reason: 'Moving to manager track',
      role: 'MANAGER',
    } as any, { ...actor, role: 'SUPER_ADMIN' });

    expect(guards.assertSuperAdminRetained).toHaveBeenCalledWith('user-1', prisma);
    expect(prisma.$transaction.mock.invocationCallOrder[0]).toBeLessThan(
      guards.assertSuperAdminRetained.mock.invocationCallOrder[0],
    );
    expect(guards.assertSuperAdminRetained.mock.invocationCallOrder[0]).toBeLessThan(
      prisma.user.update.mock.invocationCallOrder[0],
    );
  });

  it('forbids an HR admin from granting the Super Admin role', async () => {
    const { prisma, service } = build();
    prisma.user.findUnique.mockResolvedValue(user);

    await expect(
      service.apply('user-1', {
        type: 'ROLE',
        effectiveDate: today,
        reason: 'Escalation attempt',
        role: 'SUPER_ADMIN',
      } as any, actor),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.employmentChange.create).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('forbids an HR admin from demoting a Super Admin before any write', async () => {
    const { prisma, guards, sessions, service } = build();
    const superAdmin = { ...user, role: 'SUPER_ADMIN' };
    prisma.user.findUnique.mockResolvedValue(superAdmin);

    await expect(
      service.apply('user-1', {
        type: 'ROLE',
        effectiveDate: today,
        reason: 'Demotion attempt',
        role: 'MANAGER',
      } as any, actor),
    ).rejects.toThrow(
      new ForbiddenException('Only a Super Admin can change a Super Admin role.'),
    );

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.employmentChange.create).not.toHaveBeenCalled();
    expect(guards.assertSuperAdminRetained).not.toHaveBeenCalled();
    expect(sessions.revokeAllForUser).not.toHaveBeenCalled();
  });

  it('lets a Super Admin demote another Super Admin once retention is proven', async () => {
    const { prisma, guards, sessions, service } = build();
    const superAdmin = { ...user, role: 'SUPER_ADMIN' };
    prisma.user.findUnique.mockResolvedValue(superAdmin);
    prisma.employmentChange.create.mockResolvedValue({ id: 'change-11' });
    prisma.user.update.mockResolvedValue({ ...superAdmin, role: 'HR_ADMIN' });

    await service.apply('user-1', {
      type: 'ROLE',
      effectiveDate: today,
      reason: 'Handing over ownership',
      role: 'HR_ADMIN',
    } as any, { ...actor, role: 'SUPER_ADMIN' });

    expect(guards.assertSuperAdminRetained).toHaveBeenCalledWith('user-1', prisma);
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: expect.objectContaining({ role: 'HR_ADMIN', canAccessWebAdmin: true }),
    });
    expect(sessions.revokeAllForUser).toHaveBeenCalledWith('user-1', 'ROLE_CHANGE');
  });

  it('does not swallow audit failures', async () => {
    const { prisma, audit, service } = build();
    prisma.user.findUnique.mockResolvedValue(user);
    prisma.employmentChange.create.mockResolvedValue({ id: 'change-10' });
    prisma.user.update.mockResolvedValue(user);
    audit.record.mockRejectedValue(new Error('audit down'));

    await expect(
      service.apply('user-1', {
        type: 'PROMOTION',
        effectiveDate: today,
        reason: 'Team lead',
        jobTitle: 'Lead',
      } as any, actor),
    ).rejects.toThrow('audit down');
  });

  it('grants web admin access when the role becomes HR_ADMIN', async () => {
    const { prisma, service } = build();
    prisma.user.findUnique.mockResolvedValue(user);
    prisma.employmentChange.create.mockResolvedValue({ id: 'change-7' });
    prisma.user.update.mockResolvedValue({ ...user, role: 'HR_ADMIN' });

    await service.apply('user-1', {
      type: 'ROLE',
      effectiveDate: today,
      reason: 'HR transfer',
      role: 'HR_ADMIN',
    } as any, actor);

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: expect.objectContaining({ role: 'HR_ADMIN', canAccessWebAdmin: true }),
    });
  });

  it('revokes web admin access when the role loses admin rights', async () => {
    const { prisma, service } = build();
    prisma.user.findUnique.mockResolvedValue({ ...user, role: 'HR_ADMIN' });
    prisma.employmentChange.create.mockResolvedValue({ id: 'change-8' });
    prisma.user.update.mockResolvedValue({ ...user, role: 'MANAGER' });

    await service.apply('user-1', {
      type: 'ROLE',
      effectiveDate: today,
      reason: 'Moving back to operations',
      role: 'MANAGER',
    } as any, actor);

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: expect.objectContaining({ role: 'MANAGER', canAccessWebAdmin: false }),
    });
  });

  it('records who granted remote eligibility', async () => {
    const { prisma, service } = build();
    prisma.user.findUnique.mockResolvedValue(user);
    prisma.employmentChange.create.mockResolvedValue({ id: 'change-9' });
    prisma.user.update.mockResolvedValue({ ...user, isRemoteAllowed: true });

    await service.apply('user-1', {
      type: 'REMOTE_ELIGIBILITY',
      effectiveDate: today,
      reason: 'Approved remote arrangement',
      isRemoteAllowed: true,
    } as any, actor);

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: expect.objectContaining({
        isRemoteAllowed: true,
        remoteGrantedBy: { connect: { id: 'hr-1' } },
        remoteGrantedAt: expect.any(Date),
      }),
    });
    expect(prisma.employmentChange.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        afterJson: { isRemoteAllowed: true, remoteGrantedById: 'hr-1' },
      }),
    });
  });

  it('rejects listing changes for an unknown employee with a 404', async () => {
    const { prisma, service } = build();
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(service.list('missing-user')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.employmentChange.findMany).not.toHaveBeenCalled();
  });

  it('lists changes newest first with a deterministic id tiebreaker', async () => {
    const { prisma, service } = build();
    prisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
    prisma.employmentChange.findMany.mockResolvedValue([]);

    await service.list('user-1');

    expect(prisma.employmentChange.findMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: {
        actor: { select: { firstName: true, lastName: true } },
        salaryRecord: true,
      },
    });
  });
});
