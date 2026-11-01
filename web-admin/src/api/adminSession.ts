export const ADMIN_SESSION_KEY = 'macq_admin_session';

export const SESSION_EXPIRED_EVENT = 'macq:session-expired';

export interface UserSession {
  token: string;
  user: {
    id: string;
    employeeId: string;
    firstName: string;
    lastName: string;
    name: string;
    email: string;
    role: 'SUPER_ADMIN' | 'HR_ADMIN';
    department: string;
    jobTitle: string;
    avatarUrl?: string;
    canAccessWebAdmin: boolean;
  };
}

export function isJwtExpired(token: string): boolean {
  const parts = token.split('.');
  if (parts.length !== 3) return true;
  try {
    const encoded = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const claims = JSON.parse(atob(encoded.padEnd(Math.ceil(encoded.length / 4) * 4, '='))) as {
      exp?: unknown;
    };
    return typeof claims.exp !== 'number' || claims.exp <= Math.floor(Date.now() / 1000);
  } catch {
    return true;
  }
}

export function storeAdminSession(session: UserSession): void {
  sessionStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(session));
}

export function clearAdminSession(): void {
  sessionStorage.removeItem(ADMIN_SESSION_KEY);
}

export function getStoredAdminSession(): UserSession | null {
  try {
    const raw = sessionStorage.getItem(ADMIN_SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as UserSession;
    if (!session.token || !session.user) {
      clearAdminSession();
      return null;
    }
    const { role, canAccessWebAdmin } = session.user;
    if (!canAccessWebAdmin || (role !== 'HR_ADMIN' && role !== 'SUPER_ADMIN')) {
      clearAdminSession();
      return null;
    }
    if (isJwtExpired(session.token)) {
      clearAdminSession();
      return null;
    }
    return session;
  } catch {
    clearAdminSession();
    return null;
  }
}
