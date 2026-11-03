# Location & Attendance Model

**Status:** Design approved in conversation on 2026-11-01; written spec pending review
**Delivery phase:** Phase 8 (Attendance integrity), after G2
**Owner:** Talha
**Related:** [PRD](../../prd/README.md) M4, [test plan](../../prd/test-plan.md), [tracker](../../../SPRINT_PLAN.md) Phase 8
**Implementation status:** Not started

---

## 1. Problem

The current attendance model cannot describe a real workday.

- `AttendanceRecord` stores one punch with one coordinate. A day is inferred by scanning rows, not represented as an entity.
- `workMode: REMOTE` skips the branch geofence entirely (`attendance.service.ts`, layer 5), gated only by the account-level boolean `User.isRemoteAllowed`. There is no per-day approval and no declared location.
- There is no way to record a mid-day move, a connectivity-driven relocation, or a client visit. The only supported actions are check-in and check-out, each with a single point.
- Outside the geofence, an office punch is rejected with a message such as "You are 2,000 m away from Saudi headquarters. Must be within 150 m geofence", even when the employee is legitimately at a client or approved remote location.
- Working minutes exist as columns but are never computed; `dateIso` is derived in UTC, so the workday boundary is wrong for Riyadh (UTC+3).

This spec defines a day-based, event-sourced attendance model that supports:

1. An approved remote day where the employee chooses the remote location after approval.
2. Moving to a different location mid-day because of connectivity or environment.
3. An on-site employee leaving the building for a client meeting during work hours, and returning.
4. Mixed days that combine office, remote, and field segments.
5. A clear separation between what blocks a punch (spoofing) and what is accepted but reviewed by HR (location mismatch).

## 2. Goals and non-goals

### Goals

- Represent one workday as a container with an ordered timeline of location events.
- Approve remote work per day, then let the employee declare the actual work location.
- Accept and record legitimate movement and field visits; flag exceptions for HR instead of failing the punch.
- Keep spoofing, rooted devices, and unusable GPS strict for check-in and location events.
- Never trap an employee on the clock because check-out telemetry failed.
- Preserve the existing punch API and history response shape while extending it additively.
- Give HR and managers a review queue and a day timeline instead of a flat punch list.
- Use the company workday (Asia/Riyadh) consistently for dates and totals.

### Non-goals

- Continuous or background location tracking. Location is captured only when the employee acts.
- Device attestation (Play Integrity / DeviceCheck). Telemetry remains client-asserted in this phase.
- Push notifications for approvals or exceptions. In-app queues only.
- Multi-stage remote approval. One decision by a manager or HR.
- Offline punch sync. The existing offline endpoint stays disabled.
- Break persistence. Event types are reserved, but breaks are a sibling Phase 8 workstream.
- Overnight shifts. A session must start and end on the same company day.
- Payroll calculation, export, and corrections beyond exception review.

## 3. Current implementation

| Area | Current behaviour | Source |
|---|---|---|
| Punch | One `AttendanceRecord` per check-in or check-out with a single coordinate | `backend/prisma/schema.prisma` |
| Geofence | Layer 5 compares the punch with the assigned branch radius (default 150 m) and throws when outside | `attendance.service.ts` `validateAntiSpoofing` |
| Remote | Skipped geofence when `dto.workMode === 'REMOTE'` and `user.isRemoteAllowed`; row flagged `AUTHORIZED_REMOTE_HUB` | `attendance.service.ts` `punch` |
| Branch | Punch must target the employee's assigned branch | `attendance.service.ts` `punch` |
| Day identity | `dateIso` from `toISOString().slice(0, 10)`, i.e. UTC | `attendance.service.ts` |
| Mobile eligibility | Binary `remote_pakistan` / `office_riyadh`; remote always allowed when the pill is enabled | `src/services/clockInService.ts` |
| Offline | `POST /attendance/offline-sync` always returns 403 | `attendance.service.ts` `syncOfflinePunches` |
| Admin history | Flat record list; team view shows first check-in and last check-out | `attendance.service.ts` |
| Deferred work | No isolated-DB API tests, no admin test suite | `SPRINT_PLAN.md`, M1.3 |

## 4. Options considered

| Option | Description | Outcome |
|---|---|---|
| A. Patch the punch | Add a remote location and approval flag to each punch; keep one point per row | Rejected. Cannot represent moves or visits; duplicates and weak reporting |
| B. Day plus location timeline | One `AttendanceDay` per employee per date, with append-only location events, approvals, and exceptions | **Selected** |
| C. Zone graph and policy engine | Named zones with per-zone rules and background geofencing | Rejected for this phase. Continuous tracking raises privacy and battery costs; over-engineered for the team size |

Option B borrows one idea from C: reusable saved locations (home, hub, client site) so recurring places are one tap.

## 5. Domain model

The change is additive. `AttendanceRecord` stays as the event log instead of being replaced or dropped. Its `type` column is already a string, so new event types require no rewrite of existing rows.

### 5.1 Enums

```prisma
enum LocationVerdict {
  INSIDE_OFFICE
  OUTSIDE_OFFICE
  INSIDE_DECLARED_ZONE
  OUTSIDE_DECLARED_ZONE
  UNVERIFIED
}

enum RemoteRequestStatus {
  PENDING
  APPROVED
  REJECTED
  CANCELLED
}

enum FieldVisitStatus {
  REQUESTED
  APPROVED
  DECLINED
  ACTIVE
  COMPLETED
  CANCELLED
}

enum ExceptionType {
  OUTSIDE_OFFICE_GEOFENCE
  OUTSIDE_DECLARED_ZONE
  EXCESSIVE_DISTANCE
  LATE_DECLARATION
  VISIT_OVERRUN
  VISIT_NOT_CLOSED
  LOW_ACCURACY_CHECKOUT
  UNVERIFIED_CHECKOUT
  VELOCITY_ANOMALY
}

enum ExceptionSeverity {
  LOW
  MEDIUM
  HIGH
}

enum ExceptionStatus {
  OPEN
  ACCEPTED
  ESCALATED
}
```

