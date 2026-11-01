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
    expect(active.body.items).toHaveLength(2);
    expect(active.body.items.every((item: any) => item.isActive)).toBe(true);

    const all = await request(app.getHttpServer())
      .get('/api/employees/admin?status=ALL&search=EMP-B')
      .set('Authorization', `Bearer ${hrToken}`)
      .expect(200);
    expect(all.body.items).toHaveLength(1);
    expect(all.body.items[0].employeeId).toBe('EMP-B');
  });

  it('reports the filtered total across pages and never repeats a row', async () => {
    for (const suffix of ['A', 'B', 'C', 'D', 'E']) {
      await createUser(testPrisma, {
        email: `${suffix.toLowerCase()}@macqhr.sa`,
        employeeId: `EMP-${suffix}`,
      });
    }

    const page1 = await request(app.getHttpServer())
      .get('/api/employees/admin?status=ACTIVE&pageSize=2&page=1')
      .set('Authorization', `Bearer ${hrToken}`)
      .expect(200);
    const page2 = await request(app.getHttpServer())
      .get('/api/employees/admin?status=ACTIVE&pageSize=2&page=2')
      .set('Authorization', `Bearer ${hrToken}`)
      .expect(200);

    // HR + five employees: total is the filtered count, not the page length.
    expect(page1.body.total).toBe(6);
    expect(page2.body.total).toBe(6);
    expect(page1.body.page).toBe(1);
    expect(page2.body.page).toBe(2);
    expect(page1.body.pageSize).toBe(2);
    expect(page1.body.items).toHaveLength(2);
    expect(page2.body.items).toHaveLength(2);

    const ids = [...page1.body.items, ...page2.body.items].map((item: any) => item.id);
    expect(new Set(ids).size).toBe(4);
  });

  it('returns the documented envelope with default paging when called with no query', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/employees/admin')
      .set('Authorization', `Bearer ${hrToken}`)
      .expect(200);

    expect(Object.keys(res.body).sort()).toEqual(['items', 'page', 'pageSize', 'total']);
    expect(res.body.total).toBe(1); // HR fixture only
    expect(res.body.page).toBe(1);
    expect(res.body.pageSize).toBe(25);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].employeeId).toBe('EMP-HR');
  });

  it('rejects page sizes outside 1..100 and pages above 10000', async () => {
    for (const query of ['pageSize=0', 'pageSize=101', 'page=0', 'page=10001']) {
      await request(app.getHttpServer())
        .get(`/api/employees/admin?${query}`)
        .set('Authorization', `Bearer ${hrToken}`)
        .expect(400);
    }
  });

  it('ignores a whitespace-only search term', async () => {
    await createUser(testPrisma, { email: 'a@macqhr.sa', employeeId: 'EMP-A' });

    const res = await request(app.getHttpServer())
      .get('/api/employees/admin?search=%20')
      .set('Authorization', `Bearer ${hrToken}`)
      .expect(200);

    // A space matches nothing once trimmed, so the unfiltered set is returned.
    expect(res.body.total).toBe(2);
    expect(res.body.items).toHaveLength(2);
  });

  it('keeps tied names ordered across pages (sort=name)', async () => {
    const twinA = await createUser(testPrisma, {
      email: 'twin-a@macqhr.sa',
      employeeId: 'EMP-TWIN-A',
    });
    const twinB = await createUser(testPrisma, {
      email: 'twin-b@macqhr.sa',
      employeeId: 'EMP-TWIN-B',
    });
    for (const id of [twinA.id, twinB.id]) {
      await testPrisma.user.update({
        where: { id },
        data: { firstName: 'Sara', lastName: 'Al-Harbi' },
      });
    }

    const page1 = await request(app.getHttpServer())
      .get('/api/employees/admin?sort=name&pageSize=1&page=1')
      .set('Authorization', `Bearer ${hrToken}`)
      .expect(200);
    const page2 = await request(app.getHttpServer())
      .get('/api/employees/admin?sort=name&pageSize=1&page=2')
      .set('Authorization', `Bearer ${hrToken}`)
      .expect(200);

    expect(page1.body.items).toHaveLength(1);
    expect(page2.body.items).toHaveLength(1);

    const ids = [page1.body.items[0].id, page2.body.items[0].id];
    expect(new Set(ids).size).toBe(2);
    expect(ids.slice().sort()).toEqual([twinA.id, twinB.id].sort());
  });

  it('AUTH-09: employees and managers cannot read the admin list', async () => {
    await createUser(testPrisma, { email: 'emp@macqhr.sa', employeeId: 'EMP-E' });
    await createUser(testPrisma, {
      email: 'mgr@macqhr.sa',
      employeeId: 'EMP-M',
      role: 'MANAGER',
    });

    const employeeLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'emp@macqhr.sa', password: TEST_PASSWORD });
    await request(app.getHttpServer())
      .get('/api/employees/admin')
      .set('Authorization', `Bearer ${employeeLogin.body.accessToken}`)
      .expect(403);

    const managerLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'mgr@macqhr.sa', password: TEST_PASSWORD });
    await request(app.getHttpServer())
      .get('/api/employees/admin')
      .set('Authorization', `Bearer ${managerLogin.body.accessToken}`)
      .expect(403);
  });

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
    expect(conflict.body.message).not.toContain('other@macqhr.sa');

    const emailConflict = await request(app.getHttpServer())
      .post('/api/employees')
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ ...payload, employeeId: 'EMP-DUP-EMAIL' })
      .expect(409);
    expect(emailConflict.body.message).toContain('dup@macqhr.sa');
  });

  it('rejects duplicate leave types in the initial balances with a 400', async () => {
    await request(app.getHttpServer())
      .post('/api/employees')
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        employeeId: 'EMP-BAL',
        email: 'balances@macqhr.sa',
        firstName: 'Bal',
        lastName: 'Ance',
        isSaudi: true,
        department: 'Engineering',
        jobTitle: 'Engineer',
        role: 'EMPLOYEE',
        basicSalarySar: 9000,
        initialLeaveBalances: [
          { leaveType: 'ANNUAL', totalDays: 10 },
          { leaveType: 'ANNUAL', totalDays: 20 },
        ],
      })
      .expect(400);

    expect(
      await testPrisma.user.count({ where: { email: 'balances@macqhr.sa' } }),
    ).toBe(0);
  });

  it('forbids an HR admin from creating a super admin and creates no user', async () => {
    await request(app.getHttpServer())
      .post('/api/employees')
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        employeeId: 'EMP-SA',
        email: 'super.admin@macqhr.sa',
        firstName: 'Super',
        lastName: 'Admin',
        isSaudi: true,
        department: 'Engineering',
        jobTitle: 'Engineer',
        role: 'SUPER_ADMIN',
        basicSalarySar: 9000,
      })
      .expect(403);

    expect(
      await testPrisma.user.count({ where: { email: 'super.admin@macqhr.sa' } }),
    ).toBe(0);
  });

  it('rejects a non-existent or inactive manager with a 400', async () => {
    const base = {
      email: 'managed@macqhr.sa',
      firstName: 'Managed',
      lastName: 'Hire',
      isSaudi: true,
      department: 'Engineering',
      jobTitle: 'Engineer',
      role: 'EMPLOYEE',
      basicSalarySar: 9000,
    };

    await request(app.getHttpServer())
      .post('/api/employees')
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ ...base, employeeId: 'EMP-MISSING-MGR', managerId: 'missing-manager-id' })
      .expect(400);

    const inactiveManager = await createUser(testPrisma, {
      email: 'inactive.manager@macqhr.sa',
      employeeId: 'EMP-INACTIVE-MGR',
      role: 'MANAGER',
      isActive: false,
    });

    await request(app.getHttpServer())
      .post('/api/employees')
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ ...base, employeeId: 'EMP-INACTIVE-MGR-HIRE', managerId: inactiveManager.id })
      .expect(400);
  });

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
      .send({ employeeId: 'EMP-CHANGED' })
      .expect(400);
    // Salary, role, and activation are no longer profile fields.
    await request(app.getHttpServer())
      .patch(`/api/employees/${target.id}`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ basicSalarySar: 20000 })
      .expect(400);
    await request(app.getHttpServer())
      .patch(`/api/employees/${target.id}`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ role: 'SUPER_ADMIN' })
      .expect(400);
    await request(app.getHttpServer())
      .patch(`/api/employees/${target.id}`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ isActive: false })
      .expect(400);
    await request(app.getHttpServer())
      .patch(`/api/employees/${target.id}`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ jobTitle: 'Senior Engineer' })
      .expect(200);

    const persisted = await testPrisma.user.findUniqueOrThrow({
      where: { id: target.id },
    });
    expect(persisted.email).toBe('edit@macqhr.sa');
    expect(persisted.employeeId).toBe('EMP-EDIT');
    expect(persisted.basicSalarySar).toBe(10000);
    expect(persisted.role).toBe('EMPLOYEE');
    expect(persisted.isActive).toBe(true);
    expect(persisted.jobTitle).toBe('Senior Engineer');
  });

  it('audits a profile edit minimally and recomputes fullName', async () => {
    const target = await createUser(testPrisma, {
      email: 'audit.edit@macqhr.sa',
      employeeId: 'EMP-AUDIT-EDIT',
    });

    const res = await request(app.getHttpServer())
      .patch(`/api/employees/${target.id}`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ firstName: 'Noura', titleAr: 'مهندسة أولى' })
      .expect(200);

    expect(res.body.passwordHash).toBeUndefined();
    expect(res.body.email).toBe('audit.edit@macqhr.sa');
    expect(res.body.fullName).toBe('Noura Employee');
    expect(res.body.titleAr).toBe('مهندسة أولى');

    const logs = await testPrisma.auditLog.findMany({
      where: { action: 'EMPLOYEE_UPDATED', resource: 'User' },
    });
    expect(logs).toHaveLength(1);
    expect(logs[0].actorUserId).toBeTruthy();

    const details = logs[0].detailsJson as Record<string, unknown>;
    expect(details.employeeId).toBe('EMP-AUDIT-EDIT');
    expect(details.fields).toEqual(expect.arrayContaining(['firstName', 'titleAr']));

    // The audit entry carries field names, never the values or credentials.
    const serialized = JSON.stringify(details);
    expect(serialized).not.toContain('audit.edit@macqhr.sa');
    expect(serialized.toLowerCase()).not.toContain('password');
    expect(serialized.toLowerCase()).not.toContain('hash');
    expect(serialized).not.toContain('Noura');
  });

  it('EMP-06: promotion revokes sessions and the next login carries the new role', async () => {
    const employee = await createUser(testPrisma, {
      email: 'promote@macqhr.sa',
      employeeId: 'EMP-P',
    });
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'promote@macqhr.sa', password: TEST_PASSWORD })
      .expect(201);
    const token = login.body.accessToken;
    expect(typeof token).toBe('string');

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

    const change = await testPrisma.employmentChange.findFirstOrThrow({
      where: { userId: employee.id },
    });
    expect(change.type).toBe('ROLE');
    expect((change.beforeJson as Record<string, unknown>).role).toBe('EMPLOYEE');
    expect((change.afterJson as Record<string, unknown>).role).toBe('MANAGER');

    const ledger = await request(app.getHttpServer())
      .get(`/api/employees/${employee.id}/changes`)
      .set('Authorization', `Bearer ${hrToken}`)
      .expect(200);
    expect(ledger.body).toHaveLength(1);
    expect(ledger.body[0].id).toBe(change.id);
    expect(ledger.body[0].actor.firstName).toBe('Test');
  });

  it('EMP-05: remote eligibility is audited with the granting HR user', async () => {
    const employee = await createUser(testPrisma, {
      email: 'remote@macqhr.sa',
      employeeId: 'EMP-R',
    });
    const hr = await testPrisma.user.findUniqueOrThrow({
      where: { email: 'hr@macqhr.sa' },
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
    expect(updated.remoteGrantedById).toBe(hr.id);
    const audit = await testPrisma.auditLog.findFirst({
      where: { action: 'EMPLOYMENT_CHANGE_APPLIED' },
    });
    expect(audit).toBeTruthy();
    expect(audit!.actorUserId).toBe(hr.id);
    expect((audit!.detailsJson as Record<string, unknown>).userId).toBe(employee.id);
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
    expect(before.body.message).toMatch(/geofence/i);

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

  it('rejects an empty-string managerId and leaves the manager unchanged', async () => {
    const manager = await createUser(testPrisma, {
      email: 'manager@macqhr.sa',
      employeeId: 'EMP-MGR',
      role: 'MANAGER',
    });
    const employee = await createUser(testPrisma, {
      email: 'managed@macqhr.sa',
      employeeId: 'EMP-MGD',
      managerId: manager.id,
    });

    await request(app.getHttpServer())
      .post(`/api/employees/${employee.id}/changes`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        type: 'MANAGER',
        effectiveDate: new Date().toISOString().slice(0, 10),
        reason: 'Clear the manager',
        managerId: '',
      })
      .expect(400);

    const persisted = await testPrisma.user.findUniqueOrThrow({ where: { id: employee.id } });
    expect(persisted.managerId).toBe(manager.id);
    expect(
      await testPrisma.employmentChange.count({ where: { userId: employee.id } }),
    ).toBe(0);
  });
});
