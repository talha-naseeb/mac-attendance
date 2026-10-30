import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import type { AuthSession } from './authService';

const SESSION_KEY = 'macqhr.auth.session';

function isExpired(token: string): boolean {
  const parts = token.split('.');
  if (parts.length !== 3) return false;

  try {
    const encoded = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const decoded = globalThis.atob(encoded.padEnd(Math.ceil(encoded.length / 4) * 4, '='));
    const claims = JSON.parse(decoded) as { exp?: unknown };
    return typeof claims.exp === 'number' && claims.exp <= Math.floor(Date.now() / 1000);
  } catch {
    return true;
  }
}

export async function loadStoredAuthSession(): Promise<AuthSession | null> {
  try {
    const raw = Platform.OS === 'web'
      ? globalThis.sessionStorage?.getItem(SESSION_KEY)
      : await SecureStore.getItemAsync(SESSION_KEY);
    if (!raw) return null;

    const session = JSON.parse(raw) as AuthSession;
    if (!session.token || isExpired(session.token)) {
      await clearStoredAuthSession();
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export async function saveAuthSession(session: AuthSession): Promise<void> {
  const serialized = JSON.stringify(session);
  if (Platform.OS === 'web') {
    globalThis.sessionStorage?.setItem(SESSION_KEY, serialized);
    return;
  }
  await SecureStore.setItemAsync(SESSION_KEY, serialized);
}

export async function clearStoredAuthSession(): Promise<void> {
  if (Platform.OS === 'web') {
    globalThis.sessionStorage?.removeItem(SESSION_KEY);
    return;
  }
  await SecureStore.deleteItemAsync(SESSION_KEY);
}
