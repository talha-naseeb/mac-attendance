# MacqHR — Detailed Test Plan (Phases 6–11)

**Version**: 1.0 (approved at G0)
**Companion to**: [PRD](./README.md)
**Owner / approver**: Talha
**Date**: 31 October 2026
**Status**: Approved at G0 on 31 October 2026. Test cases are unchanged.

---

## 0. How to read this plan

- **90 cases** across 10 areas. Each row is executable by a person or an automated suite.
- **Mode**: `Auto` = automated at API/unit/component layer; `Manual` = executed on staging and a physical device; `Both` = automated coverage plus a manual confirmation.
- **Priority**: `P0` blocks the phase gate; `P1` required for release; `P2` should pass, may be waived in writing.
- **Phase**: the phase whose gate owns the case.
- Test IDs are stable. When a case changes, add a suffix (`-a`) rather than reusing the ID.

### 0.1 Environments

| Environment | Purpose | Data |
|---|---|---|
| Local | Developer verification | Seeded demo data |
| Staging | Gate execution | Synthetic employees, sandbox integrations |
| Production candidate | Final smoke | Production-like, no demo accounts |

### 0.2 Device/browser matrix

- iPhone with Face ID, iOS 17+ (current test device: local simulator plus at least one physical iPhone).
- Android with fingerprint, Android 12+.
- Admin: Chrome and Safari at 1280, 1024, and 768 widths.
- Both light and dark themes; English and Arabic.

### 0.3 Standard fixtures

| Fixture | Purpose |
|---|---|
| `emp.employee@macqhr.test` | Employee, Riyadh office, annual balance 30 |
| `emp.manager@macqhr.test` | Manager with three direct reports |
| `emp.manager-empty@macqhr.test` | Manager with no reports |
| `emp.hr@macqhr.test` | HR Admin with console access |
| `emp.super@macqhr.test` | Super Admin |
| `emp.remote.pk@macqhr.test` | Pakistan remote hub, remote eligible |
| `emp.inactive@macqhr.test` | Deactivated employee |
| `emp.zero@macqhr.test` | Employee with zero annual balance |
| `saudi.under@`, `saudi.cap@`, `saudi.over@` | GOSI wage-cap fixtures |
| `nonsaudi@` | Non-Saudi GOSI fixture |

Passwords are generated per environment; default demo credentials are never used on staging or production.

---

## 1. Auth & session (AUTH) — 10 cases

| ID | Pri | Mode | Phase | Given → When | Then |
|---|---|---|---|---|---|
| AUTH-01 | P0 | Both | 7 | Active employee credentials → submit sign-in | Session is created with the server-issued role; dashboard renders that role only |
| AUTH-02 | P0 | Auto | 7 | Wrong password → submit repeatedly past the limit | Generic "invalid credentials" message; after N attempts the account/IP is throttled or locked; no email enumeration |
| AUTH-03 | P0 | Auto | 7 | Deactivated account → submit valid credentials | Sign-in is refused with a support-oriented message; no token is issued |
| AUTH-04 | P0 | Auto | 7 | Access token near expiry → make an API call | A valid refresh rotates the session transparently; the user is not interrupted mid-task |
| AUTH-05 | P0 | Auto | 7 | Refresh token reused after rotation or after role change/deactivation | Reuse is rejected, the session family is revoked, and the user must sign in again |
| AUTH-06 | P0 | Both | 7 | Signed-in user → tap Logout | Server session is revoked; local secure storage is cleared; protected APIs fail immediately |
| AUTH-07 | P0 | Both | 6 | Employee signs in → inspect dashboard and drawer | No role switcher or client-side role mutation exists; Manager/HR actions are absent |
| AUTH-08 | P0 | Auto | 6 | Employee requests another employee's profile | Own profile returns full data; another employee returns a limited directory view without salary, national ID, or Iqama |
| AUTH-09 | P0 | Auto | 7 | Employee or Manager token calls HR-only endpoints (employees admin, attendance all, payroll summary, leave admin, audit) | Every call returns 403; UI never exposes the action |
| AUTH-10 | P0 | Both | 7 | New employee with a temporary credential → first sign-in | Password change is mandatory before any other action; the temporary credential stops working after the change |

