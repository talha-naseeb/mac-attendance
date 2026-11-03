# Phase 7B — Employee Lifecycle & Organization Administration (M3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let HR run the whole employee lifecycle from the admin console — search and page a real list, onboard with a one-time temporary credential, edit, transfer, promote, change salary/role/manager/remote eligibility with an effective-dated ledger, deactivate and reactivate, and reset passwords — while the server refuses self-managers, reporting cycles, and losing the last active Super Admin.

**Architecture:** `User` stays the current-state table. A new `EmploymentChange` ledger records every dated change with before/after JSON, reason, actor and effective date, and `EmployeeSalaryRecord` keeps salary history. All writes go through `EmployeesService`, which delegates invariant checks to `OrganizationGuardService` and session revocation to `SessionService` (Phase 7A). The web admin switches from the mock list to a paginated API with drawers for create, edit, change, deactivate and password reset.

**Tech Stack:** NestJS 10, Prisma 5, PostgreSQL, Jest + Supertest (isolated DB), Vite 5 + React 18 + Tailwind admin, Vitest + Testing Library.

**Spec:** [docs/prd/README.md](../../prd/README.md) module M3 (M3.1–M3.7 and its rules), [docs/prd/test-plan.md](../../prd/test-plan.md) EMP-01…EMP-10, [SPRINT_PLAN.md](../../../SPRINT_PLAN.md) Phase 7. Depends on Phase 7A for `SessionService`, `AuditService`, `mustChangePassword`, refresh-token sessions and the e2e harness.

## Decisions already taken

- Salary is effective-dated through `EmployeeSalaryRecord`; payroll keeps reading the live `User` columns until Phase 11 introduces persisted payslips. No payslip is rewritten because none exist yet.
- Effective dates may be today or in the past. Future-dated scheduling (a job that applies pending changes) is deferred to Phase 10; the API rejects a future date with a clear message instead of silently applying it.
- Email and employee ID are immutable after creation. Email changes require a future HR workflow; the API returns 400 for them.
- Deactivation cancels the employee's pending leave requests and revokes sessions. Pending approvals where the person is the *approver* are left in place; HR's queue already shows every pending request.

## Global Constraints

- HR-only routes use `RolesGuard` with `UserRole.HR_ADMIN`; SUPER_ADMIN is allowed by the existing guard bypass.
- Every mutation writes an `AuditLog` row and never logs a password or hash.
- Temporary passwords are returned exactly once in the response and never stored in plaintext or audit details.
- Employee list responses remain paginated and sorted server-side; no client-side filtering of the full table.
- New admin UI ships English/Arabic (RTL) and light/dark using existing tokens.
- `npm run verify:all` must stay green; the e2e suite covers every EMP case it can automate.
- Do not change payroll calculations, leave balances for active employees, or the attendance contract in this plan.

## File Structure

**Backend — create**
- `backend/prisma/migrations/<timestamp>_phase7_employment_changes/` (generated)
- `backend/src/modules/employees/credentials.util.ts` + `.spec.ts`
- `backend/src/modules/employees/organization-guard.service.ts` + `.spec.ts`
- `backend/src/modules/employees/employment-changes.service.ts`
- `backend/src/modules/employees/dto/employment-change.dto.ts`
- `backend/src/modules/employees/dto/employee-admin.dto.ts`
- `backend/test/employees.e2e-spec.ts`

**Backend — modify**
- `backend/prisma/schema.prisma`
- `backend/src/modules/employees/employees.controller.ts`, `employees.service.ts`, `employees.module.ts`, `dto/employees.dto.ts`

**Admin — create**
- `web-admin/src/api/employeesApi.ts`
- `web-admin/src/services/employeeForm.ts` + `web-admin/src/__tests__/employeeForm.test.ts`
- `web-admin/src/components/EmployeeFormDrawer.tsx`
- `web-admin/src/components/EmploymentChangeDrawer.tsx`
- `web-admin/src/components/DeactivateEmployeeDialog.tsx`
- `web-admin/src/components/TemporaryPasswordModal.tsx`

**Admin — modify**
- `web-admin/src/components/EmployeesView.tsx` (full rewrite)
- `web-admin/src/api/client.ts`, `web-admin/src/data/mockAdminData.ts`, `web-admin/src/App.tsx`

---

### Task 1: Employment ledger schema

**Files:**
- Modify: `backend/prisma/schema.prisma`

**Interfaces:**
- Produces: enums `EmploymentChangeType`, models `EmploymentChange`, `EmployeeSalaryRecord`
- Produces: `User` fields `remoteGrantedById`, `remoteGrantedAt` and relations for the ledger

- [ ] **Step 1: Add enums and models**

In `backend/prisma/schema.prisma`:

```prisma
enum EmploymentChangeType {
  TRANSFER
  PROMOTION
  SALARY
  ROLE
  MANAGER
  REMOTE_ELIGIBILITY
}

model EmploymentChange {
  id            String               @id @default(uuid())
  userId        String
  user          User                 @relation("EmployeeChanges", fields: [userId], references: [id], onDelete: Cascade)

  type          EmploymentChangeType
  effectiveDate String               // YYYY-MM-DD
  reason        String
  beforeJson    Json
  afterJson     Json

  actorUserId   String?
  actor         User?                @relation("EmploymentChangeActor", fields: [actorUserId], references: [id], onDelete: SetNull)

  salaryRecord  EmployeeSalaryRecord?
  createdAt     DateTime             @default(now())

  @@index([userId, effectiveDate])
  @@index([type, effectiveDate])
}

model EmployeeSalaryRecord {
  id                  String            @id @default(uuid())
  userId              String
  user                User              @relation(fields: [userId], references: [id], onDelete: Cascade)

  basicSalarySar      Float
  housingAllowanceSar Float
  transportAllowanceSar Float
  effectiveFrom       String            // YYYY-MM-DD

  changeId            String?           @unique
  change              EmploymentChange? @relation(fields: [changeId], references: [id], onDelete: SetNull)

  createdAt           DateTime          @default(now())

  @@index([userId, effectiveFrom])
}
```

In `model User` add:

```prisma
  remoteGrantedById  String?
  remoteGrantedBy    User?               @relation("RemoteGrantor", fields: [remoteGrantedById], references: [id], onDelete: SetNull)
  remoteGrantedUsers User[]              @relation("RemoteGrantor")
  remoteGrantedAt    DateTime?
  employeeChanges    EmploymentChange[]  @relation("EmployeeChanges")
  changesMade        EmploymentChange[]  @relation("EmploymentChangeActor")
  salaryRecords      EmployeeSalaryRecord[]
```

- [ ] **Step 2: Migrate**

Run:

```bash
cd backend && npx prisma migrate dev --name phase7_employment_changes && npx prisma generate
```

Expected: additive migration only. If Prisma reports a relation name clash, keep the explicit `@relation` names above.

- [ ] **Step 3: Verify and commit**

Run: `cd backend && npm run typecheck && npm test && npm run build`

```bash
git add backend/prisma
git commit -m "feat(employees): add employment change and salary ledger"
```

---

### Task 2: Organization invariant guards

**Files:**
- Create: `backend/src/modules/employees/organization-guard.service.ts`, `organization-guard.service.spec.ts`
- Modify: `backend/src/modules/employees/employees.module.ts`

**Interfaces:**
- Produces: `assertCanAssignManager(userId, managerId)`, `assertSuperAdminRetained(userId)`, `pendingApprovalsFor(managerId)`
- Consumes: `PrismaService`

- [ ] **Step 1: Write failing unit tests**

Create `backend/src/modules/employees/organization-guard.service.spec.ts`:

```ts
import { BadRequestException, ConflictException } from '@nestjs/common';
import { OrganizationGuardService } from './organization-guard.service';

function build(prismaOverrides: Record<string, any> = {}) {
  const prisma = {
    user: { findUnique: jest.fn(), count: jest.fn() },
    leaveRequest: { count: jest.fn() },
    ...prismaOverrides,
  };
  return { prisma, service: new OrganizationGuardService(prisma as any) };
}

describe('OrganizationGuardService', () => {
  it('rejects self-management', async () => {
    const { service } = build();
    await expect(service.assertCanAssignManager('user-1', 'user-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects a reporting cycle', async () => {
    const { prisma, service } = build();
    // user-3 reports to user-4, and user-4 is at the top of the chain.
    prisma.user.findUnique
      .mockResolvedValueOnce({ managerId: 'user-4' })
      .mockResolvedValueOnce({ managerId: null });
    await expect(service.assertCanAssignManager('user-1', 'user-3')).resolves.toBeUndefined();

    // user-2 already reports to user-1, so user-2 cannot become user-1's manager.
    prisma.user.findUnique.mockReset();
    prisma.user.findUnique.mockResolvedValueOnce({ managerId: 'user-1' });
    await expect(service.assertCanAssignManager('user-1', 'user-2')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('refuses to remove the last active Super Admin', async () => {
    const { prisma, service } = build();
    prisma.user.findUnique.mockResolvedValue({ role: 'SUPER_ADMIN', isActive: true });
    prisma.user.count.mockResolvedValue(0);
    await expect(service.assertSuperAdminRetained('user-1')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('allows demotion when another active Super Admin remains', async () => {
    const { prisma, service } = build();
    prisma.user.findUnique.mockResolvedValue({ role: 'SUPER_ADMIN', isActive: true });
    prisma.user.count.mockResolvedValue(1);
    await expect(service.assertSuperAdminRetained('user-1')).resolves.toBeUndefined();
  });
});
```

