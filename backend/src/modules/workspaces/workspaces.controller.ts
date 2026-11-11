import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  forwardRef,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { Roles, UserRole } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuthService } from '../auth/auth.service';
import { WorkspacesService } from './workspaces.service';
import {
  AcceptInviteDto,
  ConvertToBusinessDto,
  CreateInviteDto,
  CreateWorkspaceDto,
  UpdateMemberDto,
  UpdateWorkspaceDto,
  UpsertSsoConnectionDto,
  UpsertSsoGroupMappingsDto,
} from './dto/workspaces.dto';

@ApiTags('Workspaces & Multi-Tenancy')
@ApiBearerAuth()
@Controller('workspaces')
export class WorkspacesController {
  constructor(
    private readonly workspacesService: WorkspacesService,
    @Inject(forwardRef(() => AuthService))
    private readonly authService: AuthService,
  ) {}

  private requireActiveWorkspaceId(user: AuthenticatedUser): string {
    if (!user.workspaceId) {
      throw new BadRequestException(
        'No active workspace in session. Select or switch to a workspace first.',
      );
    }
    return user.workspaceId;
  }

  @Get()
  @ApiOperation({ summary: 'List all workspaces the authenticated user belongs to' })
  listMyWorkspaces(@CurrentUser() user: AuthenticatedUser) {
    return this.workspacesService.listUserWorkspaces(user.id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new PERSONAL or BUSINESS workspace' })
  createWorkspace(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateWorkspaceDto) {
    return this.workspacesService.createWorkspace(user.id, dto);
  }

  @Post(':id/switch')
  @ApiOperation({ summary: 'Switch active workspace and issue fresh workspace-scoped JWTs' })
  switchWorkspace(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') workspaceId: string,
    @Req() req: Request,
  ) {
    return this.authService.switchWorkspace(user.id, user.sessionId!, workspaceId, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Post(':id/convert-business')
  @ApiOperation({ summary: 'Upgrade a PERSONAL workspace to a BUSINESS workspace in place' })
  convertToBusiness(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') workspaceId: string,
    @Body() dto: ConvertToBusinessDto,
  ) {
    return this.workspacesService.convertPersonalToBusiness(workspaceId, user.id, dto);
  }

  @Get('current')
  @ApiOperation({ summary: 'Get active workspace details, entitlements, and seat meter' })
  getCurrent(@CurrentUser() user: AuthenticatedUser) {
    return this.workspacesService.getCurrentWorkspaceContext(
      this.requireActiveWorkspaceId(user),
      user.id,
    );
  }

  @Patch('current')
  @ApiOperation({ summary: 'Update active workspace settings, approval policy, or plan' })
  updateCurrent(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateWorkspaceDto) {
    return this.workspacesService.updateCurrentWorkspace(
      this.requireActiveWorkspaceId(user),
      user.id,
      dto,
    );
  }

  @Get('current/members')
  @ApiOperation({ summary: 'List members in the active workspace (tenant-isolated)' })
  listMembers(@CurrentUser() user: AuthenticatedUser) {
    return this.workspacesService.listMembers(this.requireActiveWorkspaceId(user), user.id);
  }

  @Patch('current/members/:membershipId')
  @ApiOperation({ summary: 'Update a workspace member role, status, or reporting line' })
  updateMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('membershipId') membershipId: string,
    @Body() dto: UpdateMemberDto,
  ) {
    return this.workspacesService.updateMember(
      this.requireActiveWorkspaceId(user),
      membershipId,
      user.id,
      dto,
    );
  }

  @Post('current/invites')
  @ApiOperation({ summary: 'Invite a teammate to the active Business workspace (seat-checked)' })
  createInvite(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateInviteDto) {
    return this.workspacesService.createInvite(
      this.requireActiveWorkspaceId(user),
      user.id,
      dto,
    );
  }

  @Get('current/invites')
  @ApiOperation({ summary: 'List invitations in the active workspace' })
  listInvites(@CurrentUser() user: AuthenticatedUser) {
    return this.workspacesService.listInvites(this.requireActiveWorkspaceId(user), user.id);
  }

  @Delete('current/invites/:inviteId')
  @ApiOperation({ summary: 'Revoke a pending workspace invitation' })
  revokeInvite(@CurrentUser() user: AuthenticatedUser, @Param('inviteId') inviteId: string) {
    return this.workspacesService.revokeInvite(
      this.requireActiveWorkspaceId(user),
      inviteId,
      user.id,
    );
  }

  @Post('invites/accept')
  @ApiOperation({ summary: 'Accept a workspace invitation using its token' })
  acceptInvite(@CurrentUser() user: AuthenticatedUser, @Body() dto: AcceptInviteDto) {
    return this.workspacesService.acceptInvite(user.id, user.email, dto.token);
  }

  @Get('current/sso')
  @ApiOperation({ summary: 'Get active workspace SSO configuration and group mappings' })
  getSso(@CurrentUser() user: AuthenticatedUser) {
    return this.workspacesService.getSsoConfig(this.requireActiveWorkspaceId(user), user.id);
  }

  @Put('current/sso')
  @ApiOperation({ summary: 'Configure Google or Microsoft SSO for the active workspace' })
  upsertSso(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpsertSsoConnectionDto) {
    return this.workspacesService.upsertSsoConfig(
      this.requireActiveWorkspaceId(user),
      user.id,
      dto,
    );
  }

  @Put('current/sso/group-mappings')
  @ApiOperation({ summary: 'Configure SSO provider group to workspace role mappings' })
  upsertSsoGroupMappings(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpsertSsoGroupMappingsDto,
  ) {
    return this.workspacesService.upsertGroupMappings(
      this.requireActiveWorkspaceId(user),
      user.id,
      dto,
    );
  }

  @Post('backfill')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Idempotently backfill legacy single-company data into Macquires workspace' })
  backfill() {
    return this.workspacesService.backfillDefaultWorkspace();
  }
}
