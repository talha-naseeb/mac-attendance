import { UserRole } from './dashboardOptimizationService';
import { EditableEmployeeProfile } from './profileSettingsService';
import {
  ApiAuthSession,
  authenticateWithBackend,
  BackendApiError,
} from './backendApi';

export interface AuthCredentials {
  email: string;
  password?: string;
  role?: UserRole;
}

export interface AuthSession {
  token: string;
  refreshToken?: string;
  role: UserRole;
  profile: EditableEmployeeProfile;
  authenticatedAt: number;
  authMethod: 'PASSWORD';
  branchId?: string;
  isRemoteAllowed: boolean;
  mustChangePassword?: boolean;
}

export interface CredentialValidation {
  valid: boolean;
  error?: 'EMPTY_EMAIL' | 'INVALID_EMAIL' | 'SHORT_PASSWORD';
}

/**
 * Validates login input before it is sent to the API. Session creation and
 * role resolution now happen on the server.
 */
export function validateCredentials(credentials: AuthCredentials): CredentialValidation {
  const trimmedEmail = (credentials.email || '').trim().toLowerCase();
  const password = credentials.password || '';

  if (!trimmedEmail) {
    return { valid: false, error: 'EMPTY_EMAIL' };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmedEmail)) {
    return { valid: false, error: 'INVALID_EMAIL' };
  }

  if (password.length > 0 && password.length < 6) {
    return { valid: false, error: 'SHORT_PASSWORD' };
  }

  return { valid: true };
}

export type PasswordChangeValidationError = 'PASSWORD_TOO_SHORT' | 'SAME_PASSWORD';

/**
 * Client-side replacement-password rules, shared with the forced password
 * change screen. The API re-checks the current password and applies its own
 * policy, so these are fast-feedback checks only.
 */
export function validatePasswordChange(
  currentPassword: string,
  newPassword: string,
): PasswordChangeValidationError | null {
  if (newPassword.length < 8) return 'PASSWORD_TOO_SHORT';
  if (currentPassword === newPassword) return 'SAME_PASSWORD';
  return null;
}

/**
 * Authenticates the mobile app against the NestJS API and maps its corporate
 * user record into the app's existing profile contract.
 */
export async function authenticateWithPasswordApi(
  credentials: AuthCredentials,
): Promise<AuthSession> {
  const validation = validateCredentials(credentials);
  if (!validation.valid) {
    throw new BackendApiError('Enter a valid work email and a password of at least 6 characters.');
  }

  const backendSession: ApiAuthSession = await authenticateWithBackend(
    credentials.email.trim().toLowerCase(),
    credentials.password || '',
  );
  return {
    token: backendSession.token,
    refreshToken: backendSession.refreshToken,
    role: backendSession.role,
    profile: backendSession.profile,
    branchId: backendSession.branchId,
    isRemoteAllowed: backendSession.isRemoteAllowed,
    authenticatedAt: Date.now(),
    authMethod: 'PASSWORD',
    mustChangePassword: backendSession.mustChangePassword,
  };
}
