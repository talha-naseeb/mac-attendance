# MacqHR — Account, Workspace & Identity Model

**Status:** Proposed target state · **Date:** 2026-10-30 · **Audience:** founder, product, backend, mobile, admin

This document defines how MacqHR should support two package types — **Individual** and **Business** — without forking the product, and how a business owner defines who is an employee, a manager, or HR while the company signs in with Google Workspace or Microsoft 365.

It is a design decision document, not an implementation. The current repo is used as evidence for the migration section only.

---

## 1. Decision summary

**One tenant spine, two packages.**

| ID | Decision | Why |
|----|----------|-----|
| D1 | An **Individual** account is a `Workspace` of type `PERSONAL` with exactly one member. A **Business** account is a `Workspace` of type `BUSINESS` with N members. | One data model, one permission system, one billing boundary. No second app or parallel schema. |
| D2 | **Role lives on `Membership`, never on `User`.** | A person can be an individual user *and* an employee of a company, or work for two companies. Authorization is always workspace-scoped. |
| D3 | **SSO is configured per workspace**, behind one provider adapter (Google Workspace, Microsoft Entra, email/password). | Companies differ; the product should not hardcode “Microsoft shop” or “Google shop”. |
| D4 | **Reporting line is separate from role.** `reportsToMembershipId` defines hierarchy; `MANAGER` grants approval capability. | Prevents “manager” from meaning two different things; supports HR override and reorganizations. |
| D5 | **Plans are entitlements on the workspace**, not UI flags. Seats are counted from active memberships. | Feature gating, upgrades, and billing all read one source of truth. |

The core insight: *Individual vs Business is a property of the workspace, not a different kind of user.* “Individual” is a one-seat business with a smaller plan.

### Why not two separate products

Splitting into separate tables or apps would duplicate authentication, onboarding, notifications, documents, and audit — and would break the common case of a freelancer who is also employed by a company. A single workspace/membership model costs one extra join and removes an entire class of divergence.

---

## 2. Vocabulary

| Term | Meaning | Scope |
|------|---------|-------|
| **User** | A human identity: email, password/social identities, locale, avatar. | Global |
| **AuthIdentity** | A login method linked to a user (`LOCAL`, `GOOGLE`, `MICROSOFT`, `APPLE`). | Global |
| **Workspace** | Tenant, data boundary, billing account. `PERSONAL` or `BUSINESS`. | Tenant |
| **Membership** | A user’s position inside one workspace: role, employee number, title, department, branch, salary, reporting line, status. | Tenant |
| **Role** | Base permission set: `OWNER`, `HR_ADMIN`, `MANAGER`, `EMPLOYEE`. | Membership |
| **Reports-to** | The membership this member reports to. Orthogonal to role. | Membership |
| **Plan** | Commercial package attached to the workspace. | Workspace |
| **Entitlement** | A capability unlocked by the plan (`payroll`, `sso`, `audit`, `maxSeats`). | Workspace |
| **SsoConnection** | Workspace’s Google/Microsoft identity configuration. | Workspace |
| **Group mapping** | Provider group → MacqHR role rule used for automatic role assignment. | Workspace |
| **Invite** | Single-use, expiring invitation to join a workspace with a proposed role. | Workspace |

---

## 3. Target data model

Diagram source: [`data-model.mmd`](data-model.mmd) · Context: [`context.mmd`](context.mmd)

### 3.1 User (global identity)

```
User
  id, email @unique, passwordHash?, displayName, locale, avatarUrl,
  createdAt, updatedAt, lastLoginAt
```

No `role`, `managerId`, `branchId`, salary, or employee number. Those are employment facts and belong to a membership. Keeping them on `User` is the single biggest blocker to multi-tenancy in the current schema ([schema.prisma](../../backend/prisma/schema.prisma)).

### 3.2 Workspace (tenant + billing)

```
Workspace
  id, type: PERSONAL | BUSINESS, name, slug @unique,
  country, timezone, currency, logoUrl,
  planCode, status: ACTIVE | SUSPENDED | ARCHIVED,
  ownerMembershipId, createdAt
```

- `PERSONAL`: enforced 1 membership, plan `INDIVIDUAL_*`.
- `BUSINESS`: 1..N memberships, plan `BUSINESS_*` / `ENTERPRISE`.
- Converting `PERSONAL → BUSINESS` reuses the same workspace (preserves data); the reverse is allowed only when one member remains.

### 3.3 Membership (authorization + employment)