`AttendanceDay.mode` reuses the existing `WorkMode` enum and records the approved plan only. A day that mixes office, remote, and field segments is still `OFFICE` or `REMOTE`; the mix is expressed by the event timeline. This avoids a state that has to be continuously re-derived.

`AttendanceStatus`, `WorkMode`, and `UserRole` keep their current values; `WorkMode` is reused for the day mode. `AttendanceStatus.REJECTED` remains defined but is not used at day level.

### 5.2 AttendanceDay

```prisma
model AttendanceDay {
  id                  String            @id @default(uuid())
  userId              String
  user                User              @relation(fields: [userId], references: [id], onDelete: Cascade)

  dateIso             String            // YYYY-MM-DD in Asia/Riyadh
  mode                WorkMode          @default(OFFICE)
  remoteRequestId     String?
  remoteRequest       RemoteWorkRequest? @relation(fields: [remoteRequestId], references: [id], onDelete: SetNull)

  declaredLabel       String?
  declaredLatitude    Float?
  declaredLongitude   Float?
  declaredRadiusMeters Float?           // 100-2000, default 500
  declaredSource      String?           // DECLARED | CHECK_IN_LOCATION | SAVED_LOCATION
  declaredAt          DateTime?

  status              AttendanceStatus  @default(INCOMPLETE)
  firstCheckInAt      DateTime?
  lastCheckOutAt      DateTime?
  workingMinutes      Int               @default(0)
  breakMinutes        Int               @default(0)
  openExceptionCount  Int               @default(0)

  events              AttendanceRecord[]
  exceptions          AttendanceException[]
  fieldVisits         FieldVisit[]

  createdAt           DateTime          @default(now())
  updatedAt           DateTime          @updatedAt

  @@unique([userId, dateIso])
  @@index([dateIso])
  @@index([status])
}
```

Rules:

- One day per employee per company date. Created lazily by the first event or by `GET /attendance/today`.
- `mode` is `REMOTE` when an approved remote request covers the date, or when `User.isRemoteAllowed` is true (standing remote arrangement). Otherwise `OFFICE`.
- A day with no events updates to `REMOTE` when a covering request is approved. A day that already has events never changes mode; if approval lands after a check-in, it applies to future dates only, and correcting the existing day is an exception review rather than a silent flip.
- `declaredSource` is `DECLARED` when the employee picked a location, `SAVED_LOCATION` when picked from saved locations, and `CHECK_IN_LOCATION` when the check-in coordinates were used because no declaration existed.
- `workingMinutes` is the sum of all completed check-in/check-out session intervals on the day. Field visit time inside a session counts as work. Gaps between sessions are not counted.
- `openExceptionCount` is denormalized for list performance and recomputed whenever exceptions change.

### 5.3 AttendanceRecord extensions

Existing columns are unchanged. New nullable columns:

```prisma
dayId             String?
day               AttendanceDay? @relation(fields: [dayId], references: [id], onDelete: Cascade)
clientEventId     String?        // client-generated UUID for retry safety
reasonCode        String?        // CONNECTIVITY | POWER | SAFETY | CLIENT_MEETING | RETURN_TO_OFFICE | DECLARED_LOCATION | OTHER
verdict           LocationVerdict?
distanceToDeclared Float?
source            String?        // GPS | NETWORK | MANUAL
fieldVisitId      String?
fieldVisit        FieldVisit?    @relation(fields: [fieldVisitId], references: [id], onDelete: SetNull)
capturedAt        DateTime?      // client capture time; equals timestamp for real-time events
lateSubmission    Boolean        @default(false)

exceptions        AttendanceException[]

@@unique([userId, clientEventId])
@@index([dayId, timestamp])
```

Canonical values for `type`:

- `CHECK_IN`
- `CHECK_OUT`
- `RELOCATION`
- `FIELD_VISIT_START`
- `FIELD_VISIT_END`

`BREAK_START` and `BREAK_END` are reserved names for the sibling break workstream and are not written in this phase.

`timestamp` remains the server acceptance time for punches. For late location events, `capturedAt` holds the client time and `timestamp` holds the server time; the timeline sorts by `capturedAt ?? timestamp`.

### 5.4 RemoteWorkRequest

```prisma
model RemoteWorkRequest {
  id              String              @id @default(uuid())
  userId          String
  user            User                @relation(fields: [userId], references: [id], onDelete: Cascade)

  startDateIso    String              // YYYY-MM-DD, inclusive
  endDateIso      String              // YYYY-MM-DD, inclusive
  reason          String
  status          RemoteRequestStatus @default(PENDING)

  decidedById     String?
  decidedBy       User?               @relation("RemoteRequestDecisions", fields: [decidedById], references: [id], onDelete: SetNull)
  decidedAt       DateTime?
  rejectionReason String?

  days            AttendanceDay[]
  createdAt       DateTime            @default(now())
  updatedAt       DateTime            @updatedAt

  @@index([userId, status])
  @@index([status, startDateIso])
}
```

Rules:

- Any active employee may request remote work; the old `isRemoteAllowed` boolean no longer gates requests, only the standing-remote convenience.
- `startDateIso` may be today or later, never in the past. Same-day requests are allowed before the employee has checked in.
- Maximum range is 30 days per request (configurable).
- Overlapping `PENDING` or `APPROVED` requests for the same employee are rejected with 409.
- A manager may decide only requests from direct reports (`User.managerId`); HR_ADMIN and SUPER_ADMIN may decide any request. No one may decide their own request.
- Approval never creates day rows. Days are created lazily and read the covering approved request.
- The employee may cancel a `PENDING` request, or an `APPROVED` request whose first date is in the future.

