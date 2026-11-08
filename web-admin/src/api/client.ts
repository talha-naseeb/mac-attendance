import axios, { AxiosError } from 'axios';
import type {
  AdminBranch,
  AdminEmployee,
  AdminLeaveItem,
  LivePunchLog,
} from '../data/mockAdminData';
import {
  clearAdminSession,
  getStoredAdminSession,
  SESSION_EXPIRED_EVENT,
  storeAdminSession,
  type UserSession,
} from './adminSession';
import type { EmployeeApiRecord } from './employeesApi';

export type { UserSession } from './adminSession';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 10000,
});

apiClient.interceptors.request.use((config) => {
  const session = getStoredAdminSession();
  if (session?.token) config.headers.Authorization = `Bearer ${session.token}`;
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    const isSignInAttempt = error.config?.url?.includes('/auth/admin/login');
    const data = error.response?.data as { code?: string } | undefined;
    if (
      !isSignInAttempt &&
      (error.response?.status === 401 ||
        (error.response?.status === 403 && data?.code === 'PASSWORD_CHANGE_REQUIRED'))
    ) {
      clearAdminSession();
      window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
    }
    return Promise.reject(error);
  },
);

interface BackendLoginResponse {
  accessToken: string;
  user: Omit<UserSession['user'], 'role'> & { role: string };
}

export interface PayrollSummary {
  currency: 'SAR';
  totalEmployees: number;
  totals: {
    totalBasicSar: number;
    totalHousingSar: number;
    totalTransportSar: number;
    totalGrossSar: number;
    totalGosiEmployeeSar: number;
    totalGosiEmployerSar: number;
    totalNetDisbursedSar: number;
  };
}

export interface AdminPortalData {
  employees: AdminEmployee[];
  branches: AdminBranch[];
  leaves: AdminLeaveItem[];
  attendance: LivePunchLog[];
  payroll: PayrollSummary;
}

export interface AuditLogActor {
  id: string;
  employeeId: string;
  name: string;
  email: string;
  role: string;
  department: string;
}

export interface AuditLogItem {
  id: string;
  action: string;
  resource: string;
  detailsJson: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
  actor: AuditLogActor | null;
}

export interface PaginatedAuditLogs {
  items: AuditLogItem[];
  page: number;
  pageSize: number;
  maxPages: number;
  total: number;
  windowTotal: number;
  totalPages: number;
}

export interface AuditLogsQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  resource?: string;
  action?: string;
}

export class ApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

function getApiMessage(error: unknown): string {
  if (error instanceof AxiosError) {
    const message = error.response?.data?.message;
    return Array.isArray(message)
      ? message.join(', ')
      : message || 'The server could not complete this request.';
  }
  return 'Unable to reach the Shiftly API. Check that the backend is running.';
}

function assertAdminUser(
  user: BackendLoginResponse['user'],
): asserts user is UserSession['user'] {
  if (
    !user.canAccessWebAdmin ||
    (user.role !== 'HR_ADMIN' && user.role !== 'SUPER_ADMIN')
  ) {
    throw new ApiError(
      'This account is not authorized to access the administration console.',
    );
  }
}

export async function loginAdmin(
  email: string,
  password: string,
): Promise<UserSession> {
  try {
    const { data } = await apiClient.post<BackendLoginResponse>(
      '/auth/admin/login',
      { email, password },
    );
    assertAdminUser(data.user);
    const session: UserSession = { token: data.accessToken, user: data.user };
    storeAdminSession(session);
    return session;
  } catch (error) {
    throw new ApiError(getApiMessage(error));
  }
}

type RawEmployee = EmployeeApiRecord;

interface RawBranch {
  id: string;
  name: string;
  nameAr: string;
  code: string | null;
  city: string;
  address: string | null;
  latitude: number;
  longitude: number;
  geofenceRadiusMeters: number;
  wifiBssids: string[];
  bleBeacons: string[];
  _count: { users: number; attendance: number };
}

