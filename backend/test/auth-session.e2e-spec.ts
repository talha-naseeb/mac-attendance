import { INestApplication } from '@nestjs/common';
import request from 'supertest';
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

  it('parallel wrong passwords still lock the account', async () => {
    await createUser(testPrisma);
    const attempts = await Promise.all(
      Array.from({ length: 5 }, () =>
        request(app.getHttpServer())
          .post('/api/auth/login')
          .send({ email: 'test.employee@macqhr.sa', password: 'wrong-password' }),
      ),
    );
    for (const attempt of attempts) {
      expect(attempt.status).toBe(401);
    }
    const locked = await testPrisma.user.findFirstOrThrow();
    expect(locked.failedLoginAttempts).toBeGreaterThanOrEqual(5);
    expect(locked.lockedUntil).toBeTruthy();
  });

  it('change-password revokes every session and issues exactly one fresh session', async () => {
    const user = await createUser(testPrisma, { mustChangePassword: true });
    const first = await login().expect(201);
    const second = await login().expect(201);

    const changed = await request(app.getHttpServer())
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${first.body.accessToken}`)
      .send({ currentPassword: TEST_PASSWORD, newPassword: 'NewPassword456!' })
      .expect(201);
    expect(changed.body.refreshToken).toBeTruthy();

    const active = await testPrisma.authSession.findMany({ where: { revokedAt: null } });
    expect(active).toHaveLength(1);

    await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${first.body.accessToken}`)
      .expect(401);
    await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${second.body.accessToken}`)
      .expect(401);
    await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${changed.body.accessToken}`)
      .expect(200);

    const updated = await testPrisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(updated.mustChangePassword).toBe(false);
  });

  it('admin login rejects an employee without creating a session row', async () => {
    await createUser(testPrisma, { role: 'EMPLOYEE' });
    await request(app.getHttpServer())
      .post('/api/auth/admin/login')
      .send({ email: 'test.employee@macqhr.sa', password: TEST_PASSWORD })
      .expect(403);
    expect(await testPrisma.authSession.count()).toBe(0);
  });

  it('logout leaves other sessions for the same user alive', async () => {
    await createUser(testPrisma);
    const first = await login().expect(201);
    const second = await login().expect(201);

    await request(app.getHttpServer())
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${first.body.accessToken}`)
      .expect(201);

    await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${first.body.accessToken}`)
      .expect(401);
    await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${second.body.accessToken}`)
      .expect(200);
  });

  it('a successful login clears the failed-attempt counter', async () => {
    await createUser(testPrisma);
    for (let attempt = 0; attempt < 4; attempt += 1) {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'test.employee@macqhr.sa', password: 'wrong-password' })
        .expect(401);
    }
    const before = await testPrisma.user.findFirstOrThrow();
    expect(before.failedLoginAttempts).toBe(4);

    await login().expect(201);

    const after = await testPrisma.user.findFirstOrThrow();
    expect(after.failedLoginAttempts).toBe(0);
    expect(after.lockedUntil).toBeNull();
  });

  it('an inactive account with a wrong password gets the generic message', async () => {
    await createUser(testPrisma, { isActive: false });
    const wrong = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'test.employee@macqhr.sa', password: 'wrong-password' })
      .expect(401);
    expect(wrong.body.message).toBe('Invalid email or password.');

    const correct = await login().expect(401);
    expect(correct.body.message).toBe('This account has been deactivated. Please contact HR.');
  });

  it('AUTH-10: a forced password change blocks every other route', async () => {
    await createUser(testPrisma, { mustChangePassword: true });
    const session = await login().expect(201);
    expect(session.body.user.mustChangePassword).toBe(true);

    const blocked = await request(app.getHttpServer())
      .get('/api/directory')
      .set('Authorization', `Bearer ${session.body.accessToken}`)
      .expect(403);
    expect(blocked.body.code).toBe('PASSWORD_CHANGE_REQUIRED');

    const changed = await request(app.getHttpServer())
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${session.body.accessToken}`)
      .send({ currentPassword: TEST_PASSWORD, newPassword: 'NewPassword456!' })
      .expect(201);
    expect(changed.body.user.mustChangePassword).toBe(false);

    await request(app.getHttpServer())
      .get('/api/directory')
      .set('Authorization', `Bearer ${changed.body.accessToken}`)
      .expect(200);
  });
});
