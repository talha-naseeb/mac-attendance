# Phase 7A — Identity, Session & Access Control (M2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the server the only authority over identity and sessions: short-lived access tokens with rotating refresh tokens, immediate revocation, forced password change, login throttling and lockout, hardened transport defaults, and a configuration-gated SSO endpoint with no dead-end UI.

**Architecture:** Access tokens are 15-minute JWTs carrying a `sid` claim. Every authenticated request resolves `sid` against an `AuthSession` row and re-hydrates role and `isActive` from the database. Refresh tokens are opaque `sessionId.secret` pairs whose secret is SHA-256 hashed at rest; rotating one revokes the old row and links it, and presenting an already-rotated token revokes the whole family. A global guard blocks every route except a decorated allowlist while `mustChangePassword` is true.

**Tech Stack:** NestJS 10, Prisma 5, PostgreSQL, `@nestjs/jwt`, `@nestjs/throttler` 5, `helmet`, Jest + Supertest (isolated database), Expo 57 (`expo-secure-store`), Vite + React 18 admin, Vitest.

**Spec:** [docs/prd/README.md](../../prd/README.md) module M2, [docs/prd/test-plan.md](../../prd/test-plan.md) AUTH-01…AUTH-10 and INT-01, [SPRINT_PLAN.md](../../../SPRINT_PLAN.md) Phase 7. Related design context: `docs/superpowers/specs/2026-11-01-location-attendance-design.md` §19 (Phase 7 must land throttling first).

## Decisions already taken

- **SSO (M2.7):** hide the UI, keep the verified server-side token exchange behind `SSO_ENABLED`. No PKCE flow in Phase 7. INT-01 "enabled" cannot be evidenced without an Entra test tenant and is recorded as a G2 limitation.
- **No new client simulation:** `authenticateWithMicrosoftSso`, demo role resolution and the fake `macqhr-jwt-*` tokens are deleted.
- **Existing sessions are invalidated on deploy** because pre-Phase-7 tokens have no `sid`. Acceptable pre-production; note it in the gate file.

## Global Constraints

- Every task ends with `npm run verify:all` green for the surfaces it touches, then its own commit.
- No push until a G2 gate file matches `HEAD` (RULES.md §0). Any later commit invalidates the gate.
- Access token lifetime 15 minutes; refresh token 7 days sliding; absolute session 30 days, except SUPER_ADMIN at 8 hours.
- Failed-login responses never reveal whether an email exists. All failures read `Invalid email or password.`
- Login lockout: 5 consecutive failures locks the account for 15 minutes; IP throttling is separate and returns 429.
- `JWT_SECRET` has no fallback in any environment. Production already fails fast in `configuration.ts`.
- Admin tokens live in `sessionStorage` only, never `localStorage`.
- Every auth mutation writes an `AuditLog` row: `AUTH_LOGIN_FAILED`, `AUTH_LOGIN_LOCKED`, `AUTH_SESSION_REFRESHED`, `AUTH_SESSION_REFRESH_REUSE`, `AUTH_LOGOUT`, `AUTH_PASSWORD_CHANGED`.
- Mobile and admin surfaces ship English/Arabic (RTL) and light/dark.
- `forbidNonWhitelisted: true` stays on; all new DTOs must declare every accepted field.
- Backend tests: Jest unit tests next to the code, plus Supertest e2e against `TEST_DATABASE_URL` only.

## File Structure

**Backend — create**
- `backend/src/bootstrap/configure-app.ts` — shared prefix, pipes, filters for `main.ts` and e2e.
- `backend/src/common/common.module.ts` — global module exporting `AuditService`.
- `backend/src/common/services/audit.service.ts` — single audit writer.
- `backend/src/common/guards/password-change.guard.ts`
- `backend/src/common/decorators/password-change-pending.decorator.ts`
- `backend/src/modules/auth/token.util.ts` + `token.util.spec.ts`
- `backend/src/modules/auth/session.service.ts` + `session.service.spec.ts`
- `backend/src/modules/auth/dto/change-password.dto.ts`
- `backend/src/modules/auth/dto/refresh.dto.ts`
- `backend/test/jest-e2e.json`, `global-setup.ts`, `setup-env.ts`
- `backend/test/utils/test-app.ts`, `backend/test/utils/test-db.ts`, `backend/test/utils/fixtures.ts`
- `backend/test/auth-session.e2e-spec.ts`

**Backend — modify**
- `backend/prisma/schema.prisma` — `AuthSession`, `SessionRevokeReason`, `User` columns.
- `backend/src/main.ts`, `backend/src/app.module.ts`, `backend/src/config/configuration.ts`
- `backend/src/modules/auth/auth.module.ts`, `auth.service.ts`, `auth.controller.ts`, `jwt.strategy.ts`
- `backend/src/common/decorators/current-user.decorator.ts`
- `backend/package.json`, `.github/workflows/verify.yml`, root `package.json`, `backend/.env.example`

**Mobile — create**
- `src/services/sessionManager.ts`
- `src/screens/ChangePasswordScreen.tsx`

**Mobile — modify**
- `src/services/authService.ts`, `authStorage.ts`, `backendApi.ts`, `App.tsx`, `src/screens/LoginScreen.tsx`, `src/__tests__/macqhr.test.ts`

**Admin — create**
- `web-admin/vitest.config.ts`, `web-admin/src/__tests__/adminSession.test.ts`
- `web-admin/src/api/adminSession.ts`

**Admin — modify**
- `web-admin/src/api/client.ts`, `web-admin/src/App.tsx`, `web-admin/package.json`, root `package.json`

---

### Task 1: Isolated-database e2e harness and shared app configuration

**Files:**
- Create: `backend/src/bootstrap/configure-app.ts`
- Create: `backend/test/jest-e2e.json`, `backend/test/global-setup.ts`, `backend/test/setup-env.ts`
- Create: `backend/test/utils/test-app.ts`, `backend/test/utils/test-db.ts`
- Create: `backend/test/auth-smoke.e2e-spec.ts`
- Modify: `backend/src/main.ts`, `backend/package.json`, root `package.json`, `.github/workflows/verify.yml`, `backend/.env.example`

**Interfaces:**
- Produces: `configureApp(app: INestApplication): void`
- Produces: `createTestApp(): Promise<INestApplication>`, `resetDatabase(): Promise<void>`, `testPrisma`
- Produces: `npm run test:e2e` in `backend/`, wired into root `verify:all`

- [ ] **Step 1: Extract the shared app configuration**

Create `backend/src/bootstrap/configure-app.ts`:

```ts
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { HttpExceptionFilter } from '../common/filters/http-exception.filter';

export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
}
```

Replace the prefix/pipe/filter block in `backend/src/main.ts` with:

```ts
import { NestExpressApplication } from '@nestjs/platform-express';
import { configureApp } from './bootstrap/configure-app';

const app = await NestFactory.create<NestExpressApplication>(AppModule);
const configService = app.get(ConfigService);
configureApp(app);
```

Delete the now-unused `ValidationPipe` and `HttpExceptionFilter` imports from `main.ts`. Keep CORS, Swagger, and `app.listen` in `main.ts` exactly as they are, after the `configureApp(app)` call. Keep the `NestExpressApplication` generic on `NestFactory.create`; Task 6 calls `app.useBodyParser` and `app.use` on it.

- [ ] **Step 2: Add the e2e Jest configuration**

Create `backend/test/jest-e2e.json`:

```json
{
  "moduleFileExtensions": ["js", "json", "ts"],
  "rootDir": "..",
  "testEnvironment": "node",
  "testRegex": "test/.*\\.e2e-spec\\.ts$",
  "transform": { "^.+\\.(t|j)s$": "ts-jest" },
  "globalSetup": "<rootDir>/test/global-setup.ts",
  "setupFiles": ["<rootDir>/test/setup-env.ts"],
  "testTimeout": 30000,
  "maxWorkers": 1
}
```

