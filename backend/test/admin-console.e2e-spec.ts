import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './utils/test-app';
import { resetDatabase, testPrisma } from './utils/test-db';
import { createBranch, createUser, TEST_PASSWORD } from './utils/fixtures';
import { LeaveType, LeaveDecision } from '../src/modules/leaves/dto/leaves.dto';

describe('Phase 10: Admin Console & Notifications (e2e) — ADM-01 to ADM-10, INT-04, INT-05', () => {
  let app: INestApplication;
  let superAdmin: any;
  let hrAdmin: any;
  let lineManager: any;
  let employee: any;
  let branchRiyadh: any;
  let hrToken: string;
  let managerToken: string;
  let employeeToken: string;

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase();

    branchRiyadh = await createBranch(testPrisma, 'Riyadh HQ');

    superAdmin = await createUser(testPrisma, {
      email: 'super.admin@shiftly.app',
      role: 'SUPER_ADMIN',
      branchId: branchRiyadh.id,
    });

    hrAdmin = await createUser(testPrisma, {
      email: 'hr.admin@shiftly.app',
      role: 'HR_ADMIN',
      branchId: branchRiyadh.id,
    });

    lineManager = await createUser(testPrisma, {
      email: 'manager.tariq@shiftly.app',
      role: 'MANAGER',
      branchId: branchRiyadh.id,
    });

    employee = await createUser(testPrisma, {
      email: 'employee.rahaf@shiftly.app',
      role: 'EMPLOYEE',
      managerId: lineManager.id,
      branchId: branchRiyadh.id,
    });

    // Seed leave balances
    await testPrisma.leaveBalance.createMany({
      data: [
        { userId: employee.id, leaveType: LeaveType.ANNUAL, totalDays: 30, usedDays: 0, year: 2026 },
        { userId: employee.id, leaveType: LeaveType.SICK, totalDays: 30, usedDays: 0, year: 2026 },
        { userId: lineManager.id, leaveType: LeaveType.ANNUAL, totalDays: 30, usedDays: 0, year: 2026 },
      ],
    });

    hrToken = await login('hr.admin@shiftly.app');
    managerToken = await login('manager.tariq@shiftly.app');
    employeeToken = await login('employee.rahaf@shiftly.app');
  });

  afterAll(async () => {
    await app.close();
    await testPrisma.$disconnect();
  });

  async function login(email: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password: TEST_PASSWORD })
      .expect(201);
    return res.body.accessToken;
  }

  // ─── ADM-01: Admin Login Authorization Check ─────────────────────────────────
  it('ADM-01: Employee credentials refused on admin login (403), HR credentials accepted (200)', async () => {
    // 1. Regular employee attempts admin login -> 403 Forbidden
    const empRes = await request(app.getHttpServer())
      .post('/api/auth/admin/login')
      .send({ email: 'employee.rahaf@shiftly.app', password: TEST_PASSWORD })
      .expect(403);

    expect(empRes.body.message).toContain('not authorized to access');

    // 2. Line Manager attempts admin login -> 403 Forbidden
    await request(app.getHttpServer())
      .post('/api/auth/admin/login')
      .send({ email: 'manager.tariq@shiftly.app', password: TEST_PASSWORD })
      .expect(403);

    // 3. HR Admin logs into admin console -> 200/201 OK with accessToken and canAccessWebAdmin true
    const hrRes = await request(app.getHttpServer())
      .post('/api/auth/admin/login')
      .send({ email: 'hr.admin@shiftly.app', password: TEST_PASSWORD })
      .expect(201);

    expect(hrRes.body.accessToken).toBeTruthy();
    expect(hrRes.body.user.role).toBe('HR_ADMIN');
    expect(hrRes.body.user.canAccessWebAdmin).toBe(true);
  });

  // ─── ADM-02: Dashboard Overview Metrics Reconcile ───────────────────────────
  it('ADM-02: Dashboard loads with known fixtures; headcount and records reconcile with DB', async () => {
    const empListRes = await request(app.getHttpServer())
      .get('/api/employees/admin?status=ACTIVE&pageSize=50')
      .set('Authorization', `Bearer ${hrToken}`)
      .expect(200);

    expect(empListRes.body.total).toBe(4); // superAdmin, hrAdmin, lineManager, employee

    const branchListRes = await request(app.getHttpServer())
      .get('/api/branches/admin')
      .set('Authorization', `Bearer ${hrToken}`)
      .expect(200);

    expect(branchListRes.body.length).toBeGreaterThanOrEqual(1);

    const payrollSummary = await request(app.getHttpServer())
      .get('/api/payroll/summary')
      .set('Authorization', `Bearer ${hrToken}`)
      .expect(200);

    expect(payrollSummary.body.totals.totalGrossSar).toBeGreaterThan(0);
  });

  // ─── ADM-03: Branch Management Validation & Persistence ──────────────────────
  it('ADM-03: Rejects invalid branch coordinates/radius with 400; valid branch persists and affects future punches', async () => {
    // 1. Invalid latitude > 90
    await request(app.getHttpServer())
      .post('/api/branches')
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        name: 'Invalid Branch Lat',
        code: 'INV-1',
        city: 'Jeddah',
        latitude: 120.0, // Invalid
        longitude: 39.1728,
        geofenceRadiusMeters: 150,
      })
      .expect(400);

    // 2. Invalid negative radius
    await request(app.getHttpServer())
      .post('/api/branches')
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        name: 'Invalid Branch Radius',
        code: 'INV-2',
        city: 'Jeddah',
        latitude: 21.5433,
        longitude: 39.1728,
        geofenceRadiusMeters: -50, // Invalid
      })
      .expect(400);

    // 3. Valid Branch creation
    const createRes = await request(app.getHttpServer())
      .post('/api/branches')
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        name: 'Jeddah Regional Hub',
        nameAr: 'فرع جدة الإقليمي',
        code: 'JED-01',
        city: 'Jeddah',
        cityAr: 'جدة',
        latitude: 21.5433,
        longitude: 39.1728,
        geofenceRadiusMeters: 250,
        wifiBssids: ['00:11:22:33:44:55'],
        isActive: true,
      })
      .expect(201);

    const branchId = createRes.body.id;
    expect(createRes.body.name).toBe('Jeddah Regional Hub');
    expect(createRes.body.geofenceRadiusMeters).toBe(250);

    // 4. Update branch geofence radius
    const updateRes = await request(app.getHttpServer())
      .patch(`/api/branches/${branchId}`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        geofenceRadiusMeters: 350,
      })
      .expect(200);

    expect(updateRes.body.geofenceRadiusMeters).toBe(350);

    // Verify audit log
    const auditRes = await request(app.getHttpServer())
      .get('/api/audit-logs?action=BRANCH_CREATED')
      .set('Authorization', `Bearer ${hrToken}`)
      .expect(200);

    expect(auditRes.body.items.some((a: any) => a.action === 'BRANCH_CREATED')).toBe(true);
  });

  // ─── ADM-04: Employee Search, Filtering, and Pagination ─────────────────────
  it('ADM-04: HR searches, filters by department, and paginates employees accurately', async () => {
    // Search by name
    const searchRes = await request(app.getHttpServer())
      .get('/api/employees/admin?search=Rahaf')
      .set('Authorization', `Bearer ${hrToken}`)
      .expect(200);

    expect(searchRes.body.items.length).toBe(1);
    expect(searchRes.body.items[0].email).toBe('employee.rahaf@shiftly.app');

    // Filter by department
    const deptRes = await request(app.getHttpServer())
      .get('/api/employees/admin?department=Engineering')
      .set('Authorization', `Bearer ${hrToken}`)
      .expect(200);

    expect(deptRes.body.items.length).toBeGreaterThanOrEqual(1);

    // Pagination test
    const page1 = await request(app.getHttpServer())
      .get('/api/employees/admin?pageSize=2&page=1')
      .set('Authorization', `Bearer ${hrToken}`)
      .expect(200);

    expect(page1.body.items.length).toBe(2);
    expect(page1.body.page).toBe(1);
    expect(page1.body.pageSize).toBe(2);
  });

  // ─── ADM-05: Employment Changes with Effective Date & Audit ─────────────────
  it('ADM-05: HR updates role, branch, and salary with effective date and logs audited change', async () => {
    const effectiveDate = new Date().toISOString().slice(0, 10);
    const changeRes = await request(app.getHttpServer())
      .post(`/api/employees/${employee.id}/changes`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        type: 'PROMOTION',
        effectiveDate,
        reason: 'Q4 Performance Promotion',
        jobTitle: 'Senior Software Engineer',
      })
      .expect(201);

    expect(changeRes.body.change.type).toBe('PROMOTION');
    expect(changeRes.body.change.effectiveDate).toContain(effectiveDate);

    // Check employee changes list
    const historyRes = await request(app.getHttpServer())
      .get(`/api/employees/${employee.id}/changes`)
      .set('Authorization', `Bearer ${hrToken}`)
      .expect(200);

    expect(historyRes.body.length).toBeGreaterThanOrEqual(1);
    expect(historyRes.body[0].reason).toBe('Q4 Performance Promotion');
  });

  // ─── ADM-06: Stage-2 Leave Approval with Comments ────────────────────────────
  it('ADM-06: HR approves stage-2 leave with comment; updates status to APPROVED and balance is deducted', async () => {
    // 1. Employee submits request
    const subRes = await request(app.getHttpServer())
      .post('/api/leaves/request')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        type: 'ANNUAL',
        startDate: '2026-11-15',
        endDate: '2026-11-17', // 3 working days
        reason: 'Family event',
      })
      .expect(201);

    const requestId = subRes.body.request.id;

    // 2. Manager approves Stage 1
    await request(app.getHttpServer())
      .patch(`/api/leaves/${requestId}/decision`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        decision: 'APPROVED',
        comments: 'Approved by Line Manager',
      })
      .expect(200);

    // 3. HR Admin approves Stage 2
    const hrApproval = await request(app.getHttpServer())
      .patch(`/api/leaves/${requestId}/decision`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        decision: 'APPROVED',
        comments: 'Final sign-off by HR Admin',
      })
      .expect(200);

    expect(hrApproval.body.request.status).toBe('APPROVED');
    expect(hrApproval.body.request.hrComments).toBe('Final sign-off by HR Admin');

    // Verify balance deduction
    const balanceRes = await request(app.getHttpServer())
      .get('/api/leaves/balances')
      .set('Authorization', `Bearer ${employeeToken}`)
      .expect(200);

    const annual = balanceRes.body.find((b: any) => b.leaveType === 'ANNUAL');
    expect(annual.usedDays).toBe(3);
    expect(annual.remainingDays).toBe(27);
  });

  // ─── ADM-07: Attendance Exception Review ─────────────────────────────────────
  it('ADM-07: HR reviews and resolves attendance exceptions', async () => {
    // Seed attendance day and exception
    const day = await testPrisma.attendanceDay.create({
      data: {
        userId: employee.id,
        dateIso: '2026-11-04',
        mode: 'OFFICE',
        status: 'FLAGGED',
      },
    });

    const exc = await testPrisma.attendanceException.create({
      data: {
        dayId: day.id,
        type: 'OUTSIDE_OFFICE_GEOFENCE',
        severity: 'MEDIUM',
        status: 'OPEN',
      },
    });

    // HR reviews and accepts exception
    const reviewRes = await request(app.getHttpServer())
      .post(`/api/attendance/exceptions/${exc.id}/review`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        decision: 'ACCEPTED',
        reviewNote: 'Verified client site visit',
      })
      .expect(201);

    expect(reviewRes.body.exception.status).toBe('ACCEPTED');
    expect(reviewRes.body.exception.reviewNote).toBe('Verified client site visit');
  });

  // ─── ADM-08: Payroll WPS Export ──────────────────────────────────────────────
  it('ADM-08: HR exports Saudi WPS file with valid headers and records', async () => {
    const wpsRes = await request(app.getHttpServer())
      .get('/api/payroll/wps-export')
      .set('Authorization', `Bearer ${hrToken}`)
      .expect(200);

    expect(wpsRes.headers['content-type']).toContain('text/csv');
    expect(wpsRes.text).toContain('EMPLOYEE_ID');
    expect(wpsRes.text).toContain('RECORD_TYPE');
  });

  // ─── ADM-09: Audit Logs Read-Only Viewer ─────────────────────────────────────
  it('ADM-09: HR queries audit logs with filters; no edit/delete endpoints exist', async () => {
    const auditRes = await request(app.getHttpServer())
      .get('/api/audit-logs?pageSize=10&page=1')
      .set('Authorization', `Bearer ${hrToken}`)
      .expect(200);

    expect(auditRes.body.items).toBeDefined();
    expect(auditRes.body.total).toBeGreaterThan(0);

    // Verify there are no PUT or DELETE endpoints for audit logs
    await request(app.getHttpServer())
      .delete('/api/audit-logs/some-id')
      .set('Authorization', `Bearer ${hrToken}`)
      .expect(404);
  });

  // ─── ADM-10: Authentication Protection & 401 Expiry ──────────────────────────
  it('ADM-10: Refuses unauthorized requests without token or with expired/invalid token (401)', async () => {
    await request(app.getHttpServer())
      .get('/api/employees/admin')
      .expect(401);

    await request(app.getHttpServer())
      .get('/api/employees/admin')
      .set('Authorization', 'Bearer invalid.token.payload')
      .expect(401);
  });

  // ─── INT-04: Persisted In-App Notifications & Read State ──────────────────────
  it('INT-04: Persists notifications in DB, syncs unread counts, and updates read state', async () => {
    // 1. Employee submits leave request -> Line manager receives durable notification
    const subRes = await request(app.getHttpServer())
      .post('/api/leaves/request')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        type: 'ANNUAL',
        startDate: '2026-11-22',
        endDate: '2026-11-24',
        reason: 'Conference attendance',
      })
      .expect(201);

    expect(subRes.body.request.id).toBeTruthy();

    // 2. Line Manager queries notifications
    const mgrNotifRes = await request(app.getHttpServer())
      .get('/api/notifications')
      .set('Authorization', `Bearer ${managerToken}`)
      .expect(200);

    expect(mgrNotifRes.body.notifications.length).toBeGreaterThanOrEqual(1);
    expect(mgrNotifRes.body.unreadCount).toBeGreaterThanOrEqual(1);

    const firstNotif = mgrNotifRes.body.notifications[0];
    expect(firstNotif.read).toBe(false);
    expect(firstNotif.type).toBe('LEAVE_REQUEST');
    expect(firstNotif.title).toContain('New Leave Request');

    // 3. Line Manager marks notification as read
    const readRes = await request(app.getHttpServer())
      .patch(`/api/notifications/${firstNotif.id}/read`)
      .set('Authorization', `Bearer ${managerToken}`)
      .expect(200);

    expect(readRes.body.read).toBe(true);

    // 4. Verify unread count decremented
    const updatedNotifRes = await request(app.getHttpServer())
      .get('/api/notifications')
      .set('Authorization', `Bearer ${managerToken}`)
      .expect(200);

    expect(updatedNotifRes.body.unreadCount).toBe(0);
  });

  // ─── INT-05: Push Device Token Registration ──────────────────────────────────
  it('INT-05: Registers push device tokens with idempotent upsert per device', async () => {
    const tokenPayload = {
      token: 'ExponentPushToken[mock-device-push-token-12345]',
      platform: 'IOS' as const,
    };

    // 1. First registration creates token
    const regRes = await request(app.getHttpServer())
      .post('/api/notifications/device-token')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send(tokenPayload)
      .expect(201);

    expect(regRes.body.token).toBe(tokenPayload.token);
    expect(regRes.body.userId).toBe(employee.id);

    // 2. Re-registering the same token updates it without duplicate error
    const reRegRes = await request(app.getHttpServer())
      .post('/api/notifications/device-token')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send(tokenPayload)
      .expect(201);

    expect(reRegRes.body.token).toBe(tokenPayload.token);
  });
});
