import React, { useCallback, useEffect, useState } from 'react';
import {
  Building2,
  CheckCircle2,
  Copy,
  KeyRound,
  Layers,
  MailPlus,
  Plus,
  RefreshCw,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { AdminWorkspaceSummary, UserSession } from '../api/adminSession';
import { ApiError } from '../api/client';
import {
  acceptWorkspaceInvite,
  convertPersonalWorkspaceToBusiness,
  createWorkspace,
  createWorkspaceInvite,
  fetchCurrentWorkspace,
  fetchMyWorkspaces,
  fetchWorkspaceInvites,
  fetchWorkspaceMembers,
  fetchWorkspaceSso,
  formatWorkspaceRoleLabel,
  revokeWorkspaceInvite,
  switchAdminWorkspace,
  updateCurrentWorkspace,
  updateWorkspaceMember,
  upsertWorkspaceSso,
  upsertWorkspaceSsoGroupMappings,
  WorkspaceInviteRecord,
  WorkspaceListItem,
  WorkspaceMemberRecord,
  WorkspaceMemberRole,
  WorkspaceMemberStatus,
  WorkspaceSsoConfigResponse,
} from '../api/workspacesApi';

interface WorkspacesViewProps {
  isArabic: boolean;
  session: UserSession;
  onSessionChanged: (nextSession: UserSession) => void;
}

type WorkspaceSubTab = 'overview' | 'members' | 'invites' | 'sso';

const PLANS: AdminWorkspaceSummary['planCode'][] = [
  'INDIVIDUAL_FREE',
  'INDIVIDUAL_PRO',
  'BUSINESS_STARTER',
  'BUSINESS_GROWTH',
  'ENTERPRISE',
];

const APPROVAL_POLICIES: NonNullable<AdminWorkspaceSummary['leaveApprovalPolicy']>[] = [
  'MANAGER_ONLY',
  'MANAGER_THEN_HR',
  'HR_ONLY',
];

export const WorkspacesView: React.FC<WorkspacesViewProps> = ({
  isArabic,
  session,
  onSessionChanged,
}) => {
  const [subTab, setSubTab] = useState<WorkspaceSubTab>('overview');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [workspaces, setWorkspaces] = useState<WorkspaceListItem[]>([]);
  const [current, setCurrent] = useState<WorkspaceListItem | null>(null);
  const [members, setMembers] = useState<WorkspaceMemberRecord[]>([]);
  const [invites, setInvites] = useState<WorkspaceInviteRecord[]>([]);
  const [ssoConfig, setSsoConfig] = useState<WorkspaceSsoConfigResponse | null>(null);

  // Settings form
  const [wsName, setWsName] = useState('');
  const [wsNameAr, setWsNameAr] = useState('');
  const [wsCountry, setWsCountry] = useState('SA');
  const [wsTimezone, setWsTimezone] = useState('Asia/Riyadh');
  const [wsCurrency, setWsCurrency] = useState('SAR');
  const [wsPolicy, setWsPolicy] =
    useState<NonNullable<AdminWorkspaceSummary['leaveApprovalPolicy']>>('MANAGER_THEN_HR');
  const [wsPlan, setWsPlan] = useState<AdminWorkspaceSummary['planCode']>('ENTERPRISE');
  const [wsSeats, setWsSeats] = useState('250');

  // Create workspace form
  const [newWsType, setNewWsType] = useState<'BUSINESS' | 'PERSONAL'>('BUSINESS');
  const [newWsName, setNewWsName] = useState('');
  const [newWsPlan, setNewWsPlan] = useState<AdminWorkspaceSummary['planCode']>('BUSINESS_STARTER');

  // Invite form
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<WorkspaceMemberRole>('EMPLOYEE');
  const [inviteTitle, setInviteTitle] = useState('');
  const [inviteDept, setInviteDept] = useState('');
  const [issuedToken, setIssuedToken] = useState<string | null>(null);
  const [acceptTokenInput, setAcceptTokenInput] = useState('');

  // Member edits map
  const [memberDrafts, setMemberDrafts] = useState<
    Record<
      string,
      { role: WorkspaceMemberRole; status: WorkspaceMemberStatus; reportsToMembershipId: string }
    >
  >({});

  // SSO form
  const [ssoProvider, setSsoProvider] = useState<'MICROSOFT' | 'GOOGLE'>('MICROSOFT');
  const [ssoDomain, setSsoDomain] = useState('');
  const [ssoTenantId, setSsoTenantId] = useState('');
  const [ssoClientId, setSsoClientId] = useState('');
  const [ssoClientSecret, setSsoClientSecret] = useState('');
  const [ssoEnforced, setSsoEnforced] = useState(false);
  const [ssoAutoProvision, setSsoAutoProvision] = useState(false);
  const [ssoAllowHrMapping, setSsoAllowHrMapping] = useState(false);
  const [ssoDefaultRole, setSsoDefaultRole] = useState<WorkspaceMemberRole>('EMPLOYEE');
  const [ssoStatus, setSsoStatus] = useState<'NOT_CONFIGURED' | 'DRAFT' | 'VERIFIED' | 'ERROR'>(
    'DRAFT',
  );
  const [groupRows, setGroupRows] = useState<
    Array<{ providerGroupId: string; providerGroupName: string; role: WorkspaceMemberRole }>
  >([]);

  const currentRole = current?.membership?.role ?? session.membership?.role ?? 'HR_ADMIN';
  const isOwner = currentRole === 'OWNER';
  const canManageAdmin = currentRole === 'OWNER' || currentRole === 'HR_ADMIN';

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [wsList, cur] = await Promise.all([fetchMyWorkspaces(), fetchCurrentWorkspace()]);
      setWorkspaces(wsList);
      setCurrent(cur);
      setWsName(cur.workspace.name || '');
      setWsNameAr(cur.workspace.nameAr || '');
      setWsCountry(cur.workspace.country || 'SA');
      setWsTimezone(cur.workspace.timezone || 'Asia/Riyadh');
      setWsCurrency(cur.workspace.currency || 'SAR');
      setWsPolicy(cur.workspace.leaveApprovalPolicy || 'MANAGER_THEN_HR');
      setWsPlan(cur.workspace.planCode);
      setWsSeats(String(cur.seats?.seatsPurchased ?? cur.entitlements.maxSeats));

      const memList = await fetchWorkspaceMembers();
      setMembers(memList);
      const drafts: Record<
        string,
        { role: WorkspaceMemberRole; status: WorkspaceMemberStatus; reportsToMembershipId: string }
      > = {};
      for (const m of memList) {
        drafts[m.id] = {
          role: m.role,
          status: m.status,
          reportsToMembershipId: m.reportsToMembershipId || '',
        };
      }
      setMemberDrafts(drafts);

      if (cur.membership.role === 'OWNER' || cur.membership.role === 'HR_ADMIN') {
        const [invList, ssoRes] = await Promise.all([
          fetchWorkspaceInvites().catch(() => [] as WorkspaceInviteRecord[]),
          fetchWorkspaceSso().catch(() => null),
        ]);
        setInvites(invList);
        setSsoConfig(ssoRes);
        if (ssoRes) {
          setSsoProvider(ssoRes.connection.provider);
          setSsoDomain(ssoRes.connection.domain || '');
          setSsoTenantId(ssoRes.connection.tenantId || '');
          setSsoClientId(ssoRes.connection.clientId || '');
          setSsoClientSecret('');
          setSsoEnforced(ssoRes.connection.enforced);
          setSsoAutoProvision(ssoRes.connection.autoProvision);
          setSsoAllowHrMapping(ssoRes.connection.allowHrGroupMapping);
          setSsoDefaultRole(ssoRes.connection.defaultRole);
          setSsoStatus(ssoRes.connection.status);
          setGroupRows(
            ssoRes.groupMappings.map((g) => ({
              providerGroupId: g.providerGroupId,
              providerGroupName: g.providerGroupName,
              role: g.role,
            })),
          );
        }
      }
    } catch (error) {
      setBanner({
        type: 'err',
        text: error instanceof ApiError ? error.message : 'Unable to load workspace details.',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const handleSwitch = async (workspaceId: string) => {
    setBusy(true);
    setBanner(null);
    try {
      const nextSession = await switchAdminWorkspace(workspaceId);
      onSessionChanged(nextSession);
      setBanner({
        type: 'ok',
        text: isArabic
          ? `تم التبديل إلى ${nextSession.workspace?.name ?? ''}`
          : `Switched active workspace to ${nextSession.workspace?.name ?? workspaceId}.`,
      });
      await loadAll();
    } catch (error) {
      setBanner({
        type: 'err',
        text: error instanceof ApiError ? error.message : 'Unable to switch workspace.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newWsName.trim().length < 2) {
      setBanner({
        type: 'err',
        text: isArabic ? 'اسم مساحة العمل مطلوب (حرفان على الأقل).' : 'Workspace name must be at least 2 characters.',
      });
      return;
    }
    setBusy(true);
    setBanner(null);
    try {
      const created = await createWorkspace({
        type: newWsType,
        name: newWsName.trim(),
        planCode:
          newWsType === 'PERSONAL'
            ? 'INDIVIDUAL_FREE'
            : newWsPlan.startsWith('INDIVIDUAL')
              ? 'BUSINESS_STARTER'
              : newWsPlan,
      });
      setNewWsName('');
      const nextSession = await switchAdminWorkspace(created.workspace.id);
      onSessionChanged(nextSession);
      setBanner({
        type: 'ok',
        text: isArabic
          ? `تم إنشاء "${created.workspace.name}" والتبديل إليه.`
          : `Created "${created.workspace.name}" and switched into it.`,
      });
      await loadAll();
    } catch (error) {
      setBanner({
        type: 'err',
        text: error instanceof ApiError ? error.message : 'Failed to create workspace.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setBanner(null);
    try {
      await updateCurrentWorkspace({
        name: wsName.trim(),
        nameAr: wsNameAr.trim() || undefined,
        country: wsCountry.trim(),
        timezone: wsTimezone.trim(),
        currency: wsCurrency.trim(),
        leaveApprovalPolicy: wsPolicy,
        ...(isOwner ? { planCode: wsPlan, seatsPurchased: Number(wsSeats) || undefined } : {}),
      });
      setBanner({
        type: 'ok',
        text: isArabic ? 'تم حفظ إعدادات مساحة العمل.' : 'Workspace settings updated.',
      });
      await loadAll();
    } catch (error) {
      setBanner({
        type: 'err',
        text: error instanceof ApiError ? error.message : 'Unable to save workspace settings.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleConvertBusiness = async () => {
    if (!current) return;
    setBusy(true);
    setBanner(null);
    try {
      await convertPersonalWorkspaceToBusiness(current.workspace.id, {
        name: wsName.trim() || `${current.workspace.name} Business`,
        planCode: 'BUSINESS_STARTER',
        seatsPurchased: 10,
      });
      setBanner({
        type: 'ok',
        text: isArabic ? 'تمت الترقية إلى مساحة عمل للأعمال.' : 'Workspace converted to Business.',
      });
      await loadAll();
    } catch (error) {
      setBanner({
        type: 'err',
        text: error instanceof ApiError ? error.message : 'Could not convert workspace.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleSaveMember = async (membershipId: string) => {
    const draft = memberDrafts[membershipId];
    if (!draft) return;
    setBusy(true);
    setBanner(null);
    try {
      await updateWorkspaceMember(membershipId, {
        role: draft.role,
        status: draft.status,
        reportsToMembershipId: draft.reportsToMembershipId || null,
      });
      setBanner({
        type: 'ok',
        text: isArabic ? 'تم تحديث بيانات العضو.' : 'Member updated.',
      });
      await loadAll();
    } catch (error) {
      setBanner({
        type: 'err',
        text: error instanceof ApiError ? error.message : 'Unable to update member.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setBanner(null);
    setIssuedToken(null);
    try {
      const res = await createWorkspaceInvite({
        email: inviteEmail.trim(),
        role: inviteRole,
        jobTitle: inviteTitle.trim() || undefined,
        department: inviteDept.trim() || undefined,
      });
      setIssuedToken(res.inviteToken);
      setInviteEmail('');
      setInviteTitle('');
      setInviteDept('');
      setBanner({
        type: 'ok',
        text: isArabic
          ? `تم إنشاء دعوة لـ ${res.invite.email}.`
          : `Invitation created for ${res.invite.email}.`,
      });
      await loadAll();
    } catch (error) {
      setBanner({
        type: 'err',
        text: error instanceof ApiError ? error.message : 'Failed to send invitation.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleRevokeInvite = async (inviteId: string) => {
    setBusy(true);
    setBanner(null);
    try {
      await revokeWorkspaceInvite(inviteId);
      setBanner({
        type: 'ok',
        text: isArabic ? 'تم إلغاء الدعوة.' : 'Invitation revoked.',
      });
      await loadAll();
    } catch (error) {
      setBanner({
        type: 'err',
        text: error instanceof ApiError ? error.message : 'Failed to revoke invitation.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleAcceptInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setBanner(null);
    try {
      const res = await acceptWorkspaceInvite(acceptTokenInput);
      setAcceptTokenInput('');
      setBanner({
        type: 'ok',
        text: isArabic
          ? `تم قبول الدعوة إلى ${res.workspace?.name ?? ''}.`
          : `Joined ${res.workspace?.name ?? 'workspace'}. You can switch into it above.`,
      });
      await loadAll();
    } catch (error) {
      setBanner({
        type: 'err',
        text: error instanceof ApiError ? error.message : 'Unable to accept invitation.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleSaveSso = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setBanner(null);
    try {
      await upsertWorkspaceSso({
        provider: ssoProvider,
        domain: ssoDomain.trim() || undefined,
        tenantId: ssoTenantId.trim() || undefined,
        clientId: ssoClientId.trim() || undefined,
        ...(ssoClientSecret.trim() ? { clientSecret: ssoClientSecret.trim() } : {}),
        enforced: ssoEnforced,
        autoProvision: ssoAutoProvision,
        allowHrGroupMapping: ssoAllowHrMapping,
        defaultRole: ssoDefaultRole,
        status: ssoStatus,
      });
      await upsertWorkspaceSsoGroupMappings(
        groupRows.filter((r) => r.providerGroupId.trim() && r.providerGroupName.trim()),
      );
      setSsoClientSecret('');
      setBanner({
        type: 'ok',
        text: isArabic ? 'تم حفظ إعدادات الدخول الموحد.' : 'SSO configuration and group mappings saved.',
      });
      await loadAll();
    } catch (error) {
      setBanner({
        type: 'err',
        text: error instanceof ApiError ? error.message : 'Unable to save SSO settings.',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <Layers size={20} className="text-macq-orange" />
            <span>
              {isArabic ? 'مساحات العمل والدخول الموحد (SaaS)' : 'Workspaces, Seats & SSO'}
            </span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {isArabic
              ? 'إدارة مساحات العمل متعددة المستأجرين، المقاعد، الدعوات، وسياسات الدخول الموحد.'
              : 'Manage multi-tenant workspaces, memberships, seat billing, invitations, and per-tenant SSO.'}
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadAll()}
          disabled={loading || busy}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold bg-white dark:bg-macq-cardDark border border-slate-200 dark:border-macq-borderDark/60 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          <span>{isArabic ? 'تحديث' : 'Refresh'}</span>
        </button>
      </div>

      {banner && (
        <div
          className={`rounded-xl border px-4 py-3 text-xs font-bold flex items-center gap-2 ${
            banner.type === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800/50 dark:bg-emerald-950/30 dark:text-emerald-300'
              : 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-800/50 dark:bg-rose-950/30 dark:text-rose-300'
          }`}
        >
          <CheckCircle2 size={15} />
          <span>{banner.text}</span>
        </div>
      )}

      {/* Sub-navigation */}
      <div className="flex flex-wrap gap-2">
        {(
          [
            { id: 'overview', labelEn: 'Workspaces & Plan', labelAr: 'مساحات العمل والخطة', icon: Building2 },
            { id: 'members', labelEn: 'Members & Roles', labelAr: 'الأعضاء والأدوار', icon: Users },
            { id: 'invites', labelEn: 'Invitations', labelAr: 'الدعوات', icon: MailPlus },
            { id: 'sso', labelEn: 'SSO & Group Mapping', labelAr: 'الدخول الموحد (SSO)', icon: KeyRound },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          const active = subTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSubTab(tab.id)}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-colors ${
                active
                  ? 'bg-macq-orange text-white shadow-sm'
                  : 'bg-white dark:bg-macq-cardDark text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-macq-borderDark/60 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <Icon size={14} />
              <span>{isArabic ? tab.labelAr : tab.labelEn}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: Overview, Switcher, Create & Settings */}
      {subTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Active Workspace + Switcher */}
          <div className="rounded-2xl bg-white dark:bg-macq-cardDark border border-slate-200/80 dark:border-macq-borderDark/60 p-5 space-y-4 shadow-sm">
            {current && (
              <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-4 border border-slate-200/70 dark:border-slate-700/60 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                    {isArabic ? 'مساحة العمل النشطة' : 'Active Workspace'}
                  </span>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-macq-orange/15 text-macq-orange">
                    {current.workspace.type} · {current.workspace.planCode}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                    {current.workspace.name}
                  </h2>
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                    {formatWorkspaceRoleLabel(
                      current.membership.role,
                      current.workspace.type,
                      isArabic,
                    )}
                  </span>
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {isArabic
                    ? `المقاعد: ${current.seats.usedSeats} / ${current.seats.seatsPurchased} (نشط ${current.seats.activeMembers}، دعوات معلّقة ${current.seats.pendingInvites})`
                    : `Seats: ${current.seats.usedSeats} / ${current.seats.seatsPurchased} (${current.seats.activeMembers} active, ${current.seats.pendingInvites} pending invites)`}
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {[
                    ['Payroll', current.entitlements.payroll],
                    ['SSO', current.entitlements.sso],
                    ['Audit', current.entitlements.audit],
                    ['Multi-Branch', current.entitlements.multiBranch],
                    ['Claims & Vault', current.entitlements.claimsVault],
                  ].map(([label, enabled]) => (
                    <span
                      key={String(label)}
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                        enabled
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                          : 'bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400'
                      }`}
                    >
                      {String(label)}
                    </span>
                  ))}
                </div>
                {current.workspace.type === 'PERSONAL' && isOwner && (
                  <button
                    type="button"
                    onClick={() => void handleConvertBusiness()}
                    disabled={busy}
                    className="mt-2 w-full py-2 rounded-xl bg-macq-orange text-white text-xs font-bold hover:opacity-90"
                  >
                    {isArabic ? 'ترقية إلى مساحة عمل للأعمال' : 'Upgrade Personal → Business'}
                  </button>
                )}
              </div>
            )}

            <div className="space-y-2">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {isArabic ? 'مساحات العمل الخاصة بك' : 'Your Workspaces'}
              </h3>
              {workspaces.map((item) => {
                const isActive = item.workspace.id === current?.workspace.id;
                return (
                  <div
                    key={item.workspace.id}
                    className="flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-700/70"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
                        {item.workspace.name}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {formatWorkspaceRoleLabel(item.membership.role, item.workspace.type, isArabic)}{' '}
                        · {item.workspace.type} · {item.seats.usedSeats}/{item.seats.seatsPurchased}{' '}
                        {isArabic ? 'مقاعد' : 'seats'}
                      </p>
                    </div>
                    {isActive ? (
                      <span className="px-2.5 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold">
                        {isArabic ? 'نشط' : 'Active'}
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void handleSwitch(item.workspace.id)}
                        disabled={busy}
                        className="px-3 py-1.5 rounded-lg bg-macq-navy text-white text-[11px] font-bold hover:opacity-90"
                      >
                        {isArabic ? 'تبديل' : 'Switch'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <form onSubmit={handleCreateWorkspace} className="pt-3 border-t border-slate-200 dark:border-slate-700/60 space-y-2.5">
              <h3 className="text-xs font-extrabold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Plus size={14} className="text-macq-orange" />
                <span>{isArabic ? 'إنشاء مساحة عمل جديدة' : 'Create Workspace'}</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <select
                  value={newWsType}
                  onChange={(e) => setNewWsType(e.target.value as 'BUSINESS' | 'PERSONAL')}
                  className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-semibold"
                >
                  <option value="BUSINESS">BUSINESS</option>
                  <option value="PERSONAL">PERSONAL</option>
                </select>
                <input
                  type="text"
                  value={newWsName}
                  onChange={(e) => setNewWsName(e.target.value)}
                  placeholder={isArabic ? 'اسم مساحة العمل' : 'Workspace name'}
                  className="sm:col-span-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs"
                />
              </div>
              {newWsType === 'BUSINESS' && (
                <select
                  value={newWsPlan}
                  onChange={(e) => setNewWsPlan(e.target.value as AdminWorkspaceSummary['planCode'])}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-semibold"
                >
                  <option value="BUSINESS_STARTER">BUSINESS_STARTER</option>
                  <option value="BUSINESS_GROWTH">BUSINESS_GROWTH</option>
                  <option value="ENTERPRISE">ENTERPRISE</option>
                </select>
              )}
              <button
                type="submit"
                disabled={busy}
                className="w-full py-2 rounded-xl bg-macq-navy text-white text-xs font-bold hover:opacity-90"
              >
                {isArabic ? 'إنشاء والتبديل' : 'Create & Switch'}
              </button>
            </form>
          </div>

          {/* Workspace Settings */}
          <form
            onSubmit={handleSaveSettings}
            className="rounded-2xl bg-white dark:bg-macq-cardDark border border-slate-200/80 dark:border-macq-borderDark/60 p-5 space-y-3.5 shadow-sm"
          >
            <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">
              {isArabic ? 'إعدادات مساحة العمل والخطة' : 'Workspace Settings & Plan'}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">
                  {isArabic ? 'الاسم (EN)' : 'Name (EN)'}
                </label>
                <input
                  type="text"
                  value={wsName}
                  onChange={(e) => setWsName(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">
                  {isArabic ? 'الاسم (AR)' : 'Name (AR)'}
                </label>
                <input
                  type="text"
                  value={wsNameAr}
                  onChange={(e) => setWsNameAr(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">
                  {isArabic ? 'الدولة' : 'Country'}
                </label>
                <input
                  type="text"
                  value={wsCountry}
                  onChange={(e) => setWsCountry(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">
                  {isArabic ? 'المنطقة الزمنية' : 'Timezone'}
                </label>
                <input
                  type="text"
                  value={wsTimezone}
                  onChange={(e) => setWsTimezone(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">
                  {isArabic ? 'العملة' : 'Currency'}
                </label>
                <input
                  type="text"
                  value={wsCurrency}
                  onChange={(e) => setWsCurrency(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">
                  {isArabic ? 'سياسة اعتماد الإجازات' : 'Leave Approval Policy'}
                </label>
                <select
                  value={wsPolicy}
                  onChange={(e) =>
                    setWsPolicy(
                      e.target.value as NonNullable<AdminWorkspaceSummary['leaveApprovalPolicy']>,
                    )
                  }
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs"
                >
                  {APPROVAL_POLICIES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">
                  {isArabic ? 'الخطة (للمالك)' : 'Plan (Owner only)'}
                </label>
                <select
                  value={wsPlan}
                  disabled={!isOwner}
                  onChange={(e) => setWsPlan(e.target.value as AdminWorkspaceSummary['planCode'])}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs disabled:opacity-60"
                >
                  {PLANS.map((plan) => (
                    <option key={plan} value={plan}>
                      {plan}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">
                  {isArabic ? 'المقاعد المشتراة' : 'Seats Purchased'}
                </label>
                <input
                  type="number"
                  min={1}
                  disabled={!isOwner}
                  value={wsSeats}
                  onChange={(e) => setWsSeats(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs disabled:opacity-60"
                />
              </div>
            </div>
            {canManageAdmin && (
              <button
                type="submit"
                disabled={busy}
                className="w-full py-2.5 rounded-xl bg-macq-orange text-white text-xs font-extrabold hover:opacity-90"
              >
                {isArabic ? 'حفظ الإعدادات' : 'Save Workspace Settings'}
              </button>
            )}
          </form>
        </div>
      )}

      {/* TAB 2: Members & Roles */}
      {subTab === 'members' && (
        <div className="rounded-2xl bg-white dark:bg-macq-cardDark border border-slate-200/80 dark:border-macq-borderDark/60 p-5 shadow-sm overflow-x-auto">
          <table className="w-full text-xs text-left rtl:text-right">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 text-[11px] text-slate-500 uppercase">
                <th className="py-2 pr-3">{isArabic ? 'العضو' : 'Member'}</th>
                <th className="py-2 pr-3">{isArabic ? 'الدور' : 'Role'}</th>
                <th className="py-2 pr-3">{isArabic ? 'الحالة' : 'Status'}</th>
                <th className="py-2 pr-3">{isArabic ? 'يرفع تقاريره إلى' : 'Reports To'}</th>
                <th className="py-2 text-right">{isArabic ? 'حفظ' : 'Action'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {members.map((m) => {
                const draft = memberDrafts[m.id] ?? {
                  role: m.role,
                  status: m.status,
                  reportsToMembershipId: m.reportsToMembershipId || '',
                };
                return (
                  <tr key={m.id}>
                    <td className="py-3 pr-3">
                      <div className="font-bold text-slate-900 dark:text-white">
                        {m.user.fullName || `${m.user.firstName} ${m.user.lastName}`}
                      </div>
                      <div className="text-[11px] text-slate-500">{m.user.email}</div>
                    </td>
                    <td className="py-3 pr-3">
                      <select
                        value={draft.role}
                        onChange={(e) =>
                          setMemberDrafts((prev) => ({
                            ...prev,
                            [m.id]: { ...draft, role: e.target.value as WorkspaceMemberRole },
                          }))
                        }
                        className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-xs"
                      >
                        <option value="OWNER">OWNER</option>
                        <option value="HR_ADMIN">HR_ADMIN</option>
                        <option value="MANAGER">MANAGER</option>
                        <option value="EMPLOYEE">EMPLOYEE</option>
                      </select>
                    </td>
                    <td className="py-3 pr-3">
                      <select
                        value={draft.status}
                        onChange={(e) =>
                          setMemberDrafts((prev) => ({
                            ...prev,
                            [m.id]: { ...draft, status: e.target.value as WorkspaceMemberStatus },
                          }))
                        }
                        className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-xs"
                      >
                        <option value="ACTIVE">ACTIVE</option>
                        <option value="SUSPENDED">SUSPENDED</option>
                      </select>
                    </td>
                    <td className="py-3 pr-3">
                      <select
                        value={draft.reportsToMembershipId}
                        onChange={(e) =>
                          setMemberDrafts((prev) => ({
                            ...prev,
                            [m.id]: { ...draft, reportsToMembershipId: e.target.value },
                          }))
                        }
                        className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-xs max-w-[180px]"
                      >
                        <option value="">{isArabic ? 'بدون مدير' : 'None'}</option>
                        {members
                          .filter((other) => other.id !== m.id)
                          .map((other) => (
                            <option key={other.id} value={other.id}>
                              {other.user.firstName} {other.user.lastName} ({other.role})
                            </option>
                          ))}
                      </select>
                    </td>
                    <td className="py-3 text-right">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void handleSaveMember(m.id)}
                        className="px-3 py-1 rounded-lg bg-macq-navy text-white text-[11px] font-bold hover:opacity-90"
                      >
                        {isArabic ? 'حفظ' : 'Save'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 3: Invitations */}
      {subTab === 'invites' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="rounded-2xl bg-white dark:bg-macq-cardDark border border-slate-200/80 dark:border-macq-borderDark/60 p-5 space-y-4 shadow-sm">
            <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">
              {isArabic ? 'دعوة عضو جديد' : 'Invite Teammate'}
            </h2>
            <form onSubmit={handleSendInvite} className="space-y-3">
              <input
                type="email"
                required
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="teammate@company.com"
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs"
              />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as WorkspaceMemberRole)}
                  className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs"
                >
                  <option value="EMPLOYEE">EMPLOYEE</option>
                  <option value="MANAGER">MANAGER</option>
                  {isOwner && <option value="HR_ADMIN">HR_ADMIN</option>}
                  {isOwner && <option value="OWNER">OWNER</option>}
                </select>
                <input
                  type="text"
                  value={inviteTitle}
                  onChange={(e) => setInviteTitle(e.target.value)}
                  placeholder={isArabic ? 'المسمى الوظيفي' : 'Job title'}
                  className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs"
                />
                <input
                  type="text"
                  value={inviteDept}
                  onChange={(e) => setInviteDept(e.target.value)}
                  placeholder={isArabic ? 'القسم' : 'Department'}
                  className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs"
                />
              </div>
              <button
                type="submit"
                disabled={busy}
                className="w-full py-2 rounded-xl bg-macq-orange text-white text-xs font-extrabold hover:opacity-90"
              >
                {isArabic ? 'إرسال الدعوة' : 'Send Invitation'}
              </button>
            </form>

            {issuedToken && (
              <div className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3 space-y-1">
                <p className="text-[11px] font-bold text-amber-800 dark:text-amber-200">
                  {isArabic ? 'رمز الدعوة (يُعرض مرة واحدة):' : 'One-time Invite Token:'}
                </p>
                <div className="flex items-center justify-between gap-2">
                  <code className="text-[11px] font-mono break-all text-slate-900 dark:text-white">
                    {issuedToken}
                  </code>
                  <button
                    type="button"
                    onClick={() => void navigator.clipboard?.writeText(issuedToken)}
                    className="p-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                    title="Copy token"
                  >
                    <Copy size={13} />
                  </button>
                </div>
              </div>
            )}

            <form onSubmit={handleAcceptInvite} className="pt-3 border-t border-slate-200 dark:border-slate-700 space-y-2">
              <h3 className="text-xs font-extrabold text-slate-800 dark:text-slate-200">
                {isArabic ? 'قبول دعوة مساحة عمل أخرى' : 'Accept an Invite Token'}
              </h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={acceptTokenInput}
                  onChange={(e) => setAcceptTokenInput(e.target.value)}
                  placeholder={isArabic ? 'أدخل رمز الدعوة' : 'Paste invite token'}
                  className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs"
                />
                <button
                  type="submit"
                  disabled={busy}
                  className="px-4 py-2 rounded-xl bg-macq-navy text-white text-xs font-bold"
                >
                  {isArabic ? 'قبول' : 'Join'}
                </button>
              </div>
            </form>
          </div>

          <div className="rounded-2xl bg-white dark:bg-macq-cardDark border border-slate-200/80 dark:border-macq-borderDark/60 p-5 space-y-3 shadow-sm">
            <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">
              {isArabic ? 'سجل الدعوات' : 'Workspace Invitations'}
            </h2>
            {invites.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">
                {isArabic ? 'لا توجد دعوات بعد.' : 'No invitations found for this workspace.'}
              </p>
            ) : (
              <div className="space-y-2">
                {invites.map((inv) => {
                  const status = inv.acceptedAt
                    ? 'ACCEPTED'
                    : inv.revokedAt
                      ? 'REVOKED'
                      : 'PENDING';
                  return (
                    <div
                      key={inv.id}
                      className="flex items-center justify-between gap-2 p-3 rounded-xl border border-slate-200 dark:border-slate-700/70"
                    >
                      <div>
                        <p className="text-xs font-bold text-slate-900 dark:text-white">
                          {inv.email}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {inv.role} · {status}
                        </p>
                      </div>
                      {status === 'PENDING' && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void handleRevokeInvite(inv.id)}
                          className="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 text-[11px] font-bold"
                        >
                          {isArabic ? 'إلغاء' : 'Revoke'}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: SSO & Group Mappings */}
      {subTab === 'sso' && (
        <form
          onSubmit={handleSaveSso}
          className="rounded-2xl bg-white dark:bg-macq-cardDark border border-slate-200/80 dark:border-macq-borderDark/60 p-5 space-y-4 shadow-sm"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldCheck size={16} className="text-macq-orange" />
              <span>{isArabic ? 'إعدادات الدخول الموحد (SSO)' : 'Workspace SSO Configuration'}</span>
            </h2>
            {ssoConfig?.connection.clientSecretMasked && (
              <span className="text-[11px] font-mono text-slate-500">
                Secret: {ssoConfig.connection.clientSecretMasked}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1">Provider</label>
              <select
                value={ssoProvider}
                disabled={!isOwner}
                onChange={(e) => setSsoProvider(e.target.value as 'MICROSOFT' | 'GOOGLE')}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs"
              >
                <option value="MICROSOFT">MICROSOFT</option>
                <option value="GOOGLE">GOOGLE</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1">Domain</label>
              <input
                type="text"
                disabled={!isOwner}
                value={ssoDomain}
                onChange={(e) => setSsoDomain(e.target.value)}
                placeholder="company.com"
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1">Status</label>
              <select
                value={ssoStatus}
                disabled={!isOwner}
                onChange={(e) =>
                  setSsoStatus(
                    e.target.value as 'NOT_CONFIGURED' | 'DRAFT' | 'VERIFIED' | 'ERROR',
                  )
                }
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs"
              >
                <option value="NOT_CONFIGURED">NOT_CONFIGURED</option>
                <option value="DRAFT">DRAFT</option>
                <option value="VERIFIED">VERIFIED</option>
                <option value="ERROR">ERROR</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1">Tenant ID</label>
              <input
                type="text"
                disabled={!isOwner}
                value={ssoTenantId}
                onChange={(e) => setSsoTenantId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1">Client ID</label>
              <input
                type="text"
                disabled={!isOwner}
                value={ssoClientId}
                onChange={(e) => setSsoClientId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1">
                Client Secret (write-only)
              </label>
              <input
                type="password"
                disabled={!isOwner}
                value={ssoClientSecret}
                onChange={(e) => setSsoClientSecret(e.target.value)}
                placeholder="••••••••••••"
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-4 text-xs">
            <label className="inline-flex items-center gap-2 font-semibold">
              <input
                type="checkbox"
                disabled={!isOwner}
                checked={ssoEnforced}
                onChange={(e) => setSsoEnforced(e.target.checked)}
              />
              <span>{isArabic ? 'فرض SSO (تعطيل كلمة المرور)' : 'Enforce SSO (disable password)'}</span>
            </label>
            <label className="inline-flex items-center gap-2 font-semibold">
              <input
                type="checkbox"
                disabled={!isOwner}
                checked={ssoAutoProvision}
                onChange={(e) => setSsoAutoProvision(e.target.checked)}
              />
              <span>{isArabic ? 'إنشاء العضوية تلقائياً (JIT)' : 'Auto-provision JIT'}</span>
            </label>
            <label className="inline-flex items-center gap-2 font-semibold">
              <input
                type="checkbox"
                disabled={!isOwner}
                checked={ssoAllowHrMapping}
                onChange={(e) => setSsoAllowHrMapping(e.target.checked)}
              />
              <span>{isArabic ? 'السماح بربط HR_ADMIN' : 'Allow HR_ADMIN group mapping'}</span>
            </label>
            <div className="flex items-center gap-2">
              <span className="font-semibold">Default Role:</span>
              <select
                value={ssoDefaultRole}
                disabled={!isOwner}
                onChange={(e) => setSsoDefaultRole(e.target.value as WorkspaceMemberRole)}
                className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-xs"
              >
                <option value="EMPLOYEE">EMPLOYEE</option>
                <option value="MANAGER">MANAGER</option>
              </select>
            </div>
          </div>

          {/* Group Mappings */}
          <div className="pt-3 border-t border-slate-200 dark:border-slate-700 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-extrabold text-slate-800 dark:text-slate-200">
                {isArabic ? 'ربط مجموعات المزود بالأدوار' : 'Provider Group → Role Mappings'}
              </h3>
              {isOwner && (
                <button
                  type="button"
                  onClick={() =>
                    setGroupRows((prev) => [
                      ...prev,
                      { providerGroupId: '', providerGroupName: '', role: 'EMPLOYEE' },
                    ])
                  }
                  className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-bold"
                >
                  + {isArabic ? 'إضافة صف' : 'Add Mapping'}
                </button>
              )}
            </div>
            {groupRows.map((row, idx) => (
              <div key={idx} className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                <input
                  type="text"
                  disabled={!isOwner}
                  value={row.providerGroupId}
                  onChange={(e) =>
                    setGroupRows((prev) =>
                      prev.map((item, i) =>
                        i === idx ? { ...item, providerGroupId: e.target.value } : item,
                      ),
                    )
                  }
                  placeholder="Group ID"
                  className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs"
                />
                <input
                  type="text"
                  disabled={!isOwner}
                  value={row.providerGroupName}
                  onChange={(e) =>
                    setGroupRows((prev) =>
                      prev.map((item, i) =>
                        i === idx ? { ...item, providerGroupName: e.target.value } : item,
                      ),
                    )
                  }
                  placeholder="Group Name"
                  className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs"
                />
                <select
                  disabled={!isOwner}
                  value={row.role}
                  onChange={(e) =>
                    setGroupRows((prev) =>
                      prev.map((item, i) =>
                        i === idx ? { ...item, role: e.target.value as WorkspaceMemberRole } : item,
                      ),
                    )
                  }
                  className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs"
                >
                  <option value="EMPLOYEE">EMPLOYEE</option>
                  <option value="MANAGER">MANAGER</option>
                  {ssoAllowHrMapping && <option value="HR_ADMIN">HR_ADMIN</option>}
                </select>
                {isOwner && (
                  <button
                    type="button"
                    onClick={() => setGroupRows((prev) => prev.filter((_, i) => i !== idx))}
                    className="rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs font-bold px-3 py-1.5"
                  >
                    {isArabic ? 'حذف' : 'Remove'}
                  </button>
                )}
              </div>
            ))}
          </div>

          {isOwner && (
            <button
              type="submit"
              disabled={busy}
              className="w-full py-2.5 rounded-xl bg-macq-orange text-white text-xs font-extrabold hover:opacity-90"
            >
              {isArabic ? 'حفظ إعدادات SSO' : 'Save SSO & Mappings'}
            </button>
          )}
        </form>
      )}
    </div>
  );
};
