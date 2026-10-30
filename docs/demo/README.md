# MacqHR Demo Video — PRD & Storyboard

Status: v1 delivered (`macqhr-demo.mp4`, 2026-10-31)
Owner: Engineering (Macquires)
Audience: Macquires management / stakeholders

## 1. Background

MacqHR is the Macquires people platform (attendance, leave, payroll, people) with a native iOS app. Management has not yet seen the product running on a device. We need a short, self-explanatory walkthrough that proves the core employee self-service loop works end to end against the real backend — not a mock.

## 2. Objective

Produce a 30–45 s native iOS walkthrough that a manager can watch without narration and understand in one pass:

1. An employee signs in with their work account.
2. They land on a dashboard with balances, actions and events.
3. They clock in remotely with GPS verification.
4. They request leave in a few taps.

Success = the viewer can name those four capabilities after one viewing, and the footage is visibly a real app, not a prototype.

## 3. Audience & constraints

| Item | Decision |
|---|---|
| Audience | Macquires management, non-technical, presentation context |
| Length | 30–45 s (delivered: 34.97 s) |
| Format | 1920×1080, 30 fps, H.264, MP4 (faststart), video only |
| Narration | None — on-screen captions carry the story |
| Tone | Calm, product-led, brand-consistent (dark navy, orange accent) |
| Device | iPhone 17 Pro simulator (iOS 27.2), portrait phone inside a bezel |
| Data | Real seeded demo account and real API submissions |

## 4. Scope

In scope:

- Live app capture on the iOS simulator against the local NestJS backend.
- Four product beats + intro/outro cards with captions.
- Device bezel treatment, status-bar normalization (9:41, full battery, Wi-Fi).
- Real leave submission and real attendance punch in the same session.

Out of scope (v1):

- Voice-over, music, animated logo, motion graphics beyond fades/cuts.
- Manager/HR approval flow, admin panel, web console, payroll detail.
- Localization (Arabic UI) or dark-mode UI footage.
- Vertical/social cuts, subtitles burned as separate files, chapter markers.

## 5. Storyboard

Beat boundaries are the delivered edit; each phone shot is a continuous overlay, with hard cuts on the caption cards.

| # | Time | Caption card | On screen | Purpose |
|---|---|---|---|---|
| 00 | 0.0–3.0 | Intro: “One app. Every working day.” | Title card | Set context, brand |
| 01 | 3.0–10.2 | “01 / SIGN IN — Sign in. Start your day.” | Login screen → email typed → Sign In | Prove real auth, work-account entry point |
| 02 | 10.2–16.6 | “02 / OVERVIEW — Everything, at a glance.” | Dashboard loads, “Welcome Bilal”, balances, actions, birthdays/events, scroll | Show the daily home surface |
| 03 | 16.6–21.3 | “03 / ATTENDANCE — Clock in from anywhere.” | Geo-Attendance screen, “Remote Work Verified”, Gulberg map + geofence, tap Clock-in, “since clock-in” | Show remote punch with verification |
| 04 | 21.3–31.0 | “04 / TIME OFF — Leave requests in seconds.” | Request Time Off modal, calendar range Oct 16–18, “Apply (3.00 days)”, submit, return | Show self-service leave in one flow |
| 05 | 31.0–35.0 | Outro: “Built for Macquires. Ready for your team.” | End card | Close with positioning |

Supporting copy (left column, all beats): kicker “PRODUCT WALKTHROUGH”, one-line value sentence per beat, footer “MACQHR · EMPLOYEE SELF-SERVICE”.

Beat captions:

- 01: “Secure access with your work account — Microsoft 365 SSO built in.”
- 02: “Leave balances, daily actions and team availability — one clean dashboard.”
- 03: “Verified remote punches from Pakistan, geofenced check-in at Riyadh HQ.”
- 04: “Pick dates, submit, and your manager approves — all inside the app.”

## 6. Functional requirements (what the footage must demonstrate)

| ID | Requirement | Acceptance |
|---|---|---|
| F1 | Sign in with a real seeded account | Email replaced and submitted; dashboard appears with the user’s name |
| F2 | Dashboard shows personalized data | Balances (27/30 annual, 10/10), actions, colleagues, events render |
| F3 | Remote clock-in is geo-verified | “Remote Work Verified” + location “Gurumangat Road, Gulberg”, “Accurate” status, successful punch |
| F4 | Leave request is submitted | Calendar shows Oct 16–18, 3.00 days; Apply submits; backend returns success |
| F5 | Real backend, no mock | Attendance `CHECK_IN` record and `PENDING` leave request exist for the demo user after recording |

