import { describe, expect, it } from 'vitest';
import { mapEmployee } from '../api/client';
import type { EmployeeApiRecord } from '../api/employeesApi';

const record: EmployeeApiRecord = {
  id: 'emp-1',
  employeeId: 'EMP-001',
  firstName: 'Sara',
  lastName: 'Al-Otaibi',
  email: 'sara.alotaibi@macqhr.sa',
  phone: null,
  department: 'Engineering',
  jobTitle: 'Engineer',
  role: 'EMPLOYEE',
  isSaudi: true,
  isActive: true,
  nationalId: '1234567890',
  iqamaNumber: null,
  basicSalarySar: 12000,
  housingAllowanceSar: 2500,
  transportAllowanceSar: 1000,
  isRemoteAllowed: false,
  mustChangePassword: false,
  branch: null,
  manager: null,
};

describe('mapEmployee', () => {
  it('maps an inactive employee and populates the active flag', () => {
    const mapped = mapEmployee({
      ...record,
      isActive: false,
      isRemoteAllowed: true,
    });

    expect(mapped.status).toBe('INACTIVE');
    expect(mapped.isActive).toBe(false);
  });

  it('maps an active remote employee', () => {
    const mapped = mapEmployee({
      ...record,
      isActive: true,
      isRemoteAllowed: true,
    });

    expect(mapped.status).toBe('REMOTE');
  });
});