```
Membership
  id, workspaceId, userId, role,
  employeeId?, jobTitle?, departmentId?, branchId?,
  reportsToMembershipId?,
  status: INVITED | ACTIVE | SUSPENDED,
  employment fields (contract type, join date, salary, GOSI identifiers, remote flags),
  joinedAt, createdAt, updatedAt

  @@unique([workspaceId, userId])
  @@unique([workspaceId, employeeId])
```

This table replaces the workspace-scoped parts of today’s `User`, and it is the object every guard and query should check.

### 3.4 Organization units

```
Department   id, workspaceId, name, nameAr, parentId?
Branch       id, workspaceId, name, city, lat, lng, geofenceRadiusMeters,
             wifiBssids[], bleBeacons[]
```

### 3.5 Identity configuration

```
SsoConnection
  id, workspaceId @unique,
  provider: GOOGLE | MICROSOFT,
  domain?,            // Google Workspace domain
  tenantId?,          // Microsoft Entra tenant
  enforced,           // blocks password login when true
  autoProvision,      // JIT-create memberships on first SSO login
  defaultRole,        // EMPLOYEE or MANAGER
  status: DRAFT | VERIFIED | ERROR

SsoGroupMapping
  id, workspaceId, providerGroupId, providerGroupName, role

AuthIdentity
  id, userId, provider, providerAccountId, emailAtProvider,
  @@unique([provider, providerAccountId])
```

Secrets (client secret / service account) live in a secret manager or encrypted column; they are never returned by the API.

### 3.6 Invites and billing

```
Invite
  id, workspaceId, email, role, reportsToMembershipId?,
  tokenHash, expiresAt, invitedByMembershipId, acceptedAt?, revokedAt?

Subscription
  id, workspaceId @unique, provider, externalCustomerId,
  seatsPurchased, status, currentPeriodEnd
```

### 3.7 Domain records gain `workspaceId`

`AttendanceRecord`, `LeaveRequest`, `LeaveBalance`, `PayrollRun`, `OfflinePunchQueue`, `AuditLog` all carry `workspaceId`. Queries, uniques, and indexes become workspace-scoped, e.g.:

```
@@unique([workspaceId, userId, leaveType, year])   // LeaveBalance
@@index([workspaceId, dateIso])                    // AttendanceRecord
```

`PayrollRun` is new: payroll should be generated and persisted per workspace + period, not recomputed on every request as it is today ([payroll.service.ts](../../backend/src/modules/payroll/payroll.service.ts)).

---

## 4. Roles, permissions and reporting

### 4.1 Role definitions

| Role | Purpose | Key constraints |
|------|---------|-----------------|
| `OWNER` | Billing, plan, workspace deletion, SSO, final authority. | At least one owner always; only an owner can grant `OWNER` or `HR_ADMIN`. |
| `HR_ADMIN` | People operations: employee records, payroll, leave policy, all attendance, reports. | Cannot change billing, delete workspace, or grant ownership. |
| `MANAGER` | Approvals and visibility for direct reports. Also an employee. | Sees team data only; salary visibility is opt-in per workspace. |
| `EMPLOYEE` | Self-service: own profile, leave, attendance, payslips, documents. | No visibility into other members beyond directory fields. |

For a `PERSONAL` workspace, the single member is `OWNER`; the UI labels the role as “You”, not “Owner”.

### 4.2 Permission matrix

| Capability | Employee | Manager | HR Admin | Owner |
|---|---|---|---|---|
| Own profile, attendance, leave, payslips | RW | RW | RW | RW |
| Company directory (name, title, department) | R | R | RW | RW |
| Team attendance and timesheets | — | R team | RW all | R all |
| Approve direct reports’ leave | — | RW | RW | RW (override) |
| Approve anyone’s leave | — | — | RW | RW (override) |
| Employee records and contracts | — | — | RW | RW |
| Salary / payroll data | Own payslip | Own payslip | RW | R (configurable) |
| Leave policy, holidays, work week | — | — | RW | RW |
| Branches, geofences, remote rules | — | — | RW | RW |
| Invite members | — | — | RW (MGR/EMP only) | RW (any role) |
| Change roles / reporting lines | — | — | RW (MGR/EMP only) | RW |
| Billing, plan, seats | — | — | — | RW |
| SSO connection and group mapping | — | — | R | RW |
| Audit log | — | — | R | R |
| Delete workspace / transfer ownership | — | — | — | RW |

