# MacqHR — Product Requirements & Delivery Plan (Phases 6–11)

**Version**: 1.0 (approved at G0)
**Owner**: Talha — Macquires
**Approver**: Talha (manual sign-off required at every gate)
**Date**: 31 October 2026
**Status**: Approved at G0 on 31 October 2026. Phase 6 is implemented and awaiting G1.
**Supersedes for forward work**: the unchecked Phase 4–5 items and stale status lines in [`SPRINT_PLAN.md`](../../SPRINT_PLAN.md)
**Companions**: [Test plan](./test-plan.md) · [Document review](./document-review.md) · [Account model](../account-model/README.md) · [Demo storyboard](../demo/README.md)

---

## 0. How to use this document

This PRD defines **what we will build next, in what order, how it will be tested, and how you approve it**.

- **Sections 1–5** are the product context and scope.
- **Section 6** defines modules and required behavior.
- **Section 7** sequences the work into six phases.
- **Sections 8–9** define the working agreement and your manual approval gates.
- **Section 10** points to 90 detailed test cases; **Sections 11–16** cover non-functional requirements, telemetry, risks, and open decisions.

Anything labelled **Proposed** is a recommendation that needs your confirmation. Nothing marked Proposed is a commitment yet.

### In scope

Production-ready MacqHR v1 for Macquires: mobile app, NestJS API, PostgreSQL database, and web administration console, covering employee self-service, attendance, leave, approvals, payroll export, notifications, and the operational controls needed to run it safely.

### Out of scope for Phases 6–11

- Multi-tenant workspaces, personal (B2C) accounts, entitlements, billing — designed in [docs/account-model](../account-model/README.md), scheduled after v1.
- Google Workspace SSO (Microsoft Entra only in this plan).
- Native app rewrite; we continue with Expo/React Native.
- Full general-ledger accounting. Payroll scope is defined in M8.

---

## 1. Background and current baseline

MacqHR is an employee self-service HRMS for Macquires. The mobile app and backend already cover the core daily loop: sign in, see balances, clock in/out, request leave, approve leave, view attendance and payslips. The admin console covers login, overview, branches, leave decisions, a read-only employee list, and payroll export.

The problem is not missing screens. It is that **the current demo-level foundation cannot be trusted as a production system yet**:

- Safety signals used to approve attendance are supplied by the client and accepted by the server.
- Leave approval is single-stage even though the data model defines a two-stage status enum.
- Balances are mutated without a ledger or transaction, so they can drift.
- The repository does not contain the backend, admin console, API clients, or docs in version control, and the iOS native fix is git-ignored.
- The manual QA approval file is older than the latest commit and is not tied to a commit SHA.
- There is no CI, no database migration history, and no automated API or admin tests.

The next six phases turn this into a dependable product rather than adding more surface area.

### 1.1 What is real today

| Area | State | Evidence |
|---|---|---|
| Mobile sign-in | Real API login with bcrypt + JWT | `src/services/authService.ts`, `backend/src/modules/auth/auth.service.ts` |
| Attendance punch | Real API; geofence/accuracy/drift/root/biometric checks | `backend/src/modules/attendance/attendance.service.ts` |
| Leave submit/decide | Real API; balances seeded; single-stage decision | `backend/src/modules/leaves/leaves.service.ts` |
| Directory / Who's Off / payslip / team attendance | Real API reads | `backend/src/modules/directory`, `payroll`, `attendance` |
| Admin login, branches, leave decisions, payroll export | Real API | `web-admin/src/api/client.ts`, `web-admin/src/components` |
| Verification | 48 mobile tests, 31 backend tests, admin build | `npm run verify`, `backend npm test`, `web-admin npm run build` |

### 1.2 What is demo or incomplete

| Area | Gap |
|---|---|
| Role switching | **Resolved in Phase 6**: the client switcher is removed; role comes from the verified session |
| Anti-spoofing | `isMockLocation`, `isDeviceRooted`, `biometricVerified` are client-reported booleans; Wi-Fi/BLE are not verified |
| Offline attendance | UI queues punches; `POST /attendance/offline-sync` always returns 403 |
| Teams / Outlook | Adaptive Card and calendar payloads are generated but never dispatched; the SSO button is hidden until Entra is configured |
| Leave request UI | Current month only, fixed default days 11–23, five types, Emergency maps to `UNPAID`, no success state |
| Approvals | Single stage; no self-approval guard, cancellation, overlap check, holiday calendar, or attachment upload |
| Payroll | Computed on the fly from salary fields; no payroll run, unpaid-leave deduction, overtime, or persisted payslip |
| Admin employees | Read-only list; create/update endpoints exist but no UI |
| Repository | **Resolved in Phase 6**: all surfaces tracked, iOS source versioned, baseline migration committed |
| Release | CI added in Phase 6; still no EAS configuration, certificate pinning, or store/MDM package |

---

## 2. Goals and success measures

### 2.1 Product goals

1. **Trust**: every attendance and leave decision is backed by server-verifiable evidence and an audit trail.
2. **Correctness**: balances, approvals, and payroll totals reconcile exactly with stored records.
3. **Completeness**: employees and HR can finish their real daily tasks without a developer or a spreadsheet.
4. **Operability**: the team can deploy, migrate, monitor, and roll back without guesswork.
5. **Approval discipline**: no phase reaches `main` or production without your manual sign-off.

### 2.2 Success measures (proposed — confirm targets)

| Measure | Target | Measurement |
|---|---|---|
| Gate compliance | 100% of phases have a signed gate file matching the pushed commit | `docs/qa/gates/` + pre-push hook |
| Open release defects | 0 S1, 0 S2 at release | Defect log in each gate |
| API correctness | 100% of P0/P1 API tests pass on staging | Test plan execution record |
| Attendance integrity | 0 accepted punches with a known spoof signal in staging test suite | Security test set |
| Balance reconciliation | 0 mismatches between ledger and `total − used` across test fixtures | Reconciliation query/test |
| API latency | p95 < 400 ms for authenticated reads, < 800 ms for punch/decision writes | Staging monitoring |
| Mobile cold start | < 3.0 s on an iPhone 12-class device, warm < 1.5 s | Device measurement |
| Crash-free sessions | ≥ 99.5% | Crash reporting |
| Admin accessibility | WCAG 2.1 AA for core flows | Manual audit + automated scan |

