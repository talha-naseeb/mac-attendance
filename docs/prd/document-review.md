# Document & Code Review — Findings and Applied Corrections

**Version**: 1.1
**Reviewer**: Qoder (engineering review for Talha)
**Date**: 31 October 2026
**Scope**: `SPRINT_PLAN.md`, `RULES.md`, `README.md`, local git state, and the mobile/backend/admin code that the PRD depends on.
**Status**: Talha approved G0 and started Phase 6 on 31 October 2026. The documentation corrections and Phase 6 foundation changes are applied; see [SPRINT_PLAN.md](../../SPRINT_PLAN.md) for the implementation record and G1 status.

---

## 1. Executive summary

The product is further along than the sprint board claims in some areas and less production-ready than it claims in others. The board is stale; the rules describe the intended system, not the current one; the README describes screens, not how to run the monorepo. The most important corrections are:

1. **The repository is incomplete.** Backend, admin console, docs, and two API clients are untracked. The iOS native project is git-ignored, hiding a required fix. A clean clone cannot reproduce the product.
2. **The QA gate is stale and weak.** The approval file predates the latest commit, is not tied to a SHA, and the hook checks only that the file exists plus mobile tests — not backend or admin.
3. **Attendance safety is client-asserted.** The server trusts booleans sent by the app, and the app still contains simulation presets and a biometric toggle.
4. **Access control has a gap.** Any authenticated employee can request another employee's full record, including salary and national ID, through `GET /employees/:id`.
5. **Leave is single-stage and balances are not ledger-backed.** The schema defines `PENDING_HR` but the service never uses it. Balance deduction is a non-transactional counter update.
6. **Several “completed” sprint claims are payload generation or UI only.** Teams/Outlook are generated but not dispatched; the SSO button is not configured; the QA simulator strip is not exposed in the UI; offline sync is disabled.
7. **There is no CI, no migration history, and no API or admin test suite.** The 48 + 13 tests are useful but cover utilities and a narrow service slice.
8. **Ports and setup are inconsistent.** Backend config defaults to port 3000 while the mobile client and docs use 4000; the actual value lives in an untracked `.env`.

None of these invalidate the work. They define Phase 6.

---

## 2. Git and repository audit

Snapshot: local `main` = `origin/main` at `4c41454`; branch `main`; 57 tracked files; 9 modified, 9 untracked paths.

| # | Finding | Evidence | Severity | Proposed action |
|---|---|---|---|---|
| G-01 | Backend, admin, docs, and API clients are untracked | `git status`: `?? backend/`, `?? web-admin/`, `?? docs/`, `?? src/services/backendApi.ts`, `?? src/services/authStorage.ts` | **P0** | Phase 6: commit them in focused commits; confirm no secrets included |
| G-02 | iOS native fix is ignored | `.gitignore:14` (`ios/`); `ios/` contains AppDelegate/SceneDelegate changes needed for iOS 27 | **P0** | Version `ios/` or document reproducible `expo prebuild`; decide explicitly |
| G-03 | QA approval is older than the last commit | `.manual-qa-approved` = `2026-10-20T17:21:44+05:00`; commit `4c41454` = 2026-10-21 01:11 | **P0** | Invalidate it; bind approvals to SHA in Phase 6 |
| G-04 | Pre-push hook verifies only mobile | `.git/hooks/pre-push` runs `npm run verify`; no backend/admin; no SHA/freshness check | **P0** | Replace with `verify:all` + phase gate matching `HEAD` |
| G-05 | No CI | No workflow files; verification is local only | **P0** | Add PR workflow in Phase 6 |
| G-06 | No Prisma migration history | `backend/prisma/` has only `schema.prisma` and `seed.ts` | **P0** | Baseline migration + upgrade test |
| G-07 | 0-byte `data.db` is untracked | `data.db` size 0 at repo root | P2 | Delete or ignore; confirm no SQLite runtime |
| G-08 | Tooling artifacts are untracked and ambiguous | `?? .gravitas/`, `?? opencode.jsonc`, `?? metro.config.js` | P2 | Decide: commit project tooling, ignore personal tooling |
| G-09 | Environment files are untracked, as expected | `backend/.env` exists; root `.env` ignored | P1 | Keep ignored; add documented examples and startup validation |
| G-10 | Package manifests changed but uncommitted | `M package.json`, `M package-lock.json`, `M App.tsx`, 5 screens, `M authService.ts` | P0 | Include in Phase 6 baseline commit after review |
| G-11 | Only 57 files tracked for a three-surface monorepo | Tracked file count = 57 | P0 | Measure of G-01/G-02 |
| G-12 | No license/ownership metadata for backend/admin | `backend/package.json` private, `web-admin` private | P2 | Add repository-level policy if distributing |