**Gate evidence**: automated API report, one manual sign-in/sign-out recording, screenshots of the dashboard for an Employee and an HR session.

---

## 2. Employee lifecycle & organization (EMP) — 10 cases

| ID | Pri | Mode | Phase | Given → When | Then |
|---|---|---|---|---|---|
| EMP-01 | P0 | Both | 7 | HR opens Create Employee → submits valid identity, employment, salary, branch, manager, role, remote flag | Employee is created, appears in the directory, can sign in after credential setup, and has seeded balances |
| EMP-02 | P0 | Auto | 7 | Create with an existing email or employee ID | Request is rejected with a field-specific conflict; no partial record is written |
| EMP-03 | P0 | Both | 7 | New employee assigned to Manager A → employee submits leave | Request appears in Manager A's queue and nowhere else; Manager B cannot see it |
| EMP-04 | P0 | Both | 7 | HR transfers an employee from Riyadh to Jeddah with an effective date | Subsequent office punches are validated against Jeddah; history remains attributed to Riyadh |
| EMP-05 | P0 | Auto | 7 | HR grants or removes remote eligibility | Remote punch is allowed or rejected immediately on the next punch; grantor and timestamp are audited |
| EMP-06 | P0 | Auto | 7 | HR promotes an Employee to Manager | Existing sessions are revoked; next sign-in carries Manager capability; approval queue reflects the new hierarchy |
| EMP-07 | P0 | Both | 7 | HR deactivates an employee | Sign-in blocked, tokens revoked, removed from directory/Who's Off/approval queues; historical records remain |
| EMP-08 | P0 | Auto | 7 | Attempt to deactivate or demote the last active Super Admin | Action is refused with a clear reason; the system always retains one active Super Admin |
| EMP-09 | P0 | Auto | 7 | Set an employee's manager to themselves or to a descendant | Validation rejects the cycle/self-link; the hierarchy remains acyclic |
| EMP-10 | P1 | Both | 7 | HR resets a password → employee signs in with the temporary credential | Reset is audited; temporary credential requires change; old sessions are revoked |

**Gate evidence**: created employee screenshot, manager queue comparison, transfer audit entry, deactivation checks.

---

## 3. Attendance integrity (ATT) — 15 cases

| ID | Pri | Mode | Phase | Given → When | Then |
|---|---|---|---|---|---|
| ATT-01 | P0 | Both | 8 | Office employee inside the branch geofence with valid evidence → check in | Punch accepted, marked `OFFICE`, distance recorded, day status updated |
| ATT-02 | P0 | Both | 8 | Office employee outside the geofence → check in | Rejected with distance and radius; rejection is audited; no attendance record is created |
| ATT-03 | P0 | Both | 8 | Remote-eligible employee in Pakistan outside the Riyadh fence → remote check in | Accepted, marked `REMOTE`, still subject to integrity, accuracy, and drift checks |
| ATT-04 | P0 | Auto | 8 | Remote-ineligible employee → remote check in | Rejected with a clear permission message; audited |
| ATT-05 | P0 | Both | 8 | Device reports a mock/fake GPS provider → punch | Rejected before any record is written; audited as a security violation |
| ATT-06 | P0 | Auto | 8 | GPS accuracy 51 m, then 26 m, then 10 m → punch | `>50 m` rejected; `26–50 m` flagged per policy; `≤25 m` accepted as high confidence |
| ATT-07 | P0 | Auto | 8 | Device clock drifts 6 minutes from server time → punch | Rejected with the drift amount; server time remains authoritative |
| ATT-08 | P0 | Both | 8 | Rooted/jailbroken device or failed integrity attestation → office punch | Rejected or explicitly flagged per approved policy; never silently accepted as verified |
| ATT-09 | P0 | Both | 8 | Biometric verification absent or failed → punch | Rejected with an actionable message; a client-set boolean alone cannot satisfy the rule |
| ATT-10 | P0 | Auto | 8 | Already checked in → second check-in; or no check-in → check-out; or two concurrent check-ins | Second check-in and orphan check-out are rejected; exactly one concurrent punch succeeds |
| ATT-11 | P0 | Both | 8 | Punch at 00:30 Asia/Riyadh and 00:30 Asia/Karachi on the same UTC day | Each appears on the correct local day in mobile history, team view, Who's Off, and exports |
| ATT-12 | P0 | Both | 8 | Offline punch queued → reconnect; separately, tamper with a queued payload | Valid punch syncs exactly once with durable evidence; tampered or stale punch is rejected and remains visible as failed, never silently dropped |
| ATT-13 | P0 | Both | 8 | Employee starts and ends a break within a shift | Break minutes persist; net working minutes exclude the break; summary matches the punch timeline |
| ATT-14 | P0 | Both | 8 | Device attestation token is missing, expired, or for another app | Office punch is rejected or flagged according to policy; failure reason is auditable and shown to the employee |
| ATT-15 | P0 | Both | 8 | Employee requests a correction for a missed punch → manager/HR approves | Original record is preserved; an adjustment is created; day status and minutes update; request and decision are audited |