### 5.5 FieldVisit

```prisma
model FieldVisit {
  id                String           @id @default(uuid())
  userId            String
  user              User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  dayId             String?
  day               AttendanceDay?   @relation(fields: [dayId], references: [id], onDelete: SetNull)

  startsAt          DateTime
  endsAt            DateTime
  actualStartAt     DateTime?
  actualEndAt       DateTime?

  destinationLabel  String
  destinationLat    Float
  destinationLng    Float
  clientName        String?
  notes             String?

  status            FieldVisitStatus @default(REQUESTED)
  isAdHoc           Boolean          @default(false)

  decidedById       String?
  decidedBy         User?            @relation("FieldVisitDecisions", fields: [decidedById], references: [id], onDelete: SetNull)
  decidedAt         DateTime?
  rejectionReason   String?

  events            AttendanceRecord[]
  createdAt         DateTime         @default(now())
  updatedAt         DateTime         @updatedAt

  @@index([userId, startsAt])
  @@index([status, startsAt])
}
```

Rules:

- `startsAt` and `endsAt` must fall on the same company day, `endsAt > startsAt`, and the window may not exceed 4 hours (configurable).
- Requests are made in advance. The employee may cancel before starting.
- Ad-hoc visits are created with `isAdHoc = true`, `status = APPROVED`, `startsAt = now`, and a required expected end. They raise a `LATE_DECLARATION` exception and appear in the manager's queue.
- Only one `ACTIVE` visit per employee at a time. Overlapping `REQUESTED` or `APPROVED` windows are rejected with 409.
- Starting writes `FIELD_VISIT_START`; ending writes `FIELD_VISIT_END` and sets `actualStartAt`/`actualEndAt`.
- A visit still open at the end of its company day is reconciled on the next read: `status = COMPLETED`, `actualEndAt = endsAt`, `VISIT_NOT_CLOSED` exception.
- Ending more than 15 minutes after `endsAt` sets a `VISIT_OVERRUN` exception. Ending within the grace period does not.
- An `APPROVED` or `ACTIVE` visit whose window (plus 15 minutes of grace) contains an event suppresses `OUTSIDE_OFFICE_GEOFENCE` and `OUTSIDE_DECLARED_ZONE` for that event. The timeline still shows the verdict; only the exception is suppressed.

### 5.6 SavedLocation

```prisma
model SavedLocation {
  id             String   @id @default(uuid())
  userId         String
  user           User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  label          String
  latitude       Float
  longitude      Float
  radiusMeters   Float    @default(500)
  isDefault      Boolean  @default(false)

  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@unique([userId, label])
  @@index([userId])
}
```

Maximum 10 per employee. Exactly one default at most, enforced by the service (setting a new default clears the previous one). Used only to prefill declarations; the day always stores its own copy of the location.

### 5.7 AttendanceException

```prisma
model AttendanceException {
  id             String            @id @default(uuid())
  dayId          String
  day            AttendanceDay     @relation(fields: [dayId], references: [id], onDelete: Cascade)
  eventId        String?
  event          AttendanceRecord? @relation(fields: [eventId], references: [id], onDelete: SetNull)
  fieldVisitId   String?

  type           ExceptionType
  severity       ExceptionSeverity
  status         ExceptionStatus   @default(OPEN)
  dedupeKey      String            @unique

  reviewedById   String?
  reviewedBy     User?             @relation("ExceptionReviews", fields: [reviewedById], references: [id], onDelete: SetNull)
  reviewedAt     DateTime?
  resolutionNote String?

  createdAt      DateTime          @default(now())
  updatedAt      DateTime          @updatedAt

  @@index([dayId, status])
  @@index([status, createdAt])
}
```

`User` gains reverse relations for `attendanceDays`, `remoteWorkRequests`, `remoteRequestDecisions`, `fieldVisits`, `fieldVisitDecisions`, `savedLocations`, and `exceptionReviews`. `AttendanceRecord` gains `exceptions`. These are required for the Prisma schema to validate and are not exposed through the API.

`dedupeKey` makes creation idempotent: `event:<eventId>:<TYPE>`, `visit:<visitId>:<TYPE>`, or `day:<dayId>:<TYPE>`. Re-running evaluation never duplicates an exception.

Exception rules and severities:

| Type | Created when | Severity |
|---|---|---|
| `OUTSIDE_OFFICE_GEOFENCE` | Office-day event outside the branch radius and not covered by a visit | LOW |
| `OUTSIDE_DECLARED_ZONE` | Remote-day event outside the current declared radius and not covered by a visit | LOW |
| `EXCESSIVE_DISTANCE` | An accepted relocation is more than 25 km from the previous declaration | MEDIUM |
| `LATE_DECLARATION` | A location event is submitted more than 5 minutes after capture, or an ad-hoc visit is declared | LOW for relocation, MEDIUM for visits |
| `VISIT_OVERRUN` | Visit ends more than 15 minutes after `endsAt` | MEDIUM |
| `VISIT_NOT_CLOSED` | Visit still open at company day end | MEDIUM |
| `LOW_ACCURACY_CHECKOUT` | Check-out accepted with accuracy above 50 m | MEDIUM |
| `UNVERIFIED_CHECKOUT` | Check-out accepted with mock location or a rooted device (HIGH) or clock drift (MEDIUM) | HIGH / MEDIUM |
| `VELOCITY_ANOMALY` | Check-out accepted despite an implausible jump | HIGH |

## 6. Day lifecycle and evaluation rules

### 6.1 Day creation

1. Resolve the company date with `toCompanyDateIso(now)` in `Asia/Riyadh` (new `company-time.util.ts`).
2. Find or create `AttendanceDay` for `(userId, dateIso)`.
3. On creation, choose mode: `REMOTE` if `User.isRemoteAllowed` or an approved remote request covers the date; otherwise `OFFICE`.
4. Attach the covering remote request id when one exists.