`RW` = read/write, `R` = read, `—` = no access.

### 4.3 Assignment rules

1. **Owner assigns everything.** HR can assign `MANAGER` and `EMPLOYEE` but cannot mint peers or owners. This prevents privilege escalation.
2. **Last owner is protected.** Demoting, suspending, or removing the final `OWNER` is rejected; ownership must be transferred explicitly.
3. **Role changes are audited** (`AuditLog`: actor, target, old role, new role) and immediately invalidate the target’s cached authorization.
4. **A manager is made by a reporting line, not by a title.** `MANAGER` unlocks the approval surface; `reportsToMembershipId` decides whose requests appear. A manager with zero reports sees an empty queue, not everyone’s.
5. **Group mapping is limited.** Google/Microsoft groups may grant `EMPLOYEE` or `MANAGER` automatically. Mapping to `HR_ADMIN` requires an explicit owner opt-in; mapping to `OWNER` is never automatic.
6. **Individual workspaces cannot invite.** The invite endpoint returns `403 PLAN_SEAT_LIMIT` and the UI offers “Convert to a business account”.

### 4.4 Approval chain

Make the chain a workspace policy rather than hardcoding one flow:

```
LeaveApprovalPolicy = MANAGER_ONLY | MANAGER_THEN_HR
```

- `MANAGER_ONLY` (default): direct manager decides; HR is notified and can override.
- `MANAGER_THEN_HR`: manager recommends, HR finalizes. Statuses: `PENDING_MANAGER → PENDING_HR → APPROVED`.
- No manager, or manager is the requester: route directly to HR.
- Self-approval is always rejected, including for HR and owners.

This resolves the drift between the current enum (`PENDING_MANAGER`/`PENDING_HR`) and the service that writes only `PENDING` ([leaves.service.ts](../../backend/src/modules/leaves/leaves.service.ts)).

---

## 5. Packages and entitlements

| Plan | Seats | Personal tracking | Org & approvals | Payroll / GOSI / WPS | SSO | Directory sync | Audit & API |
|---|---|---|---|---|---|---|---|
| `INDIVIDUAL_FREE` | 1 | Yes | — | — | — | — | — |
| `INDIVIDUAL_PRO` | 1 | Yes + exports, insights | — | — | — | — | — |
| `BUSINESS_STARTER` | 10 | Yes | Yes | — | — | — | — |
| `BUSINESS_GROWTH` | 50 | Yes | Yes | Yes | Google / Microsoft | — | Yes |
| `ENTERPRISE` | Custom | Yes | Yes | Yes | Google / Microsoft | Yes (SCIM optional) | Yes + custom retention |

**Individual scope (assumption to confirm):** personal clock-in/out and timesheet, personal leave/absence calendar, payslip and document vault (self-uploaded), reminders, exports. No team, approvals, payroll administration, geofence administration, or SSO.

**Entitlement object** used by guards and UI:

```json
{
  "maxSeats": 50,
  "payroll": true,
  "sso": true,
  "directorySync": false,
  "auditLog": true,
  "apiAccess": true,
  "customBranding": false
}
```

**Seat counting:** billable seats = `ACTIVE` memberships + outstanding `INVITED` memberships, so invites cannot overshoot the plan. Pending invites expire after 14 days and release the seat.

**Upgrade path:** `PERSONAL → BUSINESS` converts the workspace in place. A business cannot downgrade to personal while it has more than one member.

---

## 6. Identity and sign-in

Two independent layers:

1. **Authentication** — who the person is (local password, Google, Microsoft, Apple).
2. **Workspace authorization** — which workspace they enter and with what role (membership + SSO policy + group mapping).

Diagram: [`sign-in-flow.mmd`](sign-in-flow.mmd)

### 6.1 Provider discovery

`POST /auth/discover { email }` returns:

```json
{
  "passwordAllowed": false,
  "workspaces": [
    { "id": "ws_...", "name": "Macquires", "type": "BUSINESS",
      "ssoRequired": true, "provider": "MICROSOFT" }
  ]
}
```

Rules:
- If the email domain matches an **enforced** `SsoConnection`, password login is refused for that workspace and the client redirects to the provider.
- If no enforced SSO exists, password and social login remain available.
- Rate-limit discovery and keep the response minimal to limit account enumeration.

### 6.2 Provider adapters

One interface, two implementations:

