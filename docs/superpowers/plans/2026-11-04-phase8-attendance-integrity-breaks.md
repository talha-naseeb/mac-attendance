# Phase 8 — Attendance Integrity, Location & Breaks (M4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade attendance into an event-sourced, day-based model with local timezone boundaries (`Asia/Riyadh` & `Asia/Karachi`), real break persistence (`BREAK_START` / `BREAK_END`), two remote modes (standing vs per-day approval), and non-blocking checkouts with exception logging.

**Architecture:** Replace single-point inferred attendance with an `AttendanceDay` container linked to append-only `AttendanceRecord` events. Day boundaries are computed per user's location (`Asia/Riyadh` for HQ, `Asia/Karachi` for Pakistan hub). Punches support `CHECK_IN`, `CHECK_OUT`, `BREAK_START`, and `BREAK_END`. Check-ins strictly enforce anti-spoofing and geofences; check-outs outside geofences are accepted rather than trapping the employee, but flagged as `AttendanceException` for HR review.

**Tech Stack:** NestJS 10, Prisma 5, PostgreSQL, `@nestjs/jwt`, Jest + Supertest (isolated database), Vite 5 + React 18 web admin, Vitest, Expo SDK 57 React Native.

**Spec:** [docs/superpowers/specs/2026-11-01-location-attendance-design.md](../specs/2026-11-01-location-attendance-design.md), [docs/prd/README.md](../../prd/README.md) module M4, [docs/prd/test-plan.md](../../prd/test-plan.md) ATT-01…ATT-10.

---

## Global Constraints

- **Single Open Session**: Only one active `CHECK_IN` per employee per local workday.
- **Authoritative Server Time**: Day grouping and timestamps use server time adjusted to employee local timezone (`Asia/Riyadh` or `Asia/Karachi`).
- **Non-Blocking Checkout**: Check-out outside office geofence never fails the punch; it records the punch and creates an `AttendanceException` (`OUTSIDE_OFFICE_GEOFENCE`).
- **Strict Check-In Security**: Check-in with mock location, rooted device, or low GPS accuracy (>50m) is rejected immediately (403/400).
- **Two Remote Modes**:
  1. Permanent remote employees (`User.isRemoteAllowed = true`) punch remotely without daily approval.
  2. Office employees punch remotely only if an approved `RemoteWorkRequest` exists for that date.
- **Break Rules**: `BREAK_START` requires an open check-in and no open break. `BREAK_END` closes the open break and tallies `breakMinutes`. Checking out while on break automatically closes the break at the checkout timestamp.
- **Verification Guarantee**: Every task ends with `npm run verify:all` passing (mobile + backend + admin).

---

## File Structure

**Backend — Create**
- `backend/src/common/utils/timezone.util.ts` + `timezone.util.spec.ts` — Timezone-aware day calculations (`Asia/Riyadh` / `Asia/Karachi`).
- `backend/src/modules/attendance/dto/remote-request.dto.ts` — Create, decision, and query DTOs for remote work requests.
- `backend/src/modules/attendance/dto/location-event.dto.ts` — DTOs for breaks, relocations, and declarations.
- `backend/src/modules/attendance/dto/exception-review.dto.ts` — DTO for HR reviewing exceptions (`ACCEPTED` / `ESCALATED`).
- `backend/prisma/migrations/20261104000000_attendance_days/migration.sql` — Prisma migration for new models and extensions.
- `backend/test/attendance-day.e2e-spec.ts` — Comprehensive isolated-database E2E suite for Phase 8.

**Backend — Modify**
- `backend/prisma/schema.prisma` — Add `AttendanceDay`, `RemoteWorkRequest`, `SavedLocation`, `AttendanceException`, and extend `AttendanceRecord`.
- `backend/src/modules/attendance/attendance.service.ts` — Core day container, breaks, remote modes, exceptions, and queries.
- `backend/src/modules/attendance/attendance.controller.ts` — Add endpoints for today's day state, breaks, remote requests, and exceptions.
- `backend/src/modules/attendance/dto/punch.dto.ts` — Extend with `clientEventId`, `reasonCode`, etc.

**Web Admin — Modify**
- `web-admin/src/api/client.ts` — Add API calls for daily attendance, remote requests, and exception review.
- `web-admin/src/components/AttendanceView.tsx` — Add Day Timeline view, Exception Review modal, and Remote Request approval tab.

**Mobile — Modify**
- `src/services/clockInService.ts` — Wire break events (`BREAK_START` / `BREAK_END`) and remote request checks.
- `src/screens/ClockInScreen.tsx` — Expose break start/end toggle and workday elapsed/break timers.

---

## Tasks

### Task 1: Prisma Schema & Migration for Attendance Day Model
**Files:**
- Modify: `backend/prisma/schema.prisma`
- Create: `backend/prisma/migrations/20261104000000_attendance_days/migration.sql`

- [ ] Add `LocationVerdict`, `RemoteRequestStatus`, `ExceptionType`, `ExceptionSeverity`, `ExceptionStatus` enums to `schema.prisma`.
- [ ] Add `AttendanceDay`, `RemoteWorkRequest`, `SavedLocation`, `AttendanceException` models.
- [ ] Extend `AttendanceRecord` with `dayId`, `clientEventId`, `reasonCode`, `verdict`, `distanceToDeclared`, `source`, `lateSubmission`.
- [ ] Generate and apply migration to local and test databases (`npx prisma migrate dev --name attendance_days` or `prisma migrate deploy`).
- [ ] Run `npm run verify:all` to ensure schema types compile.

