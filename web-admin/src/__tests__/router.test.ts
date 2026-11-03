import { describe, expect, it } from 'vitest';
import { pathForTab, tabFromPath } from '../router';

describe('admin router helpers', () => {
  it('resolves valid route paths to their corresponding admin tab', () => {
    expect(tabFromPath('/dashboard')).toBe('overview');
    expect(tabFromPath('/home')).toBe('overview');
    expect(tabFromPath('/overview')).toBe('overview');
    expect(tabFromPath('/employees')).toBe('employees');
    expect(tabFromPath('/attendance')).toBe('attendance');
    expect(tabFromPath('/branches')).toBe('branches');
    expect(tabFromPath('/leaves')).toBe('leaves');
    expect(tabFromPath('/payroll')).toBe('payroll');
    expect(tabFromPath('/logs')).toBe('logs');
    expect(tabFromPath('/audit-logs')).toBe('logs');
  });

  it('defaults root or unknown paths to overview', () => {
    expect(tabFromPath('/')).toBe('overview');
    expect(tabFromPath('')).toBe('overview');
    expect(tabFromPath('/unknown-route')).toBe('overview');
  });

  it('formats canonical paths for each tab', () => {
    expect(pathForTab('overview')).toBe('/dashboard');
    expect(pathForTab('employees')).toBe('/employees');
    expect(pathForTab('logs')).toBe('/logs');
  });
});
