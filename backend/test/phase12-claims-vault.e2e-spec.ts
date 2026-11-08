import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './utils/test-app';
import { resetDatabase, testPrisma } from './utils/test-db';
import { createBranch, createUser, TEST_PASSWORD } from './utils/fixtures';

describe('Phase 12: Allowances, Reimbursement Claims & Personal Document Vault (e2e) — M11.1..M11.5', () => {
  let app: INestApplication;
  let hrAdmin: any;
  let lineManager: any;
  let saudiEmp: any;
  let otherEmp: any;
  let branchRiyadh: any;
  let hrToken: string;
  let managerToken: string;
  let saudiEmpToken: string;
  let otherEmpToken: string;

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

    otherEmp = await createUser(testPrisma, {
      email: 'other.emp@shiftly.app',
      employeeId: 'EMP-SA02',
      role: 'EMPLOYEE',
      managerId: lineManager.id,
      branchId: branchRiyadh.id,
      isSaudi: true,
      nationalId: '1044444444',
      iban: 'SA0380000000608010167522',
      basicSalarySar: 10000,
      housingAllowanceSar: 2500,
      transportAllowanceSar: 1000,
    });

    const login = async (email: string) => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email, password: TEST_PASSWORD })
        .expect(201);
      return res.body.accessToken as string;
    };

    hrToken = await login(hrAdmin.email);
    managerToken = await login(lineManager.email);
    saudiEmpToken = await login(saudiEmp.email);
    otherEmpToken = await login(otherEmp.email);
  });

  afterAll(async () => {
    await app.close();
    await testPrisma.$disconnect();
  });

  it('CLM-01 & M11.4: Wi-Fi and Petrol claims go through Stage 1 Manager -> Stage 2 HR approval and automatically feed into the period Payroll Run and Payslip', async () => {
    // 1. Check policy caps for period 2026-10
    const policiesRes = await request(app.getHttpServer())
      .get('/api/claims/policies?period=2026-10')
      .set('Authorization', `Bearer ${saudiEmpToken}`)
      .expect(200);
    expect(policiesRes.body).toHaveLength(4);

    // 2. Submit a Wi-Fi claim (400 SAR <= 500 SAR monthly cap)
    const submitRes = await request(app.getHttpServer())
      .post('/api/claims')
      .set('Authorization', `Bearer ${saudiEmpToken}`)
      .send({
        category: 'WIFI',
        period: '2026-10',
        amountSar: 400,
        description: 'October fiber internet bill',
        receiptUrl: 'https://storage.shiftly.app/receipts/wifi-oct-2026.pdf',
        receiptFileName: 'wifi-oct-2026.pdf',
      })
      .expect(201);

    const claimId = submitRes.body.id;
    expect(submitRes.body.status).toBe('PENDING_MANAGER');
    expect(submitRes.body.stage).toBe('STAGE_1_MANAGER');

    // 3. Manager sees it in pending queue and approves Stage 1
    const mgrPending = await request(app.getHttpServer())
      .get('/api/claims/pending')
      .set('Authorization', `Bearer ${managerToken}`)
      .expect(200);
    expect(mgrPending.body.some((c: any) => c.id === claimId)).toBe(true);

    const stage1Res = await request(app.getHttpServer())
      .patch(`/api/claims/${claimId}/decision`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ decision: 'APPROVED', comments: 'Verified remote Wi-Fi bill' })
      .expect(200);
    expect(stage1Res.body.status).toBe('PENDING_HR');
    expect(stage1Res.body.stage).toBe('STAGE_2_HR');

    // 4. Prepare Payroll Run for 2026-10 before HR approves claim, then approve claim at Stage 2
    await request(app.getHttpServer())
      .post('/api/payroll/runs')
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ period: '2026-10' })
      .expect(201);

    const stage2Res = await request(app.getHttpServer())
      .patch(`/api/claims/${claimId}/decision`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ decision: 'APPROVED', comments: 'Approved for Oct payroll' })
      .expect(200);
    expect(stage2Res.body.status).toBe('APPROVED');
    expect(stage2Res.body.payrollRunId).toBeTruthy();

    // 5. Verify employee's 2026-10 payslip includes the 400 SAR (40,000 halalas) reimbursement
    // Base net for saudiEmp = 16,000 - 1,462.50 GOSI = 14,537.50 SAR
    // With +400 SAR reimbursement => 14,937.50 SAR (1,493,750 halalas)
    const slipRes = await request(app.getHttpServer())
      .get('/api/payroll/my-payslip?month=2026-10')
      .set('Authorization', `Bearer ${saudiEmpToken}`)
      .expect(200);

    expect(slipRes.body.earnings.reimbursementsSar).toBe(400);
    expect(slipRes.body.earnings.reimbursementsHalalas).toBe(40000);
    expect(slipRes.body.netSalarySar).toBe(14937.5);
    expect(slipRes.body.netSalaryHalalas).toBe(1493750);
  });

  it('CLM-02 & M11.3: Private Medical/Insurance claims route directly to HR and block Line Manager visibility', async () => {
    const medRes = await request(app.getHttpServer())
      .post('/api/claims')
      .set('Authorization', `Bearer ${saudiEmpToken}`)
      .send({
        category: 'MEDICAL',
        period: '2026-10',
        amountSar: 1500,
        description: 'Confidential medical procedure receipt',
        receiptUrl: 'https://storage.shiftly.app/receipts/med-private.pdf',
        isPrivateMedical: true,
      })
      .expect(201);

    const medClaimId = medRes.body.id;
    expect(medRes.body.status).toBe('PENDING_HR');
    expect(medRes.body.stage).toBe('STAGE_2_HR');
    expect(medRes.body.isPrivateMedical).toBe(true);
    expect(medRes.body.routedDirectlyToHr).toBe(true);

    // Line manager cannot see it in pending list
    const mgrPending = await request(app.getHttpServer())
      .get('/api/claims/pending')
      .set('Authorization', `Bearer ${managerToken}`)
      .expect(200);
    expect(mgrPending.body.some((c: any) => c.id === medClaimId)).toBe(false);

    // Line manager gets 403 Forbidden if querying by ID or attempting to decide
    await request(app.getHttpServer())
      .get(`/api/claims/${medClaimId}`)
      .set('Authorization', `Bearer ${managerToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .patch(`/api/claims/${medClaimId}/decision`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ decision: 'APPROVED' })
      .expect(403);

    // HR Admin can view and approve it
    const hrView = await request(app.getHttpServer())
      .get(`/api/claims/${medClaimId}`)
      .set('Authorization', `Bearer ${hrToken}`)
      .expect(200);
    expect(hrView.body.receiptUrl).toContain('med-private.pdf');

    const hrDecision = await request(app.getHttpServer())
      .patch(`/api/claims/${medClaimId}/decision`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ decision: 'APPROVED', comments: 'Medical receipt verified by HR' })
      .expect(200);
    expect(hrDecision.body.status).toBe('APPROVED');
  });

  it('CLM-03 & CLM-04: Enforces policy caps and locks claims once the period Payroll Run is LOCKED', async () => {
    // Over-cap Petrol claim (> 1500 SAR) without exception flag -> 400 Bad Request
    await request(app.getHttpServer())
      .post('/api/claims')
      .set('Authorization', `Bearer ${saudiEmpToken}`)
      .send({
        category: 'PETROL',
        period: '2026-10',
        amountSar: 2000,
        description: 'Excess petrol claim',
        receiptUrl: 'https://storage.shiftly.app/receipts/petrol.pdf',
      })
      .expect(400);

    // Valid Petrol claim (500 SAR)
    const claimRes = await request(app.getHttpServer())
      .post('/api/claims')
      .set('Authorization', `Bearer ${saudiEmpToken}`)
      .send({
        category: 'PETROL',
        period: '2026-10',
        amountSar: 500,
        description: 'October field visits fuel',
        receiptUrl: 'https://storage.shiftly.app/receipts/petrol-500.pdf',
      })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/api/claims/${claimRes.body.id}/decision`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ decision: 'APPROVED' })
      .expect(200);

    // Prepare -> Review -> Lock the 2026-10 Payroll Run
    const runRes = await request(app.getHttpServer())
      .post('/api/payroll/runs')
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ period: '2026-10' })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/payroll/runs/${runRes.body.id}/review`)
      .set('Authorization', `Bearer ${hrToken}`)
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/payroll/runs/${runRes.body.id}/lock`)
      .set('Authorization', `Bearer ${hrToken}`)
      .expect(201);

    // Attempting to cancel a claim in a LOCKED payroll run -> 409 Conflict
    await request(app.getHttpServer())
      .patch(`/api/claims/${claimRes.body.id}/cancel`)
      .set('Authorization', `Bearer ${saudiEmpToken}`)
      .expect(409);

    // Attempting to submit a new claim into a LOCKED period -> 409 Conflict
    await request(app.getHttpServer())
      .post('/api/claims')
      .set('Authorization', `Bearer ${saudiEmpToken}`)
      .send({
        category: 'WIFI',
        period: '2026-10',
        amountSar: 200,
        description: 'Late Wi-Fi claim',
        receiptUrl: 'https://storage.shiftly.app/receipts/wifi.pdf',
      })
      .expect(409);
  });

  it('DOC-01 & M11.5: Personal Document Vault enforces access control, tracks expirations, and supports HR verification & reminders', async () => {
    const soonDate = new Date();
    soonDate.setUTCDate(soonDate.getUTCDate() + 25);
    const expiryIso = soonDate.toISOString().slice(0, 10);

    // 1. Employee uploads National ID / Iqama with upcoming expiry
    const uploadRes = await request(app.getHttpServer())
      .post('/api/documents')
      .set('Authorization', `Bearer ${saudiEmpToken}`)
      .send({
        documentType: 'NATIONAL_ID_IQAMA',
        title: 'Saudi National ID Card',
        documentNumber: '1033333333',
        fileUrl: 'https://storage.shiftly.app/vault/id-1033333333.pdf',
        fileName: 'id-1033333333.pdf',
        expiryDateIso: expiryIso,
      })
      .expect(201);

    const docId = uploadRes.body.id;
    expect(uploadRes.body.status).toBe('PENDING_VERIFICATION');
    expect(uploadRes.body.isExpiringSoon).toBe(true);

    // 2. Access control: Line Manager and another Employee cannot access the document (403 Forbidden)
    await request(app.getHttpServer())
      .get(`/api/documents/${docId}`)
      .set('Authorization', `Bearer ${managerToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .get(`/api/documents/${docId}`)
      .set('Authorization', `Bearer ${otherEmpToken}`)
      .expect(403);

    // 3. HR Admin sees the document in expiring list and verifies it
    const expiringRes = await request(app.getHttpServer())
      .get('/api/documents/expiring?withinDays=60')
      .set('Authorization', `Bearer ${hrToken}`)
      .expect(200);
    expect(expiringRes.body.some((d: any) => d.id === docId)).toBe(true);

    const verifyRes = await request(app.getHttpServer())
      .patch(`/api/documents/${docId}/verify`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        status: 'VERIFIED',
        verificationNote: 'Verified against Absher identity record',
      })
      .expect(200);
    expect(verifyRes.body.status).toBe('VERIFIED');

    // 4. HR triggers automated expiry reminders
    const reminderRes = await request(app.getHttpServer())
      .post('/api/documents/reminders/expiring')
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ withinDays: 60 })
      .expect(201);
    expect(reminderRes.body.remindersSent).toBeGreaterThanOrEqual(1);
  });
});
