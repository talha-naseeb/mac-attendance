/**
 * Saudi GOSI (General Organization for Social Insurance) Calculation Utility
 * Compliant with Saudi Labor Law & GOSI regulations (updated 2024/2026).
 */

export const GOSI_WAGE_CAP_SAR = 45000;

export interface GosiCalculationResult {
  isSaudi: boolean;
  contributoryWageSar: number; // Basic + Housing capped at 45,000 SAR
  employeeShareSar: number;
  employerShareSar: number;
  totalGosiSar: number;
  rates: {
    employeeRate: number;
    employerRate: number;
  };
}

export function calculateSaudiGosi(
  basicSalarySar: number,
  housingAllowanceSar: number,
  isSaudi: boolean,
): GosiCalculationResult {
  const uncappedWage = Math.max(0, basicSalarySar) + Math.max(0, housingAllowanceSar);
  const contributoryWage = Math.min(uncappedWage, GOSI_WAGE_CAP_SAR);

  if (isSaudi) {
    // Saudi national: 9.75% employee (9% Annuity + 0.75% SANED), 11.75% employer (9% + 0.75% + 2% Hazards)
    const employeeRate = 0.0975;
    const employerRate = 0.1175;
    const employeeShare = Math.round(contributoryWage * employeeRate * 100) / 100;
    const employerShare = Math.round(contributoryWage * employerRate * 100) / 100;

    return {
      isSaudi: true,
      contributoryWageSar: contributoryWage,
      employeeShareSar: employeeShare,
      employerShareSar: employerShare,
      totalGosiSar: Math.round((employeeShare + employerShare) * 100) / 100,
      rates: {
        employeeRate,
        employerRate,
      },
    };
  }

  // Non-Saudi national: 0% employee, 2% employer (Occupational Hazards only)
  const employeeRate = 0.0;
  const employerRate = 0.02;
  const employeeShare = 0;
  const employerShare = Math.round(contributoryWage * employerRate * 100) / 100;

  return {
    isSaudi: false,
    contributoryWageSar: contributoryWage,
    employeeShareSar: employeeShare,
    employerShareSar: employerShare,
    totalGosiSar: employerShare,
    rates: {
      employeeRate,
      employerRate,
    },
  };
}
