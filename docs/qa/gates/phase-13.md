# Phase 13 — Manual Approval Record (G8)

- **Approver**: Talha
- **Date/time**: 2026-11-11T17:36:00+05:00
- **Phase**: 13 (G8 — Multi-Tenant B2B SaaS Workspaces, Self-Service Registration & Mobile/Web Admin Workspace UI)
- **Commit**: 2919544350cf87094d99d3f02d24dcd4d8e52c58
- **Build**: Local staging / `development` branch
- **Environment**: staging
- **Device**: iOS Simulator + Physical Device / Chrome & Safari Web Admin
- **Automated evidence**: `npm run verify:all` — mobile 65/65 passed; backend 148/148 unit tests (19 suites) + 91/91 isolated-DB E2E tests (11 suites, including `phase13-multitenant-workspaces.e2e-spec.ts`) + clean `nest build`; web-admin 29/29 tests (7 suites) + production build succeeded; `npx prisma validate` valid
- **Manual checklist**: [Account Model D1–D5](../../account-model/README.md) — G8 / Phase 13 checklist (workspace isolation, `PERSONAL` → `BUSINESS` conversion, invites & seat limits, `sv` session revocation, enforced SSO discovery, self-service registration, Mobile & Web Admin Workspace UI)
- **Open defects**: none
- **Decision**: APPROVED
- **Conditions / notes**: Approved by Talha on 2026-11-11. Phase 13 delivers multi-tenant `Workspace` and `Membership` isolation (`20261110155000_phase13_multitenant_workspaces`, `20261110160000_phase13_workspace_scoping`), `POST /api/auth/register` self-service workspace signup, `POST /api/auth/discover` enforced SSO discovery, `POST /api/workspaces/:id/switch` session rotation with `sv` invalidation, seat-checked team invitations, per-tenant Microsoft/Google SSO & group mappings, Mobile `WorkspaceModal` + Sidebar + Login discovery, Web Admin `WorkspacesView` + Header switcher + Register toggle, and CI coverage for both `main` and `development` branches.

## Executed checklist

| Test ID | Result | Evidence |
|---|---|---|
| WS-01 | PASS | Default `Macquires` workspace provisioned on login and idempotently backfilled via `POST /api/workspaces/backfill` |
| WS-02 | PASS | `PERSONAL` workspace displays `"You"`, blocks invites (`403 PLAN_SEAT_LIMIT`), and converts cleanly to `BUSINESS` in place |
| WS-03 | PASS | Single-use workspace invites enforce seat limits, reject wrong-email or replay (`403`/`409`), and revoke cleanly |
| WS-04 | PASS | Membership role/status updates bump `sessionVersion` (`sv`) and immediately reject stale tokens (`401`) |
| WS-05 | PASS | Per-tenant SSO masks secrets on read, enforces `/api/auth/discover` (`passwordAllowed: false`), and blocks password login (`403`) |
| WS-06 | PASS | Self-service `POST /api/auth/register` creates isolated `BUSINESS` workspace + `OWNER` membership; `POST /api/employees` scopes new hires to active workspace |

## Sign-off

I confirm that the commit above matches the build I tested, that every P0 case for this phase passed, and that any P1 failure is listed below with my written acceptance.

- Signature: Talha
- Date: 2026-11-11

## Post-gate change rule

Any new commit invalidates this record. Re-run the affected checklist and create a new gate for the new SHA.
