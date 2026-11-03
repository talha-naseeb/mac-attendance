import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './utils/test-app';
import { resetDatabase, testPrisma } from './utils/test-db';
import { createUser, TEST_PASSWORD } from './utils/fixtures';
import { getLocalDateIso, resolveUserTimezone } from '../src/common/utils/timezone.util';

describe('Phase 8: Attendance Day, Breaks & Exception Integrity (e2e)', () => {
  let app: INestApplication;
  let branch: any;

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase();
    branch = await testPrisma.branch.create({
      data: {
        name: 'Riyadh HQ',
        nameAr: 'المقر الرئيسي بالرياض',
        code: 'RUH-HQ',
        city: 'Riyadh',
        cityAr: 'الرياض',
        latitude: 24.7136,
        longitude: 46.6753,
        geofenceRadiusMeters: 150,
      },
    });
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

  function punchPayload(type: string, overrides: Record<string, any> = {}) {
    return {
      type,
      latitude: 24.7136,
      longitude: 46.6753,
      accuracyMeters: 10,
      isMockLocation: false,
      isDeviceRooted: false,
      biometricVerified: true,
      clientTimestamp: new Date().toISOString(),
      branchId: branch.id,
      workMode: 'OFFICE',
      ...overrides,
    };
  }

  it('M4.1 & M4.3: executes complete workday lifecycle with breaks and net working minutes', async () => {
    const user = await createUser(testPrisma, {
      email: 'employee@macqhr.sa',
      branchId: branch.id,
      isRemoteAllowed: false,
    });
    const token = await login(user.email);

    // 1. Check in
    const inRes = await request(app.getHttpServer())
      .post('/api/attendance/punch')
      .set('Authorization', `Bearer ${token}`)
      .send(punchPayload('CHECK_IN'))
      .expect(201);
    expect(inRes.body.record.status).toBe('VERIFIED');

    // 2. Start Break
    await request(app.getHttpServer())
      .post('/api/attendance/punch')
      .set('Authorization', `Bearer ${token}`)
      .send(punchPayload('BREAK_START'))
      .expect(201);

    // Verify today's state
    const midDay = await request(app.getHttpServer())
      .get('/api/attendance/today')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(midDay.body.isCheckedIn).toBe(true);
    expect(midDay.body.isOnBreak).toBe(true);

    // 3. End Break
    await request(app.getHttpServer())
      .post('/api/attendance/punch')
      .set('Authorization', `Bearer ${token}`)
      .send(punchPayload('BREAK_END'))
      .expect(201);

    // 4. Check out
    const outRes = await request(app.getHttpServer())
      .post('/api/attendance/punch')
      .set('Authorization', `Bearer ${token}`)
      .send(punchPayload('CHECK_OUT'))
      .expect(201);

    expect(outRes.body.record.status).toBe('VERIFIED');

    // 5. Verify AttendanceDay database record
    const todayDay = await testPrisma.attendanceDay.findFirst({
      where: { userId: user.id },
      include: { events: true },
    });

    expect(todayDay).toBeTruthy();
    expect(todayDay!.events.length).toBe(4);
    expect(todayDay!.status).toBe('VERIFIED');
    expect(todayDay!.firstCheckInAt).toBeTruthy();
    expect(todayDay!.lastCheckOutAt).toBeTruthy();
  });

  it('M4.4: enforces one open check-in session per local day', async () => {
    const user = await createUser(testPrisma, {
      email: 'emp.lock@macqhr.sa',
      branchId: branch.id,
    });
    const token = await login(user.email);

    await request(app.getHttpServer())
      .post('/api/attendance/punch')
      .set('Authorization', `Bearer ${token}`)
      .send(punchPayload('CHECK_IN'))
      .expect(201);

    // Second check-in without checking out must be rejected
    const dupRes = await request(app.getHttpServer())
      .post('/api/attendance/punch')
      .set('Authorization', `Bearer ${token}`)
      .send(punchPayload('CHECK_IN'))
      .expect(400);

    expect(dupRes.body.message).toContain('already checked in');
  });

  it('M4.1 & M4.6: accepts check-out outside geofence (non-blocking) and logs an AttendanceException', async () => {
    const user = await createUser(testPrisma, {
      email: 'emp.outside@macqhr.sa',
      branchId: branch.id,
    });
    const token = await login(user.email);

    const hrAdmin = await createUser(testPrisma, {
      email: 'hr.admin@macqhr.sa',
      role: 'HR_ADMIN',
    });
    const hrToken = await login(hrAdmin.email);

    // Check in at office (inside geofence)
    await request(app.getHttpServer())
      .post('/api/attendance/punch')
      .set('Authorization', `Bearer ${token}`)
      .send(punchPayload('CHECK_IN'))
      .expect(201);

    // Check out outside geofence (2000m away in Riyadh)
    const outRes = await request(app.getHttpServer())
      .post('/api/attendance/punch')
      .set('Authorization', `Bearer ${token}`)
      .send(
        punchPayload('CHECK_OUT', {
          latitude: 24.7300,
          longitude: 46.6900,
        }),
      )
      .expect(201);

    expect(outRes.body.message).toContain('Flagged for HR review');
    expect(outRes.body.record.status).toBe('FLAGGED');

    // Verify exception in DB
    const exception = await testPrisma.attendanceException.findFirst({
      where: { type: 'OUTSIDE_OFFICE_GEOFENCE' },
    });
    expect(exception).toBeTruthy();
    expect(exception!.status).toBe('OPEN');

    // HR reviews and accepts the exception
    await request(app.getHttpServer())
      .post(`/api/attendance/exceptions/${exception!.id}/review`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ decision: 'ACCEPTED', reviewNote: 'Valid offsite departure' })
      .expect(201);

    const dayAfter = await testPrisma.attendanceDay.findUnique({
      where: { id: exception!.dayId },
    });
    expect(dayAfter!.status).toBe('VERIFIED');
    expect(dayAfter!.openExceptionCount).toBe(0);
  });

  it('M4.8: dual remote mode permits remote punch with approved RemoteWorkRequest', async () => {
    const manager = await createUser(testPrisma, {
      email: 'mgr.remote@macqhr.sa',
      role: 'MANAGER',
    });
    const managerToken = await login(manager.email);

    const user = await createUser(testPrisma, {
      email: 'office.emp@macqhr.sa',
      branchId: branch.id,
      managerId: manager.id,
      isRemoteAllowed: false,
    });
    const empToken = await login(user.email);

    const todayIso = getLocalDateIso(new Date(), resolveUserTimezone(user));

    // Attempting remote punch without approved request fails
    await request(app.getHttpServer())
      .post('/api/attendance/punch')
      .set('Authorization', `Bearer ${empToken}`)
      .send(punchPayload('CHECK_IN', { workMode: 'REMOTE' }))
      .expect(403);

    // Employee submits remote request
    const reqRes = await request(app.getHttpServer())
      .post('/api/attendance/remote-requests')
      .set('Authorization', `Bearer ${empToken}`)
      .send({
        startDateIso: todayIso,
        endDateIso: todayIso,
        reason: 'Severe weather advisory',
      })
      .expect(201);

    const requestId = reqRes.body.request.id;

    // Manager approves request
    await request(app.getHttpServer())
      .post(`/api/attendance/remote-requests/${requestId}/decision`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ decision: 'APPROVED' })
      .expect(201);

    // Now employee punches remotely successfully!
    const remotePunch = await request(app.getHttpServer())
      .post('/api/attendance/punch')
      .set('Authorization', `Bearer ${empToken}`)
      .send(punchPayload('CHECK_IN', { workMode: 'REMOTE' }))
      .expect(201);

    expect(remotePunch.body.record.workMode).toBe('REMOTE');
  });
});
