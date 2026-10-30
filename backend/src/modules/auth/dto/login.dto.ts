import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

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