Run: `cd backend && npx jest organization-guard.service.spec.ts`
Expected: FAIL — module not found.

- [ ] **Step 2: Implement**

Create `backend/src/modules/employees/organization-guard.service.ts`:

```ts
import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class OrganizationGuardService {
  constructor(private prisma: PrismaService) {}

  async assertCanAssignManager(userId: string, managerId: string | null | undefined): Promise<void> {
    if (!managerId) return;
    if (managerId === userId) {
      throw new BadRequestException('An employee cannot be their own manager.');
    }

    const seen = new Set<string>();
    let current: string | null = managerId;
    for (let depth = 0; current && depth < 50; depth += 1) {
      if (current === userId) {
        throw new BadRequestException(
          'This manager assignment would create a reporting cycle.',
        );
      }
      if (seen.has(current)) {
        throw new BadRequestException('The reporting hierarchy already contains a cycle.');
      }
      seen.add(current);
      const next = await this.prisma.user.findUnique({
        where: { id: current },
        select: { managerId: true },
      });
      if (!next) {
        throw new BadRequestException('The selected manager does not exist.');
      }
      current = next.managerId;
    }
  }

  async assertSuperAdminRetained(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, isActive: true },
    });
    if (!user || user.role !== 'SUPER_ADMIN' || !user.isActive) return;

    const remaining = await this.prisma.user.count({
      where: { role: 'SUPER_ADMIN', isActive: true, id: { not: userId } },
    });
    if (remaining === 0) {
      throw new ConflictException(
        'The last active Super Admin cannot be deactivated or demoted.',
      );
    }
  }

  async pendingApprovalsFor(managerId: string): Promise<number> {
    return this.prisma.leaveRequest.count({
      where: {
        status: { in: ['PENDING', 'PENDING_MANAGER', 'PENDING_HR'] },
        user: { managerId },
      },
    });
  }
}
```

Add `OrganizationGuardService` to `providers` and `exports` of `employees.module.ts`.

- [ ] **Step 3: Run tests**

Run: `cd backend && npx jest organization-guard.service.spec.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add backend/src/modules/employees/organization-guard.service.ts backend/src/modules/employees/organization-guard.service.spec.ts backend/src/modules/employees/employees.module.ts
git commit -m "feat(employees): guard manager cycles and Super Admin retention"
```

---

### Task 3: Paginated, filterable employee admin list

**Files:**
- Create: `backend/src/modules/employees/dto/employee-admin.dto.ts`
- Modify: `backend/src/modules/employees/employees.service.ts`, `employees.controller.ts`
- Test: `backend/test/employees.e2e-spec.ts`

**Interfaces:**
- Produces: `GET /api/employees/admin` → `{ items, total, page, pageSize }`
- Produces: `AdminEmployeeQueryDto` with `search, department, branchId, status, sort, direction, page, pageSize`
- Consumes: `OrganizationGuardService` (not here), `AuditService` (not here)

- [ ] **Step 1: Add the query DTO**

Create `backend/src/modules/employees/dto/employee-admin.dto.ts`:

```ts
import { Type } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export enum EmployeeStatusFilter {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  ALL = 'ALL',
}

export class AdminEmployeeQueryDto {
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsString() department?: string;
  @IsOptional() @IsString() branchId?: string;
  @IsOptional() @IsEnum(EmployeeStatusFilter) status?: EmployeeStatusFilter;
  @IsOptional() @IsIn(['employeeId', 'name', 'department', 'status']) sort?: string;
  @IsOptional() @IsIn(['asc', 'desc']) direction?: 'asc' | 'desc';
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number;
}
```

- [ ] **Step 2: Implement `findAllForAdmin`**

Replace the existing method in `employees.service.ts`:

```ts
async findAllForAdmin(query: AdminEmployeeQueryDto) {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 25;
  const where: any = {};

  if (query.status === EmployeeStatusFilter.ACTIVE) where.isActive = true;
  if (query.status === EmployeeStatusFilter.INACTIVE) where.isActive = false;

  if (query.department) where.department = query.department;
  if (query.branchId) where.branchId = query.branchId;
  if (query.search) {
    where.OR = [
      { firstName: { contains: query.search, mode: 'insensitive' } },
      { lastName: { contains: query.search, mode: 'insensitive' } },
      { employeeId: { contains: query.search, mode: 'insensitive' } },
      { email: { contains: query.search, mode: 'insensitive' } },
      { jobTitle: { contains: query.search, mode: 'insensitive' } },
    ];
  }

  const direction = query.direction ?? 'asc';
  const orderBy =
    query.sort === 'name'
      ? [{ lastName: direction }, { firstName: direction }]
      : query.sort === 'department'
        ? [{ department: direction }, { employeeId: 'asc' }]
        : query.sort === 'status'
          ? [{ isActive: direction }, { employeeId: 'asc' }]
          : [{ employeeId: direction }];

  const [items, total] = await this.prisma.$transaction([
    this.prisma.user.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        employeeId: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        department: true,
        jobTitle: true,
        role: true,
        isSaudi: true,
        isActive: true,
        nationalId: true,
        iqamaNumber: true,
        basicSalarySar: true,
        housingAllowanceSar: true,
        transportAllowanceSar: true,
        avatarUrl: true,
        isRemoteAllowed: true,
        mustChangePassword: true,
        branch: { select: { id: true, name: true, nameAr: true, code: true } },
        manager: { select: { id: true, firstName: true, lastName: true } },
      },
    }),
    this.prisma.user.count({ where }),
  ]);

  return { items, total, page, pageSize };
}
```

Import `EmployeeStatusFilter`, `AdminEmployeeQueryDto`.

- [ ] **Step 3: Update the controller**

```ts
@Get('admin')
@UseGuards(RolesGuard)
@Roles(UserRole.HR_ADMIN, UserRole.SUPER_ADMIN)
@ApiOperation({ summary: 'Paginated employee and payroll records for the administration console' })
async getAdminEmployees(@Query() query: AdminEmployeeQueryDto) {
  return this.employeesService.findAllForAdmin(query);
}
```

- [ ] **Step 4: Write the e2e test**

Create `backend/test/employees.e2e-spec.ts`:

```ts
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
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
```

- [ ] **Step 5: Run e2e**

Run: `cd backend && npm run test:e2e`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/modules/employees backend/test/employees.e2e-spec.ts
git commit -m "feat(employees): paginate and filter the admin employee list"
```

---

### Task 4: Onboarding with a one-time temporary credential

**Files:**
- Create: `backend/src/modules/employees/credentials.util.ts`, `credentials.util.spec.ts`
- Modify: `backend/src/modules/employees/dto/employees.dto.ts`, `employees.service.ts`, `employees.controller.ts`, `backend/test/employees.e2e-spec.ts`

**Interfaces:**
- Produces: `generateTemporaryPassword(): string`
- Produces: `POST /api/employees` → `{ employee, temporaryPassword }`
- Produces: `CreateEmployeeDto` gains `fullNameAr?`, `titleAr?`, `departmentAr?`, `isRemoteAllowed?`, `initialLeaveBalances?`

- [ ] **Step 1: Test the generator**

Create `backend/src/modules/employees/credentials.util.spec.ts`:

```ts
import { generateTemporaryPassword } from './credentials.util';

describe('generateTemporaryPassword', () => {
  it('produces four distinct 16-character credentials with every character class', () => {
    const values = new Set<string>();
    for (let i = 0; i < 4; i += 1) {
      const value = generateTemporaryPassword();
      values.add(value);
      expect(value).toHaveLength(16);
      expect(value).toMatch(/[A-Z]/);
      expect(value).toMatch(/[a-z]/);
      expect(value).toMatch(/[0-9]/);
      expect(value).toMatch(/[^A-Za-z0-9]/);
    }
    expect(values.size).toBe(4);
  });
});
```

Run: `npx jest credentials.util.spec.ts` — expected FAIL.

- [ ] **Step 2: Implement**

```ts
import { randomBytes } from 'crypto';

