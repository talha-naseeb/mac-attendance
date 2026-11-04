import { EditableEmployeeProfile, deriveAvatarInitials } from './profileSettingsService';
import { UserRole } from './dashboardOptimizationService';
import { MACQUIRES_PALETTE } from '../theme/colors';
import {
  notifySessionExpired,
  refreshStoredSessionOutcome,
} from './sessionManager';
import {
  ApprovalItem,
  AttendanceRecord,
  DirectoryEmployee,
  LeaveBalance,
  LeaveType,
  SalarySlip,
  WhosOffEntry,
} from '../types/zenhr';

declare const process: {
  env: {
    EXPO_PUBLIC_API_BASE_URL?: string;
  };
};

export const API_BASE_URL = (
  process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:4000/api'
).replace(/\/$/, '');

export interface BackendUser {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  phone?: string | null;
  role: string;
  department: string;
  jobTitle: string;
  avatarUrl?: string | null;
  canAccessWebAdmin: boolean;
  branch?: { id: string; name: string; nameAr?: string | null } | null;
  manager?: { firstName: string; lastName: string } | null;
  fullNameAr?: string;
  titleAr?: string | null;
  departmentAr?: string | null;
  nationalId?: string | null;
  iqamaNumber?: string | null;
  avatarInitials?: string;
  avatarPresetId?: string;
  avatarColor?: string;
  createdAt?: string;
  isRemoteAllowed?: boolean;
  mustChangePassword?: boolean;
}

interface BackendLoginResponse {
  accessToken: string;
  refreshToken: string;
  user: BackendUser;
}

export interface ApiAuthSession {
  token: string;
  refreshToken?: string;
  role: UserRole;
  profile: EditableEmployeeProfile;
  branchId?: string;
  isRemoteAllowed: boolean;
  mustChangePassword?: boolean;
}

export class BackendApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BackendApiError';
  }
}

function toAppRole(role: string): UserRole {
  if (role === 'SUPER_ADMIN') return 'ADMIN';
  if (role === 'HR_ADMIN' || role === 'MANAGER' || role === 'EMPLOYEE') return role;
  return 'EMPLOYEE';
}

function toProfile(user: BackendUser): EditableEmployeeProfile {
  const fullName = user.name || `${user.firstName} ${user.lastName}`;
  const avatarPresetId = ['navy', 'orange', 'indigo', 'bdazzled', 'dark'].includes(
    user.avatarPresetId || '',
  )
    ? (user.avatarPresetId as EditableEmployeeProfile['avatarPresetId'])
    : 'navy';
  return {
    id: user.id,
    firstName: user.firstName,
    firstNameAr: user.fullNameAr?.split(' ')[0] || user.firstName,
    fullName,
    fullNameAr: user.fullNameAr || fullName,
    title: user.jobTitle,
    titleAr: user.titleAr || user.jobTitle,
    department: user.department,
    departmentAr: user.departmentAr || user.department,
    branch: user.branch?.name || 'Unassigned',
    email: user.email,
    phone: user.phone || '',
    manager: user.manager ? `${user.manager.firstName} ${user.manager.lastName}` : '',
    joinDate: user.createdAt ? formatDate(user.createdAt) : '',
    gosiNumber: user.nationalId || user.iqamaNumber || '',
    iban: '',
    avatarInitials: user.avatarInitials || deriveAvatarInitials(fullName),
    avatarPresetId,
    avatarColor: user.avatarColor || MACQUIRES_PALETTE.prussianBlue,
  };
}

function formatDate(value: string | Date): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatTime(value: string | Date | null | undefined): string {
  if (!value) return '--:--';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '--:--'
    : date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function mapLeaveType(type: string): LeaveType {
  switch (type) {
    case 'SICK':
    case 'SICK_LEAVE':
      return 'Sick Day off';
    case 'REMOTE_WORK':
      return 'Remote Work';
    case 'UNPAID':
    case 'UNPAID_LEAVE':
      return 'Unpaid Leave';
    default:
      return 'Annual Vacation';
  }
}

interface RawLeaveBalance {
  id: string;
  leaveType: string;
  totalDays: number;
  usedDays: number;
  remainingDays: number;
}

interface RawLeaveRequest {
  id: string;
  type: string;
  startDate: string;
  endDate: string;
  daysCount: number;
  reason?: string | null;
  status: string;
  user?: {
    id?: string;
    employeeId?: string;
    firstName: string;
    lastName: string;
    jobTitle?: string;
    avatarUrl?: string | null;
  };
}

interface RawAttendanceRecord {
  id: string;
  type: 'CHECK_IN' | 'CHECK_OUT';
  timestamp: string;
  dateIso?: string | null;
}

interface RawTeamAttendance {
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    jobTitle: string;
  };
  status: string;
  checkInTime: string | null;
  checkOutTime: string | null;
}

