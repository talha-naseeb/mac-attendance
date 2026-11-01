# MacqHR — Employee Self-Service & HR Management

MacqHR is a bilingual (English / Arabic) employee self-service platform for Macquires. It includes a React Native mobile app, a NestJS/PostgreSQL API, and a React web administration console.

**Status**: Product Phases 1–5 are implemented as a working prototype; **Phase 6 foundation work is implemented and awaiting G1 sign-off**. The system is **not production-ready** yet. Attendance integrity, two-stage approvals, admin completion, payroll runs, and release work are scheduled in delivery Phases 7–11.

- Forward plan: [docs/prd/README.md](docs/prd/README.md)
- Test plan: [docs/prd/test-plan.md](docs/prd/test-plan.md)
- Review and corrections: [docs/prd/document-review.md](docs/prd/document-review.md)
- Delivery rules: [RULES.md](RULES.md)
- Delivery tracker: [SPRINT_PLAN.md](SPRINT_PLAN.md)

---

## Repository layout

| Path | Surface |
|---|---|
| `App.tsx`, `src/` | Expo / React Native mobile app |
| `backend/` | NestJS API, Prisma schema, seed script |
| `web-admin/` | Vite + React administration console |
| `docs/prd/` | PRD, test plan, review |
| `docs/account-model/` | Target workspace and identity model |
| `docs/demo/` | Demo video and storyboard |
| `docs/qa/gates/` | Manual approval records (SHA-bound) |
| `ios/` | Native iOS source (Pods and build output are ignored) |
| `.github/workflows/verify.yml` | CI: mobile, backend and admin verification |
| `.githooks/pre-push` | SHA-bound push gate; install with `npm run hooks:install` |

All application surfaces are tracked as of Phase 6. A clean clone plus the documented setup can run and verify the whole system.

---

## What works today

### Implemented

- Backend password sign-in with bcrypt and JWT; role-based API guards.
- Employee dashboard with leave balances, actions, Who's Off, birthdays, and events.
- Office and remote attendance punch against the API with geofence, accuracy, drift, mock-location, root, and biometric checks.
- Leave submission, balance read, manager/HR decision endpoints.
- Personal attendance history, team attendance, directory, Who's Off, payslip, and payroll summary reads.
- Web admin login, overview, branch management, leave decisions, read-only employee list, and WPS export.
- English/Arabic UI, RTL helpers, light/dark themes, Concept A logo, sidebar profile editing.

### Demo only or incomplete

- Client-side role switching and demo simulation presets have been removed; roles come from the verified session.
- Anti-spoofing evidence is supplied by the client, not attested by a trusted device service (Phase 8).
- Microsoft 365 sign-in is hidden until it is configured; Teams/Outlook payloads are generated but never sent.
- Offline attendance is queued in the UI but the sync endpoint is disabled.
- Leave is single-stage, current-month only in the UI, and not ledger-backed.
- Admin employee management is read-only.
- Payroll is calculated from salary fields; there is no period run, unpaid-leave deduction, overtime, or lock.
- Phase 6 still lacks isolated database API tests and admin unit tests (M1.3); CI and migrations exist.

Do not present the demo-only items as finished features.

---

## Technology stack

- **Mobile**: Expo SDK 57, React Native 0.86, React 19, TypeScript strict, React Native Web.
- **API**: NestJS 10, Prisma 5, PostgreSQL, JWT, bcryptjs, class-validator.
- **Admin**: Vite 5, React 18, Tailwind CSS 3, Axios.
- **Testing**: custom ts-node harness for mobile logic, Jest for backend utilities/services, production build check for admin.
- **Localization**: English and Arabic with RTL layout helpers.
- **Theme**: Macquires palette with light and dark modes.

---

## Prerequisites

- Node.js 24 (see `.nvmrc`); Node 22 or newer is recommended.
- npm.
- PostgreSQL 15 or newer running locally.
- Xcode with an iOS simulator for `npm run ios` (macOS only).
- Android Studio and an emulator if you need Android.
- A modern browser for the admin console and mobile web.

PostGIS is not used. Geofence distance is calculated with Haversine in application code.

---

## Setup

### 1. Backend

```bash
cd backend
cp .env.example .env
npm install
npx prisma generate
npx prisma migrate deploy   # fresh database: applies the baseline migration
npm run prisma:seed
npm run start:dev
```

Before starting, edit `backend/.env`:

- Set a real `JWT_SECRET` (at least 32 characters in production); the API refuses to start in production without one.
- Set `DATABASE_URL` for your local PostgreSQL instance.
- Set `PORT=4000` so the API matches the mobile and admin defaults.
- Set `CORS_ORIGINS` to the admin and mobile web origins; `*` is rejected in production.

If your local database was created earlier with `prisma db push`, adopt the baseline once instead of re-creating it:

```bash
cd backend
npx prisma migrate resolve --applied 20261031000000_baseline
```

