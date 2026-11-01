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

type SessionListener = (session: AuthSession) => void;
const sessionListeners = new Set<SessionListener>();
const expiryListeners = new Set<() => void>();

export function subscribeToSession(listener: SessionListener): () => void {
  sessionListeners.add(listener);
  return () => {
    sessionListeners.delete(listener);
  };
}

export function subscribeToSessionExpired(listener: () => void): () => void {
  expiryListeners.add(listener);
  return () => {
    expiryListeners.delete(listener);
  };
}

export function notifySessionExpired(): void {
  expiryListeners.forEach((listener) => listener());
}

// Incremented on sign-out. A refresh that started under an older epoch must not
// write a session back after storage was cleared.
let sessionEpoch = 0;

export async function refreshStoredSession(): Promise<AuthSession | null> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    const epoch = sessionEpoch;
    try {
      // allowExpired is essential: an expired access token is exactly when a
      // refresh is needed, and the default load would delete the session first.
      const stored = await authStorage().loadStoredAuthSession({ allowExpired: true });
      if (!stored?.refreshToken) {
        // Nothing to refresh with. Drop a session that can never be used again,
        // but keep one whose access token is still valid.
        if (stored && isTokenExpiringSoon(stored.token)) {
          await authStorage().clearStoredAuthSession();
        }
        return null;
      }
      const response = await fetch(`${getApiBaseUrl()}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ refreshToken: stored.refreshToken }),
      });
      if (!response.ok) {
        // Only a rejected refresh token invalidates the session. A 5xx or 429
        // is transient and the stored refresh token must survive for a retry.
        if (response.status === 401 || response.status === 403) {
          await authStorage().clearStoredAuthSession();
        }
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
      if (epoch !== sessionEpoch) return null;
      await authStorage().saveAuthSession(next);
      sessionListeners.forEach((listener) => listener(next));
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
  sessionEpoch += 1;
  const stored = await authStorage().loadStoredAuthSession({ allowExpired: true });
  // Clear before any network work: a pending refresh must not restore the
  // session, and a fast re-login must not be wiped by this sign-out.
  await authStorage().clearStoredAuthSession();
  if (!stored?.token) return;
  let token = stored.token;
  if (isTokenExpiringSoon(token) && stored.refreshToken) {
    // The logout endpoint authenticates with the access token. Mint a fresh one
    // from the captured refresh token so the server session is actually revoked.
    try {
      const response = await fetch(`${getApiBaseUrl()}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ refreshToken: stored.refreshToken }),
      });
      if (response.ok) {
        const body = (await response.json()) as { accessToken?: string };
        if (body.accessToken) token = body.accessToken;
      }
    } catch {
      // Fall through to the best-effort logout with the stored token.
    }
  }
  try {
    await fetch(`${getApiBaseUrl()}/auth/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    // Local sign-out must succeed even when the API is unreachable.
  }
}

function getApiBaseUrl(): string {
  return process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:4000/api';
}
