# MacqHR Web Admin Console — UI Design Contract (`UI-SPEC.md`)

**Status**: Active Design Contract (Phase 7 / Admin Console Polish)
**Skill Standards**: `frontend-design` + `gsd-ui-phase`
**Scope**: Complete Web Administration Console (`web-admin/`) from Authentication (`/login`) through all 7 operational routes (`/overview`, `/attendance`, `/branches`, `/leaves`, `/employees`, `/payroll`, `/logs`) and all slide-over drawers & dialogs.

---

## 1. Design System Pillars

| Pillar | Standard | Implementation Contract |
| :--- | :--- | :--- |
| **1. Layout & Shell Architecture** | Fixed/collapsible desktop sidebar (`w-64` expanded, `w-20` collapsed) + sticky glassmorphic top header (`h-16 backdrop-blur-md`) + slide-over mobile drawer (`< md`). | `Sidebar.tsx` supports `isMobile` mode with dedicated close button (`X`) vs desktop collapse toggle (`PanelLeftClose`/`PanelLeftOpen`), dynamic pending-leaves badge, real user initials, and localized logout button. |
| **2. Theme & Locale Engine** | Persistent Light/Dark mode (`darkMode: 'class'`) and bilingual English/Arabic (`dir="ltr"` / `dir="rtl"`) across all screens—including Login. | `localStorage` persistence (`macqhr:admin:theme`, `macqhr:admin:lang`), CSS variables in `index.css`, and theme/language toggles available on both `AdminLoginScreen` and `Header`. |
| **3. End-to-End Mobile Responsiveness** | Zero horizontal page overflow from `320px` to `1920px+`. | Responsive spacing (`p-4 sm:p-6`), responsive filter grids, mobile card views (`md:hidden`) paired with structured HTML `<table>` (`hidden md:block` or scrollable container), and `max-h-[90vh] overflow-y-auto` on all modals. |
| **4. Visual Hierarchy & Contrast** | Deep obsidian/navy dark surfaces (`#0B1524` / `#122035`) vs crisp slate light surfaces (`#F8FAFC` / `#FFFFFF`), accented with Macquires Orange (`#FE5800`) and Navy (`#002C52`). | WCAG AA contrast (≥ 4.5:1), clear semantic status badges (Emerald = Verified/Active, Amber = Pending/Warning, Rose = Rejected/Inactive/Locked, Sky = Remote). |
| **5. Micro-Interactions & Feedback** | Instant visual feedback on interactive controls, copy buttons, loading states, and route transitions. | Skeleton/shimmer states, live Riyadh (`Asia/Riyadh`) clock in Header, password show/hide toggle on Login, and smooth transitions (`transition-all duration-200`). |

---

## 2. Screen-by-Screen Acceptance Criteria

1. **Authentication (`AdminLoginScreen.tsx`)**:
   - Top utility bar with Light/Dark theme toggle and `EN`/`AR` language toggle.
   - Responsive split-card layout on desktop (`lg:grid-cols-12`) with security posture highlights + compact single-card layout on mobile (`< lg`).
   - Show/hide password toggle, localized validation/error alerts, and clear role-access notice in both English and Arabic.
2. **Navigation Shell (`Sidebar.tsx` & `Header.tsx`)**:
   - Desktop sidebar pins to `left-0` (LTR) or `right-0` (RTL) and collapses smoothly between `w-64` and `w-20`.
   - Mobile drawer opens smoothly with backdrop blur, closes on route selection or `Escape`/backdrop click, and never overlaps close/collapse buttons.
   - Sticky Header displays live `Asia/Riyadh` time, API status indicator, quick-action pills, language toggle, and theme toggle.
3. **Executive Overview (`/overview` — `OverviewView.tsx`)**:
   - 4 responsive KPI cards (`grid-cols-1 sm:grid-cols-2 xl:grid-cols-4`) with interactive navigation links.
   - Live Attendance Radar with mobile card list (`md:hidden`) + structured HTML table (`hidden md:block`).
   - Corporate Branches summary + Mudad WPS quick export card with full EN/AR localization.
4. **Live Attendance Radar (`/attendance` — `AttendanceView.tsx`)**:
   - Responsive search + status filter pills (`ALL`, `VERIFIED`, `FLAGGED`).
   - Mobile punch cards + desktop structured HTML table.
   - Scroll-safe (`max-h-[90vh] overflow-y-auto`) 6-Layer Anti-Spoofing Audit Modal localized in EN/AR.
5. **Branches & Geofences (`/branches` — `BranchesView.tsx`)**:
   - Responsive 1/2/3-column branch cards with coordinates, radius, staff count, and Wi-Fi SSIDs.
   - Scroll-safe, localized Create/Edit Branch Geofence modal.
6. **Leave Approvals (`/leaves` — `LeavesView.tsx`)**:
   - Pending Queue vs Reviewed History tabs with live badge counts.
   - Mobile leave cards with direct Approve/Reject buttons + desktop structured HTML table.
7. **Employees & Lifecycle (`/employees` — `EmployeesView.tsx` & Drawers)**:
   - Responsive search + 6 filter/sort controls in a clean responsive grid on mobile (`grid-cols-2 sm:flex`).
   - Mobile employee cards with full action toolbar (Edit, Employment Change, Reset Password, Deactivate/Reactivate) + desktop structured HTML table.
   - Full-height responsive slide-over drawers (`EmployeeFormDrawer`, `EmploymentChangeDrawer`) and scroll-safe dialogs (`DeactivateEmployeeDialog`, `TemporaryPasswordModal`).
8. **Payroll & Mudad WPS (`/payroll` — `PayrollView.tsx`)**:
   - Mudad WPS hero banner + 4 GOSI/Payroll KPI cards.
   - Mobile employee payout cards + desktop structured WPS ledger table.
9. **System & Security Audit Logs (`/logs` — `AuditLogsView.tsx`)**:
   - 50 logs/page across up to 20 pages, fetched on request per page.
   - Responsive filter bar + mobile audit cards + desktop structured table + scroll-safe JSON inspection modal.
