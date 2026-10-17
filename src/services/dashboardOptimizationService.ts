import { ActionItem, ActionModuleId } from '../types/zenhr';

/**
 * Authorized RBAC Roles embedded in JWT / Microsoft Entra ID token claims.
 * Decoded synchronously at 0ms on app launch so no unauthorized card or
 * skeleton ever renders.
 */
export type UserRole = 'EMPLOYEE' | 'MANAGER' | 'HR_ADMIN';

export type PermissionClaim =
  | 'attendance:self'
  | 'leaves:self'
  | 'transactions:self'
  | 'documents:self'
  | 'schedule:self'
  | 'tasks:self'
  | 'payroll:self'
  | 'directory:view'
  | 'approvals:manage'
  | 'team_calendar:view'
  | 'celebrations:view'
  | 'events:view'
  | 'gosi_wps:admin';

export type DashboardSectionId =
  | 'balances'
  | 'actions'
  | 'whos_off'
  | 'birthdays'
  | 'events';

export type DashboardHydrationTier =
  | 'TIER_1_CORE'
  | 'TIER_2_ACTIONS'
  | 'TIER_3_FEED';

export interface DashboardSectionDescriptor {
  id: DashboardSectionId;
  tier: DashboardHydrationTier;
  requiredPermission: PermissionClaim;
  /** Simulated backend query latency (ms) on cold start before cache warms */
  simulatedColdLatencyMs: number;
}

export interface RoleMetadata {
  role: UserRole;
  labelEn: string;
  labelAr: string;
  badgeColor: string;
  permissions: PermissionClaim[];
}

export const ROLE_REGISTRY: Record<UserRole, RoleMetadata> = {
  EMPLOYEE: {
    role: 'EMPLOYEE',
    labelEn: 'Employee',
    labelAr: 'موظف',
    badgeColor: '#3B6E9C',
    permissions: [
      'attendance:self',
      'leaves:self',
      'transactions:self',
      'documents:self',
      'schedule:self',
      'tasks:self',
      'payroll:self',
      'celebrations:view',
      'events:view',
    ],
  },
  MANAGER: {
    role: 'MANAGER',
    labelEn: 'Line Manager',
    labelAr: 'مدير مباشر',
    badgeColor: '#FE5800',
    permissions: [
      'attendance:self',
      'leaves:self',
      'transactions:self',
      'documents:self',
      'schedule:self',
      'tasks:self',
      'payroll:self',
      'directory:view',
      'approvals:manage',
      'team_calendar:view',
      'celebrations:view',
      'events:view',
    ],
  },
  HR_ADMIN: {
    role: 'HR_ADMIN',
    labelEn: 'HR Admin',
    labelAr: 'مسؤول الموارد البشرية',
    badgeColor: '#10B981',
    permissions: [
      'attendance:self',
      'leaves:self',
      'transactions:self',
      'documents:self',
      'schedule:self',
      'tasks:self',
      'payroll:self',
      'directory:view',
      'approvals:manage',
      'team_calendar:view',
      'celebrations:view',
      'events:view',
      'gosi_wps:admin',
    ],
  },
};

export const DASHBOARD_SECTION_REGISTRY: DashboardSectionDescriptor[] = [
  {
    id: 'balances',
    tier: 'TIER_1_CORE',
    requiredPermission: 'leaves:self',
    simulatedColdLatencyMs: 220,
  },
  {
    id: 'actions',
    tier: 'TIER_2_ACTIONS',
    requiredPermission: 'attendance:self',
    simulatedColdLatencyMs: 380,
  },
  {
    id: 'whos_off',
    tier: 'TIER_3_FEED',
    requiredPermission: 'team_calendar:view',
    simulatedColdLatencyMs: 650,
  },
  {
    id: 'birthdays',
    tier: 'TIER_3_FEED',
    requiredPermission: 'celebrations:view',
    simulatedColdLatencyMs: 820,
  },
  {
    id: 'events',
    tier: 'TIER_3_FEED',
    requiredPermission: 'events:view',
    simulatedColdLatencyMs: 960,
  },
];

const MODULE_PERMISSION_MAP: Record<ActionModuleId, PermissionClaim> = {
  attendance: 'attendance:self',
  transactions: 'transactions:self',
  payroll: 'payroll:self',
  documents: 'documents:self',
  schedule: 'schedule:self',
  tasks: 'tasks:self',
  approvals: 'approvals:manage',
  directory: 'directory:view',
};

/**
 * Resolves the permission set for a given role synchronously from JWT claims.
 */
export function resolvePermissionsForRole(role: UserRole): PermissionClaim[] {
  return ROLE_REGISTRY[role]?.permissions ?? ROLE_REGISTRY.EMPLOYEE.permissions;
}

/**
 * Filters the dashboard sections by the user's authorized role before any
 * skeleton or card is mounted (prevents unauthorized UI flicker).
 */
export function getAuthorizedDashboardSections(
  role: UserRole
): DashboardSectionDescriptor[] {
  const perms = new Set(resolvePermissionsForRole(role));
  return DASHBOARD_SECTION_REGISTRY.filter((section) =>
    perms.has(section.requiredPermission)
  );
}

/**
 * Filters Quick Action modules according to the user's role permissions.
 * For example, 'EMPLOYEE' does not see 'approvals' or full 'directory'
 * unless granted by 'MANAGER' / 'HR_ADMIN' role claims.
 */
export function filterActionsByRole(
  actions: ActionItem[],
  role: UserRole
): ActionItem[] {
  const perms = new Set(resolvePermissionsForRole(role));
  return actions.filter((action) => {
    const required = MODULE_PERMISSION_MAP[action.id];
    return required ? perms.has(required) : true;
  });
}

/**
 * Lightweight in-memory Stale-While-Revalidate (SWR) cache state tracker.
 * Cold loads show per-section skeletons according to their tier; warm loads
 * render cached data at 0ms and revalidate silently.
 */
export interface SectionHydrationMap {
  balances: boolean;
  actions: boolean;
  whos_off: boolean;
  birthdays: boolean;
  events: boolean;
}

export function createInitialHydrationMap(
  isWarmCache: boolean
): SectionHydrationMap {
  return {
    balances: isWarmCache,
    actions: isWarmCache,
    whos_off: isWarmCache,
    birthdays: isWarmCache,
    events: isWarmCache,
  };
}