Baselines for latency, cold start, and crash-free rate must be captured in Phase 6 before targets are frozen.

---

## 3. Users and permissions

### 3.1 Roles

| Role | Who | Primary jobs |
|---|---|---|
| **Employee** | All staff, including the Pakistan remote hub | Clock in/out, request leave, view own attendance, balances, payslip, directory, notifications |
| **Manager** | Line managers with direct reports | Review team attendance, approve/reject leave stage 1, see team availability |
| **HR Admin** | People operations | Manage employees, branches, leave stage 2, attendance corrections, payroll export, reports, audit |
| **Super Admin** | System owner | Everything HR can do, plus configuration and emergency access; exempt from punches |

### 3.2 Permission matrix (target)

| Capability | Employee | Manager | HR Admin | Super Admin |
|---|---|---|---|---|
| View own profile, attendance, leave, payslip | Yes | Yes | Yes | Yes |
| View team attendance and leave requests | No | Direct reports | All | All |
| Approve leave — stage 1 | No | Direct reports | Any (override) | Any |
| Approve leave — stage 2 | No | No | Yes | Yes |
| Create/update employee, role, manager, branch, remote flag | No | No | Yes | Yes |
| Manage branches and geofences | No | No | Yes | Yes |
| Correct attendance | No | No | Yes | Yes |
| Run payroll / export WPS | No | No | Yes | Yes |
| View audit log | No | No | Yes | Yes |
| Configure integrations | No | No | No | Yes |
| Deactivate an HR/Super Admin | No | No | No | Yes |

**Rules**

- Authorization is always server-side. The client may hide UI, but must never grant capability.
- The client role switcher is removed in Phase 6. Role comes from the verified session only.
- A manager cannot approve their own request; it routes to HR.
- The last active Super Admin cannot be deactivated or demoted.
- Salary, national ID, and Iqama are visible only to the employee themselves and HR/Super Admin. Managers see attendance and leave, not compensation.

---

## 4. Product principles

1. **Server decides, client suggests.** Any security-relevant value from the device is evidence to be verified, not a verdict.
2. **Every state change is auditable.** Approvals, corrections, role changes, exports, and rejections produce an audit entry.
3. **No silent success.** Every submit either shows a confirmed result or a specific, actionable error.
4. **One source of truth.** Balances, attendance days, and payroll are derived from stored records, never from UI counters.
5. **Manual approval is a feature.** A green test suite does not replace your review on a real device.
6. **Change only what the phase needs.** Every other screen and behavior stays as-is.

---

## 5. Module map

| ID | Module | Phase | Outcome |
|---|---|---|---|
| M1 | Repository, CI & environment foundation | 6 | Code is fully versioned; every change is verified automatically |
| M2 | Identity, session & access control | 6–7 | Server-authoritative roles, safe sessions, no demo bypasses |
| M3 | Employee lifecycle & organization administration | 7 | HR can onboard, transfer, promote, and deactivate without SQL |
| M4 | Attendance integrity & corrections | 8 | Punches are trustworthy; days, breaks, time zones, and fixes are correct |
| M5 | Leave & approvals v2 | 9 | Two-stage approvals, ledger-backed balances, real calendars and attachments |
| M6 | Web administration console completion | 10 | HR runs daily operations from the console, not from the API |
| M7 | Notifications & Microsoft 365 integration | 10–11 | In-app notifications persist; Teams/Outlook dispatch with retry |
| M8 | Payroll & compliance | 11 | Period-based payroll run, unpaid leave, WPS export that validates |
| M9 | Mobile product completeness & accessibility | 6–11 | Every core flow has success, error, empty, offline, RTL, and dark-mode states |
| M10 | Release, observability & tenancy readiness | 11 | Signed builds, monitoring, backups, rollback, and a path to workspaces |

---

## 6. Module requirements

### M1 — Repository, CI & environment foundation (Phase 6)

**Outcome**: the repository is the single source of truth; a clean clone plus documented configuration can run and verify the whole system.

**Requirements**

- **M1.1** Commit all application code: `backend/`, `web-admin/`, `docs/`, `src/services/backendApi.ts`, `src/services/authStorage.ts`, and the iOS native project or a documented reproducible prebuild. Decide explicitly whether `ios/` is versioned or generated; the current ignored state hides a required AppDelegate/scene fix.
- **M1.2** Add a root `verify:all` gate to CI: mobile typecheck + tests, backend typecheck + tests + build, admin typecheck + build.
- **M1.3** Add backend API tests with an isolated test database; add admin unit/component tests for auth, data mapping, and permissions.
- **M1.4** Introduce Prisma migration history. The database must be creatable from zero and upgradeable from the current schema without data loss.
- **M1.5** Remove committed/fallback secrets and fail fast when required environment variables are missing. Document every variable in `.env.example` files for root, backend, and admin.
- **M1.6** Replace the current push hook with a gate that runs `verify:all` and requires a phase approval file matching `HEAD`.
- **M1.7** Add a root README that describes mobile, backend, and admin setup, ports, seed data, and the verification commands.

**Acceptance**

- A fresh clone followed by the documented setup runs all three surfaces.
- CI passes on a pull request and blocks merge on failure.
- `git status` is clean after setup; no required source file is untracked.
- A database created only from committed migrations matches the Prisma schema.

