/**
 * Central bilingual (EN | عربي) localizer for dynamic/mock data and UI literals.
 *
 * Usage in a screen:
 *   const tr = makeTr(lang);
 *   <Text>{tr(item.employeeName)}</Text>
 *
 * Resolution order (Arabic only — English returns the input unchanged):
 *   1. Exact dictionary match.
 *   2. Composite strings split on " • ", " → ", " / " and " (" and translated per segment.
 *   3. Pattern rules: months, weekdays, AM/PM, "N days", "N hours", "2h ago", SAR …
 */
import { AppLanguage } from '../theme/typography';

const DICT_AR: Record<string, string> = {
  // ── People ───────────────────────────────────────────
  'Rahaf Al-Mansoor': 'رهف المنصور',
  'Mohammad Jamal': 'محمد جمال',
  'Lina Al-Harbi': 'لينا الحربي',
  'Yazeed Al-Qahtani': 'يزيد القحطاني',
  'Salim Khalidd': 'سالم خالد',
  'Noura Al-Subaie': 'نورة السبيعي',
  'Sumaya Khalid': 'سمية خالد',
  'Faisal Al-Dosari': 'فيصل الدوسري',
  'Ayman Hassan': 'أيمن حسن',
  'Tariq Al-Otaibi': 'طارق العتيبي',

  // ── Roles / titles ───────────────────────────────────
  'Senior People Operations Lead': 'قائد عمليات الموارد البشرية أول',
  'Senior Backend Engineer': 'مهندس أنظمة خلفية أول',
  'UX Designer': 'مصمم تجربة المستخدم',
  'Customer Success Manager': 'مدير نجاح العملاء',
  'Product Manager': 'مدير المنتج',
  'Mobile Engineer': 'مهندس تطبيقات الجوال',
  'Account Executive': 'مسؤول حسابات',
  'Enterprise Account Executive': 'مسؤول حسابات الشركات',
  'Staff Frontend Architect': 'مهندس واجهات أمامية رئيسي',

  // ── Departments ──────────────────────────────────────
  'Human Resources & Culture': 'الموارد البشرية والثقافة المؤسسية',
  'Human Resources': 'الموارد البشرية',
  'Product Engineering': 'هندسة المنتجات',
  'Finance & Payroll': 'المالية والرواتب',
  'Product & Design': 'المنتج والتصميم',
  Engineering: 'الهندسة',
  'Sales & Growth': 'المبيعات والنمو',

  // ── Locations ────────────────────────────────────────
  'Riyadh HQ': 'المقر الرئيسي - الرياض',
  'Kingdom of Saudi Arabia': 'المملكة العربية السعودية',
  'Amman Office': 'مكتب عمّان',
  'Dubai Office': 'مكتب دبي',
  'Jeddah Branch': 'فرع جدة',
  'Riyadh Townhall & Zoom': 'قاعة الرياض و Zoom',
  'Main Boardroom B': 'قاعة الاجتماعات الرئيسية B',
  'Geofence Zone A': 'النطاق الجغرافي A',
  Remote: 'عن بُعد',
  Weekend: 'عطلة نهاية الأسبوع',
  'King Fahd Rd': 'طريق الملك فهد',
  'Riyadh Digital City': 'المدينة الرقمية بالرياض',

  // ── Events ───────────────────────────────────────────
  'Learning Tuesday Session': 'جلسة ثلاثاء التعلّم',
  'Q3 OKR Alignment & People Review': 'مواءمة أهداف الربع الثالث ومراجعة الأداء',

  // ── Approvals ────────────────────────────────────────
  'Regular Overtime': 'عمل إضافي اعتيادي',
  'Annual Vacation': 'إجازة سنوية',
  'Client Summit Travel Expense': 'مصاريف سفر قمة العملاء',
  'Expense Claim': 'مطالبة مصروفات',
  'Flight & Hotel': 'طيران وفندق',
  'Production release validation for Q1 payroll module.':
    'التحقق من إصدار وحدة الرواتب للربع الأول.',
  'Family travel — handover completed with Mohammad Jamal.':
    'سفر عائلي — تم تسليم المهام إلى محمد جمال.',
  'Jeddah Enterprise HR transformation workshop.':
    'ورشة تحول الموارد البشرية للشركات في جدة.',

  // ── Statuses / categories / types ────────────────────
  Pending: 'قيد الانتظار',
  Approved: 'مقبول',
  Rejected: 'مرفوض',
  Paid: 'مدفوع',
  Processing: 'قيد المعالجة',
  Complete: 'مكتمل',
  Incomplete: 'غير مكتمل',
  'In Office': 'في المكتب',
  'On Leave': 'في إجازة',
  Verified: 'موثّق',
  'Expiring Soon': 'ينتهي قريباً',
  Bonus: 'مكافأة',
  Overtime: 'عمل إضافي',
  Allowance: 'بدل',
  Loan: 'سلفة',
  'Time Off': 'إجازة',
  Financial: 'مالية',
  Letters: 'خطابات',
  Personal: 'شخصي',
  'Company Policy': 'سياسة الشركة',
  'Manager Approvals': 'موافقات المدير',
  Compliance: 'الامتثال',
  Performance: 'الأداء',
  Onboarding: 'التهيئة',
  'Remote Work': 'عمل عن بُعد',
  'Sick Day off': 'إجازة مرضية',
  'Emergency Leave': 'إجازة طارئة',
  'Unpaid Leave': 'إجازة بدون راتب',
  'Sick on file': 'مرضية موثقة',

  // ── Transactions ─────────────────────────────────────
  'Q3 Performance Spot Bonus': 'مكافأة أداء الربع الثالث',
  'Regular Overtime (2.00 hrs)': 'عمل إضافي اعتيادي (2.00 ساعة)',
  'LEAP Conference Registration Reimbursement': 'تعويض رسوم التسجيل في مؤتمر LEAP',
  'Mobile & Data Connectivity Allowance': 'بدل الجوال والاتصال بالإنترنت',
  'Annual Certification Exam Fee': 'رسوم اختبار الشهادة السنوية',

  // ── Documents ────────────────────────────────────────
  'Salary Certificate Letter (Embassy / Bank)': 'خطاب تعريف بالراتب (سفارة / بنك)',
  'Employment Contract & GOSI Registration': 'عقد العمل وتسجيل التأمينات الاجتماعية',
  'National ID / Iqama Copy': 'نسخة الهوية الوطنية / الإقامة',
  'Macquires Hybrid & Remote Work Policy 2026': 'سياسة العمل الهجين وعن بُعد في ماكوايرز 2026',
  'MENA Medical Insurance Network Guide': 'دليل شبكة التأمين الطبي في الشرق الأوسط',

  // ── Tasks ────────────────────────────────────────────
  'Approve Q4 Overtime & Leave Requests (3 pending)':
    'اعتماد طلبات العمل الإضافي والإجازات للربع الرابع (3 معلقة)',
  'Acknowledge SOC 2 Security & Data Privacy Policy':
    'الإقرار بسياسة أمن SOC 2 وخصوصية البيانات',
  'Complete Annual Performance Self-Assessment': 'إكمال التقييم الذاتي السنوي للأداء',
  'Update Emergency Contact Information': 'تحديث بيانات جهة الاتصال للطوارئ',

  // ── Schedule ─────────────────────────────────────────
  'Regular Morning Shift': 'دوام صباحي اعتيادي',
  'Flexible / Remote Eligible': 'مرن / متاح عن بُعد',
  'Shortened Shift': 'دوام مختصر',
  'Weekend Rest Day': 'يوم راحة نهاية الأسبوع',
  'Off Duty': 'خارج الدوام',

  // ── Notifications ────────────────────────────────────
  'New Overtime Request Pending Approval': 'طلب عمل إضافي جديد بانتظار الموافقة',
  'Sumaya Khalid submitted 2.00 hours of Regular Overtime (150.00 ﷼ SAR).':
    'قدّمت سمية خالد طلب عمل إضافي اعتيادي لمدة 2.00 ساعة (150.00 ﷼).',
  'October Salary Slip Ready for Preview': 'قسيمة راتب أكتوبر جاهزة للمعاينة',
  'Your October 2026 salary breakdown (Net: 17,985.00 ﷼ SAR) is now available.':
    'تفاصيل راتب أكتوبر 2026 (الصافي: 17,985.00 ﷼) متاحة الآن.',
  'Upcoming Colleague Birthday 🎂': 'عيد ميلاد زميل قادم 🎂',
  'Salim Khalidd’s birthday is coming up in 3 days (08 June).':
    'عيد ميلاد سالم خالد بعد 3 أيام (08 يونيو).',
  'Company Announcement: Learning Tuesday': 'إعلان الشركة: ثلاثاء التعلّم',
  'Join the upcoming Learning Tuesday Session at 10:55 AM.':
    'انضم إلى جلسة ثلاثاء التعلّم القادمة الساعة 10:55 ص.',

  // ── UI literals (modals / screens) ───────────────────
  Length: 'المدة',
  Notes: 'ملاحظات',
  'Attachment document': 'إرفاق مستند',
  'Select Date': 'تحديد التاريخ',
  'One Day': 'يوم واحد',
  'Multiple Days': 'عدة أيام',
  'From date': 'من تاريخ',
  'To date': 'إلى تاريخ',
  'Earnings Breakdown': 'تفاصيل المستحقات',
  'Basic Salary': 'الراتب الأساسي',
  'Housing Allowance (25%)': 'بدل السكن (25%)',
  'Transport Allowance (10%)': 'بدل النقل (10%)',
  'Approved Overtime': 'العمل الإضافي المعتمد',
  Deductions: 'الاستقطاعات',
  'GOSI Social Insurance': 'التأمينات الاجتماعية (GOSI)',
  'Net Salary': 'صافي الراتب',
  'Employee ID': 'الرقم الوظيفي',
  Department: 'القسم',
  Branch: 'الفرع',
  'Direct Manager': 'المدير المباشر',
  'GOSI Number': 'رقم التأمينات',
  'Join Date': 'تاريخ الانضمام',
  Email: 'البريد الإلكتروني',
  Phone: 'الهاتف',
  IBAN: 'الآيبان',
  'Push Notifications & Alerts': 'الإشعارات والتنبيهات',
  'Mark all read': 'تحديد الكل كمقروء',
  'Pay Date': 'تاريخ الصرف',
  Status: 'الحالة',
  Updated: 'آخر تحديث',
  Due: 'الاستحقاق',
  Today: 'اليوم',
  Completed: 'مكتمل',
  'Active Shift': 'دوام نشط',
  Search: 'بحث',
  'Search employees…': 'ابحث عن موظف…',
  'Search employees...': 'ابحث عن موظف...',
  'Claim title': 'عنوان المطالبة',
  'Amount (SAR)': 'المبلغ (ر.س)',
  Cancel: 'إلغاء',
  Submit: 'إرسال',
  Download: 'تنزيل',
  Preview: 'معاينة',
  Call: 'اتصال',
  All: 'الكل',
  Total: 'الإجمالي',
  Earnings: 'المستحقات',
  Net: 'الصافي',
};

