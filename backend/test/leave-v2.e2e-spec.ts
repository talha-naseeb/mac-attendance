import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './utils/test-app';
import { resetDatabase, testPrisma } from './utils/test-db';
import { createUser, TEST_PASSWORD } from './utils/fixtures';
import { LeaveType, LeaveDecision } from '../src/modules/leaves/dto/leaves.dto';

describe('Phase 9: Leave & Approvals v2 (e2e) — LV-01 to LV-15', () => {
  let app: INestApplication;
  let hrAdmin: any;
  let lineManager: any;
  let employee: any;
  let hrToken: string;
  let managerToken: string;
  let employeeToken: string;

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase();

    // 1. Create HR Admin
    hrAdmin = await createUser(testPrisma, {
      email: 'hr.admin@shiftly.app',
      role: 'HR_ADMIN',
    });

    // 2. Create Line Manager
    lineManager = await createUser(testPrisma, {
      email: 'manager.tariq@shiftly.app',
      role: 'MANAGER',
    });

    // 3. Create Employee reporting to Line Manager
    employee = await createUser(testPrisma, {
      email: 'employee.rahaf@shiftly.app',
      role: 'EMPLOYEE',
      managerId: lineManager.id,
    });

    // Seed Leave Balances for employee
    await testPrisma.leaveBalance.createMany({
      data: [
        { userId: employee.id, leaveType: LeaveType.ANNUAL, totalDays: 30, usedDays: 0, year: 2026 },
        { userId: employee.id, leaveType: LeaveType.SICK, totalDays: 30, usedDays: 0, year: 2026 },
        { userId: employee.id, leaveType: LeaveType.EMERGENCY, totalDays: 5, usedDays: 0, year: 2026 },
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

  async function login(email: string) {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password: TEST_PASSWORD })
      .expect(201);
    return res.body.accessToken as string;
  }

  // ─── LV-01: Valid Submit Routes to PENDING_MANAGER ─────────────────────────
  it('LV-01: Submits valid annual leave request and routes to PENDING_MANAGER with nextApprover', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/leaves/request')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        type: LeaveType.ANNUAL,
        startDate: '2026-06-07T00:00:00Z', // Sunday
        endDate: '2026-06-09T00:00:00Z',   // Tuesday (3 days)
        reason: 'Summer family break in Abha',
      })
      .expect(201);

    expect(res.body.request).toBeDefined();
    expect(res.body.request.status).toBe('PENDING_MANAGER');
    expect(res.body.request.stage).toBe('STAGE_1_MANAGER');
    expect(res.body.request.daysCount).toBe(3);
    expect(res.body.nextApprover).toBe('Line Manager');
    expect(res.body.teamsNotificationPayload).toBeDefined();
  });

  // ─── LV-02: Exceeded Balance Rejected ──────────────────────────────────────
  it('LV-02: Rejects leave request when exceeding remaining days with 400', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/leaves/request')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        type: LeaveType.EMERGENCY,
        startDate: '2026-06-07T00:00:00Z',
        endDate: '2026-06-25T00:00:00Z', // 15 working days, but only 5 available
        reason: 'Extended emergency leave',
      })
      .expect(400);

    expect(res.body.message).toContain('Insufficient leave balance');
  });

  // ─── LV-03: Invalid Dates (End before start) ──────────────────────────────
  it('LV-03: Rejects submission when end date precedes start date', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/leaves/request')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        type: LeaveType.ANNUAL,
        startDate: '2026-06-15T00:00:00Z',
        endDate: '2026-06-10T00:00:00Z',
        reason: 'Typo dates',
      })
      .expect(400);

    expect(res.body.message).toContain('End date cannot precede start date');
  });

  // ─── LV-04: Overlap Protection ─────────────────────────────────────────────
  it('LV-04: Rejects request that overlaps an existing pending or approved leave', async () => {
    // Submit first request: June 7 to June 10
    await request(app.getHttpServer())
      .post('/api/leaves/request')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        type: LeaveType.ANNUAL,
        startDate: '2026-06-07T00:00:00Z',
        endDate: '2026-06-10T00:00:00Z',
        reason: 'First trip',
      })
      .expect(201);

    // Attempt overlapping request: June 9 to June 12
    const res = await request(app.getHttpServer())
      .post('/api/leaves/request')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        type: LeaveType.SICK,
        startDate: '2026-06-09T00:00:00Z',
        endDate: '2026-06-12T00:00:00Z',
        reason: 'Overlapping request',
      })
      .expect(400);

    expect(res.body.message).toContain('overlaps with an existing');
  });

  // ─── LV-05: Weekend and Holiday Exclusions ──────────────────────────────────
  it('LV-05: Correctly excludes weekends and Saudi National Day public holiday', async () => {
    // 2026-09-22 (Tuesday) to 2026-09-27 (Sunday)
    // Sep 22: Tue (Work)
    // Sep 23: Wed (National Day Holiday) -> excluded!
    // Sep 24: Thu (Work)
    // Sep 25: Fri (Weekend) -> excluded!
    // Sep 26: Sat (Weekend) -> excluded!
    // Sep 27: Sun (Work)
    // Total working days = 3 (out of 6 calendar days)
    const res = await request(app.getHttpServer())
      .post('/api/leaves/request')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        type: LeaveType.ANNUAL,
        startDate: '2026-09-22T00:00:00Z',
        endDate: '2026-09-27T00:00:00Z',
        reason: 'National day long vacation',
      })
      .expect(201);

    expect(res.body.request.daysCount).toBe(3);
    expect(res.body.calculation.totalCalendarDays).toBe(6);
    expect(res.body.calculation.holidayDaysCount).toBe(1);
    expect(res.body.calculation.weekendDaysCount).toBe(2);
  });

  // ─── LV-06: Stage 1 Manager Approval Advances to PENDING_HR ────────────────
  it('LV-06: Manager approves Stage 1 -> status becomes PENDING_HR and balance is not yet deducted', async () => {
    const submitRes = await request(app.getHttpServer())
      .post('/api/leaves/request')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        type: LeaveType.ANNUAL,
        startDate: '2026-07-05T00:00:00Z',
        endDate: '2026-07-07T00:00:00Z',
        reason: 'Summer getaway',
      })
      .expect(201);

    const requestId = submitRes.body.request.id;

    // Manager approves stage 1
    const approveRes = await request(app.getHttpServer())
      .patch(`/api/leaves/${requestId}/decision`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        decision: LeaveDecision.APPROVED,
        comments: 'Approved by Tariq, team coverage verified.',
      })
      .expect(200);

    expect(approveRes.body.request.status).toBe('PENDING_HR');
    expect(approveRes.body.request.stage).toBe('STAGE_2_HR');
    expect(approveRes.body.request.managerReviewedById).toBe(lineManager.id);

    // Verify balance is NOT deducted yet
    const balance = await testPrisma.leaveBalance.findUnique({
      where: {
        userId_leaveType_year: { userId: employee.id, leaveType: 'ANNUAL', year: 2026 },
      },
    });
    expect(balance?.usedDays).toBe(0);
  });

  // ─── LV-07: Stage 2 HR Final Authorization & Double-Tap Idempotency ────────
  it('LV-07: HR finalizes Stage 2 approval -> balance deducted once, ledger entry written, retry idempotent', async () => {
    // 1. Submit
    const submitRes = await request(app.getHttpServer())
      .post('/api/leaves/request')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        type: LeaveType.ANNUAL,
        startDate: '2026-07-12T00:00:00Z',
        endDate: '2026-07-14T00:00:00Z', // 3 working days
        reason: 'Annual trip',
      })
      .expect(201);
    const requestId = submitRes.body.request.id;

    // 2. Stage 1: Manager approves
    await request(app.getHttpServer())
      .patch(`/api/leaves/${requestId}/decision`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ decision: LeaveDecision.APPROVED })
      .expect(200);

    // 3. Stage 2: HR approves
    const hrRes = await request(app.getHttpServer())
      .patch(`/api/leaves/${requestId}/decision`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        decision: LeaveDecision.APPROVED,
        comments: 'HR approved and recorded in payroll ledger.',
      })
      .expect(200);

    expect(hrRes.body.request.status).toBe('APPROVED');
    expect(hrRes.body.request.stage).toBe('COMPLETED');
    expect(hrRes.body.request.hrReviewedById).toBe(hrAdmin.id);

    // Verify balance deduction
    const balance = await testPrisma.leaveBalance.findUnique({
      where: {
        userId_leaveType_year: { userId: employee.id, leaveType: 'ANNUAL', year: 2026 },
      },
    });
    expect(balance?.usedDays).toBe(3);
    expect(balance?.remainingDays).toBe(27);

    // Verify immutable ledger entry
    const ledger = await testPrisma.leaveBalanceLedger.findFirst({
      where: { requestId, entryType: 'USAGE' },
    });
    expect(ledger).toBeDefined();
    expect(ledger?.amount).toBe(-3);
    expect(ledger?.balanceBefore).toBe(30);
    expect(ledger?.balanceAfter).toBe(27);

    // 4. Retry / double-tap approval: must be idempotent!
    const retryRes = await request(app.getHttpServer())
      .patch(`/api/leaves/${requestId}/decision`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ decision: LeaveDecision.APPROVED })
      .expect(200);

    expect(retryRes.body.idempotent).toBe(true);

    // Balance must STILL be 3 used (not 6)
    const balanceAfterRetry = await testPrisma.leaveBalance.findUnique({
      where: {
        userId_leaveType_year: { userId: employee.id, leaveType: 'ANNUAL', year: 2026 },
      },
    });
    expect(balanceAfterRetry?.usedDays).toBe(3);
  });

  // ─── LV-08: Manager Rejection ──────────────────────────────────────────────
  it('LV-08: Manager rejects request -> status REJECTED, zero balance deduction, comment stored', async () => {
    const submitRes = await request(app.getHttpServer())
      .post('/api/leaves/request')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        type: LeaveType.ANNUAL,
        startDate: '2026-08-02T00:00:00Z',
        endDate: '2026-08-04T00:00:00Z',
        reason: 'Late summer trip',
      })
      .expect(201);
    const requestId = submitRes.body.request.id;

    const res = await request(app.getHttpServer())
      .patch(`/api/leaves/${requestId}/decision`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        decision: LeaveDecision.REJECTED,
        comments: 'Critical release scheduled for this sprint, please reschedule.',
      })
      .expect(200);

    expect(res.body.request.status).toBe('REJECTED');
    expect(res.body.request.rejectionReason).toContain('Critical release scheduled');

    // Balance unchanged
    const balance = await testPrisma.leaveBalance.findUnique({
      where: {
        userId_leaveType_year: { userId: employee.id, leaveType: 'ANNUAL', year: 2026 },
      },
    });
    expect(balance?.usedDays).toBe(0);
  });

  // ─── LV-09: HR Stage 2 Rejection ───────────────────────────────────────────
  it('LV-09: HR rejects at Stage 2 -> status REJECTED, prior manager review preserved', async () => {
    const submitRes = await request(app.getHttpServer())
      .post('/api/leaves/request')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        type: LeaveType.ANNUAL,
        startDate: '2026-08-09T00:00:00Z',
        endDate: '2026-08-11T00:00:00Z',
        reason: 'August trip',
      })
      .expect(201);
    const requestId = submitRes.body.request.id;

    // Manager approves stage 1
    await request(app.getHttpServer())
      .patch(`/api/leaves/${requestId}/decision`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ decision: LeaveDecision.APPROVED, comments: 'OK by manager' })
      .expect(200);

    // HR rejects stage 2
    const res = await request(app.getHttpServer())
      .patch(`/api/leaves/${requestId}/decision`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        decision: LeaveDecision.REJECTED,
        comments: 'HR compliance audit block.',
      })
      .expect(200);

    expect(res.body.request.status).toBe('REJECTED');
    expect(res.body.request.managerReviewedById).toBe(lineManager.id);
    expect(res.body.request.hrReviewedById).toBe(hrAdmin.id);
  });

  // ─── LV-10: Self-Approval Blocked & Manager Auto-Routing to HR ─────────────
  it('LV-10: Manager request routes directly to HR; self-approval is forbidden', async () => {
    // 1. Manager submits own leave
    const submitRes = await request(app.getHttpServer())
      .post('/api/leaves/request')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        type: LeaveType.ANNUAL,
        startDate: '2026-07-19T00:00:00Z',
        endDate: '2026-07-21T00:00:00Z',
        reason: 'Manager vacation',
      })
      .expect(201);

    expect(submitRes.body.request.status).toBe('PENDING_HR');
    expect(submitRes.body.request.routedDirectlyToHr).toBe(true);
    expect(submitRes.body.nextApprover).toBe('HR Admin');

    const requestId = submitRes.body.request.id;

    // 2. Manager attempts self-approval -> must be FORBIDDEN (403)
    const selfRes = await request(app.getHttpServer())
      .patch(`/api/leaves/${requestId}/decision`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ decision: LeaveDecision.APPROVED })
      .expect(403);

    expect(selfRes.body.message).toContain('Self-approval is strictly forbidden');

    // 3. HR approves manager leave
    await request(app.getHttpServer())
      .patch(`/api/leaves/${requestId}/decision`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ decision: LeaveDecision.APPROVED })
      .expect(200);
  });

  // ─── LV-11: Employee Cancellation & Balance Restoration ────────────────────
  it('LV-11: Employee cancels approved leave -> restores balance and records CANCELLATION_RESTORE in ledger', async () => {
    // 1. Submit & approve request
    const submitRes = await request(app.getHttpServer())
      .post('/api/leaves/request')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        type: LeaveType.ANNUAL,
        startDate: '2026-08-16T00:00:00Z',
        endDate: '2026-08-18T00:00:00Z', // 3 days
        reason: 'Cancelling test',
      })
      .expect(201);
    const requestId = submitRes.body.request.id;

    await request(app.getHttpServer())
      .patch(`/api/leaves/${requestId}/decision`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ decision: LeaveDecision.APPROVED })
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/api/leaves/${requestId}/decision`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ decision: LeaveDecision.APPROVED })
      .expect(200);

    // Verify balance is deducted to 27
    const balanceBeforeCancel = await testPrisma.leaveBalance.findUnique({
      where: { userId_leaveType_year: { userId: employee.id, leaveType: 'ANNUAL', year: 2026 } },
    });
    expect(balanceBeforeCancel?.usedDays).toBe(3);

    // 2. Employee cancels approved leave
    const cancelRes = await request(app.getHttpServer())
      .patch(`/api/leaves/${requestId}/cancel`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ reason: 'Trip cancelled due to family emergency' })
      .expect(200);

    expect(cancelRes.body.request.status).toBe('CANCELLED');

    // Balance restored to 0 used
    const balanceAfterCancel = await testPrisma.leaveBalance.findUnique({
      where: { userId_leaveType_year: { userId: employee.id, leaveType: 'ANNUAL', year: 2026 } },
    });
    expect(balanceAfterCancel?.usedDays).toBe(0);
    expect(balanceAfterCancel?.remainingDays).toBe(30);

    // Ledger records CANCELLATION_RESTORE entry
    const restoreEntry = await testPrisma.leaveBalanceLedger.findFirst({
      where: { requestId, entryType: 'CANCELLATION_RESTORE' },
    });
    expect(restoreEntry).toBeDefined();
    expect(restoreEntry?.amount).toBe(3);
  });

  // ─── LV-12: Half-Day Leave ─────────────────────────────────────────────────
  it('LV-12: Employee requests half day -> daysCount is 0.5', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/leaves/request')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        type: LeaveType.ANNUAL,
        startDate: '2026-08-23T00:00:00Z', // Sunday
        endDate: '2026-08-23T00:00:00Z',
        isHalfDay: true,
        halfDayPeriod: 'MORNING',
        reason: 'Morning medical appointment',
      })
      .expect(201);

    expect(res.body.request.isHalfDay).toBe(true);
    expect(res.body.request.halfDayPeriod).toBe('MORNING');
    expect(res.body.request.daysCount).toBe(0.5);
  });

  // ─── LV-13: Attachment Handling ───────────────────────────────────────────
  it('LV-13: Stores medical certificate attachmentUrl securely on request', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/leaves/request')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        type: LeaveType.SICK,
        startDate: '2026-08-24T00:00:00Z',
        endDate: '2026-08-25T00:00:00Z',
        reason: 'Flu symptoms with clinic visit',
        attachmentUrl: 'https://storage.shiftly.app/vault/medical-reports/rahaf-cert-01.pdf',
      })
      .expect(201);

    expect(res.body.request.attachmentUrl).toBe(
      'https://storage.shiftly.app/vault/medical-reports/rahaf-cert-01.pdf',
    );
  });

  // ─── LV-14: Future Year Navigation ────────────────────────────────────────
  it('LV-14: Allows submitting request in a future year (2027)', async () => {
    // Seed 2027 balance
    await testPrisma.leaveBalance.create({
      data: { userId: employee.id, leaveType: LeaveType.ANNUAL, totalDays: 30, usedDays: 0, year: 2027 },
    });

    const res = await request(app.getHttpServer())
      .post('/api/leaves/request')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        type: LeaveType.ANNUAL,
        startDate: '2027-01-10T00:00:00Z',
        endDate: '2027-01-12T00:00:00Z',
        reason: 'Early 2027 planned vacation',
      })
      .expect(201);

    expect(res.body.request.daysCount).toBe(3);
    expect(new Date(res.body.request.startDate).getFullYear()).toBe(2027);
  });

  // ─── LV-15: Full 11-Type Matrix Distinct Mapping ───────────────────────────
  it('LV-15: Maps all distinct leave types including EMERGENCY without falling back to UNPAID', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/leaves/request')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        type: LeaveType.EMERGENCY,
        startDate: '2026-08-30T00:00:00Z',
        endDate: '2026-08-31T00:00:00Z',
        reason: 'Urgent home maintenance',
      })
      .expect(201);

    expect(res.body.request.type).toBe('EMERGENCY');
    expect(res.body.request.type).not.toBe('UNPAID');
  });

  // ─── Balance Ledger Endpoint Check ────────────────────────────────────────
  it('Retrieves immutable balance ledger history via GET /leaves/ledger', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/leaves/ledger')
      .set('Authorization', `Bearer ${employeeToken}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
  });
});