**Verification baseline captured on 31 Oct 2026**

- Mobile `npm run verify`: typecheck passed; 48 tests passed, 0 failed.
- Backend `npm run typecheck` + `npm test`: 4 suites, 13 tests passed.
- Admin `npm run build`: passed; 277.47 kB JS bundle.
- No API end-to-end suite, no admin tests, no coverage report.

**Phase 6 baseline (2026-10-31)**: backend suite grew to 7 suites / 31 tests with configuration, CORS and employee-access coverage. CI, the Prisma baseline migration and the SHA-bound hook now exist. Isolated-database API tests and admin tests are still outstanding.

---

## 3. Code and product findings

### 3.1 P0 — fix before Phase 6 gate

| # | Finding | Evidence | Why it matters | Proposed fix |
|---|---|---|---|---|
| P0-01 | Client-side role switching | `App.tsx:107` initializes role to `MANAGER`; `App.tsx:898` `onSelectRole={setUserRole}`; `App.tsx:968` `setUserRole(nextRole)` | The UI can present Manager/HR capabilities to an employee; authorization becomes confusing and bypassable at the presentation layer | Remove all role mutation; derive role from the verified session; make the server the only source |
| P0-02 | Employee PII readable by any authenticated user | `employees.controller.ts:44-48` has no `RolesGuard`; `employees.service.ts` `findById` returns salary, national ID, Iqama | Payroll and identity data leak across employees | Restrict to self/HR/Super Admin; return a limited shape to others |
| P0-03 | Client-asserted anti-spoofing | `attendance.service.ts` `validateAntiSpoofing` trusts `isMockLocation`, `isDeviceRooted`, `biometricVerified`; `schema.prisma:164` defaults `biometricVerified` to true; `ClockInScreen.tsx:142-144` sends booleans | A modified client can claim a clean device; the six layers are advisory, not enforcement | Phase 8: device attestation + server verification; reject/flag unverified |
| P0-04 | Demo simulation controls remain in shipped code | `useLocationSecurity.ts:12-18` presets; `:357-374` biometric/Wi-Fi toggles | If surfaced, they defeat the security UX; if not surfaced, they are dead demo code | Remove from release path; gate behind `__DEV__` if needed for QA |
| P0-05 | Default JWT secret fallback | `backend/src/config/configuration.ts:30` | A predictable secret allows token forgery if `JWT_SECRET` is missing | Fail startup outside development; no fallback |
| P0-06 | Wildcard CORS | `backend/src/main.ts:17` defaults to `*` | Admin/mobile tokens can be used from arbitrary origins | Explicit allowlist in every environment |
| P0-07 | No rate limiting or security headers | `backend/package.json` has no `helmet`/throttler | Credential stuffing and brute force are unmitigated | Add headers, auth/write throttles |
| P0-08 | Single-stage leave approval | `leaves.service.ts` `makeDecision` checks `PENDING` then sets terminal status; `LeaveStatus` enum unused (`schema.prisma:43-49,214`) | Does not match Macquires manager → HR policy; no stage history | Phase 9 two-stage pipeline |
| P0-09 | Balance updates are not transactional and have no ledger | `leaves.service.ts` `updateMany` then `update`; `LeaveBalance` has total/used/remaining | Concurrent decisions or failures can drift balances; `remainingDays` can go stale | Ledger + transaction + reconciliation |
| P0-10 | Stale QA gate can authorize a push | See G-03/G-04 | Manual approval discipline is the core control and is currently bypassable | SHA-bound gate + `verify:all` |
| P0-11 | SSO button is a dead end | `LoginScreen.tsx:64-70` always reports “not configured” | Release build promises a feature it does not provide | Implement or hide behind config |
| P0-12 | Teams/Outlook are not dispatched | `leaves.service.ts` builds `teamsNotificationPayload` and returns it; no HTTP worker; mobile `microsoftGraph.ts` is payload/constants | Approvers are not actually notified; calendar is not updated | Phase 10–11 queue + dispatch or disable |

