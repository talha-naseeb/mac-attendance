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
import { CreateEmployeeDto, UpdateEmployeeDto } from './dto/employees.dto';
import { AdminEmployeeQueryDto } from './dto/employee-admin.dto';
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
  constructor(private readonly employeesService: EmployeesService) {}

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

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.HR_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Onboard new employee (HR & Super Admin only)' })
  @ApiResponse({ status: 201, description: 'Employee record created' })
  async createEmployee(@Body() dto: CreateEmployeeDto) {
    return this.employeesService.create(dto);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.HR_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update employee profile or salary details' })
  async updateEmployee(
    @Param('id') id: string,
    @Body() dto: UpdateEmployeeDto,
  ) {
    return this.employeesService.update(id, dto);
  }
}
