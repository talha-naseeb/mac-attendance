# MacqHR® — Employee Self-Service Mobile Application

Built for **Macquires** using **React Native (Expo SDK 57 + TypeScript)**, featuring full bilingual English & Arabic (`EN | عربي`) support, the official Macquires colour palette, and bidirectional RTL layout.

## Features

1. **Dashboard (`src/screens/DashboardScreen.tsx`)**
   - Brand top bar with Arabic/English language toggle (`عربي` / `EN`), Dark/Light mode switch, Notification center, and Face/Touch ID lock.
   - **Remaining Leave Balances** with interactive indicators and quick request triggers.
   - **My Actions** grid (`Transactions`, `Approvals`, `Payroll`, `Attendance`, `Documents`, `Schedule`, `Tasks`, `Directory`) with arrange mode.
   - **Who’s Off / Working Remotely**, **Upcoming Birthdays**, and **Company Events** cards.

2. **Geo-Attendance & Clock-In/Out (`src/screens/ClockInScreen.tsx`)**
   - Geofence zone visualization and GPS accuracy indicators.
   - Live elapsed shift counter, 2×2 clock & break timestamp grid, and interactive shift management.
   - Top-header Back navigation back to the main dashboard.

3. **My Approvals (`src/screens/ApprovalsScreen.tsx`)**
   - Multi-category filter chips (`All`, `Overtime`, `Time Off`, `Financial`, `Loan`).
   - One-tap approve and reject actions with live status updates.

4. **Attendance History (`src/screens/AttendanceScreen.tsx`)**
   - Segmented tabs for personal attendance and subordinates' attendance logs.
   - Shift intervals, working hours summary, and clock-in/out stamps.

5. **Request Time Off Modal (`src/screens/RequestTimeOffModal.tsx`)**
   - Interactive date sheet with Single Day / Date Range calendar selection.
   - Leave type selector, notes input, and document/camera attachment support.

6. **Full-Featured Sub-Modules (`src/screens/SubModuleModal.tsx`)**
   - **Financial Transactions**: Expense claims, descending sort, Saudi Riyal (`﷼ SAR`) calculations.
   - **Payroll**: Monthly salary slips with basic, housing, transport, and GOSI breakdowns.
   - **Colleague Directory**: Instant search by name, role, or department with contact links.
   - **Company Documents**: Verified employee documents and policies.
   - **Shift Schedule**: Weekly work shifts, remote days, and weekend rest periods.
   - **HR Tasks**: Checklist with interactive completion states.
   - **Employee Profile**: Key employment details and GOSI/IBAN info.
   - **Notifications Inbox**: Unread badges and mark-all-read controls.

## Official Macquires Colour Palette

Configured centrally in [`src/theme/palette.css`](src/theme/palette.css) and [`src/theme/colors.ts`](src/theme/colors.ts):
- **Oxford Blue**: `#001629`
- **Prussian Blue**: `#002C52`
- **Indigo Dye**: `#293F66`
- **Bdazzled Blue**: `#3F5678`
- **Davys Grey**: `#555555`
- **Spanish Grey**: `#999999`
- **Orange Pantone**: `#FE5800`

## Getting Started

### Prerequisites
- Node.js >= 22 (e.g. Node 24 via nvm: `nvm use 24`)
- Expo Go app or modern web browser

### Installation & Run

```bash
npm install
npx expo start -c
```