**Phase 6 status (2026-10-31)**: M1.1, M1.2, M1.4–M1.7 are implemented. M1.3 is partial: backend unit/service coverage was added, but isolated-database API tests and admin unit/component tests are outstanding. The baseline migration was adopted on the existing local database on 2026-10-31: the live schema diffed clean against the Prisma schema, `migrate resolve --applied` recorded it, and row counts were unchanged. Applying it with `migrate deploy` to a pristine database is still to be exercised at G1. G1 is pending.

**Out of scope**: deployment infrastructure and production hosting (M10).

---

### M2 — Identity, session & access control (Phases 6–7)

**Outcome**: only the server can grant a role or permission, and sessions can be safely ended.

**Phase 7A status (2026-11-01)**: M2.1 and M2.3–M2.8 are implemented on the server, the mobile app and the admin console; M2.2 remains as delivered in Phase 6. The Entra SSO requirement is met on the disabled path only: the sign-in UI is removed and the server exchange is gated behind `SSO_ENABLED`; end-to-end SSO (INT-01 enabled) is recorded as a G2 limitation pending a test tenant. Deactivation and role changes are enforced on every request by re-hydrating the user; write-side session revocation now exists — deactivation, role changes and admin password resets revoke every session (Phase 7B). G2 is pending the manual checklist and signature.

**Requirements**

- **M2.1** Remove all client-side role mutation and demo role presets. The dashboard renders strictly from the authenticated session.
- **M2.2** Restrict employee detail access. `GET /employees/:id` must return full salary/ID data only to the employee, HR Admin, or Super Admin; others receive a limited directory view.
- **M2.3** Add short-lived access tokens with refresh and server-side revocation (logout, password change, role change, deactivation). A revoked token must fail on the next request.
- **M2.4** Force a password change on first sign-in and after an admin reset; remove the shared default password from production onboarding.
- **M2.5** Add login rate limiting and account lockout with a safe, non-enumerating error message.
- **M2.6** Harden the API baseline: security headers, strict CORS allowlist, request size limits, and no default JWT secret in any environment.
- **M2.7** Make Microsoft Entra SSO either work end to end (authorization code + PKCE, token verification, account linking) or be hidden behind a configuration flag. A button that always says "not configured" is not acceptable in a release build.
- **M2.8** Admin console sessions expire with the token, handle 401 by returning to login, and never store tokens in `localStorage`.

**Rules**

- Role and manager changes invalidate existing sessions.
- Failed login messages never reveal whether the email exists.
- Super Admin accounts require the strongest session policy (proposed: 8-hour absolute lifetime).
- SSO users cannot bypass an enforced SSO policy with a password.

**Acceptance**

- An employee token cannot read another employee's salary or call HR endpoints.
- Logout and deactivation revoke access immediately.
- No UI path can display Manager/HR capabilities to an Employee session.
- First login with a temporary password requires a change before any other action.

---

### M3 — Employee lifecycle & organization administration (Phase 7)

**Outcome**: HR can run the employee lifecycle from the admin console.

**Phase 7B status (2026-11-02)**: M3.1–M3.7 are implemented on the server and in the admin console, and the write-side session revocation deferred in Phase 7A now exists. Automated evidence is green: `npm run verify:all` covers 47 mobile tests; backend typecheck, 97 unit tests in 12 suites and `nest build`; 41 API tests in 5 suites against the isolated `macqhr_test` database (`employees.e2e-spec.ts` 24 cases); 12 admin Vitest tests in 3 suites and a production build. The manual G2 checklist has not been executed; it is recorded, unchecked, in `SPRINT_PLAN.md`, and the SHA-bound `docs/qa/gates/phase-7.md` will be created only after it runs and Talha signs it. INT-01's enabled path remains blocked on a test Entra tenant.

**Requirements**

- **M3.1** Employee list with search, department/branch filters, status filter, sorting, and pagination.
- **M3.2** Create employee: identity, contact, employment, salary, branch, manager, role, remote eligibility, and initial leave balances. Show a generated temporary credential flow; never email a shared password.
- **M3.3** Edit employee: name, contact, title, department, salary, branch, manager, role, remote eligibility, and active status.
- **M3.4** Transfer and promotion actions with an effective date and audit entry.
- **M3.5** Deactivate/reactivate with a reason; deactivation removes the person from directory, Who's Off, and approvals queues but preserves history.
- **M3.6** Organization safeguards: no self-manager, no reporting cycles, no removal of the last Super Admin, and a warning when a manager with pending approvals is deactivated.
- **M3.7** Admin-initiated password reset with a one-time link or temporary password and forced change.

**Rules**

- Employee ID and email remain unique and immutable after creation (email change requires HR approval).
- Salary changes are effective-dated and never rewrite historical payslips.
- Role change takes effect on the next token issuance; existing sessions are revoked.
- Remote eligibility is a per-employee decision recorded with who granted it and when.

**Acceptance**

- A new employee can sign in, see seeded balances, and appear in the directory without developer involvement.
- A manager change immediately changes whose requests appear in that manager's queue.
- A deactivated employee cannot sign in and no longer appears in colleague lists.

---

### M4 — Attendance integrity & corrections (Phase 8)

**Outcome**: attendance records reflect verified presence and local working days, and mistakes can be corrected without editing the database.

**Requirements**

- **M4.1** Treat client signals as untrusted. A punch is accepted only when device integrity and biometric evidence can be verified or attested according to an agreed policy; otherwise it is rejected or explicitly flagged and excluded from auto-approval.
- **M4.2** Define and implement the day boundary per employee work location (proposed: Asia/Riyadh for office and Saudi-based staff, Asia/Karachi for the Pakistan remote hub). `dateIso`, team views, Who's Off, and reports must use the same boundary.
- **M4.3** Persist breaks: start/end events, total break minutes, and net working minutes. The current UI-only toggle is not sufficient.
- **M4.4** Enforce one open check-in per employee per workday and prevent duplicate/concurrent punches.
- **M4.5** Offline attendance: queue punches locally with tamper evidence, sync exactly once, show pending/synced/failed states, and reject tampered or stale submissions. If secure device signing is not ready, the feature stays disabled and hidden rather than pretending to work.
- **M4.6** Attendance correction workflow: employee requests a fix with date, type, time, and reason; manager/HR approves or rejects; the original record is preserved and the correction is auditable.
- **M4.7** Admin attendance view: filters by date, branch, status, work mode; drill-down to punch telemetry; CSV export.
- **M4.8** Handle remote work explicitly: approved remote punches are marked `REMOTE`, still pass integrity checks, and are visible to the manager.
- **M4.9** Exempt roles (Super Admin) and attendance-exempt employees are handled consistently and visibly.

