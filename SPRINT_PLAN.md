# MacqHR Delivery Tracker

> **Status**: Product Phases 1–5 implemented (mobile + API + admin prototype). Phase 6 foundation work is approved at G1 (`578b65d`). Phase 7 (M2 identity and sessions + M3 employee lifecycle + Web Admin Console UI polish) is approved at G2 (`baa3be8`). Starting Phase 8 (M4 Attendance integrity & breaks).
> **Product strategy**: Single-company v1 for Macquires first (Mobile App for Employees & Managers; Web Admin Console for HR Admin & Super Admin), followed by Phase 12 (M11 Allowances, Claims & Document Vault) and Phase 13+ (Multi-Tenant B2B SaaS Workspaces).
> **Verification**: 47 mobile tests; 103 backend unit tests in 13 suites plus `nest build`; 43 isolated-database API tests in 5 suites; 15 admin Vitest tests in 4 suites; admin production build passing (`npm run verify:all` green on 2026-11-04).
> **Release status**: G2 gate signed. Preparing Phase 8 kickoff.
> **Approver**: Talha. Every delivery phase requires a SHA-bound manual gate.
> **Forward plan**: [docs/prd/README.md](docs/prd/README.md) · **Tests**: [docs/prd/test-plan.md](docs/prd/test-plan.md) · **Review**: [docs/prd/document-review.md](docs/prd/document-review.md)
> **Last updated**: 2026-11-04

## Legend

- `[x]` Implemented and verified by the available evidence.
- `[/]` Implemented with known gaps or awaiting re-verification.
- `[ ]` Not implemented or not usable in production.
- **Demo only**: UI or payload exists, but no production-grade behavior is connected.
- **Target**: Required by the product rules, not yet implemented.

---

## Mandatory delivery policy

1. **Implement the phase scope** and its acceptance criteria from the PRD.
2. **Add automated tests** at the correct layer (unit, API, admin, or mobile logic).
3. **Run `npm run verify:all`** (mobile + backend + admin). Zero failures are required.
4. **Execute the phase manual checklist** on staging and a physical device, covering light/dark and English/Arabic.
5. **Record approval** in `docs/qa/gates/phase-<N>.md` with the full commit SHA, build identifier, device, results, defects, and your decision.
6. **Push only when the gate matches `HEAD`.** No `--no-verify`, no presence-only approval, no reused approval.

Any new commit invalidates the previous gate. See [RULES.md](RULES.md) Section 0 and the [gate template](docs/qa/gates/TEMPLATE.md).

---

## Current verification baseline (2026-11-01)

| Surface | Command | Result |
|---|---|---|
| Mobile | `npm run verify` | Typecheck passed; 47 tests passed, 0 failed |
| Backend | `npm run typecheck && npm test && npm run build` | Typecheck passed; 9 suites, 52 tests passed; build passed |
| Backend API (isolated database) | `cd backend && npm run test:e2e` | 4 suites, 17 tests passed against the isolated `macqhr_test` database, 0 failed |
| Admin tests | `cd web-admin && npm test` | 1 file, 4 Vitest cases passed, 0 failed |
| Admin build | `cd web-admin && npm run build` | Production build passed |
| Repository | `git status` | All application surfaces tracked; `ios/` source versioned; baseline migration committed |
| CI | `.github/workflows/verify.yml` | Runs `verify:all` on pull requests and `main` |

Phase 6 added CI, the Prisma baseline migration and the SHA-bound push hook. Phase 7A added isolated-database API tests and admin unit tests, so M1.3 is complete for this phase.

---

## Delivery phases (forward plan)

The detailed modules, rules, risks, and decisions are in the [PRD](docs/prd/README.md). This table is the tracking view.

