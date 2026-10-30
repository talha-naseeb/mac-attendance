# MacqHR — Design Spec for Packages, Roles & SSO

Companion to [`README.md`](README.md). This file turns the account model into reusable tokens and component contracts for the mobile app and the web admin.

**Rule:** new components reference semantic tokens only. Raw hex stays in the primitive layer.

---

## 1. Token layers

```
Primitive (brand values)
  --macq-oxford #001629
  --macq-prussian #002C52
  --macq-indigo #293F66
  --macq-bdazzled #3F5678
  --macq-davys #555555
  --macq-spanish #999999
  --macq-orange #FE5800
        ↓
Semantic (purpose)
  --surface, --surface-raised, --border, --text-primary,
  --text-secondary, --text-muted, --accent, --accent-fg
        ↓
Component (per surface)
  --plan-card-*, --role-chip-*, --sso-status-*, --seat-meter-*
```

The mobile app extends `ThemeColors` in [`src/theme/colors.ts`](../../src/theme/colors.ts); the admin extends the `macq` palette in [`web-admin/tailwind.config.js`](../../web-admin/tailwind.config.js). Both must add the same semantic names so a screen can be ported without re-mapping colors.

---

## 2. CSS variables

```css
:root {
  /* Primitive */
  --macq-oxford: #001629;
  --macq-prussian: #002c52;
  --macq-indigo: #293f66;
  --macq-bdazzled: #3f5678;
  --macq-davys: #555555;
  --macq-spanish: #999999;
  --macq-orange: #fe5800;

  /* Semantic — light */
  --surface: #ffffff;
  --surface-raised: #f8fafc;
  --surface-subtle: #ebf0f5;
  --border: #dce3ec;
  --border-strong: #c3cedb;
  --text-primary: var(--macq-oxford);
  --text-secondary: var(--macq-davys);
  --text-muted: #6b7a8c;
  --accent: var(--macq-orange);
  --accent-fg: var(--macq-oxford); /* 5.75:1 on orange */
  --accent-soft: #fff0e8;
  --focus: var(--macq-orange);

  --success: #137333;
  --success-bg: #e6f4ea;
  --warning: #8a4b00;
  --warning-bg: #fff0e8;
  --danger: #c5221f;
  --danger-bg: #fce8e6;

  /* Roles */
  --role-owner-bg: #ffe9dc;
  --role-owner-fg: #8a2d00;
  --role-hr-bg: #e6ecf2;
  --role-hr-fg: var(--macq-prussian);
  --role-manager-bg: #eaeef5;
  --role-manager-fg: var(--macq-indigo);
  --role-employee-bg: #f0f2f5;
  --role-employee-fg: var(--macq-bdazzled);

  /* Plans */
  --plan-individual-bg: #eaeef5;
  --plan-individual-fg: var(--macq-indigo);
  --plan-business-bg: #e6ecf2;
  --plan-business-fg: var(--macq-prussian);
  --plan-enterprise-bg: var(--macq-oxford);
  --plan-enterprise-fg: #ffffff;

  /* Component */
  --plan-card-bg: var(--surface);
  --plan-card-border: var(--border);
  --plan-card-selected-border: var(--accent);
  --plan-card-selected-ring: 0 0 0 3px rgb(254 88 0 / 0.18);
  --role-chip-radius: 999px;
  --seat-meter-ok: var(--macq-prussian);
  --seat-meter-warn: var(--warning);
  --seat-meter-blocked: var(--danger);
}

[data-theme="dark"] {
  --surface: #0e1c2e;
  --surface-raised: #13263d;
  --surface-subtle: #13263d;
  --border: #243b57;
  --border-strong: #35506f;
  --text-primary: #f3f7fb;
  --text-secondary: #c7d3e1;
  --text-muted: #93a4b8;
  --accent: var(--macq-orange);
  --accent-fg: var(--macq-oxford);
  --accent-soft: #37200f;
  --focus: #ff8547;

  --success: #6ee7b7;
  --success-bg: #064e3b;
  --warning: #ffb68c;
  --warning-bg: #3a2218;
  --danger: #fca5a5;
  --danger-bg: #450a0a;

  --role-owner-bg: #3a2113;
  --role-owner-fg: #ffb68c;
  --role-hr-bg: #132b47;
  --role-hr-fg: #b9d4f2;
  --role-manager-bg: #1a2c4a;
  --role-manager-fg: #c3d2ea;
  --role-employee-bg: #1b2838;
  --role-employee-fg: #afc0d4;

  --plan-individual-bg: #1a2c4a;
  --plan-individual-fg: #c3d2ea;
  --plan-business-bg: #132b47;
  --plan-business-fg: #b9d4f2;
  --plan-enterprise-bg: #f3f7fb;
  --plan-enterprise-fg: #001629;

  --plan-card-bg: var(--surface);
  --plan-card-border: var(--border);
}
```