**Rules**

- The server timestamp is authoritative; client time drift beyond the configured threshold is rejected.
- A punch outside the geofence is rejected for office mode even if Wi-Fi/BLE hints are present, unless policy explicitly allows a network fallback.
- Corrections never delete the original punch; they create an adjustment with before/after values.
- Overtime is calculated only from approved policy, not from raw elapsed time.

**Acceptance**

- A spoofed, rooted, mocked, or unattested device cannot produce an accepted office punch.
- A 00:30 Riyadh punch appears on the correct local day in mobile, admin, and exports.
- A correction changes the day's status and net minutes, and both the request and decision appear in the audit log.
- Offline punches either sync exactly once with verifiable integrity or remain clearly pending; no silent loss.

---

### M5 — Leave & approvals v2 (Phase 9)

**Outcome**: leave requests follow the real Macquires approval chain, balances reconcile, and employees can request any supported leave for any valid date.

**Requirements**

- **M5.1** Two-stage pipeline: `PENDING_MANAGER → PENDING_HR → APPROVED`, with rejection at either stage. HR may override stage 1 when policy allows, with a recorded reason.
- **M5.2** Balance ledger: every accrual, usage, adjustment, carryover, encashment, and cancellation is an immutable entry. `remaining` is derived, not independently edited.
- **M5.3** Transactional decisions: the status change and balance movement succeed or fail together.
- **M5.4** Day calculation uses the company holiday calendar and the employee's weekly schedule; weekends and holidays are excluded per policy. Support half-day requests.
- **M5.5** Validation: end before start, zero/negative days, overlapping requests, insufficient balance, requests outside employment dates, and duplicate submissions.
- **M5.6** Cancellation: employee can cancel pending requests; approved leave cancellation follows a policy (proposed: allowed before start, restores balance once, notifies approvers).
- **M5.7** Attachments: upload medical certificates or supporting documents, store them securely, and show them to approvers.
- **M5.8** Full leave type catalog aligned across mobile, backend, and reports: annual, sick, sick-on-file, hajj, paternity, maternity, marriage, bereavement, remote work, unpaid, emergency. Emergency must not silently map to unpaid.
- **M5.9** Calendar: navigate months and years, select single days or ranges, show holidays and existing leave, and submit future-year requests where policy allows.
- **M5.10** Notifications: submit, stage change, approval, rejection, cancellation, and balance adjustment notify the right people; duplicate decisions are idempotent.

**Rules**

- A manager cannot approve their own request; it routes to HR.
- If the manager is inactive or has no manager, the request routes to HR.
- Only HR/Super Admin can adjust a balance manually, with a reason and audit entry.
- Approval deducts exactly once, even under double-tap or retry.
- Rejection and cancellation do not deduct.
- Who's Off shows only approved, currently active leave and respects the local day boundary.

**Acceptance**

- A request travels manager → HR with visible status and notifications at each step.
- The sum of ledger entries equals the displayed remaining balance for every fixture.
- A request for next month or next year can be created and approved.
- Every rejection/cancellation restores or preserves balance exactly once.
- Emergency, sick-on-file, and remote work are distinct and report correctly.

---

### M6 — Web administration console completion (Phase 10)

**Outcome**: HR can run daily operations entirely from the console.

**Requirements**

- **M6.1** Employees: list, create, edit, transfer, promote, deactivate, reset password, and view leave/attendance history.
- **M6.2** Attendance: daily and range views, filters, correction approval, export, and punch detail.
- **M6.3** Leave: pending/history tabs, stage-aware decisions, comments, attachments, and a full request timeline.
- **M6.4** Branches: create/edit geofence, working hours, Wi-Fi/BLE allowlists, and activation state with validation.
- **M6.5** Payroll: period selection, summary, employee drill-down, WPS export with validation errors surfaced.
- **M6.6** Reports: headcount, attendance rate, leave liability, pending approvals, and remote distribution, with date filters and CSV export.
- **M6.7** Audit log viewer: actor, action, resource, time, and details; filterable and read-only.
- **M6.8** RBAC-aware navigation: HR Admin and Super Admin see only permitted sections; all API calls enforce the same rules.
- **M6.9** UX baseline: loading, empty, error, and unauthorized states; Arabic/English; light/dark; responsive at 1280, 1024, and 768 widths.

**Acceptance**

- HR can onboard an employee, fix a missed punch, approve stage 2 leave, and export payroll without using Swagger or SQL.
- Every destructive or financial action requires confirmation and is audited.
- An expired session redirects to login without losing unsaved work silently.
- Core screens pass an accessibility scan and keyboard navigation review.

---

### M7 — Notifications & Microsoft 365 integration (Phases 10–11)

**Outcome**: notifications are durable, and Microsoft integrations either work with retry or are clearly disabled.

**Requirements**

- **M7.1** Persist in-app notifications per user with read/unread state, categories, and deep links. Notifications survive app restart and are consistent across devices.
- **M7.2** Push notifications (proposed: Expo push) for approval requests, decisions, corrections, and announcements, with opt-in and per-category preferences.
- **M7.3** Teams Adaptive Cards: dispatch on submit and stage changes through a queued worker with retry and idempotency; record the message ID.
- **M7.4** Outlook calendar: create/update/delete out-of-office events on approval, cancellation, and date change.
- **M7.5** Entra ID: real sign-in, token refresh, and account linking when enabled.
- **M7.6** Integration failures never block the core leave/attendance transaction; they surface an operator-visible status and retry.
- **M7.7** Admin integration settings: enable/disable, test connection, and show last success/failure.

