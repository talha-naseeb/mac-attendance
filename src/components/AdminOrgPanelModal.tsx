import React, { useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { MACQUIRES_PALETTE, ThemeColors } from '../theme/colors';
import { AppLanguage, rtlRow, rtlText, TYPOGRAPHY } from '../theme/typography';
import { UserRole } from '../services/dashboardOptimizationService';
import {
  getOrganizationAttendanceOverview,
  ORGANIZATION_TREE,
  OrgBranchAttendanceStat,
  OrgEmployeeNode,
} from '../services/organizationWorkflowService';
import { ApprovalItem } from '../types/zenhr';

interface AdminOrgPanelModalProps {
  visible: boolean;
  colors: ThemeColors;
  lang: AppLanguage;
  activeRole: UserRole;
  approvals: ApprovalItem[];
  onClose: () => void;
  onSelectRole: (role: UserRole) => void;
  onDecideApproval: (id: string, decision: 'Approved' | 'Rejected') => void;
}

type AdminPanelTab = 'hierarchy' | 'branches' | 'pipeline';

export const AdminOrgPanelModal: React.FC<AdminOrgPanelModalProps> = ({
  visible,
  colors,
  lang,
  activeRole,
  approvals,
  onClose,
  onSelectRole,
  onDecideApproval,
}) => {
  const [activeTab, setActiveTab] = useState<AdminPanelTab>('hierarchy');
  const [pipelineFilter, setPipelineFilter] = useState<'all' | 'pending' | 'approved'>('all');
  const [selectedNode, setSelectedNode] = useState<OrgEmployeeNode | null>(null);

  const isRTL = lang === 'ar';
  const attendanceStats = getOrganizationAttendanceOverview();

  const rolePills: { role: UserRole; labelEn: string; labelAr: string; icon: string }[] = [
    { role: 'EMPLOYEE', labelEn: 'Employee (Remote PK)', labelAr: 'موظف (عن بعد)', icon: 'user' },
    { role: 'MANAGER', labelEn: 'Manager (Tariq)', labelAr: 'المدير (طارق)', icon: 'briefcase' },
    { role: 'HR', labelEn: 'HR (Rahaf)', labelAr: 'الموارد البشرية (رهف)', icon: 'users' },
    { role: 'ADMIN', labelEn: 'Executive Admin', labelAr: 'المسؤول التنفيذي', icon: 'shield' },
  ];

  const pendingApprovals = approvals.filter((a) => a.status === 'Pending');
  const approvedApprovals = approvals.filter((a) => a.status === 'Approved');

  const visibleApprovals = approvals.filter((item) => {
    if (pipelineFilter === 'pending') return item.status === 'Pending';
    if (pipelineFilter === 'approved') return item.status === 'Approved';
    return true;
  });

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        {/* Top Header Bar */}
        <View
          style={[
            styles.headerBar,
            rtlRow(isRTL),
            { backgroundColor: colors.primary, borderBottomColor: colors.border },
          ]}
        >
          <TouchableOpacity
            onPress={onClose}
            style={styles.circleCloseBtn}
            accessibilityLabel={isRTL ? 'إغلاق' : 'Close'}
          >
            <Feather name="x" size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: isRTL ? 'flex-end' : 'flex-start' }}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {isRTL ? 'لوحة القيادة والهيكل التنظيمي' : 'Admin & Organization Hub'}
            </Text>
            <Text style={styles.headerSub} numberOfLines={1}>
              {isRTL ? 'إدارة الهيكل وفريق العمل والموافقات' : 'Multi-Role Org Hierarchy & Approval Pipeline'}
            </Text>
          </View>
          <View style={styles.activeRoleBadge}>
            <Text style={styles.activeRoleText}>{activeRole}</Text>
          </View>
        </View>

        {/* Quick Role Switcher Row */}
        <View
          style={[
            styles.roleSwitcherRow,
            rtlRow(isRTL),
            { backgroundColor: colors.surface, borderBottomColor: colors.border },
          ]}
        >
          <Text style={[styles.switchLabel, { color: colors.textSecondary }]}>
            {isRTL ? 'تبديل الدور:' : 'Persona:'}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rolePillsScroll}>
            {rolePills.map((p) => {
              const active =
                activeRole === p.role ||
                (p.role === 'HR' && activeRole === 'HR_ADMIN');
              return (
                <TouchableOpacity
                  key={p.role}
                  style={[
                    styles.rolePill,
                    {
                      backgroundColor: active ? colors.primary : colors.surfaceSubtle,
                      borderColor: active ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => onSelectRole(p.role)}
                  activeOpacity={0.8}
                >
                  <Feather
                    name={p.icon as any}
                    size={12}
                    color={active ? '#FFFFFF' : colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.rolePillText,
                      { color: active ? '#FFFFFF' : colors.textPrimary },
                    ]}
                  >
                    {isRTL ? p.labelAr : p.labelEn}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Tab Navigation Navigation Bar */}
        <View
          style={[
            styles.tabsContainer,
            rtlRow(isRTL),
            { backgroundColor: colors.surface, borderBottomColor: colors.border },
          ]}
        >
          <TouchableOpacity
            style={[
              styles.tabBtn,
              activeTab === 'hierarchy' && [styles.activeTabBtn, { borderBottomColor: colors.accent }],
            ]}
            onPress={() => setActiveTab('hierarchy')}
          >
            <Feather
              name="git-merge"
              size={15}
              color={activeTab === 'hierarchy' ? colors.accent : colors.textSecondary}
            />
            <Text
              style={[
                styles.tabText,
                { color: activeTab === 'hierarchy' ? colors.accent : colors.textSecondary },
              ]}
            >
              {isRTL ? 'الهيكل التنظيمي' : 'Org Tree'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tabBtn,
              activeTab === 'branches' && [styles.activeTabBtn, { borderBottomColor: colors.accent }],
            ]}
            onPress={() => setActiveTab('branches')}
          >
            <Feather
              name="map"
              size={15}
              color={activeTab === 'branches' ? colors.accent : colors.textSecondary}
            />
            <Text
              style={[
                styles.tabText,
                { color: activeTab === 'branches' ? colors.accent : colors.textSecondary },
              ]}
            >
              {isRTL ? 'الفروع والحضور' : 'Branches'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tabBtn,
              activeTab === 'pipeline' && [styles.activeTabBtn, { borderBottomColor: colors.accent }],
            ]}
            onPress={() => setActiveTab('pipeline')}
          >
            <Feather
              name="check-square"
              size={15}
              color={activeTab === 'pipeline' ? colors.accent : colors.textSecondary}
            />
            <Text
              style={[
                styles.tabText,
                { color: activeTab === 'pipeline' ? colors.accent : colors.textSecondary },
              ]}
            >
              {isRTL ? 'مسار الإجازات' : 'Leave Pipeline'}
            </Text>
            {pendingApprovals.length > 0 && (
              <View style={styles.tabBadge}>
                <Text style={styles.tabBadgeText}>{pendingApprovals.length}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Tab Contents */}
        <ScrollView contentContainerStyle={styles.contentScroll} showsVerticalScrollIndicator={false}>
          {/* TAB 1: ORG HIERARCHY TREE */}
          {activeTab === 'hierarchy' && (
            <View style={styles.tabBody}>
              <View style={[styles.infoBanner, { backgroundColor: colors.surfaceSubtle, borderColor: colors.border }]}>
                <Feather name="info" size={16} color={colors.accent} />
                <Text style={[styles.infoBannerText, { color: colors.textSecondary }]}>
                  {isRTL
                    ? 'الهيكل المعتمد لمجموعة ماكوايرز: يقدم الموظفون الإجازات للمدير المباشر (طارق الغامدي)، ثم تُعتمد وتُسجل لدى الموارد البشرية (رهف المنصور).'
                    : 'Official Org Hierarchy: Employees report to Direct Manager (Tariq Al-Ghamdi), who approves leaves before HR (Rahaf Al-Mansoor) finalization.'}
                </Text>
              </View>

              <Text style={[styles.sectionTitle, { color: colors.textPrimary }, rtlText(isRTL)]}>
                {isRTL ? 'المستويات التنظيمية وقنوات التقارير' : 'Reporting Structure & Hierarchy'}
              </Text>

              {ORGANIZATION_TREE.map((node) => {
                const isSelected = selectedNode?.id === node.id;
                const isRemote = node.workType === 'Remote';
                return (
                  <TouchableOpacity
                    key={node.id}
                    style={[
                      styles.nodeCard,
                      {
                        backgroundColor: colors.surface,
                        borderColor: isSelected ? colors.primary : colors.border,
                      },
                    ]}
                    onPress={() => setSelectedNode(isSelected ? null : node)}
                    activeOpacity={0.85}
                  >
                    <View style={[styles.nodeTopRow, rtlRow(isRTL)]}>
                      <View style={[styles.avatarCircle, { backgroundColor: node.avatarColor }]}>
                        <Text style={styles.avatarText}>{node.avatarInitials}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={[styles.nameTagRow, rtlRow(isRTL)]}>
                          <Text style={[styles.nodeName, { color: colors.textPrimary }]}>
                            {isRTL ? node.nameAr : node.name}
                          </Text>
                          <View
                            style={[
                              styles.workBadge,
                              {
                                backgroundColor: isRemote
                                  ? 'rgba(16, 185, 129, 0.15)'
                                  : 'rgba(0, 44, 82, 0.08)',
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.workBadgeText,
                                { color: isRemote ? '#10B981' : colors.primary },
                              ]}
                            >
                              {node.location}
                            </Text>
                          </View>
                        </View>
                        <Text style={[styles.nodeTitle, { color: colors.textSecondary }]}>
                          {isRTL ? node.titleAr : node.title}
                        </Text>
                        <Text style={[styles.nodeDept, { color: colors.textMuted }]}>
                          {isRTL ? node.departmentAr : node.department}
                        </Text>
                      </View>
                      <Feather
                        name={isSelected ? 'chevron-up' : 'chevron-down'}
                        size={18}
                        color={colors.textMuted}
                      />
                    </View>

                    {isSelected && (
                      <View
                        style={[
                          styles.nodeExpandedDetails,
                          { borderTopColor: colors.border, backgroundColor: colors.surfaceSubtle },
                        ]}
                      >
                        <View style={[styles.detailItemRow, rtlRow(isRTL)]}>
                          <Feather name="corner-down-right" size={13} color={colors.accent} />
                          <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                            {isRTL ? 'المدير المباشر:' : 'Direct Manager:'}
                          </Text>
                          <Text style={[styles.detailValue, { color: colors.textPrimary }]}>
                            {node.managerName ? node.managerName : 'Board of Directors'}
                          </Text>
                        </View>

                        <View style={[styles.detailItemRow, rtlRow(isRTL)]}>
                          <Feather name="mail" size={13} color={colors.accent} />
                          <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                            {isRTL ? 'البريد الإلكتروني:' : 'Email:'}
                          </Text>
                          <Text style={[styles.detailValue, { color: colors.textPrimary }]}>
                            {node.email}
                          </Text>
                        </View>

                        <View style={[styles.detailItemRow, rtlRow(isRTL)]}>
                          <Feather name="phone" size={13} color={colors.accent} />
                          <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                            {isRTL ? 'الهاتف:' : 'Phone:'}
                          </Text>
                          <Text style={[styles.detailValue, { color: colors.textPrimary }]}>
                            {node.phone}
                          </Text>
                        </View>

                        {node.directReportsCount > 0 && (
                          <View style={[styles.detailItemRow, rtlRow(isRTL)]}>
                            <Feather name="users" size={13} color={colors.accent} />
                            <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                              {isRTL ? 'المرؤوسون المباشرون:' : 'Direct Reports:'}
                            </Text>
                            <Text style={[styles.detailValue, { color: colors.textPrimary }]}>
                              {node.directReportsCount} {isRTL ? 'موظفين' : 'team members'}
                            </Text>
                          </View>
                        )}
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* TAB 2: BRANCHES & ATTENDANCE */}
          {activeTab === 'branches' && (
            <View style={styles.tabBody}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }, rtlText(isRTL)]}>
                {isRTL ? 'حالة الحضور عبر الفروع ومراكز العمل عن بعد' : 'Branch Attendance & Remote Hubs'}
              </Text>

              {attendanceStats.map((branch) => (
                <View
                  key={branch.branchKey}
                  style={[
                    styles.branchCard,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                  ]}
                >
                  <View style={[styles.branchTopRow, rtlRow(isRTL)]}>
                    <View style={[styles.branchBadgeIcon, { backgroundColor: branch.badgeColor }]}>
                      <Feather
                        name={branch.branchKey === 'pakistan_remote' ? 'globe' : 'home'}
                        size={16}
                        color="#FFFFFF"
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.branchName, { color: colors.textPrimary }]}>
                        {isRTL ? branch.nameAr : branch.nameEn}
                      </Text>
                      <Text style={[styles.branchSub, { color: colors.textSecondary }]}>
                        {branch.totalHeadcount} {isRTL ? 'إجمالي الموظفين' : 'total personnel'}
                      </Text>
                    </View>
                  </View>

                  <View style={[styles.branchStatsGrid, rtlRow(isRTL)]}>
                    <View style={[styles.statBox, { backgroundColor: colors.surfaceSubtle }]}>
                      <Text style={[styles.statNum, { color: '#10B981' }]}>
                        {branch.activeWorking}
                      </Text>
                      <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                        {isRTL ? 'حضور نشط' : 'Active'}
                      </Text>
                    </View>

                    <View style={[styles.statBox, { backgroundColor: colors.surfaceSubtle }]}>
                      <Text style={[styles.statNum, { color: colors.accent }]}>
                        {branch.workingRemotely}
                      </Text>
                      <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                        {isRTL ? 'عن بعد' : 'Remote'}
                      </Text>
                    </View>

                    <View style={[styles.statBox, { backgroundColor: colors.surfaceSubtle }]}>
                      <Text style={[styles.statNum, { color: '#F59E0B' }]}>
                        {branch.onLeave}
                      </Text>
                      <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                        {isRTL ? 'في إجازة' : 'On Leave'}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* TAB 3: LEAVE APPROVAL PIPELINE */}
          {activeTab === 'pipeline' && (
            <View style={styles.tabBody}>
              {/* Pipeline Filter Bar */}
              <View style={[styles.pipelineFilterRow, rtlRow(isRTL)]}>
                <TouchableOpacity
                  style={[
                    styles.filterChip,
                    {
                      backgroundColor:
                        pipelineFilter === 'all' ? colors.primary : colors.surface,
                      borderColor: pipelineFilter === 'all' ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => setPipelineFilter('all')}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      { color: pipelineFilter === 'all' ? '#FFFFFF' : colors.textPrimary },
                    ]}
                  >
                    {isRTL ? 'الكل' : 'All'} ({approvals.length})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.filterChip,
                    {
                      backgroundColor:
                        pipelineFilter === 'pending' ? colors.primary : colors.surface,
                      borderColor:
                        pipelineFilter === 'pending' ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => setPipelineFilter('pending')}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      {
                        color:
                          pipelineFilter === 'pending' ? '#FFFFFF' : colors.textPrimary,
                      },
                    ]}
                  >
                    {isRTL ? 'بانتظار المدير' : 'Pending Manager'} ({pendingApprovals.length})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.filterChip,
                    {
                      backgroundColor:
                        pipelineFilter === 'approved' ? colors.primary : colors.surface,
                      borderColor:
                        pipelineFilter === 'approved' ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => setPipelineFilter('approved')}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      {
                        color:
                          pipelineFilter === 'approved' ? '#FFFFFF' : colors.textPrimary,
                      },
                    ]}
                  >
                    {isRTL ? 'معتمدة ومسجلة' : 'Approved / HR'} ({approvedApprovals.length})
                  </Text>
                </TouchableOpacity>
              </View>

              {visibleApprovals.length === 0 ? (
                <View style={[styles.emptyBox, { backgroundColor: colors.surface }]}>
                  <Feather name="inbox" size={36} color={colors.textMuted} />
                  <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                    {isRTL ? 'لا توجد طلبات في هذا المسار حالياً' : 'No leave requests in this view'}
                  </Text>
                </View>
              ) : (
                visibleApprovals.map((item) => {
                  const isPending = item.status === 'Pending';
                  const isApproved = item.status === 'Approved';
                  const canDecide =
                    isPending && (activeRole === 'MANAGER' || activeRole === 'ADMIN');

                  return (
                    <View
                      key={item.id}
                      style={[
                        styles.pipelineCard,
                        { backgroundColor: colors.surface, borderColor: colors.border },
                      ]}
                    >
                      <View style={[styles.pipelineCardHeader, rtlRow(isRTL)]}>
                        <View style={[styles.avatarCircle, { backgroundColor: item.avatarColor }]}>
                          <Text style={styles.avatarText}>{item.avatarInitials}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.pipelineEmpName, { color: colors.textPrimary }]}>
                            {item.employeeName}
                          </Text>
                          <Text style={[styles.pipelineEmpRole, { color: colors.textSecondary }]}>
                            {item.role}
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.stagePill,
                            {
                              backgroundColor: isApproved
                                ? 'rgba(16, 185, 129, 0.15)'
                                : 'rgba(254, 88, 0, 0.15)',
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.stagePillText,
                              { color: isApproved ? '#10B981' : MACQUIRES_PALETTE.orangePantone },
                            ]}
                          >
                            {isApproved
                              ? isRTL
                                ? 'معتمدة — مسجلة لدى الموارد'
                                : 'Approved — Logged to HR'
                              : isRTL
                                ? 'بانتظار موافقة المدير'
                                : 'Stage 1: Pending Manager'}
                          </Text>
                        </View>
                      </View>

                      <View
                        style={[
                          styles.pipelineDetails,
                          { backgroundColor: colors.surfaceSubtle, borderColor: colors.border },
                        ]}
                      >
                        <Text style={[styles.headlineText, { color: colors.textPrimary }]}>
                          {item.headline}
                        </Text>
                        <Text style={[styles.subHeadlineText, { color: colors.textSecondary }]}>
                          {item.subHeadline}
                        </Text>
                        {item.notes ? (
                          <Text style={[styles.notesText, { color: colors.textMuted }]}>
                            "{item.notes}"
                          </Text>
                        ) : null}
                      </View>

                      {/* Approval Action Buttons for Manager / Admin */}
                      {canDecide && (
                        <View style={[styles.pipelineActionsRow, rtlRow(isRTL)]}>
                          <TouchableOpacity
                            style={[styles.actionBtn, styles.approveBtn]}
                            onPress={() => onDecideApproval(item.id, 'Approved')}
                            activeOpacity={0.8}
                          >
                            <Feather name="check" size={14} color="#FFFFFF" />
                            <Text style={styles.approveBtnText}>
                              {isRTL ? 'موافقة كمدير' : 'Approve as Manager'}
                            </Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={[styles.actionBtn, styles.rejectBtn, { borderColor: colors.border }]}
                            onPress={() => onDecideApproval(item.id, 'Rejected')}
                            activeOpacity={0.8}
                          >
                            <Feather name="x" size={14} color="#EF4444" />
                            <Text style={styles.rejectBtnText}>
                              {isRTL ? 'رفض' : 'Reject'}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  );
                })
              )}
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  headerBar: {
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: 1,
  },
  circleCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
  },
  headerSub: {
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: 11,
    marginTop: 2,
  },
  activeRoleBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  activeRoleText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  roleSwitcherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 8,
  },
  switchLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  rolePillsScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingRight: 10,
  },
  rolePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    gap: 5,
  },
  rolePillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  tabsContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTabBtn: {
    borderBottomWidth: 2,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '700',
  },
  tabBadge: {
    backgroundColor: MACQUIRES_PALETTE.orangePantone,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  tabBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  contentScroll: {
    padding: 16,
    paddingBottom: 40,
  },
  tabBody: {
    gap: 12,
  },
  infoBanner: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    gap: 10,
    alignItems: 'center',
    marginBottom: 4,
  },
  infoBannerText: {
    fontSize: 12,
    flex: 1,
    lineHeight: 17,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginTop: 6,
    marginBottom: 4,
  },
  nodeCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
  },
  nodeTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  nameTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  nodeName: {
    fontSize: 13,
    fontWeight: '800',
  },
  workBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  workBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  nodeTitle: {
    fontSize: 12,
    marginTop: 2,
  },
  nodeDept: {
    fontSize: 11,
    marginTop: 1,
  },
  nodeExpandedDetails: {
    marginTop: 10,
    paddingTop: 10,
    paddingHorizontal: 8,
    paddingBottom: 6,
    borderTopWidth: 1,
    borderRadius: 8,
    gap: 6,
  },
  detailItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  detailValue: {
    fontSize: 11,
    fontWeight: '700',
    flex: 1,
  },
  branchCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },
  branchTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  branchBadgeIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  branchName: {
    fontSize: 13,
    fontWeight: '800',
  },
  branchSub: {
    fontSize: 11,
    marginTop: 2,
  },
  branchStatsGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  statBox: {
    flex: 1,
    padding: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  statNum: {
    fontSize: 16,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: 11,
    marginTop: 2,
  },
  pipelineFilterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  emptyBox: {
    padding: 30,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  emptyText: {
    fontSize: 13,
    fontWeight: '600',
  },
  pipelineCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    gap: 10,
  },
  pipelineCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pipelineEmpName: {
    fontSize: 13,
    fontWeight: '800',
  },
  pipelineEmpRole: {
    fontSize: 11,
    marginTop: 2,
  },
  stagePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  stagePillText: {
    fontSize: 10,
    fontWeight: '800',
  },
  pipelineDetails: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
    gap: 3,
  },
  headlineText: {
    fontSize: 12,
    fontWeight: '700',
  },
  subHeadlineText: {
    fontSize: 11,
  },
  notesText: {
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 4,
  },
  pipelineActionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 10,
    gap: 6,
  },
  approveBtn: {
    backgroundColor: '#10B981',
  },
  approveBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  rejectBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1,
  },
  rejectBtnText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '800',
  },
});