## 7. Design requirements

- **Brand**: oxford `#001629`, prussian `#002C52`, indigo `#293F66`, orange `#FE5800`; SF Pro; white captions on navy.
- **Phone treatment**: 470×950 device frame, screen inset 405×880 with 40 px rounded mask; soft edge/shadow; no notch covering of app content beyond the real status bar.
- **Status bar**: override to 9:41, full battery, Wi-Fi 3 bars, cellular 4 bars; light appearance.
- **Typography**: caption cards at 130 px/0.98 line-height, headline white + orange second line, 30 px body.
- **Motion**: 0.4 s fade in, 0.7 s fade out, hard cuts between beats, no transitions that obscure state changes.

## 8. Demo scenario (data)

- User: `bilal.rehman@macqhr.sa` (EMPLOYEE, remote allowed), password `Password123!` — demo-only credentials.
- Location: Gulberg, Lahore (31.5204, 74.3587), simulator location mocked and granted.
- Leave: Annual Vacation, 2026-10-16 → 2026-10-18 (3.00 days), submitted and left `PENDING`.
- Attendance: one `CHECK_IN` punch during recording; state reset to a clean “ready to clock in” before the take.

## 9. Non-functional acceptance criteria

- [x] Duration between 30 and 45 s (34.97 s).
- [x] 1920×1080, 30 fps, `yuv420p`, H.264, `+faststart`.
- [x] No audio track.
- [x] Every caption readable at 1080p, no clipped text in the phone screen.
- [x] Screen seated in bezel with rounded corners and no color leaks at the corners.
- [x] Caption switch within ~0.5 s of the visual beat it describes.
- [x] Fade in/out; starts and ends near black.
- [x] Under 5 MB (2.0 MB).

## 10. Capture & edit pipeline

1. **Environment**: Xcode 27.2 simulator `macqhr-demo` (UDID `0944E036-A269-4979-9950-BD58B74B72D5`, iOS 27.2); backend on `http://localhost:4000/api`; Release build `com.macquires.macqhr`. All Xcode tools need `DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer`.
2. **State prep**: `simctl erase` (or `simctl keychain reset` — the SecureStore session survives `clearState`), reinstall, set status bar, light appearance, location, grant location privacy. Reset attendance/leave for the demo user.
3. **Rehearsal**: Maestro flows under `/tmp/macqhr-video/flows/` — `demo.yaml` (full run) and `punchleave.yaml` (clean punch + leave take). Zero-distance micro-swipes act as holds; range must be built end-day-first (tap 18, then 16) because the picker ignores later-day taps.
4. **Capture**: `simctl io recordVideo --codec h264 --force`, run flow, stop with SIGINT. Capture is VFR (~11 fps); segment cuts use `-ss`/`-t` and durations can drift, absorbed as extra static hold.
5. **Edit**: `build.sh` trims phone segments, scales to 405×880, concatenates, then composites over caption cards with the bezel and the rounded mask, adds fades, encodes 1080p30. Segment map: raw 24.0–26.15, 26.15–33.2 @1.4×, 33.2–35.8, 35.8–39.45; punch/leave 21.5–25.9, 29.7–33.2, 36.3–38.4, 39.75–42.31.
6. **Verify**: frame extraction at beat boundaries and corners; check caption/beat alignment, mask, fades, streams.

The capture scripts live in `/tmp/macqhr-video/` (not versioned). Re-recording requires that directory or rebuilding the flows/assets from this document.

## 11. Known constraints

- The in-app time card shows the real recording time (01:20 AM) while the status bar is fixed at 9:41 — visible only in the attendance beat. Re-record at a daytime hour if this matters.
- iOS 27 requires the scene manifest (`EXExpoAppSceneDelegate`) in `Info.plist`; without it the app shows a blank screen.
- Maestro cannot see the simulator unless `DEVELOPER_DIR` is exported.

## 12. Future variants

- 9:16 cut for mobile/Teams, 60 s extended cut with manager approval beat, Arabic captions, voice-over version, and a web-admin companion clip.