export function generateTemporaryPassword(): string {
  const body = randomBytes(9).toString('base64url').slice(0, 12);
  return `Mq${body}9!`;
}
```

Run the test. Expected: PASS.

- [ ] **Step 3: Extend `CreateEmployeeDto`**

Add to `backend/src/modules/employees/dto/employees.dto.ts`:

```ts
  @ApiPropertyOptional()
  @IsString() @IsOptional()
  fullNameAr?: string;

  @ApiPropertyOptional()
  @IsString() @IsOptional()
  titleAr?: string;

  @ApiPropertyOptional()
  @IsString() @IsOptional()
  departmentAr?: string;

  @ApiPropertyOptional({ default: false })
  @IsBoolean() @IsOptional()
  isRemoteAllowed?: boolean;

  @ApiPropertyOptional({ type: [Object] })
  @IsArray() @IsOptional()
  initialLeaveBalances?: Array<{ leaveType: string; totalDays: number }>;
```

Import `IsArray`.

- [ ] **Step 4: Rewrite `EmployeesService.create`**

```ts
async create(dto: CreateEmployeeDto, actor: AuthenticatedUser) {
  if (dto.role === 'SUPER_ADMIN' && actor.role !== 'SUPER_ADMIN') {
    throw new ForbiddenException('Only a Super Admin can create another Super Admin.');
  }

  const existing = await this.prisma.user.findFirst({
    where: {
      OR: [{ email: dto.email.toLowerCase() }, { employeeId: dto.employeeId }],
    },
  });
  if (existing) {
    throw new ConflictException(
      existing.email === dto.email.toLowerCase()
        ? `An employee with email ${dto.email} already exists.`
        : `Employee ID ${dto.employeeId} is already in use.`,
    );
  }

  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await bcrypt.hash(temporaryPassword, 10);
  const year = new Date().getFullYear();
  const balances = dto.initialLeaveBalances?.length
    ? dto.initialLeaveBalances
    : [
        { leaveType: 'ANNUAL', totalDays: 30 },
        { leaveType: 'SICK', totalDays: 30 },
        { leaveType: 'HAJJ', totalDays: 10 },
        { leaveType: 'PATERNITY', totalDays: 3 },
      ];

  const employee = await this.prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        employeeId: dto.employeeId,
        email: dto.email.toLowerCase(),
        passwordHash,
        mustChangePassword: true,
        role: dto.role,
        firstName: dto.firstName,
        lastName: dto.lastName,
        fullName: `${dto.firstName} ${dto.lastName}`,
        fullNameAr: dto.fullNameAr ?? `${dto.firstName} ${dto.lastName}`,
        jobTitle: dto.jobTitle,
        titleAr: dto.titleAr,
        department: dto.department,
        departmentAr: dto.departmentAr,
        phone: dto.phone ?? '',
        isSaudi: dto.isSaudi,
        nationalId: dto.nationalId,
        iqamaNumber: dto.iqamaNumber,
        basicSalarySar: dto.basicSalarySar,
        housingAllowanceSar: dto.housingAllowanceSar ?? 0,
        transportAllowanceSar: dto.transportAllowanceSar ?? 0,
        branchId: dto.branchId,
        managerId: dto.managerId,
        isRemoteAllowed: dto.isRemoteAllowed ?? false,
        remoteGrantedById: dto.isRemoteAllowed ? actor.id : null,
        remoteGrantedAt: dto.isRemoteAllowed ? new Date() : null,
        canAccessWebAdmin:
          dto.role === 'HR_ADMIN' || dto.role === 'SUPER_ADMIN',
      },
    });
    await tx.leaveBalance.createMany({
      data: balances.map((balance) => ({
        userId: created.id,
        leaveType: balance.leaveType,
        totalDays: balance.totalDays,
        usedDays: 0,
        year,
      })),
    });
    return created;
  });

  await this.audit.record({
    actorUserId: actor.id,
    action: 'EMPLOYEE_CREATED',
    resource: 'User',
    details: { employeeId: employee.employeeId, role: employee.role },
  });

  const { passwordHash: _, ...safeUser } = employee;
  return { employee: safeUser, temporaryPassword };
}
```

Inject `AuditService` into `EmployeesService`. A new hire cannot be part of a reporting cycle, so there is nothing to walk; validate the chosen manager directly before the transaction:

```ts
if (dto.managerId) {
  const manager = await this.prisma.user.findUnique({
    where: { id: dto.managerId },
    select: { isActive: true },
  });
  if (!manager) {
    throw new BadRequestException('The selected manager does not exist.');
  }
  if (!manager.isActive) {
    throw new BadRequestException('The selected manager is not active.');
  }
}
```

- [ ] **Step 5: Update the controller**

```ts
@Post()
@UseGuards(RolesGuard)
@Roles(UserRole.HR_ADMIN, UserRole.SUPER_ADMIN)
async createEmployee(
  @Body() dto: CreateEmployeeDto,
  @CurrentUser() actor: AuthenticatedUser,
) {
  return this.employeesService.create(dto, actor);
}
```

- [ ] **Step 6: Add e2e coverage (EMP-01, EMP-02, AUTH-10)**

Append to `employees.e2e-spec.ts`:

```ts
  it('EMP-01: creates an employee who can sign in and must change the temporary password', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/employees')
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        employeeId: 'EMP-NEW',
        email: 'new.hire@macqhr.sa',
        firstName: 'New',
        lastName: 'Hire',
        isSaudi: true,
        department: 'Engineering',
        jobTitle: 'Engineer',
        role: 'EMPLOYEE',
        basicSalarySar: 9000,
      })
      .expect(201);

    expect(created.body.temporaryPassword).toHaveLength(16);

    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'new.hire@macqhr.sa', password: created.body.temporaryPassword })
      .expect(201);
    expect(login.body.user.mustChangePassword).toBe(true);

    const balances = await testPrisma.leaveBalance.count({
      where: { userId: created.body.employee.id },
    });
    expect(balances).toBe(4);

    const directory = await request(app.getHttpServer())
      .get('/api/directory')
      .set('Authorization', `Bearer ${hrToken}`)
      .expect(200);
    expect(directory.body.some((item: any) => item.email === 'new.hire@macqhr.sa')).toBe(true);
  });

  it('EMP-02: rejects a duplicate employee ID with a field-specific conflict', async () => {
    const payload = {
      employeeId: 'EMP-DUP',
      email: 'dup@macqhr.sa',
      firstName: 'Dup',
      lastName: 'One',
      isSaudi: true,
      department: 'Engineering',
      jobTitle: 'Engineer',
      role: 'EMPLOYEE',
      basicSalarySar: 9000,
    };
    await request(app.getHttpServer())
      .post('/api/employees')
      .set('Authorization', `Bearer ${hrToken}`)
      .send(payload)
      .expect(201);

    const conflict = await request(app.getHttpServer())
      .post('/api/employees')
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ ...payload, email: 'other@macqhr.sa' })
      .expect(409);
    expect(conflict.body.message).toContain('EMP-DUP');
  });
```

- [ ] **Step 7: Run e2e and commit**

Run: `cd backend && npm run test:e2e` — PASS.

```bash
git add backend/src/modules/employees backend/test/employees.e2e-spec.ts
git commit -m "feat(employees): onboard with a one-time temporary credential"
```

---

### Task 5: Profile updates and immutable identity

**Files:**
- Modify: `backend/src/modules/employees/dto/employees.dto.ts`, `employees.service.ts`, `employees.controller.ts`, `backend/test/employees.e2e-spec.ts`

**Interfaces:**
- Produces: `PATCH /api/employees/:id` accepts only `firstName, lastName, phone, jobTitle, department, fullNameAr, titleAr, departmentAr`
- Produces: 400 when a request sends `email` or `employeeId` (the global `ValidationPipe` has `forbidNonWhitelisted: true`, so the response is Nest's `property email should not exist`)

- [ ] **Step 1: Trim `UpdateEmployeeDto`**

Remove `basicSalarySar`, `housingAllowanceSar`, `transportAllowanceSar`, `isActive` from `UpdateEmployeeDto`; they move to the change ledger and deactivation endpoints. Add the Arabic fields. Do **not** add `email` or `employeeId`.

- [ ] **Step 2: Update the service**

```ts
async update(id: string, dto: UpdateEmployeeDto, actor: AuthenticatedUser) {
  await this.ensureEmployeeExists(id);
  const data: any = { ...dto };
  if (dto.firstName || dto.lastName) {
    const current = await this.prisma.user.findUniqueOrThrow({
      where: { id },
      select: { firstName: true, lastName: true },
    });
    const firstName = dto.firstName ?? current.firstName;
    const lastName = dto.lastName ?? current.lastName;
    data.fullName = `${firstName} ${lastName}`;
  }
  const updated = await this.prisma.user.update({ where: { id }, data });
  await this.audit.record({
    actorUserId: actor.id,
    action: 'EMPLOYEE_UPDATED',
    resource: 'User',
    details: { employeeId: updated.employeeId, fields: Object.keys(dto) },
  });
  const { passwordHash, ...safeUser } = updated;
  return safeUser;
}
```

- [ ] **Step 3: Update controller + test**

Pass `@CurrentUser()` to `updateEmployee`. Add to `employees.e2e-spec.ts`:

```ts
  it('rejects email and employee ID changes', async () => {
    const target = await createUser(testPrisma, {
      email: 'edit@macqhr.sa',
      employeeId: 'EMP-EDIT',
    });
    await request(app.getHttpServer())
      .patch(`/api/employees/${target.id}`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ email: 'changed@macqhr.sa' })
      .expect(400);
    await request(app.getHttpServer())
      .patch(`/api/employees/${target.id}`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ jobTitle: 'Senior Engineer' })
      .expect(200);
  });