### 3.2 P1 — correctness and operability

| # | Finding | Evidence | Impact | Proposed fix |
|---|---|---|---|---|
| P1-01 | UTC `dateIso` and server-local day windows | `attendance.service.ts` uses `toISOString().slice(0,10)` and `setHours`; `directory.service.ts` same | Punches near midnight and Pakistan remote staff land on the wrong day | Per-employee work timezone and a shared local-day key |
| P1-02 | `workingMinutes` / `breakMinutes` never populated | `schema.prisma:175-176`; punch creation leaves defaults | Attendance summaries cannot be trusted | Persist break events and compute net minutes |
| P1-03 | No uniqueness for one open check-in | No DB constraint; service checks are read-then-write | Concurrent punches can duplicate | Constraint + transactional guard |
| P1-04 | Offline sync disabled but UI promises it | `syncOfflinePunches()` throws 403; mobile queues punches | Users believe punches are saved; data can be lost | Implement secure sync or hide the queue |
| P1-05 | FNV-1a called “cryptographic” | `offlineSyncAndCompliance.ts`; `fnv1a.util`; `RULES.md:74` | 32-bit non-keyed hash is forgeable | Use HMAC/device signature + attestation |
| P1-06 | Leave UI limited to current month and defaults 11–23 | `RequestTimeOffModal.tsx:55-63,390-405` | Cannot request next month/year; arrows are non-functional | Full calendar navigation |
| P1-07 | Emergency Leave stored as Unpaid | `App.tsx:550-557` | Wrong leave category, wrong reporting, wrong balance behavior | Distinct type and mapping |
| P1-08 | No success confirmation after leave submit | `App.tsx` closes modal and adds a local notification | User cannot verify dates/next approver | Explicit success state |
| P1-09 | Leave types inconsistent across layers | Prisma enum `ANNUAL_VACATION`; DTO `ANNUAL`; DB column `String` | Confusing queries and reports | Align naming and use the enum or a shared constant |
| P1-10 | Duplicate hierarchy fields | `schema.prisma:89-94` (`managerId` and `reportsToId`); `radiusMeters` duplicates `geofenceRadiusMeters` | Ambiguous ownership; sync bugs | Remove duplicates after migration |
| P1-11 | Admin employee management incomplete | Backend `UpdateEmployeeDto` excludes role/manager/branch/remote; admin `EmployeesView` read-only | HR cannot run lifecycle from console | Phase 7/10 |
| P1-12 | Payroll is a calculation, not a payroll run | `payroll.service.ts` computes from salary; `month` parameter is not applied | No period snapshots, no unpaid leave/overtime, no lock | Phase 11 |
| P1-13 | Default shared password on employee creation | `employees.service.ts` `defaultPassword = 'Password123!'` | Production accounts share a known credential | Temporary one-time credential + forced change |
| P1-14 | No refresh/revocation | `auth.service.ts` issues 24h JWT; no token version | Cannot revoke access on role change/deactivation | Refresh + session version |
| P1-15 | Audit coverage is narrow | Only attendance rejection writes `AuditLog`; leave decisions and employee changes are logger-only | Disputes and compliance lack evidence | Audit all state changes |
| P1-16 | Directory returns phone/email and leave type/dates to all | `directory.service.ts` | Privacy decision needed; may expose medical leave type | Minimize fields; policy decision |
| P1-17 | Punch success is always `VERIFIED` | `attendance.service.ts` create omits status; schema default | Flagged/uncertain punches look verified | Set status from evidence |
| P1-18 | `isAttendanceExempt` unused | `schema.prisma:85`; punch only exempts `SUPER_ADMIN` | Inconsistent exemptions | Apply field consistently |
| P1-19 | `GET /employees` is unpaginated; attendance all capped at 100 | `employees.service.ts`; `attendance.controller.ts` | Scale and reporting limits | Pagination + range filters |
| P1-20 | Swagger exposed by default | `main.ts` `/api/docs` | API surface disclosure in production | Disable or protect outside dev |
| P1-21 | Port/config drift | `configuration.ts` default 3000; mobile `.env.example` and README use 4000; actual in untracked `.env` | Setup confusion | One documented port, validated config |
| P1-22 | No token expiry handling in admin storage | `web-admin/src/api/client.ts` `getStoredAdminSession` parses without expiry; no 401 interceptor | Stale session UX and failed calls | Check exp and handle 401 |

