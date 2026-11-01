import { execFileSync } from 'child_process';
import * as path from 'path';
import { resolveTestDatabaseUrl } from './utils/load-env';

export default async function globalSetup(): Promise<void> {
  const url = resolveTestDatabaseUrl();
  execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'inherit',
  });
}
