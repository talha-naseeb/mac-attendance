# MacqHR Sprint Task Board, Test Suite & Delivery Tracker

> **Project**: MacqHR (ZenHR Enterprise Clone & Enhancement for Macquires)  
> **Status**: Frontend Sprints Completed • Automated Tests Passing (16/16) • Awaiting Manual QA Sign-off Before Git Push  
> **Last Updated**: 2026-10-17  
> **Legend**:  
> - `[x]` Completed & Verified  
> - `[/]` In Progress / Active Manual QA  
> - `[ ]` Pending / Backlog  

---

## Mandatory Repository Push Restriction Policy
1. **Complete Sprint Development** per [`RULES.md`](RULES.md).
2. **Write Automated Test Cases** in [`src/__tests__/macqhr.test.ts`](src/__tests__/macqhr.test.ts).
3. **Run & Pass Automated Verification** (`npm run verify` -> `tsc --noEmit` + 16 unit/integration tests).
4. **User Manual Testing Gate**: User tests the application manually and approves.
5. **Git Push**: Only after user manual QA approval may code be pushed to the remote repository (enforced by `.git/hooks/pre-push`).

---

## Sprint 1: Security Rules, Foundations & Project Audit (Week 1)

- [x] **Task 1.1: Codebase Audit & Gap Analysis**
  - [x] Review current screens (`DashboardScreen`, `ClockInScreen`, `ApprovalsScreen`, `AttendanceScreen`, `RequestTimeOffModal`, `SubModuleModal`).
  - [x] Assess mock data structures in `mockData.ts` and identify ZenHR parity gaps.
- [x] **Task 1.2: Architecture & Development Rules Definition**
  - [x] Establish official project rules file ([`RULES.md`](RULES.md)) including Section 0 Repository Push Restrictions.
  - [x] Document brand design system (Macquires color palette, RTL bilingual guidelines).
  - [x] Define multi-tier anti-spoofing security protocol.
  - [x] Define Microsoft 365 / Teams integration specs.
- [x] **Task 1.3: Sprints & Task Tracking Setup**
  - [x] Create project task tracking board ([`SPRINT_PLAN.md`](SPRINT_PLAN.md)).

---

## Sprint 2: Live Location, Google Maps & Anti-Spoofing Attendance (Week 2)

### Development
- [x] **Task 2.1: Location Service Setup**
  - [x] Install and configure `expo-location` and permissions workflow (Foreground & Background).
  - [x] Configure Android `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`, `ACCESS_WIFI_STATE` and iOS `NSLocationWhenInUseUsageDescription` in [`app.json`](app.json).
- [x] **Task 2.2: Anti-Spoofing & Mock Location Detection Engine**
  - [x] Implement [`src/services/locationSecurity.ts`](src/services/locationSecurity.ts) and [`src/hooks/useLocationSecurity.ts`](src/hooks/useLocationSecurity.ts) inspecting hardware mock location flags (`mocked` / `isFromMockProvider`).
  - [x] Implement Haversine distance engine and GPS accuracy filter (rejects accuracy radius $> 50\text{ m}$).
  - [x] Implement mock app detection, root/jailbreak environment check, and NTP clock-drift check.
  - [x] Implement Office Wi-Fi BSSID / SSID and BLE Beacon cross-check helper.
- [x] **Task 2.3: Live Interactive Google Maps & Radar Clock-In Screen**
  - [x] Upgrade [`src/screens/ClockInScreen.tsx`](src/screens/ClockInScreen.tsx) with live Google Maps embed / Geofence Radar toggle.
  - [x] Render office geofence radius circle and live user coordinate pin with distance offset.
  - [x] Add 4-pill Anti-Spoofing Telemetry Matrix (Hardware GPS, Corp Wi-Fi, Face ID Liveness, Geofence Zone) + Trust Score badge.
  - [x] Add Interactive QA Simulator Strip so manual testers can simulate Fake/Mock GPS, Outside Fence, Low Accuracy, and Rooted devices on the fly.

### Automated & Manual Testing
- [x] **Task 2.4: Geofence & Anti-Spoofing Automated Tests**
  - [x] `TC-2.1` to `TC-2.8` in [`src/__tests__/macqhr.test.ts`](src/__tests__/macqhr.test.ts) — **8/8 PASSED**.
- [x] **Task 2.5: User Manual Testing (Approved)**
  - [x] Test QA Simulator presets on `Clock-in` tab (`Verified Riyadh HQ`, `Test Fake/Mock GPS`, `Test Outside Fence`, `Test Low Accuracy`, `Test Root/Jailbreak`) and verify Clock-In/Out button locks when spoofed.

---

## Sprint 3: Microsoft 365, Teams & Entra ID Integration (Week 3)

### Development
- [x] **Task 3.1: Microsoft Entra ID (Azure AD) SSO Frontend Integration**
  - [x] Configure Macquires Microsoft App Registration config (`MACQUIRES_ENTRA_CONFIG`) in [`src/services/microsoftGraph.ts`](src/services/microsoftGraph.ts).
  - [x] Add Microsoft 365 & Teams Hub modal (`activeModal === 'microsoft365'`) accessible directly from the Dashboard greeting pill.
- [x] **Task 3.2: Microsoft Teams Communications & Presence**
  - [x] Automatically compute and sync Teams user presence (`Available`, `BeRightBack`, `Away`, `OutOfOffice`) when user clocks in, starts break, or clocks out.
  - [x] Generate Microsoft Teams Adaptive Cards (v1.5) in [`src/screens/ApprovalsScreen.tsx`](src/screens/ApprovalsScreen.tsx) and notify inbox on manager approval/rejection.
- [x] **Task 3.3: Outlook Calendar Synchronization**
  - [x] Automatically push Out-of-Office (`showAs: 'oof'`) calendar events to Microsoft Outlook Calendar whenever a user submits a Time Off request.
- [x] **Task 3.4: Offline Anti-Tamper Queue & Saudi Labor Law GOSI/WPS**
  - [x] Implement FNV-1a cryptographic signature sealing for offline attendance punches in [`src/services/offlineSyncAndCompliance.ts`](src/services/offlineSyncAndCompliance.ts).
  - [x] Implement Saudi GOSI (9.75% employee / 11.75% employer) and Mudad WPS IBAN compliance breakdown in Payroll modal.

### Automated & Manual Testing
- [x] **Task 3.5: Microsoft 365, Offline Sync & GOSI Automated Tests**
  - [x] `TC-3.1` to `TC-5.1` in [`src/__tests__/macqhr.test.ts`](src/__tests__/macqhr.test.ts) — **8/8 PASSED**.
- [x] **Task 3.6: User Manual Testing (Approved)**
  - [x] Tap `MS Teams: Available` pill on Dashboard to inspect Microsoft Entra ID SSO, Teams Presence, Outlook OOF Calendar events, and Offline Signed Punch Queue.

---

## Sprint 4: Backend API, PostGIS & Database Layer (Upcoming Phase)

- [ ] **Task 4.1: Backend Service Initialization (NestJS / PostgreSQL + PostGIS)**
- [ ] **Task 4.2: Relational Schema & Migration**
- [ ] **Task 4.3: Production Attendance & Anti-Spoofing Endpoints**
- [ ] **Task 4.4: Leave & Multi-Tier Approvals Engine**

---

## Sprint 5: Production Build, Hardening & Final Release (Upcoming Phase)

- [ ] **Task 5.1: App Configuration & EAS Standalone Build (`eas.json`)**
- [ ] **Task 5.2: SSL Certificate Pinning & ProGuard Hardening**
- [ ] **Task 5.3: Physical Device Field Testing & Store Release**
