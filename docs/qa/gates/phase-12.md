# Phase 12 — Manual Approval Record (G7)

- **Approver**: Talha
- **Date/time**: 2026-11-11T15:40:00+05:00
- **Phase**: 12 (G7 — Allowances, Reimbursement Claims & Personal Document Vault: M11.1–M11.5)
- **Commit**: 494cac6f520df5e7286bd29a2fc1d46622527fdc
- **Build**: Local staging / main branch
- **Environment**: staging
- **Device**: iOS Simulator + Physical Device / Chrome & Safari Web Admin
- **Automated evidence**: `npm run verify:all` — mobile 62/62 passed; backend 148/148 unit tests (19 suites) + 90/90 isolated-DB E2E tests (11 suites, including 4/4 in `phase12-claims-vault.e2e-spec.ts`) + clean `nest build`; web-admin 26/26 tests (6 suites) + production build succeeded
- **Manual checklist**: [PRD M11](../prd/README.md) — G7 / Phase 12 checklist (CLM-01–CLM-04, DOC-01, M11.1–M11.5)
- **Open defects**: none
- **Decision**: APPROVED
- **Conditions / notes**: Approved by Talha on 2026-11-08, with CI workflow fix (`494cac6` adding `DATABASE_URL_UNPOOLED` to `.github/workflows/verify.yml`) approved by Talha on 2026-11-11. Phase 12 delivers receipt-backed Medical, Insurance, Petrol, and Wi-Fi reimbursement claims with configurable monthly/annual halala caps (`ReimbursementPolicy`, `ReimbursementClaim`), two-stage approval routing (`PENDING_MANAGER → PENDING_HR → APPROVED`) with direct-to-HR medical privacy (`isPrivateMedical`, `routedDirectlyToHr`), automatic non-taxable payroll integration on open `PayrollRun`s and `Payslip`s with immutability once a period run is `LOCKED`, and the access-controlled Personal Document Vault (`EmployeeDocument` for National ID/Iqama, Passport, Medical Insurance, and Employment Contract) with expiry tracking, HR verification, and automated expiry reminders.

## Executed checklist

| Test ID | Result | Evidence |
|---|---|---|
| CLM-01 | PASS | Wi-Fi and Petrol claims with receipt attachments transition `PENDING_MANAGER → PENDING_HR → APPROVED` and automatically add to the period `PayrollRun` and `Payslip` (`earnings.reimbursementsSar`) |
| CLM-02 | PASS | Private Medical/Insurance claims (`isPrivateMedical: true`) route directly to HR (`PENDING_HR`); Line Manager is blocked from viewing (`403 Forbidden`) and excluded from manager pending list |
| CLM-03 | PASS | Claims missing receipt attachments or exceeding monthly/annual category caps without exception flags are rejected (`400 Bad Request`) |
| CLM-04 | PASS | Once a period `PayrollRun` transitions to `LOCKED`, linked claims and new claims for that period are immutable (`409 Conflict`) |
| DOC-01 | PASS | Personal Document Vault enforces strict access control (owner, `HR_ADMIN`, `SUPER_ADMIN` only; `403` for Manager/other employees), tracks upcoming expirations (`isExpiringSoon`), supports HR verification (`VERIFIED`), and dispatches expiry reminders |

## Sign-off

I confirm that the commit above matches the build I tested, that every P0 case for this phase passed, and that any P1 failure is listed below with my written acceptance.

- Signature: Talha
- Date: 2026-11-11

## Post-gate change rule

Any new commit invalidates this record. Re-run the affected checklist and create a new gate for the new SHA.
