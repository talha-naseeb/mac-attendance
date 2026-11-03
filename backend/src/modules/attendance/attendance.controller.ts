import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AttendanceService } from './attendance.service';
import { PunchAttendanceDto, SyncOfflinePunchesDto } from './dto/attendance.dto';
import {
  CreateRemoteRequestDto,
  DecideRemoteRequestDto,
} from './dto/remote-request.dto';
import { ReviewExceptionDto } from './dto/exception-review.dto';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { Roles, UserRole } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

@ApiTags('Attendance & Anti-Spoofing')
@Controller('attendance')
@ApiBearerAuth()
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Post('punch')
  @ApiOperation({
    summary: 'Submit attendance punch (CHECK_IN, CHECK_OUT, BREAK_START, BREAK_END, RELOCATION)',
  })
  @ApiResponse({ status: 201, description: 'Punch verified and recorded' })
  @ApiResponse({ status: 400, description: 'Geofence, Accuracy, or NTP drift violation' })
  @ApiResponse({ status: 403, description: 'Mock location or Root/Jailbreak violation' })
  async punch(
    @CurrentUser() user: AuthenticatedUser,
    @Body() punchDto: PunchAttendanceDto,
  ) {
    return this.attendanceService.punch(user.id, punchDto);
  }

  @Get('today')
  @ApiOperation({ summary: "Get current employee's workday container, active break, and timers" })
  async getToday(@CurrentUser() user: AuthenticatedUser) {
    return this.attendanceService.getToday(user.id);
  }

  // --- Remote Work Requests ---

  @Post('remote-requests')
  @ApiOperation({ summary: 'Submit a per-day remote work request for manager approval' })
  async createRemoteRequest(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateRemoteRequestDto,
  ) {
    return this.attendanceService.createRemoteRequest(user.id, dto);
  }

  @Get('remote-requests/mine')
  @ApiOperation({ summary: 'Get current employee own remote work requests' })
  async getMyRemoteRequests(@CurrentUser() user: AuthenticatedUser) {
    return this.attendanceService.getMyRemoteRequests(user.id);
  }

  @Get('remote-requests/pending')
  @UseGuards(RolesGuard)
  @Roles(UserRole.MANAGER, UserRole.HR_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get pending remote work requests (Managers see direct reports; HR sees all)' })
  async getPendingRemoteRequests(@CurrentUser() user: AuthenticatedUser) {
    return this.attendanceService.getPendingRemoteRequests(user.id, user.role);
  }

  @Post('remote-requests/:id/decision')
  @UseGuards(RolesGuard)
  @Roles(UserRole.MANAGER, UserRole.HR_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Approve or reject a remote work request' })
  async decideRemoteRequest(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: DecideRemoteRequestDto,
  ) {
    return this.attendanceService.decideRemoteRequest(user.id, user.role, id, dto);
  }

  // --- Exceptions Review ---

  @Get('exceptions')
  @UseGuards(RolesGuard)
  @Roles(UserRole.HR_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'List flagged attendance exceptions for HR review' })
  @ApiQuery({ name: 'status', required: false, enum: ['OPEN', 'ACCEPTED', 'ESCALATED'] })
  @ApiQuery({ name: 'fromDate', required: false, type: String })
  @ApiQuery({ name: 'toDate', required: false, type: String })
  async getExceptions(
    @Query('status') status?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
  ) {
    return this.attendanceService.getExceptions(status, fromDate, toDate);
  }

  @Post('exceptions/:id/review')
  @UseGuards(RolesGuard)
  @Roles(UserRole.HR_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Accept or escalate an attendance exception (HR & Super Admin)' })
  async reviewException(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ReviewExceptionDto,
  ) {
    return this.attendanceService.reviewException(user.id, id, dto);
  }

  // --- Offline & Reporting Endpoints ---

  @Post('offline-sync')
  @ApiOperation({
    summary: 'Offline punch sync (disabled until device signing keys are supported)',
  })
  @ApiResponse({ status: 403, description: 'Offline punch verification is not securely configured' })
  async syncOffline(
    @CurrentUser() _user: AuthenticatedUser,
    @Body() _syncDto: SyncOfflinePunchesDto,
  ) {
    return this.attendanceService.syncOfflinePunches();
  }

  @Get('my-history')
  @ApiOperation({ summary: 'Get personal attendance logs' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getMyHistory(
    @CurrentUser() user: AuthenticatedUser,
    @Query('limit') limit?: number,
  ) {
    return this.attendanceService.getMyHistory(user.id, limit ? Number(limit) : 30);
  }

  @Get('team')
  @UseGuards(RolesGuard)
  @Roles(UserRole.MANAGER, UserRole.HR_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get direct reports live attendance status (Manager/HR/Admin)' })
  @ApiQuery({ name: 'date', required: false, type: String, example: '2026-10-24' })
  async getTeamAttendance(
    @CurrentUser() user: AuthenticatedUser,
    @Query('date') date?: string,
  ) {
    return this.attendanceService.getTeamAttendance(user.id, date);
  }

  @Get('all')
  @UseGuards(RolesGuard)
  @Roles(UserRole.HR_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Company-wide attendance logs (HR & Super Admin only)' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getAllAttendance(@Query('limit') limit?: number) {
    return this.attendanceService.getAllRecords(limit ? Number(limit) : 100);
  }
}