| Phase | Name | Scope | Exit criteria | Gate | Status |
|---|---|---|---|---|---|
| **6** | Foundation & trust | M1, M2 stopgaps, M9 demo-control removal | Code fully tracked; `verify:all` in CI; migrations committed; secrets/CORS hardened; role switcher and prefilled credentials removed; employee PII guarded; SHA-bound push hook | G1 | `[x]` Approved at G1 (`578b65d`) |
| **7** | Identity & employee lifecycle | M2, M3 | Refresh/revocation; forced password change; rate limiting; admin employee CRUD; role/manager/branch/remote changes; SSO decision executed | G2 | `[x]` Approved at G2 (`baa3be8`) |
| **8** | Attendance integrity & breaks | M4 | Verifiable evidence; local-day boundary; two remote modes (permanent `isRemoteAllowed` vs. per-day office remote approval); `BREAK_START` / `BREAK_END` persistence; offline decision; corrections; admin attendance view/export | G3 | `[ ]` |
| **9** | Leave & approvals v2 | M5, M9 leave UX | Two-stage pipeline; balance ledger; holidays; overlap/half-day; cancellation; attachments; full calendar and types | G4 | `[ ]` |
| **10** | Admin console & notifications | M6, M7.1–M7.2 | Employee/attendance/leave admin complete; reports; audit viewer; persisted notifications and push | G5 | `[ ]` |
| **11** | Payroll, integrations & release | M7.3–M7.7, M8, M10 | Payroll run + WPS validation; Teams/Outlook dispatch; EAS builds; pinning; monitoring/backup; store/MDM | G6 | `[ ]` |
| **12** | Allowances, claims & document vault | M11 | Receipt-backed reimbursement claims (Medical, Insurance, Petrol, Wi-Fi) with policy limits & payroll integration; two-stage approval (with direct-to-HR privacy option for Medical/Insurance); employee profile Document Vault (ID/Iqama/CNIC, Passport, Insurance Card, Contracts with expiry alerts) | G7 | `[ ]` |
| **13+** | Multi-tenant SaaS workspaces | Account model D1–D5 | Upgrade single-company MacqHR into multi-tenant B2B SaaS (`Workspace`, `Membership`, per-tenant SSO, Platform Super Admin & seat billing) | — | `[ ]` Later |

---

## Phase 6 implementation (2026-10-31)

Status: **implemented, awaiting G1**. Automated verification is green; the device checklist and your signature are still required.

| Requirement | Result | Evidence |
|---|---|---|
| M1.1 All code tracked (backend, admin, docs, API clients, iOS source) | Done | Focused commits; `ios/Pods` and `ios/build` ignored |
| M1.2 `verify:all` in CI | Done | `.github/workflows/verify.yml` |
| M1.3 API tests with isolated DB; admin tests | **Partial** | 18 new backend unit/service tests (31 total); isolated DB API tests and admin tests remain |
| M1.4 Prisma migration history | Done (baseline; adopted on the local DB) | `backend/prisma/migrations/20261031000000_baseline` |
| M1.5 Fail-fast secrets and CORS | Done | `configuration.ts`, `cors.ts`, `.env.example` files |
| M1.6 SHA-bound push hook | Done | `.githooks/pre-push`, `npm run hooks:install` |
| M1.7 Monorepo README | Done | `README.md` |
| M2 Role comes from the verified session | Done | Client role switcher removed from App, Dashboard and Admin panel |
| M2 Employee PII guarded | Done | Full record only for self/HR/Super Admin; limited shape for colleagues and managers; tests added |
| M9 Demo controls removed | Done | Presets and biometric/Wi-Fi toggles deleted; login prefill removed; SSO button hidden until configured |

Decisions applied with the recommended defaults: R-02 (version iOS source), R-03 (delete `data.db`, ignore personal tooling, commit `metro.config.js`), R-04 (port 4000), R-06 (remove dead demo controls), R-07 (hide SSO until configured). R-05, R-08, R-09 and R-10 remain open for their phases.

Known Phase 6 residue: no isolated database API suite and no admin test suite (both added in Phase 7A; see the Phase 7A section below). The baseline was adopted on the existing local database on 2026-10-31 (empty schema diff, `migrate resolve --applied`, data intact); applying it with `migrate deploy` to a pristine database is still to be exercised at G1.

## Phase 7A implementation (2026-11-01)

Status: **implemented, awaiting G2**. Automated verification is green; the device checklist, the manual AUTH cases and your signature are still required. Phase 7B (M3 employee lifecycle) follows in the same gate.