interface RawLeave {
  id: string;
  type: string;
  startDate: string;
  endDate: string;
  daysCount: number;
  reason: string | null;
  status: AdminLeaveItem['status'];
  stage?: 'STAGE_1_MANAGER' | 'STAGE_2_HR' | 'COMPLETED';
  routedDirectlyToHr?: boolean;
  isHalfDay?: boolean;
  halfDayPeriod?: 'MORNING' | 'AFTERNOON' | null;
  attachmentUrl?: string | null;
  managerComments?: string | null;
  hrComments?: string | null;
  rejectionReason?: string | null;
  managerReviewedBy?: { firstName: string; lastName: string } | null;
  hrReviewedBy?: { firstName: string; lastName: string } | null;
  createdAt: string;
  user: { employeeId: string; firstName: string; lastName: string; department: string };
}

interface RawAttendance {
  id: string;
  type: 'CHECK_IN' | 'CHECK_OUT';
  timestamp: string;
  distanceToBranch: number | null;
  accuracyMeters: number;
  status: string;
  securityFlags: string[];
  isMockLocation: boolean;
  isDeviceRooted: boolean;
  biometricVerified: boolean;
  wasOfflineSynced: boolean;
  user: { employeeId: string; firstName: string; lastName: string; jobTitle: string };
  branch: { name: string } | null;
}

export function mapEmployee(employee: RawEmployee): AdminEmployee {
  const gross =
    employee.basicSalarySar +
    employee.housingAllowanceSar +
    employee.transportAllowanceSar;
  const contributoryWage = Math.min(
    employee.basicSalarySar + employee.housingAllowanceSar,
    45000,
  );
  const gosiEmployee = employee.isSaudi
    ? Math.round(
        contributoryWage * 0.0975 * 100,
      ) / 100
    : 0;
  const gosiEmployer = employee.isSaudi
    ? Math.round(
        contributoryWage * 0.1175 * 100,
      ) / 100
    : 0;

  return {
    id: employee.id,
    employeeId: employee.employeeId,
    name: `${employee.firstName} ${employee.lastName}`,
    email: employee.email,
    phone: employee.phone || '—',
    jobTitle: employee.jobTitle,
    department: employee.department,
    branchName: employee.branch?.name || 'Unassigned',
    role: employee.role,
    isSaudi: employee.isSaudi,
    nationalOrIqamaId: employee.isSaudi
      ? employee.nationalId || 'Not recorded'
      : employee.iqamaNumber || 'Not recorded',
    basicSalarySar: employee.basicSalarySar,
    housingAllowanceSar: employee.housingAllowanceSar,
    transportAllowanceSar: employee.transportAllowanceSar,
    gosiEmployeeDeductionSar: gosiEmployee,
    gosiEmployerContributionSar: gosiEmployer,
    netSalarySar: gross - gosiEmployee,
    status: !employee.isActive ? 'INACTIVE' : employee.isRemoteAllowed ? 'REMOTE' : 'ACTIVE',
    branchId: employee.branch?.id ?? null,
    managerId: employee.manager?.id ?? null,
    managerName: employee.manager ? `${employee.manager.firstName} ${employee.manager.lastName}` : null,
    isActive: employee.isActive,
    isRemoteAllowed: employee.isRemoteAllowed,
    mustChangePassword: employee.mustChangePassword,
  };
}

function mapBranch(branch: RawBranch): AdminBranch {
  return {
    id: branch.id,
    name: branch.name,
    nameAr: branch.nameAr,
    code: branch.code || '—',
    city: branch.city,
    address: branch.address || '—',
    latitude: branch.latitude,
    longitude: branch.longitude,
    geofenceRadiusMeters: branch.geofenceRadiusMeters,
    activeEmployeesCount: branch._count.users,
    todayPunchesCount: branch._count.attendance,
    wifiBssids: branch.wifiBssids,
    bleBeacons: branch.bleBeacons,
  };
}

