import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { calculateSaudiGosi, GOSI_WAGE_CAP_SAR } from '../../common/utils/gosi.util';

@Injectable()
export class PayrollService {
  private readonly logger = new Logger(PayrollService.name);

  constructor(private prisma: PrismaService) {}

  async getMyPayslip(userId: string, monthYear?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { branch: true },
    });

    if (!user) {
      throw new NotFoundException('Employee not found.');
    }

    const gosi = calculateSaudiGosi(
      user.basicSalarySar,
      user.housingAllowanceSar,
      user.isSaudi,
    );

    const grossSalary =
      user.basicSalarySar + user.housingAllowanceSar + user.transportAllowanceSar;
    const totalDeductions = gosi.employeeShareSar;
    const netSalary = Math.round((grossSalary - totalDeductions) * 100) / 100;

    const period = monthYear || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

    return {
      period,
      currency: 'SAR',
      employee: {
        id: user.id,
        employeeId: user.employeeId,
        name: `${user.firstName} ${user.lastName}`,
        department: user.department,
        jobTitle: user.jobTitle,
        isSaudi: user.isSaudi,
        nationalId: user.nationalId,
        iqamaNumber: user.iqamaNumber,
        branch: user.branch?.name,
      },
      earnings: {
        basicSalarySar: user.basicSalarySar,
        housingAllowanceSar: user.housingAllowanceSar,
        transportAllowanceSar: user.transportAllowanceSar,
        grossSalarySar: grossSalary,
      },
      deductions: {
        gosiEmployeeShareSar: gosi.employeeShareSar,
        otherDeductionsSar: 0,
        totalDeductionsSar: totalDeductions,
      },
      netSalarySar: netSalary,
      employerContributions: {
        gosiEmployerShareSar: gosi.employerShareSar,
      },
      gosiDetails: gosi,
    };
  }

  async getCompanyPayrollSummary() {
    const employees = await this.prisma.user.findMany({
      where: { isActive: true },
    });

    let totalBasic = 0;
    let totalHousing = 0;
    let totalTransport = 0;
    let totalGross = 0;
    let totalGosiEmployee = 0;
    let totalGosiEmployer = 0;
    let totalNet = 0;

    for (const emp of employees) {
      const gosi = calculateSaudiGosi(
        emp.basicSalarySar,
        emp.housingAllowanceSar,
        emp.isSaudi,
      );

      const gross = emp.basicSalarySar + emp.housingAllowanceSar + emp.transportAllowanceSar;
      const net = gross - gosi.employeeShareSar;

      totalBasic += emp.basicSalarySar;
      totalHousing += emp.housingAllowanceSar;
      totalTransport += emp.transportAllowanceSar;
      totalGross += gross;
      totalGosiEmployee += gosi.employeeShareSar;
      totalGosiEmployer += gosi.employerShareSar;
      totalNet += net;
    }

    return {
      currency: 'SAR',
      totalEmployees: employees.length,
      totals: {
        totalBasicSar: Math.round(totalBasic * 100) / 100,
        totalHousingSar: Math.round(totalHousing * 100) / 100,
        totalTransportSar: Math.round(totalTransport * 100) / 100,
        totalGrossSar: Math.round(totalGross * 100) / 100,
        totalGosiEmployeeSar: Math.round(totalGosiEmployee * 100) / 100,
        totalGosiEmployerSar: Math.round(totalGosiEmployer * 100) / 100,
        totalNetDisbursedSar: Math.round(totalNet * 100) / 100,
      },
    };
  }

  /**
   * Generates Saudi Mudad / Wage Protection System (WPS) compliant CSV output.
   */
  async generateMudadWpsFile(periodMonthYear?: string): Promise<string> {
    const employees = await this.prisma.user.findMany({
      where: { isActive: true },
      include: { branch: true },
      orderBy: { employeeId: 'asc' },
    });

    const lines: string[] = [];
    // Header
    lines.push(
      'RECORD_TYPE,EMPLOYEE_ID,NATIONAL_OR_IQAMA_ID,NAME,BASIC_SALARY,HOUSING_ALLOWANCE,OTHER_ALLOWANCE,DEDUCTIONS_GOSI,NET_SALARY,CURRENCY',
    );

    for (const emp of employees) {
      const gosi = calculateSaudiGosi(
        emp.basicSalarySar,
        emp.housingAllowanceSar,
        emp.isSaudi,
      );
      const gross = emp.basicSalarySar + emp.housingAllowanceSar + emp.transportAllowanceSar;
      const net = Math.round((gross - gosi.employeeShareSar) * 100) / 100;
      const idNumber = emp.isSaudi ? emp.nationalId || 'N/A' : emp.iqamaNumber || 'N/A';

      lines.push(
        `WPS,${emp.employeeId},${idNumber},"${emp.firstName} ${emp.lastName}",${emp.basicSalarySar.toFixed(
          2,
        )},${emp.housingAllowanceSar.toFixed(2)},${emp.transportAllowanceSar.toFixed(
          2,
        )},${gosi.employeeShareSar.toFixed(2)},${net.toFixed(2)},SAR`,
      );
    }

    return lines.join('\n');
  }
}
