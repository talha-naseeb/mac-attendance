import { loadEnvFile } from './utils/load-env';

loadEnvFile();

const testUrl = process.env.TEST_DATABASE_URL?.trim();
if (!testUrl) {
  throw new Error('TEST_DATABASE_URL is required for e2e tests.');
}
if (testUrl === process.env.DATABASE_URL?.trim()) {
  throw new Error('TEST_DATABASE_URL must not be the development database.');
}
process.env.DATABASE_URL = testUrl;
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET ||= 'test-only-jwt-secret-at-least-32-characters-long';
process.env.CORS_ORIGINS ||= 'http://localhost:5173';
