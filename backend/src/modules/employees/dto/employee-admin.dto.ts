import { Type } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export enum EmployeeStatusFilter {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  ALL = 'ALL',
}

export class AdminEmployeeQueryDto {
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsString() department?: string;
  @IsOptional() @IsString() branchId?: string;
  @IsOptional() @IsEnum(EmployeeStatusFilter) status?: EmployeeStatusFilter;
  @IsOptional() @IsIn(['employeeId', 'name', 'department', 'status']) sort?: string;
  @IsOptional() @IsIn(['asc', 'desc']) direction?: 'asc' | 'desc';
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(10000) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number;
}
