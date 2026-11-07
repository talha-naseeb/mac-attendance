import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Response } from 'express';
import { PayrollService } from './payroll.service';
import { AuditService } from '../../common/services/audit.service';
import {
  CurrentUser,
  AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { Roles, UserRole } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

@ApiTags('Payroll & GOSI')
@Controller('payroll')
@ApiBearerAuth()
export class PayrollController {
  constructor(
    private readonly payrollService: PayrollService,
    private readonly audit: AuditService,
  ) {}

  @Get('my-payslip')
  @ApiOperation({ summary: 'Get employee payslip for a period with GOSI & unpaid leave deductions' })
  async getMyPayslip(
    @CurrentUser() user: AuthenticatedUser,
    @Query('month') month?: string,
  ) {
    return this.payrollService.getMyPayslip(user.id, month);
  }

  @Get('my-payslips')
  @ApiOperation({ summary: 'List historical persisted payslips for the authenticated employee' })
  async getMyPayslips(@CurrentUser() user: AuthenticatedUser) {
    return this.payrollService.getMyPayslipsHistory(user.id);
  }

  @Get('summary')
  @UseGuards(RolesGuard)
  @Roles(UserRole.HR_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Company-wide monthly payroll total (HR & Super Admin only)' })
  async getSummary(@Query('period') period?: string) {
    return this.payrollService.getCompanyPayrollSummary(period);
  }

  @Get('runs')
  @UseGuards(RolesGuard)
  @Roles(UserRole.HR_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'List all payroll runs (HR & Super Admin only)' })
  async listRuns() {
    return this.payrollService.listPayrollRuns();
  }

  @Get('runs/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.HR_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get payroll run details and payslips by ID' })
  async getRun(@Param('id') id: string) {
    return this.payrollService.getPayrollRunById(id);
  }

  @Post('runs')
  @UseGuards(RolesGuard)
  @Roles(UserRole.HR_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Prepare or re-prepare a period payroll run (PREPARED)' })
  async prepareRun(
    @Body() body: { period?: string; notes?: string },
    @CurrentUser() actor?: AuthenticatedUser,
  ) {
    return this.payrollService.preparePayrollRun(
      body?.period,
      actor?.id,
      body?.notes,
    );
  }

  @Post('runs/:id/review')
  @UseGuards(RolesGuard)
  @Roles(UserRole.HR_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Mark a prepared payroll run as REVIEWED' })
  async reviewRun(
    @Param('id') id: string,
    @CurrentUser() actor?: AuthenticatedUser,
  ) {
    return this.payrollService.reviewPayrollRun(id, actor?.id);
  }

  @Post('runs/:id/lock')
  @UseGuards(RolesGuard)
  @Roles(UserRole.HR_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Lock a reviewed payroll run (LOCKED & immutable)' })
  async lockRun(
    @Param('id') id: string,
    @CurrentUser() actor?: AuthenticatedUser,
  ) {
    return this.payrollService.lockPayrollRun(id, actor?.id);
  }

  @Post('adjustments')
  @UseGuards(RolesGuard)
  @Roles(UserRole.HR_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Record a payroll adjustment or overtime for an unlocked period' })
  async createAdjustment(
    @Body()
    body: {
      userId: string;
      period?: string;
      amountSar?: number;
      overtimeHours?: number;
      reason: string;
    },
    @CurrentUser() actor?: AuthenticatedUser,
  ) {
    return this.payrollService.addAdjustment(body, actor?.id);
  }

  @Get('wps-export')
  @UseGuards(RolesGuard)
  @Roles(UserRole.HR_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Download validated Saudi Mudad Wage Protection System (WPS) CSV file' })
  async exportWps(
    @Res() res: Response,
    @CurrentUser() actor?: AuthenticatedUser,
    @Query('month') month?: string,
  ) {
    const csvContent = await this.payrollService.generateMudadWpsFile(
      month,
      actor?.id,
    );
    await this.audit.record({
      actorUserId: actor?.id ?? null,
      action: 'PAYROLL_WPS_EXPORTED',
      resource: 'Payroll',
      details: { month: month || 'current' },
    });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="macqhr_wps_${month || 'current'}.csv"`,
    );
    res.send(csvContent);
  }
}