### Task 2: Timezone & Workday Boundary Utility
**Files:**
- Create: `backend/src/common/utils/timezone.util.ts`
- Test: `backend/src/common/utils/timezone.util.spec.ts`

- [ ] Write unit test: correctly derives `dateIso` (YYYY-MM-DD) for a 00:30 UTC timestamp in `Asia/Riyadh` (UTC+3) -> next calendar day.
- [ ] Write unit test: resolves correct timezone (`Asia/Riyadh` for Saudi office/HQ, `Asia/Karachi` for Pakistan remote hub).
- [ ] Implement `getLocalDateIso(date: Date, timezone: string): string` and `getStartAndEndOfDay(dateIso: string, timezone: string)`.
- [ ] Run Jest unit test to ensure 100% pass.

### Task 3: Core AttendanceDay & Break Tracking Logic
**Files:**
- Modify: `backend/src/modules/attendance/attendance.service.ts`
- Modify: `backend/src/modules/attendance/dto/punch.dto.ts`
- Test: `backend/src/modules/attendance/attendance.service.spec.ts`

- [ ] Write unit tests for:
  - Creating lazy `AttendanceDay` on first punch.
  - Rejecting duplicate open `CHECK_IN`.
  - Recording `BREAK_START` and `BREAK_END` on the day timeline.
  - Auto-closing active break on `CHECK_OUT`.
  - Accurately tallying `workingMinutes` and `breakMinutes`.
- [ ] Implement lazy `AttendanceDay` retrieval and atomic session checks in `attendance.service.ts`.
- [ ] Implement `punchBreak(userId, type: BREAK_START | BREAK_END, meta)` with state validation.
- [ ] Run unit tests and confirm pass.

### Task 4: Non-Blocking Check-Out & Exception Logging
**Files:**
- Modify: `backend/src/modules/attendance/attendance.service.ts`
- Create: `backend/src/modules/attendance/dto/exception-review.dto.ts`
- Modify: `backend/src/modules/attendance/attendance.controller.ts`

- [ ] Write unit tests:
  - Office check-in outside 150m is rejected (403).
  - Office check-out outside 150m is accepted and logs `AttendanceException` (`OUTSIDE_OFFICE_GEOFENCE`).
  - HR/Super Admin can review exception (`ACCEPTED` / `ESCALATED`) with audit trail.
- [ ] Implement exception creation in `punch` checkout flow.
- [ ] Implement `GET /attendance/exceptions` and `POST /attendance/exceptions/:id/review`.
- [ ] Run unit tests and confirm pass.

### Task 5: Remote Work Requests & Dual Remote Mode
**Files:**
- Create: `backend/src/modules/attendance/dto/remote-request.dto.ts`
- Modify: `backend/src/modules/attendance/attendance.service.ts`
- Modify: `backend/src/modules/attendance/attendance.controller.ts`

- [ ] Write unit tests:
  - Permanent remote employee (`isRemoteAllowed = true`) punches `REMOTE` without approval.
  - Office employee without approval attempting `REMOTE` punch gets 403.
  - Office employee with approved `RemoteWorkRequest` successfully punches `REMOTE`.
  - Manager approves direct report's request; employee cannot approve own request.
- [ ] Implement `POST /attendance/remote-requests`, `GET /attendance/remote-requests/pending`, `POST /attendance/remote-requests/:id/decision`.
- [ ] Run unit tests and confirm pass.

### Task 6: Web Admin Console Attendance Overhaul
**Files:**
- Modify: `web-admin/src/api/client.ts`
- Modify: `web-admin/src/components/AttendanceView.tsx`

- [ ] Add API client methods for `getDailyAttendance`, `getExceptions`, `reviewException`, `getRemoteRequests`, `decideRemoteRequest`.
- [ ] Add Timeline & Break viewer in `AttendanceView.tsx` showing check-in, breaks, check-out, and net hours.
- [ ] Add Exception Review drawer with "Accept" and "Escalate" actions.
- [ ] Add Remote Work Requests tab with one-click Approve/Reject for HR Admin.
- [ ] Verify light/dark theme and Arabic RTL styling.
- [ ] Run `cd web-admin && npm test && npm run build` to confirm clean build.

### Task 7: Mobile App Break Actions & Workday Timers
**Files:**
- Modify: `src/services/clockInService.ts`
- Modify: `src/screens/ClockInScreen.tsx`
- Test: `__tests__/macqhr.test.ts` (extend suite)

- [ ] Wire `recordBreakStart` and `recordBreakEnd` in `clockInService.ts`.
- [ ] Update `ClockInScreen.tsx` to render "Start Break" / "End Break" button when checked in.
- [ ] Render live break counter and elapsed working time.
- [ ] Add unit test in `macqhr.test.ts` verifying break state transitions.
- [ ] Run `npm run verify` to confirm mobile test suite passes.

### Task 8: Isolated-Database E2E Suite & Full Verification
**Files:**
- Create: `backend/test/attendance-day.e2e-spec.ts`

- [ ] Write Supertest E2E cases against isolated `macqhr_test` DB:
  - Full workday cycle: check-in -> break start -> break end -> check-out.
  - Remote request submission -> manager approval -> remote check-in.
  - Non-blocking geofence checkout exception creation & HR review.
  - Concurrency test: simultaneous check-in attempts on same day.
- [ ] Run `npm run verify:all` (Mobile + Backend Unit + Backend E2E + Admin Test + Admin Build).
- [ ] Confirm 100% pass across all suites.