Create `backend/test/setup-env.ts`:

```ts
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
```

Create `backend/test/global-setup.ts`:

```ts
import { execFileSync } from 'child_process';
import path from 'path';

export default async function globalSetup(): Promise<void> {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error('TEST_DATABASE_URL is required for e2e tests.');
  execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'inherit',
  });
}
```

- [ ] **Step 3: Add the database and app helpers**

Create `backend/test/utils/test-db.ts`:

```ts
import { PrismaClient } from '@prisma/client';

export const testPrisma = new PrismaClient({
  datasources: { db: { url: process.env.TEST_DATABASE_URL! } },
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
```

Create `backend/test/utils/test-app.ts`:

```ts
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/bootstrap/configure-app';

export async function createTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();
  return app;
}
```

- [ ] **Step 4: Write the smoke test**

Create `backend/test/auth-smoke.e2e-spec.ts`:

```ts
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
    await app.close();
    await testPrisma.$disconnect();
  });

  it('serves the public roles catalogue under /api', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/auth/roles-info')
      .expect(200);
    expect(response.body.roles).toHaveLength(4);
  });
});
```

- [ ] **Step 5: Wire up scripts and CI**

In `backend/package.json` scripts add:

```json
"test:e2e": "jest --config ./test/jest-e2e.json --runInBand"
```

In root `package.json` replace `verify:all` with:

```json
"verify:all": "npm run verify && (cd backend && npm run typecheck && npm test && npm run build && npm run test:e2e) && (cd web-admin && npm run build)"
```

In `.github/workflows/verify.yml`, add a database service and a test database:

```yaml
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_USER: ci
          POSTGRES_PASSWORD: ci
          POSTGRES_DB: ci
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready --health-interval 10s --health-timeout 5s --health-retries 5
    env:
      DATABASE_URL: postgresql://ci:ci@localhost:5432/ci?schema=public
      TEST_DATABASE_URL: postgresql://ci:ci@localhost:5432/ci_test?schema=public
      JWT_SECRET: ci-only-jwt-secret-at-least-32-characters-long
```

Add a step before "Verify mobile, backend and admin":

```yaml
      - name: Create test database
        run: psql postgresql://ci:ci@localhost:5432/ci -c 'CREATE DATABASE ci_test'
```

Append to `backend/.env.example`:

```bash
# Isolated database for API end-to-end tests. Never point this at app data.
TEST_DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/macqhr_test?schema=public"
```

- [ ] **Step 6: Create the local test database and run the suite**

Run:

```bash
createdb -U postgres macqhr_test
cd backend && TEST_DATABASE_URL="postgresql://macqhr_user:secure_password@localhost:5432/macqhr_test?schema=public" npm run test:e2e
```

Expected: 1 suite, 1 test passing. If the role lacks CREATEDB, create the database as the `postgres` superuser and grant ownership to `macqhr_user`.

- [ ] **Step 7: Verify everything still builds**

Run: `npm run verify:all`
Expected: mobile typecheck/tests, backend typecheck/unit/build, e2e, and admin build all pass.

- [ ] **Step 8: Commit**

```bash
git add backend/src/bootstrap backend/test backend/src/main.ts backend/package.json backend/package-lock.json package.json .github/workflows/verify.yml backend/.env.example
git commit -m "test(api): add isolated-database e2e harness"
```

---

### Task 2: Auth schema, audit service, and shared types

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Create: `backend/src/common/services/audit.service.ts`, `backend/src/common/common.module.ts`
- Modify: `backend/src/app.module.ts`, `backend/src/common/decorators/current-user.decorator.ts`

**Interfaces:**
- Produces: Prisma model `AuthSession`, enum `SessionRevokeReason`
- Produces: `AuditService.record(input)` (consumed by every later task)
- Produces: `AuthenticatedUser` gains `sessionId?: string` and `mustChangePassword?: boolean`

- [ ] **Step 1: Add the schema**

In `backend/prisma/schema.prisma` add:

```prisma
enum SessionRevokeReason {
  LOGOUT
  PASSWORD_CHANGE
  ROLE_CHANGE
  DEACTIVATED
  REFRESH_REUSE
  ADMIN_REVOKE
}

model AuthSession {
  id                String              @id @default(uuid())
  userId            String
  user              User                @relation(fields: [userId], references: [id], onDelete: Cascade)

  familyId          String
  refreshTokenHash  String              @unique
  replacedById      String?             @unique
  replacedBy        AuthSession?        @relation("SessionRotation", fields: [replacedById], references: [id], onDelete: SetNull)
  replaces          AuthSession?        @relation("SessionRotation")

  absoluteExpiresAt DateTime
  refreshExpiresAt  DateTime
  revokedAt         DateTime?
  revokeReason      SessionRevokeReason?
  ipAddress         String?
  userAgent         String?
  lastUsedAt        DateTime            @default(now())

  createdAt         DateTime            @default(now())

  @@index([userId, revokedAt])
  @@index([familyId])
}
```

In `model User` add:

```prisma
  mustChangePassword  Boolean             @default(false)
  passwordChangedAt   DateTime?
  failedLoginAttempts Int                 @default(0)
  lockedUntil         DateTime?
  ssoSubject          String?             @unique
  sessions            AuthSession[]
```

- [ ] **Step 2: Generate the migration**

Run:

```bash
cd backend && npx prisma migrate dev --name phase7_auth_sessions && npx prisma generate
```

Expected: a new folder under `backend/prisma/migrations/` containing only additive `CREATE TYPE`, `CREATE TABLE`, `ALTER TABLE "User" ADD COLUMN` and index statements. No drops.

- [ ] **Step 3: Add the audit service**

Create `backend/src/common/services/audit.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

export interface AuditEntry {
  actorUserId?: string | null;
  action: string;
  resource: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
}

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async record(entry: AuditEntry): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        actorUserId: entry.actorUserId ?? null,
        action: entry.action,
        resource: entry.resource,
        detailsJson: (entry.details ?? {}) as object,
        ipAddress: entry.ipAddress,
      },
    });
  }
}
```

Create `backend/src/common/common.module.ts`:

```ts
import { Global, Module } from '@nestjs/common';
import { AuditService } from './services/audit.service';

@Global()
@Module({
  providers: [AuditService],
  exports: [AuditService],
})
export class CommonModule {}
```

Add `CommonModule` to the `imports` array in `backend/src/app.module.ts`.

- [ ] **Step 4: Extend the authenticated-user contract**

In `backend/src/common/decorators/current-user.decorator.ts`:

```ts
export interface AuthenticatedUser {
  id: string;
  employeeId: string;
  email: string;
  role: string;
  branchId?: string | null;
  department?: string | null;
  name: string;
  canAccessWebAdmin?: boolean;
  sessionId?: string;
  mustChangePassword?: boolean;
}
```

- [ ] **Step 5: Verify and commit**

Run: `cd backend && npm run typecheck && npm test && npm run build`
Expected: PASS.

```bash
git add backend/prisma backend/src/common backend/src/app.module.ts
git commit -m "feat(auth): add session schema and audit service"
```

---

### Task 3: Refresh-token session service

**Files:**
- Create: `backend/src/modules/auth/token.util.ts`, `token.util.spec.ts`
- Create: `backend/src/modules/auth/session.service.ts`, `session.service.spec.ts`
- Modify: `backend/src/modules/auth/auth.module.ts` (provide/export the service)

**Interfaces:**
- Produces: `generateRefreshSecret(): string`, `hashRefreshSecret(secret: string): string`, `refreshTokenMatches(secret, hash): boolean`, `formatRefreshToken(sessionId, secret): string`, `parseRefreshToken(token): { sessionId, secret } | null`
- Produces: `SessionService.createSession({ userId, role, ipAddress?, userAgent? })`, `.rotate(refreshToken, meta)`, `.revoke(sessionId, reason)`, `.revokeAllForUser(userId, reason)`, `.findActive(sessionId)`
- Consumes: `PrismaService`, `ConfigService`, `AuditService`

