import { LeaveType } from '../types/zenhr';
import { MACQUIRES_PALETTE } from '../theme/colors';
import { UserRole } from './dashboardOptimizationService';

export type LeaveApprovalStage =
  | 'PENDING_MANAGER'
  | 'PENDING_HR'
  | 'APPROVED'
  | 'REJECTED';

export interface OrgEmployeeNode {
  id: string;
  name: string;
  nameAr: string;
  title: string;
  titleAr: string;
  role: UserRole;
  department: string;
  departmentAr: string;
  managerId: string | null;
  managerName: string | null;
  location: string;
  workType: 'Remote' | 'On-site';
  avatarInitials: string;
  avatarColor: string;
  email: string;
  phone: string;
  directReportsCount: number;
}

export interface WorkflowApprovalItem {
  id: string;
  employeeId: string;
  employeeName: string;
  role: string;
  department: string;
  avatarInitials: string;
  avatarColor: string;
  category: 'Time Off' | 'Overtime' | 'Financial';
  headline: string;
  subHeadline: string;
  leaveType?: LeaveType;
  stage: LeaveApprovalStage;
  status: 'Pending' | 'Approved' | 'Rejected';
  managerId: string;
  managerName: string;
  hrName?: string;
  startDate: string;
  endDate: string;
  daysCount: number;
  amountSar?: number;
  notes?: string;
  createdAtIso: string;
}

export interface OrgBranchAttendanceStat {
  branchKey: 'riyadh_hq' | 'pakistan_remote' | 'dubai_hub';
  nameEn: string;
  nameAr: string;
  totalHeadcount: number;
  activeWorking: number;
  onLeave: number;
  workingRemotely: number;
  badgeColor: string;
}

/**
 * Company Organization Structure Hierarchy Tree
 */
export const ORGANIZATION_TREE: OrgEmployeeNode[] = [
  {
    id: 'ADM-0001',
    name: 'Sultan Al-Otaibi',
    nameAr: 'سلطان العتيبي',
    title: 'Chief Human Resources Officer & Executive Admin',
    titleAr: 'الرئيس التنفيذي للموارد البشرية والمسؤول الرئيسي',
    role: 'ADMIN',
    department: 'Executive Board',
    departmentAr: 'مجلس الإدارة التنفيذي',
    managerId: null,
    managerName: null,
    location: 'Riyadh HQ, KSA',
    workType: 'On-site',
    avatarInitials: 'SO',
    avatarColor: MACQUIRES_PALETTE.oxfordBlue,
    email: 'sultan.otaibi@macquires.sa',
    phone: '+966 54 112 3344',
    directReportsCount: 2,
  },
  {
    id: 'MGR-2041',
    name: 'Tariq Al-Ghamdi',
    nameAr: 'طارق الغامدي',
    title: 'Engineering Director & Line Manager',
    titleAr: 'مدير قطاع الهندسة البرمجية والمدير المباشر',
    role: 'MANAGER',
    department: 'Software Engineering',
    departmentAr: 'الهندسة البرمجية',
    managerId: 'ADM-0001',
    managerName: 'Sultan Al-Otaibi',
    location: 'Riyadh HQ, KSA',
    workType: 'On-site',
    avatarInitials: 'TG',
    avatarColor: MACQUIRES_PALETTE.orangePantone,
    email: 'tariq.ghamdi@macquires.sa',
    phone: '+966 55 901 2233',
    directReportsCount: 3,
  },
  {
    id: 'HR-3001',
    name: 'Rahaf Al-Mansoor',
    nameAr: 'رهف المنصور',
    title: 'Senior HR Specialist & People Lead',
    titleAr: 'أخصائية موارد بشرية أولى ومسؤولة العمليات',
    role: 'HR',
    department: 'People & Culture',
    departmentAr: 'الموارد البشرية والثقافة المؤسسية',
    managerId: 'ADM-0001',
    managerName: 'Sultan Al-Otaibi',
    location: 'Riyadh HQ, KSA',
    workType: 'On-site',
    avatarInitials: 'RM',
    avatarColor: MACQUIRES_PALETTE.prussianBlue,
    email: 'rahaf.mansoor@macquires.sa',
    phone: '+966 50 482 9104',
    directReportsCount: 2,
  },
  {
    id: 'EMP-1042',
    name: 'Rayan Al-Harbi',
    nameAr: 'ريان الحربي',
    title: 'Senior Mobile Engineer (Remote)',
    titleAr: 'مهندس تطبيقات أول (عن بعد)',
    role: 'EMPLOYEE',
    department: 'Software Engineering',
    departmentAr: 'الهندسة البرمجية',
    managerId: 'MGR-2041',
    managerName: 'Tariq Al-Ghamdi',
    location: 'Remote (Pakistan)',
    workType: 'Remote',
    avatarInitials: 'RH',
    avatarColor: MACQUIRES_PALETTE.bdazzledBlue,
    email: 'rayan.harbi@macquires.sa',
    phone: '+92 300 1234567',
    directReportsCount: 0,
  },
  {
    id: 'EMP-1043',
    name: 'Omar Al-Zahrani',
    nameAr: 'عمر الزهراني',
    title: 'Product Designer',
    titleAr: 'مصمم واجهات وتجربة المستخدم',
    role: 'EMPLOYEE',
    department: 'Software Engineering',
    departmentAr: 'الهندسة البرمجية',
    managerId: 'MGR-2041',
    managerName: 'Tariq Al-Ghamdi',
    location: 'Riyadh HQ, KSA',
    workType: 'On-site',
    avatarInitials: 'OZ',
    avatarColor: MACQUIRES_PALETTE.orangePantone,
    email: 'omar.zahrani@macquires.sa',
    phone: '+966 55 123 4567',
    directReportsCount: 0,
  },
  {
    id: 'EMP-1044',
    name: 'Hamza Farooq',
    nameAr: 'حمزة فاروق',
    title: 'Cloud & DevOps Engineer (Remote)',
    titleAr: 'مهندس حوسبة سحابية (عن بعد)',
    role: 'EMPLOYEE',
    department: 'Software Engineering',
    departmentAr: 'الهندسة البرمجية',
    managerId: 'MGR-2041',
    managerName: 'Tariq Al-Ghamdi',
    location: 'Remote (Pakistan)',
    workType: 'Remote',
    avatarInitials: 'HF',
    avatarColor: '#10B981',
    email: 'hamza.farooq@macquires.sa',
    phone: '+92 321 9876543',
    directReportsCount: 0,
  },
  {
    id: 'HR-3002',
    name: 'Laila Al-Ghamdi',
    nameAr: 'ليلى الغامدي',
    title: 'People Operations Specialist',
    titleAr: 'أخصائية عمليات الأفراد',
    role: 'HR',
    department: 'People & Culture',
    departmentAr: 'الموارد البشرية والثقافة المؤسسية',
    managerId: 'HR-3001',
    managerName: 'Rahaf Al-Mansoor',
    location: 'Riyadh HQ, KSA',
    workType: 'On-site',
    avatarInitials: 'LG',
    avatarColor: MACQUIRES_PALETTE.orangePantone,
    email: 'laila.ghamdi@macquires.sa',
    phone: '+966 54 889 0011',
    directReportsCount: 0,
  },
];