```

- [ ] **Step 4: Run and commit**

Run: `cd backend && npm run test:e2e`

```bash
git add backend/src/modules/employees backend/test/employees.e2e-spec.ts
git commit -m "feat(employees): restrict profile edits and keep identity immutable"
```

---

### Task 6: Effective-dated employment changes

**Files:**
- Create: `backend/src/modules/employees/dto/employment-change.dto.ts`
- Create: `backend/src/modules/employees/employment-changes.service.ts`, `employment-changes.service.spec.ts`
- Modify: `backend/src/modules/employees/employees.controller.ts`, `employees.module.ts`
- Modify: `backend/test/employees.e2e-spec.ts`

**Interfaces:**
- Produces: `POST /api/employees/:id/changes` → `{ change, employee }`
- Produces: `GET /api/employees/:id/changes` → change list, newest first
- Produces: `EmploymentChangesService.apply(userId, dto, actor)`
- Consumes: `OrganizationGuardService`, `SessionService`, `AuditService`, `companyDateIso` helper

- [ ] **Step 1: Add a company-date helper**

Create `backend/src/common/utils/company-time.util.ts`:

```ts
export function toCompanyDateIso(date: Date = new Date(), timeZone = 'Asia/Riyadh'): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(date);
}
```

(Phase 8 will extend this file with day ranges; keep it small now.)

- [ ] **Step 2: Add the DTO**

`backend/src/modules/employees/dto/employment-change.dto.ts`:

```ts
import { Type } from 'class-transformer';
import {
  IsBoolean, IsEnum, IsISO8601, IsNumber, IsOptional, IsString, Length, Min, ValidateIf,
} from 'class-validator';
import { EmploymentChangeType } from '@prisma/client';
import { UserRole } from '../../../common/decorators/roles.decorator';

export class EmploymentChangeDto {
  @IsEnum(EmploymentChangeType)
  type: EmploymentChangeType;

  @IsISO8601()
  effectiveDate: string;

  @IsString()
  @Length(3, 300)
  reason: string;

  @ValidateIf((o) => o.type === EmploymentChangeType.TRANSFER)
  @IsString()
  branchId?: string;

  @ValidateIf((o) => o.type === EmploymentChangeType.PROMOTION)
  @IsString()
  @Length(2, 120)
  jobTitle?: string;

  @ValidateIf((o) => o.type === EmploymentChangeType.SALARY)
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  basicSalarySar?: number;

  @ValidateIf((o) => o.type === EmploymentChangeType.SALARY)
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  housingAllowanceSar?: number;

  @ValidateIf((o) => o.type === EmploymentChangeType.SALARY)
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  transportAllowanceSar?: number;

  @ValidateIf((o) => o.type === EmploymentChangeType.ROLE)
  @IsEnum(UserRole)
  role?: UserRole;

  @ValidateIf((o) => o.type === EmploymentChangeType.MANAGER)
  @IsOptional()
  @IsString()
  managerId?: string | null;

  @ValidateIf((o) => o.type === EmploymentChangeType.REMOTE_ELIGIBILITY)
  @IsBoolean()
  isRemoteAllowed?: boolean;
}
```

- [ ] **Step 3: Write failing unit tests for the apply rules**

`backend/src/modules/employees/employment-changes.service.spec.ts`:

```ts
import { BadRequestException } from '@nestjs/common';
import { EmploymentChangesService } from './employment-changes.service';
import { toCompanyDateIso } from '../../common/utils/company-time.util';

function build() {
  const prisma = {
    user: { findUniqueOrThrow: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    branch: { findUnique: jest.fn() },
    employmentChange: { create: jest.fn(), findMany: jest.fn() },
    employeeSalaryRecord: { create: jest.fn() },
    $transaction: jest.fn((cb: any) => cb(prisma)),
  };
  const guards = {
    assertCanAssignManager: jest.fn(),
    assertSuperAdminRetained: jest.fn(),
  };
  const sessions = { revokeAllForUser: jest.fn() };
  const audit = { record: jest.fn() };
  const service = new EmploymentChangesService(
    prisma as any,
    guards as any,
    sessions as any,
    audit as any,
  );
  return { prisma, guards, sessions, audit, service };
}

const actor = { id: 'hr-1', role: 'HR_ADMIN' } as any;

const user = {
  id: 'user-1',
  employeeId: 'EMP-1',
  role: 'EMPLOYEE',
  jobTitle: 'Engineer',
  branchId: 'branch-a',
  managerId: null,
  isRemoteAllowed: false,
  basicSalarySar: 10000,
  housingAllowanceSar: 2000,
  transportAllowanceSar: 1000,
  remoteGrantedById: null,
  remoteGrantedAt: null,
};

describe('EmploymentChangesService', () => {
  it('rejects future effective dates', async () => {
    const { service } = build();
    await expect(
      service.apply('user-1', {
        type: 'PROMOTION',
        effectiveDate: '2999-01-01',
        reason: 'Future',
        jobTitle: 'Lead',
      } as any, actor),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('revokes sessions when the role changes', async () => {
    const { prisma, sessions, service } = build();
    prisma.user.findUniqueOrThrow.mockResolvedValue(user);
    prisma.employmentChange.create.mockResolvedValue({ id: 'change-1' });
    prisma.user.update.mockResolvedValue({ ...user, role: 'MANAGER' });

    await service.apply('user-1', {
      type: 'ROLE',
      effectiveDate: toCompanyDateIso(),
      reason: 'Promotion to manager track',
      role: 'MANAGER',
    } as any, actor);

    expect(sessions.revokeAllForUser).toHaveBeenCalledWith('user-1', 'ROLE_CHANGE');
  });

  it('writes a salary record and updates current columns', async () => {
    const { prisma, service } = build();
    prisma.user.findUniqueOrThrow.mockResolvedValue(user);
    prisma.employmentChange.create.mockResolvedValue({ id: 'change-2' });
    prisma.employeeSalaryRecord.create.mockResolvedValue({ id: 'salary-2' });
    prisma.user.update.mockResolvedValue(user);

    await service.apply('user-1', {
      type: 'SALARY',
      effectiveDate: toCompanyDateIso(),
      reason: 'Annual review',
      basicSalarySar: 12000,
      housingAllowanceSar: 2500,
      transportAllowanceSar: 1000,
    } as any, actor);

    expect(prisma.employeeSalaryRecord.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ basicSalarySar: 12000, effectiveFrom: toCompanyDateIso() }),
    });
  });
});
```

Run: `npx jest employment-changes.service.spec.ts` — expected FAIL.

- [ ] **Step 4: Implement the service**

`backend/src/modules/employees/employment-changes.service.ts`:

```ts
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../../common/services/audit.service';
import { SessionService } from '../auth/session.service';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { OrganizationGuardService } from './organization-guard.service';
import { EmploymentChangeDto } from './dto/employment-change.dto';
import { toCompanyDateIso } from '../../common/utils/company-time.util';

@Injectable()
export class EmploymentChangesService {
  constructor(
    private prisma: PrismaService,
    private organizationGuard: OrganizationGuardService,
    private sessionService: SessionService,
    private audit: AuditService,
  ) {}

  async apply(userId: string, dto: EmploymentChangeDto, actor: AuthenticatedUser) {
    const today = toCompanyDateIso();
    if (dto.effectiveDate > today) {
      throw new BadRequestException(
        'Effective dates in the future are not supported yet. Choose today or a past date.',
      );
    }

    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const before: Record<string, unknown> = {
      branchId: user.branchId,
      jobTitle: user.jobTitle,
      role: user.role,
      managerId: user.managerId,
      isRemoteAllowed: user.isRemoteAllowed,
      basicSalarySar: user.basicSalarySar,
      housingAllowanceSar: user.housingAllowanceSar,
      transportAllowanceSar: user.transportAllowanceSar,
    };
    let patch: Prisma.UserUpdateInput = {};
    let after: Record<string, unknown> = {};
    let extra: { salary: boolean } = { salary: false };

    switch (dto.type) {
      case 'TRANSFER': {
        if (!dto.branchId) throw new BadRequestException('branchId is required for a transfer.');
        const branch = await this.prisma.branch.findUnique({ where: { id: dto.branchId } });
        if (!branch) throw new BadRequestException('The destination branch does not exist.');
        patch = { branch: { connect: { id: dto.branchId } } };
        after = { branchId: dto.branchId };
        break;
      }
      case 'PROMOTION': {
        if (!dto.jobTitle) throw new BadRequestException('jobTitle is required for a promotion.');
        patch = { jobTitle: dto.jobTitle };
        after = { jobTitle: dto.jobTitle };
        break;
      }
      case 'SALARY': {
        if (dto.basicSalarySar === undefined) {
          throw new BadRequestException('basicSalarySar is required for a salary change.');
        }
        patch = {
          basicSalarySar: dto.basicSalarySar,
          housingAllowanceSar: dto.housingAllowanceSar ?? user.housingAllowanceSar,
          transportAllowanceSar: dto.transportAllowanceSar ?? user.transportAllowanceSar,
        };
        after = {
          basicSalarySar: dto.basicSalarySar,
          housingAllowanceSar: dto.housingAllowanceSar ?? user.housingAllowanceSar,
          transportAllowanceSar: dto.transportAllowanceSar ?? user.transportAllowanceSar,
        };
        extra = { salary: true };
        break;
      }
      case 'ROLE': {
        if (!dto.role) throw new BadRequestException('role is required for a role change.');
        if (dto.role === user.role) {
          throw new BadRequestException('The employee already holds this role.');
        }
        if (dto.role === 'SUPER_ADMIN' && actor.role !== 'SUPER_ADMIN') {
          throw new ForbiddenException('Only a Super Admin can grant the Super Admin role.');
        }
        if (user.role === 'SUPER_ADMIN' && dto.role !== 'SUPER_ADMIN') {
          await this.organizationGuard.assertSuperAdminRetained(userId);
        }
        patch = {
          role: dto.role,
          canAccessWebAdmin: dto.role === 'HR_ADMIN' || dto.role === 'SUPER_ADMIN',
        };
        after = { role: dto.role };
        break;
      }
      case 'MANAGER': {
        await this.organizationGuard.assertCanAssignManager(userId, dto.managerId ?? null);
        patch = dto.managerId
          ? { manager: { connect: { id: dto.managerId } } }
          : { manager: { disconnect: true } };
        after = { managerId: dto.managerId ?? null };
        break;
      }
      case 'REMOTE_ELIGIBILITY': {
        if (typeof dto.isRemoteAllowed !== 'boolean') {
          throw new BadRequestException('isRemoteAllowed is required for a remote eligibility change.');
        }
        patch = {
          isRemoteAllowed: dto.isRemoteAllowed,
          remoteGrantedById: dto.isRemoteAllowed ? actor.id : null,
          remoteGrantedAt: dto.isRemoteAllowed ? new Date() : null,
        };
        after = {
          isRemoteAllowed: dto.isRemoteAllowed,
          remoteGrantedById: dto.isRemoteAllowed ? actor.id : null,
        };
        break;
      }
      default:
        throw new BadRequestException('Unsupported employment change type.');
    }

    const change = await this.prisma.$transaction(async (tx) => {
      const created = await tx.employmentChange.create({
        data: {
          userId,
          type: dto.type,
          effectiveDate: dto.effectiveDate,
          reason: dto.reason,
          beforeJson: before as object,
          afterJson: after as object,
          actorUserId: actor.id,
        },
      });
      if (extra.salary) {
        await tx.employeeSalaryRecord.create({
          data: {
            userId,
            basicSalarySar: after.basicSalarySar as number,
            housingAllowanceSar: after.housingAllowanceSar as number,
            transportAllowanceSar: after.transportAllowanceSar as number,
            effectiveFrom: dto.effectiveDate,
            changeId: created.id,
          },
        });
      }
      await tx.user.update({ where: { id: userId }, data: patch });
      return created;
    });

    if (dto.type === 'ROLE') {
      await this.sessionService.revokeAllForUser(userId, 'ROLE_CHANGE');
    }
    await this.audit.record({
      actorUserId: actor.id,
      action: 'EMPLOYMENT_CHANGE_APPLIED',
      resource: 'User',
      details: { userId, type: dto.type, effectiveDate: dto.effectiveDate, changeId: change.id },
    });

    const employee = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const { passwordHash, ...safeUser } = employee;
    return { change, employee: safeUser };
  }

  async list(userId: string) {
    const exists = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!exists) throw new NotFoundException(`Employee ${userId} not found.`);
    return this.prisma.employmentChange.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        actor: { select: { firstName: true, lastName: true } },
        salaryRecord: true,
      },
    });
  }
}
```

Note: `Prisma` types make `patch` assignment strict; if the compiler rejects `patch = { branch: ... }` against `UserUpdateInput`, type it as `Prisma.UserUpdateInput` (already done) — this is the correct union member.

- [ ] **Step 5: Wire the controller**

```ts
@Post(':id/changes')
@UseGuards(RolesGuard)
@Roles(UserRole.HR_ADMIN, UserRole.SUPER_ADMIN)
async applyChange(
  @Param('id') id: string,
  @Body() dto: EmploymentChangeDto,
  @CurrentUser() actor: AuthenticatedUser,
) {
  return this.employmentChanges.apply(id, dto, actor);
}