| Requirement | Result | Evidence |
|---|---|---|
| M2.1 Role comes from the verified session; no client-side role presets | Done | `authenticateWithMicrosoftSso`, `resolveRoleFromEmail`, `validateAndAuthenticate` and the `DEMO_USERS` demo identities deleted (3341cd2, 62f478a); mobile login maps only the server-issued role (`src/services/authService.ts`); manual AUTH-01/AUTH-07 re-run at G2 |
| M2.2 Employee PII guarded | Done (Phase 6, unchanged) | `employees.service.spec.ts`: colleague sees the limited work profile, a manager gets no compensation, self gets the full profile without the password hash |
| M2.3 Short-lived access tokens, rotating refresh, immediate revocation | Done | 15-minute access JWT with a `sid` claim; opaque `sessionId.secret` refresh tokens stored as SHA-256; `token.util.spec.ts` (4 cases), `session.service.spec.ts` (15 cases incl. 7-day refresh / 30-day absolute / 8-hour SUPER_ADMIN, atomic rotation, replay family revocation, logout replay, `findActive` branches); `auth-session.e2e-spec.ts` AUTH-04, AUTH-05, AUTH-06, change-password revokes every session, logout leaves sibling sessions alive |
| M2.4 Forced password change | Done | Global `PasswordChangeGuard` + `code: PASSWORD_CHANGE_REQUIRED`; e2e AUTH-10 (403 on a protected route; the allowlisted change-password route still returns 201); mobile gate `src/screens/ChangePasswordScreen.tsx` with client rules in `validatePasswordChange` (TC-10.2); manual gate check EN/AR light/dark. Production onboarding that would issue a shared default password does not exist yet (closed in Phase 7B) |
| M2.5 Login throttling and lockout with a non-enumerating message | Done | `rate-limit.e2e-spec.ts` returns 429 on the sixth attempt in a minute; `auth-session.e2e-spec.ts` AUTH-02, parallel-request lockout, counter reset on success, identical generic message for unknown email, wrong password, and an inactive account with a wrong password |
| M2.6 Hardened API baseline | Done | `helmet()` on every path except `/api/docs`, 100 kB JSON/urlencoded limits and a 413 mapping for oversized bodies (`configure-app.ts`); production fail-fast for `JWT_SECRET`/`DATABASE_URL` and short secrets (`configuration.spec.ts`); CORS allowlist from Phase 6; booted-server check recorded CSP on a protected route and left the docs usable |
| M2.7 Entra SSO decision executed | Done (disabled path only) | SSO button, divider and config lookups removed from `LoginScreen`; server exchange behind `sso.enabled` with the flag test "enables Microsoft Entra SSO only for an explicit true flag". INT-01 enabled is blocked on tenant credentials — G2 limitation |
| M2.8 Admin session expiry and 401 handling | Done | `web-admin/src/__tests__/adminSession.test.ts` (4 cases: malformed/past/future token, expiry-aware loader); expiry-aware read clears `sessionStorage`; response interceptor exempts the sign-in route, clears the session and dispatches `macq:session-expired`; App returns to sign-in without reloading; no `localStorage` use |
| AUTH-09 role matrix | Unchanged, manual at G2 | Automated coverage is not claimed; Phase 6's pendency stands until the G2 manual run |
| Deactivation and role-change revocation | Enforced per request; revoke-on-write in Phase 7B | JWT strategy re-hydrates `isActive` and role on every request; the M3 endpoints that would revoke sessions on deactivation/role change land in Phase 7B (closed in Phase 7B) |

Verification on 2026-11-01 (`npm run verify:all`): mobile typecheck + 47 tests; backend typecheck + 52 unit tests + build; backend e2e 17/17 in 4 suites on the isolated `TEST_DATABASE_URL`; admin 4 Vitest cases + production build.

Known Phase 7A limitations, for the G2 gate:

- INT-01 "enabled" is blocked on an Entra test tenant; the server exchange exists behind `SSO_ENABLED` and the mobile sign-in UI is removed.
- Sessions issued before Phase 7A carry no `sid` and are invalidated on deploy; every user signs in once after the upgrade.
- Role/deactivation changes are enforced on every request by re-hydrating the user; the write-side session revocation lands with the M3 endpoints in Phase 7B (closed in Phase 7B).
- The SUPER_ADMIN 8-hour absolute session is applied at creation and re-clamped on refresh, so a promotion takes effect at the next refresh.
- The admin console has no refresh token: a session ends when its 15-minute access token expires and returns to sign-in; unsaved edits are lost.
- Throttling is in-process memory (per instance); behind a proxy or load balancer set `TRUST_PROXY` or every client shares one bucket.
- `/api/docs` is unauthenticated and exempt from helmet's CSP; restricting it remains a Phase 7 cleanup item.
- Seeded `Password123!` accounts are development fixtures; the seed refuses to run with `NODE_ENV=production`. Production onboarding and a console password-change screen are 7B (closed in Phase 7B).
- Expired and revoked `AuthSession` rows have no purge job yet.
- AUTH-09 and INT-01 on the enabled path remain manual G2 checks.

Decisions applied: SSO hidden behind `SSO_ENABLED` with the verified server exchange retained (INT-01 enabled recorded as a G2 limitation); no client-side SSO simulation remains.

---

## Phase 7 implementation (2026-11-01 → 2026-11-02)

Status: **Approved at G2** (`docs/qa/gates/phase-7.md` signed by Talha, bound to commit `47057c10ba3267d9ca46158b65c8505800be7e6e`). Phase 7B added the M3 employee lifecycle on the server and in the admin console, and closed the write-side session revocation that Phase 7A deferred.

---

## Phase 8 implementation (2026-11-04)

Status: **implemented, awaiting G3**. Phase 8 delivers Attendance Integrity, Location & Breaks (PRD M4 and design spec `docs/superpowers/specs/2026-11-01-location-attendance-design.md`). Architecture: Event-sourced workday model (`AttendanceDay` container with local day boundaries `Asia/Riyadh` and `Asia/Karachi`, `BREAK_START` / `BREAK_END` tracking, two remote modes: permanent `isRemoteAllowed` vs. per-day `RemoteWorkRequest`, non-blocking geofence checkout logging `AttendanceException`, and Web Admin + Mobile UI integration).

