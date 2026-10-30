# MacqHR — Development Rules, Repository Restrictions & Architecture Guidelines

This repository hosts **MacqHR**, an employee self-service (ESS) and HR management system for Macquires. The mobile app is built with React Native / Expo; the API with NestJS, Prisma, and PostgreSQL; the administration console with Vite and React.

Rules are labelled by their real status:

- **Implemented** — exists and is exercised by code/tests today.
- **Partial** — exists with known gaps; not sufficient for production claims.
- **Target** — required, not implemented yet.
- **Demo only** — UI or payload for a feature that is not connected to production behavior.

Do not describe a Target or Demo-only item as completed in a sprint report, demo, or release note.

---

## 0. Mandatory delivery pipeline and push restrictions

Every delivery phase follows this gated workflow:

1. **Implementation** — complete the phase scope and acceptance criteria in [docs/prd/README.md](docs/prd/README.md).
2. **Automated tests** — add tests at the correct layer: unit, API, admin, or mobile logic. A bug fix requires a regression test.
3. **Automated verification** — run `npm run verify:all`: mobile typecheck + tests, backend typecheck + tests + build, admin typecheck + build. Zero failures are required.
4. **Manual QA gate** — present the phase on staging and a physical device with the executed checklist from [docs/prd/test-plan.md](docs/prd/test-plan.md). Talha is the approver.
5. **Approval record** — create `docs/qa/gates/phase-<N>.md` with the full commit SHA, build identifier, device, test results, defects, and decision. Use the [template](docs/qa/gates/TEMPLATE.md).
6. **Authorized push** — push only when the gate matches `HEAD`. Any new commit invalidates the gate.
7. **No bypass** — `--no-verify`, a presence-only approval file, a reused approval, or a stale approval is a policy violation.

The current `.manual-qa-approved` file is historical and does not authorize new work. The current hook verifies only the mobile app; it will be replaced in Phase 6.

---

## 1. Technology stack (implemented)

| Layer | Stack |
|---|---|
| Mobile | Expo SDK 57, React Native 0.86, React 19, TypeScript strict |
| API | NestJS 10, Prisma 5, PostgreSQL, JWT, bcryptjs |
| Admin | Vite 5, React 18, Tailwind, Axios |
| Localization | English and Arabic with RTL helpers |
| Theme | Macquires palette tokens; light and dark modes |

The API base is `http://localhost:4000/api`. Set `PORT=4000` explicitly until the configuration default is aligned; the current config fallback is 3000, and the choice must be documented in the environment file.

**Target**: commit a Prisma migration history, API end-to-end tests, admin tests, and CI. Local schema creation currently relies on `prisma db push` plus the seed script.

---

## 2. Attendance, geofence and anti-spoofing

The client is untrusted. A value supplied by the app is evidence to be verified, never a final verdict.

| Rule | Status | Notes |
|---|---|---|
| Server-side Haversine distance and geofence check | **Implemented** | Circular fences only; no polygon support |
| Reject GPS accuracy > 50 m | **Implemented** | 25–50 m flagging is **Target** |
| Mock-location detection | **Partial / Demo only** | Server trusts the client boolean; no attestation |
| Root/jailbreak detection | **Demo only** | Server trusts the client boolean |
| Biometric liveness verification | **Demo only** | Server trusts `biometricVerified`; schema default is `true` |
| Wi-Fi BSSID / BLE beacon corroboration | **Partial** | Fields exist and are stored; not verified or enforced |
| Device attestation (App Attest / Play Integrity) | **Target** | Required before office punches can be called verified |
| Server-authoritative timestamp | **Implemented** | Server time is stored; drift is checked against the client claim |
| One open check-in per local day | **Partial** | Service checks; no database constraint or transaction |
| Break and net working minutes | **Target** | Fields exist but are never populated |
| Offline attendance sync | **Demo only / disabled** | Endpoint returns 403; UI queues punches |
| Attendance corrections | **Target** | No workflow yet |
| Super Admin punch exemption | **Implemented** | `isAttendanceExempt` is not yet applied consistently |

### 2.1 Required behavior (target)

1. Accept an office punch only with verifiable device/app integrity and biometric evidence, or an approved policy exception.
2. Reject an office punch outside the assigned branch geofence. Remote punches require explicit remote eligibility and still pass integrity checks.
3. Use the employee's work timezone for the local day: proposed Asia/Riyadh for office and Saudi-based staff, Asia/Karachi for the Pakistan remote hub.
4. Preserve every original punch. Corrections create an adjustment with before/after values and an audit entry.
5. Never call a punch "verified" when evidence is missing, expired, or client-asserted only.
6. Offline punches must use a device-backed signature or attestation. A 32-bit FNV-1a checksum is not cryptographic signing and must not be described as such.

---

## 3. Microsoft 365 / Microsoft Teams integration

**Current status**: front-end payload and presence mapping only. No Graph network dispatch, no token flow, no configured SSO. The login button reports "not configured".

### 3.1 Target rules

