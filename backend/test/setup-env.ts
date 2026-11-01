import { resolveTestDatabaseUrl } from './utils/load-env';

const testUrl = resolveTestDatabaseUrl();
process.env.DATABASE_URL = testUrl;
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET ||= 'test-only-jwt-secret-at-least-32-characters-long';
process.env.CORS_ORIGINS ||= 'http://localhost:5173';