const MONTHS_AR: Record<string, string> = {
  January: 'يناير', February: 'فبراير', March: 'مارس', April: 'أبريل',
  May: 'مايو', June: 'يونيو', July: 'يوليو', August: 'أغسطس',
  September: 'سبتمبر', October: 'أكتوبر', November: 'نوفمبر', December: 'ديسمبر',
  Jan: 'يناير', Feb: 'فبراير', Mar: 'مارس', Apr: 'أبريل', Jun: 'يونيو',
  Jul: 'يوليو', Aug: 'أغسطس', Sep: 'سبتمبر', Oct: 'أكتوبر', Nov: 'نوفمبر', Dec: 'ديسمبر',
};

const DAYS_AR: Record<string, string> = {
  Sunday: 'الأحد', Monday: 'الاثنين', Tuesday: 'الثلاثاء', Wednesday: 'الأربعاء',
  Thursday: 'الخميس', Friday: 'الجمعة', Saturday: 'السبت',
  Sun: 'أحد', Mon: 'اثنين', Tue: 'ثلاثاء', Wed: 'أربعاء', Thu: 'خميس', Fri: 'جمعة', Sat: 'سبت',
};

const PATTERN_RULES: Array<[RegExp, string | ((...m: string[]) => string)]> = [
  [
    new RegExp(`\\b(${Object.keys(MONTHS_AR).join("|")}) (\\d{1,2}),? (\\d{4})`, "g"),
    (_m, mon, d, y) => `${d} ${MONTHS_AR[mon] ?? mon} ${y}`,
  ],
  [
    new RegExp(`\\b(${Object.keys(MONTHS_AR).join("|")}) (\\d{1,2})\\b`, "g"),
    (_m, mon, d) => `${d} ${MONTHS_AR[mon] ?? mon}`,
  ],
  [/\b1(?:\.0+)?\s*days?\b(?! left)/gi, "يوم واحد"],
  [/,/g, "،"],
  [/(\d+(?:\.\d+)?)\s*days? left/gi, (_m, n) => `متبقي ${n} أيام`],
  [/(\d+(?:\.\d+)?)\s*days?\b/gi, (_m, n) => `${n} أيام`],
  [/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)\b/gi, (_m, n) => `${n} ساعات`],
  [/(\d+)\s*mins?\b/gi, (_m, n) => `${n} دقيقة`],
  [/(\d+)m ago/gi, (_m, n) => `منذ ${n} د`],
  [/(\d+)h ago/gi, (_m, n) => `منذ ${n} س`],
  [/(\d+)d ago/gi, (_m, n) => `منذ ${n} يوم`],
  [/Working hours:/gi, 'ساعات العمل:'],
  [/\bToday\b/g, 'اليوم'],
  [/\bCompleted\b/g, 'مكتمل'],
  [/\bActive Shift\b/g, 'دوام نشط'],
  [/\bSAR\b/g, 'ر.س'],
  [/\bAM\b/g, 'ص'],
  [/\bPM\b/g, 'م'],
  [
    new RegExp(`\\b(${Object.keys(MONTHS_AR).join('|')})\\b`, 'g'),
    (m) => MONTHS_AR[m] ?? m,
  ],
  [
    new RegExp(`\\b(${Object.keys(DAYS_AR).join('|')})\\b`, 'g'),
    (m) => DAYS_AR[m] ?? m,
  ],
];

