import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

export const TEST_PASSWORD = 'Password123!';

export async function createBranch(prisma: PrismaClient, name = 'Riyadh HQ') {
  return prisma.branch.upsert({
    where: { name },
    update: {},
    create: {
      name,
      nameAr: name,
      city: 'Riyadh',
      cityAr: 'الرياض',
      latitude: 24.7136,
      longitude: 46.6753,
    },
  });
}

export async function createUser(
  prisma: PrismaClient,
  overrides: Partial<{
    email: string;
    employeeId: string;
    role: 'EMPLOYEE' | 'MANAGER' | 'HR_ADMIN' | 'SUPER_ADMIN';
    isActive: boolean;
    mustChangePassword: boolean;
    branchId: string | null;
    managerId: string | null;
  }> = {},
) {
  const branch = overrides.branchId === undefined ? await createBranch(prisma) : null;
  return prisma.user.create({
    data: {
      employeeId: overrides.employeeId ?? 'EMP-T01',
      email: overrides.email ?? 'test.employee@macqhr.sa',
      passwordHash: await bcrypt.hash(TEST_PASSWORD, 10),
      role: overrides.role ?? 'EMPLOYEE',
      firstName: 'Test',
      lastName: 'Employee',
      fullName: 'Test Employee',
      fullNameAr: 'موظف اختبار',
      jobTitle: 'Engineer',
      department: 'Engineering',
      isSaudi: true,
      basicSalarySar: 10000,
      branchId: overrides.branchId === undefined ? branch!.id : overrides.branchId,
      managerId: overrides.managerId ?? null,
      isActive: overrides.isActive ?? true,
      mustChangePassword: overrides.mustChangePassword ?? false,
      canAccessWebAdmin:
        overrides.role === 'HR_ADMIN' || overrides.role === 'SUPER_ADMIN',
    },
  });
}
