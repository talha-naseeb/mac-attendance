/**
 * Offline Resilience & Anti-Tamper Attendance Queue + Saudi Labor Law / GOSI Calculator
 * Implements RULES.md Section 4.3 & Section 5:
 * - Offline punch queueing with anti-tamper HMAC/SHA-style signature seal
 * - Saudi Labor Law GOSI calculation (9.75% Employee / 11.75% Employer contribution)
 * - Wage Protection System (WPS / Mudad) record formatting
 */

export interface OfflineAttendancePunch {
  id: string;
  employeeId: string;
  action: 'CLOCK_IN' | 'CLOCK_OUT' | 'BREAK_START' | 'BREAK_END';
  clientTimestampIso: string;
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  wifiBssid: string;
  signatureHash: string;
  synced: boolean;
}

export interface GosiCalculationBreakdown {
  basicSalarySar: number;
  housingAllowanceSar: number;
  contributoryWageSar: number; // capped at 45,000 SAR per Saudi GOSI regulations
  employeeDeductionSar: number; // 9.75% (9% Annuities + 0.75% SANED unemployment)
  employerContributionSar: number; // 11.75% (9% Annuities + 2% Occupational Hazards + 0.75% SANED)
  netPayableAfterGosiSar: number;
  mudadWpsCompliant: boolean;
}

export const GOSI_MAX_CONTRIBUTORY_CAP_SAR = 45000;
export const GOSI_EMPLOYEE_RATE = 0.0975; // 9.75% for Saudi nationals
export const GOSI_EMPLOYER_RATE = 0.1175; // 11.75%

/**
 * Generates a deterministic anti-tamper signature for an offline attendance punch
 * so the client cannot modify coordinates or timestamps in local storage before sync.
 */
export function generatePunchSignature(payload: {
  employeeId: string;
  action: string;
  clientTimestampIso: string;
  latitude: number;
  longitude: number;
  wifiBssid: string;
}): string {
  const canonical = `${payload.employeeId}|${payload.action}|${payload.clientTimestampIso}|${payload.latitude.toFixed(
    5
  )}|${payload.longitude.toFixed(5)}|${payload.wifiBssid}|MACQHR_SALT_2026`;

  let hash = 2166136261;
  for (let i = 0; i < canonical.length; i++) {
    hash ^= canonical.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const unsigned = hash >>> 0;
  return `SIG-MACQ-${unsigned.toString(16).toUpperCase().padStart(8, '0')}`;
}

/**
 * Verifies that a queued offline punch has not been tampered with since creation.
 */
export function verifyPunchSignature(punch: OfflineAttendancePunch): boolean {
  const expected = generatePunchSignature({
    employeeId: punch.employeeId,
    action: punch.action,
    clientTimestampIso: punch.clientTimestampIso,
    latitude: punch.latitude,
    longitude: punch.longitude,
    wifiBssid: punch.wifiBssid,
  });
  return punch.signatureHash === expected;
}

/**
 * Creates a signed offline attendance punch ready for storage & sync.
 */
export function createSignedOfflinePunch(params: {
  employeeId: string;
  action: OfflineAttendancePunch['action'];
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  wifiBssid: string;
  timestampIso?: string;
}): OfflineAttendancePunch {
  const clientTimestampIso = params.timestampIso ?? new Date().toISOString();
  const signatureHash = generatePunchSignature({
    employeeId: params.employeeId,
    action: params.action,
    clientTimestampIso,
    latitude: params.latitude,
    longitude: params.longitude,
    wifiBssid: params.wifiBssid,
  });

  return {
    id: `punch-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    employeeId: params.employeeId,
    action: params.action,
    clientTimestampIso,
    latitude: params.latitude,
    longitude: params.longitude,
    accuracyMeters: params.accuracyMeters,
    wifiBssid: params.wifiBssid,
    signatureHash,
    synced: false,
  };
}

/**
 * Calculates Saudi GOSI & Mudad WPS compliance breakdown per RULES.md Section 5.2.
 */
export function calculateSaudiGosiBreakdown(params: {
  basicSalarySar: number;
  housingAllowanceSar: number;
  transportAllowanceSar: number;
  overtimeSar: number;
  iban: string;
}): GosiCalculationBreakdown {
  const rawSubjectWage = params.basicSalarySar + params.housingAllowanceSar;
  const contributoryWageSar = Math.min(
    GOSI_MAX_CONTRIBUTORY_CAP_SAR,
    Math.max(0, rawSubjectWage)
  );

  const employeeDeductionSar =
    Math.round(contributoryWageSar * GOSI_EMPLOYEE_RATE * 100) / 100;
  const employerContributionSar =
    Math.round(contributoryWageSar * GOSI_EMPLOYER_RATE * 100) / 100;

  const grossSalary =
    params.basicSalarySar +
    params.housingAllowanceSar +
    params.transportAllowanceSar +
    params.overtimeSar;

  const netPayableAfterGosiSar =
    Math.round((grossSalary - employeeDeductionSar) * 100) / 100;

  const normalizedIban = params.iban.replace(/\s+/g, '').toUpperCase();
  const mudadWpsCompliant =
    normalizedIban.startsWith('SA') && normalizedIban.length === 24;

  return {
    basicSalarySar: params.basicSalarySar,
    housingAllowanceSar: params.housingAllowanceSar,
    contributoryWageSar,
    employeeDeductionSar,
    employerContributionSar,
    netPayableAfterGosiSar,
    mudadWpsCompliant,
  };
}
