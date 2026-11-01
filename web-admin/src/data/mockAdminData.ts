export interface AdminBranch {
  id: string;
  name: string;
  nameAr: string;
  code: string;
  city: string;
  address: string;
  latitude: number;
  longitude: number;
  geofenceRadiusMeters: number;
  activeEmployeesCount: number;
  todayPunchesCount: number;
  wifiBssids: string[];
  bleBeacons: string[];
}

export const INITIAL_BRANCHES: AdminBranch[] = [
  {
    id: 'branch-ruh-hq',
    name: 'Riyadh HQ - Digital City',
    nameAr: 'المقر الرئيسي - المدينة الرقمية، الرياض',
    code: 'RUH-HQ',
    city: 'Riyadh',
    address: 'Digital City, Building 4B, Riyadh 12382',
    latitude: 24.7136,
    longitude: 46.6753,
    geofenceRadiusMeters: 150,
    activeEmployeesCount: 42,
    todayPunchesCount: 38,
    wifiBssids: ['macquires-corp-hq', 'macquires-secure-wpa3'],
    bleBeacons: ['beacon-riyadh-turnstile-01', 'beacon-riyadh-lobby-02'],
  },
  {
    id: 'branch-ruh-olaya',
    name: 'Olaya Financial Hub',
    nameAr: 'مركز العليا المالي',
    code: 'RUH-OLAYA',
    city: 'Riyadh',
    address: 'King Fahd Road, Olaya Towers, Riyadh',
    latitude: 24.6974,
    longitude: 46.6841,
    geofenceRadiusMeters: 150,
    activeEmployeesCount: 18,
    todayPunchesCount: 15,
    wifiBssids: ['olaya-corp-mesh'],
    bleBeacons: ['beacon-olaya-01'],
  },
  {
    id: 'branch-jed-reg',
    name: 'Jeddah Regional Office',
    nameAr: 'فرع جدة الإقليمي',
    code: 'JED-REG',
    city: 'Jeddah',
    address: 'Corniche Road, Al-Shati District, Jeddah',
    latitude: 21.5433,
    longitude: 39.1728,
    geofenceRadiusMeters: 200,
    activeEmployeesCount: 12,
    todayPunchesCount: 11,
    wifiBssids: ['jeddah-corp-net'],
    bleBeacons: [],
  },
];

export interface LivePunchLog {
  id: string;
  employeeName: string;
  employeeId: string;
  jobTitle: string;
  branchName: string;
  type: 'CHECK_IN' | 'CHECK_OUT';
  timestamp: string;
  distanceMeters: number;
  accuracyMeters: number;
  status: 'VERIFIED' | 'FLAGGED' | 'REJECTED';
  securityFlags: string[];
  isMockLocation: boolean;
  isDeviceRooted: boolean;
  biometricVerified: boolean;
  wasOfflineSynced: boolean;
}

