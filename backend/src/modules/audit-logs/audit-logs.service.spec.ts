import { AuditLogsService } from './audit-logs.service';

describe('AuditLogsService', () => {
  function createService(total = 120, rows: unknown[] = []) {
    const prisma = {
      auditLog: {
        count: jest.fn().mockResolvedValue(total),
        findMany: jest.fn().mockResolvedValue(rows),
      },
    } as any;
    return { service: new AuditLogsService(prisma), prisma };
  }

  it('defaults to 50 logs per page and caps totalPages at 20 pages (1000 logs window)', async () => {
    const sampleRow = {
      id: 'log-1',
      action: 'EMPLOYEE_CREATED',
      resource: 'User',
      detailsJson: { employeeId: 'EMP-010' },
      ipAddress: '127.0.0.1',
      createdAt: new Date('2026-11-03T00:00:00Z'),
      actorUser: {
        id: 'user-hr',
        employeeId: 'EMP-002',
        firstName: 'Sara',
        lastName: 'Al-Otaibi',
        email: 'sara.alotaibi@macqhr.sa',
        role: 'HR_ADMIN',
        department: 'People & Culture',
      },
    };
    const { service, prisma } = createService(1500, [sampleRow]);

    const result = await service.findPaginated({});

    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 0,
        take: 50,
      }),
    );
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(50);
    expect(result.maxPages).toBe(20);
    expect(result.total).toBe(1500);
    expect(result.windowTotal).toBe(1000);
    expect(result.totalPages).toBe(20);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].actor?.name).toBe('Sara Al-Otaibi');
  });

  it('fetches the requested page with correct offset and applies search/resource/action filters', async () => {
    const { service, prisma } = createService(180, []);

    const result = await service.findPaginated({
      page: 3,
      pageSize: 50,
      resource: 'AttendanceRecord',
      action: 'ATTENDANCE_',
      search: 'Rahaf',
    });

    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 100,
        take: 50,
        where: {
          AND: expect.arrayContaining([
            { resource: 'AttendanceRecord' },
            { action: { contains: 'ATTENDANCE_', mode: 'insensitive' } },
          ]),
        },
      }),
    );
    expect(result.page).toBe(3);
    expect(result.totalPages).toBe(4);
  });
});
