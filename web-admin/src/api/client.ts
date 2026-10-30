import axios, { AxiosError } from 'axios';
import type {
  AdminBranch,
  AdminEmployee,
  AdminLeaveItem,
  LivePunchLog,
} from '../data/mockAdminData';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';
const ADMIN_SESSION_KEY = 'macq_admin_session';

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

export interface UserSession {
  token: string;
  user: {
    id: string;
    employeeId: string;
    firstName: string;
    lastName: string;
    name: string;
    email: string;
    role: 'SUPER_ADMIN' | 'HR_ADMIN';
    department: string;
    jobTitle: string;
    avatarUrl?: string;
    canAccessWebAdmin: boolean;
  };
}

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
  return 'Unable to reach the MacqHR API. Check that the backend is running.';
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
    sessionStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(session));
    return session;
  } catch (error) {
    throw new ApiError(getApiMessage(error));
  }
}

export function getStoredAdminSession(): UserSession | null {
  try {
    const raw = sessionStorage.getItem(ADMIN_SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as UserSession;
    if (!session.token || !session.user) return null;
    assertAdminUser(session.user);
    return session;
  } catch {
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
    return null;
  }
}

export function clearAdminSession() {
  sessionStorage.removeItem(ADMIN_SESSION_KEY);
}

interface RawEmployee {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  jobTitle: string;
  department: string;
  role: AdminEmployee['role'];
  isSaudi: boolean;
  nationalId: string | null;
  iqamaNumber: string | null;
  basicSalarySar: number;
  housingAllowanceSar: number;
  transportAllowanceSar: number;
  isRemoteAllowed: boolean;
  branch: { name: string } | null;
}

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

function mapEmployee(employee: RawEmployee): AdminEmployee {
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
    status: employee.isRemoteAllowed ? 'REMOTE' : 'ACTIVE',
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

export async function loadAdminPortalData(): Promise<AdminPortalData> {
  try {
    const [employeesResponse, branchesResponse, leavesResponse, attendanceResponse, payrollResponse] =
      await Promise.all([
        apiClient.get<RawEmployee[]>('/employees/admin'),
        apiClient.get<RawBranch[]>('/branches/admin'),
        apiClient.get<RawLeave[]>('/leaves/admin'),
        apiClient.get<RawAttendance[]>('/attendance/all?limit=100'),
        apiClient.get<PayrollSummary>('/payroll/summary'),
      ]);
    return {
      employees: employeesResponse.data.map(mapEmployee),
      branches: branchesResponse.data.map(mapBranch),
      leaves: leavesResponse.data.map(mapLeave),
      attendance: attendanceResponse.data.map(mapAttendance),
      payroll: payrollResponse.data,
    };
  } catch (error) {
    throw new ApiError(getApiMessage(error));
  }
}

export async function decideLeave(
  id: string,
  decision: 'APPROVED' | 'REJECTED',
) {
  try {
    await apiClient.patch(`/leaves/${id}/decision`, { decision });
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

export async function downloadWps() {
  try {
    const response = await apiClient.get('/payroll/wps-export', {
      responseType: 'blob',
    });
    const url = URL.createObjectURL(response.data as Blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `macqhr_mudad_wps_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  } catch (error) {
    throw new ApiError(getApiMessage(error));
  }
}