- [ ] **Step 1: Write failing token-utility tests**

Create `backend/src/modules/auth/token.util.spec.ts`:

```ts
import {
  formatRefreshToken,
  hashRefreshSecret,
  parseRefreshToken,
  refreshTokenMatches,
} from './token.util';

describe('token.util', () => {
  it('formats and parses a sessionId.secret pair', () => {
    const token = formatRefreshToken('session-1', 'abc123');
    expect(token).toBe('session-1.abc123');
    expect(parseRefreshToken(token)).toEqual({ sessionId: 'session-1', secret: 'abc123' });
  });

  it('rejects malformed tokens', () => {
    expect(parseRefreshToken('no-dot')).toBeNull();
    expect(parseRefreshToken('.missing')).toBeNull();
    expect(parseRefreshToken('missing.')).toBeNull();
  });

  it('hashes deterministically and compares in constant time', () => {
    const hash = hashRefreshSecret('super-secret');
    expect(refreshTokenMatches('super-secret', hash)).toBe(true);
    expect(refreshTokenMatches('other-secret', hash)).toBe(false);
  });
});
```

Run: `cd backend && npx jest token.util.spec.ts`
Expected: FAIL — module not found.

- [ ] **Step 2: Implement `token.util.ts`**

```ts
import { createHash, randomBytes, timingSafeEqual } from 'crypto';

export function generateRefreshSecret(): string {
  return randomBytes(32).toString('base64url');
}

export function hashRefreshSecret(secret: string): string {
  return createHash('sha256').update(secret).digest('hex');
}

export function refreshTokenMatches(secret: string, hash: string): boolean {
  const presented = Buffer.from(hashRefreshSecret(secret), 'hex');
  const stored = Buffer.from(hash, 'hex');
  return presented.length === stored.length && timingSafeEqual(presented, stored);
}

export function formatRefreshToken(sessionId: string, secret: string): string {
  return `${sessionId}.${secret}`;
}

export function parseRefreshToken(token: string): { sessionId: string; secret: string } | null {
  const separator = token.indexOf('.');
  if (separator <= 0 || separator === token.length - 1) return null;
  return { sessionId: token.slice(0, separator), secret: token.slice(separator + 1) };
}
```

Run the test again. Expected: PASS.

- [ ] **Step 3: Write failing rotation tests**

Create `backend/src/modules/auth/session.service.spec.ts` with a mocked Prisma:

```ts
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
```

Run: `npx jest session.service.spec.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement `session.service.ts`**

```ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../../common/services/audit.service';
import {
  formatRefreshToken,
  generateRefreshSecret,
  hashRefreshSecret,
  parseRefreshToken,
  refreshTokenMatches,
} from './token.util';

type RevokeReason =
  | 'LOGOUT'
  | 'PASSWORD_CHANGE'
  | 'ROLE_CHANGE'
  | 'DEACTIVATED'
  | 'REFRESH_REUSE'
  | 'ADMIN_REVOKE';

interface SessionMeta {
  ipAddress?: string;
  userAgent?: string;
}

interface IssuedSession {
  sessionId: string;
  refreshToken: string;
  refreshExpiresAt: Date;
  absoluteExpiresAt: Date;
}

@Injectable()
export class SessionService {
  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private audit: AuditService,
  ) {}

  private get refreshDays(): number {
    return this.configService.get<number>('auth.refreshTokenDays') ?? 7;
  }

  private absoluteExpiryFor(role: string): Date {
    const hours =
      role === 'SUPER_ADMIN'
        ? this.configService.get<number>('auth.superAdminAbsoluteSessionHours') ?? 8
        : this.configService.get<number>('auth.absoluteSessionHours') ?? 720;
    return new Date(Date.now() + hours * 60 * 60 * 1000);
  }

  async createSession(input: { userId: string; role: string } & SessionMeta): Promise<IssuedSession> {
    return this.issue({
      userId: input.userId,
      familyId: randomUUID(),
      absoluteExpiresAt: this.absoluteExpiryFor(input.role),
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });
  }

  private async issue(input: {
    userId: string;
    familyId: string;
    absoluteExpiresAt: Date;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<IssuedSession> {
    const secret = generateRefreshSecret();
    const refreshExpiresAt = new Date(Date.now() + this.refreshDays * 24 * 60 * 60 * 1000);
    const session = await this.prisma.authSession.create({
      data: {
        userId: input.userId,
        familyId: input.familyId,
        refreshTokenHash: hashRefreshSecret(secret),
        absoluteExpiresAt: input.absoluteExpiresAt,
        refreshExpiresAt,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      },
    });
    return {
      sessionId: session.id,
      refreshToken: formatRefreshToken(session.id, secret),
      refreshExpiresAt,
      absoluteExpiresAt: input.absoluteExpiresAt,
    };
  }

  async rotate(
    refreshToken: string,
    meta: SessionMeta,
  ): Promise<IssuedSession & { userId: string }> {
    const parsed = parseRefreshToken(refreshToken);
    if (!parsed) {
      throw new UnauthorizedException('Your session has ended. Sign in again.');
    }
    const current = await this.prisma.authSession.findUnique({
      where: { id: parsed.sessionId },
    });
    if (!current || !refreshTokenMatches(parsed.secret, current.refreshTokenHash)) {
      throw new UnauthorizedException('Your session has ended. Sign in again.');
    }
    if (current.revokedAt) {
      await this.revokeFamily(current.familyId, 'REFRESH_REUSE', current.userId);
      throw new UnauthorizedException('Your session has ended. Sign in again.');
    }
    if (
      current.refreshExpiresAt.getTime() <= Date.now() ||
      current.absoluteExpiresAt.getTime() <= Date.now()
    ) {
      await this.revoke(current.id, 'LOGOUT');
      throw new UnauthorizedException('Your session has ended. Sign in again.');
    }

    const next = await this.issue({
      userId: current.userId,
      familyId: current.familyId,
      absoluteExpiresAt: current.absoluteExpiresAt,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
    await this.prisma.authSession.update({
      where: { id: current.id },
      data: {
        revokedAt: new Date(),
        revokeReason: 'LOGOUT',
        replacedById: next.sessionId,
        lastUsedAt: new Date(),
      },
    });
    await this.audit.record({
      actorUserId: current.userId,
      action: 'AUTH_SESSION_REFRESHED',
      resource: 'AuthSession',
      details: { sessionId: next.sessionId, familyId: current.familyId },
      ipAddress: meta.ipAddress,
    });
    return { ...next, userId: current.userId };
  }

  async revoke(sessionId: string, reason: RevokeReason): Promise<void> {
    await this.prisma.authSession.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date(), revokeReason: reason },
    });
  }

  async revokeAllForUser(userId: string, reason: RevokeReason): Promise<void> {
    await this.prisma.authSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date(), revokeReason: reason },
    });
  }

  private async revokeFamily(
    familyId: string,
    reason: RevokeReason,
    actorUserId: string,
  ): Promise<void> {
    const result = await this.prisma.authSession.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date(), revokeReason: reason },
    });
    await this.audit.record({
      actorUserId,
      action: 'AUTH_SESSION_REFRESH_REUSE',
      resource: 'AuthSession',
      details: { familyId, revokedSessions: result.count },
    });
  }

  async findActive(sessionId: string) {
    const session = await this.prisma.authSession.findUnique({
      where: { id: sessionId },
      select: { id: true, revokedAt: true, absoluteExpiresAt: true },
    });
    if (!session || session.revokedAt || session.absoluteExpiresAt.getTime() <= Date.now()) {
      return null;
    }
    return session;
  }
}
```

Register in `auth.module.ts`: add `SessionService` to `providers` and `exports`. Import `CommonModule` is unnecessary because it is global.

- [ ] **Step 5: Run the tests**

Run: `cd backend && npx jest token.util.spec.ts session.service.spec.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/modules/auth/token.util.ts backend/src/modules/auth/token.util.spec.ts backend/src/modules/auth/session.service.ts backend/src/modules/auth/session.service.spec.ts backend/src/modules/auth/auth.module.ts
git commit -m "feat(auth): add rotating refresh-token sessions"
```

---

### Task 4: Login lockout, refresh, logout, and change-password endpoints

**Files:**
- Modify: `backend/src/config/configuration.ts`
- Create: `backend/src/modules/auth/dto/refresh.dto.ts`, `backend/src/modules/auth/dto/change-password.dto.ts`
- Create: `backend/src/common/decorators/password-change-pending.decorator.ts`
- Modify: `backend/src/modules/auth/auth.service.ts`, `auth.controller.ts`, `auth.module.ts`, `jwt.strategy.ts`, `backend/.env.example`
- Create: `backend/test/auth-session.e2e-spec.ts`, `backend/test/utils/fixtures.ts`

**Interfaces:**
- Consumes: `SessionService`, `AuditService`
- Produces: `POST /auth/refresh` → `{ accessToken, refreshToken, expiresIn, user }`
- Produces: `POST /auth/logout` → `{ message }`
- Produces: `POST /auth/change-password` → `{ accessToken, refreshToken, expiresIn, user }`
- Produces: `AuthService.login` adds `refreshToken`, `expiresIn`, `user.mustChangePassword`

- [ ] **Step 1: Add auth configuration**

In `backend/src/config/configuration.ts`, extend `AppConfig` and the returned object:

```ts
  auth: {
    accessTokenTtl: string;
    refreshTokenDays: number;
    absoluteSessionHours: number;
    superAdminAbsoluteSessionHours: number;
    maxFailedLogins: number;
    lockoutMinutes: number;
  };
  sso: {
    enabled: boolean;
  };
