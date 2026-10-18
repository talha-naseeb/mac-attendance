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

---

## Sprint 6: Option A Smooth Bezier Cradle Bottom Navigation Bar Redesign

### Development
- [x] **Task 6.1: SVG Smooth Bezier Cradle Geometry Engine**
  - [x] Install `react-native-svg` and build [`src/services/bottomNavGeometry.ts`](src/services/bottomNavGeometry.ts).
  - [x] Compute S-curve Bezier cutout dipping cleanly underneath the center `+` FAB (`depth = 36px`, `halfWidth = 58px`).
- [x] **Task 6.2: Flush Bottom Edge Attachment (Zero Bottom Gap/Shadow)**
  - [x] Create [`src/components/NotchedBottomBar.tsx`](src/components/NotchedBottomBar.tsx) extending through `useSafeAreaInsets().bottom` so the bar attaches flush to the physical bottom of mobile screens.
  - [x] Remove `bottom` from root `<SafeAreaView>` edges in [`App.tsx`](App.tsx) and eliminate downward bottom shadow.

### Automated & Manual Testing
- [x] **Task 6.3: Option A Bottom Nav Automated Tests**
  - [x] `TC-6.1` & `TC-6.2` in [`src/__tests__/macqhr.test.ts`](src/__tests__/macqhr.test.ts) — **PASSED**.
- [x] **Task 6.4: User Manual Testing (Completed & Approved)**
  - [x] Verify on mobile/web that the bottom navigation bar is flush with the bottom edge, has no bottom shadow, and curves smoothly under the center `+` button in both Light and Dark modes.

---

## Sprint 7: Official MacqHR Concept A ("People + M Crown") Logo & App Icon

### Development
- [x] **Task 7.1: Concept A Vector Logo Specification & Standalone Asset**
  - [x] Create [`src/services/logoSpec.ts`](src/services/logoSpec.ts) defining the Concept A ("People + M Crown") SVG geometry, squircle badge gradient (`#002C52` → `#001629`), architectural white `M` pillars (`#FFFFFF`), Orange Pantone (`#FE5800`) human apex pulse node, and base verification bar.
  - [x] Export standalone high-resolution SVG icon asset at [`assets/macqhr-icon.svg`](assets/macqhr-icon.svg).
- [x] **Task 7.2: Reusable `<MacqLogo />` Component & UI Integration**
  - [x] Create [`src/components/MacqLogo.tsx`](src/components/MacqLogo.tsx) supporting `icon`, `horizontal`, and `stacked` variants across `sm`, `md`, `lg`, and `xl` sizes plus RTL layout compatibility.
  - [x] Integrate `<MacqLogo />` into the top header bar of [`src/screens/DashboardScreen.tsx`](src/screens/DashboardScreen.tsx) and the Biometric Security Lock Screen in [`App.tsx`](App.tsx).

### Automated & Manual Testing
- [x] **Task 7.3: Concept A Logo Automated Tests**
  - [x] `TC-7.1` & `TC-7.2` in [`src/__tests__/macqhr.test.ts`](src/__tests__/macqhr.test.ts) — **PASSED**.
- [x] **Task 7.4: User Manual Testing (Completed & Approved)**
  - [x] Verify the new Concept A MacqHR logo in the Dashboard top header (icon only) and Opening/Biometric Lock Screen (full logo + wordmark).

---

## Sprint 8: Option A Executive Sidebar Drawer & Live Profile Editor

### Development
- [x] **Task 8.1: Header Three-Dots Removal & Logo Click Trigger**
  - [x] Remove the `more-vertical` (3-dots) button and floating overflow menu from [`src/screens/DashboardScreen.tsx`](src/screens/DashboardScreen.tsx).
  - [x] Make the Concept A `<MacqLogo />` in the header clickable to open the **Option A Executive Sidebar Drawer**.
- [x] **Task 8.2: Option A Executive Sidebar Drawer & Live Profile Editing**
  - [x] Create [`src/services/profileSettingsService.ts`](src/services/profileSettingsService.ts) and [`src/components/ExecutiveSidebarDrawer.tsx`](src/components/ExecutiveSidebarDrawer.tsx).
  - [x] Support live **Avatar Style change**, **Full Name change**, and **Mobile Phone Number change** inside the sidebar with instant state synchronization across [`App.tsx`](App.tsx), [`src/screens/DashboardScreen.tsx`](src/screens/DashboardScreen.tsx), and [`src/screens/SubModuleModal.tsx`](src/screens/SubModuleModal.tsx).
  - [x] Move Dark/Light Mode, Language (`EN/عربي`), Biometric Security Lock, Request Time Off, and Employment/GOSI Record controls into the Sidebar.