interface RawDirectoryEmployee {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  jobTitle: string;
  department: string;
  avatarUrl: string | null;
  branch: { name: string } | null;
  presenceStatus: 'OFFLINE' | 'PRESENT_ON_SITE' | 'CHECKED_OUT' | 'ON_LEAVE';
}

interface RawWhosOff {
  id: string;
  employee: {
    id?: string;
    firstName: string;
    lastName: string;
    jobTitle?: string;
  };
  leaveType: string;
  startDate: string;
  endDate: string;
  daysCount: number;
}

interface RawPayslip {
  period: string;
  earnings: {
    basicSalarySar: number;
    housingAllowanceSar: number;
    transportAllowanceSar: number;
  };
  deductions: { gosiEmployeeShareSar: number };
  netSalarySar: number;
}

export interface MobileApiData {
  leaveBalances: LeaveBalance[];
  approvals: ApprovalItem[];
  myAttendance: AttendanceRecord[];
  subordinatesAttendance: AttendanceRecord[];
  whosOff: WhosOffEntry[];
  directory: DirectoryEmployee[];
  salarySlips: SalarySlip[];
}

function mapBalances(balances: RawLeaveBalance[]): LeaveBalance[] {
  const colors = [
    MACQUIRES_PALETTE.prussianBlue,
    MACQUIRES_PALETTE.orangePantone,
    MACQUIRES_PALETTE.indigoDye,
    MACQUIRES_PALETTE.bdazzledBlue,
  ];
  return balances.map((balance, index) => ({
    id: balance.id,
    title: mapLeaveType(balance.leaveType),
    remaining: balance.remainingDays,
    total: balance.totalDays,
    unit: 'days',
    accentColor: colors[index % colors.length],
  }));
}

function mapApprovals(requests: RawLeaveRequest[]): ApprovalItem[] {
  return requests.map((request) => {
    const employeeName = request.user
      ? `${request.user.firstName} ${request.user.lastName}`
      : 'Employee';
    const leaveType = mapLeaveType(request.type);
    const status = request.status === 'APPROVED'
      ? 'Approved'
      : request.status === 'REJECTED'
        ? 'Rejected'
        : 'Pending';
    return {
      id: request.id,
      employeeName,
      role: request.user?.jobTitle || 'Employee',
      avatarInitials: deriveAvatarInitials(employeeName),
      avatarColor: MACQUIRES_PALETTE.prussianBlue,
      category: 'Time Off',
      headline: `${request.daysCount} days`,
      subHeadline: leaveType,
      status,
      stage: status === 'Pending' ? 'PENDING_MANAGER' : status.toUpperCase() as 'APPROVED' | 'REJECTED',
      leaveType,
      startDate: formatDate(request.startDate),
      endDate: formatDate(request.endDate),
      daysCount: request.daysCount,
      notes: request.reason || undefined,
      employeeId: request.user?.employeeId,
    };
  });
}

function mapAttendance(records: RawAttendanceRecord[]): AttendanceRecord[] {
  const byDay = new Map<string, RawAttendanceRecord[]>();
  for (const record of records) {
    const day = record.dateIso || new Date(record.timestamp).toISOString().slice(0, 10);
    const existing = byDay.get(day) || [];
    existing.push(record);
    byDay.set(day, existing);
  }
  return [...byDay.entries()].sort(([a], [b]) => b.localeCompare(a)).map(([day, dayRecords]) => {
    const checkIn = dayRecords.find((record) => record.type === 'CHECK_IN');
    const checkOut = [...dayRecords].reverse().find((record) => record.type === 'CHECK_OUT');
    const start = checkIn ? new Date(checkIn.timestamp).getTime() : 0;
    const end = checkOut ? new Date(checkOut.timestamp).getTime() : start;
    const minutes = checkIn && checkOut ? Math.max(0, Math.round((end - start) / 60000)) : 0;
    const date = new Date(`${day}T00:00:00`);
    return {
      id: checkIn?.id || checkOut?.id || day,
      dayNumber: day.slice(8, 10),
      monthYear: date.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }),
      workingHoursLabel: `${Math.floor(minutes / 60)} hours${minutes % 60 ? ` ${minutes % 60} mins` : ''}`,
      status: checkIn && checkOut ? 'Complete' : 'Incomplete',
      shiftInterval: '09:00 AM - 05:00 PM',
      clockIn: formatTime(checkIn?.timestamp),
      clockOut: formatTime(checkOut?.timestamp),
    };
  });
}