**Gate evidence**: device recordings for mock/root/biometric failures, screenshots of correction before/after, timezone fixtures, offline sync log.

---

## 4. Leave & approvals (LV) — 15 cases

| ID | Pri | Mode | Phase | Given → When | Then |
|---|---|---|---|---|---|
| LV-01 | P0 | Both | 9 | Employee submits a valid annual request within balance | Status is `PENDING_MANAGER`; manager is notified; employee sees request details and next approver |
| LV-02 | P0 | Auto | 9 | Request exceeds remaining balance | Rejected with requested vs available days; no request is created |
| LV-03 | P0 | Auto | 9 | End date precedes start, zero days, or dates outside employment | Rejected with a field-level message; no partial write |
| LV-04 | P0 | Auto | 9 | Request overlaps an existing pending or approved request | Rejected or merged per policy, with the conflicting dates shown |
| LV-05 | P0 | Auto | 9 | Range includes weekend and a public holiday | Day count follows the holiday calendar and weekly schedule; the breakdown is visible before submit |
| LV-06 | P0 | Both | 9 | Manager opens a pending request → approves | Status becomes `PENDING_HR`, stage history is recorded, employee and HR are notified, balance is not yet deducted |
| LV-07 | P0 | Both | 9 | HR approves the stage-2 request; then double-tap/retry the approval | Status becomes `APPROVED`; balance is deducted exactly once; ledger entry matches the displayed remaining; duplicate requests are idempotent |
| LV-08 | P0 | Both | 9 | Manager rejects with a comment | Status `REJECTED`; no deduction; employee notified with the comment; audit recorded |
| LV-09 | P0 | Both | 9 | HR rejects at stage 2 | Status `REJECTED`; no deduction; prior stage history preserved; employee notified |
| LV-10 | P0 | Auto | 9 | Manager submits their own leave, or an employee has no active manager | Self-approval is blocked; the request routes to HR; the routing reason is visible |
| LV-11 | P0 | Both | 9 | Employee cancels pending leave; separately, cancels approved leave before start | Pending cancel closes with no balance movement; approved cancel restores balance exactly once; approvers are notified |
| LV-12 | P1 | Auto | 9 | Employee requests a half day | Days count is `0.5`; balance math and ledger handle fractions or the configured minimum unit correctly |
| LV-13 | P1 | Both | 9 | Employee attaches a medical certificate → approver opens the request | File is stored securely, type/size validated, visible to authorized approvers only, and referenced in the audit trail |
| LV-14 | P0 | Both | 9 | Employee opens the calendar and navigates to next month, next year, and December → January | Navigation works; the correct month renders; selecting a range produces the correct ISO dates and day count |
| LV-15 | P0 | Both | 9 | Employee selects every supported type, including Emergency, Sick on file, Remote Work, Unpaid | Each maps to a distinct backend type; Emergency is not silently stored as Unpaid; reports group them correctly |