export const INITIAL_ATTENDANCE_STREAM: LivePunchLog[] = [
  {
    id: 'log-101',
    employeeName: 'Rahaf Al-Mansoor',
    employeeId: 'EMP-004',
    jobTitle: 'Software Engineer',
    branchName: 'Riyadh HQ - Digital City',
    type: 'CHECK_IN',
    timestamp: '08:42 AM',
    distanceMeters: 24,
    accuracyMeters: 8.2,
    status: 'VERIFIED',
    securityFlags: [],
    isMockLocation: false,
    isDeviceRooted: false,
    biometricVerified: true,
    wasOfflineSynced: false,
  },
  {
    id: 'log-102',
    employeeName: 'Bilal Rehman',
    employeeId: 'EMP-005',
    jobTitle: 'Senior Mobile Architect (Remote)',
    branchName: 'Lahore Remote Hub',
    type: 'CHECK_IN',
    timestamp: '08:50 AM',
    distanceMeters: 0,
    accuracyMeters: 14.0,
    status: 'VERIFIED',
    securityFlags: ['AUTHORIZED_REMOTE_HUB'],
    isMockLocation: false,
    isDeviceRooted: false,
    biometricVerified: true,
    wasOfflineSynced: false,
  },
  {
    id: 'log-103',
    employeeName: 'Tariq Al-Ghamdi',
    employeeId: 'EMP-003',
    jobTitle: 'Engineering Director',
    branchName: 'Riyadh HQ - Digital City',
    type: 'CHECK_IN',
    timestamp: '09:05 AM',
    distanceMeters: 62,
    accuracyMeters: 12.5,
    status: 'VERIFIED',
    securityFlags: [],
    isMockLocation: false,
    isDeviceRooted: false,
    biometricVerified: true,
    wasOfflineSynced: false,
  },
  {
    id: 'log-104',
    employeeName: 'Sara Al-Otaibi',
    employeeId: 'EMP-002',
    jobTitle: 'Senior HR Operations Lead',
    branchName: 'Riyadh HQ - Digital City',
    type: 'CHECK_IN',
    timestamp: '09:12 AM',
    distanceMeters: 45,
    accuracyMeters: 10.1,
    status: 'VERIFIED',
    securityFlags: [],
    isMockLocation: false,
    isDeviceRooted: false,
    biometricVerified: true,
    wasOfflineSynced: false,
  },
  {
    id: 'log-105',
    employeeName: 'Fahad Al-Dossari',
    employeeId: 'EMP-008',
    jobTitle: 'Quality Assurance Lead',
    branchName: 'Olaya Financial Hub',
    type: 'CHECK_IN',
    timestamp: '09:28 AM',
    distanceMeters: 280,
    accuracyMeters: 65.0,
    status: 'FLAGGED',
    securityFlags: ['ACCURACY_EXCEEDED_50M', 'OUTSIDE_GEOFENCE_150M'],
    isMockLocation: false,
    isDeviceRooted: false,
    biometricVerified: true,
    wasOfflineSynced: false,
  },
];

export interface AdminLeaveItem {
  id: string;
  employeeName: string;
  employeeId: string;
  department: string;
  type: string;
  startDate: string;
  endDate: string;
  daysCount: number;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  teamsNotificationDispatched: boolean;
  appliedOn: string;
}

export const INITIAL_LEAVE_REQUESTS: AdminLeaveItem[] = [
  {
    id: 'leave-001',
    employeeName: 'Rahaf Al-Mansoor',
    employeeId: 'EMP-004',
    department: 'Software Engineering',
    type: 'ANNUAL',
    startDate: '2026-11-01',
    endDate: '2026-11-05',
    daysCount: 5,
    reason: 'Family annual vacation in Abha',
    status: 'PENDING',
    teamsNotificationDispatched: true,
    appliedOn: '2026-10-23',
  },
  {
    id: 'leave-002',
    employeeName: 'Mansoor Al-Harthy',
    employeeId: 'EMP-009',
    department: 'Corporate Finance',
    type: 'SICK',
    startDate: '2026-10-25',
    endDate: '2026-10-26',
    daysCount: 2,
    reason: 'Medical appointment & flu recovery',
    status: 'PENDING',
    teamsNotificationDispatched: true,
    appliedOn: '2026-10-24',
  },
  {
    id: 'leave-003',
    employeeName: 'Bilal Rehman',
    employeeId: 'EMP-005',
    department: 'Software Engineering',
    type: 'ANNUAL',
    startDate: '2026-10-10',
    endDate: '2026-10-14',
    daysCount: 5,
    reason: 'Approved annual break',
    status: 'APPROVED',
    teamsNotificationDispatched: true,
    appliedOn: '2026-10-01',
  },
];

export interface AdminEmployee {
  id: string;
  employeeId: string;
  name: string;
  email: string;
  phone: string;
  jobTitle: string;
  department: string;
  branchName: string;
  role: 'EMPLOYEE' | 'MANAGER' | 'HR_ADMIN' | 'SUPER_ADMIN';
  isSaudi: boolean;
  nationalOrIqamaId: string;
  basicSalarySar: number;
  housingAllowanceSar: number;
  transportAllowanceSar: number;
  gosiEmployeeDeductionSar: number;
  gosiEmployerContributionSar: number;
  netSalarySar: number;
  status: 'ACTIVE' | 'REMOTE' | 'INACTIVE';
  branchId?: string | null;
  managerId?: string | null;
  managerName?: string | null;
  isActive?: boolean;
  isRemoteAllowed?: boolean;
  mustChangePassword?: boolean;
}

