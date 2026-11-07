# Phase 11 — Manual Approval Record (G6)

- **Approver**: Talha
- **Date/time**: 2026-11-07T22:07:30+05:00
- **Phase**: 11 (G6 — Payroll, Enterprise Integrations & Release Readiness: M7.3–M7.7, M8, M10)
- **Commit**: 5f7a6f98e8faeb50d3a9ee652af3654ef2fbba02
- **Build**: Local staging / main branch
- **Environment**: staging
- **Device**: iOS Simulator + Physical Device / Chrome & Safari Web Admin
- **Automated evidence**: `npm run verify:all` — mobile 60/60 passed; backend 132/132 unit tests (16 suites) + 83/83 isolated-DB E2E tests (9 suites, including 7/7 in `phase11-payroll-integrations.e2e-spec.ts`) + clean `nest build`; web-admin 26/26 tests (6 suites) + production build succeeded
- **Manual checklist**: [test plan](../prd/test-plan.md) — G6 / Phase 11 checklist (PAY-01–PAY-06, INT-02, INT-03, INT-06, OPS-03, OPS-05, REL-01–REL-05)
- **Open defects**: none
- **Decision**: APPROVED
- **Conditions / notes**: Approved by Talha on 2026-11-07. Phase 11 delivers period-based payroll runs (`PayrollRun`, `Payslip`, `PayrollAdjustment`, `PayrollWpsExport`) with exact integer halala arithmetic, Saudi GOSI 9.75%/11.75% with 45,000 SAR cap and 2% expat hazards, unpaid leave deduction (`Basic / 30 × unpaidDays`) with zero double-deduction on re-runs, immutable `PREPARED → REVIEWED → LOCKED` workflow, strict Mudad WPS validation (Saudi National ID/Iqama, Saudi IBAN, CSV formula-injection defense, and halala reconciliation), idempotent Microsoft 365 Teams Adaptive Card & Outlook OOO Calendar outbox with non-blocking failure resilience, deep `/api/health` DB dependency probe, `X-Request-Id` correlation & PII query redaction, EAS release build profiles (`eas.json`), `scripts/backup-restore-drill.sh`, and the Phase 13+ Multi-Tenant SaaS migration runbook.

## Executed checklist

| Test ID | Result | Evidence |
|---|---|---|
| PAY-01 | PASS | Employee payslip earnings, GOSI employee share, employer contribution, and net pay reconcile to the exact halala |
| PAY-02 | PASS | Saudi fixtures below (15,000 SAR), at (45,000 SAR), and above (50,000 SAR) statutory cap compute 9.75% employee / 11.75% employer accurately |
| PAY-03 | PASS | Non-Saudi fixture computes 0% employee deduction and 2% employer occupational hazards |
| PAY-04 | PASS | Approved unpaid leave deducts `Basic / 30 × unpaidDays` once per period; re-preparing the run does not double-deduct; payslip includes explanation |
| PAY-05 | PASS | Payroll run transitions `PREPARED → REVIEWED → LOCKED`; locked period rejects re-preparation (`409 Conflict`) and remains unaffected by subsequent salary changes |
| PAY-06 | PASS | Valid period exports UTF-8 Mudad WPS CSV matching payslip net totals; missing/invalid National ID, Iqama, or Saudi IBAN blocks export (`400 Bad Request`) with field-level error report |
| INT-02 | PASS | Leave submission with simulated Teams failure records `FAILED` outbox event; retry delivers Adaptive Card once (`teams-card-<id>`) and subsequent retries are idempotent |
| INT-03 | PASS | Leave approval creates one Outlook OOO event (`outlook-ooo-<id>`); rescheduling dates updates the same event; cancelling removes it (`CANCELLED`) |
| INT-06 | PASS | Teams/Outlook sandbox outage (`simulateFailure: true`) never blocks core leave submission or approval transactions |
| OPS-03 | PASS | `scripts/backup-restore-drill.sh` dumps 74 KB logical snapshot of `macqhr_db` and verifies migration parity in `< 2s` |
| OPS-05 | PASS | `GET /api/health` verifies live PostgreSQL connectivity (`database: 'up'`), propagates `X-Request-Id`, and `redactSensitiveUrl` strips tokens/PII |
| REL-01 | PASS | EAS build profiles (`eas.json`) configured for development, staging, and store production |
| REL-02 | PASS | Staging and production profiles enforce TLS (`EXPO_PUBLIC_ENFORCE_TLS=true`) and SHA-256 certificate pinning |
| REL-03 | PASS | Session refresh manager and signed offline punch queue preserve state across app upgrades |
| REL-04 | PASS | Zero demo role switchers, simulation presets, or prefilled credentials present in release builds (`TC-P11.4`) |
| REL-05 | PASS | Tiered skeleton hydration (`<250ms` Tier 1) and API latency (`<100ms` p95 local/staging) verified |

## Sign-off

I confirm that the commit above matches the build I tested, that every P0 case for this phase passed, and that any P1 failure is listed below with my written acceptance.

- Signature: Talha
- Date: 2026-11-07

## Post-gate change rule

Any new commit invalidates this record. Re-run the affected checklist and create a new gate for the new SHA.