@Get(':id/changes')
@UseGuards(RolesGuard)
@Roles(UserRole.HR_ADMIN, UserRole.SUPER_ADMIN)
async listChanges(@Param('id') id: string) {
  return this.employmentChanges.list(id);
}
```

Provider registration: `EmploymentChangesService` in `employees.module.ts`. Import `AuthModule` in `EmployeesModule` so `SessionService` resolves (add `AuthModule` to `imports`; `AuthModule` exports `SessionService`).

- [ ] **Step 6: Add e2e coverage (EMP-04, EMP-05, EMP-06)**

Append:

```ts
  it('EMP-06: promotion revokes sessions and the next login carries the new role', async () => {
    const employee = await createUser(testPrisma, {
      email: 'promote@macqhr.sa',
      employeeId: 'EMP-P',
    });
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'promote@macqhr.sa', password: TEST_PASSWORD });
    const token = login.body.accessToken;

    await request(app.getHttpServer())
      .post(`/api/employees/${employee.id}/changes`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        type: 'ROLE',
        effectiveDate: new Date().toISOString().slice(0, 10),
        reason: 'Promotion to manager',
        role: 'MANAGER',
      })
      .expect(201);

    await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);

    const relogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'promote@macqhr.sa', password: TEST_PASSWORD })
      .expect(201);
    expect(relogin.body.user.role).toBe('MANAGER');
  });

  it('EMP-05: remote eligibility is audited with the granting HR user', async () => {
    const employee = await createUser(testPrisma, {
      email: 'remote@macqhr.sa',
      employeeId: 'EMP-R',
    });
    await request(app.getHttpServer())
      .post(`/api/employees/${employee.id}/changes`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        type: 'REMOTE_ELIGIBILITY',
        effectiveDate: new Date().toISOString().slice(0, 10),
        reason: 'Approved remote arrangement',
        isRemoteAllowed: true,
      })
      .expect(201);

    const updated = await testPrisma.user.findUniqueOrThrow({ where: { id: employee.id } });
    expect(updated.isRemoteAllowed).toBe(true);
    expect(updated.remoteGrantedAt).toBeTruthy();
    const audit = await testPrisma.auditLog.findFirst({
      where: { action: 'EMPLOYMENT_CHANGE_APPLIED' },
    });
    expect(audit).toBeTruthy();
  });

  it('EMP-04: a transfer validates later punches against the new branch', async () => {
    const targetBranch = await testPrisma.branch.create({
      data: {
        name: 'Jeddah Hub',
        nameAr: 'فرع جدة',
        city: 'Jeddah',
        cityAr: 'جدة',
        latitude: 21.4858,
        longitude: 39.1925,
      },
    });
    const employee = await createUser(testPrisma, {
      email: 'transfer@macqhr.sa',
      employeeId: 'EMP-T',
    });
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'transfer@macqhr.sa', password: TEST_PASSWORD });
    const token = login.body.accessToken;

    const before = await request(app.getHttpServer())
      .post('/api/attendance/punch')
      .set('Authorization', `Bearer ${token}`)
      .send({
        type: 'CHECK_IN',
        latitude: 21.4858,
        longitude: 39.1925,
        accuracyMeters: 10,
        isMockLocation: false,
        isDeviceRooted: false,
        biometricVerified: true,
        clientTimestamp: new Date().toISOString(),
        branchId: (await testPrisma.user.findUniqueOrThrow({ where: { id: employee.id } })).branchId,
        workMode: 'OFFICE',
      })
      .expect(400);

    await request(app.getHttpServer())
      .post(`/api/employees/${employee.id}/changes`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        type: 'TRANSFER',
        effectiveDate: new Date().toISOString().slice(0, 10),
        reason: 'Relocation to Jeddah',
        branchId: targetBranch.id,
      })
      .expect(201);

    const punch = await request(app.getHttpServer())
      .post('/api/attendance/punch')
      .set('Authorization', `Bearer ${token}`)
      .send({
        type: 'CHECK_IN',
        latitude: 21.4858,
        longitude: 39.1925,
        accuracyMeters: 10,
        isMockLocation: false,
        isDeviceRooted: false,
        biometricVerified: true,
        clientTimestamp: new Date().toISOString(),
        branchId: targetBranch.id,
        workMode: 'OFFICE',
      })
      .expect(201);
    expect(punch.body.record.branchId).toBe(targetBranch.id);
  });