```ts
interface IdentityProviderAdapter {
  buildAuthorizeUrl(state: string, workspace?: Workspace): string;
  exchangeCode(code: string): Promise<ProviderProfile>;
  listDirectoryUsers?(): Promise<ProviderUser[]>;
  listGroups?(): Promise<ProviderGroup[]>;
}

type ProviderProfile = {
  subject: string;
  email: string;
  emailVerified: boolean;
  displayName: string;
  hostedDomain?: string; // Google `hd`
  tenantId?: string;     // Microsoft `tid`
};
```

- **Google:** OpenID Connect. When a domain is configured, require `hd === domain`.
- **Microsoft:** Entra ID OIDC. Require `tid === workspace.sso.tenantId`. The existing JWKS verification in [auth.service.ts](../../backend/src/modules/auth/auth.service.ts) is reusable.
- **Local:** bcrypt password with forced reset on first login; no shared default password.
- **Apple:** optional, individual accounts only.

### 6.3 JIT provisioning and group mapping

- If `autoProvision` is on and the provider proves domain/tenant ownership, create the `User` (if new) and a `Membership` with `defaultRole` on first login.
- If `autoProvision` is off, SSO login without an accepted invite returns `403 INVITE_REQUIRED`.
- Group mapping is evaluated at login and by a nightly sync:
  - `hr@company.com` → `HR_ADMIN` (owner opt-in only)
  - `managers@company.com` → `MANAGER`
  - everyone else → `EMPLOYEE`
- Manual overrides beat group mapping; the admin UI shows “Managed by Google/Microsoft” on mapped rows.

### 6.4 Workspace selection

- One membership: enter it directly.
- Multiple memberships: show a workspace picker after authentication.
- The issued JWT carries `sub`, `workspaceId`, `membershipId`, `role`, and `sv` (session version). Switching workspaces issues a fresh short-lived token; the server never trusts a workspace ID from the request body.
- Removing or suspending a membership increments `sv`, invalidating existing tokens.

### 6.5 Teams is not an identity provider

Microsoft Teams is a collaboration surface: notifications, Adaptive Cards, calendar sync. It stays a per-workspace integration using the existing Graph code, connected separately from Entra SSO. A company can use Google for identity and Teams for notifications, or vice versa.

---

## 7. User experience flows

Wireframes: [`account-model.html`](account-model.html) §7

### 7.1 Individual onboarding (4 steps)

1. Welcome → **“How will you use MacqHR?”** with two cards: *For myself* / *For my company*.
2. *For myself*: name, country, timezone, work week.
3. Workspace created as `PERSONAL`, member is `OWNER`, plan `INDIVIDUAL_FREE`.
4. Land on the personal dashboard: clock, leave calendar, documents. No org tabs.

### 7.2 Business onboarding (6 steps)

1. Package choice → *For my company*.
2. Company profile: legal name, country, timezone, currency, size, logo.
3. Workspace created as `BUSINESS`, caller is `OWNER`, trial plan assigned.
4. **“How does your team sign in?”** — Google Workspace / Microsoft 365 / Email invites / Decide later.
5. **“Who is on your team?”** — invite by email, paste a list, or sync from the provider. Each row gets a role and optional manager.
6. Policies: work week, leave types, approval chain (`MANAGER_ONLY` or `MANAGER_THEN_HR`), first branch/geofence. Invitees receive email; the owner lands on the team page.

### 7.3 Invite acceptance

Open link → verify token → sign in with the invited email (password or the workspace’s SSO) → preview role/manager → accept → membership becomes `ACTIVE`. Expired or revoked invites show a request-new-invite action.

### 7.4 Team and role management (admin)

- Table columns: member, role chip, reports-to, branch, status, last active, actions.
- Bulk actions: invite, resend, revoke, change role, assign manager, suspend.
- Guardrails in UI: last owner cannot be demoted; HR cannot select `OWNER`/`HR_ADMIN`; seat meter warns at 90%.
- “Managed by Microsoft/Google” badge for group-mapped roles, with an override action.

### 7.5 SSO settings (admin)

- Provider card: Not configured → Draft → Verified / Error.
- Google: domain, verification TXT record, enforcement toggle, auto-provision toggle, default role.
- Microsoft: tenant ID, admin consent status, enforcement, auto-provision.
- Group mapping table with a “Sync now” action and last-sync timestamp.
- “Test connection” runs a dry-run login without creating a membership.

---

## 8. Design system additions

**Rule:** every new surface uses semantic tokens, never raw hex. The Macquires palette in [colors.ts](../../src/theme/colors.ts) and [tailwind.config.js](../../web-admin/tailwind.config.js) remains the primitive source.