/**
 * Creates a multi-stage leave request initiated by an employee.
 * It assigns the direct manager and generates a manager notification.
 */
export function createLeaveWorkflowRequest(params: {
  employeeId: string;
  employeeName: string;
  role: string;
  department: string;
  avatarInitials: string;
  avatarColor: string;
  leaveType: LeaveType;
  fromDay: number;
  toDay: number;
  daysCount: number;
  notes?: string;
  monthName?: string;
  year?: number;
}): {
  approvalItem: WorkflowApprovalItem;
  managerNotification: {
    title: string;
    body: string;
    timeAgo: string;
  };
} {
  const month = params.monthName ?? 'Oct';
  const year = params.year ?? 2026;
  const startDate = `${month} ${String(params.fromDay).padStart(2, '0')}, ${year}`;
  const endDate = `${month} ${String(params.toDay).padStart(2, '0')}, ${year}`;

  // Find direct manager from org hierarchy or fallback
  const employeeNode = ORGANIZATION_TREE.find((n) => n.id === params.employeeId);
  const managerName = employeeNode?.managerName ?? 'Tariq Al-Ghamdi';
  const managerId = employeeNode?.managerId ?? 'MGR-2041';

  const approvalItem: WorkflowApprovalItem = {
    id: `wf-leave-${Date.now()}`,
    employeeId: params.employeeId,
    employeeName: params.employeeName,
    role: params.role,
    department: params.department,
    avatarInitials: params.avatarInitials,
    avatarColor: params.avatarColor,
    category: 'Time Off',
    headline: `${params.leaveType} (${params.daysCount} days)`,
    subHeadline: `${startDate} → ${endDate}`,
    leaveType: params.leaveType,
    stage: 'PENDING_MANAGER',
    status: 'Pending',
    managerId,
    managerName,
    startDate,
    endDate,
    daysCount: params.daysCount,
    notes: params.notes,
    createdAtIso: new Date().toISOString(),
  };

  const managerNotification = {
    title: `New Leave Request: ${params.employeeName}`,
    body: `${params.employeeName} requested ${params.daysCount} days of ${params.leaveType} (${startDate} to ${endDate}). Awaiting your manager approval.`,
    timeAgo: 'Just now',
  };

  return { approvalItem, managerNotification };
}

