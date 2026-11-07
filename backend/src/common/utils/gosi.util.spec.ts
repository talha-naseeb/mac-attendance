import {
  calculateSaudiGosi,
  GOSI_WAGE_CAP_SAR,
  sanitizeCsvCell,
  validateNationalOrIqamaId,
  validateSaudiIban,
} from './gosi.util';

describe('Saudi GOSI & WPS Calculation Utility (PAY-01, PAY-02, PAY-03, PAY-06)', () => {
  it('PAY-02 (below cap): calculates Saudi national contribution (9.75% Employee, 11.75% Employer)', () => {
    const basicSalary = 10000;
    const housing = 2500;
    const result = calculateSaudiGosi(basicSalary, housing, true);

    expect(result.isSaudi).toBe(true);
    expect(result.contributoryWageSar).toBe(12500);
    expect(result.contributoryWageHalalas).toBe(1250000);
    // 12,500 * 0.0975 = 1,218.75 (121,875 halalas)
    expect(result.employeeShareSar).toBe(1218.75);
    expect(result.employeeShareHalalas).toBe(121875);
    // 12,500 * 0.1175 = 1,468.75 (146,875 halalas)
    expect(result.employerShareSar).toBe(1468.75);
    expect(result.employerShareHalalas).toBe(146875);
    expect(result.totalGosiSar).toBe(2687.5);
  });

  it('PAY-02 (at cap): calculates Saudi national contribution at exact 45,000 SAR cap', () => {
    const result = calculateSaudiGosi(36000, 9000, true);
    expect(result.contributoryWageSar).toBe(45000);
    expect(result.employeeShareSar).toBe(4387.5);
    expect(result.employerShareSar).toBe(5287.5);
  });

  it('PAY-02 (above cap): respects the 45,000 SAR statutory wage cap for Saudi nationals', () => {
    const basicSalary = 50000;
    const housing = 15000;
    const result = calculateSaudiGosi(basicSalary, housing, true);

    expect(result.contributoryWageSar).toBe(GOSI_WAGE_CAP_SAR);
    expect(result.employeeShareSar).toBe(4387.5);
    expect(result.employerShareSar).toBe(5287.5);
  });

  it('PAY-03: calculates Non-Saudi national contribution (0% Employee, 2% Employer Hazards)', () => {
    const basicSalary = 18000;
    const housing = 4500;
    const result = calculateSaudiGosi(basicSalary, housing, false);

    expect(result.isSaudi).toBe(false);
    expect(result.employeeShareSar).toBe(0);
    expect(result.employeeShareHalalas).toBe(0);
    // 22,500 * 0.02 = 450
    expect(result.employerShareSar).toBe(450);
    expect(result.employerShareHalalas).toBe(45000);
    expect(result.totalGosiSar).toBe(450);
  });

  it('PAY-06: validates Saudi IBAN, National ID, Iqama ID, and sanitizes CSV formula injection', () => {
    expect(validateSaudiIban('SA0380000000608010167519')).toBe(true);
    expect(validateSaudiIban('INVALID-IBAN')).toBe(false);
    expect(validateNationalOrIqamaId('1098765432', true)).toBe(true);
    expect(validateNationalOrIqamaId('2098765432', true)).toBe(false);
    expect(validateNationalOrIqamaId('2098765432', false)).toBe(true);
    expect(sanitizeCsvCell('=CMD("calc")')).toBe('\'CMD("calc")');
  });
});
