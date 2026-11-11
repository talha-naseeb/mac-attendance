import type { AdminTab } from './components/Sidebar';

const VALID_TABS: readonly AdminTab[] = [
  'overview',
  'attendance',
  'branches',
  'leaves',
  'employees',
  'payroll',
  'workspaces',
  'logs',
];

export function tabFromPath(pathname: string): AdminTab {
  const cleaned = pathname.replace(/^\/+|\/+$/g, '').split('/')[0]?.toLowerCase();
  if (cleaned === 'dashboard' || cleaned === 'home' || cleaned === 'overview') {
    return 'overview';
  }
  if (cleaned === 'audit-logs') {
    return 'logs';
  }
  if (cleaned && (VALID_TABS as readonly string[]).includes(cleaned)) {
    return cleaned as AdminTab;
  }
  return 'overview';
}

export function pathForTab(tab: AdminTab): string {
  if (tab === 'overview') {
    return '/dashboard';
  }
  return `/${tab}`;
}