```

```ts
    auth: {
      accessTokenTtl: process.env.JWT_ACCESS_EXPIRATION || '15m',
      refreshTokenDays: parseInt(process.env.REFRESH_TOKEN_DAYS || '7', 10),
      absoluteSessionHours: parseInt(process.env.SESSION_ABSOLUTE_HOURS || '720', 10),
      superAdminAbsoluteSessionHours: parseInt(process.env.SUPER_ADMIN_SESSION_HOURS || '8', 10),
      maxFailedLogins: parseInt(process.env.MAX_FAILED_LOGINS || '5', 10),
      lockoutMinutes: parseInt(process.env.LOCKOUT_MINUTES || '15', 10),
    },
    sso: {
      enabled: process.env.SSO_ENABLED === 'true',
    },
```

In `auth.module.ts` change `signOptions.expiresIn` to `configService.get<string>('auth.accessTokenTtl') || '15m'` and change the secret line to:

```ts
secret: configService.getOrThrow<string>('jwt.secret'),
```

Append to `backend/.env.example`:

```bash
# Sessions
JWT_ACCESS_EXPIRATION=15m
REFRESH_TOKEN_DAYS=7
SESSION_ABSOLUTE_HOURS=720
SUPER_ADMIN_SESSION_HOURS=8
MAX_FAILED_LOGINS=5
LOCKOUT_MINUTES=15

# Microsoft Entra SSO stays disabled until a tenant is provisioned.
SSO_ENABLED=false
```

- [ ] **Step 2: Add DTOs**

`backend/src/modules/auth/dto/refresh.dto.ts`:

```ts
import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RefreshTokenDto {
  @ApiProperty({ description: 'The refresh token issued at sign-in or the last rotation' })
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}
```

`backend/src/modules/auth/dto/change-password.dto.ts`:

```ts
import { IsNotEmpty, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChangePasswordDto {
  @ApiProperty({ description: 'The current or temporary password' })
  @IsString()
  @IsNotEmpty()
  currentPassword: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  newPassword: string;
}
```

- [ ] **Step 3: Refactor `AuthService` around credentials and sessions**

Replace the body of `login` in `backend/src/modules/auth/auth.service.ts` with the following structure (keep the existing user response mapping in a private `toPublicUser(user)` method):

```ts
private readonly dummyHash = '$2a$10$CwTycUXWue0Thq9StjUM0uJ8ba0A5i8XGZof1N0PqQ7gKcpqBfG5S';

private async authenticateCredentials(email: string, password: string) {
  const user = await this.prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    include: {
      branch: true,
      manager: { select: { firstName: true, lastName: true } },
    },
  });

  if (!user) {
    await bcrypt.compare(password, this.dummyHash);
    throw new UnauthorizedException('Invalid email or password.');
  }

  if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
    throw new UnauthorizedException('Invalid email or password.');
  }

  if (!user.isActive) {
    throw new UnauthorizedException('This account has been deactivated. Please contact HR.');
  }

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) {
    const attempts = user.failedLoginAttempts + 1;
    const maxAttempts = this.configService.get<number>('auth.maxFailedLogins') ?? 5;
    const lockoutMinutes = this.configService.get<number>('auth.lockoutMinutes') ?? 15;
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: attempts,
        lockedUntil:
          attempts >= maxAttempts
            ? new Date(Date.now() + lockoutMinutes * 60 * 1000)
            : null,
      },
    });
    await this.audit.record({
      actorUserId: user.id,
      action: attempts >= maxAttempts ? 'AUTH_LOGIN_LOCKED' : 'AUTH_LOGIN_FAILED',
      resource: 'User',
      details: { attempts },
    });
    throw new UnauthorizedException('Invalid email or password.');
  }

  if (user.failedLoginAttempts > 0 || user.lockedUntil) {
    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });
  }

  return user;
}

private signAccessToken(
  user: { id: string; employeeId: string; email: string; role: string; branchId: string | null; firstName: string; lastName: string; canAccessWebAdmin: boolean },
  sessionId: string,
): string {
  return this.jwtService.sign({
    sub: user.id,
    employeeId: user.employeeId,
    email: user.email,
    role: user.role,
    branchId: user.branchId,
    name: `${user.firstName} ${user.lastName}`,
    canAccessWebAdmin: user.canAccessWebAdmin,
    sid: sessionId,
  });
}

private async establishSession(user: any, meta: { ipAddress?: string; userAgent?: string }) {
  const issued = await this.sessionService.createSession({
    userId: user.id,
    role: user.role,
    ...meta,
  });
  return {
    accessToken: this.signAccessToken(user, issued.sessionId),
    refreshToken: issued.refreshToken,
    expiresIn: this.configService.get<string>('auth.accessTokenTtl') || '15m',
  };
}