### 6.2 Declaration

- On a `REMOTE` day, the employee declares a location before the first check-in: label, coordinates, radius (100–2000 m, default 500), optional saved location.
- The declaration may be changed any number of times before the first check-in.
- After the first check-in, `declare-location` returns 409; changes use `RELOCATION`. A relocation may be submitted at the same coordinates with reason `DECLARED_LOCATION` to correct a declaration without moving; it updates the declaration and leaves any existing check-in exception in place.
- A remote check-in with no declaration uses the punch coordinates as the declaration with `declaredSource = CHECK_IN_LOCATION`. This is accepted without an exception; the admin timeline shows the source.
- A `REMOTE` punch with neither a declaration nor an approved remote basis is rejected with 403, preserving the current "remote not enabled" behaviour.

### 6.3 Event validation

Validation is deliberately asymmetric. Starting work must be trustworthy; ending work must never be blocked.

| Event | Mock / rooted | Accuracy > 50 m | Clock drift | Velocity > 300 km/h | Biometric |
|---|---|---|---|---|---|
| `CHECK_IN` | Block (403) | Block (400) | Block over 5 min | Block (400) | Block (401) |
| `RELOCATION` | Block (403) | Block (400) | Allow up to 4 h old, flag late | Block (400) | Required |
| `FIELD_VISIT_START` / `FIELD_VISIT_END` | Block (403) | Block (400) | Allow up to 4 h old, flag late | Block (400) | Required |
| `CHECK_OUT` | Accept, `UNVERIFIED`, `UNVERIFIED_CHECKOUT` (HIGH) | Accept, `UNVERIFIED`, `LOW_ACCURACY_CHECKOUT` | Accept, `UNVERIFIED`, `UNVERIFIED_CHECKOUT` (MEDIUM) | Accept, `UNVERIFIED`, `VELOCITY_ANOMALY` | Block (401) |

Rationale for the check-out row: blocking a check-out leaves the employee on the clock, inflates paid time, and creates a dispute. A spoofed check-out can only end paid time early. The row is still recorded with `verdict = UNVERIFIED`, `securityFlags`, and an audit entry, and HR sees it.

When several check-out degradation causes apply at once, record a single exception using this precedence: mock/root, velocity, accuracy, drift.

Blocked attempts write an `AuditLog` with `ATTENDANCE_PUNCH_REJECTED` or `ATTENDANCE_EVENT_REJECTED` and the reason, as the current code already does for punches. No `AttendanceRecord` is created.

Velocity is computed against the most recent event of the day, including the previous day's last event when the new event is within 6 hours of it. Speed is distance divided by elapsed time; gaps under one minute are treated as one minute to avoid division blow-ups.

### 6.4 Verdict computation

1. Compute distance to the assigned branch and, on remote days, distance to the declaration.
2. Office day: inside branch radius → `INSIDE_OFFICE`; otherwise → `OUTSIDE_OFFICE`.
3. Remote day: inside declared radius → `INSIDE_DECLARED_ZONE`; otherwise → `OUTSIDE_DECLARED_ZONE`.
4. Check-out accepted despite failed trust checks → `UNVERIFIED`.
5. Create exceptions for `OUTSIDE_OFFICE` / `OUTSIDE_DECLARED_ZONE` unless a visit window covers the event.
6. An accepted `RELOCATION` updates the day declaration to the new point before subsequent events are evaluated, and records the distance from the previous declaration.

### 6.5 Day status and totals

- `ON_LEAVE`: an approved leave covers the date and there are no events.
- `INCOMPLETE`: at least one check-in has no matching check-out, including today before the employee clocks out.
- `FLAGGED`: one or more `OPEN` exceptions.
- `VERIFIED`: at least one complete session and no open exceptions.
- `REJECTED`: reserved, not produced by this phase.

Recompute status, `firstCheckInAt`, `lastCheckOutAt`, `workingMinutes`, and `openExceptionCount` after every event write and after every exception review. Day status takes precedence in the order above.

Working minutes:

- Sum each `CHECK_IN` to its following `CHECK_OUT`, using `capturedAt ?? timestamp`.
- Ignore an unmatched check-in; the day is `INCOMPLETE`.
- Cap a single session at 24 hours as a defensive measure.
- Do not merge sessions across company days. A check-in without a check-out at day end stays `INCOMPLETE`; overnight shifts are out of scope.

### 6.6 Company time

- All dates, day boundaries, and filters use `Asia/Riyadh` (UTC+3, no daylight saving).
- `toCompanyDateIso(date)` returns `YYYY-MM-DD` via `Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Riyadh' })`.
- `companyDayRange(dateIso)` returns the UTC start and end instants for that company date.
- The mobile app displays times in the device's local timezone and labels the company timezone where relevant (for example, "Riyadh HQ"). A remote employee in Pakistan sees 11:00 PKT for a 09:00 Riyadh start.

## 7. Scenarios

### 7.1 Approved remote day with an employee-chosen location

1. The employee requests remote work for one or more dates with a reason.
2. A manager or HR approves. No location is chosen at approval time.
3. On the day, `GET /attendance/today` returns `mode = REMOTE` with the approved request and no declaration.
4. The employee opens the declaration sheet, picks a saved location or the current position, optionally adjusts the radius, and confirms.
5. Check-in is validated against the declared radius, not the office geofence. The event is `INSIDE_DECLARED_ZONE` and no exception is raised.
6. If the employee checks in outside the declared radius (declared home, actually at a café), the punch is accepted, marked `OUTSIDE_DECLARED_ZONE`, and raises a LOW exception. They can re-declare before check-in; after check-in they use "I moved" (a same-point relocation with reason `DECLARED_LOCATION` updates the declaration when they did not actually move).
7. At check-out, the day totals the session, sets `VERIFIED` when no exceptions remain, and appears in the admin day list with the declared location.

