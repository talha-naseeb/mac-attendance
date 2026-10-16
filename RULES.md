# MAC-HR (MacqHR) — Development Rules & Architecture Guidelines

This repository hosts **MacqHR**, an enterprise Employee Self-Service (ESS) and Human Resource Management System (HRMS) mobile application built with React Native / Expo, inspired by ZenHR and customized for Macquires corporate standards.

---

## 1. Core Architecture & Technology Stack

- **Framework**: React Native with Expo SDK (TypeScript strict mode).
- **Design System**: Official Macquires Palette (`Oxford Blue`, `Prussian Blue`, `Indigo Dye`, `Bdazzled Blue`, `Davys Grey`, `Spanish Grey`, `Orange Pantone`). Single source of truth in `src/theme/colors.ts` and `src/theme/palette.css`.
- **Localization**: Full bilingual Arabic & English (`ar` & `en`) with dynamic RTL/LTR layout transitions (`src/theme/typography.ts`, `src/i18n/`).
- **Backend Architecture**: Production-grade REST / GraphQL API with Node.js/NestJS or Supabase/PostgreSQL backend services, handling enterprise authentication, RBAC, audit logging, and integrations.

---

## 2. Geofence Attendance & Anti-Spoofing Rules

Live location tracking and attendance clocking MUST adhere to the following anti-spoofing requirements:

1. **Hardware & OS Mock Location Verification**:
   - Verify `isMock` / `isFromMockProvider` flags from native location sensors (`expo-location` / Android Location API / iOS CoreLocation).
   - Reject any clock-in/out attempt if mock location or mock provider flags are detected.
2. **Geofencing & Accuracy Enforcement**:
   - Enforce server-side distance calculation (Haversine formula) validating user coordinates against configured office/branch geofence polygons/circles.
   - GPS accuracy radius must be within acceptable thresholds ($\le 25\text{ m}$). Reject fixes with wide accuracy bounds ($> 50\text{ m}$).
3. **Office Network & BLE Beacons Fallback**:
   - Cross-verify location using corporate office Wi-Fi BSSID / SSID or BLE proximity beacons deployed at turnstiles/doors to ensure physical presence.
4. **Device Integrity & Root/Jailbreak Detection**:
   - Check device trust state (Jailbreak / Root / Xposed / Magisk detection). Flag or block attendance submissions from compromised environments.
5. **Biometric Liveness Verification**:
   - Enforce biometric authentication (Face ID / Fingerprint) or real-time camera selfie verification with liveness checks during clock-in.
6. **Server-Side Timestamping**:
   - Never rely exclusively on client device clock (prevents time rollback attacks). The official clock-in timestamp is always verified and sealed by the server NTP clock.

---

## 3. Microsoft 365 / Microsoft Teams Integration Rules

1. **Single Sign-On (SSO)**:
   - Microsoft Entra ID (Azure AD) OAuth2 / OpenID Connect (`msal-react-native` or Expo AuthSession with Microsoft endpoint).
2. **Communications & Teams Integration**:
   - Microsoft Graph API integration for Teams chat notifications, approvals cards, meeting attendance, and direct messaging channels.
   - Sync employee status with Microsoft Teams presence (e.g. Set "In a meeting", "Away", "Out of Office - Vacation").
3. **Calendar & Leave Synchronization**:
   - Automatically push approved leaves and time-off requests to Microsoft Outlook Calendar (Exchange Online) via Microsoft Graph `/me/events`.
4. **Corporate Directory Sync**:
   - Sync organization hierarchy and employee directory with Azure Active Directory (Microsoft Entra ID) user objects.

---

## 4. UI/UX & Frontend Standards

1. **Responsive & Native Polish**:
   - Support safe areas, high contrast mode, smooth transitions, and tactile haptic feedback.
   - Dark/Light mode theme engine with dynamic contrast compliance (WCAG 2.1 AA standard).
2. **Bilingual RTL Integrity**:
   - Never hardcode directional styles (`left`/`right` or `marginRight` without RTL compensation). Use `rtlRow` and `rtlText` helpers.
   - Numbers and dates must follow localized formatting.
3. **Graceful Offline & Network Resilience**:
   - Implement offline queueing for time logs with encrypted local storage (WatermelonDB / MMKV / SQLite) with anti-tamper signing before upload.

---

## 5. Security & Compliance (Saudi Labor Law & GOSI)

1. **Data Security**:
   - All network traffic TLS 1.3 encrypted with certificate pinning.
   - Sensitive tokens (JWT, Refresh tokens) stored in SecureStore / Keychain.
2. **Saudi Labor Law Standards**:
   - Compliant with wage protection system (WPS / Mudad), GOSI calculations, and standard overtime rules.
