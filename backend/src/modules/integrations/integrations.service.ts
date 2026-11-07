import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { IntegrationProvider } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../../common/services/audit.service';

const DEFAULT_PROVIDERS: IntegrationProvider[] = [
  'TEAMS',
  'OUTLOOK',
  'ENTRA_SSO',
];

@Injectable()
export class IntegrationsService {
  private readonly logger = new Logger(IntegrationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit?: AuditService,
  ) {}

  async ensureProviderConfig(provider: IntegrationProvider) {
    return this.prisma.integrationConfig.upsert({
      where: { provider },
      create: {
        provider,
        enabled: provider !== 'ENTRA_SSO', // TEAMS & OUTLOOK enabled by default; ENTRA_SSO opt-in
        simulateFailure: false,
      },
      update: {},
    });
  }

  async getAllConfigs() {
    for (const p of DEFAULT_PROVIDERS) {
      await this.ensureProviderConfig(p);
    }
    const configs = await this.prisma.integrationConfig.findMany({
      orderBy: { provider: 'asc' },
    });
    const outboxCounts = await this.prisma.integrationOutboxEvent.groupBy({
      by: ['provider', 'status'],
      _count: { _all: true },
    });

    return {
      configs,
      outboxSummary: outboxCounts.map((c) => ({
        provider: c.provider,
        status: c.status,
        count: c._count._all,
      })),
    };
  }

  async getPublicStatus() {
    const { configs } = await this.getAllConfigs();
    return {
      teamsEnabled:
        configs.find((c) => c.provider === 'TEAMS')?.enabled ?? true,
      outlookEnabled:
        configs.find((c) => c.provider === 'OUTLOOK')?.enabled ?? true,
      entraSsoEnabled:
        configs.find((c) => c.provider === 'ENTRA_SSO')?.enabled ?? false,
    };
  }

  async updateConfig(
    provider: IntegrationProvider,
    patch: {
      enabled?: boolean;
      webhookUrl?: string | null;
      tenantId?: string | null;
      simulateFailure?: boolean;
    },
    actorUserId?: string,
  ) {
    await this.ensureProviderConfig(provider);
    const updated = await this.prisma.integrationConfig.update({
      where: { provider },
      data: {
        ...(patch.enabled !== undefined ? { enabled: patch.enabled } : {}),
        ...(patch.webhookUrl !== undefined
          ? { webhookUrl: patch.webhookUrl }
          : {}),
        ...(patch.tenantId !== undefined ? { tenantId: patch.tenantId } : {}),
        ...(patch.simulateFailure !== undefined
          ? { simulateFailure: patch.simulateFailure }
          : {}),
      },
    });

    await this.audit?.record({
      actorUserId: actorUserId ?? null,
      action: 'INTEGRATION_CONFIG_UPDATED',
      resource: 'IntegrationConfig',
      details: {
        provider,
        enabled: updated.enabled,
        simulateFailure: updated.simulateFailure,
      },
    });

    return updated;
  }

  async testConnection(provider: IntegrationProvider, actorUserId?: string) {
    const config = await this.ensureProviderConfig(provider);
    if (!config.enabled) {
      return {
        provider,
        ok: false,
        status: 'DISABLED',
        message: `${provider} integration is currently disabled.`,
      };
    }

    if (config.simulateFailure) {
      const now = new Date();
      await this.prisma.integrationConfig.update({
        where: { provider },
        data: {
          lastFailureAt: now,
          lastErrorMessage: `Simulated ${provider} sandbox outage (503 Service Unavailable)`,
        },
      });
      return {
        provider,
        ok: false,
        status: 'FAILED',
        message: `Connection test to ${provider} failed: sandbox unavailable.`,
      };
    }

    const now = new Date();
    await this.prisma.integrationConfig.update({
      where: { provider },
      data: {
        lastSuccessAt: now,
        lastErrorMessage: null,
      },
    });

    await this.audit?.record({
      actorUserId: actorUserId ?? null,
      action: 'INTEGRATION_CONNECTION_TESTED',
      resource: 'IntegrationConfig',
      details: { provider, ok: true },
    });

    return {
      provider,
      ok: true,
      status: 'CONNECTED',
      testedAt: now.toISOString(),
      message: `${provider} connector verified and healthy.`,
    };
  }