function mapLeave(request: RawLeave): AdminLeaveItem {
  return {
    id: request.id,
    employeeName: `${request.user.firstName} ${request.user.lastName}`,
    employeeId: request.user.employeeId,
    department: request.user.department,
    type: request.type,
    startDate: request.startDate.slice(0, 10),
    endDate: request.endDate.slice(0, 10),
    daysCount: request.daysCount,
    reason: request.reason || '—',
    status: request.status,
    stage: request.stage,
    routedDirectlyToHr: request.routedDirectlyToHr,
    isHalfDay: request.isHalfDay,
    halfDayPeriod: request.halfDayPeriod,
    attachmentUrl: request.attachmentUrl,
    managerReviewedByName: request.managerReviewedBy
      ? `${request.managerReviewedBy.firstName} ${request.managerReviewedBy.lastName}`
      : null,
    managerComments: request.managerComments,
    hrComments: request.hrComments,
    rejectionReason: request.rejectionReason,
    teamsNotificationDispatched: true,
    appliedOn: request.createdAt.slice(0, 10),
  };
}

function mapAttendance(record: RawAttendance): LivePunchLog {
  const status =
    record.status === 'VERIFIED'
      ? 'VERIFIED'
      : record.status === 'REJECTED'
        ? 'REJECTED'
        : 'FLAGGED';
  return {
    id: record.id,
    employeeName: `${record.user.firstName} ${record.user.lastName}`,
    employeeId: record.user.employeeId,
    jobTitle: record.user.jobTitle,
    branchName: record.branch?.name || 'Unknown branch',
    type: record.type,
    timestamp: new Date(record.timestamp).toLocaleString('en-SA', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }),
    distanceMeters: Math.round(record.distanceToBranch ?? 0),
    accuracyMeters: record.accuracyMeters,
    status,
    securityFlags: record.securityFlags,
    isMockLocation: record.isMockLocation,
    isDeviceRooted: record.isDeviceRooted,
    biometricVerified: record.biometricVerified,
    wasOfflineSynced: record.wasOfflineSynced,
  };
}

export async function fetchAdminEmployees(): Promise<AdminEmployee[]> {
  try {
    const { data } = await apiClient.get<{ items: RawEmployee[] }>('/employees/admin', {
      params: { status: 'ACTIVE', pageSize: 100 },
    });
    return data.items.map(mapEmployee);
  } catch (error) {
    throw new ApiError(getApiMessage(error));
  }
}

export async function fetchAdminBranches(): Promise<AdminBranch[]> {
  try {
    const { data } = await apiClient.get<RawBranch[]>('/branches/admin');
    return data.map(mapBranch);
  } catch (error) {
    throw new ApiError(getApiMessage(error));
  }
}

export async function fetchAdminLeaves(): Promise<AdminLeaveItem[]> {
  try {
    const { data } = await apiClient.get<RawLeave[]>('/leaves/admin');
    return data.map(mapLeave);
  } catch (error) {
    throw new ApiError(getApiMessage(error));
  }
}

export async function fetchAdminAttendance(): Promise<LivePunchLog[]> {
  try {
    const { data } = await apiClient.get<RawAttendance[]>('/attendance/all?limit=100');
    return data.map(mapAttendance);
  } catch (error) {
    throw new ApiError(getApiMessage(error));
  }
}

export async function fetchAdminPayrollSummary(): Promise<PayrollSummary> {
  try {
    const { data } = await apiClient.get<PayrollSummary>('/payroll/summary');
    return data;
  } catch (error) {
    throw new ApiError(getApiMessage(error));
  }
}

export async function fetchAuditLogs(
  query: AuditLogsQuery = {},
): Promise<PaginatedAuditLogs> {
  try {
    const { data } = await apiClient.get<PaginatedAuditLogs>('/audit-logs', {
      params: {
        page: query.page ?? 1,
        pageSize: query.pageSize ?? 50,
        ...(query.search?.trim() ? { search: query.search.trim() } : {}),
        ...(query.resource && query.resource !== 'ALL' ? { resource: query.resource } : {}),
        ...(query.action && query.action !== 'ALL' ? { action: query.action } : {}),
      },
    });
    return data;
  } catch (error) {
    throw new ApiError(getApiMessage(error));
  }
}