**Rules**

- No outbound integration runs from the mobile client with embedded secrets.
- Tokens and client secrets live only on the server.
- Each external object is created once per business event; retries must not duplicate cards or events.
- Disabling an integration hides the corresponding user-facing affordance.

**Acceptance**

- Submitting leave creates exactly one Teams card and one employee/manager notification, even if the first dispatch fails and retries.
- Approving leave creates one Outlook event; cancelling removes it.
- With integrations disabled, the core flow still succeeds and the UI does not promise unavailable features.

---

### M8 — Payroll & compliance (Phase 11)

**Outcome**: a payroll period can be calculated, reviewed, approved, and exported with traceable inputs.

**Requirements**

- **M8.1** Period-based payroll run that snapshots salary, allowances, GOSI, unpaid leave, overtime, and adjustments.
- **M8.2** Payslip generation per employee with earnings, deductions, employer contributions, and period metadata.
- **M8.3** GOSI rules: Saudi employee 9.75% / employer 11.75% with the statutory wage cap; non-Saudi employer 2% hazards; configurable rates with validation.
- **M8.4** Unpaid leave and absence deductions, overtime earning rules, and manual adjustments with reason and audit.
- **M8.5** Approval workflow for a payroll run (prepared → reviewed → locked); locked periods are immutable.
- **M8.6** WPS/Mudad export that validates required IDs, IBAN format, totals, and encoding; fail with a clear report rather than exporting bad rows.
- **M8.7** Payroll permissions: only HR Admin/Super Admin; employees see only their own payslip.
- **M8.8** Historical payslips are retrievable and unaffected by later salary changes.

**Rules**

- Money is stored and calculated with exact decimal semantics, not binary floating point.
- A payroll run records the exchange/rounding policy and the exact inputs used.
- Salary changes after a run do not alter that run.
- Export files contain no formula-injection prefixes and are UTF-8 with a defined delimiter.

**Acceptance**

- A payroll run's net total equals the sum of generated payslips and the WPS export.
- Saudi and non-Saudi fixtures match statutory calculations at, below, and above the cap.
- Unpaid leave reduces net pay exactly once for the period.
- A locked period cannot be edited or re-exported with different numbers.

---

### M9 — Mobile product completeness & accessibility (continuous)

**Outcome**: every core flow feels finished in both themes and both languages, including failure paths.

**Requirements**

- **M9.1** Leave request: all types, month/year navigation, holiday awareness, validation, attachment, and a clear success confirmation with request details and next approver.
- **M9.2** Attendance: visible sync state, break state, correction entry point, and clear rejection reasons with recovery guidance.
- **M9.3** Loading, empty, error, and offline states for dashboard, approvals, attendance, directory, payslip, and notifications.
- **M9.4** No auto-navigation or surprise redirects; every transition is user-initiated.
- **M9.5** Light and dark mode verified for every changed screen; no hardcoded colors outside the theme tokens.
- **M9.6** Arabic RTL: no hardcoded left/right, mirrored icons where meaningful, localized dates/numbers, and no clipped text.
- **M9.7** Accessibility: labels, roles, focus order, touch targets, dynamic type, and contrast meeting WCAG 2.1 AA for core flows.
- **M9.8** Remove demo-only controls from release builds (role switcher, simulation presets, prefilled credentials, debug toggles).

**Acceptance**

- An employee can complete every core task without a developer present.
- A failed submit always explains what happened and what to do next.
- Both themes and both languages pass the manual visual checklist on a physical device.
- No security-relevant demo control is reachable in a release build.

---

### M10 — Release, observability & tenancy readiness (Phase 11)

**Outcome**: MacqHR can be operated in production and evolved toward the workspace model without a rewrite.

**Requirements**

- **M10.1** Environments: local, staging, production; separate credentials and data; seeded demo accounts only in local.
- **M10.2** EAS build profiles and signed iOS/Android artifacts; documented install, upgrade, and rollback.
- **M10.3** Certificate pinning and transport security verified; no cleartext traffic.
- **M10.4** Health endpoint, structured logs with request IDs, error tracking, and an uptime alert.
- **M10.5** Backups with a tested restore; proposed RPO 24h and RTO 4h until confirmed.
- **M10.6** Dependency and container scanning; no known high/critical vulnerabilities at release.
- **M10.7** Privacy/data-retention policy for location, biometric assertions, and documents; proposed GPS retention 90 days and audit retention 7 years, subject to legal review.
- **M10.8** Tenancy readiness: document the migration path from `User.role` to workspace-scoped membership per [D1–D5](../account-model/README.md), without implementing it in v1.

**Acceptance**

- A release candidate installs on a clean device, signs in, punches, requests leave, and survives an app upgrade.
- A restore from backup reproduces the staging database.
- Production logs contain no tokens, passwords, or raw national IDs.
- The tenancy migration plan has an owner, a sequence, and a rollback.

---

## 7. Phases and sequence

Durations are **indicative** and should be confirmed at kickoff. Each phase ends with a manual gate; a phase does not start until the previous gate is approved.

