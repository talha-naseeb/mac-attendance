import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import {
  acceptWorkspaceInviteInBackend,
  ApiAuthSession,
  BackendApiError,
  convertWorkspaceToBusinessInBackend,
  createWorkspaceInBackend,
  fetchMyWorkspacesFromBackend,
  switchWorkspaceInBackend,
} from '../services/backendApi';
import {
  formatSeatMeterSummary,
  MembershipSummary,
  resolveWorkspaceDisplayRole,
  validateInviteTokenInput,
  validateWorkspaceCreationInput,
  WorkspaceEntitlements,
  WorkspaceListItem,
  WorkspaceSummary,
  WorkspaceType,
} from '../services/workspaceService';
import { MACQUIRES_PALETTE, ThemeColors } from '../theme/colors';
import { AppLanguage, rtlRow, rtlText } from '../theme/typography';

interface WorkspaceModalProps {
  visible: boolean;
  colors: ThemeColors;
  lang: AppLanguage;
  authToken: string | null;
  activeWorkspace?: WorkspaceSummary;
  activeMembership?: MembershipSummary;
  activeEntitlements?: WorkspaceEntitlements;
  onClose: () => void;
  onWorkspaceSwitched: (session: ApiAuthSession) => void | Promise<void>;
}

export const WorkspaceModal: React.FC<WorkspaceModalProps> = ({
  visible,
  colors,
  lang,
  authToken,
  activeWorkspace,
  activeMembership,
  activeEntitlements,
  onClose,
  onWorkspaceSwitched,
}) => {
  const isRTL = lang === 'ar';
  const [workspaces, setWorkspaces] = useState<WorkspaceListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [newType, setNewType] = useState<WorkspaceType>('BUSINESS');
  const [newName, setNewName] = useState('');
  const [inviteToken, setInviteToken] = useState('');
  const [upgradeName, setUpgradeName] = useState('');

  const loadWorkspaces = useCallback(async () => {
    if (!authToken) return;
    setLoading(true);
    try {
      const list = await fetchMyWorkspacesFromBackend(authToken);
      setWorkspaces(list);
    } catch (error) {
      setFeedback({
        type: 'err',
        text: error instanceof BackendApiError ? error.message : 'Could not load workspaces.',
      });
    } finally {
      setLoading(false);
    }
  }, [authToken]);

  useEffect(() => {
    if (visible) {
      setFeedback(null);
      void loadWorkspaces();
    }
  }, [visible, loadWorkspaces]);

  const handleSwitch = async (workspaceId: string) => {
    if (!authToken) return;
    setBusyId(workspaceId);
    setFeedback(null);
    try {
      const nextSession = await switchWorkspaceInBackend(authToken, workspaceId);
      await onWorkspaceSwitched(nextSession);
      setFeedback({
        type: 'ok',
        text: isRTL
          ? `تم التبديل إلى ${nextSession.workspace?.name ?? 'مساحة العمل'}`
          : `Switched to ${nextSession.workspace?.name ?? 'workspace'}.`,
      });
      await loadWorkspaces();
    } catch (error) {
      setFeedback({
        type: 'err',
        text: error instanceof BackendApiError ? error.message : 'Unable to switch workspace.',
      });
    } finally {
      setBusyId(null);
    }
  };

  const handleCreate = async () => {
    if (!authToken) return;
    const validation = validateWorkspaceCreationInput({ type: newType, name: newName });
    if (!validation.valid) {
      setFeedback({ type: 'err', text: validation.error! });
      return;
    }
    setBusyId('create');
    setFeedback(null);
    try {
      const created = await createWorkspaceInBackend(authToken, {
        type: newType,
        name: newName.trim(),
      });
      setNewName('');
      const switched = await switchWorkspaceInBackend(authToken, created.workspace.id);
      await onWorkspaceSwitched(switched);
      setFeedback({
        type: 'ok',
        text: isRTL
          ? `تم إنشاء "${created.workspace.name}" والتبديل إليه.`
          : `Created "${created.workspace.name}" and switched into it.`,
      });
      await loadWorkspaces();
    } catch (error) {
      setFeedback({
        type: 'err',
        text: error instanceof BackendApiError ? error.message : 'Could not create workspace.',
      });
    } finally {
      setBusyId(null);
    }
  };

  const handleAcceptInvite = async () => {
    if (!authToken) return;
    const validation = validateInviteTokenInput(inviteToken);
    if (!validation.valid) {
      setFeedback({ type: 'err', text: validation.error! });
      return;
    }
    setBusyId('invite');
    setFeedback(null);
    try {
      const accepted = await acceptWorkspaceInviteInBackend(authToken, inviteToken);
      setInviteToken('');
      setFeedback({
        type: 'ok',
        text: isRTL
          ? `تم قبول الدعوة والانضمام إلى ${accepted.workspace.name}.`
          : `Joined ${accepted.workspace.name}. Tap Switch to open it.`,
      });
      await loadWorkspaces();
    } catch (error) {
      setFeedback({
        type: 'err',
        text: error instanceof BackendApiError ? error.message : 'Could not accept invitation.',
      });
    } finally {
      setBusyId(null);
    }
  };

  const handleConvertToBusiness = async () => {
    if (!authToken || !activeWorkspace) return;
    const targetName = upgradeName.trim() || `${activeWorkspace.name} Business`;
    setBusyId('convert');
    setFeedback(null);
    try {
      await convertWorkspaceToBusinessInBackend(authToken, activeWorkspace.id, {
        name: targetName,
        planCode: 'BUSINESS_STARTER',
        seatsPurchased: 5,
      });
      const switched = await switchWorkspaceInBackend(authToken, activeWorkspace.id);
      await onWorkspaceSwitched(switched);
      setUpgradeName('');
      setFeedback({
        type: 'ok',
        text: isRTL
          ? 'تمت الترقية إلى مساحة عمل للأعمال بنجاح.'
          : 'Upgraded workspace to Business plan.',
      });
      await loadWorkspaces();
    } catch (error) {
      setFeedback({
        type: 'err',
        text: error instanceof BackendApiError ? error.message : 'Unable to upgrade workspace.',
      });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaProvider>
        <SafeAreaView
          style={[styles.container, { backgroundColor: colors.background }]}
          edges={['top', 'bottom']}
        >
          <View
            style={[
              styles.header,
              rtlRow(isRTL),
              { borderBottomColor: colors.border, backgroundColor: colors.surface },
            ]}
          >
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} accessibilityLabel="Close">
              <Feather name="x" size={20} color={colors.textPrimary} />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: colors.textPrimary }, rtlText(isRTL)]}>
              {isRTL ? 'مساحات العمل والتبديل' : 'Workspaces & Tenants'}
            </Text>
            <View style={{ width: 32 }} />
          </View>

          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {feedback && (
              <View
                style={[
                  styles.banner,
                  {
                    backgroundColor: feedback.type === 'ok' ? colors.successBg : colors.dangerBg,
                    borderColor: feedback.type === 'ok' ? colors.successText : colors.dangerText,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.bannerText,
                    { color: feedback.type === 'ok' ? colors.successText : colors.dangerText },
                    rtlText(isRTL),
                  ]}
                >
                  {feedback.text}
                </Text>
              </View>
            )}

            {activeWorkspace && activeMembership && (
              <View
                style={[
                  styles.card,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <Text style={[styles.sectionLabel, { color: colors.textMuted }, rtlText(isRTL)]}>
                  {isRTL ? 'مساحة العمل النشطة' : 'ACTIVE WORKSPACE'}
                </Text>
                <View style={[styles.rowBetween, rtlRow(isRTL)]}>
                  <Text style={[styles.activeName, { color: colors.textPrimary }, rtlText(isRTL)]}>
                    {activeWorkspace.name}
                  </Text>
                  <View style={[styles.badge, { backgroundColor: MACQUIRES_PALETTE.orangePantone }]}>
                    <Text style={styles.badgeText}>{activeWorkspace.type}</Text>
                  </View>
                </View>
                <Text style={[styles.metaText, { color: colors.textSecondary }, rtlText(isRTL)]}>
                  {resolveWorkspaceDisplayRole(activeMembership.role, activeWorkspace.type, lang)} ·{' '}
                  {activeWorkspace.planCode}
                  {activeEntitlements ? ` · ${activeEntitlements.maxSeats} max seats` : ''}
                </Text>
              </View>
            )}

            {activeWorkspace?.type === 'PERSONAL' && (
              <View
                style={[
                  styles.card,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <Text style={[styles.cardTitle, { color: colors.textPrimary }, rtlText(isRTL)]}>
                  {isRTL ? 'الترقية إلى مساحة عمل للأعمال' : 'Upgrade to Business'}
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.background },
                    rtlText(isRTL),
                  ]}
                  value={upgradeName}
                  onChangeText={setUpgradeName}
                  placeholder={isRTL ? 'اسم الشركة الجديدة' : 'Company name'}
                  placeholderTextColor={colors.textMuted}
                />
                <TouchableOpacity
                  style={[styles.primaryBtn, { backgroundColor: MACQUIRES_PALETTE.orangePantone }]}
                  onPress={handleConvertToBusiness}
                  disabled={busyId === 'convert'}
                >
                  <Text style={styles.primaryBtnText}>
                    {busyId === 'convert'
                      ? isRTL ? 'جاري الترقية...' : 'Upgrading...'
                      : isRTL ? 'تحويل إلى Business' : 'Convert to Business'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={[styles.rowBetween, rtlRow(isRTL), { marginBottom: 10 }]}>
                <Text style={[styles.cardTitle, { color: colors.textPrimary }, rtlText(isRTL)]}>
                  {isRTL ? 'مساحات العمل المتاحة' : 'Your Workspaces'}
                </Text>
                {loading && <ActivityIndicator size="small" color={colors.accent} />}
              </View>

              {!authToken && (
                <Text style={[styles.metaText, { color: colors.textMuted }, rtlText(isRTL)]}>
                  {isRTL
                    ? 'سجّل الدخول عبر الخادم لعرض وتبديل مساحات العمل.'
                    : 'Sign in with the live API to load and switch workspaces.'}
                </Text>
              )}

              {workspaces.map((item) => {
                const isActive = item.workspace.id === activeWorkspace?.id;
                return (
                  <View
                    key={item.workspace.id}
                    style={[
                      styles.wsItem,
                      rtlRow(isRTL),
                      {
                        borderColor: isActive ? MACQUIRES_PALETTE.orangePantone : colors.border,
                        backgroundColor: colors.background,
                      },
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.wsName, { color: colors.textPrimary }, rtlText(isRTL)]}>
                        {item.workspace.name}
                      </Text>
                      <Text style={[styles.metaText, { color: colors.textMuted }, rtlText(isRTL)]}>
                        {resolveWorkspaceDisplayRole(item.membership.role, item.workspace.type, lang)} ·{' '}
                        {item.workspace.type} · {formatSeatMeterSummary(item.seats, lang)}
                      </Text>
                    </View>
                    {isActive ? (
                      <View style={[styles.badge, { backgroundColor: colors.successBg }]}>
                        <Text style={[styles.badgeText, { color: colors.successText }]}>
                          {isRTL ? 'نشط' : 'Active'}
                        </Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={[styles.switchBtn, { backgroundColor: colors.primary }]}
                        onPress={() => void handleSwitch(item.workspace.id)}
                        disabled={busyId === item.workspace.id}
                      >
                        <Text style={styles.switchBtnText}>
                          {busyId === item.workspace.id
                            ? '...'
                            : isRTL ? 'تبديل' : 'Switch'}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
            </View>

            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.cardTitle, { color: colors.textPrimary }, rtlText(isRTL)]}>
                {isRTL ? 'إنشاء مساحة عمل جديدة' : 'Create New Workspace'}
              </Text>
              <View style={[styles.typeRow, rtlRow(isRTL)]}>
                {(['BUSINESS', 'PERSONAL'] as WorkspaceType[]).map((type) => {
                  const selected = newType === type;
                  return (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.typeChip,
                        {
                          borderColor: selected ? MACQUIRES_PALETTE.orangePantone : colors.border,
                          backgroundColor: selected ? MACQUIRES_PALETTE.orangePantone : colors.background,
                        },
                      ]}
                      onPress={() => setNewType(type)}
                    >
                      <Text
                        style={[
                          styles.typeChipText,
                          { color: selected ? '#FFFFFF' : colors.textPrimary },
                        ]}
                      >
                        {type === 'BUSINESS'
                          ? isRTL ? 'أعمال (Business)' : 'Business'
                          : isRTL ? 'شخصي (Personal)' : 'Personal'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <TextInput
                style={[
                  styles.input,
                  { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.background },
                  rtlText(isRTL),
                ]}
                value={newName}
                onChangeText={setNewName}
                placeholder={isRTL ? 'اسم مساحة العمل' : 'Workspace name'}
                placeholderTextColor={colors.textMuted}
              />
              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
                onPress={handleCreate}
                disabled={busyId === 'create'}
              >
                <Text style={styles.primaryBtnText}>
                  {busyId === 'create'
                    ? isRTL ? 'جاري الإنشاء...' : 'Creating...'
                    : isRTL ? 'إنشاء والتبديل' : 'Create & Switch'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.cardTitle, { color: colors.textPrimary }, rtlText(isRTL)]}>
                {isRTL ? 'الانضمام برمز دعوة' : 'Accept Workspace Invitation'}
              </Text>
              <TextInput
                style={[
                  styles.input,
                  { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.background },
                  rtlText(isRTL),
                ]}
                value={inviteToken}
                onChangeText={setInviteToken}
                placeholder={isRTL ? 'ألصق رمز الدعوة هنا' : 'Paste invite token'}
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: MACQUIRES_PALETTE.bdazzledBlue }]}
                onPress={handleAcceptInvite}
                disabled={busyId === 'invite'}
              >
                <Text style={styles.primaryBtnText}>
                  {busyId === 'invite'
                    ? isRTL ? 'جاري الانضمام...' : 'Joining...'
                    : isRTL ? 'قبول الدعوة' : 'Accept Invite'}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    height: 56,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  closeBtn: { padding: 6 },
  headerTitle: { fontSize: 16, fontWeight: '800' },
  scrollContent: { padding: 16, gap: 14 },
  banner: { padding: 12, borderRadius: 12, borderWidth: 1 },
  bannerText: { fontSize: 12, fontWeight: '700' },
  card: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 10 },
  sectionLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  activeName: { fontSize: 17, fontWeight: '800' },
  cardTitle: { fontSize: 14, fontWeight: '800' },
  metaText: { fontSize: 12, fontWeight: '500' },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  badgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
  wsItem: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  wsName: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  switchBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  switchBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  typeRow: { flexDirection: 'row', gap: 8 },
  typeChip: { flex: 1, borderWidth: 1, borderRadius: 10, paddingVertical: 9, alignItems: 'center' },
  typeChipText: { fontSize: 12, fontWeight: '700' },
  input: {
    height: 44,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 13,
  },
  primaryBtn: { height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  primaryBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
});
