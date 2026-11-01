import { UnauthorizedException } from '@nestjs/common';
import { SessionService } from './session.service';
import { formatRefreshToken, hashRefreshSecret } from './token.util';

function buildService() {
  const prisma = {
    authSession: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    user: { findUnique: jest.fn() },
  };
  const config = { get: jest.fn().mockReturnValue(undefined) };
  const audit = { record: jest.fn() };
  const service = new SessionService(prisma as any, config as any, audit as any);
  return { prisma, config, audit, service };
}

describe('SessionService.rotate', () => {
  it('revokes the whole family when a rotated token is replayed', async () => {
    const { prisma, service } = buildService();
    const secret = 'secret-value';
    prisma.authSession.findUnique.mockResolvedValue({
      id: 'session-1',
      userId: 'user-1',
      familyId: 'family-1',
      refreshTokenHash: hashRefreshSecret(secret),
      revokedAt: new Date(),
      replacedById: 'session-2',
      refreshExpiresAt: new Date(Date.now() + 60_000),
      absoluteExpiresAt: new Date(Date.now() + 60_000),
    });
    prisma.authSession.updateMany.mockResolvedValue({ count: 2 });

    await expect(
      service.rotate(formatRefreshToken('session-1', secret), {}),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.authSession.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ familyId: 'family-1', revokedAt: null }),
      }),
    );
  });

  it('rejects a token whose secret does not match', async () => {
    const { prisma, service } = buildService();
    prisma.authSession.findUnique.mockResolvedValue({
      id: 'session-1',
      userId: 'user-1',
      familyId: 'family-1',
      refreshTokenHash: hashRefreshSecret('right'),
      revokedAt: null,
      refreshExpiresAt: new Date(Date.now() + 60_000),
      absoluteExpiresAt: new Date(Date.now() + 60_000),
    });
    await expect(
      service.rotate(formatRefreshToken('session-1', 'wrong'), {}),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
