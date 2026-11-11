import { AxiosError } from 'axios';
import {
  AdminMembershipSummary,
  AdminWorkspaceEntitlements,
  AdminWorkspaceSummary,
  getStoredAdminSession,
  storeAdminSession,
  UserSession,
} from './adminSession';
import { apiClient, ApiError } from './client';

export type WorkspaceMemberRole = 'OWNER' | 'HR_ADMIN' | 'MANAGER' | 'EMPLOYEE';
export type WorkspaceMemberStatus = 'INVITED' | 'ACTIVE' | 'SUSPENDED';

export interface WorkspaceSeatSummary {
  usedSeats: number;
  activeMembers: number;
  pendingInvites: number;
  seatsPurchased: number;
  remainingSeats: number;
  isAtLimit: boolean;
}

export interface WorkspaceListItem {
  workspace: AdminWorkspaceSummary;
  membership: AdminMembershipSummary & {
    legacyRole?: string;
    status?: string;
    jobTitle?: string | null;
    department?: string | null;
  };
  entitlements: AdminWorkspaceEntitlements;
  seats: WorkspaceSeatSummary;
}

export interface WorkspaceMemberRecord {
  id: string;
  workspaceId: string;
  userId: string;
  role: WorkspaceMemberRole;
  status: WorkspaceMemberStatus;
  employeeId?: string | null;
  jobTitle?: string | null;
  department?: string | null;
  isRemoteAllowed: boolean;
  reportsToMembershipId?: string | null;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    fullName?: string | null;
  };
  reportsTo?: {
    id: string;
    role: WorkspaceMemberRole;
    user: { firstName: string; lastName: string; fullName?: string | null };
  } | null;
}

export interface WorkspaceInviteRecord {
  id: string;
  workspaceId: string;
  email: string;
  role: WorkspaceMemberRole;
  jobTitle?: string | null;
  department?: string | null;
  reportsToMembershipId?: string | null;
  expiresAt: string;
  acceptedAt?: string | null;
  revokedAt?: string | null;
  createdAt: string;
}

export interface WorkspaceSsoConfigResponse {
  connection: {
    workspaceId: string;
    provider: 'GOOGLE' | 'MICROSOFT';
    domain?: string | null;
    tenantId?: string | null;
    clientId?: string | null;
    clientSecretMasked?: string | null;
    enforced: boolean;
    autoProvision: boolean;
    allowHrGroupMapping: boolean;
    defaultRole: WorkspaceMemberRole;
    status: 'NOT_CONFIGURED' | 'DRAFT' | 'VERIFIED' | 'ERROR';
  };
  groupMappings: Array<{
    id?: string;
    providerGroupId: string;
    providerGroupName: string;
    role: WorkspaceMemberRole;
  }>;
}

export interface AuthDiscoveryResult {
  passwordAllowed: boolean;
  workspaces: Array<{
    id: string;
    name: string;
    type: 'PERSONAL' | 'BUSINESS';
    ssoRequired: boolean;
    provider: 'GOOGLE' | 'MICROSOFT' | null;
  }>;
}

function getWorkspaceApiError(error: unknown): string {
  if (error instanceof AxiosError) {
    const message = error.response?.data?.message;
    return Array.isArray(message)
      ? message.join(', ')
      : message || 'The workspace request could not be completed.';
  }
  return 'Unable to reach the Shiftly API.';
}

export function resolveAdminRoleFromMembership(
  membershipRole?: WorkspaceMemberRole,
): 'SUPER_ADMIN' | 'HR_ADMIN' | null {
  if (membershipRole === 'OWNER') return 'SUPER_ADMIN';
  if (membershipRole === 'HR_ADMIN') return 'HR_ADMIN';
  return null;
}