async login(loginDto: LoginDto, meta: { ipAddress?: string; userAgent?: string } = {}) {
  const user = await this.authenticateCredentials(loginDto.email, loginDto.password);
  const tokens = await this.establishSession(user, meta);
  return {
    ...tokens,
    user: this.toPublicUser(user),
  };
}
```

Add `adminLogin` so the role check happens before a session is created:

```ts
async adminLogin(loginDto: LoginDto, meta: { ipAddress?: string; userAgent?: string } = {}) {
  const user = await this.authenticateCredentials(loginDto.email, loginDto.password);
  if (
    !user.canAccessWebAdmin ||
    (user.role !== 'HR_ADMIN' && user.role !== 'SUPER_ADMIN')
  ) {
    throw new ForbiddenException(
      'This account is not authorized to access the MacqHR administration console.',
    );
  }
  const tokens = await this.establishSession(user, meta);
  return { ...tokens, user: this.toPublicUser(user) };
}
```

Replace `ssoLogin` with this version. It keeps the existing Entra verification and user lookup verbatim, rejects immediately when the deployment flag is off, and issues the same rotating session as password login:

```ts
async ssoLogin(ssoDto: SsoLoginDto, meta: { ipAddress?: string; userAgent?: string } = {}) {
  if (!this.configService.get<boolean>('sso.enabled')) {
    throw new NotFoundException('Microsoft Entra SSO is not enabled for this deployment.');
  }

  const claims = await this.verifyEntraIdToken(ssoDto.ssoToken);
  const emailClaim = claims.preferred_username ?? claims.email ?? claims.upn;
  if (typeof emailClaim !== 'string' || !emailClaim.includes('@')) {
    throw new UnauthorizedException('Verified Entra token has no usable email claim.');
  }
  const email = emailClaim.toLowerCase();

  if (email !== ssoDto.email.trim().toLowerCase()) {
    throw new UnauthorizedException('SSO email does not match the verified Entra ID principal.');
  }

  const user = await this.prisma.user.findUnique({
    where: { email },
    include: {
      branch: true,
      manager: { select: { firstName: true, lastName: true } },
    },
  });

  if (!user) {
    throw new UnauthorizedException(
      `User ${email} does not exist in corporate directory. SSO sync required.`,
    );
  }
  if (!user.isActive) {
    throw new UnauthorizedException('Account has been disabled.');
  }
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    throw new UnauthorizedException('Invalid email or password.');
  }

  await this.prisma.user.update({
    where: { id: user.id },
    data: { ssoSubject: claims.sub ? String(claims.sub) : null },
  });

  const tokens = await this.establishSession(user, meta);
  return { ...tokens, user: this.toPublicUser(user) };
}
```

`verifyEntraIdToken` and `getEntraSigningKeys` are unchanged and stay private helpers on the service.

Add:

```ts
async refresh(refreshToken: string, meta: { ipAddress?: string; userAgent?: string }) {
  const rotated = await this.sessionService.rotate(refreshToken, meta);
  const user = await this.prisma.user.findUnique({
    where: { id: rotated.userId },
    include: { branch: true, manager: { select: { firstName: true, lastName: true } } },
  });
  if (!user || !user.isActive) {
    await this.sessionService.revoke(rotated.sessionId, 'DEACTIVATED');
    throw new UnauthorizedException('Your session has ended. Sign in again.');
  }
  return {
    accessToken: this.signAccessToken(user, rotated.sessionId),
    refreshToken: rotated.refreshToken,
    expiresIn: this.configService.get<string>('auth.accessTokenTtl') || '15m',
    user: this.toPublicUser(user),
  };
}

async logout(sessionId: string): Promise<void> {
  await this.sessionService.revoke(sessionId, 'LOGOUT');
  await this.audit.record({
    action: 'AUTH_LOGOUT',
    resource: 'AuthSession',
    details: { sessionId },
  });
}

