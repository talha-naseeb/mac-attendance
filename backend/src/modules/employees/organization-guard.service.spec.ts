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
  describe('assertCanAssignManager', () => {
    it('resolves without querying when managerId is null', async () => {
      const { prisma, service } = build();
      await expect(service.assertCanAssignManager('user-1', null)).resolves.toBeUndefined();
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('rejects self-management', async () => {
      const { prisma, service } = build();
      await expect(service.assertCanAssignManager('user-1', 'user-1')).rejects.toThrow(
        /cannot be their own manager/i,
      );
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('allows an assignment whose reporting chain terminates', async () => {
      const { prisma, service } = build();
      prisma.user.findUnique
        .mockResolvedValueOnce({ managerId: 'user-4' })
        .mockResolvedValueOnce({ managerId: null });
      await expect(service.assertCanAssignManager('user-1', 'user-3')).resolves.toBeUndefined();
      expect(prisma.user.findUnique).toHaveBeenCalledTimes(2);
    });

    it('rejects a direct cycle where the proposed manager reports to the user', async () => {
      const { prisma, service } = build();
      // user-2 already reports to user-1, so user-2 cannot become user-1's manager.
      prisma.user.findUnique.mockResolvedValueOnce({ managerId: 'user-1' });
      await expect(service.assertCanAssignManager('user-1', 'user-2')).rejects.toThrow(
        /would create a reporting cycle/i,
      );
    });

    it('rejects a cycle that closes at depth 2 or deeper', async () => {
      const { prisma, service } = build();
      // user-3 -> user-4 -> user-1: the cycle only closes two hops above the proposed manager.
      prisma.user.findUnique
        .mockResolvedValueOnce({ managerId: 'user-4' })
        .mockResolvedValueOnce({ managerId: 'user-1' });
      await expect(service.assertCanAssignManager('user-1', 'user-3')).rejects.toThrow(
        /would create a reporting cycle/i,
      );
    });

    it('rejects when the existing hierarchy already contains a cycle', async () => {
      const { prisma, service } = build();
      // user-3 -> user-4 -> user-3 never reaches user-1, but the chain is already cyclic.
      prisma.user.findUnique
        .mockResolvedValueOnce({ managerId: 'user-4' })
        .mockResolvedValueOnce({ managerId: 'user-3' });
      await expect(service.assertCanAssignManager('user-1', 'user-3')).rejects.toThrow(
        /already contains a cycle/i,
      );
    });

    it('detects a cycle that closes more than 50 hops away', async () => {
      const { prisma, service } = build();
      const chain = new Map<string, string | null>();
      const hops = 60;
      for (let index = 0; index < hops; index += 1) {
        chain.set(`user-${index + 3}`, `user-${index + 4}`);
      }
      chain.set(`user-${hops + 3}`, 'user-1');
      prisma.user.findUnique.mockImplementation(({ where }: any) =>
        Promise.resolve({ managerId: chain.get(where.id) ?? null }),
      );
      await expect(service.assertCanAssignManager('user-1', 'user-3')).rejects.toThrow(
        /would create a reporting cycle/i,
      );
    });

    it('rejects a manager id that does not exist', async () => {
      const { prisma, service } = build();
      prisma.user.findUnique.mockResolvedValueOnce(null);
      await expect(service.assertCanAssignManager('user-1', 'missing-user')).rejects.toThrow(
        /does not exist/i,
      );
    });

    it('does not treat an empty manager id as "no manager"', async () => {
      const { prisma, service } = build();
      prisma.user.findUnique.mockResolvedValueOnce(null);
      await expect(service.assertCanAssignManager('user-1', '')).rejects.toThrow(
        /does not exist/i,
      );
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: '' },
        select: { managerId: true },
      });
    });
  });

  describe('assertSuperAdminRetained', () => {
    it('refuses to remove the last active Super Admin', async () => {
      const { prisma, service } = build();
      prisma.user.findUnique.mockResolvedValue({ role: 'SUPER_ADMIN', isActive: true });
      prisma.user.count.mockResolvedValue(0);
      await expect(service.assertSuperAdminRetained('user-1')).rejects.toBeInstanceOf(
        ConflictException,
      );
      await expect(service.assertSuperAdminRetained('user-1')).rejects.toThrow(
        /last active Super Admin/i,
      );
      expect(prisma.user.count).toHaveBeenCalledWith({
        where: { role: 'SUPER_ADMIN', isActive: true, id: { not: 'user-1' } },
      });
    });

    it('allows demotion when another active Super Admin remains', async () => {
      const { prisma, service } = build();
      prisma.user.findUnique.mockResolvedValue({ role: 'SUPER_ADMIN', isActive: true });
      prisma.user.count.mockResolvedValue(1);
      await expect(service.assertSuperAdminRetained('user-1')).resolves.toBeUndefined();
    });

    it('returns early for a user who is not a Super Admin', async () => {
      const { prisma, service } = build();
      prisma.user.findUnique.mockResolvedValue({ role: 'EMPLOYEE', isActive: true });
      await expect(service.assertSuperAdminRetained('user-1')).resolves.toBeUndefined();
      expect(prisma.user.count).not.toHaveBeenCalled();
    });

    it('returns early for an inactive Super Admin', async () => {
      const { prisma, service } = build();
      prisma.user.findUnique.mockResolvedValue({ role: 'SUPER_ADMIN', isActive: false });
      await expect(service.assertSuperAdminRetained('user-1')).resolves.toBeUndefined();
      expect(prisma.user.count).not.toHaveBeenCalled();
    });
  });

  describe('pendingApprovalsFor', () => {
    it("counts a non-admin manager's active direct reports' pending requests", async () => {
      const { prisma, service } = build();
      prisma.user.findUnique.mockResolvedValueOnce({ role: 'MANAGER' });
      prisma.leaveRequest.count.mockResolvedValueOnce(3);

      await expect(service.pendingApprovalsFor('manager-1')).resolves.toBe(3);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'manager-1' },
        select: { role: true },
      });
      expect(prisma.leaveRequest.count).toHaveBeenCalledWith({
        where: { status: 'PENDING', user: { managerId: 'manager-1', isActive: true } },
      });
    });

    it('counts every pending request for an HR_ADMIN target', async () => {
      const { prisma, service } = build();
      prisma.user.findUnique.mockResolvedValueOnce({ role: 'HR_ADMIN' });
      prisma.leaveRequest.count.mockResolvedValueOnce(7);

      await expect(service.pendingApprovalsFor('hr-1')).resolves.toBe(7);
      expect(prisma.leaveRequest.count).toHaveBeenCalledWith({
        where: { status: 'PENDING' },
      });
    });

    it('counts every pending request for a SUPER_ADMIN target', async () => {
      const { prisma, service } = build();
      prisma.user.findUnique.mockResolvedValueOnce({ role: 'SUPER_ADMIN' });
      prisma.leaveRequest.count.mockResolvedValueOnce(11);

      await expect(service.pendingApprovalsFor('super-1')).resolves.toBe(11);
      expect(prisma.leaveRequest.count).toHaveBeenCalledWith({
        where: { status: 'PENDING' },
      });
    });

    it('returns 0 for an unknown target without querying leave requests', async () => {
      const { prisma, service } = build();
      prisma.user.findUnique.mockResolvedValueOnce(null);

      await expect(service.pendingApprovalsFor('missing-user')).resolves.toBe(0);
      expect(prisma.leaveRequest.count).not.toHaveBeenCalled();
    });
  });
});
