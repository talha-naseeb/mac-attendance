/**
 * Saudi GOSI (General Organization for Social Insurance) & WPS Calculation Utility
 * Compliant with Saudi Labor Law, GOSI regulations, and SAMA Mudad WPS standards.
 * Uses exact integer halala arithmetic (1 SAR = 100 halalas) to avoid floating-point drift.
 */

export const GOSI_WAGE_CAP_SAR = 45000;
export const GOSI_WAGE_CAP_HALALAS = 45000 * 100;

export interface GosiRateConfig {
  saudiEmployeeRate?: number;
  saudiEmployerRate?: number;
  nonSaudiEmployerRate?: number;
  wageCapSar?: number;
}

export interface GosiCalculationResult {
  isSaudi: boolean;
  contributoryWageSar: number; // Basic + Housing capped at 45,000 SAR
  contributoryWageHalalas: number;
  employeeShareSar: number;
  employeeShareHalalas: number;
  employerShareSar: number;
  employerShareHalalas: number;
  totalGosiSar: number;
  totalGosiHalalas: number;
  rates: {
    employeeRate: number;
    employerRate: number;
  };
}

export function sarToHalalas(sar: number): number {
  return Math.round((Number(sar) || 0) * 100);
}

export function halalasToSar(halalas: number): number {
  return Math.round(halalas) / 100;
}

export function validateGosiRateConfig(config?: GosiRateConfig): Required<GosiRateConfig> {
  const saudiEmployeeRate = config?.saudiEmployeeRate ?? 0.0975;
  const saudiEmployerRate = config?.saudiEmployerRate ?? 0.1175;
  const nonSaudiEmployerRate = config?.nonSaudiEmployerRate ?? 0.02;
  const wageCapSar = config?.wageCapSar ?? GOSI_WAGE_CAP_SAR;

  if (
    saudiEmployeeRate < 0 ||
    saudiEmployeeRate > 0.5 ||
    saudiEmployerRate < 0 ||
    saudiEmployerRate > 0.5 ||
    nonSaudiEmployerRate < 0 ||
    nonSaudiEmployerRate > 0.5 ||
    wageCapSar <= 0
  ) {
    throw new Error('Invalid GOSI rate configuration');
  }

  return {
    saudiEmployeeRate,
    saudiEmployerRate,
    nonSaudiEmployerRate,
    wageCapSar,
  };
}

export function calculateSaudiGosi(
  basicSalarySar: number,
  housingAllowanceSar: number,
  isSaudi: boolean,
  config?: GosiRateConfig,
): GosiCalculationResult {
  const rates = validateGosiRateConfig(config);
  const basicHalalas = Math.max(0, sarToHalalas(basicSalarySar));
  const housingHalalas = Math.max(0, sarToHalalas(housingAllowanceSar));
  const wageCapHalalas = sarToHalalas(rates.wageCapSar);

  const uncappedHalalas = basicHalalas + housingHalalas;
  const contributoryWageHalalas = Math.min(uncappedHalalas, wageCapHalalas);

  if (isSaudi) {
    const employeeRate = rates.saudiEmployeeRate;
    const employerRate = rates.saudiEmployerRate;
    const employeeShareHalalas = Math.round(contributoryWageHalalas * employeeRate);
    const employerShareHalalas = Math.round(contributoryWageHalalas * employerRate);
    const totalGosiHalalas = employeeShareHalalas + employerShareHalalas;

    return {
      isSaudi: true,
      contributoryWageSar: halalasToSar(contributoryWageHalalas),
      contributoryWageHalalas,
      employeeShareSar: halalasToSar(employeeShareHalalas),
      employeeShareHalalas,
      employerShareSar: halalasToSar(employerShareHalalas),
      employerShareHalalas,
      totalGosiSar: halalasToSar(totalGosiHalalas),
      totalGosiHalalas,
      rates: {
        employeeRate,
        employerRate,
      },
    };
  }

  const employeeRate = 0.0;
  const employerRate = rates.nonSaudiEmployerRate;
  const employeeShareHalalas = 0;
  const employerShareHalalas = Math.round(contributoryWageHalalas * employerRate);

  return {
    isSaudi: false,
    contributoryWageSar: halalasToSar(contributoryWageHalalas),
    contributoryWageHalalas,
    employeeShareSar: 0,
    employeeShareHalalas: 0,
    employerShareSar: halalasToSar(employerShareHalalas),
    employerShareHalalas,
    totalGosiSar: halalasToSar(employerShareHalalas),
    totalGosiHalalas: employerShareHalalas,
    rates: {
      employeeRate,
      employerRate,
    },
  };
}

/**
 * Sanitizes a string cell against CSV formula injection (OWASP CSV Injection).
 */
export function sanitizeCsvCell(value: string | null | undefined): string {
  const clean = String(value ?? '').replace(/[\r\n]+/g, ' ').trim();
  if (/^[=+\-@\t\r]/.test(clean)) {
    return `'${clean.replace(/^[=+\-@\t\r]+/, '')}`;
  }
  return clean;
}

export interface WpsValidationError {
  employeeId: string;
  field: 'nationalOrIqamaId' | 'iban' | 'netSalary';
  reason: string;
}

export function validateSaudiIban(iban: string | null | undefined): boolean {
  if (!iban) return false;
  const normalized = iban.replace(/\s+/g, '').toUpperCase();
  return /^SA\d{2}[A-Z0-9]{20}$/.test(normalized);
}

export function validateNationalOrIqamaId(
  idNumber: string | null | undefined,
  isSaudi: boolean,
): boolean {
  if (!idNumber) return false;
  const normalized = idNumber.trim();
  if (isSaudi) {
    return /^1\d{9}$/.test(normalized);
  }
  return /^[234]\d{9}$/.test(normalized);
}
