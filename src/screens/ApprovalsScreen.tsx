import React, { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { formatSar, makeTr } from "../i18n/localize";
import { TRANSLATIONS } from '../i18n/translations';
import { ThemeColors } from '../theme/colors';
import { AppLanguage, rtlRow, rtlText, TYPOGRAPHY } from '../theme/typography';
import { ApprovalCategory, ApprovalItem } from '../types/zenhr';

interface ApprovalsScreenProps {
  colors: ThemeColors;
  lang: AppLanguage;
  approvals: ApprovalItem[];
  onBack: () => void;
  onDecideApproval: (id: string, decision: 'Approved' | 'Rejected') => void;
}

const CATEGORIES: ApprovalCategory[] = [
  'All',
  'Overtime',
  'Time Off',
  'Financial',
  'Loan',
];

export const ApprovalsScreen: React.FC<ApprovalsScreenProps> = ({
  colors,
  lang,
  approvals,
  onBack,
  onDecideApproval,
}) => {
  const [selectedCategory, setSelectedCategory] =
    useState<ApprovalCategory>('All');
  const [showHistory, setShowHistory] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});
  const isRTL = lang === 'ar';
  const t = TRANSLATIONS[lang] ?? TRANSLATIONS.en;
  const tr = makeTr(lang);

  const translateCategory = (cat: ApprovalCategory): string => {
    switch (cat) {
      case 'All':
        return t.all;
      case 'Overtime':
        return t.overtime;
      case 'Time Off':
        return t.timeOff;
      case 'Financial':
        return t.financial;
      case 'Loan':
        return t.loan;
    }
  };

  const translateStatus = (status: ApprovalItem['status']): string => {
    switch (status) {
      case 'Approved':
        return t.approved;
      case 'Rejected':
        return t.rejected;
      default:
        return t.pending;
    }
  };

  const visibleItems = approvals.filter((item) => {
    const matchesHistory = showHistory
      ? item.status !== 'Pending'
      : item.status === 'Pending';
    const matchesCategory =
      selectedCategory === 'All' || item.category === selectedCategory;
    return matchesHistory && matchesCategory;
  });

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Top Bar */}
      <View style={[styles.topNavigationRow, rtlRow(isRTL)]}>
        <TouchableOpacity
          style={[
            styles.circleBackButton,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
          onPress={onBack}
          accessibilityLabel={t.back}
        >
          <Feather
            name={isRTL ? 'chevron-right' : 'chevron-left'}
            size={22}
            color={colors.textPrimary}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.historyPillButton,
            rtlRow(isRTL),
            {
              backgroundColor: showHistory ? colors.primary : colors.surface,
              borderColor: colors.border,
            },
          ]}
          onPress={() => setShowHistory((prev) => !prev)}
        >
          <Feather
            name="file-text"
            size={15}
            color={showHistory ? colors.textOnPrimary : colors.textPrimary}
          />
          <Text
            style={[
              styles.historyButtonText,
              { color: showHistory ? colors.textOnPrimary : colors.textPrimary },
            ]}
            numberOfLines={1}
          >
            {showHistory ? t.pendingQueue : t.history}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text
          style={[
            TYPOGRAPHY.h1,
            styles.screenTitle,
            { color: colors.textPrimary },
            rtlText(isRTL),
          ]}
          numberOfLines={1}
        >
          {showHistory ? t.approvalHistory : t.myApprovals}
        </Text>

        {/* Type Filter Selector */}
        <Text
          style={[
            styles.typeCaption,
            { color: colors.textMuted },
            rtlText(isRTL),
          ]}
          numberOfLines={1}
        >
          {t.typeFilter}
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryFilterRow}
        >
          {CATEGORIES.map((cat) => {
            const count = approvals.filter(
              (a) =>
                (showHistory ? a.status !== 'Pending' : a.status === 'Pending') &&
                (cat === 'All' || a.category === cat)
            ).length;
            const active = selectedCategory === cat;
            return (
              <TouchableOpacity
                key={cat}
                style={[
                  styles.categoryChip,
                  rtlRow(isRTL),
                  {
                    backgroundColor: active ? colors.primarySoft : colors.surface,
                    borderColor: active ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => setSelectedCategory(cat)}
              >
                <Text
                  style={[
                    styles.categoryChipText,
                    { color: active ? colors.primary : colors.textSecondary },
                  ]}
                  numberOfLines={1}
                >
                  {translateCategory(cat)}({count})
                </Text>
                <Feather
                  name="chevron-down"
                  size={14}
                  color={active ? colors.primary : colors.textSecondary}
                />
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {visibleItems.length === 0 ? (
          <View
            style={[
              styles.emptyStateBox,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Feather
              name="check-circle"
              size={34}
              color={colors.accent}
              style={{ marginBottom: 10 }}
            />
            <Text
              style={[styles.emptyStateTitle, { color: colors.textPrimary }]}
              numberOfLines={2}
            >
              {t.noRequestsInCategory}
            </Text>
            <Text
              style={[styles.emptyStateSub, { color: colors.textMuted }]}
              numberOfLines={2}
            >
              {t.allRequestsUpToDate}
            </Text>
          </View>
        ) : (
          visibleItems.map((item) => {
            const isChecked = !!selectedIds[item.id];
            const statusBg =
              item.status === 'Approved'
                ? colors.successBg
                : item.status === 'Rejected'
                  ? colors.dangerBg
                  : colors.warningBg;
            const statusText =
              item.status === 'Approved'
                ? colors.successText
                : item.status === 'Rejected'
                  ? colors.dangerText
                  : colors.warningText;

            return (
              <View
                key={item.id}
                style={[
                  styles.approvalCard,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                {/* Header with Checkbox + Avatar + Employee Name & Role */}
                <View style={[styles.cardHeaderRow, rtlRow(isRTL)]}>
                  <TouchableOpacity
                    style={[
                      styles.checkbox,
                      {
                        borderColor: isChecked ? colors.primary : colors.textMuted,
                        backgroundColor: isChecked ? colors.primary : 'transparent',
                      },
                    ]}
                    onPress={() => toggleSelect(item.id)}
                  >
                    {isChecked && (
                      <Feather name="check" size={14} color={colors.textOnPrimary} />
                    )}
                  </TouchableOpacity>

                  <View
                    style={[
                      styles.employeeAvatar,
                      { backgroundColor: item.avatarColor },
                    ]}
                  >
                    <Text style={styles.employeeAvatarText}>
                      {item.avatarInitials}
                    </Text>
                  </View>

                  <View style={styles.employeeMetaWrap}>
                    <Text
                      style={[
                        styles.employeeName,
                        { color: colors.textPrimary },
                        rtlText(isRTL),
                      ]}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {tr(item.employeeName)}
                    </Text>
                    <Text
                      style={[
                        styles.employeeRole,
                        { color: colors.textMuted },
                        rtlText(isRTL),
                      ]}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {tr(item.role)}
                    </Text>
                  </View>

                  <Feather
                    name={isRTL ? 'chevron-left' : 'chevron-right'}
                    size={20}
                    color={colors.textMuted}
                  />
                </View>

                {/* Request Headline & Pending Pill */}
                <View style={[styles.headlineStatusRow, rtlRow(isRTL)]}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text
                      style={[
                        styles.headlineText,
                        { color: colors.textPrimary },
                        rtlText(isRTL),
                      ]}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {tr(item.headline)}
                    </Text>
                    <Text
                      style={[
                        styles.subHeadlineText,
                        { color: colors.textMuted },
                        rtlText(isRTL),
                      ]}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {tr(item.subHeadline)}
                    </Text>
                  </View>

                  <View style={[styles.statusBadge, { backgroundColor: statusBg }]}>
                    <Text
                      style={[styles.statusBadgeText, { color: statusText }]}
                      numberOfLines={1}
                    >
                      {translateStatus(item.status)}
                    </Text>
                  </View>
                </View>

                <View
                  style={[styles.divider, { backgroundColor: colors.border }]}
                />

                {/* Start Date, End Date, Amount in SAR (﷼) */}
                <View style={styles.fieldGroup}>
                  <Text
                    style={[
                      styles.fieldLabel,
                      { color: colors.textPrimary },
                      rtlText(isRTL),
                    ]}
                    numberOfLines={1}
                  >
                    {t.startDate}
                  </Text>
                  <Text
                    style={[
                      styles.fieldValue,
                      { color: colors.textSecondary },
                      rtlText(isRTL),
                    ]}
                    numberOfLines={1}
                  >
                    {tr(item.startDate)}
                  </Text>
                </View>

                <View style={styles.fieldGroup}>
                  <Text
                    style={[
                      styles.fieldLabel,
                      { color: colors.textPrimary },
                      rtlText(isRTL),
                    ]}
                    numberOfLines={1}
                  >
                    {t.endDate}
                  </Text>
                  <Text
                    style={[
                      styles.fieldValue,
                      { color: colors.textSecondary },
                      rtlText(isRTL),
                    ]}
                    numberOfLines={1}
                  >
                    {tr(item.endDate)}
                  </Text>
                </View>

                {typeof item.amountSar === 'number' && (
                  <View style={styles.fieldGroup}>
                    <Text
                      style={[
                        styles.fieldLabel,
                        { color: colors.textPrimary },
                        rtlText(isRTL),
                      ]}
                      numberOfLines={1}
                    >
                      {t.amount}
                    </Text>
                    <Text
                      style={[
                        styles.fieldValueStrong,
                        { color: colors.accent },
                        rtlText(isRTL),
                      ]}
                      numberOfLines={1}
                    >
                      {formatSar(lang, item.amountSar)}
                    </Text>
                  </View>
                )}

                {item.notes ? (
                  <Text
                    style={[
                      styles.notesText,
                      { color: colors.textMuted },
                      rtlText(isRTL),
                    ]}
                    numberOfLines={2}
                    ellipsizeMode="tail"
                  >
                    {tr(item.notes)}
                  </Text>
                ) : null}

                {/* Microsoft Teams Adaptive Card Sync Indicator */}
                <View
                  style={[
                    {
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingVertical: 8,
                      paddingHorizontal: 10,
                      borderRadius: 10,
                      backgroundColor: colors.surfaceSubtle,
                      marginBottom: 10,
                      gap: 8,
                    },
                    rtlRow(isRTL),
                  ]}
                >
                  <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }, rtlRow(isRTL)]}>
                    <Feather name="message-square" size={13} color={colors.primary} />
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: '700',
                        color: colors.textSecondary,
                        flexShrink: 1,
                      }}
                      numberOfLines={1}
                    >
                      {isRTL
                        ? 'بطاقة موافقة تفاعلية متزامنة مع Microsoft Teams'
                        : 'Synced to Microsoft Teams Adaptive Card'}
                    </Text>
                  </View>
                  <Text
                    style={{
                      fontSize: 10,
                      fontWeight: '800',
                      color: colors.accent,
                    }}
                  >
                    MS Graph v1.5
                  </Text>
                </View>

                {/* Reject / Approve Buttons */}
                {item.status === 'Pending' && (
                  <View style={[styles.actionsFooterRow, rtlRow(isRTL)]}>
                    <TouchableOpacity
                      style={[
                        styles.decisionButton,
                        { backgroundColor: colors.rejectButton },
                      ]}
                      onPress={() => onDecideApproval(item.id, 'Rejected')}
                    >
                      <Text style={styles.decisionButtonText} numberOfLines={1}>
                        {t.reject}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.decisionButton,
                        { backgroundColor: colors.primary },
                      ]}
                      onPress={() => onDecideApproval(item.id, 'Approved')}
                    >
                      <Text style={styles.decisionButtonText} numberOfLines={1}>
                        {t.approve}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topNavigationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  circleBackButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  historyPillButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 22,
    borderWidth: 1,
    gap: 6,
  },
  historyButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingBottom: 90,
  },
  screenTitle: {
    marginBottom: 14,
  },
  typeCaption: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  categoryFilterRow: {
    paddingBottom: 16,
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  categoryChipText: {
    fontSize: 13,
    fontWeight: '700',
  },
  emptyStateBox: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 28,
    alignItems: 'center',
    marginTop: 10,
  },
  emptyStateTitle: {
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 6,
  },
  emptyStateSub: {
    fontSize: 13,
    textAlign: 'center',
  },
  approvalCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    marginBottom: 14,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    gap: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.8,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  employeeAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  employeeAvatarText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  employeeMetaWrap: {
    flex: 1,
    minWidth: 0,
  },
  employeeName: {
    fontSize: 15,
    fontWeight: '700',
  },
  employeeRole: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  headlineStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 12,
  },
  headlineText: {
    fontSize: 15,
    fontWeight: '800',
  },
  subHeadlineText: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    flexShrink: 0,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    marginBottom: 12,
  },
  fieldGroup: {
    marginBottom: 10,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 2,
  },
  fieldValue: {
    fontSize: 13,
    fontWeight: '500',
  },
  fieldValueStrong: {
    fontSize: 15,
    fontWeight: '800',
  },
  notesText: {
    fontSize: 12,
    fontStyle: 'italic',
    marginBottom: 12,
  },
  actionsFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 6,
  },
  decisionButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  decisionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
});