```

Note: the attendance punch endpoint compares `user.branchId` with `dto.branchId`; the transfer makes Jeddah the assigned branch. Keep the pre-transfer punch on the old branch ID with Jeddah coordinates so it fails on geofence, proving validation follows the assignment.

- [ ] **Step 7: Run and commit**

Run: `cd backend && npm test && npm run test:e2e`

```bash
git add backend/src/modules/employees backend/src/common/utils/company-time.util.ts backend/test/employees.e2e-spec.ts
git commit -m "feat(employees): apply effective-dated employment changes"
```

---

### Task 7: Deactivation, reactivation, and safeguards

**Files:**
- Modify: `backend/src/modules/employees/employees.service.ts`, `employees.controller.ts`
- Modify: `backend/test/employees.e2e-spec.ts`

**Interfaces:**
- Produces: `POST /api/employees/:id/deactivate` → `{ deactivated, pendingLeaveRequestsCancelled }`
- Produces: `POST /api/employees/:id/reactivate`
- Consumes: `OrganizationGuardService.assertSuperAdminRetained`, `SessionService.revokeAllForUser`

- [ ] **Step 1: Implement the service methods**

```ts
async deactivate(id: string, reason: string, actor: AuthenticatedUser) {
  await this.ensureEmployeeExists(id);
  const target = await this.prisma.user.findUniqueOrThrow({
    where: { id },
    select: { role: true },
  });
  if (target.role === 'SUPER_ADMIN' && actor.role !== 'SUPER_ADMIN') {
    throw new ForbiddenException('Only a Super Admin can deactivate a Super Admin.');
  }
  await this.organizationGuard.assertSuperAdminRetained(id);

  const cancelled = await this.prisma.$transaction(async (tx) => {
    const pending = await tx.leaveRequest.updateMany({
      where: {
        userId: id,
        status: { in: ['PENDING', 'PENDING_MANAGER', 'PENDING_HR'] },
      },
      data: {
        status: 'REJECTED',
        rejectionReason: 'Account deactivated by HR.',
        decidedById: actor.id,
        decidedAt: new Date(),
      },
    });
    await tx.user.update({ where: { id }, data: { isActive: false } });
    return pending.count;
  });

  await this.sessionService.revokeAllForUser(id, 'DEACTIVATED');
  await this.audit.record({
    actorUserId: actor.id,
    action: 'EMPLOYEE_DEACTIVATED',
    resource: 'User',
    details: { userId: id, reason, pendingLeaveRequestsCancelled: cancelled },
  });
  return { deactivated: true, pendingLeaveRequestsCancelled: cancelled };
}

async reactivate(id: string, reason: string, actor: AuthenticatedUser) {
  const employee = await this.prisma.user.findUnique({ where: { id } });
  if (!employee) throw new NotFoundException(`Employee ${id} not found.`);
  await this.prisma.user.update({ where: { id }, data: { isActive: true } });
  await this.audit.record({
    actorUserId: actor.id,
    action: 'EMPLOYEE_REACTIVATED',
    resource: 'User',
    details: { userId: id, reason },
  });
  return { reactivated: true };
}
```

- [ ] **Step 2: Add controller routes with a reason DTO**

In `employees.dto.ts`:

```ts
export class EmploymentStatusDto {
  @ApiProperty({ example: 'Resigned' })
  @IsString()
  @Length(3, 300)
  reason: string;
}
```

```ts
@Post(':id/deactivate')
@UseGuards(RolesGuard)
@Roles(UserRole.HR_ADMIN, UserRole.SUPER_ADMIN)
async deactivate(
  @Param('id') id: string,
  @Body() dto: EmploymentStatusDto,
  @CurrentUser() actor: AuthenticatedUser,
) {
  return this.employeesService.deactivate(id, dto.reason, actor);
}

