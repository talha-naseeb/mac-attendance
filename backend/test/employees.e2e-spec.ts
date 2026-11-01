import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './utils/test-app';
import { resetDatabase, testPrisma } from './utils/test-db';
import { createUser, TEST_PASSWORD } from './utils/fixtures';

describe('Employee administration (e2e)', () => {
  let app: INestApplication;
  let hrToken: string;

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase();
    await createUser(testPrisma, {
      email: 'hr@macqhr.sa',
      employeeId: 'EMP-HR',
      role: 'HR_ADMIN',
    });
    const login = await request(app.getHttpServer())
      .post('/api/auth/admin/login')
      .send({ email: 'hr@macqhr.sa', password: TEST_PASSWORD });
    hrToken = login.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
    await testPrisma.$disconnect();
  });

  it('pages, searches, and filters inactive employees for HR', async () => {
    await createUser(testPrisma, { email: 'a@macqhr.sa', employeeId: 'EMP-A' });
    await createUser(testPrisma, {
      email: 'b@macqhr.sa',
      employeeId: 'EMP-B',
      isActive: false,
    });

    const active = await request(app.getHttpServer())
      .get('/api/employees/admin?status=ACTIVE&pageSize=10')
      .set('Authorization', `Bearer ${hrToken}`)
      .expect(200);
    expect(active.body.total).toBe(2); // HR + EMP-A
    expect(active.body.items.every((item: any) => item.isActive)).toBe(true);

    const all = await request(app.getHttpServer())
      .get('/api/employees/admin?status=ALL&search=EMP-B')
      .set('Authorization', `Bearer ${hrToken}`)
      .expect(200);
    expect(all.body.items).toHaveLength(1);
    expect(all.body.items[0].employeeId).toBe('EMP-B');
  });

  it('AUTH-09: employees and managers cannot read the admin list', async () => {
    await createUser(testPrisma, { email: 'emp@macqhr.sa', employeeId: 'EMP-E' });
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'emp@macqhr.sa', password: TEST_PASSWORD });
    await request(app.getHttpServer())
      .get('/api/employees/admin')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .expect(403);
  });
});