### 7.2 Mid-day move because of connectivity

1. The employee is checked in remotely and loses connectivity at the declared location.
2. They move to a second location. When the app has connectivity, they tap "I moved", choose `CONNECTIVITY`, and submit the new coordinates. If the device was offline, the event is captured locally with `capturedAt` and retried later; it is accepted up to 4 hours old and marked `LATE_DECLARATION`.
3. The server writes a `RELOCATION` event, updates the declaration to the new point, and keeps the session running. Working time is unaffected.
4. A move within 25 km is routine. A move beyond 25 km is accepted and raises `EXCESSIVE_DISTANCE` for review.
5. At check-out, the timeline reads: home 09:00–13:10, café 13:25–17:05, with the reason code on each move. The day totals the full session.

### 7.3 On-site employee leaves for a client meeting

1. The employee requests a field visit with client name, destination, and an expected window, ideally a day ahead. The manager approves.
2. They tap "Client meeting" when leaving. The server writes `FIELD_VISIT_START`, sets the visit to `ACTIVE`, and records the event. The office geofence verdict is `OUTSIDE_OFFICE`, but the visit window suppresses `OUTSIDE_OFFICE_GEOFENCE`.
3. On return, "Back at office" writes `FIELD_VISIT_END` and closes the visit. A return later than 15 minutes after `endsAt` raises `VISIT_OVERRUN`.
4. If the employee forgets to request in advance, "Client meeting" creates an ad-hoc visit: approved immediately, `isAdHoc = true`, a `LATE_DECLARATION` exception, and an entry in the manager's queue. It is never blocked.
5. If they leave without declaring anything, the next event (typically check-out outside the geofence) is accepted, marked `OUTSIDE_OFFICE`, and raises `OUTSIDE_OFFICE_GEOFENCE`. The day summary then shows office and field segments with a review item.

### 7.4 Mixed day and return to office

A day can contain any sequence: office check-in, field visit, return, relocation on a remote day, and multiple sessions. The timeline is the source of truth. The day mode never changes mid-day; only the events and exceptions do.

### 7.5 Edge cases

- **Spoofed check-in:** mock location or rooted device → 403, audit entry, actionable message. No row is written.
- **Bad GPS at check-out:** accepted as `UNVERIFIED` with a MEDIUM exception. The employee is not trapped.
- **No declaration on a remote day:** the check-in point becomes the declaration, source `CHECK_IN_LOCATION`.
- **Approval after check-in:** the existing day keeps its mode; the approval applies to future dates.
- **Multiple sessions:** each check-in/check-out pair adds to working minutes; gaps are unpaid and are not breaks.
- **Client visit overruns midnight:** not allowed; the request window must end on the same company day.
- **Duplicate retry:** the same `clientEventId` returns the existing event instead of creating a second one.

## 8. API

All routes are under `/api` and require a bearer token. `CurrentUser` supplies identity; no endpoint trusts a user id from the body.

### 8.1 Employee

| Method | Route | Purpose |
|---|---|---|
| GET | `/attendance/today` | Day plan, declaration, events, active visit, open exceptions, totals |
| POST | `/attendance/punch` | Check-in or check-out (extended DTO) |
| POST | `/attendance/today/declare-location` | Set or change the remote declaration before check-in |
| POST | `/attendance/location-events` | `RELOCATION` events; visit start and end are written by the visit endpoints |
| GET | `/attendance/my-history?limit=` | Events for recent days, newest first |
| GET | `/attendance/days/:id` | Own day detail |
| POST | `/attendance/remote-requests` | Create a remote request |
| GET | `/attendance/remote-requests/mine` | Own requests |
| POST | `/attendance/remote-requests/:id/cancel` | Cancel an eligible request |
| POST | `/attendance/field-visits` | Request a field visit |
| POST | `/attendance/field-visits/ad-hoc` | Declare a visit now |
| GET | `/attendance/field-visits/mine?date=` | Own visits |
| POST | `/attendance/field-visits/:id/start` | Start a visit and write the start event |
| POST | `/attendance/field-visits/:id/end` | End a visit and write the end event |
| POST | `/attendance/field-visits/:id/cancel` | Cancel before start |
| GET, POST | `/attendance/saved-locations` | List or create saved locations (max 10) |
| PATCH, DELETE | `/attendance/saved-locations/:id` | Update or delete a saved location |

### 8.2 Manager and HR

| Method | Route | Access | Purpose |
|---|---|---|---|
| GET | `/attendance/remote-requests/pending` | MANAGER (direct reports), HR, SUPER | Approval queue |
| POST | `/attendance/remote-requests/:id/decision` | MANAGER (direct reports), HR, SUPER | Approve or reject |
| GET | `/attendance/field-visits/pending` | MANAGER (direct reports), HR, SUPER | Visit approvals |
| POST | `/attendance/field-visits/:id/decision` | MANAGER (direct reports), HR, SUPER | Approve or reject |
| GET | `/attendance/days?from=&to=&userId=&departmentId=&status=&mode=&page=&pageSize=` | MANAGER (direct reports), HR, SUPER | Day list |
| GET | `/attendance/exceptions?status=&from=&to=` | MANAGER (direct reports), HR, SUPER | Exception queue; managers are read-only |
| POST | `/attendance/exceptions/:id/review` | HR, SUPER | Accept or escalate with a note |
| GET | `/attendance/team?date=` | MANAGER, HR, SUPER | Extended with mode, declaration label, open exceptions, last event |
| GET | `/attendance/all?limit=` | HR, SUPER | Existing record list, unchanged shape plus new fields |

`GET /attendance/days/:id` is available to the owner, the owner's manager, and HR/SUPER.