**Gate evidence**: stage timeline screenshot, ledger reconciliation query result, cancel before/after balances, next-year request, full type matrix.

---

## 5. Admin console (ADM) — 10 cases

| ID | Pri | Mode | Phase | Given → When | Then |
|---|---|---|---|---|---|
| ADM-01 | P0 | Both | 10 | Employee credentials on the admin login, then HR credentials | Employee is refused; HR signs in; `canAccessWebAdmin` is enforced server-side |
| ADM-02 | P0 | Auto | 10 | Dashboard loads with known fixtures | Headcount, checked-in count, pending approvals, and payroll totals match the database |
| ADM-03 | P0 | Both | 10 | HR creates and edits a branch with invalid and valid coordinates/radius/Wi-Fi | Invalid values are rejected inline; valid values persist and affect new punches only |
| ADM-04 | P0 | Both | 10 | HR searches, filters, sorts, and paginates employees | Results are accurate, empty state is clear, and filters compose correctly |
| ADM-05 | P0 | Both | 10 | HR edits role, manager, branch, remote flag, and salary with an effective date | Changes persist, are audited, and affect approvals/attendance/session as specified |
| ADM-06 | P0 | Both | 10 | HR approves/rejects a stage-2 leave with a comment | Timeline updates, employee is notified, balance moves only on approval, action is audited |
| ADM-07 | P0 | Both | 10 | HR opens a correction request and approves it | Attendance day updates; original punch remains; audit shows actor and before/after |
| ADM-08 | P0 | Both | 10 | HR selects a payroll period and exports WPS | Summary reconciles; export validates IDs/totals; invalid fixtures block export with a report |
| ADM-09 | P1 | Both | 10 | HR opens the audit viewer and filters by actor/action/date | Read-only results are accurate; no edit/delete action exists |
| ADM-10 | P0 | Both | 10 | Session expires during an edit, and the browser is resized to 768 px | User is returned to login without silent data loss; warning is shown; layout remains usable |

**Gate evidence**: role-refusal screenshot, reconciliation table, branch edit before/after, export sample, 401 behavior.

---

## 6. Integrations (INT) — 6 cases

| ID | Pri | Mode | Phase | Given → When | Then |
|---|---|---|---|---|---|
| INT-01 | P0 | Both | 7/11 | SSO enabled with a test Entra tenant; then disabled by configuration | Enabled: sign-in completes and links the account. Disabled: the button is hidden, and no "not configured" dead end ships |
| INT-02 | P0 | Both | 11 | Leave submitted with Teams enabled; first dispatch fails then retries | Exactly one Adaptive Card is delivered; message ID is stored; retry does not duplicate |
| INT-03 | P0 | Both | 11 | Leave approved, then cancelled or dates changed | One Outlook OOO event is created; cancellation removes it; a date change updates the same event |
| INT-04 | P0 | Both | 10 | Notification created, app restarted, second device signs in | Notification persists, read state is consistent, and the deep link opens the correct request |
| INT-05 | P1 | Both | 10 | User enables push and receives an approval decision | Push is delivered per preference; disabled categories send nothing; token refresh is handled |
| INT-06 | P0 | Auto | 11 | Teams/Outlook sandbox unavailable during leave submission | Core leave transaction succeeds; integration failure is queued/visible; no duplicate side effects on recovery |

**Gate evidence**: sandbox card/event screenshots, retry log, notification across two sessions, failure injection result.

---

## 7. Payroll & compliance (PAY) — 6 cases

