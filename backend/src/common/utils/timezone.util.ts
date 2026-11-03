export const RIYADH_TIMEZONE = 'Asia/Riyadh';
export const KARACHI_TIMEZONE = 'Asia/Karachi';

export interface UserLocationContext {
  branch?: {
    city?: string | null;
    name?: string | null;
  } | null;
  isRemoteAllowed?: boolean;
}

/**
 * Returns YYYY-MM-DD representing the calendar date in the specified timezone.
 * Defaults to Asia/Riyadh.
 */
export function getLocalDateIso(
  date: Date = new Date(),
  timezone: string = RIYADH_TIMEZONE,
): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: RIYADH_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  }
}

/**
 * Resolves working timezone for an employee based on branch or remote hub metadata.
 */
export function resolveUserTimezone(user?: UserLocationContext | null): string {
  if (!user) return RIYADH_TIMEZONE;

  const cityName = user.branch?.city?.toLowerCase() || '';
  const branchName = user.branch?.name?.toLowerCase() || '';

  if (
    cityName.includes('karachi') ||
    cityName.includes('pakistan') ||
    cityName.includes('lahore') ||
    cityName.includes('islamabad') ||
    branchName.includes('pakistan') ||
    branchName.includes('karachi')
  ) {
    return KARACHI_TIMEZONE;
  }

  return RIYADH_TIMEZONE;
}

/**
 * Formats a given Date as "hh:mm A" (e.g. "09:15 AM") in the specified timezone.
 */
export function formatLocalClockTime(
  date: Date = new Date(),
  timezone: string = RIYADH_TIMEZONE,
): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: RIYADH_TIMEZONE,
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(date);
  }
}
