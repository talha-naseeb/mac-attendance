import { describe, expect, it } from 'vitest';
import {
  employeeStatusLabel,
  toCreateEmployeePayload,
  validateEmployeeDraft,
  type EmployeeDraft,
} from '../services/employeeForm';

const draft: EmployeeDraft = {
  employeeId: 'EMP-900',
  email: 'New.Hire@MacqHR.sa',
  firstName: 'New',
  lastName: 'Hire',
  department: 'Engineering',
  jobTitle: 'Engineer',
  role: 'EMPLOYEE',
  isSaudi: true,
  basicSalarySar: '12000',
  housingAllowanceSar: '2500',
  transportAllowanceSar: '1000',
  branchId: 'branch-1',
  managerId: '',
};

describe('employee form', () => {
  it('accepts a complete draft', () => {
    expect(validateEmployeeDraft(draft)).toEqual({});
  });

  it('flags missing identity and invalid salary', () => {
    const errors = validateEmployeeDraft({
      ...draft,
      employeeId: ' ',
      email: 'nope',
      basicSalarySar: '-1',
    });
    expect(errors.employeeId).toBeTruthy();
    expect(errors.email).toBeTruthy();
    expect(errors.basicSalarySar).toBeTruthy();
  });

  it('normalises email and omits empty relations', () => {
    const payload = toCreateEmployeePayload(draft);
    expect(payload.email).toBe('new.hire@macqhr.sa');
    expect(payload.managerId).toBeUndefined();
    expect(payload.basicSalarySar).toBe(12000);
  });
});

describe('employeeStatusLabel', () => {
  it('labels an active employee in both languages', () => {
    expect(employeeStatusLabel({ status: 'ACTIVE' }, false)).toBe('Active');
    expect(employeeStatusLabel({ status: 'ACTIVE' }, true)).toBe('نشط');
  });

  it('labels a remote employee in both languages', () => {
    expect(employeeStatusLabel({ status: 'REMOTE' }, false)).toBe('Remote');
    expect(employeeStatusLabel({ status: 'REMOTE' }, true)).toBe('عن بُعد');
  });

  it('labels an inactive employee in both languages', () => {
    expect(employeeStatusLabel({ status: 'INACTIVE' }, false)).toBe('Inactive');
    expect(employeeStatusLabel({ status: 'INACTIVE' }, true)).toBe('غير نشط');
  });
});