The API is then available at `http://localhost:4000/api`, with Swagger at `http://localhost:4000/api/docs`. Swagger must be disabled or protected before production.

### 2. Web admin

```bash
cd web-admin
npm install
printf 'VITE_API_BASE_URL=http://localhost:4000/api\n' > .env.local
npm run dev
```

Open the Vite URL (default `http://localhost:5173`). Use an HR Admin or Super Admin account; employee accounts are rejected by the admin login endpoint.

### 3. Mobile

```bash
npm install
cp .env.example .env
# Set EXPO_PUBLIC_API_BASE_URL=http://localhost:4000/api
npm start          # Expo dev server
npm run ios        # build/run the iOS app (Xcode required)
npm run web        # run the web build
```

The native `ios/` source is tracked so the required AppDelegate/scene fix stays visible. CocoaPods and build output are ignored. Run `npx expo prebuild` only when regenerating the native project, and review the diff before committing.

---

## Verification

# Mobile typecheck + logic tests
npm run verify

# Backend typecheck + unit/service tests + build
cd backend && npm run typecheck && npm test && npm run build

# Admin production build
cd web-admin && npm run build

# All three surfaces (same command CI and the pre-push hook run)
npm run verify:all
```

Current baseline (2026-10-31): mobile 48/48, backend 31/31 in 7 suites, admin build passing. CI runs `verify:all` on every pull request and on `main`.

The pre-push hook is installed with `npm run hooks:install`. It runs `verify:all` and requires an `APPROVED` record in `docs/qa/gates/` whose commit SHA matches the pushed commit. Do not use `--no-verify`.

These tests are necessary but not sufficient. GPS, biometrics, camera, offline behavior, RTL, and dark mode require a physical-device checklist from the [test plan](docs/prd/test-plan.md).

---

## Local demo accounts

The seed script creates demo users with the shared development password `Password123!`:

| Role | Email |
|---|---|
| Super Admin | `superadmin@macqhr.sa` |
| HR Admin | `sara.alotaibi@macqhr.sa` |
| Manager | `tariq.ghamdi@macqhr.sa` |
| Employee | `rahaf.mansoor@macqhr.sa` |
| Remote employee | `bilal.rehman@macqhr.sa` |

These accounts exist for local development only. Shared credentials must never be seeded into staging or production; Phase 7 replaces them with a temporary-credential and forced-change flow. The login screen no longer pre-fills credentials.

---

## Configuration

| Variable | Surface | Purpose |
|---|---|---|
| `DATABASE_URL` | Backend | PostgreSQL connection |
| `PORT` | Backend | API port; defaults to `4000` |
| `JWT_SECRET` | Backend | Token signing; required in production (32+ characters), no fallback |
| `CORS_ORIGINS` | Backend | Comma-separated admin/mobile origins; `*` rejected in production |
| `TRUST_PROXY` | Backend | Express trust-proxy value when the API runs behind a proxy; unset when directly exposed |
| `AZURE_TENANT_ID` / `AZURE_CLIENT_ID` / `AZURE_CLIENT_SECRET` | Backend | Entra SSO, when enabled |
| `EXPO_PUBLIC_API_BASE_URL` | Mobile | API base URL |
| `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` | Mobile | Map tiles/geocoding |
| `EXPO_PUBLIC_MS_ENTRA_TENANT_ID` / `CLIENT_ID` / `REDIRECT_URI` | Mobile | Entra client configuration, when enabled |
| `VITE_API_BASE_URL` | Admin | API base URL |

Never commit `.env` files or real secrets. Update the corresponding `.env.example` when adding a required variable.

---

## Design system

The Macquires palette is defined in `src/theme/colors.ts` and `src/theme/palette.css`:

- Oxford Blue `#001629`
- Prussian Blue `#002C52`
- Indigo Dye `#293F66`
- Bdazzled Blue `#3F5678`
- Davys Grey `#555555`
- Spanish Grey `#999999`
- Orange Pantone `#FE5800`

Use theme tokens, not hardcoded colors. Verify every UI change in light and dark mode and in both English and Arabic.

---

## Known limitations

| Limitation | Consequence |
|---|---|
| Client-asserted attendance security | Spoofable verdicts until device attestation is implemented (Phase 8) |
| No refresh/revocation | Cannot immediately invalidate a stolen or stale session |
| Single-stage leave approvals | Does not match manager → HR policy |
| No balance ledger | Balances can drift |
| UTC day boundary | Wrong day near midnight and for remote time zones |
| Offline sync disabled | Queued punches may never reach the server |
| Teams/Outlook not dispatched | Payloads are generated but nothing is sent |
| No API end-to-end or admin tests | Paths are covered by manual gates, not CI automation |

The remediation order is in [docs/prd/README.md](docs/prd/README.md), with findings and evidence in [docs/prd/document-review.md](docs/prd/document-review.md).

---

## Ownership

Internal, proprietary software for Macquires. Not licensed for redistribution.