**Contrast:** white on `#FE5800` is ≈3.18:1 and fails WCAG AA for body text. Use Oxford Blue on orange, or orange only for large bold text, icons, borders, and focus rings.

---

## 3. React Native theme extension

```ts
// Extend ThemeColors in src/theme/colors.ts
export interface ThemeColors {
  // ...existing tokens
  roleOwnerBg: string;
  roleOwnerText: string;
  roleHrBg: string;
  roleHrText: string;
  roleManagerBg: string;
  roleManagerText: string;
  roleEmployeeBg: string;
  roleEmployeeText: string;
  planIndividualBg: string;
  planIndividualText: string;
  planBusinessBg: string;
  planBusinessText: string;
  seatWarning: string;
  seatBlocked: string;
}
```

Light mapping follows §2. Dark mapping uses the `[data-theme="dark"]` values. Do not import raw hex into screens; read from `colors`.

---

## 4. Tailwind extension (admin)

```js
// web-admin/tailwind.config.js
colors: {
  macq: { /* existing */ },
  surface: 'var(--surface)',
  'surface-raised': 'var(--surface-raised)',
  'surface-subtle': 'var(--surface-subtle)',
  line: 'var(--border)',
  ink: {
    DEFAULT: 'var(--text-primary)',
    secondary: 'var(--text-secondary)',
    muted: 'var(--text-muted)',
  },
  accent: {
    DEFAULT: 'var(--accent)',
    fg: 'var(--accent-fg)',
    soft: 'var(--accent-soft)',
  },
  role: {
    owner: 'var(--role-owner-fg)',
    hr: 'var(--role-hr-fg)',
    manager: 'var(--role-manager-fg)',
    employee: 'var(--role-employee-fg)',
  },
}
```

---

## 5. Component contracts

### 5.1 PlanPickerCard

| Property | Default | Hover | Selected | Recommended | Disabled |
|---|---|---|---|---|---|
| Background | `--plan-card-bg` | `--surface-raised` | `--plan-card-bg` | `--plan-card-bg` | `--surface-subtle` |
| Border | 1px `--plan-card-border` | 1px `--border-strong` | 2px `--accent` | 1px `--border` | 1px `--border` |
| Ring | none | none | 3px accent 18% | none | none |
| Text | `--text-primary` | same | same | same | `--text-muted` |
| Cursor | pointer | pointer | pointer | pointer | not-allowed |

Anatomy: icon 40×40 → title 18/700 → one-line value proposition → 3 feature bullets → footer price/CTA. Padding 24, radius 16, gap 12. Mobile: full width, stacked.

### 5.2 RoleChip

- Height 24, padding 4×10, radius 999, text 12/700.
- Colors per `--role-*-bg/fg`; never color-only — always include the role label.
- Optional leading dot 6×6 for status; `aria-label="Role: HR Admin"`.
- RTL: `flexDirection: row-reverse` via `rtlRow`.

### 5.3 Stepper

- Web: horizontal, 4–6 steps, 32px circles, connector 2px `--border`, current `--accent`, complete `--success`.
- Mobile: compact “Step 3 of 5” + progress bar 4px.
- Error step: `--danger` circle and message under the label.

### 5.4 MemberTable