| Phase | Name | Indicative | Scope | Exit criteria | Gate |
|---|---|---|---|---|---|
| **6** | Foundation & trust | 1–2 weeks | M1, M2 stopgaps, M9 demo-control removal | Code fully tracked; CI runs `verify:all`; migrations committed; default secrets/CORS fixed; client role switcher and prefilled credentials removed; employee PII guarded; gate hook v2 | G1 |
| **7** | Identity & employee lifecycle | 2 weeks | M2, M3 | Refresh/revocation; forced password change; rate limiting; admin employee CRUD; role/manager/branch/remote changes; SSO decision executed | G2 |
| **8** | Attendance integrity | 2–3 weeks | M4 | Unverified signals no longer accepted; local-day boundary; break persistence; offline decision; corrections workflow; admin attendance view/export | G3 |
| **9** | Leave & approvals v2 | 2–3 weeks | M5, M9 leave UX | Two-stage pipeline; ledger; holidays; overlap/half-day; cancellation; attachments; full calendar and types | G4 |
| **10** | Admin console & notifications | 2 weeks | M6, M7.1–M7.2 | Employee/attendance/leave admin complete; reports; audit viewer; persisted notifications and push | G5 |
| **11** | Payroll, integrations & release | 3 weeks | M7.3–M7.7, M8, M10 | Payroll run + WPS validation; Teams/Outlook dispatch; EAS builds; pinning; monitoring/backup; store/MDM | G6 |
| **12+** | Workspace & tenancy | Later | Account-model D1–D5 | Separate PRD and migration plan | — |

### 7.1 Phase dependencies

- **Phase 6 blocks everything.** Without versioned code, CI, and migrations, later gates cannot be trusted.
- **Phase 7 blocks Phase 8/9 admin work.** Corrections and HR overrides need employee/role management.
- **Phase 8 and Phase 9 can overlap only in design.** They share the local-day boundary and audit model.
- **Phase 10 depends on Phase 9** for leave timelines and stage-aware decisions.
- **Phase 11 depends on Phase 8** for attendance-derived payroll inputs.

### 7.2 What ships at the end of each phase

Each phase produces a **demoable increment** on staging, a **test execution record**, and a **signed gate file**. There is no "big bang" release at the end.

---

## 8. Ways of working

### 8.1 Repository and branches

- `main` is protected. Work happens on `phase-6/foundation`, `phase-7/identity`, and so on; each phase may contain multiple focused branches/PRs.
- One PR per coherent change; no mixed refactor + feature PRs.
- Conventional commit messages (`feat(attendance): ...`, `fix(auth): ...`, `docs(prd): ...`).
- Squash merge; the PR description becomes the change record.
- Never commit `.env`, credentials, tokens, database dumps, or build artifacts.

### 8.2 Definition of ready

A task is ready when it has: a module/requirement ID, acceptance criteria, test IDs, affected roles, empty/error states, and a rollback note if it touches data or auth.

### 8.3 Definition of done

- Acceptance criteria met and demonstrated.
- Automated tests added/updated at the right layer.
- Manual checklist in [test-plan.md](./test-plan.md) executed.
- Light/dark and EN/AR checked for UI changes.
- No new S1/S2 defect; S3/S4 logged.
- Docs updated (PRD version, README, API docs, runbook).
- Migration and rollback verified if the schema changed.
- Gate file signed by Talha.

### 8.4 Test layers

| Layer | Tooling | Required for |
|---|---|---|
| Backend unit | Jest | Utilities, calculations, rule engines |
| Backend API/integration | Jest + Supertest + isolated PostgreSQL | Auth, RBAC, attendance, leave, payroll, admin endpoints |
| Mobile logic | Existing ts-node harness | State machines, mappings, formatting, policy functions |
| Mobile UI/manual | Physical iOS + Android devices | Camera/GPS/biometrics, gestures, offline, RTL, dark mode |
| Admin | Vitest/Testing Library + manual | Auth, permissions, forms, tables, exports |
| End-to-end smoke | Manual script (proposed: Maestro later) | Login → punch → leave → approve → payslip |

### 8.5 Environments and data

- Local: seeded demo data, fake credentials allowed, no real PII.
- Staging: production-like, synthetic test employees, integrations in sandbox mode.
- Production: real data, no demo accounts, no shared passwords, least-privilege database user.
- Migrations run with a pre-migration backup and a rehearsed rollback.

### 8.6 Bug severity

| Severity | Definition | Release rule |
|---|---|---|
| S1 | Data loss, security breach, payroll error, total outage | Stop; fix before any gate |
| S2 | Core flow blocked, wrong approval/attendance result | Fix before gate |
| S3 | Workaround exists, cosmetic in a secondary flow | May ship with a logged ticket and your approval |
| S4 | Minor polish | Backlog |

### 8.7 Change control

Scope changes require a PRD version bump, an entry in the change log, and your approval. Silent scope expansion is not allowed.

---

## 9. Manual review and approval gates

You are the sole approver. No phase is pushed to the remote or deployed to production without your sign-off.

### 9.1 Gate sequence

| Gate | When | What you review |
|---|---|---|
| **G0** | Before Phase 6 starts | This PRD, the test plan, and the proposed corrections to `SPRINT_PLAN.md` / `RULES.md` / `README.md` |
| **G1–G6** | At the end of Phases 6–11 | The phase checklist on staging + a physical device, plus the automated evidence |

### 9.2 What you receive before each gate

1. A staging URL/build and a short demo script.
2. The exact commit SHA and build number.
3. The automated results (`verify:all`, API tests, admin tests).
4. The executed manual checklist with pass/fail per test ID.
5. A defect list with severity and workaround.
6. A one-page summary of what changed and what did not.

### 9.3 Approval record

Create one file per gate at `docs/qa/gates/phase-<N>.md` using the [gate template](../qa/gates/TEMPLATE.md):

```markdown
# Phase <N> — Manual Approval

- Approver: Talha
- Date/time: <ISO 8601 with timezone>
- Commit: <full SHA>
- Build: <EAS build / staging URL / APK-IPA identifier>
- Environment: staging | production-candidate
- Device: <model, OS version>
- Automated evidence: <link or pasted summary>
- Manual checklist: <link to executed test plan>
- Defects: <none | list with severity and workaround>
- Decision: APPROVED | APPROVED WITH CONDITIONS | REJECTED
- Conditions / notes: <text>
```

### 9.4 Gate rules