| ID | Pri | Mode | Phase | Given → When | Then |
|---|---|---|---|---|---|
| PAY-01 | P0 | Auto | 11 | Employee with basic, housing, transport → generate payslip | Earnings, GOSI deduction, and net match the fixture to the halala; employer contribution is shown separately |
| PAY-02 | P0 | Auto | 11 | Saudi fixtures below, at, and above the wage cap → calculate GOSI | 9.75% employee / 11.75% employer within the cap; capped correctly above it |
| PAY-03 | P0 | Auto | 11 | Non-Saudi fixture → calculate GOSI | 0% employee / 2% employer hazards; net matches |
| PAY-04 | P0 | Both | 11 | Employee has approved unpaid leave in the period → run payroll | Deduction equals the configured daily rate × unpaid days; no double deduction; payslip explains it |
| PAY-05 | P0 | Both | 11 | Payroll run prepared → reviewed → locked; then edit a salary | Locked run is immutable; later salary change affects only future runs; audited |
| PAY-06 | P0 | Both | 11 | Export WPS for a valid period and a fixture with a missing ID/IBAN | Valid file totals equal payslips; invalid rows block export with a precise error report; encoding/delimiter are correct |

**Gate evidence**: calculation fixture table, run lock screenshot, WPS file validation output.

---

## 8. Mobile UX, i18n & accessibility (UX) — 8 cases

| ID | Pri | Mode | Phase | Given → When | Then |
|---|---|---|---|---|---|
| UX-01 | P0 | Both | 9 | Leave submitted successfully | A confirmation shows type, dates, days, and next approver; the modal does not just disappear |
| UX-02 | P1 | Both | 9 | Invalid dates, empty reason, or over-balance request | Inline, specific errors appear next to the field; submit is disabled or safely rejected |
| UX-03 | P1 | Both | 10 | Force slow network, empty data, and server error on dashboard/approvals/directory | Each surface has a distinct loading, empty, and error state with a retry action |
| UX-04 | P1 | Both | 8 | Go offline, queue a punch, reconnect, then force a sync failure | Offline banner and pending/synced/failed states are clear; no silent loss; retry is user-controlled |
| UX-05 | P0 | Manual | All | Every changed screen in light and dark mode | No unreadable text, invisible border, or hardcoded color; tokens drive both themes |
| UX-06 | P0 | Manual | All | Every changed screen in Arabic RTL | Layout mirrors correctly; no clipped text; dates/numbers localized; icons meaningful in RTL |
| UX-07 | P0 | Manual | 10 | Screen reader and keyboard/small-screen pass on core flows | Labels, roles, focus order, touch targets, and contrast meet WCAG 2.1 AA |
| UX-08 | P1 | Manual | All | Navigate the app normally, then trigger errors | No surprise redirect or auto-close; every transition is user-initiated; back behavior is predictable |

**Gate evidence**: screenshot pairs (light/dark, EN/AR), accessibility scan, offline recording, success/error state captures.

---

## 9. Operations & security (OPS) — 5 cases

| ID | Pri | Mode | Phase | Given → When | Then |
|---|---|---|---|---|---|
| OPS-01 | P0 | Auto | 6 | Open a PR that breaks mobile, backend, or admin verification | CI runs `verify:all` and blocks merge; a green PR shows all three results |
| OPS-02 | P0 | Auto | 6 | Create a database from zero; then upgrade a copy of the current schema | Migrations complete without manual edits; counts and constraints match; app boots |
| OPS-03 | P0 | Manual | 11 | Restore the latest backup into an isolated database | Data matches the backup point; documented restore time is within the target |
| OPS-04 | P0 | Auto | 6 | Start production mode without required secrets; send a cross-origin request | Startup fails fast with a clear message; CORS allowlist and security headers are enforced; no fallback secret |
| OPS-05 | P0 | Both | 11 | Generate traffic, force an error, inspect logs and health endpoint | Logs are structured with request IDs, contain no tokens/PII, and health reflects dependency status |

**Gate evidence**: CI run link, migration log, restore drill record, startup failure output, sample logs.

---

## 10. Release (REL) — 5 cases