export async function loadAdminPortalData(): Promise<AdminPortalData> {
  const [employees, branches, leaves, attendance, payroll] = await Promise.all([
    fetchAdminEmployees(),
    fetchAdminBranches(),
    fetchAdminLeaves(),
    fetchAdminAttendance(),
    fetchAdminPayrollSummary(),
  ]);
  return {
    employees,
    branches,
    leaves,
    attendance,
    payroll,
  };
}

export async function decideLeave(
  id: string,
  decision: 'APPROVED' | 'REJECTED',
  comments?: string,
  isHrOverride?: boolean,
) {
  try {
    await apiClient.patch(`/leaves/${id}/decision`, {
      decision,
      comments,
      isHrOverride,
    });
  } catch (error) {
    throw new ApiError(getApiMessage(error));
  }
}

export async function saveBranch(
  branch: Omit<
    AdminBranch,
    'id' | 'activeEmployeesCount' | 'todayPunchesCount' | 'wifiBssids' | 'bleBeacons'
  >,
  id?: string,
) {
  const payload = id
    ? {
        name: branch.name,
        latitude: branch.latitude,
        longitude: branch.longitude,
        geofenceRadiusMeters: branch.geofenceRadiusMeters,
      }
    : {
        ...branch,
        nameAr: branch.nameAr || branch.name,
        cityAr: branch.city,
      };
  try {
    if (id) {
      await apiClient.patch(`/branches/${id}`, payload);
    } else {
      await apiClient.post('/branches', payload);
    }
  } catch (error) {
    throw new ApiError(getApiMessage(error));
  }
}

export async function deleteBranch(id: string) {
  try {
    await apiClient.delete(`/branches/${id}`);
  } catch (error) {
    throw new ApiError(getApiMessage(error));
  }
}

