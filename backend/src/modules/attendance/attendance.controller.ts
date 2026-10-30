import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AttendanceService } from './attendance.service';
import { PunchAttendanceDto, SyncOfflinePunchesDto } from './dto/attendance.dto';
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
    summary: 'Submit attendance punch with 6-Layer Anti-Spoofing & Geofence validation',
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