async changePassword(
  userId: string,
  sessionId: string,
  dto: ChangePasswordDto,
  meta: { ipAddress?: string; userAgent?: string },
) {
  const user = await this.prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new UnauthorizedException('User profile not found.');
  const matches = await bcrypt.compare(dto.currentPassword, user.passwordHash);
  if (!matches) throw new UnauthorizedException('The current password is incorrect.');
  if (dto.currentPassword === dto.newPassword) {
    throw new BadRequestException('Choose a password you have not used as your current password.');
  }
  const passwordHash = await bcrypt.hash(dto.newPassword, 10);
  await this.prisma.user.update({
    where: { id: userId },
    data: {
      passwordHash,
      mustChangePassword: false,
      passwordChangedAt: new Date(),
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
  });
  await this.sessionService.revokeAllForUser(userId, 'PASSWORD_CHANGE');
  await this.audit.record({
    actorUserId: userId,
    action: 'AUTH_PASSWORD_CHANGED',
    resource: 'User',
    details: { sessionId },
    ipAddress: meta.ipAddress,
  });
  const refreshed = await this.prisma.user.findUnique({
    where: { id: userId },
    include: { branch: true, manager: { select: { firstName: true, lastName: true } } },
  });
  const tokens = await this.establishSession(refreshed, meta);
  return { ...tokens, user: this.toPublicUser(refreshed!) };
}
```

Add `toPublicUser(user)` containing the exact user object currently returned by `login` (id, employeeId, names, contact, role, department, jobTitle, Arabic fields, national ids, avatar fields, createdAt, isRemoteAllowed, manager, avatarUrl, canAccessWebAdmin, branch, plus `mustChangePassword: user.mustChangePassword`).

Inject `SessionService` and `AuditService` in the constructor. Import `NotFoundException`, `BadRequestException`.

- [ ] **Step 4: Add controller routes**

In `auth.controller.ts` add the `@Req()` request for metadata and these routes:

```ts
@Public()
@Post('refresh')
async refresh(@Body() dto: RefreshTokenDto, @Req() req: Request) {
  return this.authService.refresh(dto.refreshToken, {
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });
}

@Post('logout')
@PasswordChangePending()
async logout(@CurrentUser() user: AuthenticatedUser) {
  await this.authService.logout(user.sessionId!);
  return { message: 'Signed out.' };
}

@Post('change-password')
@PasswordChangePending()
async changePassword(
  @CurrentUser() user: AuthenticatedUser,
  @Body() dto: ChangePasswordDto,
  @Req() req: Request,
) {
  return this.authService.changePassword(user.id, user.sessionId!, dto, {
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });
}

@Get('me')
@PasswordChangePending()
async getMe(@CurrentUser() user: AuthenticatedUser) {
  return this.authService.getProfile(user.id);
}
```

Pass `{ ipAddress: req.ip, userAgent: req.headers['user-agent'] }` from `login` and `adminLogin` too.

Create `backend/src/common/decorators/password-change-pending.decorator.ts` now so the controller compiles:

```ts
import { SetMetadata } from '@nestjs/common';

export const PASSWORD_CHANGE_PENDING_KEY = 'passwordChangePending';
export const PasswordChangePending = () =>
  SetMetadata(PASSWORD_CHANGE_PENDING_KEY, true);
```

Import it from `../../common/decorators/password-change-pending.decorator`. The guard that enforces this metadata is Task 5.

- [ ] **Step 5: Make JWT validation session-aware**

In `backend/src/modules/auth/jwt.strategy.ts` extend the payload and inject `SessionService` after `prisma`:

```ts
export interface JwtPayload {
  sub: string;
  employeeId: string;
  email: string;
  role: string;
  branchId?: string | null;
  name: string;
  canAccessWebAdmin?: boolean;
  sid?: string;
}
```

Replace `validate` with:

```ts
async validate(payload: JwtPayload) {
  if (!payload.sub || !payload.email || !payload.sid) {
    throw new UnauthorizedException('Invalid JWT payload claims.');
  }

  const session = await this.sessionService.findActive(payload.sid);
  if (!session) {
    throw new UnauthorizedException('Your session has ended. Sign in again.');
  }

  const user = await this.prisma.user.findUnique({
    where: { id: payload.sub },
    select: {
      id: true,
      employeeId: true,
      email: true,
      role: true,
      branchId: true,
      firstName: true,
      lastName: true,
      canAccessWebAdmin: true,
      isActive: true,
      mustChangePassword: true,
    },
  });
  if (!user || !user.isActive) {
    throw new UnauthorizedException('Your account is inactive or no longer exists.');
  }

  return {
    id: user.id,
    employeeId: user.employeeId,
    email: user.email,
    role: user.role,
    branchId: user.branchId,
    name: `${user.firstName} ${user.lastName}`,
    canAccessWebAdmin: user.canAccessWebAdmin,
    sessionId: session.id,
    mustChangePassword: user.mustChangePassword,
  };
}
```

Import `SessionService` from `./session.service`.

This step belongs here, not in Task 5: `logout` and `change-password` read `user.sessionId`, which only this strategy supplies — without it they would call `revoke(undefined)` and AUTH-06 could not pass. Task 5 then adds only the forced-password-change guard.

- [ ] **Step 6: Write the session e2e tests**

Create `backend/test/utils/fixtures.ts`:

```ts
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

export const TEST_PASSWORD = 'Password123!';

export async function createBranch(prisma: PrismaClient, name = 'Riyadh HQ') {
  return prisma.branch.upsert({
    where: { name },
    update: {},
    create: {
      name,
      nameAr: name,
      city: 'Riyadh',
      cityAr: 'الرياض',
      latitude: 24.7136,
      longitude: 46.6753,
    },
  });
}

export async function createUser(
  prisma: PrismaClient,
  overrides: Partial<{
    email: string;
    employeeId: string;
    role: 'EMPLOYEE' | 'MANAGER' | 'HR_ADMIN' | 'SUPER_ADMIN';
    isActive: boolean;
    mustChangePassword: boolean;
    branchId: string | null;
    managerId: string | null;
  }> = {},
) {
  const branch = overrides.branchId === undefined ? await createBranch(prisma) : null;
  return prisma.user.create({
    data: {
      employeeId: overrides.employeeId ?? 'EMP-T01',
      email: overrides.email ?? 'test.employee@macqhr.sa',
      passwordHash: await bcrypt.hash(TEST_PASSWORD, 10),
      role: overrides.role ?? 'EMPLOYEE',
      firstName: 'Test',
      lastName: 'Employee',
      fullName: 'Test Employee',
      fullNameAr: 'موظف اختبار',
      jobTitle: 'Engineer',
      department: 'Engineering',
      isSaudi: true,
      basicSalarySar: 10000,
      branchId: overrides.branchId === undefined ? branch!.id : overrides.branchId,
      managerId: overrides.managerId ?? null,
      isActive: overrides.isActive ?? true,
      mustChangePassword: overrides.mustChangePassword ?? false,
      canAccessWebAdmin:
        overrides.role === 'HR_ADMIN' || overrides.role === 'SUPER_ADMIN',
    },
  });
}
```

Create `backend/test/auth-session.e2e-spec.ts`:

```ts
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

  async function login(email = 'test.employee@macqhr.sa') {
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
```

- [ ] **Step 7: Run the e2e suite**

Run: `cd backend && npm run test:e2e`
Expected: all auth-session cases pass. `AUTH-06` passes because Step 5 makes `/auth/me` reject a revoked session. `AUTH-10` is added and run in Task 5, after the guard exists, so this commit stays green.

- [ ] **Step 8: Commit**

```bash
git add backend/src/config/configuration.ts backend/src/modules/auth backend/src/common/decorators/password-change-pending.decorator.ts backend/test backend/.env.example
git commit -m "feat(auth): issue rotating sessions with lockout and password change"
```

---

### Task 5: The forced-password-change guard

**Files:**
- Create: `backend/src/common/guards/password-change.guard.ts`
- Modify: `backend/src/app.module.ts`
- Modify: `backend/test/auth-session.e2e-spec.ts` (adds the AUTH-10 case)

**Interfaces:**
- Consumes: `AuthenticatedUser` (session-aware strategy from Task 4), `PASSWORD_CHANGE_PENDING_KEY` from Task 4
- Produces: `PasswordChangeGuard` registered globally after `JwtAuthGuard`, so every route rejects a pending password change

- [ ] **Step 1: Add the guard**

The decorator already exists from Task 4. Create `backend/src/common/guards/password-change.guard.ts`:

```ts
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PASSWORD_CHANGE_PENDING_KEY } from '../decorators/password-change-pending.decorator';
import { AuthenticatedUser } from '../decorators/current-user.decorator';

@Injectable()
export class PasswordChangeGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser | undefined;
    if (!user?.mustChangePassword) return true;

    const allowed = this.reflector.getAllAndOverride<boolean>(
      PASSWORD_CHANGE_PENDING_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (allowed) return true;

    throw new ForbiddenException({
      statusCode: 403,
      error: 'Password Change Required',
      message: 'You must change your temporary password before continuing.',
      code: 'PASSWORD_CHANGE_REQUIRED',
    });
  }
}
```

- [ ] **Step 2: Register the guard in order**

In `backend/src/app.module.ts` providers:

```ts
providers: [
  { provide: APP_GUARD, useClass: JwtAuthGuard },
  { provide: APP_GUARD, useClass: PasswordChangeGuard },
],
```

Do not reference `ThrottlerGuard` yet — Task 6 inserts it as the first entry together with `ThrottlerModule`.

- [ ] **Step 3: Add the AUTH-10 e2e case**

Append inside the existing `describe` in `backend/test/auth-session.e2e-spec.ts`, before the closing `});`:

```ts
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
```

- [ ] **Step 4: Run the e2e suite**

Run: `cd backend && npm run test:e2e`
Expected: all auth-session tests pass, including the AUTH-10 guard case.

- [ ] **Step 5: Commit**

```bash
git add backend/src/common/guards/password-change.guard.ts backend/src/app.module.ts backend/test/auth-session.e2e-spec.ts
git commit -m "feat(auth): enforce session validation and forced password change"
```

---

### Task 6: Rate limiting, security headers, body limits, and the SSO flag

**Files:**
- Modify: `backend/package.json`, `backend/src/app.module.ts`, `backend/src/main.ts`, `backend/src/modules/auth/auth.controller.ts`
- Modify: `backend/test/setup-env.ts`, `backend/src/config/configuration.spec.ts` (SSO flag)
- Create: `backend/test/rate-limit.e2e-spec.ts`

**Interfaces:**
- Consumes: `auth.*` config, `sso.enabled`
- Produces: 429 on the sixth login attempt within a minute from one IP
- Produces: `helmet` headers and a 100 kB JSON limit

- [ ] **Step 1: Install dependencies**

Run:

```bash
cd backend && npm install @nestjs/throttler@^5.1.2 helmet@^8.0.0
```

- [ ] **Step 2: Enable the throttler**

In `app.module.ts`:

```ts
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

ThrottlerModule.forRoot({
  throttlers: [{ name: 'default', ttl: 60_000, limit: 120 }],
  skipIf: () => process.env.THROTTLE_DISABLED === 'true',
}),
```

Add `ThrottlerGuard` to providers first (as shown in Task 5). In `auth.controller.ts`, decorate the three sign-in routes:

```ts
@Throttle({ default: { limit: 5, ttl: 60_000 } })
```

on `login`, `adminLogin`, and `ssoLogin`; decorate `refresh` with `@Throttle({ default: { limit: 30, ttl: 60_000 } })`.

In `backend/test/setup-env.ts`, disable throttling for the shared suites so many sign-ins across cases never collide:

```ts
process.env.THROTTLE_DISABLED = 'true';
```

The dedicated rate-limit suite (Step 4) resets the flag before it boots, because Jest gives each test file its own module registry and re-runs `setupFiles` per file.

- [ ] **Step 3: Harden bootstrap**

In `backend/src/main.ts` after creating the app:

```ts
app.useBodyParser('json', { limit: '100kb' });
app.useBodyParser('urlencoded', { limit: '100kb', extended: true });
app.use(helmet());
```

Add `esModuleInterop: true` to `backend/tsconfig.json` so `import helmet from 'helmet'` compiles to the correct CommonJS form, then import it at the top.

- [ ] **Step 4: Add the throttle test**

The shared suites run with throttling disabled, so the 429 proof gets its own file with its own app instance. Create `backend/test/rate-limit.e2e-spec.ts`:

```ts
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp } from './utils/test-app';
import { resetDatabase, testPrisma } from './utils/test-db';
import { createUser } from './utils/fixtures';