function mapTeamAttendance(records: RawTeamAttendance[]): AttendanceRecord[] {
  return records.map((record) => ({
    id: record.employee.id,
    dayNumber: new Date().toLocaleDateString('en-GB', { day: '2-digit' }),
    monthYear: new Date().toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }),
    workingHoursLabel: record.checkInTime && record.checkOutTime ? 'Complete' : 'Active shift',
    status: record.status === 'COMPLETED_DAY' ? 'Complete' : 'Incomplete',
    shiftInterval: '09:00 AM - 05:00 PM',
    clockIn: formatTime(record.checkInTime),
    clockOut: formatTime(record.checkOutTime),
    employeeName: `${record.employee.firstName} ${record.employee.lastName}`,
    employeeRole: record.employee.jobTitle,
  }));
}

function mapWhosOff(requests: RawWhosOff[]): WhosOffEntry[] {
  return requests.map((request) => {
    const employeeName = `${request.employee.firstName} ${request.employee.lastName}`;
    const type = mapLeaveType(request.leaveType);
    return {
      id: request.id || `${request.employee.id || employeeName}-${request.startDate}`,
      employeeName,
      role: request.employee.jobTitle || 'Employee',
      avatarInitials: deriveAvatarInitials(employeeName),
      avatarColor: MACQUIRES_PALETTE.prussianBlue,
      type: type === 'Remote Work' ? 'Remote Work' : type === 'Sick Day off' ? 'Sick Day off' : 'Annual Vacation',
      durationLabel: `${request.daysCount} days`,
      fromDate: formatDate(request.startDate),
      toDate: formatDate(request.endDate),
      department: '—',
    };
  });
}

function mapDirectory(employees: RawDirectoryEmployee[]): DirectoryEmployee[] {
  return employees.map((employee) => ({
    id: employee.id,
    name: `${employee.firstName} ${employee.lastName}`,
    title: employee.jobTitle,
    department: employee.department,
    email: employee.email,
    phone: employee.phone || '',
    location: employee.branch?.name || 'Remote',
    status: employee.presenceStatus === 'ON_LEAVE'
      ? 'On Leave'
      : employee.presenceStatus === 'PRESENT_ON_SITE'
        ? 'In Office'
        : 'Remote',
    avatarInitials: deriveAvatarInitials(`${employee.firstName} ${employee.lastName}`),
    avatarColor: MACQUIRES_PALETTE.prussianBlue,
  }));
}

function mapPayslip(payslip: RawPayslip): SalarySlip {
  const [year, month] = payslip.period.split('-');
  const monthDate = new Date(Number(year), Number(month) - 1, 1);
  return {
    id: `slip-${payslip.period}`,
    monthLabel: monthDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }),
    payDate: formatDate(`${payslip.period}-27`),
    basicSalarySar: payslip.earnings.basicSalarySar,
    housingAllowanceSar: payslip.earnings.housingAllowanceSar,
    transportAllowanceSar: payslip.earnings.transportAllowanceSar,
    overtimeSar: 0,
    gosiDeductionSar: payslip.deductions.gosiEmployeeShareSar,
    netSalarySar: payslip.netSalarySar,
    status: 'Paid',
  };
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  token?: string,
): Promise<T> {
  const send = async (bearer?: string): Promise<Response> => {
    try {
      return await fetch(`${API_BASE_URL}${path}`, {
        ...options,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
          ...options.headers,
        },
      });
    } catch {
      throw new BackendApiError(
        'Unable to reach the Shiftly server. Check your API address and connection.',
      );
    }
  };

  const isCredentialRoute =
    path === '/auth/refresh' || path === '/auth/change-password';

  let response = await send(token);

  // A wrong current password on the change-password endpoint is also a 401, so
  // that path must not trigger a token refresh and rotate the session on typo.
  if (response.status === 401 && token && !isCredentialRoute) {
    const outcome = await refreshStoredSessionOutcome();
    if (outcome.status === 'ok') {
      response = await send(outcome.session.token);
    } else if (outcome.status === 'dead') {
      // The server rejected the refresh token: expired beyond recovery,
      // revoked, or deactivated. A transient refresh failure is `unavailable`
      // and must leave the stored session intact for the next attempt.
      notifySessionExpired();
    }
  }

  const body = (await response.json().catch(() => null)) as {
    message?: string | string[];
  } | null;
  if (!response.ok) {
    const message = Array.isArray(body?.message)
      ? body.message.join(', ')
      : body?.message || 'The server could not complete this request.';
    throw new BackendApiError(message);
  }
  return body as T;
}

