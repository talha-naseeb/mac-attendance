import {
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
  HAJJ = 'HAJJ',
  PATERNITY = 'PATERNITY',
  MATERNITY = 'MATERNITY',
  MARRIAGE = 'MARRIAGE',
  BEREAVEMENT = 'BEREAVEMENT',
  REMOTE_WORK = 'REMOTE_WORK',
  UNPAID = 'UNPAID',
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

  @ApiPropertyOptional({ example: 'https://storage.macqhr.sa/attachments/medical-cert-01.pdf' })
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
}
