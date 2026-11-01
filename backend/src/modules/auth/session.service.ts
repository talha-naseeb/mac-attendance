import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../../common/services/audit.service';
import {
  formatRefreshToken,
  generateRefreshSecret,
  hashRefreshSecret,
  parseRefreshToken,
  refreshTokenMatches,
} from './token.util';

type RevokeReason =
  | 'LOGOUT'
  | 'PASSWORD_CHANGE'
  | 'ROLE_CHANGE'
  | 'DEACTIVATED'
  | 'REFRESH_REUSE'
  | 'ADMIN_REVOKE';

interface SessionMeta {
  ipAddress?: string;
  userAgent?: string;
}

interface IssuedSession {
  sessionId: string;
  refreshToken: string;
  refreshExpiresAt: Date;
  absoluteExpiresAt: Date;
}

@Injectable()
export class SessionService {
  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private audit: AuditService,
  ) {}

  private get refreshDays(): number {
    return this.configService.get<number>('auth.refreshTokenDays') ?? 7;
  }

  private absoluteExpiryFor(role: string): Date {
    const hours =
      role === 'SUPER_ADMIN'
        ? this.configService.get<number>('auth.superAdminAbsoluteSessionHours') ?? 8
        : this.configService.get<number>('auth.absoluteSessionHours') ?? 720;
    return new Date(Date.now() + hours * 60 * 60 * 1000);
  }

  async createSession(input: { userId: string; role: string } & SessionMeta): Promise<IssuedSession> {
    return this.issue({
      userId: input.userId,
      familyId: randomUUID(),
      absoluteExpiresAt: this.absoluteExpiryFor(input.role),
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });
  }

  private async issue(input: {
    userId: string;
    familyId: string;
    absoluteExpiresAt: Date;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<IssuedSession> {
    const secret = generateRefreshSecret();
    const refreshExpiresAt = new Date(Date.now() + this.refreshDays * 24 * 60 * 60 * 1000);
    const session = await this.prisma.authSession.create({
      data: {
        userId: input.userId,
        familyId: input.familyId,
        refreshTokenHash: hashRefreshSecret(secret),
        absoluteExpiresAt: input.absoluteExpiresAt,
        refreshExpiresAt,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      },
    });
    return {
      sessionId: session.id,
      refreshToken: formatRefreshToken(session.id, secret),
      refreshExpiresAt,
      absoluteExpiresAt: input.absoluteExpiresAt,
    };
  }

  async rotate(
    refreshToken: string,
    meta: SessionMeta,
  ): Promise<IssuedSession & { userId: string }> {
    const parsed = parseRefreshToken(refreshToken);
    if (!parsed) {
      throw new UnauthorizedException('Your session has ended. Sign in again.');
    }
    const current = await this.prisma.authSession.findUnique({
      where: { id: parsed.sessionId },
    });
    if (!current || !refreshTokenMatches(parsed.secret, current.refreshTokenHash)) {
      throw new UnauthorizedException('Your session has ended. Sign in again.');
    }
    if (current.revokedAt) {
      await this.revokeFamily(current.familyId, 'REFRESH_REUSE', current.userId);
      throw new UnauthorizedException('Your session has ended. Sign in again.');
    }
    if (
      current.refreshExpiresAt.getTime() <= Date.now() ||
      current.absoluteExpiresAt.getTime() <= Date.now()
    ) {
      await this.revoke(current.id, 'LOGOUT');
      throw new UnauthorizedException('Your session has ended. Sign in again.');
    }

    const next = await this.issue({
      userId: current.userId,
      familyId: current.familyId,
      absoluteExpiresAt: current.absoluteExpiresAt,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
    await this.prisma.authSession.update({
      where: { id: current.id },
      data: {
        revokedAt: new Date(),
        revokeReason: 'LOGOUT',
        replacedById: next.sessionId,
        lastUsedAt: new Date(),
      },
    });
    await this.audit.record({
      actorUserId: current.userId,
      action: 'AUTH_SESSION_REFRESHED',
      resource: 'AuthSession',
      details: { sessionId: next.sessionId, familyId: current.familyId },
      ipAddress: meta.ipAddress,
    });
    return { ...next, userId: current.userId };
  }

  async revoke(sessionId: string, reason: RevokeReason): Promise<void> {
    await this.prisma.authSession.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date(), revokeReason: reason },
    });
  }

  async revokeAllForUser(userId: string, reason: RevokeReason): Promise<void> {
    await this.prisma.authSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date(), revokeReason: reason },
    });
  }

  private async revokeFamily(
    familyId: string,
    reason: RevokeReason,
    actorUserId: string,
  ): Promise<void> {
    const result = await this.prisma.authSession.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date(), revokeReason: reason },
    });
    await this.audit.record({
      actorUserId,
      action: 'AUTH_SESSION_REFRESH_REUSE',
      resource: 'AuthSession',
      details: { familyId, revokedSessions: result.count },
    });
  }

  async findActive(sessionId: string) {
    const session = await this.prisma.authSession.findUnique({
      where: { id: sessionId },
      select: { id: true, revokedAt: true, absoluteExpiresAt: true },
    });
    if (!session || session.revokedAt || session.absoluteExpiresAt.getTime() <= Date.now()) {
      return null;
    }
    return session;
  }
}
