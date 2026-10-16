# MacqHR Sprint Task Board & Delivery Tracker

> **Project**: MacqHR (ZenHR Enterprise Clone & Enhancement for Macquires)  
> **Status**: Active Development  
> **Last Updated**: 2026-10-17  
> **Legend**:  
> - `[x]` Completed  
> - `[/]` In Progress / Active  
> - `[ ]` Pending / Backlog  

---

## Sprint 1: Security Rules, Foundations & Project Audit (Week 1)

- [x] **Task 1.1: Codebase Audit & Gap Analysis**
  - [x] Review current screens (`DashboardScreen`, `ClockInScreen`, `ApprovalsScreen`, `AttendanceScreen`, `RequestTimeOffModal`, `SubModuleModal`).
  - [x] Assess mock data structures in `mockData.ts` and identify ZenHR parity gaps.
- [x] **Task 1.2: Architecture & Development Rules Definition**
  - [x] Establish official project rules file ([`RULES.md`](RULES.md)).
  - [x] Document brand design system (Macquires color palette, RTL bilingual guidelines).
  - [x] Define multi-tier anti-spoofing security protocol.
  - [x] Define Microsoft 365 / Teams integration specs.
- [x] **Task 1.3: Sprints & Task Tracking Setup**
  - [x] Create project task tracking board ([`SPRINT_PLAN.md`](SPRINT_PLAN.md)).

---

## Sprint 2: Live Location, Google Maps & Anti-Spoofing Attendance (Week 2)

### Development
- [ ] **Task 2.1: Location Service Setup**
  - [ ] Install and configure `expo-location` and permissions workflow (Foreground & Background).
  - [ ] Configure Android `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`, and iOS `NSLocationWhenInUseUsageDescription` in `app.json`.
- [ ] **Task 2.2: Anti-Spoofing & Mock Location Detection Engine**
  - [ ] Implement `useLocationSecurity` hook to inspect hardware mock location flags (`isMock` / `isFromMockProvider`).
  - [ ] Implement GPS accuracy filter (flag/reject if accuracy radius $> 25\text{ m}$).
  - [ ] Implement mock app detection & root/jailbreak environment check.
  - [ ] Implement Office Wi-Fi BSSID / SSID cross-check helper.
- [ ] **Task 2.3: Live Interactive Google Maps Clock-In Screen**
  - [ ] Upgrade `ClockInScreen.tsx` from static SVG to dynamic interactive map.
  - [ ] Render office geofence polygon/circle and live user location pin with accuracy overlay.
  - [ ] Add visual anti-spoofing status indicator (Verified Genuine GPS vs. Warning/Mock Detected).
  - [ ] Integrate server-synchronized NTP timestamp logic.

### Testing & QA
- [ ] **Task 2.4: Geofence & Anti-Spoofing Testing**
  - [ ] Test on Android device with "Select mock location app" enabled in Developer Options (Verify rejection).
  - [ ] Test boundary edge cases: Inside geofence vs. outside geofence.
  - [ ] Verify RTL Arabic rendering on Google Maps controls and badges.

---

## Sprint 3: Microsoft 365, Teams & Entra ID Integration (Week 3)

### Development
- [ ] **Task 3.1: Microsoft Entra ID (Azure AD) SSO**
  - [ ] Configure Microsoft App Registration (Client ID, Tenant ID, Redirect URIs).
  - [ ] Implement OAuth 2.0 PKCE login using `expo-auth-session` / MSAL.
  - [ ] Secure token storage using `expo-secure-store`.
- [ ] **Task 3.2: Microsoft Teams Communications & Presence**
  - [ ] Integrate Microsoft Graph API client (`@microsoft/microsoft-graph-client`).
  - [ ] Automatically update Teams user presence status when user clocks in, starts break, or clocks out.
  - [ ] Design and trigger Teams Adaptive Cards for manager approval notifications.
- [ ] **Task 3.3: Outlook Calendar Synchronization**
  - [ ] Implement leave approval webhook pushing approved vacation dates to Outlook Calendar (`/me/events`).
- [ ] **Task 3.4: Microsoft Directory Profile Sync**
  - [ ] Fetch organization hierarchy, manager reporting line, and employee profile photo from Microsoft Graph.

### Testing & QA
- [ ] **Task 3.5: Microsoft Authentication & Sync Testing**
  - [ ] Test SSO login with `@macquires.com` work credentials.
  - [ ] Verify automatic session refresh with refresh tokens.
  - [ ] Validate Teams presence updates upon clock-in and clock-out.

---

## Sprint 4: Backend API, PostGIS & Database Layer (Week 4 - 5)

### Development
- [ ] **Task 4.1: Backend Service Initialization (NestJS / PostgreSQL)**
  - [ ] Scaffold NestJS REST API with Prisma ORM and TypeScript.
  - [ ] Enable PostGIS extension for geospatial calculations.
- [ ] **Task 4.2: Relational Schema & Migration**
  - [ ] Create schemas: `User`, `OfficeBranch`, `GeofenceZone`, `AttendanceLog`, `LeaveRequest`, `LeaveBalance`, `ApprovalRecord`, `Payslip`.
- [ ] **Task 4.3: Attendance & Anti-Spoofing Endpoints**
  - [ ] `POST /api/v1/attendance/clock-in`: Validates signature, mock flags, PostGIS `ST_DWithin` geofence distance, and NTP server time.
  - [ ] `POST /api/v1/attendance/break-toggle`.
  - [ ] `POST /api/v1/attendance/clock-out`.
  - [ ] `GET /api/v1/attendance/history` (Personal & Subordinates).
- [ ] **Task 4.4: Leave & Approvals Engine**
  - [ ] `POST /api/v1/leaves/request` with multi-attachment upload (S3 signed URLs).
  - [ ] `PATCH /api/v1/approvals/:id` with multi-tier hierarchy approvals and audit trail.
- [ ] **Task 4.5: Mobile App API Client Integration**
  - [ ] Replace `mockData.ts` with typed Axios/React Query API service layer.
  - [ ] Implement offline punch queuing using encrypted SQLite/MMKV storage.

### Testing & QA
- [ ] **Task 4.6: Backend Unit & Integration Tests**
  - [ ] Jest integration tests for PostGIS geofence boundary calculations.
  - [ ] Load testing for simultaneous morning clock-in rush (1000+ requests/sec).

---

## Sprint 5: Production Build, Hardening & Final Release (Week 6)

### Development Build (EAS / Standalone)
- [ ] **Task 5.1: App Configuration & EAS Setup**
  - [ ] Configure `eas.json` for Android APK/AAB and iOS IPA builds.
  - [ ] Set up app icons, splash screens, and native permission descriptions in `app.json`.
- [ ] **Task 5.2: Security Hardening**
  - [ ] Enable SSL/TLS Certificate Pinning on API requests.
  - [ ] Strip debug symbols and enable ProGuard / R8 code shrinking for Android.
  - [ ] Run security vulnerability audit on all dependencies.

### Testing & Verification
- [ ] **Task 5.3: End-to-End Field Testing**
  - [ ] Physical device testing at Macquires Riyadh HQ.
  - [ ] Verify offline attendance punch storage and auto-sync on reconnecting to network.
  - [ ] Validate biometric Face ID / Fingerprint lock & unlock flow.
- [ ] **Task 5.4: UAT & Store Release Readiness**
  - [ ] Internal testing track via Google Play Console & Apple TestFlight.
  - [ ] Prepare User Guide & Admin Deployment Documentation.
