import {
  IsBoolean,
  IsEnum,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum LeaveType {
  ANNUAL = 'ANNUAL',
  SICK = 'SICK',
  SICK_ON_FILE = 'SICK_ON_FILE',
  HAJJ = 'HAJJ',
  PATERNITY = 'PATERNITY',
  MATERNITY = 'MATERNITY',
  MARRIAGE = 'MARRIAGE',
  BEREAVEMENT = 'BEREAVEMENT',
  REMOTE_WORK = 'REMOTE_WORK',
  UNPAID = 'UNPAID',
  EMERGENCY = 'EMERGENCY',
}

export enum LeaveDecision {
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export class SubmitLeaveRequestDto {
  @ApiProperty({ enum: LeaveType, example: LeaveType.ANNUAL })
  @IsEnum(LeaveType)
  @IsNotEmpty()
  type: LeaveType;

  @ApiProperty({ example: '2026-11-01', description: 'Start date in YYYY-MM-DD format' })
  @IsISO8601()
  @IsNotEmpty()
  startDate: string;

  @ApiProperty({ example: '2026-11-05', description: 'End date in YYYY-MM-DD format' })
  @IsISO8601()
  @IsNotEmpty()
  endDate: string;

  @ApiProperty({ example: 'Family annual vacation in Abha' })
  @IsString()
  @IsNotEmpty()
  reason: string;

  @ApiPropertyOptional({ example: false, description: 'True if requesting half day (0.5)' })
  @IsBoolean()
  @IsOptional()
  isHalfDay?: boolean;

  @ApiPropertyOptional({ example: 'MORNING', enum: ['MORNING', 'AFTERNOON'] })
  @IsString()
  @IsOptional()
  halfDayPeriod?: 'MORNING' | 'AFTERNOON';

  @ApiPropertyOptional({ example: 'https://storage.shiftly.app/attachments/medical-cert-01.pdf' })
  @IsString()
  @IsOptional()
  attachmentUrl?: string;
}

export class LeaveDecisionDto {
  @ApiProperty({ enum: LeaveDecision, example: LeaveDecision.APPROVED })
  @IsEnum(LeaveDecision)
  @IsNotEmpty()
  decision: LeaveDecision;

  @ApiPropertyOptional({ example: 'Approved, project handover completed.' })
  @IsString()
  @IsOptional()
  comments?: string;

  @ApiPropertyOptional({ example: false, description: 'True if HR Admin is overriding Stage 1 Line Manager review' })
  @IsBoolean()
  @IsOptional()
  isHrOverride?: boolean;
}

export class CancelLeaveRequestDto {
  @ApiPropertyOptional({ example: 'Family plans changed, rescheduling trip.' })
  @IsString()
  @IsOptional()
  reason?: string;
}