- The approval is valid **only for the recorded commit**. Any new commit requires a new gate.
- `APPROVED WITH CONDITIONS` lists conditions that must be verified before release; it cannot be used to bypass an S1/S2.
- A rejected gate produces a defect list and a re-test; it does not produce a partial push.
- The pre-push hook must reject a push when: `verify:all` fails, the gate file is missing, the SHA does not match `HEAD`, or the phase gate is older than the commit. Presence-only checks are not sufficient.
- Emergency hotfixes use the same gate, compressed to one focused checklist; no `--no-verify`.

### 9.5 What manual testing always covers

- Sign in, sign out, session restore, expired session.
- One full attendance punch including a failure case.
- One full leave request and one approval/rejection.
- Both themes, both languages, one small screen.
- The specific feature changed in the phase, including its error path.
- A physical device for GPS/biometrics/offline behavior.

---

## 10. Test strategy and detailed cases

The detailed suite is in [test-plan.md](./test-plan.md): **90 cases**, grouped by module, each with precondition, action, expected result, type (automated/manual/both), priority, and phase. It includes regression coverage for the existing 48 mobile and 13 backend tests and fills the gaps those tests do not cover.

### 10.1 Coverage summary

| Area | Cases | Primary layer |
|---|---|---|
| Auth & session | 10 | API + manual |
| Employee lifecycle | 10 | API + admin UI |
| Attendance | 15 | API + physical device |
| Leave & approvals | 15 | API + mobile/manual |
| Admin console | 10 | Admin tests + manual |
| Integrations | 6 | API/worker + sandbox |
| Payroll | 6 | API + reconciliation |
| Mobile UX & accessibility | 8 | Manual + logic tests |
| Operations & security | 5 | CI/infra checks |
| Release | 5 | Device/store checks |

### 10.2 Test data

- One employee per role, one remote employee in Pakistan, one manager with three reports, one manager with no reports, one deactivated employee, one employee with zero balance.
- One Saudi and one non-Saudi payroll fixture at, below, and above the GOSI cap.
- One branch in Riyadh, one in Jeddah, one remote hub.
- Deterministic dates around month/year boundaries and a holiday.

### 10.3 Entry and exit criteria

**Entry**: build deployed to staging; migrations applied; test accounts seeded; integrations in sandbox.

**Exit**: all P0/P1 cases pass; S1/S2 zero; P2 failures accepted in writing by you; evidence attached to the gate file.

---

## 11. Non-functional requirements

| Category | Requirement | Acceptance |
|---|---|---|
| Performance | API p95 < 400 ms reads / < 800 ms writes; mobile cold start < 3.0 s | Measured on staging and a physical device |
| Availability | 99.5% monthly for the API (proposed) | Monitoring and incident log |
| Security | OWASP ASVS L2 for auth, access control, and input handling; secrets managed; TLS 1.2+ (1.3 preferred); certificate pinning in release | Security review + tests |
| Privacy | Minimum necessary PII; GPS/attendance retention policy; access logging | Legal review + audit |
| Accessibility | WCAG 2.1 AA for core mobile and admin flows | Manual audit + automated scan |
| Localization | EN/AR parity, RTL, localized dates/numbers | Visual checklist |
| Offline | Clear pending/synced/failed states; no silent loss | Device test |
| Compatibility | iOS 17+ and Android 12+ on supported devices; Chrome/Safari/Edge for admin | Device/browser matrix |
| Observability | Structured logs, request IDs, error tracking, health endpoint | Staging demonstration |
| Backup/DR | Daily backup, restore tested; proposed RPO 24h / RTO 4h | Restore drill |

---

## 12. Telemetry and audit events

Minimum event set (names are proposals):

| Event | Trigger | Key properties | Purpose |
|---|---|---|---|
| `auth.login.success` / `auth.login.failure` | Sign-in attempt | method, role, reason (no password) | Security monitoring |
| `auth.session.revoked` | Logout, role change, deactivation | reason | Security |
| `employee.created` / `employee.updated` / `employee.deactivated` | HR action | changed fields, actor | Audit |
| `attendance.punch.accepted` | Punch accepted | mode, branch, distance band, attestation status | Operations |
| `attendance.punch.rejected` | Punch rejected | layer, reason, mode | Security |
| `attendance.correction.requested` / `.decided` | Correction flow | date, before/after, actor | Audit |
| `leave.submitted` / `.stage_changed` / `.decided` / `.cancelled` | Leave lifecycle | type, days, stage, actor | Operations/audit |
| `leave.balance.adjusted` | Manual or ledger entry | type, delta, reason, actor | Audit |
| `payroll.run.locked` / `payroll.exported` | Payroll action | period, totals, actor | Audit |
| `integration.dispatch.succeeded` / `.failed` | Teams/Outlook worker | target, attempt, error class | Operations |
| `notification.read` | User opens notification | category | Product usage |

Rules: no raw tokens, passwords, national IDs, or free-text medical reasons in analytics; audit records are append-only; location retention is configurable and documented.

---

## 13. Security and compliance requirements

- Server-side authorization on every endpoint and every object; no client-trusted role or manager.
- Anti-spoofing evidence must be verifiable or explicitly marked unverified; the current client booleans are not sufficient.
- Passwords hashed with a modern cost factor; no shared production password; forced change on first use.
- JWT secret and integration secrets from a secret manager; startup fails if missing in production.
- Strict CORS, security headers, request limits, and rate limiting on auth and write endpoints.
- Parameterized database access; validation and whitelisting on every DTO.
- Audit log for approvals, corrections, role changes, payroll, exports, and security rejections.
- Data residency and PDPL review before production; document where data is stored and processed.
- No PII in logs, crash reports, or analytics.

---

## 14. Data and migration plan

