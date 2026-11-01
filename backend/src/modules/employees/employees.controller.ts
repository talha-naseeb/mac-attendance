import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { EmployeesService } from './employees.service';
import { EmploymentChangesService } from './employment-changes.service';
import { CreateEmployeeDto, UpdateEmployeeDto } from './dto/employees.dto';
import { AdminEmployeeQueryDto } from './dto/employee-admin.dto';
import { EmploymentChangeDto } from './dto/employment-change.dto';
import { Roles, UserRole } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';

@ApiTags('Employees')
@Controller('employees')
@ApiBearerAuth()
export class EmployeesController {
  constructor(
    private readonly employeesService: EmployeesService,
    private readonly employmentChanges: EmploymentChangesService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List employees with search and department filtering' })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'department', required: false, type: String })
  @ApiQuery({ name: 'branchId', required: false, type: String })
  async getEmployees(
    @Query('search') search?: string,
    @Query('department') department?: string,
    @Query('branchId') branchId?: string,
  ) {
    return this.employeesService.findAll({ search, department, branchId });
  }

  @Get('admin')
  @UseGuards(RolesGuard)
  @Roles(UserRole.HR_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Paginated employee and payroll records for the administration console' })
  async getAdminEmployees(@Query() query: AdminEmployeeQueryDto) {
    return this.employeesService.findAllForAdmin(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get employee profile by ID' })
  async getEmployeeById(
    @Param('id') id: string,
    @CurrentUser() requester: AuthenticatedUser,
  ) {
    return this.employeesService.findById(id, requester);
  }

  @Get(':id/changes')
  @UseGuards(RolesGuard)
  @Roles(UserRole.HR_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'List employment changes for an employee, newest first' })
  async listChanges(@Param('id') id: string) {
    return this.employmentChanges.list(id);
  }

  @Post(':id/changes')
  @UseGuards(RolesGuard)
  @Roles(UserRole.HR_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Apply an effective-dated employment change' })
  async applyChange(
    @Param('id') id: string,
    @Body() dto: EmploymentChangeDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.employmentChanges.apply(id, dto, actor);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.HR_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Onboard new employee (HR & Super Admin only)' })
  @ApiResponse({ status: 201, description: 'Employee record created' })
  async createEmployee(
    @Body() dto: CreateEmployeeDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.employeesService.create(dto, actor);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.HR_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update editable employee profile fields' })
  async updateEmployee(
    @Param('id') id: string,
    @Body() dto: UpdateEmployeeDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.employeesService.update(id, dto, actor);
  }
}
