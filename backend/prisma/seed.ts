import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding Mac-HR Enterprise Database...');

  // 1. Seed Corporate Branches
  const riyadhHq = await prisma.branch.upsert({
    where: { name: 'Riyadh HQ - Digital City' },
    update: {},
    create: {
      name: 'Riyadh HQ - Digital City',
      nameAr: 'المقر الرئيسي - المدينة الرقمية، الرياض',
      code: 'RUH-HQ',
      city: 'Riyadh',
      cityAr: 'الرياض',
      address: 'Digital City, Building 4B, Riyadh 12382, Saudi Arabia',
      latitude: 24.7136,
      longitude: 46.6753,
      geofenceRadiusMeters: 150.0,
      radiusMeters: 150.0,
      wifiBssids: ['macquires-corp-hq', 'macquires-secure-wpa3'],
      bleBeacons: ['beacon-riyadh-entrance-01', 'beacon-riyadh-turnstile-02'],
    },
  });

  const olayaHub = await prisma.branch.upsert({
    where: { name: 'Olaya Financial Hub' },
    update: {},
    create: {
      name: 'Olaya Financial Hub',
      nameAr: 'مركز العليا المالي',
      code: 'RUH-OLAYA',
      city: 'Riyadh',
      cityAr: 'الرياض',
      address: 'King Fahd Road, Olaya Towers, Riyadh, Saudi Arabia',
      latitude: 24.6974,
      longitude: 46.6841,
      geofenceRadiusMeters: 150.0,
      radiusMeters: 150.0,
      wifiBssids: ['olaya-guest-wpa2', 'olaya-corp-mesh'],
      bleBeacons: ['beacon-olaya-lobby-01'],
    },
  });

  const jeddahBranch = await prisma.branch.upsert({
    where: { name: 'Jeddah Regional Office' },
    update: {},
    create: {
      name: 'Jeddah Regional Office',
      nameAr: 'فرع جدة الإقليمي',
      code: 'JED-REG',
      city: 'Jeddah',
      cityAr: 'جدة',
      address: 'Corniche Road, Al-Shati District, Jeddah, Saudi Arabia',
      latitude: 21.5433,
      longitude: 39.1728,
      geofenceRadiusMeters: 200.0,
      radiusMeters: 200.0,
      wifiBssids: ['jeddah-corp-net'],
    },
  });

  const defaultPasswordHash = await bcrypt.hash('Password123!', 10);

  // 2. Seed Super Admin (C-Level Executive & System Owner)
  const superAdmin = await prisma.user.upsert({
    where: { email: 'superadmin@macqhr.sa' },
    update: {},
    create: {
      employeeId: 'EMP-001',
      email: 'superadmin@macqhr.sa',
      passwordHash: defaultPasswordHash,
      role: UserRole.SUPER_ADMIN,
      canAccessWebAdmin: true,
      isAttendanceExempt: true,
      firstName: 'Sultan',
      lastName: 'Al-Otaibi',
      fullName: 'Sultan Al-Otaibi',
      fullNameAr: 'سلطان العتيبي',
      jobTitle: 'Chief Executive Officer (CEO)',
      titleAr: 'الرئيس التنفيذي ومدير النظام',
      department: 'Executive Board',
      departmentAr: 'الإدارة التنفيذية',
      phone: '+966 54 112 3344',
      isSaudi: true,
      nationalId: '1099887766',
      basicSalarySar: 45000.0,
      housingAllowanceSar: 10000.0,
      transportAllowanceSar: 2500.0,
      avatarInitials: 'SO',
      avatarPresetId: 'dark',
      avatarColor: '#001D38',
      branchId: riyadhHq.id,
    },
  });

  // 3. Seed HR Admin (HR Specialist - is an employee who punches & manages)
  const hrAdmin = await prisma.user.upsert({
    where: { email: 'sara.alotaibi@macqhr.sa' },
    update: {},
    create: {
      employeeId: 'EMP-002',
      email: 'sara.alotaibi@macqhr.sa',
      passwordHash: defaultPasswordHash,
      role: UserRole.HR_ADMIN,
      canAccessWebAdmin: true,
      isAttendanceExempt: false,
      firstName: 'Sara',
      lastName: 'Al-Otaibi',
      fullName: 'Sara Al-Otaibi',
      fullNameAr: 'سارة العتيبي',
      jobTitle: 'Senior HR Operations Lead',
      titleAr: 'مسؤول أول عمليات الموارد البشرية',
      department: 'People & Culture',
      departmentAr: 'الموارد البشرية والثقافة المؤسسية',
      phone: '+966 56 334 5566',
      isSaudi: true,
      nationalId: '1088776655',
      basicSalarySar: 18000.0,
      housingAllowanceSar: 4500.0,
      transportAllowanceSar: 1500.0,
      avatarInitials: 'SO',
      avatarPresetId: 'teal',
      avatarColor: '#007A78',
      branchId: riyadhHq.id,
      managerId: superAdmin.id,
    },
  });

  // 4. Seed Line Manager (Engineering Lead)
  const manager = await prisma.user.upsert({
    where: { email: 'tariq.ghamdi@macqhr.sa' },
    update: {},
    create: {
      employeeId: 'EMP-003',
      email: 'tariq.ghamdi@macqhr.sa',
      passwordHash: defaultPasswordHash,
      role: UserRole.MANAGER,
      canAccessWebAdmin: false,
      isAttendanceExempt: false,
      firstName: 'Tariq',
      lastName: 'Al-Ghamdi',
      fullName: 'Tariq Al-Ghamdi',
      fullNameAr: 'طارق الغامدي',
      jobTitle: 'Engineering Director',
      titleAr: 'مدير قطاع الهندسة البرمجية',
      department: 'Engineering',
      departmentAr: 'الهندسة البرمجية',
      phone: '+966 55 901 2233',
      isSaudi: true,
      nationalId: '1077665544',
      basicSalarySar: 24000.0,
      housingAllowanceSar: 6000.0,
      transportAllowanceSar: 2000.0,
      avatarInitials: 'TG',
      avatarPresetId: 'orange',
      avatarColor: '#FE5800',
      branchId: riyadhHq.id,
      managerId: superAdmin.id,
    },
  });

  // 5. Seed Standard Employees
  const employee1 = await prisma.user.upsert({
    where: { email: 'rahaf.mansoor@macqhr.sa' },
    update: {},
    create: {
      employeeId: 'EMP-004',
      email: 'rahaf.mansoor@macqhr.sa',
      passwordHash: defaultPasswordHash,
      role: UserRole.EMPLOYEE,
      canAccessWebAdmin: false,
      isAttendanceExempt: false,
      isRemoteAllowed: false,
      firstName: 'Rahaf',
      lastName: 'Al-Mansoor',
      fullName: 'Rahaf Al-Mansoor',
      fullNameAr: 'رهف المنصور',
      jobTitle: 'Software Engineer',
      titleAr: 'مهندس برمجيات',
      department: 'Engineering',
      departmentAr: 'الهندسة البرمجية',
      phone: '+966 50 482 9104',
      isSaudi: true,
      nationalId: '1066554433',
      basicSalarySar: 14000.0,
      housingAllowanceSar: 3500.0,
      transportAllowanceSar: 1200.0,
      avatarInitials: 'RM',
      avatarPresetId: 'coral',
      avatarColor: '#FE5800',
      branchId: riyadhHq.id,
      managerId: manager.id,
    },
  });

  const employee2 = await prisma.user.upsert({
    where: { email: 'bilal.rehman@macqhr.sa' },
    update: {},
    create: {
      employeeId: 'EMP-005',
      email: 'bilal.rehman@macqhr.sa',
      passwordHash: defaultPasswordHash,
      role: UserRole.EMPLOYEE,
      canAccessWebAdmin: false,
      isAttendanceExempt: false,
      isRemoteAllowed: true,
      remoteLocation: 'Lahore, Pakistan (Remote Tech Hub)',
      firstName: 'Bilal',
      lastName: 'Rehman',
      fullName: 'Bilal Rehman',
      fullNameAr: 'بلال رحمن',
      jobTitle: 'Senior Mobile Architect',
      titleAr: 'كبير مهندسي تطبيقات الهواتف',
      department: 'Engineering',
      departmentAr: 'الهندسة البرمجية',
      phone: '+92 300 1234567',
      isSaudi: false,
      iqamaNumber: '2498765432',
      basicSalarySar: 18000.0,
      housingAllowanceSar: 4500.0,
      transportAllowanceSar: 1500.0,
      avatarInitials: 'BR',
      avatarPresetId: 'emerald',
      avatarColor: '#00875A',
      branchId: olayaHub.id,
      managerId: manager.id,
    },
  });

  // Seed Leave Balances for 2026
  const allUsers = [superAdmin, hrAdmin, manager, employee1, employee2];
  const year = 2026;

  for (const user of allUsers) {
    const balances = [
      { leaveType: 'ANNUAL', totalDays: 30, usedDays: 3 },
      { leaveType: 'SICK', totalDays: 30, usedDays: 0 },
      { leaveType: 'HAJJ', totalDays: 10, usedDays: 0 },
      { leaveType: 'PATERNITY', totalDays: 3, usedDays: 0 },
    ];

    for (const b of balances) {
      await prisma.leaveBalance.upsert({
        where: {
          userId_leaveType_year: {
            userId: user.id,
            leaveType: b.leaveType,
            year,
          },
        },
        update: {},
        create: {
          userId: user.id,
          leaveType: b.leaveType,
          totalDays: b.totalDays,
          usedDays: b.usedDays,
          remainingDays: b.totalDays - b.usedDays,
          year,
        },
      });
    }
  }

  console.log('✅ Seed completed successfully!');
  console.log('🔑 Default credentials for all accounts:');
  console.log('   Super Admin: superadmin@macqhr.sa / Password123!');
  console.log('   HR Admin:    sara.alotaibi@macqhr.sa / Password123!');
  console.log('   Manager:     tariq.ghamdi@macqhr.sa / Password123!');
  console.log('   Employee 1:  rahaf.mansoor@macqhr.sa / Password123!');
  console.log('   Employee 2:  bilal.rehman@macqhr.sa / Password123!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
