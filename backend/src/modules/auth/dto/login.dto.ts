import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { WorkspaceType } from '@prisma/client';

export class LoginDto {
  @ApiProperty({ example: 'sara.alotaibi@macqhr.sa', description: 'Corporate email' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'Password123!', description: 'Employee password', minLength: 6 })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password: string;
}

export class SsoLoginDto {
  @ApiProperty({ example: 'mock-entra-token-superadmin', description: 'Azure Entra ID Bearer token' })
  @IsString()
  @IsNotEmpty()
  ssoToken: string;

  @ApiProperty({ example: 'superadmin@macqhr.sa', description: 'SSO Principal Email' })
  @IsEmail()
  @IsNotEmpty()
  email: string;
}

export class DiscoverAuthDto {
  @ApiProperty({ example: 'sara.alotaibi@macqhr.sa', description: 'Email to discover login providers and workspaces' })
  @IsEmail()
  @IsNotEmpty()
  email: string;
}

export class SwitchWorkspaceDto {
  @ApiProperty({ description: 'Target workspace ID to switch the current session into' })
  @IsString()
  @IsNotEmpty()
  workspaceId: string;
}

export class RegisterDto {
  @ApiProperty({ example: 'founder@newco.sa' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'Str0ngPass!2026' })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ example: 'Sara' })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty({ example: 'Al-Otaibi' })
  @IsString()
  @IsNotEmpty()
  lastName: string;

  @ApiPropertyOptional({ enum: WorkspaceType, default: WorkspaceType.PERSONAL })
  @IsOptional()
  @IsEnum(WorkspaceType)
  workspaceType?: WorkspaceType;

  @ApiPropertyOptional({ example: 'NewCo Tech' })
  @IsOptional()
  @IsString()
  workspaceName?: string;

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
}