export const INITIAL_EMPLOYEES: AdminEmployee[] = [
  {
    id: 'emp-1',
    employeeId: 'EMP-001',
    name: 'Sultan Al-Otaibi',
    email: 'superadmin@macqhr.sa',
    phone: '+966 54 112 3344',
    jobTitle: 'Chief Executive Officer (CEO)',
    department: 'Executive Board',
    branchName: 'Riyadh HQ - Digital City',
    role: 'SUPER_ADMIN',
    isSaudi: true,
    nationalOrIqamaId: '1099887766',
    basicSalarySar: 45000,
    housingAllowanceSar: 10000,
    transportAllowanceSar: 2500,
    gosiEmployeeDeductionSar: 4387.5,
    gosiEmployerContributionSar: 5287.5,
    netSalarySar: 53112.5,
    status: 'ACTIVE',
  },
  {
    id: 'emp-2',
    employeeId: 'EMP-002',
    name: 'Sara Al-Otaibi',
    email: 'sara.alotaibi@macqhr.sa',
    phone: '+966 56 334 5566',
    jobTitle: 'Senior HR Operations Lead',
    department: 'People & Culture',
    branchName: 'Riyadh HQ - Digital City',
    role: 'HR_ADMIN',
    isSaudi: true,
    nationalOrIqamaId: '1088776655',
    basicSalarySar: 18000,
    housingAllowanceSar: 4500,
    transportAllowanceSar: 1500,
    gosiEmployeeDeductionSar: 2193.75,
    gosiEmployerContributionSar: 2643.75,
    netSalarySar: 21806.25,
    status: 'ACTIVE',
  },
  {
    id: 'emp-3',
    employeeId: 'EMP-003',
    name: 'Tariq Al-Ghamdi',
    email: 'tariq.ghamdi@macqhr.sa',
    phone: '+966 55 901 2233',
    jobTitle: 'Engineering Director',
    department: 'Software Engineering',
    branchName: 'Riyadh HQ - Digital City',
    role: 'MANAGER',
    isSaudi: true,
    nationalOrIqamaId: '1077665544',
    basicSalarySar: 24000,
    housingAllowanceSar: 6000,
    transportAllowanceSar: 2000,
    gosiEmployeeDeductionSar: 2925,
    gosiEmployerContributionSar: 3525,
    netSalarySar: 29075,
    status: 'ACTIVE',
  },
  {
    id: 'emp-4',
    employeeId: 'EMP-004',
    name: 'Rahaf Al-Mansoor',
    email: 'rahaf.mansoor@macqhr.sa',
    phone: '+966 50 482 9104',
    jobTitle: 'Software Engineer',
    department: 'Software Engineering',
    branchName: 'Riyadh HQ - Digital City',
    role: 'EMPLOYEE',
    isSaudi: true,
    nationalOrIqamaId: '1066554433',
    basicSalarySar: 14000,
    housingAllowanceSar: 3500,
    transportAllowanceSar: 1200,
    gosiEmployeeDeductionSar: 1706.25,
    gosiEmployerContributionSar: 2056.25,
    netSalarySar: 16993.75,
    status: 'ACTIVE',
  },
  {
    id: 'emp-5',
    employeeId: 'EMP-005',
    name: 'Bilal Rehman',
    email: 'bilal.rehman@macqhr.sa',
    phone: '+92 300 1234567',
    jobTitle: 'Senior Mobile Architect',
    department: 'Software Engineering',
    branchName: 'Olaya Financial Hub',
    role: 'EMPLOYEE',
    isSaudi: false,
    nationalOrIqamaId: '2498765432',
    basicSalarySar: 18000,
    housingAllowanceSar: 4500,
    transportAllowanceSar: 1500,
    gosiEmployeeDeductionSar: 0,
    gosiEmployerContributionSar: 450,
    netSalarySar: 24000,
    status: 'REMOTE',
  },
];
