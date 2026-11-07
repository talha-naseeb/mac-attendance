import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { LeavesService } from './leaves.service';
import {
  SubmitLeaveRequestDto,
  LeaveDecisionDto,
  CancelLeaveRequestDto,
} from './dto/leaves.dto';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { Roles, UserRole } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

@ApiTags('Leaves & Approvals')
@Controller('leaves')
@ApiBearerAuth()
export class LeavesController {
  constructor(private readonly leavesService: LeavesService) {}

  @Get('balances')
  @ApiOperation({ summary: 'Get current annual/sick/hajj leave balances' })
  async getBalances(@CurrentUser() user: AuthenticatedUser) {
    return this.leavesService.getBalances(user.id);
  }

  @Get('ledger')
  @ApiOperation({ summary: 'Get immutable audit ledger of balance movements' })
  @ApiQuery({ name: 'userId', required: false, description: 'Optional target user (HR/Super Admin only)' })
  async getLedger(
    @CurrentUser() user: AuthenticatedUser,
    @Query('userId') targetUserId?: string,
  ) {
    return this.leavesService.getLedger(user.id, targetUserId, user.role);
  }

  @Post('request')
  @ApiOperation({ summary: 'Submit a new leave request (Annual, Sick, Hajj, etc.)' })
  @ApiResponse({ status: 201, description: 'Leave request submitted and MS Teams webhook dispatched' })
  async submitRequest(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SubmitLeaveRequestDto,
  ) {
    return this.leavesService.submitRequest(user.id, dto);
  }

  @Get('my-requests')
  @ApiOperation({ summary: 'View personal leave request history and status' })
  async getMyRequests(@CurrentUser() user: AuthenticatedUser) {
    return this.leavesService.getMyRequests(user.id);
  }

  @Get('pending')
  @UseGuards(RolesGuard)
  @Roles(UserRole.MANAGER, UserRole.HR_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'View pending leave requests awaiting approval (Manager/HR/Admin)' })
  async getPendingRequests(@CurrentUser() user: AuthenticatedUser) {
    return this.leavesService.getPendingForManager(user.id, user.role);
  }

  @Get('admin')
  @UseGuards(RolesGuard)
  @Roles(UserRole.HR_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'View all leave requests for the administration console only' })
  async getAdminRequests() {
    return this.leavesService.getAllForAdmin();
  }

  @Patch(':id/decision')
  @UseGuards(RolesGuard)
  @Roles(UserRole.MANAGER, UserRole.HR_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Approve or reject an employee leave request (Stage 1 or Stage 2)' })
  async makeDecision(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: LeaveDecisionDto,
  ) {
    return this.leavesService.makeDecision(id, user.id, user.role, dto);
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Cancel a pending or pre-start approved leave request and restore balance' })
  async cancelRequest(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CancelLeaveRequestDto,
  ) {
    return this.leavesService.cancelRequest(id, user.id, user.role, dto);
  }

  @Patch(':id/dates')
  @ApiOperation({ summary: 'Update leave request dates and synchronize Outlook calendar event if approved' })
  async updateDates(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: { startDate: string; endDate: string },
  ) {
    return this.leavesService.rescheduleRequest(id, user.id, user.role, dto);
  }
}
