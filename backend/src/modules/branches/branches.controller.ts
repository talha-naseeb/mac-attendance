import { Controller, Get, Post, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { BranchesService } from './branches.service';
import { CreateBranchDto, UpdateBranchDto } from './dto/branches.dto';
import { Roles, UserRole } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

@ApiTags('Branches')
@Controller('branches')
@ApiBearerAuth()
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  @Get()
  @ApiOperation({ summary: 'List all active office branches and geofence radii' })
  @ApiResponse({ status: 200, description: 'List of branches' })
  async getBranches() {
    return this.branchesService.findAll();
  }

  @Get('admin')
  @UseGuards(RolesGuard)
  @Roles(UserRole.HR_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'List branch configuration and operational counts for the administration console only' })
  async getAdminBranches() {
    return this.branchesService.findAllForAdmin();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get details of a specific branch' })
  async getBranchById(@Param('id') id: string) {
    return this.branchesService.findById(id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.HR_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create a new branch location (HR & Super Admin only)' })
  async createBranch(@Body() createDto: CreateBranchDto) {
    return this.branchesService.create(createDto);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.HR_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update branch geofence radius or coordinates' })
  async updateBranch(@Param('id') id: string, @Body() updateDto: UpdateBranchDto) {
    return this.branchesService.update(id, updateDto);
  }
}