### 8.1 Semantic tokens

| Token | Light | Dark | Use |
|---|---|---|---|
| `--surface` | `#FFFFFF` | `#0E1C2E` | Page/card base |
| `--surface-raised` | `#F8FAFC` | `#13263D` | Nested panels |
| `--surface-subtle` | `#EBF0F5` | `#13263D` | Table headers, chips |
| `--border` | `#DCE3EC` | `#243B57` | Dividers, inputs |
| `--text-primary` | `#001629` | `#F3F7FB` | Headings, body |
| `--text-secondary` | `#555555` | `#C7D3E1` | Labels |
| `--text-muted` | `#6B7A8C` | `#93A4B8` | Hints (do not use `#999999` for small text on white) |
| `--accent` | `#FE5800` | `#FE5800` | Primary action, selection |
| `--accent-fg` | `#001629` | `#001629` | Text **on** accent |
| `--focus` | `#FE5800` | `#FF8547` | Focus ring |
| `--success` / `--danger` / `--warning` | `#137333` / `#C5221F` / `#8A4B00` | `#6EE7B7` / `#FCA5A5` / `#FFB68C` | Status |

Contrast note: white on `#FE5800` is ≈3.18:1 and fails WCAG AA for normal text. Use `#001629` on orange (≈5.75:1), or reserve orange for icons, borders, and large bold labels.

### 8.2 Role and plan tokens

| Token | Background | Foreground |
|---|---|---|
| `--role-owner-bg/fg` | `#FFE9DC` | `#8A2D00` |
| `--role-hr-bg/fg` | `#E6ECF2` | `#002C52` |
| `--role-manager-bg/fg` | `#EAEEF5` | `#293F66` |
| `--role-employee-bg/fg` | `#F0F2F5` | `#3F5678` |
| `--plan-individual` | `#EAEEF5` | `#293F66` |
| `--plan-business` | `#E6ECF2` | `#002C52` |
| `--plan-enterprise` | `#001629` | `#FFFFFF` |

Role is always shown as **text + color**, never color alone.

### 8.3 Components to add

| Component | Variants | States | Notes |
|---|---|---|---|
| `PlanPickerCard` | individual, business | default, hover, selected, recommended, disabled | 24px padding, 16px radius, 2px accent border when selected |
| `PackageBadge` | individual, business, enterprise | — | 20/24px height, 11/12px bold |
| `RoleChip` | owner, hr, manager, employee | default, muted | 24px height, 12px bold; RTL-mirrored |
| `Stepper` | horizontal (web), compact (mobile) | current, complete, upcoming, error | 4–6 steps; numbers localized |
| `MemberTable` | comfortable | row hover, selected, empty, loading | 56px rows; numbers right-aligned in RTL-aware way |
| `InviteDrawer` | single, bulk, provider-sync | idle, validating, sending, partial-failure | Email chips; role select; dedupe before send |
| `SsoStatusCard` | google, microsoft | not-configured, draft, verified, error, syncing | Secret fields write-only |
| `SeatMeter` | — | normal, warning ≥90%, blocked | “12 of 10 seats” never shown; block at limit |
| `WorkspaceSwitcher` | personal, business | current, hover | Avatar + name + type badge; keyboard accessible |

### 8.4 Interaction and accessibility

- 44×44 px minimum touch targets on mobile; 40px inputs on web.
- Visible focus ring (`--focus`, 2px, 2px offset) in both themes.
- RTL: mirror steppers, chip order, table alignment; use the existing `rtlRow`/`rtlText` helpers.
- Numbers, dates, and currencies are locale-formatted; SAR/PKR explicitly labeled.
- Empty states explain the next action (“Invite your first teammate” / “Connect Google Workspace”).
- Errors are actionable and say what to do next, not just what failed.

---

## 9. Migration from the current repo

### 9.1 What blocks multi-tenancy today

- `User.role` is global and the mobile app even switches it client-side ([DashboardScreen.tsx](../../src/screens/DashboardScreen.tsx)).
- `User.managerId`, `branchId`, `employeeId`, salary and GOSI fields are workspace facts stored on the person.
- `GET /employees/:id` has no role guard and returns salary and national ID ([employees.controller.ts](../../backend/src/modules/employees/employees.controller.ts)).
- Leave requests are single-stage `PENDING` despite the enum ([leaves.service.ts](../../backend/src/modules/leaves/leaves.service.ts)).
- Duplicate fields: `reportsToId` duplicates `managerId`; `radiusMeters` duplicates `geofenceRadiusMeters`.