### 8.3 DTO rules

- Coordinates: latitude -90..90, longitude -180..180.
- `accuracyMeters`: 0..5000.
- Declaration radius: 100..2000, default 500.
- Label: 1..120 characters; reason and notes: 0..500.
- `clientEventId`: UUID v4, required on event writes.
- `capturedAt`: ISO 8601, not more than 1 minute in the future.
- Every write, punch or location event, carries `latitude`, `longitude`, `accuracyMeters`, `isMockLocation`, `isDeviceRooted`, `biometricVerified`, and `clientEventId`. Location events also carry `capturedAt` and `reasonCode`.
- Decisions use `APPROVED` or `REJECTED`; exception reviews use `ACCEPTED` or `ESCALATED` with a note of 0..500 characters.
- Remote range: `startDateIso <= endDateIso`, at most 30 days, `startDateIso` not in the past.
- Visit window: same company day, 15 minutes to 4 hours, `endsAt > startsAt`.
- Session preconditions: declarations require no check-in yet; relocations, visit starts, visit ends, and ad-hoc visits require an open session. Visit requests and remote requests may be created before the day starts.
- List endpoints accept `page` (default 1) and `pageSize` (1..100, default 25).
- Unknown fields are rejected by the existing global `ValidationPipe` (`forbidNonWhitelisted: true`).

### 8.4 Error semantics

- `400`: invalid payload, coordinates, accuracy, drift beyond the allowed window for the event type, velocity anomaly.
- `401`: biometric not verified, missing or invalid token.
- `403`: mock location, rooted device, remote not approved for the day, wrong role, deciding one's own request, branch mismatch.
- `404`: day, request, visit, exception, or saved location not found or not visible to the caller.
- `409`: declaration after check-in, overlapping request or visit, second active visit, cancelling an ineligible request.

Idempotency: if `clientEventId` already exists for the user, return the existing event with HTTP 200 and `idempotentReplay: true` instead of creating another row.

## 9. Mobile experience

### 9.1 Clock In states

The screen derives one state from `GET /attendance/today`:

1. **Office, no approval:** current position, distance to the assigned branch, geofence status, check-in enabled inside the radius. Outside, the message explains the distance and offers the field-visit and remote-request actions where eligible.
2. **Remote approved, undeclared:** remote-day banner, request details, and a prominent "Declare work location" action prefilled with the default saved location or the current position. Check-in remains enabled; without a confirmed declaration the check-in point becomes the declaration.
3. **Remote declared, not checked in:** location card with label, radius, and a change action; check-in enabled.
4. **Active day:** timeline of check-in, relocations, field visits, and check-out; actions "I moved", "Client meeting" / "Back at office".
5. **Checked out:** session summary with total working time, field time, and a count of items pending HR review.

### 9.2 New sheets

- **Location picker:** map, current position, saved locations, label field, radius control (100–2000, default 500), confirm.
- **Relocation:** new position, reason chips (`CONNECTIVITY`, `POWER`, `SAFETY`, `OTHER`), note, submit.
- **Field visit:** client name, destination picker, start and expected end, note; a separate "now" path for ad-hoc.
- **Remote request:** date range, reason, submit; state list of own requests.

Managers also need a decision surface. The existing approvals list gains two item types, Remote work and Field visit, with approve and reject actions. HR uses the same actions in the web admin. Exception review stays HR-only; managers can see flags for their direct reports but cannot accept them.

### 9.3 Messaging

Use the existing error-screen patterns and actionable wording. Examples:

- Mock location: "Turn off mock location to check in."
- Rooted device: "This device could not be verified. Check in from a supported device."
- Accuracy: "GPS signal is too weak. Move to an open area and try again."
- Clock drift: "Enable automatic date and time, then try again."
- Outside geofence on an office day: distance and radius, plus "Request a field visit" and "Request remote work".

### 9.4 Offline behaviour

- Punches still require connectivity; offline sync stays disabled.
- Location events that fail to submit are kept as a local draft with their original capture time and a visible "Retry" action. Nothing is silently synchronized.
- On retry after reconnect, the server accepts the event up to 4 hours old and flags `LATE_DECLARATION`.

### 9.5 Language and theme

Every new surface ships in English and Arabic with RTL layout, and in light and dark themes using existing tokens. The map, timeline, and reason chips must be checked in all four combinations.

## 10. Admin experience

The Attendance area gains four views:

- **Days:** filterable list by date, employee, department, mode, and status, showing declared location, totals, and open exception count.
- **Day detail:** employee summary, mode, approval, declaration, a Leaflet map with numbered pins (OpenStreetMap tiles, no API key) and a plain coordinate list as fallback, timeline with verdict chips, totals, and exceptions with Accept or Escalate plus a note.
- **Approvals:** pending remote requests and field visits, with approve or reject and a reason.
- **Exceptions:** open, accepted, and escalated items with filters and review actions.

Reuse the existing table, filter, and drawer patterns. The web admin remains HR and Super Admin only (`canAccessWebAdmin`); managers handle remote and visit approvals in the mobile app. Every decision writes an audit entry (`REMOTE_REQUEST_DECIDED`, `FIELD_VISIT_DECIDED`, `ATTENDANCE_EXCEPTION_REVIEWED`). No export in this phase.

## 11. Configuration

Company-wide environment values, read through `configuration.ts`; per-branch overrides are future work.

