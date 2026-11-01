import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp } from './utils/test-app';
import { resetDatabase, testPrisma } from './utils/test-db';

describe('API smoke (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    await resetDatabase();
    app = await createTestApp();
  });

  afterAll(async () => {
    if (app) await app.close();
    await testPrisma.$disconnect();
  });

  it('serves the public roles catalogue under /api', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/auth/roles-info')
      .expect(200);
    expect(response.body.roles).toHaveLength(4);
  });
});
