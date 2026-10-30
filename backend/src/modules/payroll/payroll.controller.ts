import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { PayrollService } from './payroll.service';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { Roles, UserRole } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

@ApiTags('Payroll & GOSI')
@Controller('payroll')
@ApiBearerAuth()
export class PayrollController {
  constructor(private readonly payrollService: PayrollService) {}

  @Get('my-payslip')
  @ApiOperation({ summary: 'Get current employee payslip with GOSI deductions' })
  async getMyPayslip(
    @CurrentUser() user: AuthenticatedUser,
    @Query('month') month?: string,
  ) {
    return this.payrollService.getMyPayslip(user.id, month);
  }

  @Get('summary')
  @UseGuards(RolesGuard)
  @Roles(UserRole.HR_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Company-wide monthly payroll total (HR & Super Admin only)' })
  async getSummary() {
    return this.payrollService.getCompanyPayrollSummary();
  }

  @Get('wps-export')
  @UseGuards(RolesGuard)
  @Roles(UserRole.HR_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Download Saudi Mudad Wage Protection System (WPS) CSV file' })
  async exportWps(@Res() res: Response, @Query('month') month?: string) {
    const csvContent = await this.payrollService.generateMudadWpsFile(month);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="macqhr_wps_${month || 'current'}.csv"`,
    );
    res.send(csvContent);
  }
}