### 3.3 P2 — quality and consistency

| # | Finding | Proposed action |
|---|---|---|
| P2-01 | `LeaveRequest.status` is a string while `LeaveStatus` exists | Use the enum after migration |
| P2-02 | `LeaveBalance.remainingDays` duplicates `total − used` and is never updated | Drop the column or derive it consistently |
| P2-03 | `AttendanceRecord.type` is a string | Use an enum |
| P2-04 | `getBalances()` mutates on read (auto-seed) | Seed at employee creation; keep reads pure |
| P2-05 | Employee `fullNameAr` is set to the English name on create | Collect Arabic name or fall back explicitly |
| P2-06 | Salaries stored as `Float` | Use decimal/numeric for money |
| P2-07 | Inconsistent `createdAt`/`updatedAt` in admin snapshot types | Use one contract |
| P2-08 | Hardcoded demo credentials prefilled on login | Remove from release; keep only local fixtures |

---

## 4. `SPRINT_PLAN.md` review

### 4.1 What is inaccurate

| Line | Current claim | Reality | Proposed correction |
|---|---|---|---|
| 4 | “Automated Tests Passing (16/16)” | 48 mobile + 13 backend tests pass | State “48 mobile + 13 backend tests passing; admin build passes” |
| 5 | “Last Updated 2026-10-17” | Work continues through Oct 31 | Update date and add a changelog |
| 16 | “16 unit/integration tests” | 48 mobile tests | Correct the count and command |
| 18 | Push “enforced by hook” | Hook only checks file presence and mobile tests | Describe SHA-bound `verify:all` gate (after Phase 6) |
| 52 | “Interactive QA Simulator Strip” | Presets exist in a hook but are not exposed in the UI | Mark as demo-only or remove from release scope |
| 56 | “TC-2.1 to TC-2.8 — 8/8” | Nine TC-2.x tests exist | Say 9 |
| 58 | Manual “QA Simulator presets” approved | No UI strip to tap; presets are hook-only | Reclassify as not applicable until exposed |
| 66 | “Configure Entra SSO … in microsoftGraph.ts” | Only constants/payloads; login button reports not configured | Mark front-end placeholder |
| 69 | “Automatically compute and sync Teams presence” | No API dispatch | Mark “payload model only” |
| 70 | “Generate Adaptive Cards … notify inbox” | Payload generated, not sent | Mark “payload generation” |
| 72 | “Automatically push OOF calendar events” | Not implemented | Mark planned |
| 74 | “Cryptographic signature sealing” | FNV-1a 32-bit, non-keyed | Call it a tamper-evident checksum, not cryptographic |
| 79 | “TC-3.1 to TC-5.1 — 8/8” | Five tests in that range (3.1–3.3, 4.1, 5.1) | Correct count |
| 85–90 | Sprint 4 “Upcoming” backend/PostGIS | NestJS/PostgreSQL backend exists; no PostGIS (Haversine in app) | Replace with Phase 6–11 status and actual architecture |
| 94–98 | Sprint 5 “Upcoming” release | Still not done, but backend/admin are untracked | Keep as Phase 11, add repo/CI prerequisites |
| 168 | “26/26 TOTAL PASSED” | Historical milestone; now 48 | Mark as historical count |
| 184 | “30/30 PASSED” | Now 48 | Mark as historical count |
| 185–186 | Task 10.4 unchecked | QA file claims Sprint 10 approval; phase-5 commit landed after it | Reset to “evidence missing; re-test at G1” |

