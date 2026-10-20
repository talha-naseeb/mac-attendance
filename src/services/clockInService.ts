export type WorkLocationMode = 'remote_pakistan' | 'office_riyadh';

export interface ClockEligibilityVerdict {
  canClock: boolean;
  modeLabel: string;
  headquartersLabel: string;
  locationStatusText: string;
  isRemote: boolean;
}

/**
 * Evaluates whether an employee is eligible to clock in/out.
 * Remote employees (e.g. based in Pakistan) are exempt from Riyadh office
 * geofence boundaries while keeping full audit transparency with Riyadh HQ.
 */
export function evaluateClockEligibility(
  mode: WorkLocationMode,
  geofenceAllowed: boolean,
  currentAddressLabel?: string
): ClockEligibilityVerdict {
  if (mode === 'remote_pakistan') {
    return {
      canClock: true,
      modeLabel: 'Remote — Pakistan (PKT GMT+5)',
      headquartersLabel: 'Headquarters: Riyadh, KSA (AST GMT+3)',
      locationStatusText: currentAddressLabel
        ? `Remote Active: ${currentAddressLabel}`
        : 'Remote Work Active (Pakistan)',
      isRemote: true,
    };
  }

  return {
    canClock: geofenceAllowed,
    modeLabel: 'Office — Riyadh HQ (AST GMT+3)',
    headquartersLabel: 'Headquarters: Riyadh, KSA',
    locationStatusText: geofenceAllowed
      ? 'Inside Office Geofence (Riyadh HQ)'
      : 'Outside Authorized Office Zone',
    isRemote: false,
  };
}

/**
 * Computes elapsed hours and minutes from minutes count.
 */
export function formatElapsedWorkingTime(elapsedMinutes: number): {
  hours: number;
  minutes: number;
  formattedString: string;
} {
  const safeMinutes = Math.max(0, elapsedMinutes);
  const hours = Math.floor(safeMinutes / 60);
  const minutes = safeMinutes % 60;
  return {
    hours,
    minutes,
    formattedString: `${hours}h ${minutes}m`,
  };
}