| Element | Spec |
|---|---|
| Row height | 56px |
| Header | 12/700 uppercase, `--surface-subtle` |
| Cell padding | 12×16 |
| Role column | `RoleChip` |
| Reports-to | member avatar + name, truncated |
| Status | dot + label (`Active`, `Invited`, `Suspended`) |
| Actions | overflow menu, 40×40 target |
| Empty | illustration + “Invite your first teammate” |
| Loading | 5 skeleton rows matching row height |

### 5.5 InviteDrawer

- Width 480 (desktop), full sheet on mobile; radius 16 top.
- Email input tokenizes on comma/Enter; duplicates rejected inline.
- Role select defaults to `EMPLOYEE`; manager select is optional and filtered to `MANAGER`/`HR_ADMIN`.
- Footer: “Send N invites” primary; disabled until at least one valid email.
- Partial failure: keep failed rows with an error icon and “Retry failed”.

### 5.6 SsoStatusCard

| State | Badge | Primary action |
|---|---|---|
| Not configured | neutral “Not configured” | “Connect Google / Microsoft” |
| Draft | warning “Draft” | “Finish setup” |
| Verified | success “Connected” | “Manage” |
| Error | danger “Error” | “View details” |
| Syncing | info “Syncing…” | disabled |

Show domain/tenant, enforcement switch, auto-provision switch, last sync, and group-mapping link. Secrets are write-only and masked.

### 5.7 SeatMeter

- Track 8px, radius 999, fill `--seat-meter-ok`; ≥90% warning; at limit danger and disabled invite CTA.
- Label: “38 of 50 seats used”; never render more used than purchased.

### 5.8 WorkspaceSwitcher

- Trigger: avatar 32 + workspace name (14/700) + type badge.
- Menu: personal and business groups, current check, “Create a business workspace”, “Manage workspace” for owners.
- Keyboard: arrow keys, Enter to switch, Esc to close.

---

## 6. Copy (EN / AR)

| Key | English | العربية |
|---|---|---|
| package.question | How will you use MacqHR? | كيف ستستخدم MacqHR؟ |
| package.individual | For myself | للاستخدام الشخصي |
| package.business | For my company | لشركتي |
| company.profile | Tell us about your company | أخبرنا عن شركتك |
| company.auth | How does your team sign in? | كيف يسجّل فريقك الدخول؟ |
| company.invite | Who’s on your team? | من هم أعضاء فريقك؟ |
| team.invite | Invite teammates | دعوة أعضاء الفريق |
| team.role | Role | الدور |
| team.reportsTo | Reports to | يتبع |
| team.seats | Seat usage | استخدام المقاعد |
| sso.connectGoogle | Connect Google Workspace | ربط Google Workspace |
| sso.connectMicrosoft | Connect Microsoft 365 | ربط Microsoft 365 |
| sso.enforced | Require SSO for this domain | فرض تسجيل الدخول عبر SSO لهذا النطاق |
| sso.autoProvision | Create accounts on first sign-in | إنشاء الحسابات عند أول تسجيل دخول |
| state.connected | Connected | متصل |
| state.notConfigured | Not configured | غير مُهيّأ |
| state.invited | Invited | تمت الدعوة |

Copy rules: describe the outcome, not the mechanism (“Approve leave for your team”, not “RBAC permission”). Errors state the next action. Avoid “owner” in employee-facing copy; use “workspace admin” where appropriate.

---

## 7. Accessibility checklist

- [ ] Text contrast ≥4.5:1; large text ≥3:1; focus ring ≥3:1 against adjacent colors.
- [ ] Role and plan meaning conveyed by text, not color alone.
- [ ] 44×44 px targets on mobile; 40px controls on web.
- [ ] Inputs have visible labels; errors linked with `aria-describedby`.
- [ ] Dialogs trap focus and restore it on close.
- [ ] RTL mirrors layout through logical properties / `rtlRow`, not hardcoded left/right.
- [ ] Numbers, dates, and currency localized; Arabic-Indic digits only if the locale expects them.
- [ ] Tables use `<th scope>`; row actions have accessible names (“Actions for Sara Alotaibi”).
- [ ] Reduced motion respected for skeleton shimmer and stepper transitions.
- [ ] Empty, loading, error, offline, and permission-denied states designed for every new screen.