| Key | Default | Meaning |
|---|---|---|
| `ATTENDANCE_DAY_TIMEZONE` | `Asia/Riyadh` | Company workday timezone |
| `MAX_ALLOWED_GPS_ACCURACY_METERS` | `50` | Existing GPS accuracy ceiling |
| `MAX_ALLOWED_NTP_DRIFT_MINUTES` | `5` | Existing punch clock drift ceiling |
| `DEFAULT_GEOFENCE_RADIUS_METERS` | `150` | Existing office radius default; branch rows override |
| `ATTENDANCE_REMOTE_RADIUS_DEFAULT` | `500` | Initial declaration radius |
| `ATTENDANCE_REMOTE_RADIUS_MAX` | `2000` | Maximum declaration radius |
| `ATTENDANCE_RELOCATION_FLAG_KM` | `25` | Distance that raises `EXCESSIVE_DISTANCE` |
| `ATTENDANCE_VELOCITY_MAX_KMH` | `300` | Impossible travel threshold |
| `ATTENDANCE_LATE_EVENT_MINUTES` | `240` | Maximum age for late location events |
| `ATTENDANCE_VISIT_MAX_MINUTES` | `240` | Maximum field visit window |
| `ATTENDANCE_VISIT_GRACE_MINUTES` | `15` | Suppression and overrun grace |
| `ATTENDANCE_REMOTE_REQUEST_MAX_DAYS` | `30` | Maximum remote request range |

Existing branch fields (`geofenceRadiusMeters`) continue to define the office radius. Existing security keys keep their current names; only the new `ATTENDANCE_*` keys are added to `AppConfig`. The admin adds `leaflet` and `react-leaflet` for the day map; OpenStreetMap tiles are acceptable for internal volume, and a commercial tile provider is required before public scale. If tiles are unavailable, the coordinate list and Open in Maps links still render.

## 12. Trust boundary

Enforced and blocking:

- Mock location at check-in and location events.
- Rooted or jailbroken device at check-in and location events.
- Accuracy above 50 m at check-in and location events.
- Device clock drift beyond 5 minutes at check-in; beyond 4 hours for location events.
- Implausible velocity at check-in and location events.
- Biometric flag false at all writes.
- Remote check-in without a standing arrangement or an approved request.

Accepted and recorded:

- Location mismatch on office and remote days.
- Relocations, including long ones.
- Field visits, including ad-hoc ones.
- Check-out with degraded telemetry.

Known limitation: all telemetry is client-asserted. A compromised client can lie about mock and root flags. The server-side plausibility checks (velocity, accuracy, branch and declaration distances, audit trail) reduce casual abuse but do not eliminate it. Device attestation is the real fix and is scheduled for Phase 11. The spec and the UI copy must not claim that attendance is cryptographically verified.

## 13. Privacy

- Location is captured only when the employee taps check-in, check-out, "I moved", "Client meeting", or "Back at office". There is no background or continuous tracking.
- HR and managers see event points and labels, not a continuous trail.
- Employees can see their own full timeline and declarations.
- Declared locations are stored with the attendance record for audit. Retention follows the company's attendance retention policy; no new retention period is introduced here.
- Ad-hoc visits notify the manager through the in-app queue, not by push.

## 14. Migration and compatibility

### 14.1 Schema migration

- One additive Prisma migration: new enums, new tables, new nullable columns, new indexes, and the unique `clientEventId` constraint.
- No renames, no drops, no data rewrites. Existing `AttendanceRecord` rows remain valid with null `dayId` until backfilled.

### 14.2 Backfill

`backend/prisma/scripts/backfill-attendance-days.ts`, idempotent:

1. Group existing records by `(userId, dateIso)` using the stored `dateIso` when present; when null, derive it from `timestamp` in UTC, matching the old behaviour so history does not shift.
2. Create one `AttendanceDay` per group with the mode implied by the records' `workMode` (any `REMOTE` record makes the day `REMOTE`).
3. Link records through `dayId`.
4. Compute `firstCheckInAt`, `lastCheckOutAt`, `workingMinutes`, and status (`INCOMPLETE` without a check-out, otherwise `VERIFIED`). Old rows have no exceptions.
5. Log the number of days created, records linked, and any record with a null `dateIso`.
6. Safe to re-run: existing days are reused, and only null `dayId` rows are linked.

Historical days keep their original date grouping; the Riyadh boundary applies to new activity only.

### 14.3 Seed

- Bilal (EMP-005, standing remote) gets an approved remote request covering the current week and a declared default saved location.
- Rahaf (EMP-004) gets a pending remote request for tomorrow, so the approval queue is not empty.
- One office employee gets a completed field visit from yesterday and one overdue open visit, so the exception queue and day timeline have sample data.

### 14.4 Compatibility

- `POST /attendance/punch` keeps its request shape; new fields are optional. Existing clients continue to work, but a remote punch now also requires a standing remote arrangement or an approved request, and writes a day.
- `GET /attendance/my-history` keeps existing fields and adds new ones; current mobile mappers ignore unknown keys.
- `workMode` remains on each record and is set from the day mode for consistency.
- `User.isRemoteAllowed` is retained as the standing remote arrangement.
- The offline punch endpoint stays disabled.

## 15. Implementation increments

Each increment ends with `npm run verify:all` green and its own commit. No gate is written until the whole phase passes the device checklist.

### Increment 1 — Day and event foundation

- Schema, migration, backfill, seed.
- `company-time.util.ts` and day resolution.
- `ensureDay`, event evaluation, verdicts, day aggregation, exception creation.
- Rewritten punch flow and `GET /attendance/today`.
- Backend unit tests for verdicts, aggregation, timezone, blocking, and check-out fallback.
- Mobile mapping of the new payload behind the existing screen (no new UI yet).

### Increment 2 — Remote day and relocation

- Remote request endpoints and decisions.
- Declaration endpoint, saved locations, relocation events.
- Mobile: states 2–4, location picker, relocation sheet, remote request sheet.
- Exception queue read path and admin approvals for remote requests.
- Backend and mobile logic tests for the remote and relocation flows.

### Increment 3 — Field visits, review, and admin

