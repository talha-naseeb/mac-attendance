import { PrismaClient } from '@prisma/client';

const testDatabaseUrl = process.env.TEST_DATABASE_URL?.trim();
if (!testDatabaseUrl) {
  throw new Error(
    'TEST_DATABASE_URL is required before importing test-db; load test/setup-env.ts first.',
  );
}

export const testPrisma = new PrismaClient({
  datasources: { db: { url: testDatabaseUrl } },
});

export async function resetDatabase(): Promise<void> {
  const rows = await testPrisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
  `;
  if (rows.length === 0) return;
  const list = rows.map((row) => `"${row.tablename}"`).join(', ');
  await testPrisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`,
  );
}
