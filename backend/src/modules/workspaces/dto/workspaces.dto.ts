import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  LeaveApprovalPolicy,
  MembershipRole,
  MembershipStatus,
  SsoConnectionStatus,
  SsoProviderType,
  WorkspacePlanCode,
  WorkspaceType,
} from '@prisma/client';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateWorkspaceDto {
  @ApiProperty({ enum: WorkspaceType })
  @IsEnum(WorkspaceType)
  type: WorkspaceType;

  @ApiProperty({ example: 'Macquires Riyadh' })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiPropertyOptional({ example: 'ماكوايرز الرياض' })
  @IsOptional()
  @IsString()
  nameAr?: string;

  @ApiPropertyOptional({ example: 'SA' })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({ example: 'Asia/Riyadh' })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional({ example: 'SAR' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ enum: WorkspacePlanCode })
  @IsOptional()
  @IsEnum(WorkspacePlanCode)
  planCode?: WorkspacePlanCode;

  @ApiPropertyOptional({ enum: LeaveApprovalPolicy })
  @IsOptional()
  @IsEnum(LeaveApprovalPolicy)
  leaveApprovalPolicy?: LeaveApprovalPolicy;
}

export class ConvertToBusinessDto {
  @ApiProperty({ example: 'Acme Tech LLC' })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiPropertyOptional({ enum: WorkspacePlanCode, default: WorkspacePlanCode.BUSINESS_STARTER })
  @IsOptional()
  @IsEnum(WorkspacePlanCode)
  planCode?: WorkspacePlanCode;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(10000)
  seatsPurchased?: number;
}

export class UpdateWorkspaceDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nameAr?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ enum: LeaveApprovalPolicy })
  @IsOptional()
  @IsEnum(LeaveApprovalPolicy)
  leaveApprovalPolicy?: LeaveApprovalPolicy;

  @ApiPropertyOptional({ enum: WorkspacePlanCode })
  @IsOptional()
  @IsEnum(WorkspacePlanCode)
  planCode?: WorkspacePlanCode;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100000)
  seatsPurchased?: number;
}

export class UpdateMemberDto {
  @ApiPropertyOptional({ enum: MembershipRole })
  @IsOptional()
  @IsEnum(MembershipRole)
  role?: MembershipRole;

  @ApiPropertyOptional({ enum: MembershipStatus })
  @IsOptional()
  @IsEnum(MembershipStatus)
  status?: MembershipStatus;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsUUID()
  reportsToMembershipId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  jobTitle?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  department?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isRemoteAllowed?: boolean;
}

export class CreateInviteDto {
  @ApiProperty({ example: 'teammate@company.com' })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({ enum: MembershipRole, default: MembershipRole.EMPLOYEE })
  @IsOptional()
  @IsEnum(MembershipRole)
  role?: MembershipRole;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  jobTitle?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  department?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  reportsToMembershipId?: string;
}

export class AcceptInviteDto {
  @ApiProperty()
  @IsString()
  @MinLength(8)
  token: string;
}

export class UpsertSsoConnectionDto {
  @ApiProperty({ enum: SsoProviderType })
  @IsEnum(SsoProviderType)
  provider: SsoProviderType;

  @ApiPropertyOptional({ example: 'macquires.com' })
  @IsOptional()
  @IsString()
  domain?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  tenantId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  clientId?: string;

  @ApiPropertyOptional({ description: 'Write-only secret; stored masked in API responses' })
  @IsOptional()
  @IsString()
  clientSecret?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enforced?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  autoProvision?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  allowHrGroupMapping?: boolean;

  @ApiPropertyOptional({ enum: MembershipRole })
  @IsOptional()
  @IsEnum(MembershipRole)
  defaultRole?: MembershipRole;

  @ApiPropertyOptional({ enum: SsoConnectionStatus })
  @IsOptional()
  @IsEnum(SsoConnectionStatus)
  status?: SsoConnectionStatus;
}

export class SsoGroupMappingItemDto {
  @ApiProperty()
  @IsString()
  providerGroupId: string;

  @ApiProperty()
  @IsString()
  providerGroupName: string;

  @ApiProperty({ enum: MembershipRole })
  @IsEnum(MembershipRole)
  role: MembershipRole;
}

export class UpsertSsoGroupMappingsDto {
  @ApiProperty({ type: [SsoGroupMappingItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SsoGroupMappingItemDto)
  mappings: SsoGroupMappingItemDto[];
}
