# Phase 9 — Leave & Approvals v2 (M5 & M9 Leave UX) Implementation Plan

> **Goal Mode Active:** Complete Phase 9 end-to-end, satisfying all 15 test cases (LV-01 to LV-15) from `docs/prd/test-plan.md` and module M5 from `docs/prd/README.md`, verified across Mobile, Backend, and Web Admin.

**Architecture:**
1. **Two-Stage Pipeline:** `PENDING_MANAGER` ➔ `PENDING_HR` ➔ `APPROVED` (or `REJECTED` at either stage), with HR override support.
2. **Immutable Balance Ledger:** `LeaveBalanceLedger` tracks `ACCRUAL`, `USAGE`, `ADJUSTMENT`, `CARRYOVER`, and `CANCELLATION_RESTORE`. Balances are strictly derived and audited.
3. **Saudi Working Schedule & Holiday Calendar:** Calculates billable working days excluding weekends (Fri/Sat for KSA) and public holidays, with half-day (`0.5`) support.
4. **Validation & Cancellation:** Prevents date overlaps, negative/zero days, self-approval by managers, and insufficient balance. Supports self-service employee cancellation with automatic balance restoration for pre-start approved leave.
5. **Full Catalog & Attachments:** 11 distinct leave types (`ANNUAL`, `SICK`, `SICK_ON_FILE`, `HAJJ`, `PATERNITY`, `MATERNITY`, `MARRIAGE`, `BEREAVEMENT`, `REMOTE_WORK`, `UNPAID`, `EMERGENCY`). Secure attachment reference for medical certificates.
6. **Mobile & Admin UX:** Multi-month/year calendar navigation, real-time working days breakdown, stage tracking timelines, and HR decision queues.

---

## Tasks Breakdown

- [x] **Task 1: Prisma Schema & Migration**
  - Add `LeaveStage` and `LeaveLedgerEntryType` enums.
  - Extend `LeaveRequest` with two-stage tracking, half-day fields, and cancellation fields.
  - Add `LeaveBalanceLedger` model for immutable balance audit entries.
  - Add `CompanyHoliday` model for official KSA public holidays.
  - Create and apply migration `20261105000000_phase9_leave_v2`.

- [x] **Task 2: Working Days & Holiday Calculation Utility**
  - Implement `leave-calculator.util.ts`:
    - Handles Friday/Saturday weekends for KSA (`Asia/Riyadh`) and Saturday/Sunday for Pakistan (`Asia/Karachi`).
    - Excludes official Saudi public holidays (Saudi National Day, Founding Day, Eid).
    - Supports half-day (`0.5` days count, `MORNING` vs `AFTERNOON`).
  - Unit tests in `leave-calculator.util.spec.ts`.

- [x] **Task 3: Backend Leave Service v2 (Two-Stage Pipeline & Ledger)**
  - Implement two-stage submission & auto-routing (self-managing or manager-less users route directly to HR).
  - Enforce overlap prevention (conflicting dates check).
  - Implement Manager Decision (`PENDING_MANAGER` ➔ `PENDING_HR` or `REJECTED`).
  - Implement HR Decision (`PENDING_HR` ➔ `APPROVED` or `REJECTED`, or HR Stage 1 override).
  - Wrap approval & balance ledger entry creation in atomic `$transaction`.
  - Idempotency check: Double-tap on approval does not double-deduct.
  - Implement Employee cancellation (`PATCH /leaves/:id/cancel`) with balance restoration.
  - Add Ledger endpoint `GET /leaves/ledger`.

- [x] **Task 4: Isolated Database E2E Test Suite (LV-01 to LV-15)**
  - Create `backend/test/leave-v2.e2e-spec.ts` covering:
    - LV-01: Valid submit ➔ `PENDING_MANAGER`
    - LV-02: Exceeded balance ➔ 400 rejection
    - LV-03: Invalid dates / end before start ➔ 400
    - LV-04: Overlapping dates ➔ 400 with conflicting dates
    - LV-05: Weekend and holiday deduction calculation
    - LV-06: Stage 1 manager approval ➔ `PENDING_HR`
    - LV-07: Stage 2 HR approval + idempotency double-tap
    - LV-08: Manager rejection + comment + zero deduction
    - LV-09: HR rejection at stage 2
    - LV-10: Manager self-request routes directly to HR
    - LV-11: Employee cancellation (pending and approved)
    - LV-12: Half-day request (`0.5` days count)
    - LV-13: Attachment reference handling
    - LV-14: Multi-month/year date validation
    - LV-15: Full 11-type catalog distinct mapping

- [x] **Task 5: Web Admin Console Completion (`LeavesView.tsx`)**
  - Two-stage approval tabs (`Pending Review` vs `Reviewed History`).
  - Stage indicator badge: "Stage 1: Awaiting Manager" vs "Stage 2: Awaiting HR Approval".
  - HR Stage 1 override capability with reason.
  - Rejection modal with required reason comment.
  - Display attachment badge/button and half-day badge.
  - Web Admin unit/component tests in `web-admin/src/__tests__/leaves.test.ts`.

- [x] **Task 6: Mobile App Leave UX (`RequestTimeOffModal.tsx` & Dashboard)**
  - Multi-month/year navigation (`<` / `>` buttons navigating freely through months/years).
  - Full leave type dropdown / picker (11 types with localized Arabic/English labels).
  - Half-day toggle ("Full Day" vs "Half Day Morning / Afternoon").
  - Real-time preview of working days vs weekend/holiday exclusions.
  - Document/medical certificate attachment simulation / selector.
  - Success modal showing request ID, type, and "Next Approver: Line Manager / HR Admin".
  - Mobile unit tests in `src/__tests__/macqhr.test.ts`.

- [x] **Task 7: Full System Verification & G4 Gate Sign-off**
  - Run `npm run verify:all` (Mobile + Backend + Web Admin).
  - Create `docs/qa/gates/phase-9.md` (Gate G4 sign-off template with automated evidence).