### 4.2 Structural problem

The board mixes a **frontend prototype log** (Sprints 1–3, 6–10) with **production delivery claims** (Sprint 4–5 placeholders). It cannot answer “what is production-ready?” That is why the PRD introduces phases and gates.

### 4.3 Proposed replacement for the header and policy

```markdown
# MacqHR Delivery Tracker

> Status: Phases 1–5 implemented (mobile + API + admin prototype).
> Verification: 48 mobile tests, 13 backend tests, admin build passing.
> Release status: Not production-ready. Phase 6 foundation work is in progress.
> Approver: Talha. Every phase requires a SHA-bound manual gate.
> Forward plan: docs/prd/README.md · Tests: docs/prd/test-plan.md

## Mandatory delivery policy
1. Implement the phase scope and its acceptance criteria.
2. Add automated tests at the correct layer.
3. Run `npm run verify:all` (mobile + backend + admin). Zero failures.
4. Execute the phase manual checklist on staging and a physical device.
5. Record approval in `docs/qa/gates/phase-<N>.md` with the full commit SHA.
6. Push only when the gate file matches HEAD. No `--no-verify`.
```

### 4.4 Proposed structural change

- Keep Sprints 1–3 and 6–10 as a **historical prototype log**, with claims corrected to “UI/payload only” where needed.
- Replace Sprints 4–5 with the six phases in the PRD, linking each phase to module IDs and test IDs.
- Add a **phase log table** (phase, commit, gate file, date, decision).
- Add a **known gaps** section linking this review.

---

## 5. `RULES.md` review

The document is a reasonable target-state policy. The problem is that several rules read as if they are implemented. Each should be labelled **Implemented**, **Target**, or **Demo only**.

### 5.1 Section-by-section

| Line | Rule | Current state | Proposed edit |
|---|---|---|---|
| 15 | Pre-push runs `npm run verify` + `.manual-qa-approved` | Mobile only; presence-only | Require `verify:all` and a SHA-matching phase gate; forbid bypass |
| 33 | Verify native mock flags | Client booleans; no attestation | Require server-verifiable attestation; describe reject/flag policy |
| 36 | Server-side Haversine geofence | Implemented | Mark implemented; note only circular fences exist |
| 37 | ≤25 m high confidence; reject >50 m | Backend rejects >50 m; >25 m is not flagged | Add the 25–50 m flagging rule; currently unused |
| 38–39 | Wi-Fi BSSID / BLE fallback | Stored fields only; not verified or enforced | Mark target; never treat a client SSID as proof |
| 40–41 | Root/jailbreak flag or block | Client boolean; hard block | Mark target for attestation |
| 42–43 | Biometric liveness | Client boolean; schema defaults to true | Require server-verifiable proof; remove default true |
| 44–45 | Server NTP timestamp | Server timestamp stored; drift checked against client claim | Mark implemented with caveat; server time is authoritative |
| 51 | “Implemented in microsoftGraph.ts” | Payload/constants only | Say “front-end placeholder”; dispatch is Phase 10–11 |
| 53–60 | SSO, Graph, presence, calendar, directory sync | Not implemented or not configured | Mark all as Target with phase references |
| 67–69 | Haptics, high contrast | Not implemented (`expo-haptics` absent; no high-contrast mode) | Mark target or remove from release criteria |
| 70–71 | RTL helpers | Implemented; some screens still need audit | Keep; add verification rule |
| 74 | Offline queue with cryptographic anti-tamper signing | FNV-1a checksum; sync disabled | Rename to tamper-evident checksum; secure signing is Phase 8 |
| 81 | TLS 1.3 + certificate pinning | Not configured | Mark target; required before release |
| 82 | JWT + refresh tokens in SecureStore | Access token only; no refresh | Mark target; implement Phase 7 |
| 84 | GOSI 9.75/11.75 | Implemented with cap | Add wage-base and cap validation; cite WPS rules |

