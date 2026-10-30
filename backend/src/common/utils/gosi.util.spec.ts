import { calculateSaudiGosi, GOSI_WAGE_CAP_SAR } from './gosi.util';

describe('Saudi GOSI Calculation Utility', () => {
  it('calculates Saudi national contribution (9.75% Employee, 11.75% Employer)', () => {
    const basicSalary = 10000;
    const housing = 2500;
    const result = calculateSaudiGosi(basicSalary, housing, true);

    expect(result.isSaudi).toBe(true);
    expect(result.contributoryWageSar).toBe(12500);
    // 12,500 * 0.0975 = 1,218.75
    expect(result.employeeShareSar).toBe(1218.75);
    // 12,500 * 0.1175 = 1,468.75
    expect(result.employerShareSar).toBe(1468.75);
    expect(result.totalGosiSar).toBe(2687.5);
  });

  it('respects the 45,000 SAR statutory wage cap for Saudi nationals', () => {
    const basicSalary = 50000;
    const housing = 15000;
    const result = calculateSaudiGosi(basicSalary, housing, true);

    expect(result.contributoryWageSar).toBe(GOSI_WAGE_CAP_SAR);
    // 45,000 * 0.0975 = 4,387.50
    expect(result.employeeShareSar).toBe(4387.5);
    // 45,000 * 0.1175 = 5,287.50
    expect(result.employerShareSar).toBe(5287.5);
  });

  it('calculates Non-Saudi national contribution (0% Employee, 2% Employer Hazards)', () => {
    const basicSalary = 18000;
    const housing = 4500;
    const result = calculateSaudiGosi(basicSalary, housing, false);

    expect(result.isSaudi).toBe(false);
    expect(result.employeeShareSar).toBe(0);
    // 22,500 * 0.02 = 450
    expect(result.employerShareSar).toBe(450);
    expect(result.totalGosiSar).toBe(450);
  });
});
