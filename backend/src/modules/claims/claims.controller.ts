import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ClaimCategory } from '@prisma/client';
import { ClaimsService } from './claims.service';
import {
  ClaimDecisionDto,
  SubmitClaimDto,
  UpdateClaimPolicyDto,
} from './dto/claims.dto';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import { Roles, UserRole } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

@ApiTags('Reimbursement Claims & Allowances')
@Controller('claims')
@ApiBearerAuth()
export class ClaimsController {
  constructor(private readonly claimsService: ClaimsService) {}

  @Get('policies')
  @ApiOperation({
    summary:
      'Get reimbursement claim categories, policy caps, and personal usage',
  })
  @ApiQuery({ name: 'period', required: false, example: '2026-10' })
  async getPolicies(
    @CurrentUser() user: AuthenticatedUser,
    @Query('period') period?: string,
  ) {
    return this.claimsService.getPoliciesForUser(user.id, period);
  }

  @Patch('policies/:category')
  @UseGuards(RolesGuard)
  @Roles(UserRole.HR_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Update monthly/annual cap or privacy settings for a claim category',
  })
  async updatePolicy(
    @CurrentUser() user: AuthenticatedUser,
    @Param('category') category: ClaimCategory,
    @Body() dto: UpdateClaimPolicyDto,
  ) {
    return this.claimsService.updatePolicy(category, dto, user.id);
  }

  @Post()
  @ApiOperation({
    summary:
      'Submit a receipt-backed reimbursement claim (Medical, Insurance, Petrol, Wi-Fi)',
  })
  @ApiResponse({ status: 201, description: 'Claim submitted' })
  async submitClaim(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SubmitClaimDto,
  ) {
    return this.claimsService.submitClaim(user.id, dto);
  }

  @Get('my')
  @ApiOperation({ summary: 'Get authenticated employee reimbursement claims' })
  async getMyClaims(@CurrentUser() user: AuthenticatedUser) {
    return this.claimsService.getMyClaims(user.id);
  }

  @Get('pending')
  @UseGuards(RolesGuard)
  @Roles(UserRole.MANAGER, UserRole.HR_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary:
      'Get pending reimbursement claims awaiting Manager (Stage 1) or HR (Stage 2) review',
  })
  async getPendingClaims(@CurrentUser() user: AuthenticatedUser) {
    return this.claimsService.getPendingClaims(user.id, user.role);
  }

  @Get('admin')
  @UseGuards(RolesGuard)
  @Roles(UserRole.HR_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Get all reimbursement claims for HR/Super Admin console',
  })
  @ApiQuery({ name: 'period', required: false, example: '2026-10' })
  async getAdminClaims(@Query('period') period?: string) {
    return this.claimsService.getAllClaimsForAdmin(period);
  }

  @Get(':id')
  @ApiOperation({
    summary:
      'Get a specific reimbursement claim (enforces Medical/Insurance direct-to-HR privacy)',
  })
  async getClaimById(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.claimsService.getClaimById(id, user.id, user.role);
  }

  @Patch(':id/decision')
  @UseGuards(RolesGuard)
  @Roles(UserRole.MANAGER, UserRole.HR_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary:
      'Approve or reject a reimbursement claim (Stage 1 Manager -> Stage 2 HR -> Payroll)',
  })
  async makeDecision(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ClaimDecisionDto,
  ) {
    return this.claimsService.makeDecision(id, user.id, user.role, dto);
  }

  @Patch(':id/cancel')
  @ApiOperation({
    summary: 'Cancel a reimbursement claim (if not locked in payroll)',
  })
  async cancelClaim(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.claimsService.cancelClaim(id, user.id, user.role);
  }
}
