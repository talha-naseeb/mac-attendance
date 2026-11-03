import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import {
  AUDIT_LOGS_DEFAULT_PAGE_SIZE,
  AUDIT_LOGS_MAX_PAGES,
  AUDIT_LOGS_MAX_PAGE_SIZE,
  AuditLogsQueryDto,
} from './dto/audit-logs-query.dto';

@Injectable()
export class AuditLogsService {
  constructor(private readonly prisma: PrismaService) {}

  async findPaginated(query: AuditLogsQueryDto = {}) {
    const page = Math.min(
      AUDIT_LOGS_MAX_PAGES,
      Math.max(1, query.page ?? 1),
    );
    const pageSize = Math.min(
      AUDIT_LOGS_MAX_PAGE_SIZE,
      Math.max(1, query.pageSize ?? AUDIT_LOGS_DEFAULT_PAGE_SIZE),
    );

    const where: Prisma.AuditLogWhereInput = {};
    const andClauses: Prisma.AuditLogWhereInput[] = [];

    const resource = query.resource?.trim();
    if (resource && resource !== 'ALL') {
      andClauses.push({ resource });
    }

    const action = query.action?.trim();
    if (action && action !== 'ALL') {
      andClauses.push({
        action: { contains: action, mode: 'insensitive' },
      });
    }

    const search = query.search?.trim();
    if (search) {
      andClauses.push({
        OR: [
          { action: { contains: search, mode: 'insensitive' } },
          { resource: { contains: search, mode: 'insensitive' } },
          { ipAddress: { contains: search, mode: 'insensitive' } },
          {
            actorUser: {
              OR: [
                { employeeId: { contains: search, mode: 'insensitive' } },
                { firstName: { contains: search, mode: 'insensitive' } },
                { lastName: { contains: search, mode: 'insensitive' } },
                { fullName: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
              ],
            },
          },
        ],
      });
    }

    if (andClauses.length > 0) {
      where.AND = andClauses;
    }

    const maxWindowItems = AUDIT_LOGS_MAX_PAGES * pageSize;
    const skip = (page - 1) * pageSize;

    const [total, rows] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip,
        take: pageSize,
        include: {
          actorUser: {
            select: {
              id: true,
              employeeId: true,
              firstName: true,
              lastName: true,
              email: true,
              role: true,
              department: true,
            },
          },
        },
      }),
    ]);

    const windowTotal = Math.min(total, maxWindowItems);
    const totalPages = Math.min(
      AUDIT_LOGS_MAX_PAGES,
      Math.max(1, Math.ceil(windowTotal / pageSize)),
    );

    return {
      items: rows.map((row) => ({
        id: row.id,
        action: row.action,
        resource: row.resource,
        detailsJson: (row.detailsJson as Record<string, unknown> | null) ?? null,
        ipAddress: row.ipAddress ?? null,
        createdAt: row.createdAt,
        actor: row.actorUser
          ? {
              id: row.actorUser.id,
              employeeId: row.actorUser.employeeId,
              name: `${row.actorUser.firstName} ${row.actorUser.lastName}`,
              email: row.actorUser.email,
              role: row.actorUser.role,
              department: row.actorUser.department,
            }
          : null,
      })),
      page,
      pageSize,
      maxPages: AUDIT_LOGS_MAX_PAGES,
      total,
      windowTotal,
      totalPages,
    };
  }
}