- Phase 6 establishes the migration baseline from the current schema.
- Phase 7 adds session/refresh records and employee lifecycle fields; removes duplicate hierarchy fields after a compatibility window (`managerId` vs `reportsToId`).
- Phase 8 adds a correction/adjustment entity, break events, and a local-day/attendance-day key.
- Phase 9 adds a balance ledger, holiday calendar, approval stages, and attachment metadata.
- Phase 11 adds payroll runs, payslips, and immutable export records.
- Every migration is forward-only in production, with a tested rollback or compensating migration.
- Multi-tenancy (`workspaceId`) is **not** added in Phases 6–11; the migration order is defined in [account-model §9](../account-model/README.md).

---

## 15. Risks and mitigations

| Risk | Likelihood | Impact | Mitigation | Phase |
|---|---|---|---|---|
| Client-asserted security signals are spoofable | High | High | Device attestation, server verification, flag/reject policy | 8 |
| Stale/untracked repository loses work | High | High | Commit everything, CI, migrations, backup | 6 |
| Balance drift from non-transactional updates | High | High | Ledger + transaction + reconciliation tests | 9 |
| Single-stage approvals do not match policy | High | Medium | Two-stage pipeline with override rules | 9 |
| Timezone day-boundary errors | High | Medium | Per-employee work timezone, shared day key | 8 |
| Payroll errors | Medium | High | Period snapshot, exact decimals, reconciliation, locked runs | 11 |
| Integration assumptions (Teams/Outlook) | Medium | Medium | Sandbox spike, queue/retry, graceful disable | 10–11 |
| Store/MDM rejection | Medium | Medium | Early build, privacy docs, device matrix | 11 |
| Data residency/PDPL ambiguity | Medium | High | Legal review before production | 10–11 |
| Admin console gaps force SQL/API use | High | Medium | Complete M6 before release | 10 |
| Manual gate becomes a rubber stamp | Medium | High | SHA-bound gate, executed checklist, spot checks | 6 |
| Scope creep | Medium | High | Phase scope + change control + your approval | All |

---

## 16. Decisions needed from you

Recommended defaults are shown; confirm or change each one.

| # | Decision | Recommendation |
|---|---|---|
| D-01 | Approve this PRD and the 90-case test plan as the working contract | **Approved at G0 on 2026-10-31** |
| D-02 | Approve the proposed corrections to `SPRINT_PLAN.md`, `RULES.md`, and `README.md` (see review doc) | **Approved and applied on 2026-10-31** |
| D-03 | Version `ios/` or generate it via prebuild? | Version the native project until the app is stable |
| D-04 | Attendance verification policy: reject vs flag unverified devices | Reject office punches without verifiable attestation; flag remote |
| D-05 | Offline attendance: build secure sync now or hide it? | Hide until device signing is ready (Phase 8), then enable |
| D-06 | Approval policy: manager → HR for all leave, or threshold-based? | Manager → HR for all, with HR override and reason |
| D-07 | Working timezone for the Pakistan remote hub | Asia/Karachi per employee; office staff Asia/Riyadh |
| D-08 | Payroll scope: calculation + export only, or full run/lock? | Full run/lock, because WPS needs stable period totals |
| D-09 | GPS and document retention periods | GPS 90 days; documents while employed + 7 years; legal review |
| D-10 | Multi-tenant workspace model now or after v1? | After v1, per account-model phases |
| D-11 | Test tooling: add Playwright for admin or stay with Testing Library + manual? | Testing Library first; revisit Playwright if admin grows |
| D-12 | Who else, if anyone, may sign a gate when you are unavailable? | No delegate for v1 |

---

## 17. PRD self-check

| # | Check | Status |
|---|---|---|
| 1 | Background explains why now, not just what | Pass |
| 2 | At least one quantified success measure | Pass (targets proposed) |
| 3 | User roles are specific, not "all users" | Pass |
| 4 | Business rules are enumerated, no "etc." | Pass for planned scope |
| 5 | Every module covers failure/edge cases | Pass |
| 6 | Acceptance criteria are testable | Pass; detailed in test plan |
| 7 | Telemetry covers core paths | Pass |
| 8 | No prescriptive technology in product requirements | Mostly; stack references are constraints, not new choices |
| 9 | Priorities/phases are explicit | Pass |
| 10 | Schedule reflects dev/test/integration | Pass, indicative |

---

## Appendix A — Traceability to existing tests

| Existing suite | Count | Modules covered | Gaps |
|---|---|---|---|
| Mobile `TC-1.x` | 3 | Theme, i18n, RTL | Visual verification |
| Mobile `TC-2.x` | 9 | Geofence/security utilities | Real device and server enforcement |
| Mobile `TC-3.x` | 3 | Teams/Outlook payload generation | Actual dispatch |
| Mobile `TC-4.x` | 1 | Offline FNV-1a signing | Cryptographic signing, sync |
| Mobile `TC-5.x` | 1 | GOSI/WPS math | Payroll run, export validation |
| Mobile `TC-6.x`–`TC-8.x` | 7 | Navigation, logo, profile | Regression after refactor |
| Mobile `TC-9.x` | 3 | RBAC filtering | Server authority |
| Mobile `TC-10.x` | 3 | Login validation | Real SSO, refresh, lockout |
| Mobile `TC-P1.x`–`TC-P5.x` | 18 | Phases 1–5 UI/workflows | Backend integration depth |
| Backend Jest | 13 | Haversine, GOSI, FNV-1a, attendance punch | Auth, leaves, employees, payroll, directory, RBAC |

The 90 planned cases do not repeat these blindly; they test the production rules those suites approximate.

## Appendix B — Glossary

- **Gate**: a manual approval checkpoint owned by Talha, bound to a commit.
- **Punch**: a check-in or check-out event.
- **Local day**: the calendar day in the employee's work timezone.
- **Ledger**: append-only record of every balance movement.
- **Attestation**: verifiable evidence that a request came from an untampered app/device.
- **WPS**: Saudi Wage Protection System.
- **GOSI**: General Organization for Social Insurance.
