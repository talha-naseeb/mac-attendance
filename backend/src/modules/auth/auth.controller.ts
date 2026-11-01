import { Controller, Post, Body, Get, Req } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto, SsoLoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { Public } from '../../common/decorators/public.decorator';
import { PasswordChangePending } from '../../common/decorators/password-change-pending.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Authenticate user with corporate email and password' })
  @ApiResponse({ status: 200, description: 'JWT authentication token and user profile returned' })
  @ApiResponse({ status: 401, description: 'Invalid credentials or inactive account' })
  async login(@Body() loginDto: LoginDto, @Req() req: Request) {
    return this.authService.login(loginDto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Public()
  @Post('admin/login')
  @ApiOperation({ summary: 'Authenticate an HR or Super Admin for the web administration console' })
  @ApiResponse({ status: 200, description: 'Admin JWT authentication token and profile returned' })
  @ApiResponse({ status: 403, description: 'Account is not permitted to access the web administration console' })
  async adminLogin(@Body() loginDto: LoginDto, @Req() req: Request) {
    return this.authService.adminLogin(loginDto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Public()
  @Post('sso-login')
  @ApiOperation({ summary: 'Exchange Microsoft Entra ID SSO token for application JWT' })
  @ApiResponse({ status: 200, description: 'SSO exchange successful' })
  async ssoLogin(@Body() ssoDto: SsoLoginDto, @Req() req: Request) {
    return this.authService.ssoLogin(ssoDto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Public()
  @Post('refresh')
  @ApiOperation({ summary: 'Rotate a refresh token for a new access and refresh token pair' })
  @ApiResponse({ status: 200, description: 'Newly issued access and refresh tokens' })
  @ApiResponse({ status: 401, description: 'Refresh token is invalid, expired or already used' })
  async refresh(@Body() dto: RefreshTokenDto, @Req() req: Request) {
    return this.authService.refresh(dto.refreshToken, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Post('logout')
  @PasswordChangePending()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke the current session' })
  @ApiResponse({ status: 200, description: 'Session revoked' })
  async logout(@CurrentUser() user: AuthenticatedUser) {
    await this.authService.logout(user.sessionId!);
    return { message: 'Signed out.' };
  }

  @Post('change-password')
  @PasswordChangePending()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change the signed-in user password and rotate their sessions' })
  @ApiResponse({ status: 200, description: 'Password changed and fresh tokens issued' })
  @ApiResponse({ status: 400, description: 'New password matches the current password' })
  @ApiResponse({ status: 401, description: 'Current password is incorrect' })
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
    @Req() req: Request,
  ) {
    return this.authService.changePassword(user.id, user.sessionId!, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Get('me')
  @PasswordChangePending()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Retrieve currently logged in employee profile' })
  @ApiResponse({ status: 200, description: 'Current authenticated profile' })
  async getMe(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.getProfile(user.id);
  }

  @Public()
  @Get('roles-info')
  @ApiOperation({ summary: 'System role definitions and access tiers' })
  getRolesInfo() {
    return {
      roles: [
        {
          role: 'EMPLOYEE',
          description: 'Standard team member with mobile app punch in/out, leave requests, and payroll access.',
          canAccessWebAdmin: false,
          isAttendanceTracked: true,
        },
        {
          role: 'MANAGER',
          description: 'Direct team lead with team attendance monitoring and leave approval workflows.',
          canAccessWebAdmin: false,
          isAttendanceTracked: true,
        },
        {
          role: 'HR_ADMIN',
          description: 'HR Specialist managing company-wide leave approvals, branches, and payroll (is also an employee).',
          canAccessWebAdmin: true,
          isAttendanceTracked: true,
        },
        {
          role: 'SUPER_ADMIN',
          description: 'Company Owner/C-Level executive with total system control on Web Console. Exempt from punches.',
          canAccessWebAdmin: true,
          isAttendanceTracked: false,
        },
      ],
    };
  }
}
