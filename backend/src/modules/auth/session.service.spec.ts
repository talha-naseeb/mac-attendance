import { UnauthorizedException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { SessionService } from './session.service';
import { formatRefreshToken, hashRefreshSecret, parseRefreshToken } from './token.util';

const NOW = new Date('2026-11-01T10:00:00.000Z');
const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

function buildService() {
  const prisma = {
    authSession: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(async (cb: (tx: unknown) => unknown) => cb(prisma)),
  };
  const config = { get: jest.fn().mockReturnValue(undefined) };
  const audit = { record: jest.fn() };
  const service = new SessionService(prisma as any, config as any, audit as any);
  return { prisma, config, audit, service };
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(NOW);
});

afterEach(() => {
  jest.useRealTimers();
});

describe('SessionService.createSession', () => {
  it('stores only a SHA-256 hash and derives the 7-day refresh / 30-day absolute expiry', async () => {
    const { prisma, service } = buildService();
    prisma.authSession.create.mockResolvedValue({ id: 'session-1' });

    const issued = await service.createSession({ userId: 'user-1', role: UserRole.EMPLOYEE });

    const data = prisma.authSession.create.mock.calls[0][0].data;
    const secret = parseRefreshToken(issued.refreshToken).secret;
    expect(secret).toBeTruthy();
    expect(issued.refreshToken).toBe(`session-1.${secret}`);
    expect(issued.sessionId).toBe('session-1');

    expect(data.refreshTokenHash).toBe(hashRefreshSecret(secret));
    expect(data.refreshTokenHash).not.toBe(secret);
    expect(data.refreshTokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(data.userId).toBe('user-1');
    expect(typeof data.familyId).toBe('string');

    expect(data.refreshExpiresAt.getTime()).toBe(NOW.getTime() + 7 * DAY_MS);
    expect(data.absoluteExpiresAt.getTime()).toBe(NOW.getTime() + 30 * DAY_MS);
    expect(issued.refreshExpiresAt.getTime()).toBe(NOW.getTime() + 7 * DAY_MS);
    expect(issued.absoluteExpiresAt.getTime()).toBe(NOW.getTime() + 30 * DAY_MS);
  });

  it('caps SUPER_ADMIN absolute expiry at 8 hours', async () => {
    const { prisma, service } = buildService();
    prisma.authSession.create.mockResolvedValue({ id: 'session-1' });

    const issued = await service.createSession({ userId: 'admin-1', role: UserRole.SUPER_ADMIN });

    const data = prisma.authSession.create.mock.calls[0][0].data;
    expect(data.refreshExpiresAt.getTime()).toBe(NOW.getTime() + 7 * DAY_MS);
    expect(data.absoluteExpiresAt.getTime()).toBe(NOW.getTime() + 8 * HOUR_MS);
    expect(issued.absoluteExpiresAt.getTime()).toBe(NOW.getTime() + 8 * HOUR_MS);
  });

  it('passes the caller metadata through to the row', async () => {
    const { prisma, service } = buildService();
    prisma.authSession.create.mockResolvedValue({ id: 'session-1' });

    await service.createSession({
      userId: 'user-1',
      role: UserRole.EMPLOYEE,
      ipAddress: '10.0.0.1',
      userAgent: 'jest',
    });

    const data = prisma.authSession.create.mock.calls[0][0].data;
    expect(data.ipAddress).toBe('10.0.0.1');
    expect(data.userAgent).toBe('jest');
  });
});

describe('SessionService.rotate', () => {
  const secret = 'current-secret';
  const liveSession = {
    id: 'session-1',
    userId: 'user-1',
    familyId: 'family-1',
    refreshTokenHash: hashRefreshSecret(secret),
    revokedAt: null,
    replacedById: null,
    refreshExpiresAt: new Date(NOW.getTime() + MINUTE_MS),
    absoluteExpiresAt: new Date(NOW.getTime() + 5 * DAY_MS),
  };

  it('rotates atomically inside one transaction and keeps the family and absolute expiry', async () => {
    const { prisma, audit, service } = buildService();
    prisma.authSession.findUnique.mockResolvedValue({ ...liveSession });
    prisma.authSession.updateMany.mockResolvedValue({ count: 1 });
    prisma.authSession.create.mockResolvedValue({ id: 'session-2' });
    prisma.authSession.update.mockResolvedValue({});

    const result = await service.rotate(formatRefreshToken('session-1', secret), {
      ipAddress: '10.0.0.1',
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(result.sessionId).toBe('session-2');
    expect(result.userId).toBe('user-1');

    // Successor: same family, absolute expiry carried forward, refresh re-derived from now.
    const createData = prisma.authSession.create.mock.calls[0][0].data;
    expect(createData.familyId).toBe('family-1');
    expect(createData.userId).toBe('user-1');
    expect(createData.absoluteExpiresAt.getTime()).toBe(liveSession.absoluteExpiresAt.getTime());
    expect(createData.refreshExpiresAt.getTime()).toBe(NOW.getTime() + 7 * DAY_MS);
    const newSecret = parseRefreshToken(result.refreshToken).secret;
    expect(newSecret).not.toBe(secret);
    expect(createData.refreshTokenHash).toBe(hashRefreshSecret(newSecret));

    // Presented row consumed exactly once, with no revokeReason.
    expect(prisma.authSession.updateMany).toHaveBeenCalledTimes(1);
    const consumed = prisma.authSession.updateMany.mock.calls[0][0];
    expect(consumed.where).toEqual({ id: 'session-1', revokedAt: null });
    expect(consumed.data).toEqual({ revokedAt: expect.any(Date), lastUsedAt: expect.any(Date) });
    expect(consumed.data.revokeReason).toBeUndefined();

    // replacedById is the rotation marker; no revokeReason.
    expect(prisma.authSession.update).toHaveBeenCalledTimes(1);
    const link = prisma.authSession.update.mock.calls[0][0];
    expect(link).toEqual({ where: { id: 'session-1' }, data: { replacedById: 'session-2' } });

    expect(audit.record).toHaveBeenCalledTimes(1);
    expect(audit.record).toHaveBeenCalledWith({
      actorUserId: 'user-1',
      action: 'AUTH_SESSION_REFRESHED',
      resource: 'AuthSession',
      details: { sessionId: 'session-2', familyId: 'family-1' },
      ipAddress: '10.0.0.1',
    });
  });

  it('revokes the whole family when a rotated token is replayed', async () => {
    const { prisma, audit, service } = buildService();
    prisma.authSession.findUnique.mockResolvedValue({
      ...liveSession,
      revokedAt: new Date(NOW.getTime() - MINUTE_MS),
      replacedById: 'session-2',
    });
    prisma.authSession.updateMany.mockResolvedValue({ count: 2 });

    await expect(
      service.rotate(formatRefreshToken('session-1', secret), {}),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(prisma.authSession.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ familyId: 'family-1', revokedAt: null }),
        data: expect.objectContaining({ revokeReason: 'REFRESH_REUSE' }),
      }),
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'AUTH_SESSION_REFRESH_REUSE' }),
    );
  });

  it('fails closed and revokes the family when a concurrent refresh consumed the row', async () => {
    const { prisma, audit, service } = buildService();
    // Stale read: the row still looks live here, but a successor already points at it.
    prisma.authSession.findUnique.mockResolvedValue({
      ...liveSession,
      replacedById: 'session-2',
    });
    prisma.authSession.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.rotate(formatRefreshToken('session-1', secret), {}),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.authSession.create).not.toHaveBeenCalled();
    expect(prisma.authSession.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'session-1', revokedAt: null },
        data: expect.objectContaining({ revokedAt: expect.any(Date) }),
      }),
    );
    expect(prisma.authSession.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { familyId: 'family-1', revokedAt: null },
        data: expect.objectContaining({ revokeReason: 'REFRESH_REUSE' }),
      }),
    );
    expect(audit.record).toHaveBeenCalledTimes(1);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'AUTH_SESSION_REFRESH_REUSE' }),
    );
  });

  it('rejects a session revoked by logout without revoking the family or auditing reuse', async () => {
    const { prisma, audit, service } = buildService();
    prisma.authSession.findUnique.mockResolvedValue({
      ...liveSession,
      revokedAt: new Date(NOW.getTime() - MINUTE_MS),
      replacedById: null,
    });

    await expect(
      service.rotate(formatRefreshToken('session-1', secret), {}),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.authSession.updateMany).not.toHaveBeenCalled();
    expect(prisma.authSession.create).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('rejects a token whose secret does not match', async () => {
    const { prisma, audit, service } = buildService();
    prisma.authSession.findUnique.mockResolvedValue({
      ...liveSession,
      refreshTokenHash: hashRefreshSecret('right'),
    });

    await expect(
      service.rotate(formatRefreshToken('session-1', 'wrong'), {}),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.authSession.updateMany).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('rejects a malformed token before touching the database', async () => {
    const { prisma, service } = buildService();

    await expect(service.rotate('no-dot', {})).rejects.toBeInstanceOf(UnauthorizedException);

    expect(prisma.authSession.findUnique).not.toHaveBeenCalled();
  });

  const expiredWindows: Array<[string, Date, Date]> = [
    ['refresh window', new Date(NOW.getTime() - 1), new Date(NOW.getTime() + DAY_MS)],
    ['absolute window', new Date(NOW.getTime() + DAY_MS), new Date(NOW.getTime() - 1)],
  ];

  it.each(expiredWindows)(
    'revokes an expired session (%s) with no reason, no family revocation and no audit',
    async (_label, refreshExpiresAt, absoluteExpiresAt) => {
      const { prisma, audit, service } = buildService();
      prisma.authSession.findUnique.mockResolvedValue({
        ...liveSession,
        refreshExpiresAt,
        absoluteExpiresAt,
      });

      await expect(
        service.rotate(formatRefreshToken('session-1', secret), {}),
      ).rejects.toBeInstanceOf(UnauthorizedException);

      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.authSession.create).not.toHaveBeenCalled();
      expect(prisma.authSession.updateMany).toHaveBeenCalledTimes(1);
      expect(prisma.authSession.updateMany).toHaveBeenCalledWith({
        where: { id: 'session-1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
      expect(audit.record).not.toHaveBeenCalled();
    },
  );
});

describe('SessionService.findActive', () => {
  it('returns null when the session does not exist', async () => {
    const { prisma, service } = buildService();
    prisma.authSession.findUnique.mockResolvedValue(null);

    await expect(service.findActive('missing')).resolves.toBeNull();
  });

  it('returns null when the session is revoked', async () => {
    const { prisma, service } = buildService();
    prisma.authSession.findUnique.mockResolvedValue({
      id: 'session-1',
      revokedAt: new Date(NOW.getTime() - MINUTE_MS),
      absoluteExpiresAt: new Date(NOW.getTime() + DAY_MS),
    });

    await expect(service.findActive('session-1')).resolves.toBeNull();
  });

  it('returns null when the session is absolutely expired', async () => {
    const { prisma, service } = buildService();
    prisma.authSession.findUnique.mockResolvedValue({
      id: 'session-1',
      revokedAt: null,
      absoluteExpiresAt: new Date(NOW.getTime() - 1),
    });

    await expect(service.findActive('session-1')).resolves.toBeNull();
  });

  it('returns the session when it is live', async () => {
    const { prisma, service } = buildService();
    const live = {
      id: 'session-1',
      userId: 'user-1',
      revokedAt: null,
      absoluteExpiresAt: new Date(NOW.getTime() + DAY_MS),
    };
    prisma.authSession.findUnique.mockResolvedValue(live);

    await expect(service.findActive('session-1')).resolves.toEqual(live);
    expect(prisma.authSession.findUnique).toHaveBeenCalledWith({
      where: { id: 'session-1' },
      select: { id: true, userId: true, revokedAt: true, absoluteExpiresAt: true },
    });
  });
});