| ID | Pri | Mode | Phase | Given → When | Then |
|---|---|---|---|---|---|
| REL-01 | P0 | Manual | 11 | Install the signed release build on a clean iOS and Android device | App installs, signs in, punches, requests leave, and opens the admin console (web) without developer tooling |
| REL-02 | P0 | Manual | 11 | Inspect network traffic on the release build | TLS is enforced and certificate pinning rejects an untrusted certificate; no cleartext requests |
| REL-03 | P0 | Manual | 11 | Upgrade over the previous build with an active session and queued data | Session and queued data survive or fail safely with a clear re-auth; no crash loop |
| REL-04 | P0 | Manual | 11 | Inspect a release build for demo artifacts | No role switcher, simulation presets, prefilled credentials, shared default password, or debug menu |
| REL-05 | P0 | Both | 11 | Measure cold start, p95 API latency, and crash-free sessions on staging | Metrics meet the approved targets; deviations are documented and accepted before release |

**Gate evidence**: clean-install recording, pinning test output, upgrade recording, release-build inspection, metrics dashboard.

---

## 11. Manual gate checklist by phase

Use this as the executed checklist attached to `docs/qa/gates/phase-<N>.md`.

| Gate | Must execute manually | Automated evidence required |
|---|---|---|
| **G1 / Phase 6** | AUTH-07, UX-05, UX-06, REL-04 (debug build inspection), OPS-01 | AUTH-08, AUTH-09, EMP-02, OPS-02, OPS-04 |
| **G2 / Phase 7** | AUTH-01, AUTH-03, AUTH-06, AUTH-10, EMP-01, EMP-03, EMP-07, INT-01 | AUTH-02, AUTH-04, AUTH-05, AUTH-09, EMP-02, EMP-04, EMP-05, EMP-06, EMP-08, EMP-09 |
| **G3 / Phase 8** | ATT-01, ATT-02, ATT-03, ATT-05, ATT-08, ATT-09, ATT-11, ATT-12, ATT-15 | ATT-04, ATT-06, ATT-07, ATT-10, ATT-13, ATT-14 |
| **G4 / Phase 9** | LV-01, LV-06, LV-07, LV-08, LV-11, LV-13, LV-14, LV-15, UX-01 | LV-02, LV-03, LV-04, LV-05, LV-09, LV-10, LV-12 |
| **G5 / Phase 10** | ADM-01, ADM-03, ADM-05, ADM-07, ADM-08, ADM-10, INT-04, UX-03 | ADM-02, ADM-04, ADM-06, ADM-09, INT-05 |
| **G6 / Phase 11** | INT-02, INT-03, PAY-01, PAY-04, PAY-05, PAY-06, OPS-03, OPS-05, REL-01–REL-05 | INT-06, PAY-02, PAY-03 |

A gate is not complete until every `P0` case for that phase passes and every `P1` failure has your written acceptance.

---

## 12. Regression suite

Run on every gate to protect existing behavior:

- Existing mobile `TC-1.x`–`TC-10.x` and `TC-P1.x`–`TC-P5.x` (48 tests).
- Existing backend Jest suites (13 tests).
- Sign-in → dashboard → punch → leave → approve → payslip smoke path.
- Light/dark and EN/AR spot check on dashboard, clock-in, leave modal, approvals.
- Admin login → branches → leave decision → payroll export.
- No new console errors on startup for mobile web and admin.

---

## 13. Defect log template

| Field | Content |
|---|---|
| ID | `BUG-<phase>-<seq>` |
| Severity | S1 / S2 / S3 / S4 |
| Test case | e.g. ATT-11 |
| Environment / build | staging, commit SHA, device |
| Steps | Numbered reproduction |
| Expected / Actual | Concrete difference |
| Evidence | Screenshot, recording, log excerpt |
| Owner / status | Assignee, open/fixed/verified |
| Waiver | Only for S3/S4, signed by Talha |

---

## 14. Execution record template

```markdown
# Phase <N> — Test Execution

- Commit: <SHA>
- Environment: staging
- Build: <identifier>
- Executed by: <name>
- Date: <ISO 8601>

| Test ID | Result | Evidence | Defect |
|---|---|---|---|
| AUTH-01 | PASS | screenshot-01.png | — |
| ATT-05 | PASS | video-att05.mp4 | — |
| ... | ... | ... | ... |

Summary: <passed>/<total> automated, <passed>/<total> manual.
Open defects: <list or none>.
```