describe('Sign-in rate limiting (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.THROTTLE_DISABLED = 'false';
    await resetDatabase();
    await createUser(testPrisma);
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
    await testPrisma.$disconnect();
  });

  it('returns 429 on the sixth sign-in attempt within a minute', async () => {
    const statuses: number[] = [];
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'test.employee@macqhr.sa', password: 'wrong-password' });
      statuses.push(response.status);
    }
    expect(statuses.slice(0, 5)).toEqual([401, 401, 401, 401, 401]);
    expect(statuses[5]).toBe(429);
  });
});
```

`skipIf` is evaluated per request, so flipping the flag in `beforeAll` is enough; the throttler module can be imported normally.

Throttling is per-process memory by default; `maxWorkers: 1` keeps it deterministic.

- [ ] **Step 5: Verify**

Run:

```bash
cd backend && npm run typecheck && npm test && npm run build && npm run test:e2e
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/package.json backend/package-lock.json backend/src/app.module.ts backend/src/main.ts backend/src/modules/auth/auth.controller.ts backend/test backend/tsconfig.json
git commit -m "feat(api): throttle sign-in and harden transport defaults"
```

---

### Task 7: Mobile session refresh, forced password change, and SSO removal

**Files:**
- Create: `src/services/sessionManager.ts`, `src/screens/ChangePasswordScreen.tsx`
- Modify: `src/services/authService.ts`, `src/services/authStorage.ts`, `src/services/backendApi.ts`, `src/screens/LoginScreen.tsx`, `App.tsx`, `src/__tests__/macqhr.test.ts`

**Interfaces:**
- Produces: `isTokenExpiringSoon(token, skewSeconds = 60): boolean`
- Produces: `refreshStoredSession(): Promise<AuthSession | null>`
- Produces: `signOutStoredSession(): Promise<void>`
- Produces: `AuthSession` gains `refreshToken?: string` and `mustChangePassword?: boolean`
- Consumes: `POST /auth/refresh`, `POST /auth/logout`, `POST /auth/change-password`

- [ ] **Step 1: Replace the demo auth tests with real helpers**

In `src/__tests__/macqhr.test.ts`, delete the three `TC-10.1`–`TC-10.3` cases and replace the imports of `authenticateWithMicrosoftSso` / `validateAndAuthenticate` with:

```ts
import { isTokenExpiringSoon, shouldRefreshToken } from '../services/sessionManager';
import { ChangePasswordScreen } from '../screens/ChangePasswordScreen';
```

Add:

```ts
itCase('TC-10.1: Detects access tokens that are about to expire', () => {
  const now = Math.floor(Date.now() / 1000);
  const makeToken = (exp: number) =>
    `header.${Buffer.from(JSON.stringify({ exp })).toString('base64url')}.sig`;
  assertEqual(isTokenExpiringSoon(makeToken(now + 30)), true);
  assertEqual(isTokenExpiringSoon(makeToken(now + 600)), false);
  assertEqual(isTokenExpiringSoon('not-a-jwt'), true);
  assertEqual(shouldRefreshToken('not-a-jwt'), true);
});

itCase('TC-10.2: Exposes the forced password change screen', () => {
  assertTrue(typeof ChangePasswordScreen === 'function');
});
```

Note: `Buffer` is unavailable in React Native. Implement `isTokenExpiringSoon` with a base64 decode that works in both environments — see Step 2 — and update the test to use that decode path rather than `Buffer`:

```ts
const makeToken = (exp: number) =>
  `header.${globalThis.btoa(JSON.stringify({ exp }))}.sig`;
```

- [ ] **Step 2: Create the session manager**

`src/services/sessionManager.ts`:

```ts
import {
  clearStoredAuthSession,
  loadStoredAuthSession,
  saveAuthSession,
} from './authStorage';
import type { AuthSession } from './authService';

const EXPIRY_SKEW_SECONDS = 60;

export function decodeTokenExpiry(token: string): number | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const encoded = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const decoded =
      typeof globalThis.atob === 'function'
        ? globalThis.atob(encoded.padEnd(Math.ceil(encoded.length / 4) * 4, '='))
        : Buffer.from(encoded, 'base64').toString('utf8');
    const claims = JSON.parse(decoded) as { exp?: unknown };
    return typeof claims.exp === 'number' ? claims.exp : null;
  } catch {
    return null;
  }
}

export function isTokenExpiringSoon(
  token: string,
  skewSeconds = EXPIRY_SKEW_SECONDS,
): boolean {
  const expiry = decodeTokenExpiry(token);
  if (expiry === null) return true;
  return expiry - Math.floor(Date.now() / 1000) <= skewSeconds;
}

export function shouldRefreshToken(token: string): boolean {
  return isTokenExpiringSoon(token);
}

let refreshInFlight: Promise<AuthSession | null> | null = null;