const SEPARATORS = /(\s•\s|\s→\s|\s\/\s|\s—\s)/;

function applyPatterns(input: string): string {
  let out = input;
  for (const [re, rep] of PATTERN_RULES) {
    out = out.replace(re, rep as never);
  }
  return out;
}

function translateSegment(seg: string): string {
  const trimmed = seg.trim();
  if (!trimmed) return seg;
  const direct = DICT_AR[trimmed];
  if (direct) return seg.replace(trimmed, direct);

  // "Shift Name (09:00 AM - 05:00 PM)" → translate the part before "(".
  const paren = trimmed.match(/^(.+?)\s*\((.+)\)$/);
  if (paren) {
    const head = DICT_AR[paren[1]] ?? applyPatterns(paren[1]);
    const inner = DICT_AR[paren[2]] ?? applyPatterns(paren[2]);
    return `${head} (${inner})`;
  }
  return applyPatterns(seg);
}

/** Translate any display string into the active language. */
export function localize(lang: AppLanguage, value: string | number | undefined | null): string {
  if (value === undefined || value === null) return '';
  const str = String(value);
  if (lang !== 'ar' || !str) return str;

  const direct = DICT_AR[str];
  if (direct) return direct;

  if (SEPARATORS.test(str)) {
    return str
      .split(SEPARATORS)
      .map((part) => (SEPARATORS.test(part) ? part : translateSegment(part)))
      .join('');
  }
  return translateSegment(str);
}

/** Returns a bound translator for a given language: `const tr = makeTr(lang)`. */
export const makeTr =
  (lang: AppLanguage) =>
  (value: string | number | undefined | null): string =>
    localize(lang, value);

/** Format SAR amounts with locale-aware digits and currency label. */
export function formatSar(lang: AppLanguage, amount: number): string {
  const n = amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return lang === 'ar' ? `${n} ر.س` : `${n} SAR`;
}
