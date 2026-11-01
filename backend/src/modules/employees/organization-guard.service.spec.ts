import { BadRequestException, ConflictException } from '@nestjs/common';
import { OrganizationGuardService } from './organization-guard.service';

function build(prismaOverrides: Record<string, any> = {}) {
  const prisma = {
    user: { findUnique: jest.fn(), count: jest.fn() },
    leaveRequest: { count: jest.fn() },
    ...prismaOverrides,
  };
  return { prisma, service: new OrganizationGuardService(prisma as any) };
}

describe('OrganizationGuardService', () => {
  it('rejects self-management', async () => {
    const { service } = build();
    await expect(service.assertCanAssignManager('user-1', 'user-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects a reporting cycle', async () => {
    const { prisma, service } = build();
    // user-3 reports to user-4, and user-4 is at the top of the chain.
    prisma.user.findUnique
      .mockResolvedValueOnce({ managerId: 'user-4' })
      .mockResolvedValueOnce({ managerId: null });
    await expect(service.assertCanAssignManager('user-1', 'user-3')).resolves.toBeUndefined();

    // user-2 already reports to user-1, so user-2 cannot become user-1's manager.
    prisma.user.findUnique.mockReset();
    prisma.user.findUnique.mockResolvedValueOnce({ managerId: 'user-1' });
    await expect(service.assertCanAssignManager('user-1', 'user-2')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('refuses to remove the last active Super Admin', async () => {
    const { prisma, service } = build();
    prisma.user.findUnique.mockResolvedValue({ role: 'SUPER_ADMIN', isActive: true });
    prisma.user.count.mockResolvedValue(0);
    await expect(service.assertSuperAdminRetained('user-1')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('allows demotion when another active Super Admin remains', async () => {
    const { prisma, service } = build();
    prisma.user.findUnique.mockResolvedValue({ role: 'SUPER_ADMIN', isActive: true });
    prisma.user.count.mockResolvedValue(1);
    await expect(service.assertSuperAdminRetained('user-1')).resolves.toBeUndefined();
  });
});
