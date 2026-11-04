# Phase 10 — Admin Console Completion & Persisted Notifications (M6, M7.1–M7.2) Plan

> **Goal Mode Active:** Complete Phase 10 end-to-end, satisfying all 13 test cases (ADM-01 to ADM-10, INT-04, INT-05, UX-03) from `docs/prd/test-plan.md` and modules M6 & M7.1–M7.2 from `docs/prd/README.md`, verified across Mobile, Backend, and Web Admin.

**Key Deliverables:**
1. **Persisted In-App Notifications Engine (M7.1, INT-04)**:
   - Prisma models `Notification` and `DeviceToken`.
   - Database migration `20261105100000_phase10_notifications`.
   - Backend `NotificationsModule` (`NotificationsService`, `NotificationsController`):
     - `GET /notifications` (paginated, unread count)
     - `PATCH /notifications/:id/read`
     - `PATCH /notifications/read-all`
     - `POST /notifications/device-token`
   - Real-time automated notification creation hooks inside `LeavesService` (submit, stage 1 approve, stage 2 approve, reject, cancel) and `AttendanceService` (exceptions).
   - Mobile app integration (`App.tsx`, `DashboardScreen.tsx`) loading real notifications from API, syncing read state across sessions.

2. **Push Token Registration & Preferences (M7.2, INT-05)**:
   - Device token registration for iOS, Android, and Web clients.
   - Push preference categories (`APPROVALS`, `ATTENDANCE`, `ANNOUNCEMENTS`).

3. **Web Administration Console Completion (M6, ADM-01 to ADM-10)**:
   - **ADM-01**: Server-side enforcement of `canAccessWebAdmin` on `/auth/admin/login` (403 for employee, 200 for HR).
   - **ADM-02**: Overview Dashboard metrics (headcount, present count, pending approvals, payroll totals) reconcile with database.
   - **ADM-03**: Branches CRUD with inline validation for latitude (-90..90), longitude (-180..180), radius (25..5000m), Wi-Fi BSSID/SSID allowlists, and activation toggle.
   - **ADM-04**: Employee management with search, department/role/status filters, multi-column sorting, and server pagination.
   - **ADM-05**: Employee details & employment changes (role, manager, branch, remote work, salary) with effective date and audited change records.
   - **ADM-06**: Stage-aware leave approvals (Queue vs History, Stage 1 manager review, Stage 2 HR final approval, HR override, required rejection comment, attachment viewing).
   - **ADM-07**: Attendance review & exceptions: Day containers, radar, exception resolution, and punch details.
   - **ADM-08**: Payroll period selection and WPS/Mudad export validation error surfacing.
   - **ADM-09**: Read-only Audit Log viewer with actor, action, date, and resource filters.
   - **ADM-10**: Session expiration warning banner/modal and 768px tablet responsive layout without data loss.

4. **UX Baseline (UX-03)**:
   - Distinct loading, empty, and error states with Retry actions across all views.

---

## Tasks Breakdown

- [ ] **Task 1: Prisma Schema & Migration (Notifications & Device Tokens)**
  - Add `NotificationType` enum (`LEAVE_REQUEST`, `LEAVE_STAGE_1_APPROVED`, `LEAVE_APPROVAL`, `LEAVE_REJECTION`, `LEAVE_CANCELLED`, `ATTENDANCE_ALERT`, `SYSTEM`).
  - Add `Notification` model with `userId`, `actorId`, `title`, `titleAr`, `body`, `bodyAr`, `type`, `read`, `dataJson`, `createdAt`.
  - Add `DeviceToken` model with `userId`, `token`, `platform`, `createdAt`, `updatedAt`.
  - Create and apply migration `20261105100000_phase10_notifications` to `macqhr_db` and `macqhr_test`.

- [ ] **Task 2: Backend Notifications Module**
  - Implement DTOs in `backend/src/modules/notifications/dto/`.
  - Implement `NotificationsService`:
    - `createNotification(userId, ...)`
    - `findForUser(userId, query)`
    - `markAsRead(userId, id)`
    - `markAllAsRead(userId)`
    - `registerDeviceToken(userId, dto)`
  - Implement `NotificationsController` with JWT auth and Swagger documentation.
  - Wire `LeavesService` and `AttendanceService` to trigger persistent notifications automatically.
  - Unit tests in `notifications.service.spec.ts`.

- [ ] **Task 3: Backend Branches & Admin Enhancements**
  - Add strict coordinate/radius/Wi-Fi validation to `branches.dto.ts` and `BranchesService` (rejecting lat < -90 or > 90, lng < -180 or > 180, radius <= 0).
  - Add overview summary endpoint or verify aggregation query for `ADM-02`.

- [ ] **Task 4: Isolated Database E2E Test Suite (ADM-01 to ADM-10, INT-04, INT-05)**
  - Create `backend/test/admin-console.e2e-spec.ts` covering:
    - ADM-01: Employee credentials refused with 403; HR credentials accepted.
    - ADM-02: Dashboard overview metrics match database counts.
    - ADM-03: Branch creation rejects invalid coordinates/radius with 400; valid branch persists and affects punches.
    - ADM-04: Employee search, filter, and pagination.
    - ADM-05: Employment changes with effective date and audit log.
    - ADM-06: Stage-2 leave approval/rejection with comments.
    - ADM-07: Attendance exception resolution.
    - ADM-08: Payroll WPS export validation.
    - ADM-09: Audit log query with actor/action filters.
    - ADM-10: 401 unauthenticated redirect and session expiry.
    - INT-04: Notification persistence, read state update, unread count decrement.
    - INT-05: Device token registration.

- [ ] **Task 5: Web Admin Console Polish & Tests**
  - Session expiration warning modal before token expiry.
  - Branch create/edit dialog with inline lat/lng/radius validation errors.
  - Responsive layout checks for 768px tablet width.
  - Unit/component tests in `web-admin/src/__tests__/admin-console.test.ts`.

- [ ] **Task 6: Mobile App Notification API Sync**
  - Update `src/services/backendApi.ts` with notification fetching and read-state updating.
  - Connect `App.tsx` and `DashboardScreen.tsx` to load real notifications from backend.

- [ ] **Task 7: Full System Verification & G5 Gate Sign-off**
  - Run `npm run verify:all` (Mobile + Backend + Web Admin).
  - Create `docs/qa/gates/phase-10.md` (Gate G5 sign-off record).
  - Commit changes and report completion with `<!-- GOAL_COMPLETE -->`.
