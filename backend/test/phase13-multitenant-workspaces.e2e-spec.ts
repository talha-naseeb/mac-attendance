import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './utils/test-app';
import { resetDatabase, testPrisma } from './utils/test-db';
import { createBranch, createUser, TEST_PASSWORD } from './utils/fixtures';

describe('Phase 13: Multi-Tenant Workspaces, Memberships, Invites & SSO (e2e)', () => {
  let app: INestApplication;
  let ownerUser: any;
  let teammateUser: any;
  let outsiderUser: any;
  let branchRiyadh: any;

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase();
    branchRiyadh = await createBranch(testPrisma, 'Riyadh HQ');

    ownerUser = await createUser(testPrisma, {
      email: 'owner@macqhr.sa',
      employeeId: 'EMP-OWN1',
      role: 'SUPER_ADMIN',
      branchId: branchRiyadh.id,
    });

    teammateUser = await createUser(testPrisma, {
      email: 'teammate@acme.sa',
      employeeId: 'EMP-TM01',
      role: 'EMPLOYEE',
      branchId: branchRiyadh.id,
    });

    outsiderUser = await createUser(testPrisma, {
      email: 'outsider@otherco.sa',
      employeeId: 'EMP-OUT1',
      role: 'EMPLOYEE',
      branchId: branchRiyadh.id,
    });
  });

  afterAll(async () => {
    await app.close();
    await testPrisma.$disconnect();
  });

  async function loginAs(email: string) {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password: TEST_PASSWORD })
      .expect(201);
    return res.body;
  }

  it('provisions default Macquires workspace on login and executes idempotent backfill', async () => {
    const loginBody = await loginAs(ownerUser.email);
    expect(loginBody.workspace.slug).toBe('macquires');
    expect(loginBody.membership.role).toBe('OWNER');
    expect(loginBody.entitlements.payroll).toBe(true);

    const backfillRes = await request(app.getHttpServer())
      .post('/api/workspaces/backfill')
      .set('Authorization', `Bearer ${loginBody.accessToken}`)
      .expect(201);

    expect(backfillRes.body.slug).toBe('macquires');
    expect(backfillRes.body.membershipsBackfilled).toBe(3);
    expect(backfillRes.body.domainRecordsUpdated.branches).toBeGreaterThanOrEqual(1);
  });

  it('supports PERSONAL workspace creation, blocks invites on PERSONAL, and converts PERSONAL -> BUSINESS', async () => {
    const loginBody = await loginAs(teammateUser.email);
    const token = loginBody.accessToken as string;

    const personalRes = await request(app.getHttpServer())
      .post('/api/workspaces')
      .set('Authorization', `Bearer ${token}`)
      .send({
        type: 'PERSONAL',
        name: 'Teammate Solo Workspace',
        country: 'SA',
        timezone: 'Asia/Riyadh',
      })
      .expect(201);

    const personalId = personalRes.body.workspace.id;
    expect(personalRes.body.workspace.type).toBe('PERSONAL');
    expect(personalRes.body.entitlements.maxSeats).toBe(1);

    const switchRes = await request(app.getHttpServer())
      .post(`/api/workspaces/${personalId}/switch`)
      .set('Authorization', `Bearer ${token}`)
      .expect(201);

    const personalToken = switchRes.body.accessToken as string;

    // Inviting on PERSONAL workspace is blocked with 403 PLAN_SEAT_LIMIT
    await request(app.getHttpServer())
      .post('/api/workspaces/current/invites')
      .set('Authorization', `Bearer ${personalToken}`)
      .send({ email: 'other@acme.sa' })
      .expect(403);

    // Convert PERSONAL -> BUSINESS
    const convertRes = await request(app.getHttpServer())
      .post(`/api/workspaces/${personalId}/convert-business`)
      .set('Authorization', `Bearer ${personalToken}`)
      .send({
        name: 'Acme Studio',
        planCode: 'BUSINESS_STARTER',
        seatsPurchased: 2,
      })
      .expect(201);

    expect(convertRes.body.workspace.type).toBe('BUSINESS');
    expect(convertRes.body.entitlements.maxSeats).toBe(2);

    // Now invite 1 teammate (fills 2nd of 2 seats), then 2nd invite is blocked by seat limit
    await request(app.getHttpServer())
      .post('/api/workspaces/current/invites')
      .set('Authorization', `Bearer ${personalToken}`)
      .send({ email: 'hire1@acme.sa', role: 'EMPLOYEE' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/workspaces/current/invites')
      .set('Authorization', `Bearer ${personalToken}`)
      .send({ email: 'hire2@acme.sa', role: 'EMPLOYEE' })
      .expect(403);
  });

  it('enforces invite acceptance, cross-tenant isolation, role session invalidation (sv), and enforced SSO', async () => {
    const ownerLogin = await loginAs(ownerUser.email);
    const ownerToken = ownerLogin.accessToken as string;

    // Owner creates a separate BUSINESS_GROWTH workspace
    const bizRes = await request(app.getHttpServer())
      .post('/api/workspaces')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        type: 'BUSINESS',
        name: 'Nova Labs',
        planCode: 'BUSINESS_GROWTH',
      })
      .expect(201);

    const novaWorkspaceId = bizRes.body.workspace.id;

    // Switch owner into Nova Labs
    const switchOwner = await request(app.getHttpServer())
      .post(`/api/workspaces/${novaWorkspaceId}/switch`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(201);
    const novaOwnerToken = switchOwner.body.accessToken as string;

    // Owner invites teammateUser to Nova Labs
    const inviteRes = await request(app.getHttpServer())
      .post('/api/workspaces/current/invites')
      .set('Authorization', `Bearer ${novaOwnerToken}`)
      .send({
        email: teammateUser.email,
        role: 'MANAGER',
        jobTitle: 'Engineering Lead',
      })
      .expect(201);

    const inviteToken = inviteRes.body.inviteToken as string;

    // Cross-tenant isolation: outsider cannot switch into Nova Labs
    const outsiderLogin = await loginAs(outsiderUser.email);
    await request(app.getHttpServer())
      .post(`/api/workspaces/${novaWorkspaceId}/switch`)
      .set('Authorization', `Bearer ${outsiderLogin.accessToken}`)
      .expect(403);

    // Wrong email cannot accept teammate's invite
    await request(app.getHttpServer())
      .post('/api/workspaces/invites/accept')
      .set('Authorization', `Bearer ${outsiderLogin.accessToken}`)
      .send({ token: inviteToken })
      .expect(403);

    // Teammate accepts invite and switches into Nova Labs
    const teammateLogin = await loginAs(teammateUser.email);
    const acceptRes = await request(app.getHttpServer())
      .post('/api/workspaces/invites/accept')
      .set('Authorization', `Bearer ${teammateLogin.accessToken}`)
      .send({ token: inviteToken })
      .expect(201);

    const teammateMembershipId = acceptRes.body.membership.id;

    // Replay of single-use invite is rejected
    await request(app.getHttpServer())
      .post('/api/workspaces/invites/accept')
      .set('Authorization', `Bearer ${teammateLogin.accessToken}`)
      .send({ token: inviteToken })
      .expect(409);

    // Teammate switches into Nova Labs
    const teammateNovaSwitch = await request(app.getHttpServer())
      .post(`/api/workspaces/${novaWorkspaceId}/switch`)
      .set('Authorization', `Bearer ${teammateLogin.accessToken}`)
      .expect(201);
    const teammateNovaToken = teammateNovaSwitch.body.accessToken as string;

    // Owner promotes/changes teammate's role -> bumps sv and revokes teammate's active Nova session
    await request(app.getHttpServer())
      .patch(`/api/workspaces/current/members/${teammateMembershipId}`)
      .set('Authorization', `Bearer ${novaOwnerToken}`)
      .send({ role: 'EMPLOYEE' })
      .expect(200);

    // Old token for teammate in Nova Labs is immediately rejected (401)
    await request(app.getHttpServer())
      .get('/api/workspaces/current')
      .set('Authorization', `Bearer ${teammateNovaToken}`)
      .expect(401);

    // Owner configures enforced Microsoft SSO on Nova Labs
    await request(app.getHttpServer())
      .put('/api/workspaces/current/sso')
      .set('Authorization', `Bearer ${novaOwnerToken}`)
      .send({
        provider: 'MICROSOFT',
        domain: 'novalabs.sa',
        tenantId: 'tenant-nova-123',
        clientId: 'client-nova-123',
        clientSecret: 'super-secret-value-9999',
        enforced: true,
        autoProvision: true,
        defaultRole: 'EMPLOYEE',
        status: 'VERIFIED',
      })
      .expect(200);

    // Secrets are masked on read
    const ssoRead = await request(app.getHttpServer())
      .get('/api/workspaces/current/sso')
      .set('Authorization', `Bearer ${novaOwnerToken}`)
      .expect(200);
    expect(ssoRead.body.connection.clientSecretMasked).not.toContain('super-secret-value');
    expect(ssoRead.body.connection.clientSecretMasked).toContain('9999');

    // /auth/discover reports passwordAllowed: false when SSO is enforced
    const discoverRes = await request(app.getHttpServer())
      .post('/api/auth/discover')
      .send({ email: teammateUser.email })
      .expect(201);
    expect(discoverRes.body.passwordAllowed).toBe(false);
    expect(discoverRes.body.workspaces.some((w: any) => w.id === novaWorkspaceId && w.ssoRequired)).toBe(true);

    // Password login for teammateUser is now blocked by enforced SSO (403)
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: teammateUser.email, password: TEST_PASSWORD })
      .expect(403);
  });

  it('supports self-service account & BUSINESS workspace registration and scopes newly created employees', async () => {
    const regRes = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: 'founder@deserttech.sa',
        password: TEST_PASSWORD,
        firstName: 'Laila',
        lastName: 'Harbi',
        workspaceType: 'BUSINESS',
        workspaceName: 'Desert Tech',
      })
      .expect(201);

    expect(regRes.body.workspace.slug).toBe('desert-tech');
    expect(regRes.body.workspace.type).toBe('BUSINESS');
    expect(regRes.body.membership.role).toBe('OWNER');
    expect(regRes.body.accessToken).toBeTruthy();

    // Registering same email again returns 409 Conflict
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: 'founder@deserttech.sa',
        password: TEST_PASSWORD,
        firstName: 'Laila',
        lastName: 'Harbi',
      })
      .expect(409);

    // Owner creates an employee inside Desert Tech -> automatically gets an active Membership in Desert Tech
    const empRes = await request(app.getHttpServer())
      .post('/api/employees')
      .set('Authorization', `Bearer ${regRes.body.accessToken}`)
      .send({
        employeeId: 'EMP-DT01',
        email: 'dev@deserttech.sa',
        firstName: 'Omar',
        lastName: 'Zaid',
        role: 'EMPLOYEE',
        jobTitle: 'Backend Engineer',
        department: 'Engineering',
        isSaudi: true,
        basicSalarySar: 12000,
      })
      .expect(201);

    const membersRes = await request(app.getHttpServer())
      .get('/api/workspaces/current/members')
      .set('Authorization', `Bearer ${regRes.body.accessToken}`)
      .expect(200);

    expect(membersRes.body.some((m: any) => m.userId === empRes.body.employee.id)).toBe(true);
  });
});