  /**
   * M7.3, M7.6 (INT-02, INT-06): Dispatches a Teams Adaptive Card with idempotency and retry support.
   * Never throws on failure so core leave transactions are never blocked.
   */
  async dispatchTeamsAdaptiveCard(
    leaveId: string,
    payload: Record<string, any>,
  ) {
    try {
      const config = await this.ensureProviderConfig('TEAMS');
      if (!config.enabled) {
        return {
          status: 'DISABLED' as const,
          externalMessageId: null,
          event: null,
        };
      }

      const idempotencyKey = `TEAMS:LEAVE_CARD:${leaveId}`;
      const existing = await this.prisma.integrationOutboxEvent.findUnique({
        where: { idempotencyKey },
      });

      if (
        existing &&
        existing.status === 'DELIVERED' &&
        existing.externalMessageId
      ) {
        return {
          status: 'DELIVERED' as const,
          externalMessageId: existing.externalMessageId,
          event: existing,
          idempotent: true,
        };
      }

      const event = await this.prisma.integrationOutboxEvent.upsert({
        where: { idempotencyKey },
        create: {
          idempotencyKey,
          provider: 'TEAMS',
          eventType: 'ADAPTIVE_CARD_DISPATCH',
          resourceId: leaveId,
          payloadJson: payload,
          status: 'PENDING',
          attempts: 0,
        },
        update: {
          payloadJson: payload,
        },
      });

      return await this.executeOutboxDelivery(event.id);
    } catch (err: any) {
      this.logger.warn(
        `Non-blocking Teams dispatch error for leave ${leaveId}: ${err?.message}`,
      );
      return {
        status: 'FAILED' as const,
        externalMessageId: null,
        event: null,
      };
    }
  }

  /**
   * M7.4, M7.6 (INT-03, INT-06): Creates, updates, or deletes an Outlook Out-Of-Office calendar event.
   * Uses a stable idempotency key per leave request so date changes update the same event
   * and cancellations remove it cleanly.
   */
  async syncOutlookCalendarEvent(
    leave: {
      id: string;
      userId: string;
      type: string;
      startDate: Date;
      endDate: Date;
    },
    action: 'UPSERT' | 'DELETE',
  ) {
    try {
      const config = await this.ensureProviderConfig('OUTLOOK');
      if (!config.enabled) {
        return {
          status: 'DISABLED' as const,
          externalMessageId: null,
          event: null,
        };
      }

      const idempotencyKey = `OUTLOOK:LEAVE_OOO:${leave.id}`;
      const existing = await this.prisma.integrationOutboxEvent.findUnique({
        where: { idempotencyKey },
      });

      if (action === 'DELETE') {
        if (!existing) {
          return {
            status: 'CANCELLED' as const,
            externalMessageId: null,
            event: null,
          };
        }

        const cancelledEvent = await this.prisma.integrationOutboxEvent.update({
          where: { id: existing.id },
          data: {
            eventType: 'CALENDAR_OOO_DELETE',
            status: 'CANCELLED',
            lastError: null,
            payloadJson: {
              ...(existing.payloadJson as Record<string, any>),
              cancelledAt: new Date().toISOString(),
            },
          },
        });

        await this.prisma.leaveRequest.update({
          where: { id: leave.id },
          data: { outlookCalendarEventId: null },
        });

        await this.prisma.integrationConfig.update({
          where: { provider: 'OUTLOOK' },
          data: { lastSuccessAt: new Date(), lastErrorMessage: null },
        });

        return {
          status: 'CANCELLED' as const,
          externalMessageId: null,
          event: cancelledEvent,
        };
      }

      const payload = {
        leaveId: leave.id,
        userId: leave.userId,
        subject: `Out of Office (${leave.type})`,
        startDate: leave.startDate.toISOString(),
        endDate: leave.endDate.toISOString(),
        showAs: 'oof',
      };

      const event = await this.prisma.integrationOutboxEvent.upsert({
        where: { idempotencyKey },
        create: {
          idempotencyKey,
          provider: 'OUTLOOK',
          eventType: 'CALENDAR_OOO_UPSERT',
          resourceId: leave.id,
          payloadJson: payload,
          status: 'PENDING',
          attempts: 0,
        },
        update: {
          eventType: 'CALENDAR_OOO_UPSERT',
          payloadJson: payload,
        },
      });

      return await this.executeOutboxDelivery(event.id, true);
    } catch (err: any) {
      this.logger.warn(
        `Non-blocking Outlook sync error for leave ${leave.id}: ${err?.message}`,
      );
      return {
        status: 'FAILED' as const,
        externalMessageId: null,
        event: null,
      };
    }
  }

