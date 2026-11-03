# Phase 8 — Manual Approval Record (G3)

- **Approver**: Talha
- **Date/time**: 2026-11-04T03:07:00+05:00
- **Phase**: 8 (G3 — Attendance Integrity, Location & Breaks)
- **Commit**: e894bcee09d137ee18b565b65b901271534682b7
- **Build**: Local staging / main branch (`e894bce`)
- **Environment**: staging
- **Device**: iOS Simulator + Physical Device / Chrome & Safari Web Admin
- **Automated evidence**: `npm run verify:all` — mobile 49/49 passed; backend 117/117 unit tests (14 suites) + 47/47 isolated-DB E2E tests (6 suites) + clean `nest build`; web-admin 15/15 tests (4 suites) + production build succeeded
- **Manual checklist**: [test plan](../prd/test-plan.md) — G3 / Phase 8 checklist (ATT-01–ATT-15, UI-01–UI-03)
- **Open defects**: none
- **Decision**: APPROVED
- **Conditions / notes**: Approved by Talha on 2026-11-04. Phase 8 (M4 Attendance Integrity, Day Containers, Location & Breaks) is approved alongside Web Admin Attendance overhaul (Live Radar, Exceptions Review, Remote Requests) and Mobile App Break toggles & timers.

## Executed checklist

| Test ID | Result | Evidence |
|---|---|---|
| ATT-01 | PASS | Office employee inside branch geofence with valid evidence → check in accepted, marked OFFICE, day status IN_PROGRESS |
| ATT-02 | PASS | Office employee outside geofence → check in rejected with distance and radius (400) |
| ATT-03 | PASS | Remote-eligible employee (standing isRemoteAllowed) outside branch → remote check in accepted, marked REMOTE |
| ATT-04 | PASS | Remote-ineligible employee without approved request → remote check in rejected (403 Forbidden) |
| ATT-05 | PASS | Device reports mock/fake GPS provider → punch rejected with Layer 1 violation (400) |
| ATT-06 | PASS | GPS accuracy >50m rejected; 26–50m flagged; ≤25m accepted |
| ATT-07 | PASS | Device clock drifts >5 minutes from server NTP → punch rejected with Layer 3 violation (400) |
| ATT-08 | PASS | Rooted/jailbroken device → punch rejected with Layer 4 violation (403) |
| ATT-09 | PASS | Biometric verification absent/failed → punch rejected with Layer 6 violation (401) |
| ATT-10 | PASS | Already checked in → duplicate check-in rejected with 400; orphan check-out rejected |
| ATT-11 | PASS | Punch across Asia/Riyadh and Asia/Karachi on same UTC day lands on correct local day container |
| ATT-12 | PASS | Offline punch queue signs with HMAC and rejects tampered coordinates |
| ATT-13 | PASS | Employee starts and ends break within shift; break minutes persist and net working minutes exclude break |
| ATT-14 | PASS | Non-blocking check-out outside geofence accepted and logs OUTSIDE_OFFICE_GEOFENCE AttendanceException |
| ATT-15 | PASS | RemoteWorkRequest submitted by employee and approved by manager elevates workday mode to REMOTE and permits remote punch |
| UI-01 | PASS | Web Admin Console: Live Radar, Exceptions Review, and Remote Requests tabs render cleanly |
| UI-02 | PASS | Bilingual RTL (`dir="rtl"`) layout parity verified across Arabic and English for attendance exceptions and request modals |
| UI-03 | PASS | Light (`#F8FAFC`) and Dark (`#0B1524`) theme contrast verified on attendance radar and exception review dialogs |

## Sign-off

I confirm that the commit above matches the build I tested, that every P0 case for this phase passed, and that any P1 failure is listed below with my written acceptance.

- Signature: Talha
- Date: 2026-11-04

## Post-gate change rule

Any new commit invalidates this record. Re-run the affected checklist and create a new gate for the new SHA.
