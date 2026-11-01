import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '../../../common/decorators/roles.decorator';

export class InitialLeaveBalanceDto {
  @ApiProperty({ example: 'ANNUAL' })
  @IsString()
  @IsNotEmpty()
  leaveType: string;

  @ApiProperty({ example: 30 })
  @IsInt()
  @Min(0)
  @Max(365)
  totalDays: number;
}

export class CreateEmployeeDto {
  @ApiProperty({ example: 'EMP-006' })
  @IsString()
  @IsNotEmpty()
  employeeId: string;

  @ApiProperty({ example: 'ahmed.mansoor@macqhr.sa' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'Ahmed' })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty({ example: 'Mansoor' })
  @IsString()
  @IsNotEmpty()
  lastName: string;

  @ApiPropertyOptional({ example: '+966 50 123 4567' })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ example: '1088776655' })
  @IsString()
  @IsOptional()
  nationalId?: string;

  @ApiPropertyOptional({ example: '2099887766' })
  @IsString()
  @IsOptional()
  iqamaNumber?: string;

  @ApiProperty({ example: true })
  @IsBoolean()
  @IsNotEmpty()
  isSaudi: boolean;

  @ApiProperty({ example: 'Engineering' })
  @IsString()
  @IsNotEmpty()
  department: string;

  @ApiProperty({ example: 'DevOps Engineer' })
  @IsString()
  @IsNotEmpty()
  jobTitle: string;

  @ApiProperty({ enum: UserRole, example: UserRole.EMPLOYEE })
  @IsEnum(UserRole)
  @IsNotEmpty()
  role: UserRole;

  @ApiProperty({ example: 12000 })
  @IsNumber()
  @IsNotEmpty()
  basicSalarySar: number;

  @ApiPropertyOptional({ example: 3000, default: 0 })
  @IsNumber()
  @IsOptional()
  housingAllowanceSar?: number;

  @ApiPropertyOptional({ example: 1000, default: 0 })
  @IsNumber()
  @IsOptional()
  transportAllowanceSar?: number;

  @ApiPropertyOptional({ example: 'branch-ruh-hq-01' })
  @IsString()
  @IsOptional()
  branchId?: string;

  @ApiPropertyOptional({ example: 'manager-user-uuid' })
  @IsString()
  @IsOptional()
  managerId?: string;

  @ApiPropertyOptional()
  @IsString() @IsOptional()
  fullNameAr?: string;

  @ApiPropertyOptional()
  @IsString() @IsOptional()
  titleAr?: string;

  @ApiPropertyOptional()
  @IsString() @IsOptional()
  departmentAr?: string;

  @ApiPropertyOptional({ default: false })
  @IsBoolean() @IsOptional()
  isRemoteAllowed?: boolean;

  @ApiPropertyOptional({ type: [InitialLeaveBalanceDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InitialLeaveBalanceDto)
  @IsOptional()
  initialLeaveBalances?: InitialLeaveBalanceDto[];
}

export class UpdateEmployeeDto {
  @ApiPropertyOptional({ example: 'Ahmed' })
  @IsString()
  @IsOptional()
  firstName?: string;

  @ApiPropertyOptional({ example: 'Mansoor' })
  @IsString()
  @IsOptional()
  lastName?: string;

  @ApiPropertyOptional({ example: '+966 50 999 8888' })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ example: 'Senior DevOps Engineer' })
  @IsString()
  @IsOptional()
  jobTitle?: string;

  @ApiPropertyOptional({ example: 'Engineering' })
  @IsString()
  @IsOptional()
  department?: string;

  @ApiPropertyOptional({ example: 14000 })
  @IsNumber()
  @IsOptional()
  basicSalarySar?: number;

  @ApiPropertyOptional({ example: 3500 })
  @IsNumber()
  @IsOptional()
  housingAllowanceSar?: number;

  @ApiPropertyOptional({ example: 1200 })
  @IsNumber()
  @IsOptional()
  transportAllowanceSar?: number;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