### Automated & Manual Testing
- [x] **Task 8.3: Option A Sidebar & Profile Editor Automated Tests**
  - [x] `TC-8.1`, `TC-8.2` & `TC-8.3` in [`src/__tests__/macqhr.test.ts`](src/__tests__/macqhr.test.ts) — **PASSED**.
- [x] **Task 8.4: User Manual Testing (Completed & Approved)**
  - [x] Tap the MacqHR logo in the top header to open the Option A Sidebar, test changing Avatar style, Full Name, and Phone Number, and verify the Settings switches.

---

## Sprint 9: Frontend Optimization, RBAC Role Filtering & Tiered Skeleton Shimmer Hydration

### Development
- [x] **Task 9.1: Role-Based Access Control (RBAC) & Tiered Hydration Service**
  - [x] Create [`src/services/dashboardOptimizationService.ts`](src/services/dashboardOptimizationService.ts) with synchronous JWT role permission claims (`EMPLOYEE`, `MANAGER`, `HR_ADMIN`), section-level authorization (`getAuthorizedDashboardSections`), Quick Action module filtering (`filterActionsByRole`), and tiered cold-start latency descriptors (`TIER_1_CORE`, `TIER_2_ACTIONS`, `TIER_3_FEED`).
- [x] **Task 9.2: Geometry-Matched Skeleton Shimmer Component & Virtualized `<FlatList>` Dashboard**
  - [x] Create [`src/components/DashboardSkeleton.tsx`](src/components/DashboardSkeleton.tsx) with 60 FPS `Animated` pulse/shimmer placeholders matching the exact dimensions (`borderRadius: 16`) of Balances, Actions Grid, Who's Off, Birthdays, and Events cards.
  - [x] Upgrade [`src/screens/DashboardScreen.tsx`](src/screens/DashboardScreen.tsx) from a monolithic `<ScrollView>` to a windowed `<FlatList>` (`initialNumToRender={3}`, `maxToRenderPerBatch={3}`, `windowSize={5}`) with an interactive RBAC Role Switcher (`Line Manager` / `Employee` / `HR Admin`) and Skeleton Replay button.

### Automated & Manual Testing
- [x] **Task 9.3: RBAC & Progressive Skeleton Hydration Automated Tests**
  - [x] `TC-9.1`, `TC-9.2` & `TC-9.3` in [`src/__tests__/macqhr.test.ts`](src/__tests__/macqhr.test.ts) — **26/26 TOTAL PASSED**.
- [x] **Task 9.4: User Manual Testing (Completed & Approved)**
  - [x] Switch between `Line Manager`, `Employee`, and `HR Admin` pills on the Dashboard (or tap the refresh button) to verify tiered Skeleton Shimmer hydration and role-filtered cards.

---

## Sprint 10: Dedicated Login Screen, Microsoft 365 SSO Sign-In & Complete Session Flow

### Development
- [x] **Task 10.1: Login Screen & Authentication Architecture**
  - [x] Create [`src/screens/LoginScreen.tsx`](src/screens/LoginScreen.tsx) with Concept A branding, synchronized input containers for Work Email and Password, Password visibility toggle, quick role selector (`Employee`, `Line Manager`, `HR Admin`), and a dedicated **Sign in with Microsoft 365** button.
  - [x] Implement validation service in [`src/services/authService.ts`](src/services/authService.ts) supporting email formatting, mock credentials verification, role claim generation, and error handling.
- [x] **Task 10.2: Global Session Management & Logout Flow**
  - [x] Connect [`App.tsx`](App.tsx) authentication state (`isAuthenticated`, `userRole`, `employeeProfile`) to render `LoginScreen` when unauthenticated.
  - [x] Update [`src/components/ExecutiveSidebarDrawer.tsx`](src/components/ExecutiveSidebarDrawer.tsx) and [`src/screens/DashboardScreen.tsx`](src/screens/DashboardScreen.tsx) to wire the bottom **Logout** pill to trigger a full session sign-out back to `LoginScreen`.
- [x] **Task 10.3: Authentication & Session Automated Tests**
  - [x] Write `TC-10.1`, `TC-10.2` & `TC-10.3` in [`src/__tests__/macqhr.test.ts`](src/__tests__/macqhr.test.ts) covering login validation, role claim resolution, and Microsoft 365 Entra ID SSO session lifecycle — **30/30 PASSED**.
- [ ] **Task 10.4: User Manual Testing (Ready for User Verification)**
  - [ ] Verify Login screen UI, test logging in with different roles, confirm sidebar Logout returns to Login, and test Microsoft 365 button.


