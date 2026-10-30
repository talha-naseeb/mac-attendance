# MacqHR Delivery Tracker

> **Status**: Product Phases 1–5 implemented (mobile + API + admin prototype). Phase 6 foundation work is implemented and awaiting G1 sign-off.
> **Verification**: 48 mobile tests, 31 backend tests in 7 suites, admin production build passing.
> **Release status**: Not production-ready. Phase 7 is next after G1.
> **Approver**: Talha. Every delivery phase requires a SHA-bound manual gate.
> **Forward plan**: [docs/prd/README.md](docs/prd/README.md) · **Tests**: [docs/prd/test-plan.md](docs/prd/test-plan.md) · **Review**: [docs/prd/document-review.md](docs/prd/document-review.md)
> **Last updated**: 2026-10-31

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

## Current verification baseline (2026-10-31)

| Surface | Command | Result |
|---|---|---|
| Mobile | `npm run verify` | Typecheck passed; 48 tests passed, 0 failed |
| Backend | `npm run typecheck && npm test && npm run build` | Typecheck passed; 7 suites, 31 tests passed; build passed |
| Admin | `npm run build` | Production build passed |
| Repository | `git status` | All application surfaces tracked; `ios/` source versioned; baseline migration committed |
| CI | `.github/workflows/verify.yml` | Runs `verify:all` on pull requests and `main` |

Phase 6 added CI, the Prisma baseline migration and the SHA-bound push hook. Isolated database API tests and admin unit/component tests (M1.3) remain open.

---

## Delivery phases (forward plan)

The detailed modules, rules, risks, and decisions are in the [PRD](docs/prd/README.md). This table is the tracking view.

| Phase | Name | Scope | Exit criteria | Gate | Status |
|---|---|---|---|---|---|
| **6** | Foundation & trust | M1, M2 stopgaps, M9 demo-control removal | Code fully tracked; `verify:all` in CI; migrations committed; secrets/CORS hardened; role switcher and prefilled credentials removed; employee PII guarded; SHA-bound push hook | G1 | `[/]` Implemented, awaiting G1 |
| **7** | Identity & employee lifecycle | M2, M3 | Refresh/revocation; forced password change; rate limiting; admin employee CRUD; role/manager/branch/remote changes; SSO decision executed | G2 | `[ ]` |
| **8** | Attendance integrity | M4 | Verifiable evidence; local-day boundary; break persistence; offline decision; corrections; admin attendance view/export | G3 | `[ ]` |
| **9** | Leave & approvals v2 | M5, M9 leave UX | Two-stage pipeline; balance ledger; holidays; overlap/half-day; cancellation; attachments; full calendar and types | G4 | `[ ]` |
| **10** | Admin console & notifications | M6, M7.1–M7.2 | Employee/attendance/leave admin complete; reports; audit viewer; persisted notifications and push | G5 | `[ ]` |
| **11** | Payroll, integrations & release | M7.3–M7.7, M8, M10 | Payroll run + WPS validation; Teams/Outlook dispatch; EAS builds; pinning; monitoring/backup; store/MDM | G6 | `[ ]` |
| **12+** | Workspace & tenancy | Account model D1–D5 | Separate PRD and migration plan | — | `[ ]` Later |

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

Known Phase 6 residue: no isolated database API suite and no admin test suite. The baseline was adopted on the existing local database on 2026-10-31 (empty schema diff, `migrate resolve --applied`, data intact); applying it with `migrate deploy` to a pristine database is still to be exercised at G1.

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
- Historical milestone: 26 tests at that point; current suite is 48.

### Sprint 10 — Login screen and session

- `[x]` Login screen, backend password login, session restore, logout.
- `[/]` Task 10.4 manual verification is unresolved; the existing approval record is stale.
- **Demo only**: Microsoft 365 sign-in button is not configured.
- Historical milestone: 30 tests at that point; current suite is 48.

---

## Known gaps (summarized)

| Gap | Impact | Owner phase |
|---|---|---|
| M1.3 incomplete: no isolated-DB API tests or admin tests | Server and console regressions rely on manual gates | 6 (G1 condition) |
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
# Mobile (typecheck + 48 tests)
npm run verify

# Backend (typecheck + 31 tests + build)
cd backend && npm run typecheck && npm test && npm run build

# Admin (production build)
cd web-admin && npm run build

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