export function formatWorkspaceRoleLabel(
  role: WorkspaceMemberRole,
  workspaceType: 'PERSONAL' | 'BUSINESS',
  isArabic = false,
): string {
  if (workspaceType === 'PERSONAL') {
    return isArabic ? 'أنت' : 'You';
  }
  if (isArabic) {
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

export async function discoverAdminAuth(email: string): Promise<AuthDiscoveryResult> {
  try {
    const { data } = await apiClient.post<AuthDiscoveryResult>('/auth/discover', {
      email: email.trim().toLowerCase(),
    });
    return data;
  } catch (error) {
    throw new ApiError(getWorkspaceApiError(error));
  }
}

export async function registerAdminWorkspace(payload: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  workspaceName: string;
}): Promise<UserSession> {
  try {
    const { data } = await apiClient.post<{
      accessToken: string;
      user: UserSession['user'];
      workspace: AdminWorkspaceSummary;
      membership: AdminMembershipSummary;
      entitlements: AdminWorkspaceEntitlements;
    }>('/auth/register', {
      ...payload,
      workspaceType: 'BUSINESS',
    });
    const session: UserSession = {
      token: data.accessToken,
      user: data.user,
      workspace: data.workspace,
      membership: data.membership,
      entitlements: data.entitlements,
    };
    storeAdminSession(session);
    return session;
  } catch (error) {
    throw new ApiError(getWorkspaceApiError(error));
  }
}

export async function fetchMyWorkspaces(): Promise<WorkspaceListItem[]> {
  try {
    const { data } = await apiClient.get<WorkspaceListItem[]>('/workspaces');
    return data;
  } catch (error) {
    throw new ApiError(getWorkspaceApiError(error));
  }
}

export async function fetchCurrentWorkspace(): Promise<WorkspaceListItem> {
  try {
    const { data } = await apiClient.get<WorkspaceListItem>('/workspaces/current');
    return data;
  } catch (error) {
    throw new ApiError(getWorkspaceApiError(error));
  }
}

export async function createWorkspace(payload: {
  type: 'PERSONAL' | 'BUSINESS';
  name: string;
  nameAr?: string;
  country?: string;
  timezone?: string;
  currency?: string;
  planCode?: AdminWorkspaceSummary['planCode'];
  leaveApprovalPolicy?: AdminWorkspaceSummary['leaveApprovalPolicy'];
}): Promise<{
  workspace: AdminWorkspaceSummary;
  membership: AdminMembershipSummary;
  entitlements: AdminWorkspaceEntitlements;
}> {
  try {
    const { data } = await apiClient.post('/workspaces', payload);
    return data;
  } catch (error) {
    throw new ApiError(getWorkspaceApiError(error));
  }
}

export async function switchAdminWorkspace(workspaceId: string): Promise<UserSession> {
  try {
    const { data } = await apiClient.post<{
      accessToken: string;
      user: UserSession['user'];
      workspace: AdminWorkspaceSummary;
      membership: AdminMembershipSummary;
      entitlements: AdminWorkspaceEntitlements;
    }>(`/workspaces/${encodeURIComponent(workspaceId)}/switch`);

    const previous = getStoredAdminSession();
    const mappedRole =
      resolveAdminRoleFromMembership(data.membership?.role) ??
      previous?.user.role ??
      'HR_ADMIN';

    const nextSession: UserSession = {
      token: data.accessToken,
      user: {
        ...(previous?.user ?? data.user),
        ...data.user,
        role: mappedRole,
        canAccessWebAdmin:
          data.membership?.role === 'OWNER' || data.membership?.role === 'HR_ADMIN'
            ? true
            : Boolean(data.user.canAccessWebAdmin),
      },
      workspace: data.workspace,
      membership: data.membership,
      entitlements: data.entitlements,
    };
    storeAdminSession(nextSession);
    return nextSession;
  } catch (error) {
    throw new ApiError(getWorkspaceApiError(error));
  }
}

export async function convertPersonalWorkspaceToBusiness(
  workspaceId: string,
  payload: {
    name: string;
    planCode?: AdminWorkspaceSummary['planCode'];
    seatsPurchased?: number;
  },
) {
  try {
    const { data } = await apiClient.post(
      `/workspaces/${encodeURIComponent(workspaceId)}/convert-business`,
      payload,
    );
    return data;
  } catch (error) {
    throw new ApiError(getWorkspaceApiError(error));
  }
}

export async function updateCurrentWorkspace(payload: {
  name?: string;
  nameAr?: string;
  country?: string;
  timezone?: string;
  currency?: string;
  leaveApprovalPolicy?: AdminWorkspaceSummary['leaveApprovalPolicy'];
  planCode?: AdminWorkspaceSummary['planCode'];
  seatsPurchased?: number;
}) {
  try {
    const { data } = await apiClient.patch('/workspaces/current', payload);
    return data;
  } catch (error) {
    throw new ApiError(getWorkspaceApiError(error));
  }
}

export async function fetchWorkspaceMembers(): Promise<WorkspaceMemberRecord[]> {
  try {
    const { data } = await apiClient.get<WorkspaceMemberRecord[]>('/workspaces/current/members');
    return data;
  } catch (error) {
    throw new ApiError(getWorkspaceApiError(error));
  }
}

export async function updateWorkspaceMember(
  membershipId: string,
  payload: {
    role?: WorkspaceMemberRole;
    status?: WorkspaceMemberStatus;
    reportsToMembershipId?: string | null;
    isRemoteAllowed?: boolean;
  },
) {
  try {
    const { data } = await apiClient.patch(
      `/workspaces/current/members/${encodeURIComponent(membershipId)}`,
      payload,
    );
    return data;
  } catch (error) {
    throw new ApiError(getWorkspaceApiError(error));
  }
}

export async function fetchWorkspaceInvites(): Promise<WorkspaceInviteRecord[]> {
  try {
    const { data } = await apiClient.get<WorkspaceInviteRecord[]>('/workspaces/current/invites');
    return data;
  } catch (error) {
    throw new ApiError(getWorkspaceApiError(error));
  }
}

export async function createWorkspaceInvite(payload: {
  email: string;
  role?: WorkspaceMemberRole;
  jobTitle?: string;
  department?: string;
  reportsToMembershipId?: string;
}): Promise<{ invite: WorkspaceInviteRecord; inviteToken: string }> {
  try {
    const { data } = await apiClient.post('/workspaces/current/invites', payload);
    return data;
  } catch (error) {
    throw new ApiError(getWorkspaceApiError(error));
  }
}

export async function revokeWorkspaceInvite(inviteId: string) {
  try {
    const { data } = await apiClient.delete(
      `/workspaces/current/invites/${encodeURIComponent(inviteId)}`,
    );
    return data;
  } catch (error) {
    throw new ApiError(getWorkspaceApiError(error));
  }
}

export async function acceptWorkspaceInvite(token: string) {
  try {
    const { data } = await apiClient.post('/workspaces/invites/accept', {
      token: token.trim(),
    });
    return data;
  } catch (error) {
    throw new ApiError(getWorkspaceApiError(error));
  }
}

export async function fetchWorkspaceSso(): Promise<WorkspaceSsoConfigResponse> {
  try {
    const { data } = await apiClient.get<WorkspaceSsoConfigResponse>('/workspaces/current/sso');
    return data;
  } catch (error) {
    throw new ApiError(getWorkspaceApiError(error));
  }
}

export async function upsertWorkspaceSso(payload: {
  provider: 'GOOGLE' | 'MICROSOFT';
  domain?: string;
  tenantId?: string;
  clientId?: string;
  clientSecret?: string;
  enforced?: boolean;
  autoProvision?: boolean;
  allowHrGroupMapping?: boolean;
  defaultRole?: WorkspaceMemberRole;
  status?: 'NOT_CONFIGURED' | 'DRAFT' | 'VERIFIED' | 'ERROR';
}) {
  try {
    const { data } = await apiClient.put('/workspaces/current/sso', payload);
    return data;
  } catch (error) {
    throw new ApiError(getWorkspaceApiError(error));
  }
}

export async function upsertWorkspaceSsoGroupMappings(
  mappings: Array<{
    providerGroupId: string;
    providerGroupName: string;
    role: WorkspaceMemberRole;
  }>,
) {
  try {
    const { data } = await apiClient.put('/workspaces/current/sso/group-mappings', {
      mappings,
    });
    return data;
  } catch (error) {
    throw new ApiError(getWorkspaceApiError(error));
  }
}