### 5.2 Proposed new sections

**Section 6 — Data, audit and privacy**

- Audit every approval, correction, role/manager/branch change, payroll export, and security rejection.
- Retention: GPS 90 days; documents while employed + 7 years; audit 7 years (subject to legal review).
- No PII/tokens in logs or analytics.
- Data residency and PDPL review before production.

**Section 7 — Testing standard**

- New endpoint → API test; new calculation → unit test; bug fix → regression test.
- Security checks must be exercised with negative tests (spoof, wrong role, tampered payload).
- A green unit suite never substitutes for a device test of GPS/biometrics/offline.

**Section 8 — Release and operations**

- Environments, migrations, backups, rollback, monitoring, and on-call ownership.
- No production deploy without a signed gate.

**Section 9 — Client trust boundary**

- The mobile client is untrusted. It may request, display, and queue; it may not decide authorization or security verdicts.

---

## 6. `README.md` review

| Issue | Current text | Proposed change |
|---|---|---|
| Missing monorepo setup | Only mobile install/run | Add mobile, backend, admin, database, and seed instructions |
| Missing verification | No test commands | Add `npm run verify`, `verify:all`, backend tests, admin build |
| Overstated features | “document/camera attachment support”; “offline signed punch queue”; “Teams presence” | Mark as planned/demo or link the PRD |
| Missing ports/config | No backend port or env setup | Document `4000` (or the final chosen port) and required variables |
| Missing security note | No warning about demo accounts | State that demo credentials are local-only and must never ship |
| Missing links | No PRD, test plan, account model | Add a documentation index |
| Prerequisites | Node >= 22 | Confirm Node version for Expo 57 / RN 0.86 / Nest 10; document one supported version |

### 6.1 Proposed documentation index

```markdown
## Documentation
- Product requirements & phases: docs/prd/README.md
- Test plan (90 cases): docs/prd/test-plan.md
- Document/code review: docs/prd/document-review.md
- Account & workspace model: docs/account-model/README.md
- Demo video storyboard: docs/demo/README.md
- Delivery rules: RULES.md
- Delivery tracker: SPRINT_PLAN.md
```

---

## 7. Recommended `.gitignore` and repository hygiene

Keep ignored: `.env*` (except examples), `node_modules/`, `.expo/`, build outputs, coverage, `.DS_Store`, `*.tsbuildinfo`, `.test-dist/`, local databases.

Decide and document:

- `ios/` — version it (recommended until native config stabilizes) or generate it reproducibly. Do not leave a required fix invisible.
- `android/` — same decision.
- `data.db` — delete; no SQLite runtime is used.
- `.gravitas/` — project tooling or personal? If project, commit; if personal, ignore.
- `opencode.jsonc` — same decision.
- `metro.config.js` — project configuration; commit it.
- `docs/` — always commit.
- `backend/prisma/migrations/` — always commit; never ignore.

---

## 8. Risk of applying these changes

