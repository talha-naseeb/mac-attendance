import * as path from 'path';
import * as dotenv from 'dotenv';

/**
 * Load `backend/.env` for local e2e runs. CI supplies the variables through the
 * job environment and has no `.env` file, so a missing file is not an error.
 * Values already present in the environment always win.
 */
export function loadEnvFile(): void {
  dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env') });
}

/**
 * Resolve the test database URL, failing closed before any database work.
 * Both the Jest workers and the global setup call this, so a test URL can never
 * reach `prisma migrate deploy` or a TRUNCATE without passing the same guard.
 */
export function resolveTestDatabaseUrl(): string {
  loadEnvFile();
  const testUrl = process.env.TEST_DATABASE_URL?.trim();
  if (!testUrl) {
    throw new Error('TEST_DATABASE_URL is required for e2e tests.');
  }
  if (testUrl === process.env.DATABASE_URL?.trim()) {
    throw new Error('TEST_DATABASE_URL must not be the development database.');
  }
  return testUrl;
}