export async function authenticateWithBackend(
  email: string,
  password: string,
): Promise<ApiAuthSession> {
  const response = await request<BackendLoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  return {
    token: response.accessToken,
    refreshToken: response.refreshToken,
    role: toAppRole(response.user.role),
    profile: toProfile(response.user),
    branchId: response.user.branch?.id,
    isRemoteAllowed: Boolean(response.user.isRemoteAllowed),
    mustChangePassword: Boolean(response.user.mustChangePassword),
  };
}

export async function changePassword(
  currentPassword: string,
  newPassword: string,
  token: string,
): Promise<{ accessToken: string; refreshToken: string; user: BackendUser }> {
  return request('/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword }),
  }, token);
}

export async function submitLeaveToBackend(
  token: string,
  payload: {
    type: string;
    startDate: string;
    endDate: string;
    reason: string;
    isHalfDay?: boolean;
    halfDayPeriod?: 'MORNING' | 'AFTERNOON';
    attachmentUrl?: string;
  },
) {
  return request('/leaves/request', {
    method: 'POST',
    body: JSON.stringify(payload),
  }, token);
}

export async function decideLeaveToBackend(
  token: string,
  id: string,
  decision: 'APPROVED' | 'REJECTED',
  comments?: string,
) {
  return request(`/leaves/${id}/decision`, {
    method: 'PATCH',
    body: JSON.stringify({ decision, comments }),
  }, token);
}

export async function loadMobileApiData(
  token: string,
  role: UserRole,
): Promise<MobileApiData> {
  const canViewTeam = role === 'MANAGER' || role === 'HR_ADMIN' || role === 'ADMIN';
  const [balances, myRequests, history, directory, whosOff, payslip, pending, team] = await Promise.all([
    request<RawLeaveBalance[]>('/leaves/balances', {}, token),
    request<RawLeaveRequest[]>('/leaves/my-requests', {}, token),
    request<RawAttendanceRecord[]>('/attendance/my-history?limit=100', {}, token),
    request<RawDirectoryEmployee[]>('/directory', {}, token),
    request<RawWhosOff[]>('/directory/whos-off', {}, token),
    request<RawPayslip>('/payroll/my-payslip', {}, token),
    canViewTeam ? request<RawLeaveRequest[]>('/leaves/pending', {}, token) : Promise.resolve([]),
    canViewTeam ? request<RawTeamAttendance[]>('/attendance/team', {}, token) : Promise.resolve([]),
  ]);

  return {
    leaveBalances: mapBalances(balances),
    approvals: [...mapApprovals(pending), ...mapApprovals(myRequests)],
    myAttendance: mapAttendance(history),
    subordinatesAttendance: mapTeamAttendance(team),
    whosOff: mapWhosOff(whosOff),
    directory: mapDirectory(directory),
    salarySlips: [mapPayslip(payslip)],
  };
}

export async function submitPunchToBackend(
  token: string,
  payload: {
    type: 'CHECK_IN' | 'CHECK_OUT' | 'BREAK_START' | 'BREAK_END' | 'RELOCATION';
    latitude: number;
    longitude: number;
    accuracyMeters: number;
    isMockLocation: boolean;
    isDeviceRooted: boolean;
    biometricVerified: boolean;
    clientTimestamp: string;
    branchId: string;
    wifiBssid?: string;
    bleBeaconDetected?: boolean;
    workMode?: 'OFFICE' | 'REMOTE';
    clientEventId?: string;
    reasonCode?: string;
  },
) {
  return request('/attendance/punch', {
    method: 'POST',
    body: JSON.stringify(payload),
  }, token);
}

export async function fetchTodayAttendance(token: string) {
  return request('/attendance/today', { method: 'GET' }, token);
}