Verification on 2026-11-04 (`npm run verify:all`):
- Mobile: typecheck + 49 tests (`macqhr.test.ts` TC-P8.1, TC-P8.2).
- Backend: typecheck + 117 unit tests in 14 suites + `nest build`.
- Backend e2e: 47/47 in 6 suites on isolated `macqhr_test` (`attendance-day.e2e-spec.ts` 4 tests).
- Web Admin: 15 Vitest tests in 4 suites + production build (1575 modules).

| Requirement | Result | Evidence |
|---|---|---|
| M4.1 Timezone-aware day container (`AttendanceDay`) | Done | `backend/src/common/utils/timezone.util.ts`, `attendance.service.ts` `getOrCreateDay`. Unit tests: `timezone.util.spec.ts` (7), e2e `attendance-day.e2e-spec.ts` |
| M4.2 BREAK_START / BREAK_END punch types & net working minutes | Done | `attendance.service.ts` `punchBreak` / `calculateNetWorkingMinutes`. Mobile `macqhr.test.ts` TC-P8.1; e2e `attendance-day.e2e-spec.ts` M4.1/M4.3 |
| M4.3 Auto-closing active break on check-out | Done | `attendance.service.ts` auto-close hook on CHECK_OUT. Mobile `macqhr.test.ts` TC-P8.2; e2e `attendance-day.e2e-spec.ts` M4.1/M4.3 |
| M4.4 Exactly one active check-in session per local day | Done | `attendance.service.ts` state machine validation. e2e `attendance-day.e2e-spec.ts` M4.4 rejects duplicate check-in with 400 |
| M4.5 Non-blocking check-out outside branch geofence | Done | `attendance.service.ts` accepts check-out regardless of distance, updates record to `VERIFIED` |
| M4.6 AttendanceException logging & HR review workflow | Done | `AttendanceException` model (`OUTSIDE_OFFICE_GEOFENCE`). `attendance.controller.ts` `GET /api/attendance/exceptions`, `POST /api/attendance/exceptions/:id/review`. e2e `attendance-day.e2e-spec.ts` M4.1/M4.6 |
| M4.7 Dual remote mode (standing vs per-day) | Done | `attendance.service.ts` punch validator checks `user.isRemoteAllowed` OR approved `RemoteWorkRequest`. e2e `attendance-day.e2e-spec.ts` M4.8 |
| M4.8 RemoteWorkRequest submission & manager/HR decision workflow | Done | `RemoteWorkRequest` model. `attendance.controller.ts` `POST /api/attendance/remote-requests`, `POST /api/attendance/remote-requests/:id/decision`. Direct report & role checks. e2e M4.8 |
| M4.9 Web Admin Attendance View overhaul | Done | `web-admin/src/components/AttendanceView.tsx`: Subtabs (Live Radar, Exceptions Review, Remote Requests), resolve exceptions modal, approve/reject remote requests |
| M4.10 Mobile App Break & Workday Timers | Done | `App.tsx`, `src/services/backendApi.ts`: Live break toggle (`Take Break` / `End Break`), workday and break elapsed duration calculation, punch synchronization |

### G3 manual checklist (awaiting sign-off)

Do not tick any box until the case has actually been run. Copy [docs/qa/gates/TEMPLATE.md](docs/qa/gates/TEMPLATE.md) to `docs/qa/gates/phase-8.md` **only after** this checklist is executed and signed. Cases are defined in [docs/prd/test-plan.md](docs/prd/test-plan.md).

- [ ] ATT-01 Office employee inside branch geofence with valid evidence → check in accepted, marked OFFICE, day status IN_PROGRESS
- [ ] ATT-02 Office employee outside geofence → check in rejected with distance and radius (400)
- [ ] ATT-03 Remote-eligible employee (standing isRemoteAllowed) outside branch → remote check in accepted, marked REMOTE
- [ ] ATT-04 Remote-ineligible employee without approved request → remote check in rejected (403 Forbidden)
- [ ] ATT-05 Device reports mock/fake GPS provider → punch rejected with Layer 1 violation (400)
- [ ] ATT-06 GPS accuracy >50m rejected; 26–50m flagged; ≤25m accepted
- [ ] ATT-07 Device clock drifts >5 minutes from server NTP → punch rejected with Layer 3 violation (400)
- [ ] ATT-08 Rooted/jailbroken device → punch rejected with Layer 4 violation (403)
- [ ] ATT-09 Biometric verification absent/failed → punch rejected with Layer 6 violation (401)
- [ ] ATT-10 Already checked in → duplicate check-in rejected with 400; orphan check-out rejected
- [ ] ATT-11 Punch across Asia/Riyadh and Asia/Karachi on same UTC day lands on correct local day container
- [ ] ATT-12 Offline punch queue signs with HMAC and rejects tampered coordinates
- [ ] ATT-13 Employee starts and ends break within shift; break minutes persist and net working minutes exclude break
- [ ] ATT-14 Non-blocking check-out outside geofence accepted and logs OUTSIDE_OFFICE_GEOFENCE AttendanceException
- [ ] ATT-15 RemoteWorkRequest submitted by employee and approved by manager elevates workday mode to REMOTE and permits remote punch

