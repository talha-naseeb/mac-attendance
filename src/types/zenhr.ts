export type LeaveType =
  | 'Annual Vacation'
  | 'Sick Day off'
  | 'Sick on file'
  | 'Remote Work'
  | 'Emergency Leave'
  | 'Unpaid Leave';

export interface LeaveBalance {
  id: string;
  title: LeaveType;
  remaining: number;
  total: number;
  unit: 'days' | 'hours';
  accentColor: string;
}

export type ActionModuleId =
  | 'transactions'
  | 'approvals'
  | 'payroll'
  | 'attendance'
  | 'documents'
  | 'schedule'
  | 'tasks'
  | 'directory';

export interface ActionItem {
  id: ActionModuleId;
  label: string;
  icon: string;
  badgeCount?: number;
  tint: string;
}

export interface WhosOffEntry {
  id: string;
  employeeName: string;
  role: string;
  avatarInitials: string;
  avatarColor: string;
  type: 'Annual Vacation' | 'Remote Work' | 'Sick Day off';
  durationLabel: string;
  fromDate: string;
  toDate: string;
  department?: string;
  email?: string;
  phone?: string;
  location?: string;
  contactStatus?: 'Reachable' | 'Do Not Disturb' | 'Urgent Only';
  handoverContact?: string;
}

export interface BirthdayEntry {
  id: string;
  employeeName: string;
  department: string;
  avatarInitials: string;
  avatarColor: string;
  day: string;
  month: string;
  daysLeftLabel: string;
}

export interface CompanyEvent {
  id: string;
  title: string;
  timeRange: string;
  fromDate: string;
  toDate: string;
  location: string;
}

export type ApprovalCategory = 'All' | 'Overtime' | 'Time Off' | 'Financial' | 'Loan';

export interface ApprovalItem {
  id: string;
  employeeName: string;
  role: string;
  avatarInitials: string;
  avatarColor: string;
  category: Exclude<ApprovalCategory, 'All'>;
  headline: string;
  subHeadline: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  startDate: string;
  endDate: string;
  amountSar?: number;
  notes?: string;
}

export interface AttendanceRecord {
  id: string;
  dayNumber: string;
  monthYear: string;
  workingHoursLabel: string;
  status: 'Complete' | 'Incomplete';
  shiftInterval: string;
  clockIn: string;
  clockOut: string;
  employeeName?: string;
  employeeRole?: string;
}

export interface FinancialTransaction {
  id: string;
  title: string;
  type: 'Overtime' | 'Expense Claim' | 'Salary Advance' | 'Bonus' | 'Allowance';
  dateIso: string;
  dateFormatted: string;
  amountSar: number;
  status: 'Approved' | 'Pending' | 'Paid';
  referenceCode: string;
}

export interface SalarySlip {
  id: string;
  monthLabel: string;
  payDate: string;
  basicSalarySar: number;
  housingAllowanceSar: number;
  transportAllowanceSar: number;
  overtimeSar: number;
  gosiDeductionSar: number;
  netSalarySar: number;
  status: 'Paid' | 'Processing';
}

export interface DirectoryEmployee {
  id: string;
  name: string;
  title: string;
  department: string;
  email: string;
  phone: string;
  location: string;
  status: 'In Office' | 'Remote' | 'On Leave';
  avatarInitials: string;
  avatarColor: string;
}

export interface CompanyDocument {
  id: string;
  title: string;
  category: 'Personal' | 'Company Policy' | 'Letters';
  updatedAt: string;
  sizeLabel: string;
  status?: 'Verified' | 'Expiring Soon';
}

export interface TaskItem {
  id: string;
  title: string;
  dueDate: string;
  category: string;
  completed: boolean;
}

export interface ShiftDay {
  id: string;
  dayName: string;
  dateLabel: string;
  shiftName: string;
  interval: string;
  location: string;
  isRestDay?: boolean;
}

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  timeAgo: string;
  read: boolean;
}