export async function downloadWps(month?: string) {
  try {
    const response = await apiClient.get('/payroll/wps-export', {
      params: month ? { month } : undefined,
      responseType: 'blob',
    });
    const url = URL.createObjectURL(response.data as Blob);
    const link = document.createElement('a');
    link.href = url;
    const suffix = month || new Date().toISOString().slice(0, 10);
    link.download = `shiftly_mudad_wps_${suffix}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  } catch (error) {
    throw new ApiError(getApiMessage(error));
  }
}

export interface AttendanceExceptionItem {
  id: string;
  type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  status: 'OPEN' | 'ACCEPTED' | 'ESCALATED';
  detailsJson: any;
  createdAt: string;
  reviewedAt?: string | null;
  reviewNote?: string | null;
  day: {
    dateIso: string;
    mode: string;
    user: { fullName: string; employeeId: string; department: string };
  };
}

export interface RemoteWorkRequestItem {
  id: string;
  startDateIso: string;
  endDateIso: string;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  createdAt: string;
  user: { fullName: string; employeeId: string; department: string };
}

export async function fetchAttendanceExceptions(): Promise<AttendanceExceptionItem[]> {
  try {
    const { data } = await apiClient.get<AttendanceExceptionItem[]>('/attendance/exceptions');
    return data;
  } catch (error) {
    throw new ApiError(getApiMessage(error));
  }
}

export async function reviewAttendanceException(
  id: string,
  decision: 'ACCEPTED' | 'ESCALATED',
  reviewNote?: string,
): Promise<void> {
  try {
    await apiClient.post(`/attendance/exceptions/${id}/review`, { decision, reviewNote });
  } catch (error) {
    throw new ApiError(getApiMessage(error));
  }
}

export async function fetchPendingRemoteRequests(): Promise<RemoteWorkRequestItem[]> {
  try {
    const { data } = await apiClient.get<RemoteWorkRequestItem[]>('/attendance/remote-requests/pending');
    return data;
  } catch (error) {
    throw new ApiError(getApiMessage(error));
  }
}

export async function decideRemoteRequest(
  id: string,
  decision: 'APPROVED' | 'REJECTED',
  rejectionReason?: string,
): Promise<void> {
  try {
    await apiClient.post(`/attendance/remote-requests/${id}/decision`, { decision, rejectionReason });
  } catch (error) {
    throw new ApiError(getApiMessage(error));
  }
}

export interface PayrollRunPayslipItem {
  id: string;
  period: string;
  employee: {
    id: string;
    employeeId: string;
    name: string;
    nationalOrIqamaId?: string | null;
  };
  earnings: {
    basicSalarySar: number;
    housingAllowanceSar: number;
    transportAllowanceSar: number;
    overtimeSar: number;
    adjustmentsSar: number;
    grossSalarySar: number;
  };
  deductions: {
    gosiEmployeeShareSar: number;
    unpaidLeaveDays: number;
    unpaidLeaveDeductionSar: number;
    otherDeductionsSar: number;
    totalDeductionsSar: number;
  };
  netSalarySar: number;
}

export interface PayrollRunRecord {
  id: string;
  period: string;
  status: 'PREPARED' | 'REVIEWED' | 'LOCKED';
  totalEmployees: number;
  totals: PayrollSummary['totals'] & {
    totalUnpaidLeaveSar?: number;
    totalOvertimeSar?: number;
  };
  payslips?: PayrollRunPayslipItem[];
  preparedAt?: string;
  reviewedAt?: string | null;
  lockedAt?: string | null;
}

export interface IntegrationConfigItem {
  id: string;
  provider: 'TEAMS' | 'OUTLOOK' | 'ENTRA_SSO';
  enabled: boolean;
  webhookUrl?: string | null;
  tenantId?: string | null;
  simulateFailure: boolean;
  lastSuccessAt?: string | null;
  lastFailureAt?: string | null;
  lastErrorMessage?: string | null;
}

export async function fetchPayrollRuns(): Promise<PayrollRunRecord[]> {
  try {
    const { data } = await apiClient.get<PayrollRunRecord[]>('/payroll/runs');
    return data;
  } catch (error) {
    throw new ApiError(getApiMessage(error));
  }
}

export async function preparePayrollRunApi(period: string): Promise<PayrollRunRecord> {
  try {
    const { data } = await apiClient.post<PayrollRunRecord>('/payroll/runs', { period });
    return data;
  } catch (error) {
    throw new ApiError(getApiMessage(error));
  }
}

export async function reviewPayrollRunApi(runId: string): Promise<PayrollRunRecord> {
  try {
    const { data } = await apiClient.post<PayrollRunRecord>(`/payroll/runs/${runId}/review`);
    return data;
  } catch (error) {
    throw new ApiError(getApiMessage(error));
  }
}

export async function lockPayrollRunApi(runId: string): Promise<PayrollRunRecord> {
  try {
    const { data } = await apiClient.post<PayrollRunRecord>(`/payroll/runs/${runId}/lock`);
    return data;
  } catch (error) {
    throw new ApiError(getApiMessage(error));
  }
}

export async function fetchIntegrationConfigs(): Promise<{
  configs: IntegrationConfigItem[];
  outboxSummary: Array<{ provider: string; status: string; count: number }>;
}> {
  try {
    const { data } = await apiClient.get('/integrations/admin/configs');
    return data;
  } catch (error) {
    throw new ApiError(getApiMessage(error));
  }
}

export async function toggleIntegrationProvider(
  provider: 'TEAMS' | 'OUTLOOK' | 'ENTRA_SSO',
  enabled: boolean,
): Promise<IntegrationConfigItem> {
  try {
    const { data } = await apiClient.patch<IntegrationConfigItem>(
      `/integrations/admin/configs/${provider}`,
      { enabled },
    );
    return data;
  } catch (error) {
    throw new ApiError(getApiMessage(error));
  }
}

export async function testIntegrationConnection(
  provider: 'TEAMS' | 'OUTLOOK' | 'ENTRA_SSO',
): Promise<{ ok: boolean; status: string; message: string }> {
  try {
    const { data } = await apiClient.post(`/integrations/admin/configs/${provider}/test`);
    return data;
  } catch (error) {
    throw new ApiError(getApiMessage(error));
  }
}

export async function retryFailedIntegrations(): Promise<{
  retriedCount: number;
  deliveredCount: number;
}> {
  try {
    const { data } = await apiClient.post('/integrations/admin/retry-all');
    return data;
  } catch (error) {
    throw new ApiError(getApiMessage(error));
  }
}

