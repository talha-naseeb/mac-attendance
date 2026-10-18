import { CURRENT_EMPLOYEE } from '../data/mockData';
import { UserRole } from './dashboardOptimizationService';
import { deriveAvatarInitials, EditableEmployeeProfile } from './profileSettingsService';
import { MACQUIRES_PALETTE } from '../theme/colors';

export interface AuthCredentials {
  email: string;
  password?: string;
  role?: UserRole;
}

export interface AuthSession {
  token: string;
  role: UserRole;
  profile: EditableEmployeeProfile;
  authenticatedAt: number;
  authMethod: 'PASSWORD' | 'MICROSOFT_365_SSO';
}

export const DEMO_USERS: Record<UserRole, EditableEmployeeProfile> = {
  EMPLOYEE: {
    ...CURRENT_EMPLOYEE,
    id: 'EMP-1042',
    fullName: 'Rahaf Al-Mansoor',
    fullNameAr: 'رهف المنصور',
    title: 'Senior HR Specialist',
    department: 'People & Culture',
    email: 'rahaf.mansoor@macquires.sa',
    phone: '+966 50 482 9104',
    avatarInitials: 'RM',
    avatarPresetId: 'navy',
    avatarColor: MACQUIRES_PALETTE.prussianBlue,
  },
  MANAGER: {
    ...CURRENT_EMPLOYEE,
    id: 'MGR-2041',
    fullName: 'Tariq Al-Ghamdi',
    fullNameAr: 'طارق الغامدي',
    title: 'Engineering Director & Line Manager',
    department: 'Software Engineering',
    email: 'tariq.ghamdi@macquires.sa',
    phone: '+966 55 901 2233',
    avatarInitials: 'TG',
    avatarPresetId: 'orange',
    avatarColor: MACQUIRES_PALETTE.orangePantone,
  },
  HR_ADMIN: {
    ...CURRENT_EMPLOYEE,
    id: 'ADM-0012',
    fullName: 'Sultan Al-Otaibi',
    fullNameAr: 'سلطان العتيبي',
    title: 'Chief Human Resources Officer (CHRO)',
    department: 'Executive Board',
    email: 'sultan.otaibi@macquires.sa',
    phone: '+966 54 112 3344',
    avatarInitials: 'SO',
    avatarPresetId: 'dark',
    avatarColor: MACQUIRES_PALETTE.oxfordBlue,
  },
};

/**
 * Resolves account role from corporate email identity.
 */
export function resolveRoleFromEmail(email: string): UserRole {
  const normalized = email.trim().toLowerCase();
  for (const [r, profile] of Object.entries(DEMO_USERS) as [UserRole, EditableEmployeeProfile][]) {
    if (profile.email.toLowerCase() === normalized) {
      return r;
    }
  }
  return 'EMPLOYEE';
}

export interface AuthValidationResult {
  valid: boolean;
  error?: 'EMPTY_EMAIL' | 'INVALID_EMAIL' | 'SHORT_PASSWORD';
  session?: AuthSession;
}

/**
 * Validates login input and creates an authenticated session with user profile and role claims.
 */
export function validateAndAuthenticate(
  credentials: AuthCredentials
): AuthValidationResult {
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

  const resolvedRole = credentials.role ?? resolveRoleFromEmail(trimmedEmail);
  const baseProfile = DEMO_USERS[resolvedRole] || DEMO_USERS.EMPLOYEE;
  const userProfile: EditableEmployeeProfile = {
    ...baseProfile,
    email: trimmedEmail,
    avatarInitials: deriveAvatarInitials(baseProfile.fullName),
  };

  return {
    valid: true,
    session: {
      token: `macqhr-jwt-${resolvedRole.toLowerCase()}-${Date.now()}`,
      role: resolvedRole,
      profile: userProfile,
      authenticatedAt: Date.now(),
      authMethod: 'PASSWORD',
    },
  };
}

/**
 * Creates an authenticated session via simulated Microsoft 365 / Entra ID SSO.
 */
export function authenticateWithMicrosoftSso(role: UserRole = 'EMPLOYEE'): AuthSession {
  const profile = DEMO_USERS[role] || DEMO_USERS.EMPLOYEE;
  return {
    token: `ms-entra-id-jwt-${role.toLowerCase()}-${Date.now()}`,
    role,
    profile,
    authenticatedAt: Date.now(),
    authMethod: 'MICROSOFT_365_SSO',
  };
}
