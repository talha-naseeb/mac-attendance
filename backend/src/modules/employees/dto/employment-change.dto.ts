import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Min,
  ValidateIf,
} from 'class-validator';
import { EmploymentChangeType } from '@prisma/client';
import { UserRole } from '../../../common/decorators/roles.decorator';

export class EmploymentChangeDto {
  @IsEnum(EmploymentChangeType)
  type: EmploymentChangeType;

  @IsISO8601()
  effectiveDate: string;

  @IsString()
  @Length(3, 300)
  reason: string;

  @ValidateIf((o) => o.type === EmploymentChangeType.TRANSFER)
  @IsString()
  branchId?: string;

  @ValidateIf((o) => o.type === EmploymentChangeType.PROMOTION)
  @IsString()
  @Length(2, 120)
  jobTitle?: string;

  @ValidateIf((o) => o.type === EmploymentChangeType.SALARY)
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  basicSalarySar?: number;

  @ValidateIf((o) => o.type === EmploymentChangeType.SALARY)
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  housingAllowanceSar?: number;

  @ValidateIf((o) => o.type === EmploymentChangeType.SALARY)
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  transportAllowanceSar?: number;

  @ValidateIf((o) => o.type === EmploymentChangeType.ROLE)
  @IsEnum(UserRole)
  role?: UserRole;

  @ValidateIf((o) => o.type === EmploymentChangeType.MANAGER)
  @IsOptional()
  @IsString()
  managerId?: string | null;

  @ValidateIf((o) => o.type === EmploymentChangeType.REMOTE_ELIGIBILITY)
  @IsBoolean()
  isRemoteAllowed?: boolean;
}