| Change | Risk | Mitigation |
|---|---|---|
| Commit backend/admin/docs | Accidental secret or large artifact | Review staged files; secret scan; `.env` excluded |
| Version `ios/` | Merge conflicts on prebuild | Commit only after a clean prebuild; document workflow |
| Tighten CORS/secrets | Local setups break | Update `.env.example` and README in the same PR |
| Remove role switcher | Demo flows change | Update demo script; role comes from real accounts |
| Restrict employee detail | Manager screens may lose data they currently show | Define limited manager view first; test with EMP/AUTH cases |
| Enable two-stage approvals | More clicks for HR | Provide HR override for urgent cases |
| SHA-bound gate | More friction per push | Gate per phase, not per commit; hotfix checklist |

---

## 9. Decisions needed before Phase 6

| # | Decision | Recommendation |
|---|---|---|
| R-01 | Apply the corrections to `SPRINT_PLAN.md`, `RULES.md`, and `README.md`? | **Applied** on 2026-10-31 after Talha's approval |
| R-02 | Version `ios/` or rely on prebuild? | **Applied**: iOS source is tracked; `Pods/`, `build/` and local Xcode state stay ignored |
| R-03 | Delete `data.db` and decide on `.gravitas/` / `opencode.jsonc`? | **Applied**: `data.db` deleted; `.gravitas/` and `opencode.jsonc` ignored; `metro.config.js` tracked |
| R-04 | Which port is authoritative? | **Applied**: 4000 is the default in configuration and docs |
| R-05 | Attendance policy for unverified devices | Open for Phase 8: reject office; flag remote; document exceptions |
| R-06 | Keep the QA simulator code or delete it? | **Applied**: unused presets and biometric/Wi-Fi toggles removed; client-asserted evidence remains a Phase 8 item |
| R-07 | SSO in v1 or defer? | **Applied**: SSO button hidden until the Entra client is configured; implementation stays in Phase 7 |
| R-08 | Offline attendance in v1 or defer? | Open for Phase 8: defer until secure signing; hide the queue meanwhile |
| R-09 | Multi-tenant now or after v1? | Open: after v1 per account-model |
| R-10 | Who signs gates if Talha is unavailable? | Open: no delegate for v1 |

---

## 10. What changed and what did not

**Documentation corrections on 2026-10-31 (approved):**

- `SPRINT_PLAN.md` — corrected status and test counts; replaced the push policy with the SHA-bound `verify:all` gate; preserved Sprints 1–10 as a historical prototype log with Demo-only/Target labels; added the Phase 6–11 tracking table, phase log, known gaps, verification commands, and definition of done.
- `RULES.md` — labelled rules Implemented/Partial/Target/Demo only; corrected anti-spoofing, offline signing, Teams/Outlook, TLS/pinning, refresh-token, accessibility, and GOSI/WPS claims; added data/audit/privacy, testing, release/operations, client-trust, and change-control sections.
- `README.md` — rewritten as a monorepo setup guide with backend/admin/mobile instructions, configuration, verification, accurate feature status, local demo accounts, limitations, and documentation index.
- `docs/prd/document-review.md` — recorded that the corrections were applied.

**Phase 6 implementation on 2026-10-31:**

- All application surfaces are tracked: `backend/`, `web-admin/`, `docs/`, the two mobile API clients, `metro.config.js`, and the iOS source (Pods/build ignored).
- Backend secrets and CORS are hardened; production startup fails without `JWT_SECRET`, `DATABASE_URL` or `CORS_ORIGINS`; the wildcard is rejected.
- The employee detail endpoint returns compensation and identity fields only to the employee themselves, HR Admin or Super Admin.
- The client role switcher, prefilled login credentials, dead location simulation controls and the unconfigured SSO button were removed or hidden.
- A Prisma baseline migration, a `verify:all` CI workflow and a SHA-bound pre-push hook were added.

**Still open:**

- G1 device checklist and Talha's signature for Phase 6.
- M1.3: isolated-database API tests and admin unit/component tests.
- Migration adoption against an existing database copy.
- Decisions R-05, R-08, R-09 and R-10.
