# Phase 11 Operations, Release & Multi-Tenant Readiness Runbook (M10.1–M10.8)

## 1. Environments & Secret Separation (M10.1)
| Environment | API Base URL | Database | Demo Fixtures |
|---|---|---|---|
| **Local** | `http://localhost:4000/api` | `macqhr_db` / `macqhr_test` | Allowed in local dev only |
| **Staging** | `https://staging-api.shiftly.sa/api` | Managed PostgreSQL (Staging) | Disabled (`EXPO_PUBLIC_DEMO_CONTROLS=false`) |
| **Production** | `https://api.shiftly.sa/api` | Managed PostgreSQL (HA Primary + Read Replica) | Strictly forbidden; startup fails fast on default secrets |

## 2. Mobile EAS Build, Install, Upgrade & Rollback (M10.2 & REL-01..04)
- **Build Profiles:** Defined in [`eas.json`](../../eas.json) (`development`, `staging`, `production`).
- **Transport Security & Pinning (M10.3 / REL-02):** Production and staging profiles enforce HTTPS (`EXPO_PUBLIC_ENFORCE_TLS=true`) and SHA-256 leaf/intermediate public-key pinning (`EXPO_PUBLIC_CERT_PIN_SHA256`). Cleartext HTTP traffic is blocked in release builds.
- **Upgrade Safety (REL-03):** Refresh tokens in `expo-secure-store` and signed offline punches in `OfflinePunchQueue` preserve schema compatibility across minor/patch OTA updates; expired or revoked sessions fail safely to the sign-in screen.
- **Release Inspection (REL-04):** Role switchers, simulation presets, and prefilled credentials are excluded from the codebase and verified by `TC-P11.4`.

## 3. Observability, Health & Log Hygiene (M10.4 & OPS-05)
- **Health Endpoints:** `GET /api` and `GET /api/health` execute a live `SELECT 1` database probe, returning HTTP `200 OK` (`status: 'ok'`, `dependencies.database: 'up'`) or HTTP `503 Service Unavailable` when degraded.
- **Request Correlation IDs:** `HttpLoggerMiddleware` accepts or generates an `X-Request-Id` UUID on every request, echoes it in response headers, and tags every log entry (`[reqId=...]`).
- **PII & Token Redaction:** Query parameters matching `token`, `accessToken`, `refreshToken`, `password`, `secret`, `nationalId`, or `iqamaNumber` are automatically replaced with `[REDACTED]` before logging.

## 4. Backup, Restore & Disaster Recovery (M10.5 & OPS-03)
- **Targets:** RPO $\le 24\text{ hours}$ (automated daily snapshots + WAL archiving), RTO $\le 4\text{ hours}$.
- **Drill Script:** [`scripts/backup-restore-drill.sh`](../../scripts/backup-restore-drill.sh) dumps the active database and verifies migration integrity.
- **Measured Drill Time:** $< 15\text{ seconds}$ for schema + baseline dataset restore into `macqhr_test`.

## 5. Privacy & Data Retention Policy (M10.7)
- **Attendance GPS Telemetry (`AttendanceRecord`):** Raw GPS coordinates (`latitude`, `longitude`, `accuracyMeters`) are retained for **90 days** for dispute resolution, after which coordinates are anonymized while preserving verified day status and working minutes.
- **Audit Logs & Payroll Ledgers (`AuditLog`, `PayrollRun`, `Payslip`, `LeaveBalanceLedger`):** Retained immutably for **7 years** in compliance with Saudi Labor Law and ZATCA/GOSI audit requirements.

## 6. Phase 13+ Multi-Tenant Workspace Migration Plan (M10.8)
Per [`docs/account-model/README.md`](../account-model/README.md) decisions D1–D5, single-company MacqHR v1 will evolve to multi-tenant B2B SaaS in Phase 13+ without a rewrite:
1. **Step 1 (Additive Schema):** Introduce `Workspace` (`id`, `slug`, `name`, `country`, `gosiConfigJson`) and `WorkspaceMembership` (`userId`, `workspaceId`, `role`, `employeeId`, `branchId`, `managerMembershipId`).
2. **Step 2 (Backfill Macquires Workspace):** Create the default Macquires workspace record (`slug = 'macquires'`) and backfill one `WorkspaceMembership` row per existing `User` copying `User.role`, `User.employeeId`, and `User.branchId`, plus scoping `Branch`, `PayrollRun`, and `CompanyHoliday` with `workspaceId`.
3. **Step 3 (Dual-Read Guards):** Update `JwtAuthGuard` and `RolesGuard` to resolve permissions from the active `workspaceId` claim in the JWT (falling back to `User.role` during transition).
4. **Step 4 (Rollback Plan):** Because Steps 1–2 are strictly additive and preserve `User.role`, rollback before Step 4 cutover is an immediate config toggle reverting token resolution to `User.role`.
