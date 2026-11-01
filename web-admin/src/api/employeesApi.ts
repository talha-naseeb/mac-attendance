import type { AdminEmployee } from '../data/mockAdminData';
import { apiClient } from './client';

export interface EmployeeListQuery {
  search?: string;
  department?: string;
  branchId?: string;
  status?: 'ACTIVE' | 'INACTIVE' | 'ALL';
  sort?: 'employeeId' | 'name' | 'department' | 'status';
  direction?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

export interface EmployeeApiRecord {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  department: string;
  jobTitle: string;
  role: AdminEmployee['role'];
  isSaudi: boolean;
  isActive: boolean;
  nationalId: string | null;
  iqamaNumber: string | null;
  basicSalarySar: number;
  housingAllowanceSar: number;
  transportAllowanceSar: number;
  isRemoteAllowed: boolean;
  mustChangePassword: boolean;
  branch: { id: string; name: string; nameAr: string; code: string | null } | null;
  manager: { id: string; firstName: string; lastName: string } | null;
}

export interface EmployeeListPage {
  items: EmployeeApiRecord[];
  total: number;
  page: number;
  pageSize: number;
}

async function unwrap<T>(promise: Promise<{ data: T }>): Promise<T> {
  try {
    return (await promise).data;
  } catch (error: any) {
    const message = error?.response?.data?.message;
    throw new Error(Array.isArray(message) ? message.join(', ') : message || 'Request failed.');
  }
}

export function fetchEmployees(query: EmployeeListQuery) {
  return unwrap<EmployeeListPage>(apiClient.get('/employees/admin', { params: query }));
}

export function createEmployee(payload: Record<string, unknown>) {
  return unwrap<{ employee: EmployeeApiRecord; temporaryPassword: string }>(
    apiClient.post('/employees', payload),
  );
}

export function updateEmployee(id: string, payload: Record<string, unknown>) {
  return unwrap<EmployeeApiRecord>(apiClient.patch(`/employees/${id}`, payload));
}

export function applyEmploymentChange(id: string, payload: Record<string, unknown>) {
  return unwrap(apiClient.post(`/employees/${id}/changes`, payload));
}

export function deactivateEmployee(id: string, reason: string) {
  return unwrap(apiClient.post(`/employees/${id}/deactivate`, { reason }));
}

export function getEmployeePendingApprovals(id: string) {
  return unwrap<{ pendingApprovals: number }>(
    apiClient.get(`/employees/${id}/pending-approvals`),
  );
}

export function reactivateEmployee(id: string, reason: string) {
  return unwrap(apiClient.post(`/employees/${id}/reactivate`, { reason }));
}

export function resetEmployeePassword(id: string) {
  return unwrap<{ temporaryPassword: string }>(apiClient.post(`/employees/${id}/reset-password`));
}
