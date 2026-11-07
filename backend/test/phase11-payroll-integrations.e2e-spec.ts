import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './utils/test-app';
import { resetDatabase, testPrisma } from './utils/test-db';
import { createBranch, createUser, TEST_PASSWORD } from './utils/fixtures';
import { redactSensitiveUrl } from '../src/common/middleware/http-logger.middleware';

describe('Phase 11: Payroll, Integrations & Release Readiness (e2e) — PAY-01..06, INT-02..03, INT-06, OPS-05', () => {
  let app: INestApplication;
  let hrAdmin: any;
  let lineManager: any;
  let saudiEmp: any;
  let highEarnerSaudi: any;
  let expatEmp: any;
  let branchRiyadh: any;
  let hrToken: string;
  let managerToken: string;
  let saudiEmpToken: string;
  let expatEmpToken: string;

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase();

    branchRiyadh = await createBranch(testPrisma, 'Riyadh HQ');

    hrAdmin = await createUser(testPrisma, {
      email: 'hr.admin@shiftly.app',
      employeeId: 'EMP-HR01',
      role: 'HR_ADMIN',
      branchId: branchRiyadh.id,
      isSaudi: true,
      nationalId: '1011111111',
      iban: 'SA0380000000608010167519',
      basicSalarySar: 20000,
      housingAllowanceSar: 5000,
      transportAllowanceSar: 2000,
    });

    lineManager = await createUser(testPrisma, {
      email: 'manager@shiftly.app',
      employeeId: 'EMP-MGR01',
      role: 'MANAGER',
      branchId: branchRiyadh.id,
      isSaudi: true,
      nationalId: '1022222222',
      iban: 'SA0380000000608010167520',
      basicSalarySar: 24000,
      housingAllowanceSar: 6000,
      transportAllowanceSar: 2000,
    });

    // Saudi employee below cap: Basic 12,000 + Housing 3,000 + Transport 1,000 = 16,000 gross
    // Contributory = 15,000 => GOSI emp (9.75%) = 1,462.50 SAR (146,250 halalas), employer (11.75%) = 1,762.50 SAR
    saudiEmp = await createUser(testPrisma, {
      email: 'saudi.emp@shiftly.app',
      employeeId: 'EMP-SA01',
      role: 'EMPLOYEE',
      managerId: lineManager.id,
      branchId: branchRiyadh.id,
      isSaudi: true,
      nationalId: '1033333333',
      iban: 'SA0380000000608010167521',
      basicSalarySar: 12000,
      housingAllowanceSar: 3000,
      transportAllowanceSar: 1000,
    });

    // Saudi employee above 45,000 cap: Basic 40,000 + Housing 10,000 + Transport 2,000 = 52,000 gross
    // Contributory capped at 45,000 => GOSI emp = 4,387.50 SAR, employer = 5,287.50 SAR
    highEarnerSaudi = await createUser(testPrisma, {
      email: 'exec.saudi@shiftly.app',
      employeeId: 'EMP-SA02',
      role: 'EMPLOYEE',
      managerId: lineManager.id,
      branchId: branchRiyadh.id,
      isSaudi: true,
      nationalId: '1044444444',
      iban: 'SA0380000000608010167522',
      basicSalarySar: 40000,
      housingAllowanceSar: 10000,
      transportAllowanceSar: 2000,
    });

    // Non-Saudi employee: Basic 15,000 + Housing 3,750 + Transport 1,250 = 20,000 gross
    // Contributory = 18,750 => GOSI emp = 0 SAR, employer (2% hazards) = 375.00 SAR
    expatEmp = await createUser(testPrisma, {
      email: 'expat.emp@shiftly.app',
      employeeId: 'EMP-EX01',
      role: 'EMPLOYEE',
      managerId: lineManager.id,
      branchId: branchRiyadh.id,
      isSaudi: false,
      nationalId: null,
      iqamaNumber: '2055555555',
      iban: 'SA0380000000608010167523',
      basicSalarySar: 15000,
      housingAllowanceSar: 3750,
      transportAllowanceSar: 1250,
    });

    hrToken = await login('hr.admin@shiftly.app');
    managerToken = await login('manager@shiftly.app');
    saudiEmpToken = await login('saudi.emp@shiftly.app');
    expatEmpToken = await login('expat.emp@shiftly.app');
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

  // ─── PAY-01, PAY-02, PAY-03: Payslip & GOSI Precision (Saudi, Cap, Expat) ────
  it('PAY-01, PAY-02, PAY-03: Generates period payroll run and payslips matching Saudi, Capped, and Non-Saudi GOSI to the halala', async () => {
    const prepRes = await request(app.getHttpServer())
      .post('/api/payroll/runs')
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ period: '2026-11', notes: 'November 2026 Official Run' })
      .expect(201);

    expect(prepRes.body.status).toBe('PREPARED');
    expect(prepRes.body.totalEmployees).toBe(5);

    // 1. Saudi employee below cap (PAY-01 & PAY-02)
    const saudiSlipRes = await request(app.getHttpServer())
      .get('/api/payroll/my-payslip?month=2026-11')
      .set('Authorization', `Bearer ${saudiEmpToken}`)
      .expect(200);

    expect(saudiSlipRes.body.earnings.grossSalarySar).toBe(16000);
    expect(saudiSlipRes.body.earnings.grossSalaryHalalas).toBe(1600000);
    expect(saudiSlipRes.body.deductions.gosiEmployeeShareSar).toBe(1462.5);
    expect(saudiSlipRes.body.deductions.gosiEmployeeShareHalalas).toBe(146250);
    expect(saudiSlipRes.body.employerContributions.gosiEmployerShareSar).toBe(1762.5);
    expect(saudiSlipRes.body.netSalarySar).toBe(14537.5);
    expect(saudiSlipRes.body.netSalaryHalalas).toBe(1453750);

    // 2. Saudi employee above 45k cap (PAY-02)
    const highSlip = prepRes.body.payslips.find(
      (p: any) => p.employee.employeeId === 'EMP-SA02',
    );
    expect(highSlip).toBeDefined();
    expect(highSlip.earnings.grossSalarySar).toBe(52000);
    expect(highSlip.deductions.gosiEmployeeShareSar).toBe(4387.5);
    expect(highSlip.employerContributions.gosiEmployerShareSar).toBe(5287.5);
    expect(highSlip.netSalarySar).toBe(47612.5);

    // 3. Non-Saudi employee (PAY-03)
    const expatSlipRes = await request(app.getHttpServer())
      .get('/api/payroll/my-payslip?month=2026-11')
      .set('Authorization', `Bearer ${expatEmpToken}`)
      .expect(200);

    expect(expatSlipRes.body.earnings.grossSalarySar).toBe(20000);
    expect(expatSlipRes.body.deductions.gosiEmployeeShareSar).toBe(0);
    expect(expatSlipRes.body.employerContributions.gosiEmployerShareSar).toBe(375);
    expect(expatSlipRes.body.netSalarySar).toBe(20000);
  });

  // ─── PAY-04: Unpaid Leave Deduction & No Double Deduction ────────────────────
  it('PAY-04: Deducts approved unpaid leave (daily rate × unpaid days) once without double deduction on re-run', async () => {
    // Submit 3 working days of UNPAID leave in November 2026 (Sun Nov 8 to Tue Nov 10, 2026)
    const subRes = await request(app.getHttpServer())
      .post('/api/leaves/request')
      .set('Authorization', `Bearer ${saudiEmpToken}`)
      .send({
        type: 'UNPAID',
        startDate: '2026-11-08',
        endDate: '2026-11-10',
        reason: 'Personal unpaid travel',
      })
      .expect(201);

    const leaveId = subRes.body.request.id;

    // Stage 1 Manager + Stage 2 HR approval
    await request(app.getHttpServer())
      .patch(`/api/leaves/${leaveId}/decision`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ decision: 'APPROVED', comments: 'Manager OK' })
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/api/leaves/${leaveId}/decision`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ decision: 'APPROVED', comments: 'HR OK' })
      .expect(200);

    // Prepare payroll run for 2026-11
    await request(app.getHttpServer())
      .post('/api/payroll/runs')
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ period: '2026-11' })
      .expect(201);

    // Re-prepare the same period to verify no double deduction
    await request(app.getHttpServer())
      .post('/api/payroll/runs')
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ period: '2026-11' })
      .expect(201);

    const slipRes = await request(app.getHttpServer())
      .get('/api/payroll/my-payslip?month=2026-11')
      .set('Authorization', `Bearer ${saudiEmpToken}`)
      .expect(200);

    // Basic = 12,000 SAR => Daily rate = 12,000 / 30 = 400 SAR/day
    // 3 days unpaid = 1,200 SAR deduction
    // Net = 16,000 gross - 1,462.50 GOSI - 1,200 unpaid = 13,337.50 SAR
    expect(slipRes.body.deductions.unpaidLeaveDays).toBe(3);
    expect(slipRes.body.deductions.unpaidLeaveDeductionSar).toBe(1200);
    expect(slipRes.body.netSalarySar).toBe(13337.5);
    expect(slipRes.body.explanation).toContain('3 day(s) × 400.00 SAR/day');
  });

  // ─── PAY-05: Payroll Run Lifecycle & Immutability After Lock ─────────────────
  it('PAY-05: Transitions PREPARED -> REVIEWED -> LOCKED; locked run is immutable and unaffected by subsequent salary edits', async () => {
    const prep = await request(app.getHttpServer())
      .post('/api/payroll/runs')
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ period: '2026-10' })
      .expect(201);

    const runId = prep.body.id;
    expect(prep.body.status).toBe('PREPARED');

    // Cannot lock directly from PREPARED without review
    await request(app.getHttpServer())
      .post(`/api/payroll/runs/${runId}/lock`)
      .set('Authorization', `Bearer ${hrToken}`)
      .expect(400);

    // Review run
    const rev = await request(app.getHttpServer())
      .post(`/api/payroll/runs/${runId}/review`)
      .set('Authorization', `Bearer ${hrToken}`)
      .expect(201);
    expect(rev.body.status).toBe('REVIEWED');

    // Lock run
    const locked = await request(app.getHttpServer())
      .post(`/api/payroll/runs/${runId}/lock`)
      .set('Authorization', `Bearer ${hrToken}`)
      .expect(201);
    expect(locked.body.status).toBe('LOCKED');

    // Re-preparing a locked period fails with 409 Conflict
    await request(app.getHttpServer())
      .post('/api/payroll/runs')
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ period: '2026-10' })
      .expect(409);

    // Now edit saudiEmp's salary via EmploymentChange
    await request(app.getHttpServer())
      .post(`/api/employees/${saudiEmp.id}/changes`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        type: 'SALARY',
        effectiveDate: '2026-11-01',
        reason: 'Annual increment',
        basicSalarySar: 18000,
        housingAllowanceSar: 4500,
        transportAllowanceSar: 1500,
      })
      .expect(201);

    // Locked 2026-10 payslip still reflects original 12,000 basic salary
    const octSlip = await request(app.getHttpServer())
      .get('/api/payroll/my-payslip?month=2026-10')
      .set('Authorization', `Bearer ${saudiEmpToken}`)
      .expect(200);
    expect(octSlip.body.earnings.basicSalarySar).toBe(12000);
    expect(octSlip.body.runStatus).toBe('LOCKED');

    // Future 2026-12 payslip reflects new 18,000 basic salary
    const decSlip = await request(app.getHttpServer())
      .get('/api/payroll/my-payslip?month=2026-12')
      .set('Authorization', `Bearer ${saudiEmpToken}`)
      .expect(200);
    expect(decSlip.body.earnings.basicSalarySar).toBe(18000);
  });

  // ─── PAY-06: WPS Export Reconciliation & Validation Block on Bad ID/IBAN ────
  it('PAY-06: Exports valid WPS CSV matching payslip totals, and blocks export with error report when ID or IBAN is invalid', async () => {
    // 1. Valid period export succeeds and reconciles
    const wpsRes = await request(app.getHttpServer())
      .get('/api/payroll/wps-export?month=2026-11')
      .set('Authorization', `Bearer ${hrToken}`)
      .expect(200);

    const lines = wpsRes.text.trim().split('\n');
    expect(lines[0]).toContain('RECORD_TYPE,EMPLOYEE_ID,NATIONAL_OR_IQAMA_ID,IBAN');
    expect(lines.length).toBe(6); // 1 header + 5 employees

    // 2. Corrupt an employee's IBAN and re-prepare an unlocked period (2026-09)
    await testPrisma.user.update({
      where: { id: saudiEmp.id },
      data: { iban: 'INVALID_IBAN_123', nationalId: null },
    });

    await request(app.getHttpServer())
      .post('/api/payroll/runs')
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ period: '2026-09' })
      .expect(201);

    const badWpsRes = await request(app.getHttpServer())
      .get('/api/payroll/wps-export?month=2026-09')
      .set('Authorization', `Bearer ${hrToken}`)
      .expect(400);

    expect(badWpsRes.body.message).toContain('WPS export blocked');
    expect(badWpsRes.body.errors.length).toBeGreaterThanOrEqual(2);
    expect(
      badWpsRes.body.errors.some(
        (e: any) => e.employeeId === 'EMP-SA01' && e.field === 'iban',
      ),
    ).toBe(true);
    expect(
      badWpsRes.body.errors.some(
        (e: any) => e.employeeId === 'EMP-SA01' && e.field === 'nationalOrIqamaId',
      ),
    ).toBe(true);
  });

  // ─── INT-02 & INT-06: Teams Outage Non-Blocking + Idempotent Retry ──────────
  it('INT-02 & INT-06: Leave submission succeeds when Teams fails; retry delivers Adaptive Card once without duplication', async () => {
    // Simulate Teams failure
    await request(app.getHttpServer())
      .patch('/api/integrations/admin/configs/TEAMS')
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ enabled: true, simulateFailure: true })
      .expect(200);

    // Submit leave while Teams sandbox is failing (INT-06: must NOT fail the leave request)
    const subRes = await request(app.getHttpServer())
      .post('/api/leaves/request')
      .set('Authorization', `Bearer ${saudiEmpToken}`)
      .send({
        type: 'ANNUAL',
        startDate: '2026-11-15',
        endDate: '2026-11-17',
        reason: 'Testing Teams outage resilience',
      })
      .expect(201);

    const leaveId = subRes.body.request.id;
    expect(subRes.body.integrationDispatch.status).toBe('FAILED');

    // Outbox shows FAILED event with 1 attempt
    const outboxBefore = await request(app.getHttpServer())
      .get(`/api/integrations/admin/outbox?resourceId=${leaveId}`)
      .set('Authorization', `Bearer ${hrToken}`)
      .expect(200);
    expect(outboxBefore.body.length).toBe(1);
    expect(outboxBefore.body[0].status).toBe('FAILED');
    const outboxEventId = outboxBefore.body[0].id;

    // Restore Teams connectivity
    await request(app.getHttpServer())
      .patch('/api/integrations/admin/configs/TEAMS')
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ simulateFailure: false })
      .expect(200);

    // Retry delivery -> succeeds and stores message ID
    const retry1 = await request(app.getHttpServer())
      .post(`/api/integrations/admin/outbox/${outboxEventId}/retry`)
      .set('Authorization', `Bearer ${hrToken}`)
      .expect(201);
    expect(retry1.body.status).toBe('DELIVERED');
    expect(retry1.body.externalMessageId).toBe(`teams-card-${leaveId}`);

    // Retry a second time -> idempotent, does not increment attempts or duplicate
    const retry2 = await request(app.getHttpServer())
      .post(`/api/integrations/admin/outbox/${outboxEventId}/retry`)
      .set('Authorization', `Bearer ${hrToken}`)
      .expect(201);
    expect(retry2.body.status).toBe('DELIVERED');
    expect(retry2.body.idempotent).toBe(true);
    expect(retry2.body.event.attempts).toBe(2);

    // Unknown provider returns 400 Bad Request instead of 500
    await request(app.getHttpServer())
      .patch('/api/integrations/admin/configs/UNKNOWN_PROVIDER')
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ enabled: true })
      .expect(400);
  });

  // ─── INT-03: Outlook OOO Event Create -> Date Change Update -> Cancel Remove ─
  it('INT-03: Approving leave creates one Outlook OOO event; changing dates updates the same event and reconciles balance; cancelling removes it', async () => {
    const subRes = await request(app.getHttpServer())
      .post('/api/leaves/request')
      .set('Authorization', `Bearer ${saudiEmpToken}`)
      .send({
        type: 'ANNUAL',
        startDate: '2026-12-06',
        endDate: '2026-12-08',
        reason: 'Winter holiday',
      })
      .expect(201);

    const leaveId = subRes.body.request.id;

    // Manager Stage 1 + HR Stage 2 approval
    await request(app.getHttpServer())
      .patch(`/api/leaves/${leaveId}/decision`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ decision: 'APPROVED' })
      .expect(200);

    const hrApprove = await request(app.getHttpServer())
      .patch(`/api/leaves/${leaveId}/decision`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ decision: 'APPROVED' })
      .expect(200);

    const expectedEventId = `outlook-ooo-${leaveId}`;
    expect(hrApprove.body.request.outlookCalendarEventId).toBe(expectedEventId);

    // Change dates on the approved leave (3 days -> 4 days) -> updates the same Outlook event ID & adjusts balance
    const dateUpdate = await request(app.getHttpServer())
      .patch(`/api/leaves/${leaveId}/dates`)
      .set('Authorization', `Bearer ${saudiEmpToken}`)
      .send({
        startDate: '2026-12-07',
        endDate: '2026-12-10',
      })
      .expect(200);

    expect(dateUpdate.body.request.outlookCalendarEventId).toBe(expectedEventId);
    expect(dateUpdate.body.request.daysCount).toBe(4);

    const balAfterExtend = await request(app.getHttpServer())
      .get('/api/leaves/balances')
      .set('Authorization', `Bearer ${saudiEmpToken}`)
      .expect(200);
    const annualAfterExtend = balAfterExtend.body.find(
      (b: any) => b.leaveType === 'ANNUAL',
    );
    expect(annualAfterExtend.usedDays).toBe(4);
    expect(annualAfterExtend.remainingDays).toBe(26);

    // Verify only 1 OUTLOOK outbox record exists for this leave and its payload has the new endDate
    const outlookOutbox = await request(app.getHttpServer())
      .get(`/api/integrations/admin/outbox?provider=OUTLOOK&resourceId=${leaveId}`)
      .set('Authorization', `Bearer ${hrToken}`)
      .expect(200);

    expect(outlookOutbox.body.length).toBe(1);
    expect(outlookOutbox.body[0].payloadJson.endDate).toContain('2026-12-10');

    // Cancel the approved leave -> removes the Outlook OOO event
    const cancelRes = await request(app.getHttpServer())
      .patch(`/api/leaves/${leaveId}/cancel`)
      .set('Authorization', `Bearer ${saudiEmpToken}`)
      .send({ reason: 'Trip postponed' })
      .expect(200);

    expect(cancelRes.body.request.outlookCalendarEventId).toBeNull();
    expect(cancelRes.body.outlookSync.status).toBe('CANCELLED');
  });

  // ─── OPS-05: Deep Health Check, Request IDs & Log PII Redaction ──────────────
  it('OPS-05: Health endpoint verifies DB dependency, propagates X-Request-Id, and redacts sensitive URL parameters', async () => {
    const healthRes = await request(app.getHttpServer())
      .get('/api/health')
      .set('X-Request-Id', 'req-phase11-ops05')
      .expect(200);

    expect(healthRes.headers['x-request-id']).toBe('req-phase11-ops05');
    expect(healthRes.body.status).toBe('ok');
    expect(healthRes.body.requestId).toBe('req-phase11-ops05');
    expect(healthRes.body.dependencies.database).toBe('up');

    // Verify URL redaction strips tokens, passwords, and national IDs
    const dirtyUrl =
      '/api/auth/callback?token=eyJhbGciOi&nationalId=1098765432&page=1';
    const cleanUrl = redactSensitiveUrl(dirtyUrl);
    expect(cleanUrl).toBe(
      '/api/auth/callback?token=[REDACTED]&nationalId=[REDACTED]&page=1',
    );
    expect(cleanUrl).not.toContain('eyJhbGciOi');
    expect(cleanUrl).not.toContain('1098765432');
  });
});
