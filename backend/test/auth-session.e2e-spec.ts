import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp } from './utils/test-app';
import { resetDatabase, testPrisma } from './utils/test-db';
import { createUser, TEST_PASSWORD } from './utils/fixtures';

describe('Auth sessions (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await app.close();
    await testPrisma.$disconnect();
  });

  function login(email = 'test.employee@macqhr.sa') {
    return request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password: TEST_PASSWORD });
  }

  it('AUTH-04: rotates the refresh token on every refresh', async () => {
    await createUser(testPrisma);
    const first = await login().expect(201);
    const second = await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .send({ refreshToken: first.body.refreshToken })
      .expect(201);

    expect(second.body.accessToken).toBeTruthy();
    expect(second.body.refreshToken).not.toBe(first.body.refreshToken);
  });

  it('AUTH-05: rejects a replayed refresh token and revokes the family', async () => {
    await createUser(testPrisma);
    const first = await login();
    await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .send({ refreshToken: first.body.refreshToken })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .send({ refreshToken: first.body.refreshToken })
      .expect(401);

    const active = await testPrisma.authSession.count({ where: { revokedAt: null } });
    expect(active).toBe(0);
  });

  it('AUTH-06: logout revokes the current session immediately', async () => {
    await createUser(testPrisma);
    const session = await login();
    await request(app.getHttpServer())
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${session.body.accessToken}`)
      .expect(201);

    await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${session.body.accessToken}`)
      .expect(401);
  });

  it('AUTH-03: deactivated accounts cannot sign in', async () => {
    await createUser(testPrisma, { isActive: false });
    await login().expect(401);
  });

  it('AUTH-02: locks the account after five failures with a generic message', async () => {
    await createUser(testPrisma);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'test.employee@macqhr.sa', password: 'wrong-password' });
      expect(response.status).toBe(401);
      expect(response.body.message).toBe('Invalid email or password.');
    }
    const locked = await testPrisma.user.findFirstOrThrow();
    expect(locked.lockedUntil).toBeTruthy();
    await login().expect(401);
  });
});
