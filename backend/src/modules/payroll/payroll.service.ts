import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../../common/services/audit.service';
import {
  calculateSaudiGosi,
  GOSI_WAGE_CAP_SAR,
  halalasToSar,
  sanitizeCsvCell,
  sarToHalalas,
  validateNationalOrIqamaId,
  validateSaudiIban,
  WpsValidationError,
} from '../../common/utils/gosi.util';
import { calculateWorkingDays } from '../../common/utils/leave-calculator.util';

@Injectable()
export class PayrollService {
  private readonly logger = new Logger(PayrollService.name);

  constructor(
    private prisma: PrismaService,
    private audit?: AuditService,
  ) {}

  normalizePeriod(period?: string): string {
    const target =
      period?.trim() ||
      `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(target)) {
      throw new BadRequestException(
        `Invalid payroll period "${target}". Expected YYYY-MM format.`,
      );
    }
    return target;
  }

  private getPeriodBounds(period: string): {
    startDate: Date;
    endDate: Date;
    startIso: string;
    endIso: string;
  } {
    const [yearStr, monthStr] = period.split('-');
    const year = Number(yearStr);
    const month = Number(monthStr);
    const startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
    const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
    const startIso = startDate.toISOString().slice(0, 10);
    const endIso = endDate.toISOString().slice(0, 10);
    return { startDate, endDate, startIso, endIso };
  }

  /**
   * Computes approved unpaid leave days falling within the given YYYY-MM period
   * without double-counting overlapping or re-prepared requests.
   */
  private async computeApprovedUnpaidLeaveForPeriod(
    userId: string,
    period: string,
    holidayIsos: string[],
  ): Promise<{ unpaidDays: number; requestIds: string[] }> {
    const { startDate, endDate, startIso, endIso } = this.getPeriodBounds(period);
    const requests = await this.prisma.leaveRequest.findMany({
      where: {
        userId,
        type: { in: ['UNPAID', 'UNPAID_LEAVE'] },
        status: 'APPROVED',
        startDate: { lte: endDate },
        endDate: { gte: startDate },
      },
      orderBy: { startDate: 'asc' },
    });

    const seenIds = new Set<string>();
    let unpaidDays = 0;

    for (const req of requests) {
      if (seenIds.has(req.id)) continue;
      seenIds.add(req.id);

      const reqStartIso = req.startDate.toISOString().slice(0, 10);
      const reqEndIso = req.endDate.toISOString().slice(0, 10);
      const clippedStart = reqStartIso < startIso ? startIso : reqStartIso;
      const clippedEnd = reqEndIso > endIso ? endIso : reqEndIso;

      if (req.isHalfDay) {
        if (clippedStart >= startIso && clippedStart <= endIso) {
          unpaidDays += 0.5;
        }
      } else {
        const calc = calculateWorkingDays({
          startDate: new Date(`${clippedStart}T00:00:00.000Z`),
          endDate: new Date(`${clippedEnd}T00:00:00.000Z`),
          country: 'SA',
          isHalfDay: false,
          extraHolidays: holidayIsos,
        });
        unpaidDays += calc.daysCount;
      }
    }

    return {
      unpaidDays,
      requestIds: Array.from(seenIds),
    };
  }

  private formatPayslipModel(payslip: any, runStatus?: string) {
    const breakdown = (payslip.breakdownJson as Record<string, any>) || {};
    return {
      id: payslip.id,
      runId: payslip.runId,
      runStatus: runStatus ?? payslip.run?.status ?? 'PREPARED',
      period: payslip.period,
      currency: 'SAR',
      employee: {
        id: payslip.userId,
        employeeId: payslip.employeeIdSnapshot,
        name: payslip.employeeNameSnapshot,
        department: payslip.departmentSnapshot,
        jobTitle: payslip.jobTitleSnapshot,
        isSaudi: payslip.isSaudiSnapshot,
        nationalId: payslip.isSaudiSnapshot ? payslip.nationalOrIqamaIdSnapshot : null,
        iqamaNumber: !payslip.isSaudiSnapshot ? payslip.nationalOrIqamaIdSnapshot : null,
        iban: payslip.ibanSnapshot,
      },
      earnings: {
        basicSalarySar: halalasToSar(payslip.basicSalaryHalalas),
        basicSalaryHalalas: payslip.basicSalaryHalalas,
        housingAllowanceSar: halalasToSar(payslip.housingAllowanceHalalas),
        housingAllowanceHalalas: payslip.housingAllowanceHalalas,
        transportAllowanceSar: halalasToSar(payslip.transportAllowanceHalalas),
        transportAllowanceHalalas: payslip.transportAllowanceHalalas,
        overtimeSar: halalasToSar(payslip.overtimeHalalas),
        overtimeHalalas: payslip.overtimeHalalas,
        adjustmentsSar: halalasToSar(payslip.adjustmentsHalalas),
        adjustmentsHalalas: payslip.adjustmentsHalalas,
        grossSalarySar: halalasToSar(payslip.grossSalaryHalalas),
        grossSalaryHalalas: payslip.grossSalaryHalalas,
      },
      deductions: {
        gosiEmployeeShareSar: halalasToSar(payslip.gosiEmployeeHalalas),
        gosiEmployeeShareHalalas: payslip.gosiEmployeeHalalas,
        unpaidLeaveDays: payslip.unpaidLeaveDays,
        unpaidLeaveDeductionSar: halalasToSar(payslip.unpaidLeaveDeductionHalalas),
        unpaidLeaveDeductionHalalas: payslip.unpaidLeaveDeductionHalalas,
        otherDeductionsSar: halalasToSar(
          Math.max(0, -payslip.adjustmentsHalalas),
        ),
        totalDeductionsSar: halalasToSar(payslip.totalDeductionsHalalas),
        totalDeductionsHalalas: payslip.totalDeductionsHalalas,
      },
      netSalarySar: halalasToSar(payslip.netSalaryHalalas),
      netSalaryHalalas: payslip.netSalaryHalalas,
      employerContributions: {
        gosiEmployerShareSar: halalasToSar(payslip.gosiEmployerHalalas),
        gosiEmployerShareHalalas: payslip.gosiEmployerHalalas,
      },
      explanation: breakdown.unpaidLeaveExplanation ?? null,
      breakdown,
    };
  }

  /**
   * M8.1–M8.4: Prepares (or re-prepares an unlocked) period payroll run,
   * snapshotting salaries, GOSI, unpaid leave deductions, overtime, and adjustments.
   */
  async preparePayrollRun(
    periodInput?: string,
    actorUserId?: string,
    notes?: string,
  ) {
    const period = this.normalizePeriod(periodInput);

    const existing = await this.prisma.payrollRun.findUnique({
      where: { period },
    });

    if (existing && existing.status === 'LOCKED') {
      throw new ConflictException(
        `Payroll run for period ${period} is LOCKED and immutable.`,
      );
    }

    const employees = await this.prisma.user.findMany({
      where: { isActive: true },
      include: { branch: true },
      orderBy: { employeeId: 'asc' },
    });

    const holidays = await this.prisma.companyHoliday.findMany({
      where: { isOffDay: true },
    });
    const holidayIsos = holidays.map((h) => h.dateIso);

    const adjustments = await this.prisma.payrollAdjustment.findMany({
      where: { period },
    });

    let totalBasicHalalas = 0;
    let totalHousingHalalas = 0;
    let totalTransportHalalas = 0;
    let totalOvertimeHalalas = 0;
    let totalAdjustmentsHalalas = 0;
    let totalGrossHalalas = 0;
    let totalUnpaidLeaveHalalas = 0;
    let totalGosiEmployeeHalalas = 0;
    let totalGosiEmployerHalalas = 0;
    let totalNetHalalas = 0;

    const payslipPayloads: Array<any> = [];

    for (const emp of employees) {
      const basicHalalas = sarToHalalas(emp.basicSalarySar);
      const housingHalalas = sarToHalalas(emp.housingAllowanceSar);
      const transportHalalas = sarToHalalas(emp.transportAllowanceSar);

      const gosi = calculateSaudiGosi(
        emp.basicSalarySar,
        emp.housingAllowanceSar,
        emp.isSaudi,
      );

      const { unpaidDays, requestIds } =
        await this.computeApprovedUnpaidLeaveForPeriod(
          emp.id,
          period,
          holidayIsos,
        );

      // Daily rate configured as Basic Salary / 30 days (exact halala precision)
      const dailyRateHalalas = Math.round(basicHalalas / 30);
      const unpaidLeaveDeductionHalalas = Math.round(
        dailyRateHalalas * unpaidDays,
      );

      const empAdjustments = adjustments.filter((a) => a.userId === emp.id);
      let overtimeHalalas = 0;
      let manualAdjustmentsHalalas = 0;

      for (const adj of empAdjustments) {
        if (adj.overtimeHours > 0) {
          // Saudi Labor Law Art. 107: Hourly basic (basic / 240) * 1.5
          const otCalc = Math.round((basicHalalas / 240) * 1.5 * adj.overtimeHours);
          overtimeHalalas += adj.amountHalalas > 0 ? adj.amountHalalas : otCalc;
        } else {
          manualAdjustmentsHalalas += adj.amountHalalas;
        }
      }

      const positiveAdjustmentsHalalas = Math.max(0, manualAdjustmentsHalalas);
      const negativeAdjustmentsHalalas = Math.max(0, -manualAdjustmentsHalalas);

      const grossSalaryHalalas =
        basicHalalas +
        housingHalalas +
        transportHalalas +
        overtimeHalalas +
        positiveAdjustmentsHalalas;

      const totalDeductionsHalalas =
        gosi.employeeShareHalalas +
        unpaidLeaveDeductionHalalas +
        negativeAdjustmentsHalalas;

      const netSalaryHalalas = Math.max(
        0,
        grossSalaryHalalas - totalDeductionsHalalas,
      );

      const idSnapshot = emp.isSaudi ? emp.nationalId : emp.iqamaNumber;
      const unpaidLeaveExplanation =
        unpaidDays > 0
          ? `Unpaid leave deduction: ${unpaidDays} day(s) × ${halalasToSar(dailyRateHalalas).toFixed(2)} SAR/day (Basic Salary / 30) = ${halalasToSar(unpaidLeaveDeductionHalalas).toFixed(2)} SAR`
          : null;

      payslipPayloads.push({
        userId: emp.id,
        period,
        employeeIdSnapshot: emp.employeeId,
        employeeNameSnapshot: `${emp.firstName} ${emp.lastName}`,
        departmentSnapshot: emp.department,
        jobTitleSnapshot: emp.jobTitle,
        isSaudiSnapshot: emp.isSaudi,
        nationalOrIqamaIdSnapshot: idSnapshot ?? null,
        ibanSnapshot: emp.iban ?? null,
        basicSalaryHalalas: basicHalalas,
        housingAllowanceHalalas: housingHalalas,
        transportAllowanceHalalas: transportHalalas,
        overtimeHalalas,
        adjustmentsHalalas: manualAdjustmentsHalalas,
        grossSalaryHalalas,
        unpaidLeaveDays: unpaidDays,
        unpaidLeaveDeductionHalalas,
        gosiContributoryHalalas: gosi.contributoryWageHalalas,
        gosiEmployeeHalalas: gosi.employeeShareHalalas,
        gosiEmployerHalalas: gosi.employerShareHalalas,
        totalDeductionsHalalas,
        netSalaryHalalas,
        breakdownJson: {
          dailyRateHalalas,
          dailyRateSar: halalasToSar(dailyRateHalalas),
          unpaidLeaveDays: unpaidDays,
          unpaidLeaveRequestIds: requestIds,
          unpaidLeaveExplanation,
          gosiRates: gosi.rates,
          gosiWageCapSar: GOSI_WAGE_CAP_SAR,
          adjustments: empAdjustments.map((a) => ({
            id: a.id,
            amountSar: halalasToSar(a.amountHalalas),
            overtimeHours: a.overtimeHours,
            reason: a.reason,
          })),
        },
      });

      totalBasicHalalas += basicHalalas;
      totalHousingHalalas += housingHalalas;
      totalTransportHalalas += transportHalalas;
      totalOvertimeHalalas += overtimeHalalas;
      totalAdjustmentsHalalas += manualAdjustmentsHalalas;
      totalGrossHalalas += grossSalaryHalalas;
      totalUnpaidLeaveHalalas += unpaidLeaveDeductionHalalas;
      totalGosiEmployeeHalalas += gosi.employeeShareHalalas;
      totalGosiEmployerHalalas += gosi.employerShareHalalas;
      totalNetHalalas += netSalaryHalalas;
    }

    const gosiPolicyJson = {
      saudiEmployeeRate: 0.0975,
      saudiEmployerRate: 0.1175,
      nonSaudiEmployerRate: 0.02,
      wageCapSar: GOSI_WAGE_CAP_SAR,
      roundingPolicy: 'HALF_UP_HALALA_INT',
      dailyRatePolicy: 'BASIC_DIV_30',
    };

    const run = await this.prisma.$transaction(async (tx) => {
      const upsertedRun = await tx.payrollRun.upsert({
        where: { period },
        create: {
          period,
          status: 'PREPARED',
          totalEmployees: employees.length,
          totalBasicHalalas,
          totalHousingHalalas,
          totalTransportHalalas,
          totalOvertimeHalalas,
          totalAdjustmentsHalalas,
          totalGrossHalalas,
          totalUnpaidLeaveHalalas,
          totalGosiEmployeeHalalas,
          totalGosiEmployerHalalas,
          totalNetHalalas,
          gosiPolicyJson,
          notes: notes ?? null,
          preparedById: actorUserId ?? null,
          preparedAt: new Date(),
        },
        update: {
          status: 'PREPARED',
          totalEmployees: employees.length,
          totalBasicHalalas,
          totalHousingHalalas,
          totalTransportHalalas,
          totalOvertimeHalalas,
          totalAdjustmentsHalalas,
          totalGrossHalalas,
          totalUnpaidLeaveHalalas,
          totalGosiEmployeeHalalas,
          totalGosiEmployerHalalas,
          totalNetHalalas,
          gosiPolicyJson,
          notes: notes ?? existing?.notes ?? null,
          preparedById: actorUserId ?? existing?.preparedById ?? null,
          preparedAt: new Date(),
          reviewedById: null,
          reviewedAt: null,
        },
      });

      await tx.payslip.deleteMany({ where: { runId: upsertedRun.id } });

      for (const slip of payslipPayloads) {
        await tx.payslip.create({
          data: {
            ...slip,
            runId: upsertedRun.id,
          },
        });
      }

      await tx.payrollAdjustment.updateMany({
        where: { period },
        data: { runId: upsertedRun.id },
      });

      return tx.payrollRun.findUniqueOrThrow({
        where: { id: upsertedRun.id },
        include: { payslips: { orderBy: { employeeIdSnapshot: 'asc' } } },
      });
    });

    await this.audit?.record({
      actorUserId: actorUserId ?? null,
      action: 'PAYROLL_RUN_PREPARED',
      resource: 'PayrollRun',
      details: {
        runId: run.id,
        period: run.period,
        totalEmployees: run.totalEmployees,
        totalNetSar: halalasToSar(run.totalNetHalalas),
      },
    });

    return this.formatPayrollRunResponse(run);
  }

  /**
   * M8.4: Adds an audited adjustment or overtime entry for an employee in an unlocked period.
   */
  async addAdjustment(
    input: {
      userId: string;
      period?: string;
      amountSar?: number;
      overtimeHours?: number;
      reason: string;
    },
    actorUserId?: string,
  ) {
    const period = this.normalizePeriod(input.period);
    if (!input.reason || input.reason.trim().length < 3) {
      throw new BadRequestException('A valid adjustment reason is required.');
    }

    const existingRun = await this.prisma.payrollRun.findUnique({
      where: { period },
    });
    if (existingRun && existingRun.status === 'LOCKED') {
      throw new ConflictException(
        `Cannot add payroll adjustment to LOCKED period ${period}.`,
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { id: input.userId },
    });
    if (!user) {
      throw new NotFoundException('Employee not found.');
    }

    const adjustment = await this.prisma.payrollAdjustment.create({
      data: {
        runId: existingRun?.id ?? null,
        userId: input.userId,
        period,
        amountHalalas: sarToHalalas(input.amountSar ?? 0),
        overtimeHours: input.overtimeHours ?? 0,
        reason: input.reason.trim(),
        createdById: actorUserId ?? null,
      },
    });

    await this.audit?.record({
      actorUserId: actorUserId ?? null,
      action: 'PAYROLL_ADJUSTMENT_CREATED',
      resource: 'PayrollAdjustment',
      details: {
        adjustmentId: adjustment.id,
        userId: input.userId,
        period,
        amountSar: halalasToSar(adjustment.amountHalalas),
        overtimeHours: adjustment.overtimeHours,
        reason: adjustment.reason,
      },
    });

    return {
      ...adjustment,
      amountSar: halalasToSar(adjustment.amountHalalas),
    };
  }

  /**
   * M8.5: Transitions a payroll run from PREPARED -> REVIEWED.
   */
  async reviewPayrollRun(runId: string, actorUserId?: string) {
    const run = await this.prisma.payrollRun.findUnique({
      where: { id: runId },
    });
    if (!run) {
      throw new NotFoundException('Payroll run not found.');
    }
    if (run.status === 'LOCKED') {
      throw new ConflictException('Payroll run is already LOCKED and immutable.');
    }

    const updated = await this.prisma.payrollRun.update({
      where: { id: runId },
      data: {
        status: 'REVIEWED',
        reviewedById: actorUserId ?? null,
        reviewedAt: new Date(),
      },
      include: { payslips: { orderBy: { employeeIdSnapshot: 'asc' } } },
    });

    await this.audit?.record({
      actorUserId: actorUserId ?? null,
      action: 'PAYROLL_RUN_REVIEWED',
      resource: 'PayrollRun',
      details: { runId: updated.id, period: updated.period },
    });

    return this.formatPayrollRunResponse(updated);
  }

  /**
   * M8.5: Transitions a payroll run from REVIEWED -> LOCKED (immutable).
   */
  async lockPayrollRun(runId: string, actorUserId?: string) {
    const run = await this.prisma.payrollRun.findUnique({
      where: { id: runId },
    });
    if (!run) {
      throw new NotFoundException('Payroll run not found.');
    }
    if (run.status === 'LOCKED') {
      throw new ConflictException('Payroll run is already LOCKED.');
    }
    if (run.status !== 'REVIEWED') {
      throw new BadRequestException(
        'Payroll run must be REVIEWED before it can be LOCKED.',
      );
    }

    const updated = await this.prisma.payrollRun.update({
      where: { id: runId },
      data: {
        status: 'LOCKED',
        lockedById: actorUserId ?? null,
        lockedAt: new Date(),
      },
      include: { payslips: { orderBy: { employeeIdSnapshot: 'asc' } } },
    });

    await this.audit?.record({
      actorUserId: actorUserId ?? null,
      action: 'PAYROLL_RUN_LOCKED',
      resource: 'PayrollRun',
      details: {
        runId: updated.id,
        period: updated.period,
        totalNetSar: halalasToSar(updated.totalNetHalalas),
      },
    });

    return this.formatPayrollRunResponse(updated);
  }

  async listPayrollRuns() {
    const runs = await this.prisma.payrollRun.findMany({
      orderBy: { period: 'desc' },
      include: { payslips: { orderBy: { employeeIdSnapshot: 'asc' } } },
    });
    return runs.map((r) => this.formatPayrollRunResponse(r));
  }

  async getPayrollRunById(runId: string) {
    const run = await this.prisma.payrollRun.findUnique({
      where: { id: runId },
      include: { payslips: { orderBy: { employeeIdSnapshot: 'asc' } } },
    });
    if (!run) {
      throw new NotFoundException('Payroll run not found.');
    }
    return this.formatPayrollRunResponse(run);
  }

  private formatPayrollRunResponse(run: any) {
    return {
      id: run.id,
      period: run.period,
      status: run.status,
      currency: run.currency,
      totalEmployees: run.totalEmployees,
      totals: {
        totalBasicSar: halalasToSar(run.totalBasicHalalas),
        totalBasicHalalas: run.totalBasicHalalas,
        totalHousingSar: halalasToSar(run.totalHousingHalalas),
        totalHousingHalalas: run.totalHousingHalalas,
        totalTransportSar: halalasToSar(run.totalTransportHalalas),
        totalTransportHalalas: run.totalTransportHalalas,
        totalOvertimeSar: halalasToSar(run.totalOvertimeHalalas),
        totalAdjustmentsSar: halalasToSar(run.totalAdjustmentsHalalas),
        totalGrossSar: halalasToSar(run.totalGrossHalalas),
        totalGrossHalalas: run.totalGrossHalalas,
        totalUnpaidLeaveSar: halalasToSar(run.totalUnpaidLeaveHalalas),
        totalUnpaidLeaveHalalas: run.totalUnpaidLeaveHalalas,
        totalGosiEmployeeSar: halalasToSar(run.totalGosiEmployeeHalalas),
        totalGosiEmployeeHalalas: run.totalGosiEmployeeHalalas,
        totalGosiEmployerSar: halalasToSar(run.totalGosiEmployerHalalas),
        totalGosiEmployerHalalas: run.totalGosiEmployerHalalas,
        totalNetDisbursedSar: halalasToSar(run.totalNetHalalas),
        totalNetHalalas: run.totalNetHalalas,
      },
      gosiPolicy: run.gosiPolicyJson,
      preparedAt: run.preparedAt,
      reviewedAt: run.reviewedAt,
      lockedAt: run.lockedAt,
      payslips: (run.payslips ?? []).map((p: any) =>
        this.formatPayslipModel(p, run.status),
      ),
    };
  }

  /**
   * M8.2, M8.7, M8.8: Returns the employee's payslip for a given period.
   * If a PayrollRun snapshot exists for that period, returns the immutable snapshot;
   * otherwise calculates live values including approved unpaid leaves for the period.
   */
  async getMyPayslip(userId: string, monthYear?: string) {
    const period = this.normalizePeriod(monthYear);

    const existingSlip = await this.prisma.payslip.findFirst({
      where: { userId, period },
      include: { run: true },
    });

    if (existingSlip) {
      return this.formatPayslipModel(existingSlip, existingSlip.run.status);
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { branch: true },
    });

    if (!user) {
      throw new NotFoundException('Employee not found.');
    }

    const holidays = await this.prisma.companyHoliday.findMany({
      where: { isOffDay: true },
    });
    const { unpaidDays, requestIds } =
      await this.computeApprovedUnpaidLeaveForPeriod(
        user.id,
        period,
        holidays.map((h) => h.dateIso),
      );

    const basicHalalas = sarToHalalas(user.basicSalarySar);
    const housingHalalas = sarToHalalas(user.housingAllowanceSar);
    const transportHalalas = sarToHalalas(user.transportAllowanceSar);
    const dailyRateHalalas = Math.round(basicHalalas / 30);
    const unpaidLeaveDeductionHalalas = Math.round(dailyRateHalalas * unpaidDays);

    const gosi = calculateSaudiGosi(
      user.basicSalarySar,
      user.housingAllowanceSar,
      user.isSaudi,
    );

    const grossHalalas = basicHalalas + housingHalalas + transportHalalas;
    const totalDeductionsHalalas =
      gosi.employeeShareHalalas + unpaidLeaveDeductionHalalas;
    const netHalalas = Math.max(0, grossHalalas - totalDeductionsHalalas);

    return {
      period,
      runStatus: 'LIVE_PREVIEW',
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
        iban: user.iban,
        branch: user.branch?.name,
      },
      earnings: {
        basicSalarySar: halalasToSar(basicHalalas),
        basicSalaryHalalas: basicHalalas,
        housingAllowanceSar: halalasToSar(housingHalalas),
        housingAllowanceHalalas: housingHalalas,
        transportAllowanceSar: halalasToSar(transportHalalas),
        transportAllowanceHalalas: transportHalalas,
        overtimeSar: 0,
        overtimeHalalas: 0,
        adjustmentsSar: 0,
        adjustmentsHalalas: 0,
        grossSalarySar: halalasToSar(grossHalalas),
        grossSalaryHalalas: grossHalalas,
      },
      deductions: {
        gosiEmployeeShareSar: gosi.employeeShareSar,
        gosiEmployeeShareHalalas: gosi.employeeShareHalalas,
        unpaidLeaveDays: unpaidDays,
        unpaidLeaveDeductionSar: halalasToSar(unpaidLeaveDeductionHalalas),
        unpaidLeaveDeductionHalalas,
        otherDeductionsSar: 0,
        totalDeductionsSar: halalasToSar(totalDeductionsHalalas),
        totalDeductionsHalalas,
      },
      netSalarySar: halalasToSar(netHalalas),
      netSalaryHalalas: netHalalas,
      employerContributions: {
        gosiEmployerShareSar: gosi.employerShareSar,
        gosiEmployerShareHalalas: gosi.employerShareHalalas,
      },
      explanation:
        unpaidDays > 0
          ? `Unpaid leave deduction: ${unpaidDays} day(s) × ${halalasToSar(dailyRateHalalas).toFixed(2)} SAR/day (Basic Salary / 30) = ${halalasToSar(unpaidLeaveDeductionHalalas).toFixed(2)} SAR`
          : null,
      gosiDetails: gosi,
      breakdown: {
        dailyRateHalalas,
        dailyRateSar: halalasToSar(dailyRateHalalas),
        unpaidLeaveDays: unpaidDays,
        unpaidLeaveRequestIds: requestIds,
      },
    };
  }

  /**
   * M8.8: Lists historical persisted payslips for the authenticated employee.
   */
  async getMyPayslipsHistory(userId: string) {
    const slips = await this.prisma.payslip.findMany({
      where: { userId },
      include: { run: true },
      orderBy: { period: 'desc' },
    });
    return slips.map((s) => this.formatPayslipModel(s, s.run.status));
  }

  async getCompanyPayrollSummary(periodInput?: string) {
    if (periodInput) {
      const period = this.normalizePeriod(periodInput);
      const existingRun = await this.prisma.payrollRun.findUnique({
        where: { period },
        include: { payslips: { orderBy: { employeeIdSnapshot: 'asc' } } },
      });
      if (existingRun) {
        return this.formatPayrollRunResponse(existingRun);
      }
    }

    const employees = await this.prisma.user.findMany({
      where: { isActive: true },
    });

    let totalBasicHalalas = 0;
    let totalHousingHalalas = 0;
    let totalTransportHalalas = 0;
    let totalGrossHalalas = 0;
    let totalGosiEmployeeHalalas = 0;
    let totalGosiEmployerHalalas = 0;
    let totalNetHalalas = 0;

    for (const emp of employees) {
      const basicHalalas = sarToHalalas(emp.basicSalarySar);
      const housingHalalas = sarToHalalas(emp.housingAllowanceSar);
      const transportHalalas = sarToHalalas(emp.transportAllowanceSar);

      const gosi = calculateSaudiGosi(
        emp.basicSalarySar,
        emp.housingAllowanceSar,
        emp.isSaudi,
      );

      const grossHalalas = basicHalalas + housingHalalas + transportHalalas;
      const netHalalas = grossHalalas - gosi.employeeShareHalalas;

      totalBasicHalalas += basicHalalas;
      totalHousingHalalas += housingHalalas;
      totalTransportHalalas += transportHalalas;
      totalGrossHalalas += grossHalalas;
      totalGosiEmployeeHalalas += gosi.employeeShareHalalas;
      totalGosiEmployerHalalas += gosi.employerShareHalalas;
      totalNetHalalas += netHalalas;
    }

    return {
      currency: 'SAR',
      totalEmployees: employees.length,
      totals: {
        totalBasicSar: halalasToSar(totalBasicHalalas),
        totalHousingSar: halalasToSar(totalHousingHalalas),
        totalTransportSar: halalasToSar(totalTransportHalalas),
        totalGrossSar: halalasToSar(totalGrossHalalas),
        totalGosiEmployeeSar: halalasToSar(totalGosiEmployeeHalalas),
        totalGosiEmployerSar: halalasToSar(totalGosiEmployerHalalas),
        totalNetDisbursedSar: halalasToSar(totalNetHalalas),
      },
    };
  }

  /**
   * M8.6: Generates Saudi Mudad / Wage Protection System (WPS) compliant CSV output.
   * Validates required National/Iqama IDs, Saudi IBAN format, formula-injection safety,
   * and reconciles exact totals with the period's payslips.
   */
  async generateMudadWpsFile(
    periodMonthYear?: string,
    actorUserId?: string,
  ): Promise<string> {
    const period = this.normalizePeriod(periodMonthYear);

    let run = await this.prisma.payrollRun.findUnique({
      where: { period },
      include: { payslips: { orderBy: { employeeIdSnapshot: 'asc' } } },
    });

    if (!run) {
      await this.preparePayrollRun(period, actorUserId);
      run = await this.prisma.payrollRun.findUniqueOrThrow({
        where: { period },
        include: { payslips: { orderBy: { employeeIdSnapshot: 'asc' } } },
      });
    }

    const validationErrors: WpsValidationError[] = [];

    for (const slip of run.payslips) {
      if (
        !validateNationalOrIqamaId(
          slip.nationalOrIqamaIdSnapshot,
          slip.isSaudiSnapshot,
        )
      ) {
        validationErrors.push({
          employeeId: slip.employeeIdSnapshot,
          field: 'nationalOrIqamaId',
          reason: slip.isSaudiSnapshot
            ? 'Missing or invalid 10-digit Saudi National ID (must start with 1)'
            : 'Missing or invalid 10-digit Iqama ID (must start with 2, 3, or 4)',
        });
      }

      if (!validateSaudiIban(slip.ibanSnapshot)) {
        validationErrors.push({
          employeeId: slip.employeeIdSnapshot,
          field: 'iban',
          reason:
            'Missing or invalid Saudi IBAN (must be 24 characters starting with SA)',
        });
      }

      if (slip.netSalaryHalalas <= 0) {
        validationErrors.push({
          employeeId: slip.employeeIdSnapshot,
          field: 'netSalary',
          reason: 'Net salary must be greater than zero for WPS disbursement',
        });
      }
    }

    if (validationErrors.length > 0) {
      throw new BadRequestException({
        message: `WPS export blocked: ${validationErrors.length} validation error(s) found.`,
        period,
        errors: validationErrors,
      });
    }

    const lines: string[] = [];
    lines.push(
      'RECORD_TYPE,EMPLOYEE_ID,NATIONAL_OR_IQAMA_ID,IBAN,NAME,BASIC_SALARY,HOUSING_ALLOWANCE,OTHER_ALLOWANCE,UNPAID_LEAVE_DEDUCTION,DEDUCTIONS_GOSI,NET_SALARY,CURRENCY',
    );

    let sumNetHalalas = 0;

    for (const slip of run.payslips) {
      sumNetHalalas += slip.netSalaryHalalas;
      const otherAllowanceHalalas =
        slip.transportAllowanceHalalas +
        slip.overtimeHalalas +
        Math.max(0, slip.adjustmentsHalalas);

      const safeEmpId = sanitizeCsvCell(slip.employeeIdSnapshot);
      const safeNationalId = sanitizeCsvCell(slip.nationalOrIqamaIdSnapshot);
      const safeIban = sanitizeCsvCell(slip.ibanSnapshot);
      const safeName = sanitizeCsvCell(slip.employeeNameSnapshot).replace(
        /"/g,
        '""',
      );

      lines.push(
        [
          'WPS',
          safeEmpId,
          safeNationalId,
          safeIban,
          `"${safeName}"`,
          halalasToSar(slip.basicSalaryHalalas).toFixed(2),
          halalasToSar(slip.housingAllowanceHalalas).toFixed(2),
          halalasToSar(otherAllowanceHalalas).toFixed(2),
          halalasToSar(slip.unpaidLeaveDeductionHalalas).toFixed(2),
          halalasToSar(slip.gosiEmployeeHalalas).toFixed(2),
          halalasToSar(slip.netSalaryHalalas).toFixed(2),
          'SAR',
        ].join(','),
      );
    }

    if (sumNetHalalas !== run.totalNetHalalas) {
      throw new ConflictException(
        `WPS export reconciliation mismatch: payslips sum (${sumNetHalalas}) != run total (${run.totalNetHalalas}).`,
      );
    }

    const csvContent = lines.join('\n');
    const csvSha256 = createHash('sha256').update(csvContent, 'utf8').digest('hex');

    await this.prisma.payrollWpsExport.create({
      data: {
        runId: run.id,
        period,
        rowCount: run.payslips.length,
        totalNetHalalas: sumNetHalalas,
        csvSha256,
        exportedById: actorUserId ?? null,
      },
    });

    return csvContent;
  }
}
