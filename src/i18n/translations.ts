import { AppLanguage } from '../theme/typography';

export interface TranslationSchema {
  welcome: string;
  viewProfile: string;
  myRemainingBalance: string;
  myActions: string;
  arrange: string;
  whosOffRemote: string;
  upcomingBirthdays: string;
  upcomingEvents: string;
  switchLightMode: string;
  switchDarkMode: string;
  biometricSecurityLock: string;
  requestTimeOff: string;
  days: string;
  hours: string;
  // Action Tiles
  transactions: string;
  approvals: string;
  payroll: string;
  attendance: string;
  documents: string;
  schedule: string;
  tasks: string;
  directory: string;
  // Leave types
  annualVacation: string;
  sickDayOff: string;
  sickOnFile: string;
  remoteWork: string;
  emergencyLeave: string;
  unpaidLeave: string;
  // Clock-in Screen
  geoAttendanceTitle: string;
  autoClockActive: string;
  autoClockOff: string;
  sinceClockIn: string;
  shiftCompletedReady: string;
  locationAccuracy: string;
  accurate: string;
  clockIn: string;
  clockOut: string;
  breakIn: string;
  breakOut: string;
  startBreak: string;
  endBreak: string;
  viewAttendanceLog: string;
  // Approvals Screen
  myApprovals: string;
  approvalHistory: string;
  pendingQueue: string;
  history: string;
  typeFilter: string;
  all: string;
  overtime: string;
  timeOff: string;
  financial: string;
  loan: string;
  startDate: string;
  endDate: string;
  amount: string;
  reject: string;
  approve: string;
  pending: string;
  approved: string;
  rejected: string;
  noRequestsInCategory: string;
  allRequestsUpToDate: string;
  // Attendance Screen
  myAttendance: string;
  subordinatesAttendance: string;
  filters: string;
  workingHours: string;
  complete: string;
  incomplete: string;
  shiftInterval: string;
  // Request Time Off Modal
  leaveTypeLabel: string;
  leaveDateLabel: string;
  lengthLabel: string;
  notesLabel: string;
  notesPlaceholder: string;
  attachmentDocument: string;
  camera: string;
  attachedFile: string;
  selectDate: string;
  oneDay: string;
  multipleDays: string;
  fromDate: string;
  toDate: string;
  apply: string;
  submitRequest: string;
  // Sub-modules
  financialTransactionsTitle: string;
  payrollTitle: string;
  directoryTitle: string;
  documentsTitle: string;
  scheduleTitle: string;
  tasksTitle: string;
  profileTitle: string;
  notificationsTitle: string;
  newestFirst: string;
  oldestFirst: string;
  submitExpenseClaim: string;
  submitClaimBtn: string;
  markAllRead: string;
  back: string;
  dashboardTab: string;
  biometricSubtitle: string;
  authenticateAs: string;
}

