import { BadRequestException, ForbiddenException } from '@nestjs/common';
import {
  MembershipRole,
  MembershipStatus,
  UserRole,
  WorkspacePlanCode,
  WorkspaceType,
} from '@prisma/client';
import {
  getEntitlementsForPlan,
  mapMembershipRoleToUserRole,
  mapUserRoleToMembershipRole,
  slugifyWorkspaceName,
} from './entitlements';
import { WorkspacesService } from './workspaces.service';

function buildService() {
  const prisma = {
    user: { findUnique: jest.fn(), findMany: jest.fn() },
    workspace: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    membership: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
    },
    invite: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    ssoConnection: { findUnique: jest.fn(), upsert: jest.fn() },
    ssoGroupMapping: { findMany: jest.fn(), deleteMany: jest.fn(), createMany: jest.fn() },
    subscription: { upsert: jest.fn() },
    authSession: { updateMany: jest.fn() },
    $transaction: jest.fn(async (cb: (tx: unknown) => unknown) => cb(prisma)),
  };
  const audit = { record: jest.fn() };
  const service = new WorkspacesService(prisma as any, audit as any);
  return { prisma, audit, service };
}

describe('Phase 13 entitlements & role mappings', () => {
  it('computes plan entitlements accurately and supports seat overrides for business/enterprise', () => {
    const free = getEntitlementsForPlan(WorkspacePlanCode.INDIVIDUAL_FREE);
    expect(free.maxSeats).toBe(1);
    expect(free.payroll).toBe(false);
    expect(free.sso).toBe(false);

    const growth = getEntitlementsForPlan(WorkspacePlanCode.BUSINESS_GROWTH);
    expect(growth.maxSeats).toBe(50);
    expect(growth.payroll).toBe(true);
    expect(growth.sso).toBe(true);
    expect(growth.directorySync).toBe(false);

    const entCustom = getEntitlementsForPlan(WorkspacePlanCode.ENTERPRISE, 500);
    expect(entCustom.maxSeats).toBe(500);
    expect(entCustom.directorySync).toBe(true);
  });

  it('maps UserRole <-> MembershipRole symmetrically', () => {
    expect(mapUserRoleToMembershipRole(UserRole.SUPER_ADMIN)).toBe(MembershipRole.OWNER);
    expect(mapUserRoleToMembershipRole(UserRole.HR_ADMIN)).toBe(MembershipRole.HR_ADMIN);
    expect(mapMembershipRoleToUserRole(MembershipRole.OWNER)).toBe(UserRole.SUPER_ADMIN);
    expect(slugifyWorkspaceName('  Macquires Saudi LLC! ')).toBe('macquires-saudi-llc');
  });
});

describe('WorkspacesService', () => {
  it('blocks invites on PERSONAL workspaces with PLAN_SEAT_LIMIT', async () => {
    const { prisma, service } = buildService();
    prisma.membership.findUnique.mockResolvedValue({
      id: 'mem-owner',
      workspaceId: 'ws-1',
      userId: 'user-1',
      role: MembershipRole.OWNER,
      status: MembershipStatus.ACTIVE,
    });
    prisma.workspace.findUnique.mockResolvedValue({
      id: 'ws-1',
      type: WorkspaceType.PERSONAL,
      planCode: WorkspacePlanCode.INDIVIDUAL_FREE,
    });

    await expect(
      service.createInvite('ws-1', 'user-1', { email: 'friend@example.com' }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('blocks invites when seats are at the plan limit', async () => {
    const { prisma, service } = buildService();
    prisma.membership.findUnique.mockResolvedValue({
      id: 'mem-owner',
      workspaceId: 'ws-1',
      userId: 'user-1',
      role: MembershipRole.OWNER,
      status: MembershipStatus.ACTIVE,
    });
    prisma.workspace.findUnique.mockResolvedValue({
      id: 'ws-1',
      type: WorkspaceType.BUSINESS,
      planCode: WorkspacePlanCode.BUSINESS_STARTER,
      subscription: { seatsPurchased: 10 },
    });
    prisma.membership.count.mockResolvedValue(9);
    prisma.invite.count.mockResolvedValue(1);

    await expect(
      service.createInvite('ws-1', 'user-1', { email: 'eleventh@company.com' }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('prevents HR_ADMIN from granting OWNER or HR_ADMIN roles', async () => {
    const { prisma, service } = buildService();
    prisma.membership.findUnique.mockResolvedValue({
      id: 'mem-hr',
      workspaceId: 'ws-1',
      userId: 'user-hr',
      role: MembershipRole.HR_ADMIN,
      status: MembershipStatus.ACTIVE,
    });
    prisma.membership.findFirst.mockResolvedValue({
      id: 'mem-emp',
      workspaceId: 'ws-1',
      userId: 'user-emp',
      role: MembershipRole.EMPLOYEE,
      status: MembershipStatus.ACTIVE,
    });

    await expect(
      service.updateMember('ws-1', 'mem-emp', 'user-hr', { role: MembershipRole.OWNER }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('protects the last active OWNER from demotion or suspension', async () => {
    const { prisma, service } = buildService();
    prisma.membership.findUnique.mockResolvedValue({
      id: 'mem-owner',
      workspaceId: 'ws-1',
      userId: 'user-owner',
      role: MembershipRole.OWNER,
      status: MembershipStatus.ACTIVE,
    });
    prisma.membership.findFirst.mockResolvedValue({
      id: 'mem-owner',
      workspaceId: 'ws-1',
      userId: 'user-owner',
      role: MembershipRole.OWNER,
      status: MembershipStatus.ACTIVE,
    });
    prisma.membership.count.mockResolvedValue(0);

    await expect(
      service.updateMember('ws-1', 'mem-owner', 'user-owner', { role: MembershipRole.EMPLOYEE }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects SSO group mapping to OWNER and requires opt-in for HR_ADMIN', async () => {
    const { prisma, service } = buildService();
    prisma.membership.findUnique.mockResolvedValue({
      id: 'mem-owner',
      workspaceId: 'ws-1',
      userId: 'user-owner',
      role: MembershipRole.OWNER,
      status: MembershipStatus.ACTIVE,
    });
    prisma.ssoConnection.findUnique.mockResolvedValue({
      id: 'sso-1',
      workspaceId: 'ws-1',
      allowHrGroupMapping: false,
    });

    await expect(
      service.upsertGroupMappings('ws-1', 'user-owner', {
        mappings: [
          {
            providerGroupId: 'grp-1',
            providerGroupName: 'Owners',
            role: MembershipRole.OWNER,
          },
        ],
      }),
    ).rejects.toThrow(BadRequestException);

    await expect(
      service.upsertGroupMappings('ws-1', 'user-owner', {
        mappings: [
          {
            providerGroupId: 'grp-2',
            providerGroupName: 'HR',
            role: MembershipRole.HR_ADMIN,
          },
        ],
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
