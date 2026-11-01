import type { AuthSession } from './authService';

declare const process: {
  env: {
    EXPO_PUBLIC_API_BASE_URL?: string;
  };
};

const EXPIRY_SKEW_SECONDS = 60;

export function decodeTokenExpiry(token: string): number | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  if (typeof globalThis.atob !== 'function') return null;
  try {
    const encoded = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const decoded = globalThis.atob(
      encoded.padEnd(Math.ceil(encoded.length / 4) * 4, '='),
    );
    const claims = JSON.parse(decoded) as { exp?: unknown };
    return typeof claims.exp === 'number' ? claims.exp : null;
  } catch {
    return null;
  }
}

export function isTokenExpiringSoon(
  token: string,
  skewSeconds = EXPIRY_SKEW_SECONDS,
): boolean {
  const expiry = decodeTokenExpiry(token);
  if (expiry === null) return true;
  return expiry - Math.floor(Date.now() / 1000) <= skewSeconds;
}

export function shouldRefreshToken(token: string): boolean {
  return isTokenExpiringSoon(token);
}

type AuthStorageModule = typeof import('./authStorage');

function authStorage(): AuthStorageModule {
  // Loaded lazily: the Node-run test suite imports this module, and authStorage
  // pulls in react-native and expo-secure-store.
  return require('./authStorage') as AuthStorageModule;
}

let refreshInFlight: Promise<AuthSession | null> | null = null;

export async function refreshStoredSession(): Promise<AuthSession | null> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    // allowExpired is essential: an expired access token is exactly when a
    // refresh is needed, and the default load would delete the session first.
    const stored = await authStorage().loadStoredAuthSession({ allowExpired: true });
    if (!stored?.refreshToken) return null;
    try {
      const response = await fetch(`${getApiBaseUrl()}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ refreshToken: stored.refreshToken }),
      });
      if (!response.ok) {
        await authStorage().clearStoredAuthSession();
        return null;
      }
      const body = (await response.json()) as {
        accessToken: string;
        refreshToken: string;
        user: { mustChangePassword?: boolean };
      };
      const next: AuthSession = {
        ...stored,
        token: body.accessToken,
        refreshToken: body.refreshToken,
        mustChangePassword: Boolean(body.user?.mustChangePassword),
      };
      await authStorage().saveAuthSession(next);
      return next;
    } catch {
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

export async function signOutStoredSession(): Promise<void> {
  const stored = await authStorage().loadStoredAuthSession({ allowExpired: true });
  if (stored?.token) {
    try {
      await fetch(`${getApiBaseUrl()}/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${stored.token}` },
      });
    } catch {
      // Local sign-out must succeed even when the API is unreachable.
    }
  }
  await authStorage().clearStoredAuthSession();
}

function getApiBaseUrl(): string {
  return process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:4000/api';
}
