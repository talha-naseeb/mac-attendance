import type { AdminEmployee } from '../data/mockAdminData';

export interface EmployeeDraft {
  employeeId: string;
  email: string;
  firstName: string;
  lastName: string;
  department: string;
  jobTitle: string;
  role: 'EMPLOYEE' | 'MANAGER' | 'HR_ADMIN' | 'SUPER_ADMIN';
  isSaudi: boolean;
  basicSalarySar: string;
  housingAllowanceSar: string;
  transportAllowanceSar: string;
  branchId: string;
  managerId: string;
}

export function validateEmployeeDraft(draft: EmployeeDraft): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!draft.employeeId.trim()) errors.employeeId = 'Employee ID is required.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email.trim())) {
    errors.email = 'Enter a valid work email.';
  }
  if (!draft.firstName.trim()) errors.firstName = 'First name is required.';
  if (!draft.lastName.trim()) errors.lastName = 'Last name is required.';
  if (!draft.department.trim()) errors.department = 'Department is required.';
  if (!draft.jobTitle.trim()) errors.jobTitle = 'Job title is required.';
  if (!(Number(draft.basicSalarySar) >= 0) || draft.basicSalarySar.trim() === '') {
    errors.basicSalarySar = 'Basic salary must be zero or more.';
  }
  return errors;
}

export function toCreateEmployeePayload(draft: EmployeeDraft) {
  return {
    employeeId: draft.employeeId.trim(),
    email: draft.email.trim().toLowerCase(),
    firstName: draft.firstName.trim(),
    lastName: draft.lastName.trim(),
    department: draft.department.trim(),
    jobTitle: draft.jobTitle.trim(),
    role: draft.role,
    isSaudi: draft.isSaudi,
    basicSalarySar: Number(draft.basicSalarySar),
    housingAllowanceSar: Number(draft.housingAllowanceSar || 0),
    transportAllowanceSar: Number(draft.transportAllowanceSar || 0),
    branchId: draft.branchId || undefined,
    managerId: draft.managerId || undefined,
  };
}

const EMPLOYEE_STATUS_LABELS: Record<
  AdminEmployee['status'],
  { en: string; ar: string }
> = {
  ACTIVE: { en: 'Active', ar: 'نشط' },
  REMOTE: { en: 'Remote', ar: 'عن بُعد' },
  INACTIVE: { en: 'Inactive', ar: 'غير نشط' },
};

export function employeeStatusLabel(
  employee: Pick<AdminEmployee, 'status'>,
  isArabic: boolean,
): string {
  const label = EMPLOYEE_STATUS_LABELS[employee.status];
  return isArabic ? label.ar : label.en;
}
