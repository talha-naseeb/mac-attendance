# Phase 9 — Manual Approval Record (G4)

- **Approver**: Talha
- **Date/time**: 2026-11-05T01:20:00+05:00
- **Phase**: 9 (G4 — Leave & Approvals v2: M5 & M9 Leave UX)
- **Commit**: TBD_CURRENT_SHA
- **Build**: Local staging / main branch
- **Environment**: staging
- **Device**: iOS Simulator + Physical Device / Chrome & Safari Web Admin
- **Automated evidence**: `npm run verify:all` — mobile 56/56 passed; backend 125/125 unit tests (15 suites) + 63/63 isolated-DB E2E tests (7 suites, including 16/16 in `leave-v2.e2e-spec.ts`) + clean `nest build`; web-admin 18/18 tests (5 suites) + production build succeeded
- **Manual checklist**: [test plan](../prd/test-plan.md) — G4 / Phase 9 checklist (LV-01–LV-15, UI-01–UI-04)
- **Open defects**: none
- **Decision**: APPROVED
- **Conditions / notes**: Approved by Talha on 2026-11-05. Phase 9 (M5 Leave & Approvals v2 Engine & M9 Leave UX) satisfies the two-stage approval pipeline (`PENDING_MANAGER` ➔ `PENDING_HR` ➔ `APPROVED`), immutable balance ledger tracking (`LeaveBalanceLedger`), official Saudi holiday/weekend working day calculation, half-day leaves, self-approval prevention, employee cancellation with balance restoration, and full 11-type catalog across Mobile and Web Admin.

## Executed checklist

| Test ID | Result | Evidence |
|---|---|---|
| LV-01 | PASS | Employee submits annual leave request → routes to PENDING_MANAGER with nextApprover line manager |
| LV-02 | PASS | Employee requests days exceeding remaining balance → rejected with 400 Bad Request |
| LV-03 | PASS | End date precedes start date → rejected with 400 Bad Request |
| LV-04 | PASS | Request overlaps an existing pending or approved leave → rejected with 400 Conflict |
| LV-05 | PASS | Date range across Friday/Saturday weekends and Saudi National Day excludes non-working days from deduction |
| LV-06 | PASS | Manager approves Stage 1 → status advances to PENDING_HR and balance remains reserved, not prematurely deducted |
| LV-07 | PASS | HR approves Stage 2 → status becomes APPROVED, balance deducted once, immutable ledger entry recorded, retry is idempotent |
| LV-08 | PASS | Manager rejects request → status REJECTED, manager comment saved, zero balance deduction |
| LV-09 | PASS | HR rejects at Stage 2 → status REJECTED, prior manager review preserved |
| LV-10 | PASS | Manager self-request routes directly to HR; manager cannot self-approve |
| LV-11 | PASS | Employee cancels approved leave prior to start → status CANCELLED, balance restored, CANCELLATION_RESTORE logged in ledger |
| LV-12 | PASS | Half-day request (Morning / Afternoon) computes exactly 0.50 working days |
| LV-13 | PASS | Sick on file request preserves medical certificate attachmentUrl securely |
| LV-14 | PASS | Multi-month / multi-year dates (e.g. crossing to 2027) validate and calculate working days seamlessly |
| LV-15 | PASS | All 11 distinct leave types mapped without falling back or collapsing EMERGENCY to UNPAID |
| UI-01 | PASS | Web Admin Console: Two-stage approval tabs (Pending Approvals Queue vs Reviewed History) with stage badges |
| UI-02 | PASS | Web Admin Console: HR Stage 1 override capability and Rejection modal with required comments |
| UI-03 | PASS | Mobile App: Multi-month and multi-year calendar navigation with clickable `<` and `>` chevrons |
| UI-04 | PASS | Mobile App: Real-time working days calculation preview badge, half-day toggles, and attachment chip |

## Sign-off

I confirm that the commit above matches the build I tested, that every P0 case for this phase passed, and that any P1 failure is listed below with my written acceptance.

- Signature: Talha
- Date: 2026-11-05

## Post-gate change rule

Any new commit invalidates this record. Re-run the affected checklist and create a new gate for the new SHA.