- Field visit endpoints, ad-hoc path, lifecycle reconciliation.
- Exception review endpoints and audit entries.
- Admin days list, day detail with map and timeline, visit approvals, exception queue.
- Mobile "Client meeting" / "Back at office" actions and check-out summary.
- Isolated-database API tests covering all three scenarios.
- Admin unit tests for new pure logic and the first admin test setup (Vitest).
- Manual device checklist for G3.

## 16. Testing

### 16.1 Backend unit

- Office inside, outside, and exactly on the radius boundary.
- Remote inside, outside, and exactly on the declared boundary.
- Remote check-in with no declaration uses the check-in point.
- Remote check-in without approval is rejected.
- Mock, root, accuracy, drift, and velocity block check-in and location events.
- Check-out with each degraded signal is accepted as `UNVERIFIED` with the right exception.
- Relocation updates the declaration; 25 km boundary; late submission flag.
- Visit suppression, overrun, not closed, ad-hoc, overlapping windows, second active visit.
- Day aggregation: multiple sessions, incomplete day, leave day, exception count, status precedence.
- Company date at 23:30 UTC and 00:30 UTC (Riyadh rollover).
- Authorization: self vs manager vs HR, direct-report scoping, no self-decision, HR-only exception review.

### 16.2 API with an isolated database

This also reduces the M1.3 debt.

- Remote request → approval → declaration → check-in → relocation → check-out.
- Office check-in → field visit → return → check-out.
- Ad-hoc visit and manager queue.
- Exception review and audit entry.
- Idempotent retry with the same `clientEventId`.
- Role matrix for every new route.

### 16.3 Mobile logic

- State machine for the five Clock In states.
- Eligibility messages for each blocking reason.
- Late event draft and retry formatting.
- Working-time display.

### 16.4 Admin

- Day filtering and status derivation helpers.
- Approval and exception review reducers and API calls.
- Vitest plus React Testing Library introduced for these tests.

### 16.5 Manual device checklist (G3)

1. Request a remote day, approve it as a manager, declare home, check in outside the 150 m HQ radius, and confirm no geofence error.
2. Move to a second location with reason `CONNECTIVITY`, check out, and confirm one continuous session with two location points and the declaration updated.
3. In airplane mode, capture a relocation, reconnect, retry, and confirm `LATE_DECLARATION`.
4. Request a field visit, approve it, leave the office geofence, return, and confirm no office exception while the visit is active.
5. Create an ad-hoc visit at a client and confirm the manager queue entry and `LATE_DECLARATION`.
6. Enable a mock-location app and confirm check-in is blocked with actionable copy and an audit entry.
7. Check out with poor GPS and confirm the check-out is recorded as `UNVERIFIED`, not blocked.
8. Verify English and Arabic RTL and light and dark themes on Clock In, the declaration sheet, the timeline, and the admin day detail.
9. Spot-check working minutes against the timeline.
10. Confirm the manager sees only direct reports and HR sees all.

### 16.6 Acceptance criteria

- An approved remote employee can start and finish a day more than 150 m from the assigned branch without a geofence rejection.
- A day with two locations produces one session, one relocation event, one updated declaration, and the correct total.
- An on-site employee can leave for a client meeting without the geofence blocking check-out or polluting the day with false breaches.
- A spoofed or rooted device cannot check in.
- A check-out is never blocked by location telemetry.
- Every accepted anomaly is visible to HR as a reviewable exception with an audit trail.
- Company-date grouping is correct in Riyadh.

## 17. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Telemetry is client-asserted | A compromised client can bypass flags | Server plausibility checks, audit trail, explicit limitation, attestation in Phase 11 |
| No continuous tracking | Undeclared departures are detected only at the next event | Documented scope; next-touch detection; HR review queue |
| Remote approvals reuse the single-stage pipeline | No HR second stage | Accepted for Phase 8; two-stage approvals stay in Phase 9 |
| Schema touches the central attendance table | Migration risk | Additive only; backfill script; isolated-DB tests; seed coverage |
| Working minutes become payroll input later | Wrong totals if rules drift | Rules fixed in this spec; payroll remains out of scope until Phase 11 |
| Admin has no test setup | Fragile new views | Add Vitest with the new views in increment 3 |
| Approval fatigue for standing remote staff | Employees skip requests | `isRemoteAllowed` keeps the standing arrangement; saved locations make declarations one tap |
| Late events after connectivity loss | Timeline gaps | 4-hour late window for location events, visible late flag, no silent sync |

## 18. Resolved policy decisions

These are settled for the implementation; changes require a spec revision.

1. Approval covers the remote dates and mode, not a fixed address. The employee declares the location after approval.
2. A relocation is always accepted and updates the declaration; moves beyond 25 km are flagged, not blocked.
3. Field visits suppress geofence exceptions inside their window; ad-hoc visits are allowed and flagged.
4. Spoofing, root, accuracy, drift, and velocity block check-in and location events.
5. Check-out is never blocked by location telemetry; it is recorded as `UNVERIFIED` with an exception.
6. Standing remote employees keep `isRemoteAllowed`; office staff use per-day requests.
7. Remote approvals are single-stage; a manager or HR decides.
8. The company workday is Asia/Riyadh for all employees.
9. Location is action-based only; no background tracking.
10. Offline punch sync remains disabled; only late location events are accepted.
11. Exception review is HR-only; managers see flags for direct reports but cannot accept them.
12. Managers approve remote requests and field visits in the mobile app; the web admin is HR and Super Admin only.

## 19. Dependencies

- Phase 7 should land rate limiting and self-service employee endpoints first; attendance routes inherit the throttling.
- Phase 8 must finish the local-day boundary work in this spec before totals feed any payroll work in Phase 11.
- The existing SHA-bound gate workflow applies: `verify:all` green, device checklist executed, `docs/qa/gates/` record with the exact commit, then push.
- M1.3 debt: the isolated-database API tests in increment 3 are the first step toward closing it; admin tests start with the new views.
