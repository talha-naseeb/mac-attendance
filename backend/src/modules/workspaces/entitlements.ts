import { MembershipRole, UserRole, WorkspacePlanCode } from '@prisma/client';

export interface WorkspaceEntitlements {
  planCode: WorkspacePlanCode;
  maxSeats: number;
  payroll: boolean;
  sso: boolean;
  directorySync: boolean;
  auditLog: boolean;
  apiAccess: boolean;
  teamApprovals: boolean;
  customBranding: boolean;
}

const PLAN_ENTITLEMENTS: Record<WorkspacePlanCode, WorkspaceEntitlements> = {
  [WorkspacePlanCode.INDIVIDUAL_FREE]: {
    planCode: WorkspacePlanCode.INDIVIDUAL_FREE,
    maxSeats: 1,
    payroll: false,
    sso: false,
    directorySync: false,
    auditLog: false,
    apiAccess: false,
    teamApprovals: false,
    customBranding: false,
  },
  [WorkspacePlanCode.INDIVIDUAL_PRO]: {
    planCode: WorkspacePlanCode.INDIVIDUAL_PRO,
    maxSeats: 1,
    payroll: false,
    sso: false,
    directorySync: false,
    auditLog: false,
    apiAccess: true,
    teamApprovals: false,
    customBranding: false,
  },
  [WorkspacePlanCode.BUSINESS_STARTER]: {
    planCode: WorkspacePlanCode.BUSINESS_STARTER,
    maxSeats: 10,
    payroll: false,
    sso: false,
    directorySync: false,
    auditLog: false,
    apiAccess: false,
    teamApprovals: true,
    customBranding: false,
  },
  [WorkspacePlanCode.BUSINESS_GROWTH]: {
    planCode: WorkspacePlanCode.BUSINESS_GROWTH,
    maxSeats: 50,
    payroll: true,
    sso: true,
    directorySync: false,
    auditLog: true,
    apiAccess: true,
    teamApprovals: true,
    customBranding: false,
  },
  [WorkspacePlanCode.ENTERPRISE]: {
    planCode: WorkspacePlanCode.ENTERPRISE,
    maxSeats: 10000,
    payroll: true,
    sso: true,
    directorySync: true,
    auditLog: true,
    apiAccess: true,
    teamApprovals: true,
    customBranding: true,
  },
};

export function getEntitlementsForPlan(
  planCode: WorkspacePlanCode,
  seatsPurchasedOverride?: number | null,
): WorkspaceEntitlements {
  const base = PLAN_ENTITLEMENTS[planCode] ?? PLAN_ENTITLEMENTS[WorkspacePlanCode.INDIVIDUAL_FREE];
  if (
    typeof seatsPurchasedOverride === 'number' &&
    seatsPurchasedOverride > 0 &&
    (planCode === WorkspacePlanCode.ENTERPRISE ||
      planCode === WorkspacePlanCode.BUSINESS_GROWTH ||
      planCode === WorkspacePlanCode.BUSINESS_STARTER)
  ) {
    return { ...base, maxSeats: seatsPurchasedOverride };
  }
  return { ...base };
}

export function mapUserRoleToMembershipRole(role: UserRole): MembershipRole {
  switch (role) {
    case UserRole.SUPER_ADMIN:
      return MembershipRole.OWNER;
    case UserRole.HR_ADMIN:
      return MembershipRole.HR_ADMIN;
    case UserRole.MANAGER:
      return MembershipRole.MANAGER;
    case UserRole.EMPLOYEE:
    default:
      return MembershipRole.EMPLOYEE;
  }
}

export function mapMembershipRoleToUserRole(role: MembershipRole): UserRole {
  switch (role) {
    case MembershipRole.OWNER:
      return UserRole.SUPER_ADMIN;
    case MembershipRole.HR_ADMIN:
      return UserRole.HR_ADMIN;
    case MembershipRole.MANAGER:
      return UserRole.MANAGER;
    case MembershipRole.EMPLOYEE:
    default:
      return UserRole.EMPLOYEE;
  }
}

export function slugifyWorkspaceName(name: string): string {
  const cleaned = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return cleaned || 'workspace';
}
