import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, SessionRevokeReason, UserRole } from '@prisma/client';
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

const SESSION_ENDED = 'Your session has ended. Sign in again.';

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

  private absoluteExpiryFor(role: UserRole): Date {
    const hours =
      role === UserRole.SUPER_ADMIN
        ? this.configService.get<number>('auth.superAdminAbsoluteSessionHours') ?? 8
        : this.configService.get<number>('auth.absoluteSessionHours') ?? 720;
    return new Date(Date.now() + hours * 60 * 60 * 1000);
  }

  async createSession(
    input: {
      userId: string;
      role: UserRole;
      workspaceId?: string | null;
      membershipId?: string | null;
    } & SessionMeta,
  ): Promise<IssuedSession> {
    return this.issue(
      {
        userId: input.userId,
        workspaceId: input.workspaceId ?? null,
        membershipId: input.membershipId ?? null,
        familyId: randomUUID(),
        absoluteExpiresAt: this.absoluteExpiryFor(input.role),
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      },
      this.prisma,
    );
  }

  private async issue(
    input: {
      userId: string;
      workspaceId?: string | null;
      membershipId?: string | null;
      familyId: string;
      absoluteExpiresAt: Date;
      ipAddress?: string;
      userAgent?: string;
    },
    client: Prisma.TransactionClient,
  ): Promise<IssuedSession> {
    const secret = generateRefreshSecret();
    const refreshExpiresAt = new Date(Date.now() + this.refreshDays * 24 * 60 * 60 * 1000);
    const session = await client.authSession.create({
      data: {
        userId: input.userId,
        workspaceId: input.workspaceId ?? null,
        membershipId: input.membershipId ?? null,
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
  ): Promise<IssuedSession & { userId: string; workspaceId: string | null; membershipId: string | null }> {
    const parsed = parseRefreshToken(refreshToken);
    if (!parsed) {
      throw new UnauthorizedException(SESSION_ENDED);
    }
    const current = await this.prisma.authSession.findUnique({
      where: { id: parsed.sessionId },
    });
    if (!current || !refreshTokenMatches(parsed.secret, current.refreshTokenHash)) {
      throw new UnauthorizedException(SESSION_ENDED);
    }
    if (current.revokedAt) {
      // Only a row that was replaced by a successor is a genuine rotated-token replay.
      // A row revoked by logout / password change / role change / deactivation is not.
      if (current.replacedById) {
        await this.revokeFamily(
          current.familyId,
          SessionRevokeReason.REFRESH_REUSE,
          current.userId,
        );
      }
      throw new UnauthorizedException(SESSION_ENDED);
    }
    if (
      current.refreshExpiresAt.getTime() <= Date.now() ||
      current.absoluteExpiresAt.getTime() <= Date.now()
    ) {
      // Expiry is marked by the timestamp alone; revokeReason stays null.
      await this.prisma.authSession.updateMany({
        where: { id: current.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException(SESSION_ENDED);
    }

    let replayedRotation = false;
    let next: IssuedSession;
    try {
      next = await this.prisma.$transaction(async (tx) => {
        // Consume the presented session atomically. Losing this race means another
        // refresh already rotated it, so fail closed and roll the successor back.
        const consumed = await tx.authSession.updateMany({
          where: { id: current.id, revokedAt: null },
          data: { revokedAt: new Date(), lastUsedAt: new Date() },
        });
        if (consumed.count === 0) {
          const latest = await tx.authSession.findUnique({
            where: { id: current.id },
            select: { replacedById: true },
          });
          replayedRotation = Boolean(latest?.replacedById);
          throw new UnauthorizedException(SESSION_ENDED);
        }

        const issued = await this.issue(
          {
            userId: current.userId,
            workspaceId: current.workspaceId ?? null,
            membershipId: current.membershipId ?? null,
            familyId: current.familyId,
            absoluteExpiresAt: current.absoluteExpiresAt,
            ipAddress: meta.ipAddress,
            userAgent: meta.userAgent,
          },
          tx,
        );
        // replacedById is the rotation marker; revokeReason stays null.
        await tx.authSession.update({
          where: { id: current.id },
          data: { replacedById: issued.sessionId },
        });
        return issued;
      });
    } catch (error) {
      if (replayedRotation) {
        // The transaction rolled back, so the family revocation happens outside it.
        await this.revokeFamily(
          current.familyId,
          SessionRevokeReason.REFRESH_REUSE,
          current.userId,
        );
      }
      throw error;
    }

    await this.audit.record({
      actorUserId: current.userId,
      action: 'AUTH_SESSION_REFRESHED',
      resource: 'AuthSession',
      details: { sessionId: next.sessionId, familyId: current.familyId },
      ipAddress: meta.ipAddress,
    });
    return {
      ...next,
      userId: current.userId,
      workspaceId: current.workspaceId ?? null,
      membershipId: current.membershipId ?? null,
    };
  }

  async revoke(sessionId: string, reason: SessionRevokeReason): Promise<void> {
    await this.prisma.authSession.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date(), revokeReason: reason },
    });
  }

  async revokeAllForUser(userId: string, reason: SessionRevokeReason): Promise<void> {
    await this.prisma.authSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date(), revokeReason: reason },
    });
  }

  private async revokeFamily(
    familyId: string,
    reason: SessionRevokeReason,
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
      select: { id: true, userId: true, revokedAt: true, absoluteExpiresAt: true },
    });
    if (!session || session.revokedAt || session.absoluteExpiresAt.getTime() <= Date.now()) {
      return null;
    }
    return session;
  }
}