export async function refreshStoredSession(): Promise<AuthSession | null> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    const stored = await loadStoredAuthSession();
    if (!stored?.refreshToken) return null;
    try {
      const response = await fetch(`${getApiBaseUrl()}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ refreshToken: stored.refreshToken }),
      });
      if (!response.ok) {
        await clearStoredAuthSession();
        return null;
      }
      const body = (await response.json()) as {
        accessToken: string;
        refreshToken: string;
        user: { mustChangePassword?: boolean };
      };
      const next: AuthSession = {
        ...stored,
        token: body.accessToken,
        refreshToken: body.refreshToken,
        mustChangePassword: Boolean(body.user?.mustChangePassword),
      };
      await saveAuthSession(next);
      return next;
    } catch {
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

export async function signOutStoredSession(): Promise<void> {
  const stored = await loadStoredAuthSession();
  if (stored?.token) {
    try {
      await fetch(`${getApiBaseUrl()}/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${stored.token}` },
      });
    } catch {
      // Local sign-out must succeed even when the API is unreachable.
    }
  }
  await clearStoredAuthSession();
}

function getApiBaseUrl(): string {
  return process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:4000/api';
}
```

Do not import `API_BASE_URL` from `backendApi.ts` here: `backendApi.ts` imports `refreshStoredSession` from this file, and a two-way import cycle breaks module evaluation order in Metro.

- [ ] **Step 3: Extend the mobile session shape**

In `src/services/authService.ts`:

```ts
export interface AuthSession {
  token: string;
  refreshToken?: string;
  role: UserRole;
  profile: EditableEmployeeProfile;
  authenticatedAt: number;
  authMethod: 'PASSWORD';
  branchId?: string;
  isRemoteAllowed: boolean;
  mustChangePassword?: boolean;
}
```

Delete `authenticateWithMicrosoftSso`, `resolveRoleFromEmail`, and the token/session creation inside `validateAndAuthenticate`. Reduce it to:

```ts
export interface CredentialValidation {
  valid: boolean;
  error?: 'EMPTY_EMAIL' | 'INVALID_EMAIL' | 'SHORT_PASSWORD';
}

export function validateCredentials(credentials: AuthCredentials): CredentialValidation {
  const trimmedEmail = (credentials.email || '').trim().toLowerCase();
  const password = credentials.password || '';
  if (!trimmedEmail) return { valid: false, error: 'EMPTY_EMAIL' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
    return { valid: false, error: 'INVALID_EMAIL' };
  }
  if (password.length > 0 && password.length < 6) {
    return { valid: false, error: 'SHORT_PASSWORD' };
  }
  return { valid: true };
}
```

`authenticateWithPasswordApi` uses `validateCredentials` and maps `mustChangePassword` and `refreshToken` from the backend response.

- [ ] **Step 4: Add refresh retry and logout to the API client**

In `src/services/backendApi.ts`:

Replace `request` with this version. It keeps the existing fetch, header, and error behaviour, and adds a single retry after a successful silent refresh:

```ts
async function request<T>(
  path: string,
  options: RequestInit = {},
  token?: string,
): Promise<T> {
  const send = async (bearer?: string): Promise<Response> => {
    try {
      return await fetch(`${API_BASE_URL}${path}`, {
        ...options,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
          ...options.headers,
        },
      });
    } catch {
      throw new BackendApiError(
        'Unable to reach the MacqHR server. Check your API address and connection.',
      );
    }
  };

  let response = await send(token);

  if (response.status === 401 && token && path !== '/auth/refresh') {
    const refreshed = await refreshStoredSession();
    if (refreshed?.token) {
      response = await send(refreshed.token);
    }
  }

  const body = (await response.json().catch(() => null)) as {
    message?: string | string[];
  } | null;
  if (!response.ok) {
    const message = Array.isArray(body?.message)
      ? body.message.join(', ')
      : body?.message || 'The server could not complete this request.';
    throw new BackendApiError(message);
  }
  return body as T;
}
```

Import `refreshStoredSession` from `./sessionManager`. The retry runs at most once because it only fires when a `token` was supplied and the second `send` result is never re-checked for 401.

`sessionManager.ts` must not import from `backendApi.ts`; it reads the same `EXPO_PUBLIC_API_BASE_URL` itself. Importing `API_BASE_URL` back from `backendApi` would create a module cycle between the two files.

Also export:

```ts
export async function changePassword(
  currentPassword: string,
  newPassword: string,
  token: string,
): Promise<{ accessToken: string; refreshToken: string; user: BackendUser }> {
  return request('/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword }),
  }, token);
}
```

Add `refreshToken` and `mustChangePassword` to `BackendLoginResponse`, and map them in `authenticateWithBackend`.

- [ ] **Step 5: Add the forced-change screen and gate the app**

Create `src/screens/ChangePasswordScreen.tsx` using the existing theme tokens and `rtlRow` pattern from `ClockInScreen`:

- two secure inputs (current/temporary password, new password),
- client checks: at least 8 characters; different values,
- submit calls `changePassword`, saves the returned session via `saveAuthSession`, and invokes `onChanged(session)`,
- error banner reuse: `colors.danger` background tint and the existing message style,
- English/Arabic strings and light/dark via `useColorScheme`/theme tokens already used by other screens.

In `App.tsx`, when `session.mustChangePassword` is true render `ChangePasswordScreen` instead of the shell. Replace the local logout path with `signOutStoredSession()` before clearing state, and keep the existing no-auto-navigation rule: the user taps sign-out.

- [ ] **Step 6: Remove the SSO button**

In `LoginScreen.tsx`, delete the `isMicrosoftSsoConfigured` block, the "or continue with" divider, and the button whose only action is an error message. Remove the now-unused config lookups. The login form remains email/password only.

- [ ] **Step 7: Verify**

Run: `npm run verify`
Expected: typecheck passes and all mobile tests pass, including the rewritten TC-10.1/TC-10.2.

- [ ] **Step 8: Commit**

```bash
git add src App.tsx
git commit -m "feat(mobile): refresh sessions and force temporary-password change"
```

---

### Task 8: Admin session expiry, 401 handling, and the Vitest harness

**Files:**
- Create: `web-admin/src/api/adminSession.ts`, `web-admin/src/__tests__/adminSession.test.ts`, `web-admin/vitest.config.ts`
- Modify: `web-admin/src/api/client.ts`, `web-admin/src/App.tsx`, `web-admin/package.json`, root `package.json`

**Interfaces:**
- Produces: `isJwtExpired(token): boolean`, `readStoredAdminSession()`, `storeAdminSession(session)`, `clearAdminSession()`
- Produces: `SESSION_EXPIRED_EVENT = 'macq:session-expired'`
- Produces: `npm test` in `web-admin`, included in `verify:all`

- [ ] **Step 1: Extract session helpers**

Create `web-admin/src/api/adminSession.ts`:

```ts
export const SESSION_EXPIRED_EVENT = 'macq:session-expired';

export function isJwtExpired(token: string): boolean {
  const parts = token.split('.');
  if (parts.length !== 3) return true;
  try {
    const encoded = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const claims = JSON.parse(atob(encoded.padEnd(Math.ceil(encoded.length / 4) * 4, '='))) as {
      exp?: unknown;
    };
    return typeof claims.exp !== 'number' || claims.exp <= Math.floor(Date.now() / 1000);
  } catch {
    return true;
  }
}
```

Move `ADMIN_SESSION_KEY`, `getStoredAdminSession`, and `clearAdminSession` from `client.ts` into this file, adding an expiry check in `getStoredAdminSession` that clears and returns `null`.

- [ ] **Step 2: Handle 401 centrally**

In `client.ts`, add a response interceptor:

```ts
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      clearAdminSession();
      window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
    }
    return Promise.reject(error);
  },
);
```

In `App.tsx`, subscribe with `useEffect` and set the admin session to `null` when the event fires. Do not auto-redirect or reload the page; render the login screen and let the user sign in.

- [ ] **Step 3: Add Vitest**

Run:

```bash
cd web-admin && npm install -D vitest@^2.1.0 jsdom@^25.0.0 @testing-library/react@^16.0.0 @testing-library/jest-dom@^6.5.0
```

Create `web-admin/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
```

Add scripts to `web-admin/package.json`:

```json
"test": "vitest run"
```

Update root `verify:all` to `(cd web-admin && npm test && npm run build)`.

- [ ] **Step 4: Write the tests**

`web-admin/src/__tests__/adminSession.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { isJwtExpired } from '../api/adminSession';

const makeToken = (exp: number) =>
  `header.${btoa(JSON.stringify({ exp }))}.sig`;

describe('isJwtExpired', () => {
  it('treats malformed tokens as expired', () => {
    expect(isJwtExpired('not-a-token')).toBe(true);
  });

  it('compares the expiry against now', () => {
    const now = Math.floor(Date.now() / 1000);
    expect(isJwtExpired(makeToken(now - 10))).toBe(true);
    expect(isJwtExpired(makeToken(now + 600))).toBe(false);
  });
});
```

- [ ] **Step 5: Verify**

Run: `cd web-admin && npm test && npm run build`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add web-admin/package.json web-admin/package-lock.json web-admin/vitest.config.ts web-admin/src/api web-admin/src/__tests__ web-admin/src/App.tsx package.json
git commit -m "feat(admin): expire sessions and return to sign-in on 401"
```

---

### Task 9: Verification and G2 evidence preparation

**Files:**
- Modify: `SPRINT_PLAN.md`, `docs/prd/README.md` (M2 status note)
- Create: `docs/qa/gates/phase-7.md` only after the manual checklist is executed (template copy)

- [ ] **Step 1: Run the full gate**

Run: `npm run verify:all`
Expected: mobile typecheck + 48+ tests, backend typecheck + unit + build, e2e suite, admin tests + build. Zero failures.

- [ ] **Step 2: Record automated evidence**

In `SPRINT_PLAN.md`, add a `## Phase 7 implementation` table listing M2.1–M2.8 with evidence (test names and commands). Do not mark the phase approved; G2 stays `[ ]` until the manual checklist and signature.

- [ ] **Step 3: Commit**

```bash
git add SPRINT_PLAN.md docs/prd/README.md
git commit -m "docs: record Phase 7A implementation and M2 evidence"
```

Manual G2 cases covered by this plan: AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06, AUTH-09 (role matrix unchanged, re-run), AUTH-10. INT-01 is limited to the disabled path; the enabled path is blocked on tenant credentials and must be written into the gate's limitations section.

## Self-review notes

- M2.1 (no client role mutation) was completed in Phase 6; this plan removes the last simulated SSO session. Re-run AUTH-07.
- M2.2 (PII scoping) was completed in Phase 6; no change here.
- M2.6 CORS was completed in Phase 6; this plan adds headers, body limits and removes the module-level JWT fallback.
- AUTH-09 is a role-matrix regression test. Extend the e2e role matrix when Phase 7B adds employee-admin routes.
