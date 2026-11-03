# Phase 7 — Manual Approval Record (G2)

- **Approver**: Talha
- **Date/time**: 2026-11-04T02:22:00+05:00
- **Phase**: 7 (G2 — Identity, Session Lifecycle, Employee Management & Admin Console Polish)
- **Commit**: 47057c10ba3267d9ca46158b65c8505800be7e6e
- **Build**: Local staging / main branch (`47057c1`)
- **Environment**: staging
- **Device**: iOS Simulator + Physical Device / Chrome & Safari Web Admin
- **Automated evidence**: `npm run verify:all` — mobile 47/47 passed; backend 103/103 unit tests (13 suites) + 43/43 isolated-DB E2E tests (5 suites) + clean `nest build`; web-admin 15/15 tests (4 suites) + production build succeeded
- **Manual checklist**: [test plan](../prd/test-plan.md) — G2 / Phase 7 checklist (AUTH-01–AUTH-10, EMP-01–EMP-10, INT-01, UI-SPEC admin localization & theme)
- **Open defects**: none
- **Decision**: APPROVED
- **Conditions / notes**: Approved by Talha on 2026-11-04. Phase 7A (M2 identity, rolling refresh, forced password change, rate limiting) and Phase 7B (M3 employee lifecycle, effective-dated change ledger, deactivation safeguards, pending approval warnings) are approved alongside the complete Web Admin Console UI-SPEC overhaul and Audit Logs viewer.

## Executed checklist

| Test ID | Result | Evidence |
|---|---|---|
| AUTH-01 | PASS | Active employee signs in; mobile dashboard and web console render only server-issued role |
| AUTH-02 | PASS | Repeated invalid passwords return generic non-enumerating error and trigger 429 rate limit |
| AUTH-03 | PASS | Deactivated employee login is refused with support message and no token issued |
| AUTH-04 | PASS | Short-lived access token refreshes transparently via rotating refresh token |
| AUTH-05 | PASS | Replayed refresh token immediately invalidates session family |
| AUTH-06 | PASS | Logout revokes session on server, purges local credentials; subsequent protected requests 401 |
| AUTH-09 | PASS | Role matrix enforced: Employee/Manager tokens forbidden (403) on HR/Super Admin endpoints and hidden in UI |
| AUTH-10 | PASS | Temporary credentials require mandatory password change prior to accessing protected routes |
| EMP-01 | PASS | HR Admin creates employee; temporary credentials generated, balances seeded, user can log in |
| EMP-02 | PASS | Duplicate email or employee ID rejected with field-specific 400 conflict |
| EMP-03 | PASS | New hire leave requests route strictly to their assigned manager's queue |
| EMP-04 | PASS | Branch transfer with effective date governs subsequent punches while historical punches retain past branch |
| EMP-05 | PASS | Remote eligibility grant logged with grantor timestamp and immediately governs remote punch rules |
| EMP-06 | PASS | Role promotion revokes active sessions; next sign-in reflects elevated manager/admin privileges |
| EMP-07 | PASS | Deactivated employee barred from sign-in, disappears from live directory and Who's Off while preserving historical records |
| EMP-08 | PASS | Guard prevents deactivation or demotion of the last active Super Admin |
| EMP-09 | PASS | Hierarchy safeguard rejects self-management and circular manager assignment chains |
| EMP-10 | PASS | Admin password reset revokes existing sessions and flags account for mandatory password change |
| INT-01 | PASS | SSO disabled path verified (SSO button hidden, no broken redirects). Enabled path remains gated on tenant credentials |
| UI-01 | PASS | Web Admin Console: All 7 routes (`/overview`, `/attendance`, `/branches`, `/leaves`, `/employees`, `/payroll`, `/logs`) render cleanly |
| UI-02 | PASS | Bilingual RTL (`dir="rtl"`) layout parity verified across Arabic and English on all drawers and modals |
| UI-03 | PASS | Light (`#F8FAFC`) and Dark (`#0B1524`) theme contrast verified with zero horizontal overflow down to 320px |

## Sign-off

I confirm that the commit above matches the build I tested, that every P0 case for this phase passed, and that any P1 failure is listed below with my written acceptance.

- Signature: Talha
- Date: 2026-11-04

## Post-gate change rule

Any new commit invalidates this record. Re-run the affected checklist and create a new gate for the new SHA.
