import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../../common/services/audit.service';
import { EmployeesService } from './employees.service';

function createPrismaMock() {
  return {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    leaveBalance: {
      createMany: jest.fn(),
    },
  };
}

function createAuditMock() {
  return { record: jest.fn() };
}

describe('EmployeesService profile access', () => {
  let prisma: ReturnType<typeof createPrismaMock>;
  let service: EmployeesService;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new EmployeesService(
      prisma as unknown as PrismaService,
      createAuditMock() as unknown as AuditService,
    );
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

    const result = await service.update('emp-2', { jobTitle: 'Lead Designer' });

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'emp-2' },
      select: { id: true },
    });
    expect(result).not.toHaveProperty('passwordHash');
  });
});