export const TRANSLATIONS: Record<AppLanguage, TranslationSchema> = {
  en: {
    welcome: 'Welcome',
    viewProfile: 'View Profile',
    myRemainingBalance: 'My Remaining Balance',
    myActions: 'My Actions',
    arrange: 'Arrange',
    whosOffRemote: 'Who’s Off / Working Remotely',
    upcomingBirthdays: 'Upcoming Birthdays',
    upcomingEvents: 'Upcoming Events',
    switchLightMode: 'Switch to Light Mode',
    switchDarkMode: 'Dark Mode',
    biometricSecurityLock: 'Face / Touch ID Security Lock',
    requestTimeOff: 'Request Time Off',
    days: 'days',
    hours: 'hours',
    transactions: 'Transactions',
    approvals: 'Approvals',
    payroll: 'Payroll',
    attendance: 'Attendance',
    documents: 'Documents',
    schedule: 'Schedule',
    tasks: 'Tasks',
    directory: 'Directory',
    annualVacation: 'Annual Vacation',
    sickDayOff: 'Sick Day off',
    sickOnFile: 'Sick on file',
    remoteWork: 'Remote Work',
    emergencyLeave: 'Emergency Leave',
    unpaidLeave: 'Unpaid Leave',
    geoAttendanceTitle: 'Geo-Attendance & Clock-In',
    autoClockActive: 'Auto-Clock Geofence Active',
    autoClockOff: 'Auto-Clock Off',
    sinceClockIn: 'since clock-in',
    shiftCompletedReady: 'Shift completed • Ready for next clock-in',
    locationAccuracy: 'Location Accuracy: 1.2 km',
    accurate: 'Accurate',
    clockIn: 'Clock-in',
    clockOut: 'Clock-out',
    breakIn: 'Break-in',
    breakOut: 'Break-out',
    startBreak: 'Start Break',
    endBreak: 'End Break',
    viewAttendanceLog: 'View Attendance Log',
    myApprovals: 'My Approvals',
    approvalHistory: 'Approval History',
    pendingQueue: 'Pending Queue',
    history: 'History',
    typeFilter: 'Type',
    all: 'All',
    overtime: 'Overtime',
    timeOff: 'Time Off',
    financial: 'Financial',
    loan: 'Loan',
    startDate: 'Start date',
    endDate: 'End date',
    amount: 'Amount',
    reject: 'Reject',
    approve: 'Approve',
    pending: 'Pending',
    approved: 'Approved',
    rejected: 'Rejected',
    noRequestsInCategory: 'No requests found in this category',
    allRequestsUpToDate: 'All employee requests for this category are up to date.',
    myAttendance: 'My Attendance',
    subordinatesAttendance: 'Subordinates’ Attendance',
    filters: 'Filters',
    workingHours: 'Working hours',
    complete: 'Complete',
    incomplete: 'Incomplete',
    shiftInterval: 'Shift Interval',
    leaveTypeLabel: 'Leave type',
    leaveDateLabel: 'Leave date',
    lengthLabel: 'Length',
    notesLabel: 'Notes',
    notesPlaceholder: 'Add handover notes or reason...',
    attachmentDocument: 'Attachment document',
    camera: 'Camera',
    attachedFile: 'Medical_Note.pdf attached',
    selectDate: 'Select Date',
    oneDay: 'One Day',
    multipleDays: 'Multiple Days',
    fromDate: 'From date',
    toDate: 'To date',
    apply: 'Apply',
    submitRequest: 'Request',
    financialTransactionsTitle: 'Financial Transactions',
    payrollTitle: 'Payroll & Salary Slips',
    directoryTitle: 'Employee Directory',
    documentsTitle: 'Company & My Documents',
    scheduleTitle: 'Work Schedule & Shifts',
    tasksTitle: 'My HR Tasks',
    profileTitle: 'Employee Profile',
    notificationsTitle: 'Notifications Inbox',
    newestFirst: 'Newest First (Desc)',
    oldestFirst: 'Oldest First (Asc)',
    submitExpenseClaim: '+ Submit Expense / Financial Request',
    submitClaimBtn: 'Submit Claim',
    markAllRead: 'Mark all read',
    back: 'Back',
    dashboardTab: 'Dashboard',
    biometricSubtitle:
      'Authenticate with Face ID / Touch ID to access your MacqHR employee self-service workspace.',
    authenticateAs: 'Authenticate as',
  },
  ar: {
    welcome: 'مرحباً',
    viewProfile: 'عرض الملف الشخصي',
    myRemainingBalance: 'رصيدي المتبقي للإجازات',
    myActions: 'إجراءاتي السريعة',
    arrange: 'ترتيب',
    whosOffRemote: 'في إجازة / العمل عن بُعد',
    upcomingBirthdays: 'أعياد الميلاد القادمة',
    upcomingEvents: 'الفعاليات القادمة',
    switchLightMode: 'الوضع النهاري',
    switchDarkMode: 'الوضع الليلي',
    biometricSecurityLock: 'قفل الأمان بالبصمة / الوجه',
    requestTimeOff: 'طلب إجازة',
    days: 'أيام',
    hours: 'ساعات',
    transactions: 'المعاملات المالية',
    approvals: 'الموافقات',
    payroll: 'الرواتب والقسائم',
    attendance: 'سجل الحضور',
    documents: 'المستندات',
    schedule: 'جدول الدوام',
    tasks: 'المهام',
    directory: 'دليل الموظفين',
    annualVacation: 'إجازة سنوية',
    sickDayOff: 'إجازة مرضية',
    sickOnFile: 'مرضية موثقة',
    remoteWork: 'عمل عن بُعد',
    emergencyLeave: 'إجازة طارئة',
    unpaidLeave: 'إجازة بدون راتب',
    geoAttendanceTitle: 'تسجيل الحضور والانصراف الجغرافي',
    autoClockActive: 'النطاق الجغرافي التلقائي مفعل',
    autoClockOff: 'التسجيل التلقائي متوقف',
    sinceClockIn: 'منذ تسجيل الدخول',
    shiftCompletedReady: 'اكتمل الدوام • جاهز للتسجيل القادم',
    locationAccuracy: 'دقة الموقع: 1.2 كم',
    accurate: 'دقيق',
    clockIn: 'تسجيل حضور',
    clockOut: 'تسجيل انصراف',
    breakIn: 'بدء استراحة',
    breakOut: 'إنهاء استراحة',
    startBreak: 'بدء استراحة',
    endBreak: 'إنهاء استراحة',
    viewAttendanceLog: 'عرض سجل الحضور',
    myApprovals: 'موافقاتي',
    approvalHistory: 'سجل الموافقات',
    pendingQueue: 'الطلبات المعلقة',
    history: 'السجل',
    typeFilter: 'النوع',
    all: 'الكل',
    overtime: 'عمل إضافي',
    timeOff: 'إجازات',
    financial: 'مالية',
    loan: 'سلفة',
    startDate: 'تاريخ البدء',
    endDate: 'تاريخ الانتهاء',
    amount: 'المبلغ',
    reject: 'رفض',
    approve: 'موافقة',
    pending: 'قيد الانتظار',
    approved: 'مقبول',
    rejected: 'مرفوض',
    noRequestsInCategory: 'لا توجد طلبات في هذا التصنيف',
    allRequestsUpToDate: 'جميع طلبات الموظفين في هذا القسم محدثة.',
    myAttendance: 'حضوري',
    subordinatesAttendance: 'حضور المرؤوسين',
    filters: 'تصفية',
    workingHours: 'ساعات العمل',
    complete: 'مكتمل',
    incomplete: 'غير مكتمل',
    shiftInterval: 'فترة الدوام',
    leaveTypeLabel: 'نوع الإجازة',
    leaveDateLabel: 'تاريخ الإجازة',
    lengthLabel: 'المدة',
    notesLabel: 'ملاحظات',
    notesPlaceholder: 'أضف ملاحظات التسليم أو السبب...',
    attachmentDocument: 'إرفاق مستند',
    camera: 'الكاميرا',
    attachedFile: 'تم إرفاق التقرير الطبي',
    selectDate: 'تحديد التاريخ',
    oneDay: 'يوم واحد',
    multipleDays: 'عدة أيام',
    fromDate: 'من تاريخ',
    toDate: 'إلى تاريخ',
    apply: 'تطبيق',
    submitRequest: 'إرسال الطلب',
    financialTransactionsTitle: 'المعاملات المالية',
    payrollTitle: 'الرواتب وقسائم الراتب',
    directoryTitle: 'دليل الموظفين',
    documentsTitle: 'مستنداتي ومستندات الشركة',
    scheduleTitle: 'جدول العمل والمناوبات',
    tasksTitle: 'مهام الموارد البشرية',
    profileTitle: 'الملف الشخصي للموظف',
    notificationsTitle: 'صندوق الإشعارات',
    newestFirst: 'الأحدث أولاً (تنازلي)',
    oldestFirst: 'الأقدم أولاً (تصاعدي)',
    submitExpenseClaim: '+ تقديم مطالبة مالية / مصروفات',
    submitClaimBtn: 'إرسال المطالبة',
    markAllRead: 'تحديد الكل كمقروء',
    back: 'رجوع',
    dashboardTab: 'الرئيسية',
    biometricSubtitle:
      'قم بالمصادقة باستخدام بصمة الوجه أو الإصبع للوصول إلى مساحة عمل الموظف في MacqHR.',
    authenticateAs: 'المصادقة باسم',
  },
};