Verification on 2026-11-02 (`npm run verify:all`): mobile typecheck + 47 tests; backend typecheck + 101 unit tests in 12 suites + `nest build`; backend e2e 43/43 in 5 suites on the isolated `macqhr_test` database (`employees.e2e-spec.ts` 26); admin 12 Vitest tests in 3 suites + production build (1572 modules).

This run supersedes the [2026-11-01 baseline](#current-verification-baseline-2026-11-01) table above; the Phase 7A rows keep the counts recorded when that section was written.

- Fix round 1 (2026-11-02): added `GET /api/employees/:id/pending-approvals`, which `DeactivateEmployeeDialog` reads before deactivation (`employees.e2e-spec.ts` "M3.6: reports a manager's pending approvals before deactivation"; `employees.service.spec.ts` "delegates the count to the organization guard" and "returns not found for an unknown employee and never counts"), and closed the HR→SUPER_ADMIN demotion hole in `employment-changes.service.ts` (`employment-changes.service.spec.ts` "forbids an HR admin from demoting a Super Admin before any write", "lets a Super Admin demote another Super Admin once retention is proven"). The automated counts above were re-run after these fixes: mobile 47 tests, backend 101 unit tests in 12 suites, e2e 42/42 in 5 suites, admin 12 Vitest tests in 3 suites.
- Final whole-branch review fix (2026-11-02): deactivation now removes the person from the live Who's Off list. `DirectoryService.getWhosOffToday()` filters approved leave to active users and the admin Overview card counts only active-roster employees (`employees.e2e-spec.ts` "M3.5: deactivation removes the person from Who's Off but keeps approved history" proves removal and that the approved row survives). This is the fix that moves e2e to 43/43 (`employees.e2e-spec.ts` 26).

| Requirement | Result | Evidence |
|---|---|---|
| M2.1 Role comes from the verified session | Done (Phase 7A) | Phase 7A row M2.1: client role presets and `DEMO_USERS` deleted; mobile login maps only the server-issued role. Re-verified by the 2026-11-02 gate; manual AUTH-01 at G2 |
| M2.2 Employee PII guarded | Done (Phase 6) | Phase 7A row M2.2; `employees.service.spec.ts` "returns only the limited work profile to a colleague", "does not give a manager access to compensation", "returns the full profile to the employee themselves and strips the hash" |
| M2.3 Short-lived access tokens, rotating refresh, immediate revocation | Done; write-side revocation now exercised | Phase 7A row M2.3 (`token.util.spec.ts`, `session.service.spec.ts`, `auth-session.e2e-spec.ts` AUTH-04/05/06). Phase 7B adds `employment-changes.service.spec.ts` "revokes sessions when the role changes", and e2e EMP-06, EMP-07, EMP-10 |
| M2.4 Forced password change | Done | Phase 7A row M2.4 (`PasswordChangeGuard`, e2e AUTH-10). Phase 7B onboarding and reset issue temporary credentials that must be changed: e2e EMP-01, EMP-10 |
| M2.5 Login throttling and lockout | Done | Phase 7A row M2.5: `rate-limit.e2e-spec.ts` 429 on the sixth attempt; `auth-session.e2e-spec.ts` AUTH-02 and the non-enumerating message cases. Unchanged in Phase 7B |
| M2.6 Hardened API baseline | Done | Phase 7A row M2.6: helmet, 100 kB body limits with the 413 mapping, production fail-fast secrets, CORS allowlist. Unchanged in Phase 7B |
| M2.7 Entra SSO decision executed | Done (disabled path only) | Phase 7A row M2.7; the `sso.enabled` flag test "enables Microsoft Entra SSO only for an explicit true flag". INT-01 enabled remains a G2 limitation |
| M2.8 Admin session expiry and 401 handling | Done | Phase 7A row M2.8: `web-admin/src/__tests__/adminSession.test.ts` (malformed/past/future token, expiry-aware loader). The new employee screens sit behind the same guard |
| M3.1 Paginated, searchable, filterable employee list | Done | `employees.e2e-spec.ts` "pages, searches, and filters inactive employees for HR", "reports the filtered total across pages and never repeats a row", "returns the documented envelope with default paging when called with no query", "rejects page sizes outside 1..100 and pages above 10000", "ignores a whitespace-only search term", "keeps tied names ordered across pages (sort=name)", "AUTH-09: employees and managers cannot read the admin list". The admin list is server-paginated; `web-admin/src/components/EmployeesView.tsx` keeps search, filters and sort server-side |
| M3.2 Create employee with a temporary credential and seeded balances | Done | e2e EMP-01 "creates an employee who can sign in and must change the temporary password"; EMP-02 duplicate rejection; "rejects duplicate leave types in the initial balances with a 400"; "forbids an HR admin from creating a super admin and creates no user"; "rejects a non-existent or inactive manager with a 400"; `credentials.util.spec.ts` "produces four distinct 16-character credentials with every character class" |
| M3.3 Edit employee profile; identity stays immutable | Done | e2e "rejects email and employee ID changes"; "audits a profile edit minimally and recomputes fullName". Salary, role, manager, branch and remote edits deliberately go through the change ledger (M3.4) so each is effective-dated and audited |
| M3.4 Transfer, promotion, salary and remote changes with an effective date | Done | `backend/test/employees.e2e-spec.ts` e2e EMP-04, EMP-05, EMP-06; `employment-changes.service.spec.ts` (21 cases) incl. "rejects future effective dates", "writes a salary record and updates current columns", "records the before and after state in the ledger", "records who granted remote eligibility", "revokes sessions when the role changes" |
| M3.5 Deactivate and reactivate with a reason, preserving history | Done | e2e EMP-07 "deactivation blocks sign-in, revokes tokens, and hides the person" (asserts the directory no longer returns the person) and "Reactivating restores sign-in and is audited"; e2e "M3.5: deactivation removes the person from Who's Off but keeps approved history" (removal from `/directory/whos-off` plus the untouched APPROVED row; the admin Overview card counts only the active roster); `employees.service.spec.ts` "guards retention, cancels live leave, and audits inside the deactivation transaction" |
| M3.6 Organization safeguards | Done | `backend/test/employees.e2e-spec.ts` e2e EMP-08, EMP-09 and "M3.6: reports a manager's pending approvals before deactivation"; `organization-guard.service.spec.ts` (17 cases) incl. "rejects self-management", "rejects a cycle that closes at depth 2 or deeper", "detects a cycle that closes more than 50 hops away", "refuses to remove the last active Super Admin"; its `pendingApprovalsFor` cases incl. "counts a non-admin manager's active direct reports' pending requests" and "returns 0 for an unknown target without querying leave requests". `GET /api/employees/:id/pending-approvals` (HR-gated) returns the manager's pending-approval count and `DeactivateEmployeeDialog` renders it as an extra warning line; the count warns but does not block deactivation |
| M3.7 Admin password reset with forced change | Done | `backend/test/employees.e2e-spec.ts` e2e EMP-10 "resetting a password revokes sessions and forces a change"; `employees.service.spec.ts` "stores a bcrypt hash, clears lockout, and audits inside the transaction", "forbids an HR admin from resetting a Super Admin password". Admin flow: `TemporaryPasswordModal` plus a forced change on next sign-in |

Known Phase 7B limitations, for the G2 gate:

- INT-01 on the enabled path is blocked on an Entra test tenant; the disabled path is covered by automated/config evidence.
- The mobile app does not surface M3 admin actions; the lifecycle is console-only by design.
- The admin console still has no refresh token, so a 15-minute access token ends the session and unsaved drawer edits are lost.
- The "manager with pending approvals" warning is informational only: `GET /api/employees/:id/pending-approvals` counts the queue and `DeactivateEmployeeDialog` shows it, but deactivation is not blocked by it.

### G2 manual checklist (not executed)

Do not tick any box until the case has actually been run. Copy [docs/qa/gates/TEMPLATE.md](docs/qa/gates/TEMPLATE.md) to `docs/qa/gates/phase-7.md` **only after** this checklist is executed and signed; the record is bound to the gate commit SHA, so any later fix commit invalidates it. Cases are defined in [docs/prd/test-plan.md](docs/prd/test-plan.md).

Preconditions: staging build at the gate commit, physical device, backend and admin console at the same SHA, test Entra tenant available for the INT-01 attempt.

**P0 — blocking**

- [ ] AUTH-01 active employee signs in; the dashboard renders only the server-issued role
- [ ] AUTH-03 deactivated account is refused with a support-oriented message and no token
- [ ] AUTH-06 logout revokes the server session and clears local storage; protected calls fail immediately
- [ ] AUTH-10 a new employee signs in with the temporary credential and must change it before anything else
- [ ] EMP-01 HR creates an employee who appears in the directory, can sign in, and has seeded balances
- [ ] EMP-03 a new hire's leave request appears in Manager A's queue only (automated: `backend/test/employees.e2e-spec.ts` "EMP-03: a new hire lands only in their own manager queue"; the manual case still runs at G2)
- [ ] EMP-07 a deactivated employee cannot sign in and disappears from directory, Who's Off and approval queues, with history intact
- [ ] INT-01 SSO disabled path: the sign-in UI shows no SSO control and no "not configured" dead end

**P1 — pass list**

- [ ] AUTH-02 repeated wrong passwords return one generic message and then throttle without enumeration
- [ ] AUTH-04 an access token near expiry refreshes transparently
- [ ] AUTH-05 a reused refresh token is rejected and the session family is revoked
- [ ] AUTH-09 an employee or manager token gets 403 on HR-only endpoints and the UI never offers them
- [ ] EMP-02 a duplicate email or employee ID is rejected with a field-specific conflict and no partial record
- [ ] EMP-04 a transfer to Jeddah with an effective date governs later punches while history stays on Riyadh
- [ ] EMP-05 a remote-eligibility grant takes effect on the next punch and records the grantor and time
- [ ] EMP-06 a promotion revokes existing sessions and the next sign-in carries Manager capability
- [ ] EMP-08 deactivating or demoting the last active Super Admin is refused with a clear reason
- [ ] EMP-09 a self-manager or descendant manager is rejected and the hierarchy stays acyclic
- [ ] EMP-10 (Phase 7 P1, automation-covered, not in the G2 row) an admin reset revokes sessions and forces a change on next sign-in

**Gate limitation**

- **INT-01** enabled path: disabled path covered by automated/config evidence; enabled path blocked on Entra tenant credentials. It is not claimed as passing.

**Localization and theme pass (new admin employee surfaces)**

The admin console language toggle (`EN`/`AR`, `dir=rtl`) and theme toggle (light/dark) must be exercised on each surface below.

- [ ] Employees list: search, department/branch/status filters, sort, paging, active/remote/inactive labels
- [ ] Create-employee drawer: field labels, validation errors, and the temporary-password modal
- [ ] Profile/edit drawer: read view, edit form, immutable email/employee ID messaging
- [ ] Employment-change drawer: transfer, promotion, salary and remote-eligibility forms with the effective date
- [ ] Deactivate/reactivate dialog: reason field, the pending-approvals warning with its count in EN and AR, last-Super-Admin and cycle errors
- [ ] Reset-password flow: confirmation, temporary-password display, error states
- [ ] All of the above read correctly in Arabic (RTL alignment, no clipped text) and in dark mode (contrast, borders, dialogs)

---

## Product phase log (prototype)

These are the phases that produced the current code. They are **not** the same as delivery Phases 6–11.

| Product phase | Commit(s) | Scope | Evidence | Gate status |
|---|---|---|---|---|
| Phase 1 | `a03fb7e` | Dashboard header, TS contracts | 48-test suite includes phase-1 cases | Legacy manual check; no SHA-bound record |
| Phase 2 | `8af771a` | Four-card actions layout, arrange modal | TC-P2.1–P2.5 | Legacy manual check |
| Phase 3 | `35a399e`, `88d7f29` | Who's Off modal, filters, metadata | TC-P3.1–P3.3 | Legacy manual check |
| Phase 4 | `0d4701a` | Pakistan remote clock-in, Riyadh HQ awareness | TC-P4.1–P4.3 | Legacy manual check |
| Phase 5 | `4c41454` | Org structure, Employee–Manager–HR leave pipeline, admin panel | TC-P5.1–P5.5 | **Invalid**: `.manual-qa-approved` predates this commit and is not SHA-bound |
| Sprints 6–9 | `87d3975` | Bottom nav, logo, sidebar, profile, RBAC skeleton | TC-6.x–TC-9.x | Legacy manual check |
| Maps/GPS | `5a4f190` | Maps, street tiles, geofence, app config | TC-2.x | Legacy manual check |

Phase 5 must be re-verified at G1 against the production rules in the PRD. The existing approval file is historical only and must not authorize a new push.

---

## Historical prototype log

### Sprint 1 — Audit, rules, tracking

- `[x]` Codebase audit, rules definition, sprint tracking.
- Evidence: this repository's early documentation.
- Note: the rules describe target behavior; they were not a production verification.

### Sprint 2 — Location, maps, anti-spoofing prototype

- `[x]` `expo-location`, permissions, map/radar screen, Haversine, accuracy filter, mock/root/drift checks.
- `[/]` QA simulation presets exist in `useLocationSecurity.ts`, but no UI strip is exposed. **Phase 6 removed the unused presets and biometric/Wi-Fi toggles.**
- **Demo only**: mock/root/biometric outcomes are client-reported. Server attestation is a Phase 8 requirement.
- Tests: `TC-2.1`–`TC-2.9` (9/9 passing at the utility layer).

### Sprint 3 — Microsoft 365, offline checksum, GOSI prototype

- `[x]` Teams presence mapping, Adaptive Card payload, Outlook OOO payload, FNV-1a checksum, GOSI/WPS math.
- **Demo only**: no Graph network dispatch, no token flow, no SSO session. **Phase 6 hides the SSO button until the Entra client is configured.**
- **Demo only**: offline queue signing is a 32-bit non-keyed checksum, not cryptographic signing. Sync is disabled server-side.
- Tests: `TC-3.1`–`TC-3.3`, `TC-4.1`, `TC-5.1` (5/5).

### Sprint 4 — Backend API and database

Superseded by delivery Phases 6–7.

- `[x]` NestJS + Prisma + PostgreSQL backend exists with auth, attendance, leave, employee, payroll, and directory endpoints.
- `[/]` PostgreSQL without PostGIS; geofencing uses Haversine in application code.
- `[x]` A baseline Prisma migration is committed in Phase 6.
- `[ ]` API end-to-end tests with an isolated database and production hardening.
- `[ ]` Multi-tier approvals.

### Sprint 5 — Production build and release

Superseded by delivery Phase 11.

- `[ ]` EAS build profiles and signed artifacts.
- `[ ]` Certificate pinning and native hardening.
- `[ ]` Store/MDM release and field testing.

### Sprint 6 — Bottom navigation

- `[x]` Bezier cradle geometry and flush safe-area attachment.
- `[x]` Light/dark visual verification recorded during prototyping.

### Sprint 7 — Concept A logo

- `[x]` SVG logo specification, standalone asset, reusable component, header/lock-screen integration.
- `[x]` `TC-7.1`–`TC-7.2`.

### Sprint 8 — Executive sidebar and profile editor

- `[x]` Logo-triggered sidebar, avatar/full name/phone editing, settings relocation.
- `[x]` `TC-8.1`–`TC-8.3`.
- `[/]` Profile edits are local to the session until backend synchronization is added.

### Sprint 9 — Dashboard optimization and RBAC filtering

- `[x]` Tiered skeleton hydration, virtualized list, role-filtered dashboard sections.
- `[/]` RBAC filtering is **client-side presentation only**. It is not authorization. Server authority is a Phase 6–7 requirement.
- Historical milestone: 26 tests at that point; current suite is 47.

### Sprint 10 — Login screen and session

- `[x]` Login screen, backend password login, session restore, logout.
- `[/]` Task 10.4 manual verification is unresolved; the existing approval record is stale.
- **Demo only**: Microsoft 365 sign-in button is not configured.
- Historical milestone: 30 tests at that point; current suite is 47.

---

## Known gaps (summarized)

| Gap | Impact | Owner phase |
|---|---|---|
| M1.3 partially resolved: isolated-DB API tests and admin unit tests now exist (Phase 7A); admin component tests do not | Console UI regressions still rely on manual gates | follow-up |
| Migration upgrade not exercised on an existing database copy | Adoption risk for the current local database | 6 (G1 condition) |
| Client-asserted anti-spoofing | Attendance verdicts are spoofable | 8 |
| Single-stage leave, no balance ledger | Policy mismatch and drift | 9 |
| UTC day boundary; no breaks/working minutes | Wrong day and summaries | 8 |
| Offline sync disabled but UI queues | Possible data loss | 8 |
| Teams/Outlook not dispatched | Payloads are generated but nothing is sent | 10–11 |
| Payroll has no period run or lock | WPS totals are unstable | 11 |
| Swagger is exposed in all environments | API surface disclosure | 7 |

Full findings and proposed fixes: [document review](docs/prd/document-review.md).

---

## How to verify locally

```bash
# Mobile (typecheck + 47 tests)
npm run verify

# Backend (typecheck + 101 tests + build)
cd backend && npm run typecheck && npm test && npm run build

# Backend API against the isolated test database
cd backend && npm run test:e2e

# Admin (unit tests + production build)
cd web-admin && npm test && npm run build

# Everything
npm run verify:all
```

The pre-push hook is installed with `npm run hooks:install`. It runs `verify:all` and requires an APPROVED gate in `docs/qa/gates/` matching the pushed commit SHA. No `--no-verify`.

---

## Definition of done (per phase)

- Acceptance criteria met and demonstrated on staging.
- Automated tests added at the correct layer.
- Manual checklist executed on a device.
- Light/dark and English/Arabic verified for every changed screen.
- No S1/S2 defect; S3/S4 logged with workaround.
- Migration and rollback verified if the schema changed.
- Gate file signed by Talha with the exact commit SHA.