### 9.2 Phases

| Phase | Scope | Exit criteria |
|---|---|---|
| **0 — Design** | This document and diagrams. | Decisions D1–D5 accepted. |
| **1 — Schema** | Add `Workspace`, `Membership`, `AuthIdentity`, `Invite`, `SsoConnection`, `SsoGroupMapping`, `PayrollRun`. Backfill one `BUSINESS` workspace for Macquires. Add `workspaceId` to domain tables; composite uniques. Keep legacy columns temporarily with dual-read. | Migration runs on a copy; counts match; app still boots against default workspace. |
| **2 — Auth & guards** | Workspace-aware JWT (`workspaceId`, `membershipId`, `sv`), `/auth/discover`, `/auth/callback/:provider`, `/workspaces`, switch endpoint, invite accept. Replace `@Roles` with `@RequirePermission` + workspace-scoped guard. Entra reuse; Google adapter new. | Cross-tenant tests pass; enforced SSO blocks password; last-owner rule enforced. |
| **3 — Mobile** | Package-choice onboarding, company setup, invite status, workspace switcher, real membership role instead of the client-side RBAC switcher, personal mode hides org modules. | Two demo accounts (personal + business) complete onboarding end-to-end. |
| **4 — Admin** | Team table, role/reporting-line editing, invites, SSO settings, group mapping, seat meter, plan page. | Owner can run a 5-person company without API calls. |
| **5 — Commercial** | Billing/subscription webhooks, entitlement guards, directory sync, audit export, rate limits, retention. | Seat limits and plan gates enforced server-side. |

### 9.3 Data backfill order

```
1. Create Workspace("Macquires", BUSINESS, plan=ENTERPRISE)
2. For each User: create Membership(workspaceId, userId, role=map(User.role),
   managerId=map(User.managerId), branchId, salary fields)
3. Set ownerMembershipId to the SUPER_ADMIN membership
4. Update every AttendanceRecord / LeaveRequest / LeaveBalance / AuditLog:
   workspaceId = Macquires
5. Convert unique constraints to workspace-scoped composites
6. Stop writing legacy User columns; drop them after mobile + admin migrate
```

### 9.4 Test matrix (must exist before Phase 3)

- Cross-tenant isolation: a member of workspace A cannot read or mutate B by ID.
- Role matrix: each endpoint × each role, including owner override and HR limits.
- Last-owner protection and ownership transfer.
- Invite: expiry, single use, wrong-email rejection, seat reservation.
- SSO: enforced blocks password; wrong `hd`/`tid` rejected; JIT only when enabled.
- Role change invalidates sessions (`sv`).
- Approval policy: `MANAGER_ONLY` vs `MANAGER_THEN_HR`; no self-approval; manager absence routes to HR.
- Seat limit blocks the 11th active member on a 10-seat plan.
- Workspace switch never leaks data from the previous tenant.

---

## 10. Assumptions and open decisions

**Assumptions**

- “Individual” means a solo professional tracking their own time, leave, and documents — not a consumer social product.
- A person may hold multiple memberships; the app shows one workspace at a time.
- SAR/GOSI remains the default compliance profile, but workspace `country` allows future expansions (the current Pakistan remote work is modeled as a remote hub, not a separate jurisdiction).

**Decisions to confirm**

1. Individual feature scope and pricing — is the plan paid, freemium, or bundled?
2. One owner per workspace, or co-owners?
3. Is `MANAGER` a role, or purely derived from having direct reports? (Recommendation: role, with reporting line determining scope.)
4. Default approval policy: `MANAGER_ONLY` or `MANAGER_THEN_HR`?
5. Should owners see individual salaries, or only HR?
6. Directory sync in v1, or SSO + manual invites first?
7. Do we support Google *and* Microsoft for the same workspace (identity vs notifications), or restrict one identity provider?

---

## 11. Reading order

1. This summary (§1–§2).
2. [`context.mmd`](context.mmd) — who talks to what.
3. [`data-model.mmd`](data-model.mmd) — entities and cardinalities.
4. [`sign-in-flow.mmd`](sign-in-flow.mmd) — authentication vs authorization.
5. [`account-model.html`](account-model.html) — stakeholder visual: packages, roles, wireframes, tokens.
6. §9 before writing code — migration and test gates.