1. **SSO** — Microsoft Entra ID authorization code flow with PKCE, server-side token validation, account linking, and a configuration switch. If disabled, hide the affordance.
2. **Teams** — dispatch Adaptive Cards from a server-side queue with retry and idempotency; store the message ID. Never send Graph credentials from the mobile client.
3. **Outlook** — create, update, and delete out-of-office events on approval, date change, and cancellation, exactly once per business event.
4. **Presence** — sync presence only when the required Graph permission and token lifecycle are in place.
5. **Directory sync** — map Entra users and groups to MacqHR roles with explicit conflict handling.
6. **Failure isolation** — an integration failure must not block the core leave or attendance transaction; the failure is queued, visible to operators, and retryable.

---

## 4. UI/UX and frontend standards

1. **Safe areas and native polish** — implemented. Haptics and high-contrast mode are **Target**; `expo-haptics` is not installed and no high-contrast mode exists.
2. **Dark/light mode** — implemented with theme tokens. Every changed screen must be verified in both themes; no hardcoded colors.
3. **Bilingual RTL** — implemented helpers; **Partial** coverage. Never hardcode `left`/`right` or directional margins. Localize dates and numbers.
4. **Accessibility** — WCAG 2.1 AA is the **Target** for core flows; it requires a manual audit and automated scan before release.
5. **No surprise navigation** — never auto-redirect, auto-close, or move the user without an explicit action.
6. **Demo controls** — role switchers, simulation presets, prefilled credentials, and debug menus must not be reachable in a release build. If a QA tool is needed, gate it behind `__DEV__` and document it.
7. **Feedback** — every submit shows a confirmed result or a specific, actionable error. No silent success.

---

## 5. Security and compliance

1. **Transport** — TLS is required. TLS 1.3 and certificate pinning are **Target** and must be verified before release; no cleartext traffic.
2. **Sessions** — the current implementation issues a 24-hour access token. Refresh tokens, rotation, revocation, and role-change invalidation are **Target** (Phase 7). Store tokens in SecureStore/Keychain on mobile; use `sessionStorage` in the admin console, never `localStorage`.
3. **Secrets** — no fallback JWT secret outside development. Required environment variables must fail startup when missing. Integration secrets stay server-side.
4. **API hardening** — strict CORS allowlist, security headers, request size limits, validation and whitelisting, and rate limits on authentication and write endpoints. Current CORS defaults to `*` and there is no rate limiting; both are **Target** for Phase 6.
5. **Access control** — server-side authorization on every endpoint and object. The client may hide UI but cannot grant capability. Employee salary/ID data is limited to the employee, HR Admin, and Super Admin.
6. **Saudi labor law** — GOSI is implemented: 9.75% employee / 11.75% employer for Saudi nationals with the statutory wage cap; 2% employer hazards for non-Saudis. WPS/Mudad CSV export exists; validation of IDs, IBAN, totals, and encoding is **Target**.
7. **Privacy** — collect the minimum necessary data. Proposed retention: GPS 90 days, documents while employed plus 7 years, audit 7 years, subject to legal/PDPL review. No PII or tokens in logs, crash reports, or analytics.

---

## 6. Data, audit and privacy

1. Every state change that affects money, access, attendance, or leave creates an audit entry: actor, action, resource, timestamp, before/after where relevant.
2. Audit records are append-only. No UI or API path may edit or delete them.
3. Migrations are committed and forward-only in production, with a tested rollback or compensating migration.
4. Backups are taken before migrations; a restore drill is required before release.
5. Who's Off and directory views expose only the fields required for collaboration. Leave type and date visibility is a policy decision; medical information is never exposed broadly.
6. Multi-tenant workspaces are **not** part of v1. The migration path is defined in [docs/account-model/README.md](docs/account-model/README.md) and requires its own PRD.

---

## 7. Testing standard

1. New endpoint → API test with an isolated test database.
2. New calculation or state machine → unit test with boundary fixtures (zero, cap, month/year boundary, timezone).
3. Bug fix → regression test that fails before the fix.
4. Security rule → negative tests: wrong role, spoofed signal, tampered payload, expired token.
5. Mobile UI that depends on GPS, biometrics, camera, or offline behavior → physical-device checklist.
6. Admin form/table behavior → component test plus manual permission check.
7. A green unit suite never substitutes for a device test or a manual gate.
8. Coverage is not a target by itself; the required behaviors in [docs/prd/test-plan.md](docs/prd/test-plan.md) are.

---

## 8. Release and operations

1. Environments: local, staging, production, with separate credentials and data. Demo accounts exist only in local.
2. Release candidates are built with EAS, signed, and installed on clean devices before approval.
3. Health endpoint, structured logs with request IDs, error tracking, and uptime alerting are required before production.
4. Proposed recovery targets: RPO 24 hours, RTO 4 hours, pending confirmation.
5. No production deploy without a signed gate matching the deployed commit.
6. Rollback is documented and rehearsed for the app, API, and database.

---

## 9. Client trust boundary

The mobile and admin clients are untrusted.

- They may request data, display it, and queue actions.
- They may not decide authorization, approval authority, device integrity, biometric validity, or attendance verdicts.
- Every security-relevant claim must be verifiable by the server or explicitly marked unverified and excluded from automatic acceptance.
- Any feature that cannot meet this boundary stays disabled and hidden until it can.

---

## 10. Change control

- Scope changes require a PRD version bump, a change-log entry, and Talha's approval.
- Documentation corrections are applied only after approval; the review record is kept in [docs/prd/document-review.md](docs/prd/document-review.md).
- No silent scope expansion, no unreported feature removal, and no unapproved schema change.