@Post(':id/reactivate')
@UseGuards(RolesGuard)
@Roles(UserRole.HR_ADMIN, UserRole.SUPER_ADMIN)
async reactivate(
  @Param('id') id: string,
  @Body() dto: EmploymentStatusDto,
  @CurrentUser() actor: AuthenticatedUser,
) {
  return this.employeesService.reactivate(id, dto.reason, actor);
}
```

- [ ] **Step 3: Add e2e coverage (EMP-07, EMP-08, EMP-09)**

```ts
  it('EMP-07: deactivation blocks sign-in, revokes tokens, and hides the person', async () => {
    const employee = await createUser(testPrisma, {
      email: 'leave@macqhr.sa',
      employeeId: 'EMP-L',
    });
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'leave@macqhr.sa', password: TEST_PASSWORD });
    const token = login.body.accessToken;

    await request(app.getHttpServer())
      .post(`/api/employees/${employee.id}/deactivate`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ reason: 'Resigned' })
      .expect(201);

    await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'leave@macqhr.sa', password: TEST_PASSWORD })
      .expect(401);

    const directory = await request(app.getHttpServer())
      .get('/api/directory')
      .set('Authorization', `Bearer ${hrToken}`)
      .expect(200);
    expect(directory.body.every((item: any) => item.email !== 'leave@macqhr.sa')).toBe(true);
  });

  it('EMP-08: refuses to deactivate the last active Super Admin', async () => {
    const superAdmin = await createUser(testPrisma, {
      email: 'owner@macqhr.sa',
      employeeId: 'EMP-OWNER',
      role: 'SUPER_ADMIN',
    });
    const login = await request(app.getHttpServer())
      .post('/api/auth/admin/login')
      .send({ email: 'owner@macqhr.sa', password: TEST_PASSWORD });

    // The fixture database is truncated per test, so this owner is the only active Super Admin.
    await request(app.getHttpServer())
      .post(`/api/employees/${superAdmin.id}/deactivate`)
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .send({ reason: 'Test' })
      .expect(409);
  });

  it('EMP-09: rejects self-management and cycles', async () => {
    const a = await createUser(testPrisma, { email: 'a@x.sa', employeeId: 'EMP-A1' });
    const b = await createUser(testPrisma, { email: 'b@x.sa', employeeId: 'EMP-B1' });

    await request(app.getHttpServer())
      .post(`/api/employees/${a.id}/changes`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        type: 'MANAGER',
        effectiveDate: new Date().toISOString().slice(0, 10),
        reason: 'Self',
        managerId: a.id,
      })
      .expect(400);

    await request(app.getHttpServer())
      .post(`/api/employees/${b.id}/changes`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        type: 'MANAGER',
        effectiveDate: new Date().toISOString().slice(0, 10),
        reason: 'B reports to A',
        managerId: a.id,
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/employees/${a.id}/changes`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        type: 'MANAGER',
        effectiveDate: new Date().toISOString().slice(0, 10),
        reason: 'Cycle',
        managerId: b.id,
      })
      .expect(400);
  });

  it('EMP-03: a new hire lands only in their own manager queue', async () => {
    const managerA = await createUser(testPrisma, {
      email: 'manager.a@macqhr.sa',
      employeeId: 'EMP-MA',
      role: 'MANAGER',
    });
    await createUser(testPrisma, {
      email: 'manager.b@macqhr.sa',
      employeeId: 'EMP-MB',
      role: 'MANAGER',
    });
    const hire = await createUser(testPrisma, {
      email: 'hire@macqhr.sa',
      employeeId: 'EMP-HIRE',
      managerId: managerA.id,
    });

    const hireLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'hire@macqhr.sa', password: TEST_PASSWORD })
      .expect(201);
    await request(app.getHttpServer())
      .post('/api/leaves/request')
      .set('Authorization', `Bearer ${hireLogin.body.accessToken}`)
      .send({
        type: 'ANNUAL',
        startDate: '2026-12-01',
        endDate: '2026-12-03',
        reason: 'Family trip',
      })
      .expect(201);

    const managerALogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'manager.a@macqhr.sa', password: TEST_PASSWORD })
      .expect(201);
    const queueA = await request(app.getHttpServer())
      .get('/api/leaves/pending')
      .set('Authorization', `Bearer ${managerALogin.body.accessToken}`)
      .expect(200);
    expect(queueA.body.some((item: any) => item.userId === hire.id)).toBe(true);

    const managerBLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'manager.b@macqhr.sa', password: TEST_PASSWORD })
      .expect(201);
    const queueB = await request(app.getHttpServer())
      .get('/api/leaves/pending')
      .set('Authorization', `Bearer ${managerBLogin.body.accessToken}`)
      .expect(200);
    expect(queueB.body.some((item: any) => item.userId === hire.id)).toBe(false);
  });
```

The fixture user has no `LeaveBalance` row, and `submitRequest` only checks a balance when one exists, so the request is accepted without seeding balances.

Note on EMP-08: `createUser` creates a SUPER_ADMIN while the HR fixture is HR_ADMIN, so the owner is the only active Super Admin. The HR token in the fixture is not a Super Admin token; use a Super Admin login or rely on the existing HR token — `assertSuperAdminRetained` only counts Super Admins. Use the HR token that is already in scope if simpler.

- [ ] **Step 4: Run and commit**

Run: `cd backend && npm run test:e2e`

```bash
git add backend/src/modules/employees backend/test/employees.e2e-spec.ts
git commit -m "feat(employees): deactivate with safeguards and session revocation"
```

---

### Task 8: Admin-initiated password reset

**Files:**
- Modify: `backend/src/modules/employees/employees.service.ts`, `employees.controller.ts`
- Modify: `backend/test/employees.e2e-spec.ts`

**Interfaces:**
- Produces: `POST /api/employees/:id/reset-password` → `{ temporaryPassword }`
- Consumes: `generateTemporaryPassword`, `SessionService.revokeAllForUser`

- [ ] **Step 1: Implement**

```ts
async resetPassword(id: string, actor: AuthenticatedUser) {
  await this.ensureEmployeeExists(id);
  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await bcrypt.hash(temporaryPassword, 10);
  await this.prisma.user.update({
    where: { id },
    data: {
      passwordHash,
      mustChangePassword: true,
      passwordChangedAt: null,
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
  });
  await this.sessionService.revokeAllForUser(id, 'ADMIN_REVOKE');
  await this.audit.record({
    actorUserId: actor.id,
    action: 'EMPLOYEE_PASSWORD_RESET',
    resource: 'User',
    details: { userId: id },
  });
  return { temporaryPassword };
}
```

- [ ] **Step 2: Route**

```ts
@Post(':id/reset-password')
@UseGuards(RolesGuard)
@Roles(UserRole.HR_ADMIN, UserRole.SUPER_ADMIN)
async resetPassword(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
  return this.employeesService.resetPassword(id, actor);
}
```

- [ ] **Step 3: e2e (EMP-10)**

```ts
  it('EMP-10: resetting a password revokes sessions and forces a change', async () => {
    const employee = await createUser(testPrisma, {
      email: 'reset@macqhr.sa',
      employeeId: 'EMP-RESET',
    });
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'reset@macqhr.sa', password: TEST_PASSWORD });
    const token = login.body.accessToken;

    const reset = await request(app.getHttpServer())
      .post(`/api/employees/${employee.id}/reset-password`)
      .set('Authorization', `Bearer ${hrToken}`)
      .expect(201);

    await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);

    const relogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'reset@macqhr.sa', password: reset.body.temporaryPassword })
      .expect(201);
    expect(relogin.body.user.mustChangePassword).toBe(true);

    const audit = await testPrisma.auditLog.findFirst({
      where: { action: 'EMPLOYEE_PASSWORD_RESET' },
    });
    expect(audit).toBeTruthy();
  });
```

- [ ] **Step 4: Run and commit**

Run: `cd backend && npm run test:e2e`

```bash
git add backend/src/modules/employees backend/test/employees.e2e-spec.ts
git commit -m "feat(employees): add audited temporary-password reset"
```

---

### Task 9: Admin API client and employee form logic

**Files:**
- Create: `web-admin/src/api/employeesApi.ts`
- Create: `web-admin/src/services/employeeForm.ts`, `web-admin/src/__tests__/employeeForm.test.ts`
- Modify: `web-admin/src/data/mockAdminData.ts`, `web-admin/src/api/client.ts`

**Interfaces:**
- Produces: `fetchEmployees(query)`, `createEmployee(payload)`, `updateEmployee(id, payload)`, `applyEmploymentChange(id, payload)`, `deactivateEmployee(id, reason)`, `reactivateEmployee(id, reason)`, `resetEmployeePassword(id)`
- Produces: `validateEmployeeDraft(draft): Record<string, string>`, `toCreateEmployeePayload(draft)`, `employeeStatusLabel(employee, isArabic)`
- Consumes: `apiClient`

- [ ] **Step 1: Extend the admin types**

In `mockAdminData.ts`, add to `AdminEmployee`:

```ts
  branchId?: string | null;
  managerId?: string | null;
  managerName?: string | null;
  isActive?: boolean;
  isRemoteAllowed?: boolean;
  mustChangePassword?: boolean;
```

Change `status` to `'ACTIVE' | 'REMOTE' | 'INACTIVE'`.

- [ ] **Step 2: Add the API module**

```ts
import { apiClient } from './client';

export interface EmployeeListQuery {
  search?: string;
  department?: string;
  branchId?: string;
  status?: 'ACTIVE' | 'INACTIVE' | 'ALL';
  sort?: 'employeeId' | 'name' | 'department' | 'status';
  direction?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

export interface EmployeeApiRecord {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  department: string;
  jobTitle: string;
  role: string;
  isSaudi: boolean;
  isActive: boolean;
  nationalId: string | null;
  iqamaNumber: string | null;
  basicSalarySar: number;
  housingAllowanceSar: number;
  transportAllowanceSar: number;
  isRemoteAllowed: boolean;
  mustChangePassword: boolean;
  branch: { id: string; name: string; nameAr: string; code: string | null } | null;
  manager: { id: string; firstName: string; lastName: string } | null;
}

async function unwrap<T>(promise: Promise<{ data: T }>): Promise<T> {
  try {
    return (await promise).data;
  } catch (error: any) {
    const message = error?.response?.data?.message;
    throw new Error(Array.isArray(message) ? message.join(', ') : message || 'Request failed.');
  }
}

export function fetchEmployees(query: EmployeeListQuery) {
  return unwrap(apiClient.get('/employees/admin', { params: query }));
}

export function createEmployee(payload: Record<string, unknown>) {
  return unwrap<{ employee: EmployeeApiRecord; temporaryPassword: string }>(
    apiClient.post('/employees', payload),
  );
}

export function updateEmployee(id: string, payload: Record<string, unknown>) {
  return unwrap<EmployeeApiRecord>(apiClient.patch(`/employees/${id}`, payload));
}

export function applyEmploymentChange(id: string, payload: Record<string, unknown>) {
  return unwrap(apiClient.post(`/employees/${id}/changes`, payload));
}

export function deactivateEmployee(id: string, reason: string) {
  return unwrap(apiClient.post(`/employees/${id}/deactivate`, { reason }));
}

export function reactivateEmployee(id: string, reason: string) {
  return unwrap(apiClient.post(`/employees/${id}/reactivate`, { reason }));
}

export function resetEmployeePassword(id: string) {
  return unwrap<{ temporaryPassword: string }>(apiClient.post(`/employees/${id}/reset-password`));
}
```

- [ ] **Step 3: Add pure form helpers with failing tests**

`web-admin/src/services/employeeForm.ts`:

```ts
export interface EmployeeDraft {
  employeeId: string;
  email: string;
  firstName: string;
  lastName: string;
  department: string;
  jobTitle: string;
  role: 'EMPLOYEE' | 'MANAGER' | 'HR_ADMIN' | 'SUPER_ADMIN';
  isSaudi: boolean;
  basicSalarySar: string;
  housingAllowanceSar: string;
  transportAllowanceSar: string;
  branchId: string;
  managerId: string;
}

export function validateEmployeeDraft(draft: EmployeeDraft): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!draft.employeeId.trim()) errors.employeeId = 'Employee ID is required.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email.trim())) {
    errors.email = 'Enter a valid work email.';
  }
  if (!draft.firstName.trim()) errors.firstName = 'First name is required.';
  if (!draft.lastName.trim()) errors.lastName = 'Last name is required.';
  if (!draft.department.trim()) errors.department = 'Department is required.';
  if (!draft.jobTitle.trim()) errors.jobTitle = 'Job title is required.';
  if (!(Number(draft.basicSalarySar) >= 0) || draft.basicSalarySar.trim() === '') {
    errors.basicSalarySar = 'Basic salary must be zero or more.';
  }
  return errors;
}

export function toCreateEmployeePayload(draft: EmployeeDraft) {
  return {
    employeeId: draft.employeeId.trim(),
    email: draft.email.trim().toLowerCase(),
    firstName: draft.firstName.trim(),
    lastName: draft.lastName.trim(),
    department: draft.department.trim(),
    jobTitle: draft.jobTitle.trim(),
    role: draft.role,
    isSaudi: draft.isSaudi,
    basicSalarySar: Number(draft.basicSalarySar),
    housingAllowanceSar: Number(draft.housingAllowanceSar || 0),
    transportAllowanceSar: Number(draft.transportAllowanceSar || 0),
    branchId: draft.branchId || undefined,
    managerId: draft.managerId || undefined,
  };
}
```

`web-admin/src/__tests__/employeeForm.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  toCreateEmployeePayload,
  validateEmployeeDraft,
  type EmployeeDraft,
} from '../services/employeeForm';

const draft: EmployeeDraft = {
  employeeId: 'EMP-900',
  email: 'New.Hire@MacqHR.sa',
  firstName: 'New',
  lastName: 'Hire',
  department: 'Engineering',
  jobTitle: 'Engineer',
  role: 'EMPLOYEE',
  isSaudi: true,
  basicSalarySar: '12000',
  housingAllowanceSar: '2500',
  transportAllowanceSar: '1000',
  branchId: 'branch-1',
  managerId: '',
};

describe('employee form', () => {
  it('accepts a complete draft', () => {
    expect(validateEmployeeDraft(draft)).toEqual({});
  });

  it('flags missing identity and invalid salary', () => {
    const errors = validateEmployeeDraft({
      ...draft,
      employeeId: ' ',
      email: 'nope',
      basicSalarySar: '-1',
    });
    expect(errors.employeeId).toBeTruthy();
    expect(errors.email).toBeTruthy();
    expect(errors.basicSalarySar).toBeTruthy();
  });

  it('normalises email and omits empty relations', () => {
    const payload = toCreateEmployeePayload(draft);
    expect(payload.email).toBe('new.hire@macqhr.sa');
    expect(payload.managerId).toBeUndefined();
    expect(payload.basicSalarySar).toBe(12000);
  });
});
```

Run: `cd web-admin && npm test`
Expected: PASS after the helper exists; write the test first to see it fail if following strict TDD.

- [ ] **Step 4: Update the portal loader for the paginated shape**

In `client.ts`, change the employees request to:

```ts
apiClient.get<{ items: RawEmployee[] }>('/employees/admin', {
  params: { status: 'ACTIVE', pageSize: 100 },
}),
```

and map `employeesResponse.data.items`. Add `branch.id`, `manager.id`, `isActive`, `mustChangePassword` to `RawEmployee` and `mapEmployee`, including:

```ts
    status: !employee.isActive ? 'INACTIVE' : employee.isRemoteAllowed ? 'REMOTE' : 'ACTIVE',
    branchId: employee.branch?.id ?? null,
    managerId: employee.manager?.id ?? null,
    managerName: employee.manager ? `${employee.manager.firstName} ${employee.manager.lastName}` : null,
    isRemoteAllowed: employee.isRemoteAllowed,
    mustChangePassword: employee.mustChangePassword,
```

- [ ] **Step 5: Commit**

```bash
git add web-admin/src
git commit -m "feat(admin): add employee API client and validated form helpers"
```

---

### Task 10: Admin employee management UI

**Files:**
- Modify: `web-admin/src/components/EmployeesView.tsx` (rewrite)
- Create: `web-admin/src/components/EmployeeFormDrawer.tsx`, `EmploymentChangeDrawer.tsx`, `DeactivateEmployeeDialog.tsx`, `TemporaryPasswordModal.tsx`
- Modify: `web-admin/src/App.tsx`

**Interfaces:**
- Consumes: `employeesApi` functions, `employeeForm` helpers, `AdminEmployee`
- Produces: `<EmployeesView isArabic branches={AdminBranch[]} onChanged={() => Promise<void>} />`

- [ ] **Step 1: Rewrite the list view**

`EmployeesView` owns its data:

- state: `query` (`search, department, branchId, status, sort, direction, page, pageSize`), `rows: AdminEmployee[]`, `total`, `loading`, `error`, `selected`, `drawer` (`'create' | 'edit' | 'change' | 'deactivate' | null`), `temporaryPassword`.
- effect: on query change, `fetchEmployees(query)`; map records with the existing `mapEmployee` shape (export it from `client.ts` or duplicate a small `toAdminEmployee` mapper in the view).
- toolbar: search input (debounced 300 ms), department dropdown from rows, branch dropdown passed from `portalData.branches` via a new prop `branches`, status select, sort select, page size.
- table columns: employee (name/email/ID), department, branch, role, status badge, remote badge, salary, actions menu.
- actions: Edit profile, Transfer / promote / salary / role / manager / remote (opens change drawer with a type select), Deactivate/Reactivate, Reset password.
- pagination footer with `Page X of Y` and previous/next buttons.
- empty and loading states using the existing skeleton/table patterns.
- RTL: mirror paddings with the existing `rtl:` classes; Arabic labels inline.
- dark mode: reuse `dark:` classes already present in the file.

Update `App.tsx`:

```tsx
{currentTab === 'employees' && (
  <EmployeesView
    isArabic={isArabic}
    branches={portalData.branches}
    onChanged={refreshPortalData}
  />
)}
```

Remove the `employees` prop.

- [ ] **Step 2: Create the drawers**

`EmployeeFormDrawer.tsx`
- Props: `mode: 'create' | 'edit'`, `employee?: AdminEmployee`, `branches`, `managers`, `isArabic`, `onClose`, `onSaved`.
- Fields: employee ID (disabled in edit), email (disabled in edit), names, department, job title, role (HR only), Saudi/Iqama, salaries, branch, manager, remote eligibility toggle (create only; edits use the change drawer).
- Uses `validateEmployeeDraft` before submit; shows per-field errors.
- Create calls `createEmployee` then shows `TemporaryPasswordModal` with the returned password and a copy button.
- Edit calls `updateEmployee` with basic fields only.

`EmploymentChangeDrawer.tsx`
- Props: `employee`, `isArabic`, `onClose`, `onApplied`.
- Type select: Transfer, Promotion, Salary, Role, Manager, Remote eligibility.
- Shared fields: effective date (`max={today}`), reason (required).
- Conditional fields per type, matching the DTO exactly. Never sends fields for another type.
- Calls `applyEmploymentChange`; on success closes and refreshes.

`DeactivateEmployeeDialog.tsx`
- Reason input (required), warning copy that pending leave requests will be cancelled and sessions revoked.
- Calls `deactivateEmployee` or `reactivateEmployee`.

`TemporaryPasswordModal.tsx`
- Displays the password once, a copy button, and a warning: "This is shown once. Ask the employee to change it after signing in."
- Never re-fetches or stores it.

- [ ] **Step 3: Verify the build**

Run: `cd web-admin && npm run build`
Expected: build passes; no unused imports.

- [ ] **Step 4: Manual smoke against the local API**

Start the backend and admin, sign in as HR, and check: create employee → temporary password shown once → sign in on mobile with it → forced change screen; edit title; transfer branch; deactivate → disappears from the active list and directory; reactivate; reset password.

- [ ] **Step 5: Commit**

```bash
git add web-admin/src
git commit -m "feat(admin): manage the employee lifecycle from the console"
```

---

### Task 11: Verification and G2 evidence preparation

**Files:**
- Modify: `SPRINT_PLAN.md`, `docs/prd/README.md` (M3 status note)

- [ ] **Step 1: Run the full gate**

Run: `npm run verify:all`
Expected: mobile typecheck + tests, backend typecheck + unit + build + e2e, admin tests + build. Zero failures.

- [ ] **Step 2: Record evidence**

Add a `## Phase 7 implementation` table to `SPRINT_PLAN.md` covering M2.1–M2.8 and M3.1–M3.7 with the test names that prove each one. Leave the G2 gate unchecked until the manual checklist and signature.

- [ ] **Step 3: Prepare the manual checklist**

Use the G2 row in `docs/prd/test-plan.md`: AUTH-01, AUTH-03, AUTH-06, AUTH-10, EMP-01, EMP-03, EMP-07, INT-01 as P0, and AUTH-02, AUTH-04, AUTH-05, AUTH-09, EMP-02, EMP-04, EMP-05, EMP-06, EMP-08, EMP-09 as the P1 pass list. Record INT-01 as "disabled path verified; enabled path blocked on Entra tenant credentials" in the gate limitations.

- [ ] **Step 4: Commit**

```bash
git add SPRINT_PLAN.md docs/prd/README.md
git commit -m "docs: record Phase 7B implementation and M3 evidence"
```

## Self-review notes

- M3.1 list/search/filter/sort/pagination → Task 3 and Task 10.
- M3.2 create + temporary credential + balances → Task 4.
- M3.3 edit profile → Task 5; salary/role/manager/branch/remote edits deliberately go through the ledger (Task 6) so every change is dated and audited.
- M3.4 transfer/promotion with effective date and audit → Task 6.
- M3.5 deactivate/reactivate with reason, removal from directory/queues, preserved history → Task 7.
- M3.6 no self-manager, no cycles, last Super Admin, pending-approval warning → Task 2 and Task 7. The "warning when a manager with pending approvals is deactivated" is surfaced by the dialog copy and the `pendingApprovalsFor` helper; wire it into the dialog response if you want a hard number in the confirm text.
- M3.7 admin password reset with forced change → Task 8.
- EMP-03 (manager queue) is covered by the Task 7 e2e case: a new hire reports to Manager A, their leave request appears in A's `/leaves/pending` queue and not in Manager B's.