  /**
   * Executes or retries delivery of an outbox event with idempotency protection.
   */
  async executeOutboxDelivery(eventId: string, allowUpdateIfDelivered = false) {
    const event = await this.prisma.integrationOutboxEvent.findUnique({
      where: { id: eventId },
    });
    if (!event) {
      throw new NotFoundException(`Outbox event ${eventId} not found.`);
    }

    if (
      event.status === 'DELIVERED' &&
      event.externalMessageId &&
      !allowUpdateIfDelivered
    ) {
      return {
        status: 'DELIVERED' as const,
        externalMessageId: event.externalMessageId,
        event,
        idempotent: true,
      };
    }

    const config = await this.ensureProviderConfig(event.provider);
    const now = new Date();

    if (config.simulateFailure) {
      const errorMessage = `${event.provider} sandbox unavailable (503 Service Unavailable)`;
      const failed = await this.prisma.integrationOutboxEvent.update({
        where: { id: event.id },
        data: {
          status: 'FAILED',
          attempts: { increment: 1 },
          lastError: errorMessage,
        },
      });

      await this.prisma.integrationConfig.update({
        where: { provider: event.provider },
        data: {
          lastFailureAt: now,
          lastErrorMessage: errorMessage,
        },
      });

      return {
        status: 'FAILED' as const,
        externalMessageId: null,
        event: failed,
        idempotent: false,
      };
    }

    const externalMessageId =
      event.externalMessageId ||
      (event.provider === 'TEAMS'
        ? `teams-card-${event.resourceId}`
        : `outlook-ooo-${event.resourceId}`);

    const delivered = await this.prisma.integrationOutboxEvent.update({
      where: { id: event.id },
      data: {
        status: 'DELIVERED',
        attempts: { increment: 1 },
        externalMessageId,
        lastError: null,
        deliveredAt: now,
      },
    });

    await this.prisma.integrationConfig.update({
      where: { provider: event.provider },
      data: {
        lastSuccessAt: now,
        lastErrorMessage: null,
      },
    });

    if (event.provider === 'TEAMS') {
      await this.prisma.leaveRequest
        .update({
          where: { id: event.resourceId },
          data: { teamsAdaptiveCardMessageId: externalMessageId },
        })
        .catch(() => undefined);
    } else if (event.provider === 'OUTLOOK') {
      await this.prisma.leaveRequest
        .update({
          where: { id: event.resourceId },
          data: { outlookCalendarEventId: externalMessageId },
        })
        .catch(() => undefined);
    }

    return {
      status: 'DELIVERED' as const,
      externalMessageId,
      event: delivered,
      idempotent: false,
    };
  }

  async listOutboxEvents(filter?: {
    provider?: IntegrationProvider;
    status?: string;
    resourceId?: string;
  }) {
    return this.prisma.integrationOutboxEvent.findMany({
      where: {
        ...(filter?.provider ? { provider: filter.provider } : {}),
        ...(filter?.status ? { status: filter.status as any } : {}),
        ...(filter?.resourceId ? { resourceId: filter.resourceId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async retryFailedOutboxEvents() {
    const failedEvents = await this.prisma.integrationOutboxEvent.findMany({
      where: { status: { in: ['FAILED', 'PENDING'] } },
      orderBy: { createdAt: 'asc' },
    });

    const results = [];
    for (const ev of failedEvents) {
      const res = await this.executeOutboxDelivery(ev.id);
      results.push(res);
    }

    return {
      retriedCount: results.length,
      deliveredCount: results.filter((r) => r.status === 'DELIVERED').length,
      results,
    };
  }
}
