import { describe, expect, it } from 'vitest';
import {
  formatWorkspaceRoleLabel,
  resolveAdminRoleFromMembership,
} from '../api/workspacesApi';

describe('Phase 13 workspace UI helpers', () => {
  it('labels PERSONAL workspace owner role as "You" (EN) / "أنت" (AR)', () => {
    expect(formatWorkspaceRoleLabel('OWNER', 'PERSONAL', false)).toBe('You');
    expect(formatWorkspaceRoleLabel('OWNER', 'PERSONAL', true)).toBe('أنت');
  });

  it('formats BUSINESS membership roles in English and Arabic', () => {
    expect(formatWorkspaceRoleLabel('OWNER', 'BUSINESS', false)).toBe('Owner');
    expect(formatWorkspaceRoleLabel('HR_ADMIN', 'BUSINESS', false)).toBe('HR Admin');
    expect(formatWorkspaceRoleLabel('MANAGER', 'BUSINESS', false)).toBe('Manager');
    expect(formatWorkspaceRoleLabel('EMPLOYEE', 'BUSINESS', false)).toBe('Employee');
    expect(formatWorkspaceRoleLabel('OWNER', 'BUSINESS', true)).toBe('المالك');
  });

  it('maps admin-capable membership roles to web-admin session roles', () => {
    expect(resolveAdminRoleFromMembership('OWNER')).toBe('SUPER_ADMIN');
    expect(resolveAdminRoleFromMembership('HR_ADMIN')).toBe('HR_ADMIN');
    expect(resolveAdminRoleFromMembership('MANAGER')).toBeNull();
    expect(resolveAdminRoleFromMembership('EMPLOYEE')).toBeNull();
  });
});
