import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

export interface AuditEntry {
  actorUserId?: string | null;
  action: string;
  resource: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
}

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async record(entry: AuditEntry): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        actorUserId: entry.actorUserId ?? null,
        action: entry.action,
        resource: entry.resource,
        detailsJson: (entry.details ?? {}) as object,
        ipAddress: entry.ipAddress,
      },
    });
  }
}
