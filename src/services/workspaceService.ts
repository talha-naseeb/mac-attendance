import { UserRole } from './dashboardOptimizationService';

export type WorkspaceType = 'PERSONAL' | 'BUSINESS';

export type WorkspacePlanCode =
  | 'INDIVIDUAL_FREE'
  | 'INDIVIDUAL_PRO'
  | 'BUSINESS_STARTER'
  | 'BUSINESS_GROWTH'
  | 'ENTERPRISE';

export type MembershipRole = 'OWNER' | 'HR_ADMIN' | 'MANAGER' | 'EMPLOYEE';

export interface WorkspaceSummary {
  id: string;
  type: WorkspaceType;
  name: string;
  nameAr?: string | null;
  slug: string;
  country?: string;
  timezone?: string;
  currency?: string;
  planCode: WorkspacePlanCode;
  status?: string;
  leaveApprovalPolicy?: 'MANAGER_ONLY' | 'MANAGER_THEN_HR' | 'HR_ONLY';
}

export interface MembershipSummary {
  id: string;
  role: MembershipRole;
  legacyRole?: string;
  status?: string;
  sessionVersion: number;
  jobTitle?: string | null;
  department?: string | null;
}

export interface WorkspaceEntitlements {
  planCode: WorkspacePlanCode;
  maxSeats: number;
  payroll: boolean;
  sso: boolean;
  audit: boolean;
  multiBranch: boolean;
  reports: boolean;
  claimsVault: boolean;
}

export interface WorkspaceSeatSummary {
  usedSeats: number;
  activeMembers: number;
  pendingInvites: number;
  seatsPurchased: number;
  remainingSeats: number;
  isAtLimit: boolean;
}

export interface WorkspaceListItem {
  workspace: WorkspaceSummary;
  membership: MembershipSummary;
  entitlements: WorkspaceEntitlements;
  seats: WorkspaceSeatSummary;
}

export interface AuthDiscoveryWorkspace {
  id: string;
  name: string;
  type: WorkspaceType;
  ssoRequired: boolean;
  provider: 'GOOGLE' | 'MICROSOFT' | null;
}

export interface AuthDiscoveryResult {
  passwordAllowed: boolean;
  workspaces: AuthDiscoveryWorkspace[];
}

export function mapMembershipRoleToAppRole(role: MembershipRole): UserRole {
  switch (role) {
    case 'OWNER':
      return 'ADMIN';
    case 'HR_ADMIN':
      return 'HR_ADMIN';
    case 'MANAGER':
      return 'MANAGER';
    case 'EMPLOYEE':
    default:
      return 'EMPLOYEE';
  }
}

export function resolveWorkspaceDisplayRole(
  role: MembershipRole,
  workspaceType: WorkspaceType,
  lang: 'en' | 'ar' = 'en',
): string {
  // Per docs/account-model/README.md §4.1, PERSONAL workspaces display "You" instead of "Owner".
  if (workspaceType === 'PERSONAL') {
    return lang === 'ar' ? 'أنت' : 'You';
  }
  if (lang === 'ar') {
    switch (role) {
      case 'OWNER':
        return 'المالك';
      case 'HR_ADMIN':
        return 'مسؤول الموارد البشرية';
      case 'MANAGER':
        return 'مدير';
      case 'EMPLOYEE':
      default:
        return 'موظف';
    }
  }
  switch (role) {
    case 'OWNER':
      return 'Owner';
    case 'HR_ADMIN':
      return 'HR Admin';
    case 'MANAGER':
      return 'Manager';
    case 'EMPLOYEE':
    default:
      return 'Employee';
  }
}

export function formatSeatMeterSummary(
  seats: WorkspaceSeatSummary,
  lang: 'en' | 'ar' = 'en',
): string {
  if (lang === 'ar') {
    return `${seats.usedSeats} / ${seats.seatsPurchased} مقاعد مستخدمة (متبقي ${seats.remainingSeats})`;
  }
  return `${seats.usedSeats} / ${seats.seatsPurchased} seats used (${seats.remainingSeats} left)`;
}

export function canInviteInWorkspace(
  type: WorkspaceType,
  role: MembershipRole,
  seats: WorkspaceSeatSummary,
): { allowed: boolean; reason?: 'PERSONAL_WORKSPACE' | 'INSUFFICIENT_ROLE' | 'SEAT_LIMIT_REACHED' } {
  if (type === 'PERSONAL') {
    return { allowed: false, reason: 'PERSONAL_WORKSPACE' };
  }
  if (role !== 'OWNER' && role !== 'HR_ADMIN') {
    return { allowed: false, reason: 'INSUFFICIENT_ROLE' };
  }
  if (seats.isAtLimit) {
    return { allowed: false, reason: 'SEAT_LIMIT_REACHED' };
  }
  return { allowed: true };
}

export function validateWorkspaceCreationInput(input: {
  type: WorkspaceType;
  name: string;
}): { valid: boolean; error?: string } {
  const trimmed = input.name.trim();
  if (trimmed.length < 2) {
    return { valid: false, error: 'Workspace name must be at least 2 characters.' };
  }
  if (input.type !== 'PERSONAL' && input.type !== 'BUSINESS') {
    return { valid: false, error: 'Select a valid workspace type.' };
  }
  return { valid: true };
}

export function validateInviteTokenInput(token: string): { valid: boolean; error?: string } {
  const trimmed = token.trim();
  if (trimmed.length < 8) {
    return { valid: false, error: 'Invitation token must be at least 8 characters.' };
  }
  return { valid: true };
}