/**
 * Processes manager decision on an active leave request.
 * - If approved by manager: moves stage to PENDING_HR (or APPROVED),
 *   notifies HR, and authorizes leave balance deduction & calendar sync.
 * - If rejected: marks REJECTED and notifies employee.
 */
export function processManagerLeaveDecision(params: {
  item: WorkflowApprovalItem;
  decision: 'Approved' | 'Rejected';
  managerName?: string;
}): {
  updatedItem: WorkflowApprovalItem;
  hrNotification?: {
    title: string;
    body: string;
    timeAgo: string;
  };
  employeeNotification: {
    title: string;
    body: string;
    timeAgo: string;
  };
  shouldDeductBalance: boolean;
  shouldAddToWhosOff: boolean;
} {
  const { item, decision } = params;
  const managerName = params.managerName ?? item.managerName;

  if (decision === 'Approved') {
    const updatedItem: WorkflowApprovalItem = {
      ...item,
      stage: 'APPROVED',
      status: 'Approved',
      hrName: 'Rahaf Al-Mansoor',
    };

    const hrNotification = {
      title: `Leave Approved: ${item.employeeName}`,
      body: `Manager ${managerName} approved ${item.leaveType} for ${item.employeeName} (${item.startDate} – ${item.endDate}). Record logged into HR system.`,
      timeAgo: 'Just now',
    };

    const employeeNotification = {
      title: `Leave Request Approved`,
      body: `Your manager ${managerName} approved your ${item.leaveType} request (${item.daysCount} days).`,
      timeAgo: 'Just now',
    };

    return {
      updatedItem,
      hrNotification,
      employeeNotification,
      shouldDeductBalance: true,
      shouldAddToWhosOff: true,
    };
  }

  const updatedItem: WorkflowApprovalItem = {
    ...item,
    stage: 'REJECTED',
    status: 'Rejected',
  };

  const employeeNotification = {
    title: `Leave Request Declined`,
    body: `Your manager ${managerName} declined your ${item.leaveType} request. Contact your manager for details.`,
    timeAgo: 'Just now',
  };

  return {
    updatedItem,
    employeeNotification,
    shouldDeductBalance: false,
    shouldAddToWhosOff: false,
  };
}

/**
 * Computes live company-wide attendance and distribution across hubs
 */
export function getOrganizationAttendanceOverview(): OrgBranchAttendanceStat[] {
  return [
    {
      branchKey: 'riyadh_hq',
      nameEn: 'Riyadh Headquarters (KSA)',
      nameAr: 'المقر الرئيسي — الرياض (السعودية)',
      totalHeadcount: 48,
      activeWorking: 45,
      onLeave: 3,
      workingRemotely: 0,
      badgeColor: MACQUIRES_PALETTE.oxfordBlue,
    },
    {
      branchKey: 'pakistan_remote',
      nameEn: 'Pakistan Remote Hub',
      nameAr: 'مركز العمل عن بعد — باكستان',
      totalHeadcount: 14,
      activeWorking: 13,
      onLeave: 1,
      workingRemotely: 14,
      badgeColor: MACQUIRES_PALETTE.bdazzledBlue,
    },
    {
      branchKey: 'dubai_hub',
      nameEn: 'Dubai Regional Office (UAE)',
      nameAr: 'مكتب دبي الإقليمي (الإمارات)',
      totalHeadcount: 8,
      activeWorking: 8,
      onLeave: 0,
      workingRemotely: 2,
      badgeColor: MACQUIRES_PALETTE.orangePantone,
    },
  ];
}

/**
 * Filters visible approval pipeline for active role
 */
export function filterApprovalsForRole(
  role: UserRole,
  approvals: WorkflowApprovalItem[],
  currentEmployeeId: string = 'EMP-1042'
): WorkflowApprovalItem[] {
  if (role === 'ADMIN' || role === 'HR_ADMIN') {
    return approvals;
  }
  if (role === 'HR') {
    return approvals.filter(
      (a) => a.stage === 'PENDING_HR' || a.stage === 'APPROVED' || a.status === 'Approved'
    );
  }
  if (role === 'MANAGER') {
    return approvals.filter((a) => a.stage === 'PENDING_MANAGER');
  }
  // Regular employee sees their own requests
  return approvals.filter((a) => a.employeeId === currentEmployeeId);
}
