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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IntegrationProvider } from '@prisma/client';
import { IntegrationsService } from './integrations.service';
import { Public } from '../../common/decorators/public.decorator';
import { Roles, UserRole } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';

@ApiTags('Enterprise Integrations (Teams, Outlook, Entra ID)')
@Controller('integrations')
export class IntegrationsController {
  constructor(private readonly integrationsService: IntegrationsService) {}

  @Public()
  @Get('status')
  @ApiOperation({ summary: 'Public integration feature flags (Teams, Outlook, Entra SSO)' })
  async getPublicStatus() {
    return this.integrationsService.getPublicStatus();
  }

  @Get('admin/configs')
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(UserRole.HR_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get all integration configs and outbox summary (HR/Super Admin)' })
  async getAdminConfigs() {
    return this.integrationsService.getAllConfigs();
  }

  @Patch('admin/configs/:provider')
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(UserRole.HR_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Enable/disable or configure an integration provider' })
  async updateConfig(
    @Param('provider') provider: IntegrationProvider,
    @Body()
    body: {
      enabled?: boolean;
      webhookUrl?: string | null;
      tenantId?: string | null;
      simulateFailure?: boolean;
    },
    @CurrentUser() actor?: AuthenticatedUser,
  ) {
    return this.integrationsService.updateConfig(provider, body, actor?.id);
  }

  @Post('admin/configs/:provider/test')
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(UserRole.HR_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Test connection health for a provider' })
  async testProviderConnection(
    @Param('provider') provider: IntegrationProvider,
    @CurrentUser() actor?: AuthenticatedUser,
  ) {
    return this.integrationsService.testConnection(provider, actor?.id);
  }

  @Get('admin/outbox')
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(UserRole.HR_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'List integration outbox events with delivery & retry state' })
  async listOutbox(
    @Query('provider') provider?: IntegrationProvider,
    @Query('status') status?: string,
    @Query('resourceId') resourceId?: string,
  ) {
    return this.integrationsService.listOutboxEvents({
      provider,
      status,
      resourceId,
    });
  }

  @Post('admin/outbox/:id/retry')
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(UserRole.HR_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Retry a specific integration outbox event idempotently' })
  async retryOutboxEvent(@Param('id') id: string) {
    return this.integrationsService.executeOutboxDelivery(id);
  }

  @Post('admin/retry-all')
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(UserRole.HR_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Retry all failed/pending integration outbox events' })
  async retryAllFailed() {
    return this.integrationsService.retryFailedOutboxEvents();
  }
}
