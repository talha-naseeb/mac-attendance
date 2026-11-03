import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export const AUDIT_LOGS_DEFAULT_PAGE_SIZE = 50;
export const AUDIT_LOGS_MAX_PAGE_SIZE = 50;
export const AUDIT_LOGS_MAX_PAGES = 20;

export class AuditLogsQueryDto {
  @ApiPropertyOptional({ description: 'Search by action, resource, IP, or actor name/email/ID' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by resource type (e.g. User, AttendanceRecord, LeaveRequest)' })
  @IsOptional()
  @IsString()
  resource?: string;

  @ApiPropertyOptional({ description: 'Filter by exact action or action prefix (e.g. AUTH_, EMPLOYEE_)' })
  @IsOptional()
  @IsString()
  action?: string;

  @ApiPropertyOptional({ default: 1, minimum: 1, maximum: AUDIT_LOGS_MAX_PAGES })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(AUDIT_LOGS_MAX_PAGES)
  page?: number;

  @ApiPropertyOptional({
    default: AUDIT_LOGS_DEFAULT_PAGE_SIZE,
    minimum: 1,
    maximum: AUDIT_LOGS_MAX_PAGE_SIZE,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(AUDIT_LOGS_MAX_PAGE_SIZE)
  pageSize?: number;
}
