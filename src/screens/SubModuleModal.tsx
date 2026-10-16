import React, { useState } from 'react';
import {
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
import { CURRENT_EMPLOYEE } from '../data/mockData';
import { formatSar, makeTr } from '../i18n/localize';
import { TRANSLATIONS } from '../i18n/translations';
import { MACQUIRES_PALETTE, ThemeColors } from '../theme/colors';
import { AppLanguage, rtlRow, rtlText } from '../theme/typography';
import {
  CompanyDocument,
  DirectoryEmployee,
  FinancialTransaction,
  NotificationItem,
  SalarySlip,
  ShiftDay,
  TaskItem,
} from '../types/zenhr';

export type SubModalType =
  | 'transactions'
  | 'payroll'
  | 'directory'
  | 'documents'
  | 'schedule'
  | 'tasks'
  | 'profile'
  | 'notifications'
  | null;

interface SubModuleModalProps {
  activeModal: SubModalType;
  colors: ThemeColors;
  lang: AppLanguage;
  transactions: FinancialTransaction[];
  salarySlips: SalarySlip[];
  directory: DirectoryEmployee[];
  documents: CompanyDocument[];
  schedule: ShiftDay[];
  tasks: TaskItem[];
  notifications: NotificationItem[];
  onClose: () => void;
  onToggleTask: (taskId: string) => void;
  onAddFinancialTransaction: (title: string, amountSar: number) => void;
  onMarkAllNotificationsRead: () => void;
}

/** Extra UI strings local to this modal (EN | AR). */
const LOCAL = {
  en: {
    currencyHint: 'Currency: Saudi Riyal (﷼ SAR)',
    claimPlaceholder: 'Description (e.g. Client Dinner)',
    amountPlaceholder: '﷼ SAR',
    netSalary: 'Net Salary',
    payDate: 'Pay Date',
    status: 'Status',
    searchPlaceholder: 'Search colleagues by name, role, or department...',
    updated: 'Updated',
    due: 'Due',
    restDay: 'Rest Day',
    scheduled: 'Scheduled',
    noResults: 'No matching colleagues found',
  },
  ar: {
    currencyHint: 'العملة: الريال السعودي (﷼)',
    claimPlaceholder: 'الوصف (مثال: عشاء عمل مع عميل)',
    amountPlaceholder: '﷼ ر.س',
    netSalary: 'صافي الراتب',
    payDate: 'تاريخ الصرف',
    status: 'الحالة',
    searchPlaceholder: 'ابحث عن زميل بالاسم أو المسمى أو القسم...',
    updated: 'آخر تحديث',
    due: 'الاستحقاق',
    restDay: 'يوم راحة',
    scheduled: 'مجدول',
    noResults: 'لا يوجد زملاء مطابقون',
  },
} as const;

export const SubModuleModal: React.FC<SubModuleModalProps> = ({
  activeModal,
  colors,
  lang,
  transactions,
  salarySlips,
  directory,
  documents,
  schedule,
  tasks,
  notifications,
  onClose,
  onToggleTask,
  onAddFinancialTransaction,
  onMarkAllNotificationsRead,
}) => {
  // Default to descending (newest first) to address the Play Store review feedback
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [selectedSlipIndex, setSelectedSlipIndex] = useState(0);
  const [directoryQuery, setDirectoryQuery] = useState('');
  const [newClaimTitle, setNewClaimTitle] = useState('');
  const [newClaimAmount, setNewClaimAmount] = useState('');

  if (!activeModal) return null;

  const isRTL = lang === 'ar';
  const t = TRANSLATIONS[lang] ?? TRANSLATIONS.en;
  const L = LOCAL[lang] ?? LOCAL.en;
  const tr = makeTr(lang);
  const row = rtlRow(isRTL);
  const txt = rtlText(isRTL);
  const endAlign = { alignItems: isRTL ? 'flex-start' : 'flex-end' } as const;

  const sortedTransactions = [...transactions].sort((a, b) =>
    sortOrder === 'desc'
      ? b.dateIso.localeCompare(a.dateIso)
      : a.dateIso.localeCompare(b.dateIso)
  );

  const selectedSlip = salarySlips[selectedSlipIndex] || salarySlips[0];

  const q = directoryQuery.trim().toLowerCase();
  const filteredDirectory = directory.filter((emp) =>
    [emp.name, emp.department, emp.title, tr(emp.name), tr(emp.department), tr(emp.title)]
      .join(' ')
      .toLowerCase()
      .includes(q)
  );

  const getModalTitle = (): string => {
    switch (activeModal) {
      case 'transactions':
        return t.financialTransactionsTitle;
      case 'payroll':
        return t.payrollTitle;
      case 'directory':
        return t.directoryTitle;
      case 'documents':
        return t.documentsTitle;
      case 'schedule':
        return t.scheduleTitle;
      case 'tasks':
        return t.tasksTitle;
      case 'profile':
        return t.profileTitle;
      case 'notifications':
        return t.notificationsTitle;
      default:
        return '';
    }
  };

  const cardStyle = [
    styles.card,
    { backgroundColor: colors.surface, borderColor: colors.border },
  ];

  const SlipRow = ({
    label,
    value,
    valueColor,
  }: {
    label: string;
    value: string;
    valueColor?: string;
  }) => (
    <View style={[styles.slipRow, row]}>
      <Text
        style={[styles.slipLabel, { color: colors.textSecondary }, txt]}
        numberOfLines={1}
        ellipsizeMode="tail"
      >
        {label}
      </Text>
      <Text
        style={[styles.slipVal, { color: valueColor ?? colors.textPrimary }]}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );

  const profileFields: Array<[string, string]> = [
    [tr('Employee ID'), CURRENT_EMPLOYEE.id],
    [
      tr('Department'),
      isRTL ? CURRENT_EMPLOYEE.departmentAr : CURRENT_EMPLOYEE.department,
    ],
    [tr('Branch'), tr(CURRENT_EMPLOYEE.branch)],
    [tr('Direct Manager'), tr(CURRENT_EMPLOYEE.manager)],
    [tr('Join Date'), tr(CURRENT_EMPLOYEE.joinDate)],
    [tr('Email'), CURRENT_EMPLOYEE.email],
    [tr('Phone'), CURRENT_EMPLOYEE.phone],
    [tr('GOSI Number'), CURRENT_EMPLOYEE.gosiNumber],
    [tr('IBAN'), CURRENT_EMPLOYEE.iban],
  ];

  return (
    <Modal
      visible={!!activeModal}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <SafeAreaProvider>
        <SafeAreaView
          style={[styles.container, { backgroundColor: colors.background }]}
          edges={['top', 'left', 'right', 'bottom']}
        >
          {/* Top Bar */}
          <View style={[styles.headerRow, row]}>
            <TouchableOpacity
              style={[
                styles.backBtn,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
              onPress={onClose}
              accessibilityLabel={t.back}
            >
              <Feather
                name={isRTL ? 'chevron-right' : 'chevron-left'}
                size={22}
                color={colors.textPrimary}
              />
            </TouchableOpacity>
            <Text
              style={[styles.headerTitle, { color: colors.textPrimary }]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {getModalTitle()}
            </Text>
            <View style={styles.headerSpacer} />
          </View>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* 1. FINANCIAL TRANSACTIONS */}
            {activeModal === 'transactions' && (
              <>
                <View style={[styles.sortToolbar, row]}>
                  <Text
                    style={[styles.toolbarHint, { color: colors.textMuted }, txt]}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {L.currencyHint}
                  </Text>
                  <TouchableOpacity
                    style={[
                      styles.sortButton,
                      row,
                      { backgroundColor: colors.primarySoft, borderColor: colors.primary },
                    ]}
                    onPress={() =>
                      setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'))
                    }
                  >
                    <Feather
                      name={sortOrder === 'desc' ? 'arrow-down' : 'arrow-up'}
                      size={14}
                      color={colors.primary}
                    />
                    <Text
                      style={[styles.sortButtonText, { color: colors.primary }]}
                      numberOfLines={1}
                    >
                      {sortOrder === 'desc' ? t.newestFirst : t.oldestFirst}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Quick Expense Claim Composer */}
                <View style={cardStyle}>
                  <Text
                    style={[styles.cardSectionTitle, { color: colors.textPrimary }, txt]}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {t.submitExpenseClaim}
                  </Text>
                  <View style={[styles.inlineInputRow, row]}>
                    <TextInput
                      style={[
                        styles.inlineInput,
                        { flex: 2, borderColor: colors.border, color: colors.textPrimary },
                        txt,
                      ]}
                      placeholder={L.claimPlaceholder}
                      placeholderTextColor={colors.textMuted}
                      value={newClaimTitle}
                      onChangeText={setNewClaimTitle}
                    />
                    <TextInput
                      style={[
                        styles.inlineInput,
                        { flex: 1, borderColor: colors.border, color: colors.textPrimary },
                        txt,
                      ]}
                      placeholder={L.amountPlaceholder}
                      placeholderTextColor={colors.textMuted}
                      keyboardType="numeric"
                      value={newClaimAmount}
                      onChangeText={setNewClaimAmount}
                    />
                  </View>
                  <TouchableOpacity
                    style={[styles.submitSmallBtn, { backgroundColor: colors.accent }]}
                    onPress={() => {
                      const parsed = parseFloat(newClaimAmount);
                      if (newClaimTitle.trim() && !isNaN(parsed) && parsed > 0) {
                        onAddFinancialTransaction(newClaimTitle.trim(), parsed);
                        setNewClaimTitle('');
                        setNewClaimAmount('');
                      }
                    }}
                  >
                    <Text style={styles.submitSmallBtnText} numberOfLines={1}>
                      {t.submitClaimBtn}
                    </Text>
                  </TouchableOpacity>
                </View>

                {sortedTransactions.map((txn) => {
                  const pending = txn.status === 'Pending';
                  return (
                    <View key={txn.id} style={cardStyle}>
                      <View style={[styles.rowBetween, row]}>
                        <View style={styles.flexText}>
                          <Text
                            style={[styles.itemTitle, { color: colors.textPrimary }, txt]}
                            numberOfLines={2}
                            ellipsizeMode="tail"
                          >
                            {tr(txn.title)}
                          </Text>
                          <Text
                            style={[styles.itemSub, { color: colors.textMuted }, txt]}
                            numberOfLines={1}
                            ellipsizeMode="tail"
                          >
                            {tr(txn.type)} • {tr(txn.dateFormatted)} • {txn.referenceCode}
                          </Text>
                        </View>
                        <View style={[styles.amountCol, endAlign]}>
                          <Text
                            style={[styles.amountText, { color: colors.primary }]}
                            numberOfLines={1}
                          >
                            {formatSar(lang, txn.amountSar)}
                          </Text>
                          <View
                            style={[
                              styles.miniPill,
                              { backgroundColor: pending ? colors.warningBg : colors.successBg },
                            ]}
                          >
                            <Text
                              style={[
                                styles.miniPillText,
                                { color: pending ? colors.warningText : colors.successText },
                              ]}
                              numberOfLines={1}
                            >
                              {tr(txn.status)}
                            </Text>
                          </View>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </>
            )}

            {/* 2. PAYROLL & SALARY SLIPS */}
            {activeModal === 'payroll' && selectedSlip && (
              <>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={[styles.monthTabsRow, row]}
                >
                  {salarySlips.map((slip, idx) => {
                    const active = idx === selectedSlipIndex;
                    return (
                      <TouchableOpacity
                        key={slip.id}
                        style={[
                          styles.monthTab,
                          {
                            backgroundColor: active ? colors.primary : colors.surface,
                            borderColor: active ? colors.primary : colors.border,
                          },
                        ]}
                        onPress={() => setSelectedSlipIndex(idx)}
                      >
                        <Text
                          style={[
                            styles.monthTabText,
                            { color: active ? colors.textOnPrimary : colors.textPrimary },
                          ]}
                          numberOfLines={1}
                        >
                          {tr(slip.monthLabel)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                <View style={[styles.netPayHero, { backgroundColor: colors.primary }]}>
                  <Text style={[styles.netPayCaption, txt]} numberOfLines={1}>
                    {L.netSalary} ({tr(selectedSlip.monthLabel)})
                  </Text>
                  <Text style={[styles.netPayValue, txt]} numberOfLines={1} adjustsFontSizeToFit>
                    {formatSar(lang, selectedSlip.netSalarySar)}
                  </Text>
                  <Text style={[styles.netPayMeta, txt]} numberOfLines={1} ellipsizeMode="tail">
                    {L.payDate}: {tr(selectedSlip.payDate)} • {L.status}: {tr(selectedSlip.status)}
                  </Text>
                </View>

                <View style={cardStyle}>
                  <Text style={[styles.cardSectionTitle, { color: colors.textPrimary }, txt]}>
                    {tr('Earnings Breakdown')}
                  </Text>
                  <SlipRow label={tr('Basic Salary')} value={formatSar(lang, selectedSlip.basicSalarySar)} />
                  <SlipRow label={tr('Housing Allowance (25%)')} value={formatSar(lang, selectedSlip.housingAllowanceSar)} />
                  <SlipRow label={tr('Transport Allowance (10%)')} value={formatSar(lang, selectedSlip.transportAllowanceSar)} />
                  <SlipRow
                    label={tr('Approved Overtime')}
                    value={`+${formatSar(lang, selectedSlip.overtimeSar)}`}
                    valueColor={colors.successText}
                  />

                  <View style={[styles.divider, { backgroundColor: colors.border }]} />

                  <Text style={[styles.cardSectionTitle, { color: colors.textPrimary }, txt]}>
                    {tr('Deductions')}
                  </Text>
                  <SlipRow
                    label={tr('GOSI Social Insurance')}
                    value={`-${formatSar(lang, selectedSlip.gosiDeductionSar)}`}
                    valueColor={colors.dangerText}
                  />
                </View>
              </>
            )}

            {/* 3. EMPLOYEE DIRECTORY */}
            {activeModal === 'directory' && (
              <>
                <View
                  style={[
                    styles.searchBox,
                    row,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                  ]}
                >
                  <View style={styles.iconSlot}>
                    <Feather name="search" size={16} color={colors.textMuted} />
                  </View>
                  <TextInput
                    style={[styles.searchInput, { color: colors.textPrimary }, txt]}
                    placeholder={L.searchPlaceholder}
                    placeholderTextColor={colors.textMuted}
                    value={directoryQuery}
                    onChangeText={setDirectoryQuery}
                  />
                </View>

                {filteredDirectory.length === 0 && (
                  <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                    {L.noResults}
                  </Text>
                )}

                {filteredDirectory.map((emp) => {
                  const pillBg =
                    emp.status === 'In Office'
                      ? colors.successBg
                      : emp.status === 'Remote'
                        ? colors.primarySoft
                        : colors.warningBg;
                  const pillFg =
                    emp.status === 'In Office'
                      ? colors.successText
                      : emp.status === 'Remote'
                        ? colors.primary
                        : colors.warningText;
                  return (
                    <View key={emp.id} style={cardStyle}>
                      <View style={[styles.directoryRow, row]}>
                        <View style={[styles.dirAvatar, { backgroundColor: emp.avatarColor }]}>
                          <Text style={styles.dirAvatarText}>{emp.avatarInitials}</Text>
                        </View>
                        <View style={styles.flexText}>
                          <Text
                            style={[styles.itemTitle, { color: colors.textPrimary }, txt]}
                            numberOfLines={1}
                            ellipsizeMode="tail"
                          >
                            {tr(emp.name)}
                          </Text>
                          <Text
                            style={[styles.itemSub, { color: colors.textSecondary }, txt]}
                            numberOfLines={1}
                            ellipsizeMode="tail"
                          >
                            {tr(emp.title)} • {tr(emp.department)}
                          </Text>
                          <View style={[styles.contactRow, row]}>
                            <View style={styles.iconSlotSm}>
                              <Feather name="mail" size={12} color={colors.textMuted} />
                            </View>
                            <Text
                              style={[styles.dirContact, { color: colors.textMuted }, txt]}
                              numberOfLines={1}
                              ellipsizeMode="tail"
                            >
                              {emp.email}
                            </Text>
                          </View>
                          <View style={[styles.contactRow, row]}>
                            <View style={styles.iconSlotSm}>
                              <Feather name="phone" size={12} color={colors.textMuted} />
                            </View>
                            <Text
                              style={[styles.dirContact, { color: colors.textMuted }, txt]}
                              numberOfLines={1}
                              ellipsizeMode="tail"
                            >
                              {emp.phone} • {tr(emp.location)}
                            </Text>
                          </View>
                        </View>
                        <View style={[styles.miniPill, { backgroundColor: pillBg }]}>
                          <Text style={[styles.miniPillText, { color: pillFg }]} numberOfLines={1}>
                            {tr(emp.status)}
                          </Text>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </>
            )}

            {/* 4. DOCUMENTS */}
            {activeModal === 'documents' &&
              documents.map((doc) => (
                <View key={doc.id} style={cardStyle}>
                  <View style={[styles.rowBetween, row]}>
                    <View style={[styles.directoryRow, row, styles.flexText]}>
                      <View
                        style={[styles.docIconBox, { backgroundColor: colors.surfaceSubtle }]}
                      >
                        <Feather name="file-text" size={18} color={colors.accent} />
                      </View>
                      <View style={styles.flexText}>
                        <Text
                          style={[styles.itemTitle, { color: colors.textPrimary }, txt]}
                          numberOfLines={2}
                          ellipsizeMode="tail"
                        >
                          {tr(doc.title)}
                        </Text>
                        <Text
                          style={[styles.itemSub, { color: colors.textMuted }, txt]}
                          numberOfLines={1}
                          ellipsizeMode="tail"
                        >
                          {tr(doc.category)} • {doc.sizeLabel} • {L.updated} {tr(doc.updatedAt)}
                        </Text>
                      </View>
                    </View>
                    {doc.status && (
                      <View
                        style={[
                          styles.miniPill,
                          {
                            backgroundColor:
                              doc.status === 'Verified' ? colors.successBg : colors.warningBg,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.miniPillText,
                            {
                              color:
                                doc.status === 'Verified'
                                  ? colors.successText
                                  : colors.warningText,
                            },
                          ]}
                          numberOfLines={1}
                        >
                          {tr(doc.status)}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              ))}

            {/* 5. WORK SCHEDULE */}
            {activeModal === 'schedule' &&
              schedule.map((sh) => (
                <View key={sh.id} style={cardStyle}>
                  <View style={[styles.rowBetween, row]}>
                    <View style={styles.flexText}>
                      <Text
                        style={[styles.itemTitle, { color: colors.textPrimary }, txt]}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {tr(sh.dayName)} • {tr(sh.dateLabel)}
                      </Text>
                      <Text
                        style={[styles.itemSub, { color: colors.textSecondary }, txt]}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {tr(sh.shiftName)} ({tr(sh.interval)})
                      </Text>
                      <View style={[styles.contactRow, row]}>
                        <View style={styles.iconSlotSm}>
                          <Feather name="map-pin" size={12} color={colors.accent} />
                        </View>
                        <Text
                          style={[styles.dirContact, { color: colors.textMuted }, txt]}
                          numberOfLines={1}
                          ellipsizeMode="tail"
                        >
                          {tr(sh.location)}
                        </Text>
                      </View>
                    </View>
                    <View
                      style={[
                        styles.miniPill,
                        { backgroundColor: sh.isRestDay ? colors.surfaceSubtle : colors.primarySoft },
                      ]}
                    >
                      <Text
                        style={[
                          styles.miniPillText,
                          { color: sh.isRestDay ? colors.textMuted : colors.primary },
                        ]}
                        numberOfLines={1}
                      >
                        {sh.isRestDay ? L.restDay : L.scheduled}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}

            {/* 6. TASKS */}
            {activeModal === 'tasks' &&
              tasks.map((tsk) => (
                <TouchableOpacity
                  key={tsk.id}
                  style={cardStyle}
                  onPress={() => onToggleTask(tsk.id)}
                >
                  <View style={[styles.directoryRow, row]}>
                    <View
                      style={[
                        styles.taskCheck,
                        {
                          borderColor: tsk.completed ? colors.accent : colors.textMuted,
                          backgroundColor: tsk.completed ? colors.accent : 'transparent',
                        },
                      ]}
                    >
                      {tsk.completed && (
                        <Feather name="check" size={14} color={colors.textOnPrimary} />
                      )}
                    </View>
                    <View style={styles.flexText}>
                      <Text
                        style={[
                          styles.itemTitle,
                          {
                            color: colors.textPrimary,
                            textDecorationLine: tsk.completed ? 'line-through' : 'none',
                          },
                          txt,
                        ]}
                        numberOfLines={2}
                        ellipsizeMode="tail"
                      >
                        {tr(tsk.title)}
                      </Text>
                      <Text
                        style={[styles.itemSub, { color: colors.textMuted }, txt]}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {tr(tsk.category)} • {L.due}: {tr(tsk.dueDate)}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}

            {/* 7. EMPLOYEE PROFILE */}
            {activeModal === 'profile' && (
              <View style={cardStyle}>
                <View style={styles.profileHeader}>
                  <View
                    style={[styles.profileLargeAvatar, { backgroundColor: colors.primary }]}
                  >
                    <Text style={styles.profileLargeAvatarText}>RA</Text>
                  </View>
                  <Text
                    style={[styles.profileName, { color: colors.textPrimary }]}
                    numberOfLines={1}
                  >
                    {isRTL ? CURRENT_EMPLOYEE.fullNameAr : CURRENT_EMPLOYEE.fullName}
                  </Text>
                  <Text
                    style={[styles.profileRole, { color: colors.accent }]}
                    numberOfLines={1}
                  >
                    {isRTL ? CURRENT_EMPLOYEE.titleAr : CURRENT_EMPLOYEE.title}
                  </Text>
                </View>

                <View style={[styles.divider, { backgroundColor: colors.border }]} />

                {profileFields.map(([label, value]) => (
                  <SlipRow key={label} label={label} value={value} />
                ))}
              </View>
            )}

            {/* 8. NOTIFICATIONS INBOX */}
            {activeModal === 'notifications' && (
              <>
                <View style={[styles.sortToolbar, row]}>
                  <Text
                    style={[styles.toolbarHint, { color: colors.textMuted }, txt]}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {tr('Push Notifications & Alerts')}
                  </Text>
                  <TouchableOpacity onPress={onMarkAllNotificationsRead}>
                    <Text
                      style={[styles.sortButtonText, { color: colors.accent }]}
                      numberOfLines={1}
                    >
                      {t.markAllRead}
                    </Text>
                  </TouchableOpacity>
                </View>
                {notifications.map((n) => (
                  <View
                    key={n.id}
                    style={[
                      styles.card,
                      {
                        backgroundColor: colors.surface,
                        borderColor: n.read ? colors.border : colors.accent,
                      },
                    ]}
                  >
                    <View style={[styles.notifTitleRow, row]}>
                      {!n.read && (
                        <View style={[styles.unreadDot, { backgroundColor: colors.accent }]} />
                      )}
                      <Text
                        style={[styles.itemTitle, styles.flexText, { color: colors.textPrimary }, txt]}
                        numberOfLines={2}
                        ellipsizeMode="tail"
                      >
                        {tr(n.title)}
                      </Text>
                    </View>
                    <Text
                      style={[styles.itemSub, { color: colors.textSecondary }, txt]}
                      numberOfLines={3}
                      ellipsizeMode="tail"
                    >
                      {tr(n.body)}
                    </Text>
                    <Text style={[styles.dirContact, { color: colors.textMuted }, txt]}>
                      {tr(n.timeAgo)}
                    </Text>
                  </View>
                ))}
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 14,
    gap: 10,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  headerTitle: {
    flex: 1,
    minWidth: 0,
    fontSize: 19,
    fontWeight: '800',
    textAlign: 'center',
  },
  headerSpacer: {
    width: 44,
    flexShrink: 0,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 60,
  },
  sortToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    gap: 10,
  },
  toolbarHint: {
    flex: 1,
    minWidth: 0,
    fontSize: 13,
    fontWeight: '600',
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    flexShrink: 0,
  },
  sortButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
  card: {
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  cardSectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 10,
  },
  inlineInputRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  inlineInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    minWidth: 0,
  },
  submitSmallBtn: {
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
  },
  submitSmallBtnText: {
    color: MACQUIRES_PALETTE.white,
    fontSize: 14,
    fontWeight: '700',
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  flexText: {
    flex: 1,
    minWidth: 0,
  },
  amountCol: {
    gap: 6,
    flexShrink: 0,
    maxWidth: '45%',
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
    lineHeight: 22,
  },
  itemSub: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 20,
  },
  amountText: {
    fontSize: 15,
    fontWeight: '800',
  },
  miniPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    flexShrink: 0,
  },
  miniPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  monthTabsRow: {
    gap: 10,
    paddingBottom: 14,
  },
  monthTab: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
  },
  monthTabText: {
    fontSize: 14,
    fontWeight: '700',
  },
  netPayHero: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 14,
  },
  netPayCaption: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
  },
  netPayValue: {
    color: MACQUIRES_PALETTE.white,
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 6,
  },
  netPayMeta: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    fontWeight: '600',
  },
  slipRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 12,
  },
  slipLabel: {
    flex: 1,
    minWidth: 0,
    fontSize: 14,
    fontWeight: '600',
  },
  slipVal: {
    flexShrink: 1,
    maxWidth: '60%',
    fontSize: 14,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    marginVertical: 12,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    marginBottom: 14,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 12,
    fontSize: 14,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 13,
    marginVertical: 20,
  },
  iconSlot: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  iconSlotSm: {
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  directoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 4,
  },
  dirAvatar: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  dirAvatarText: {
    color: MACQUIRES_PALETTE.white,
    fontSize: 16,
    fontWeight: '800',
  },
  docIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  dirContact: {
    flexShrink: 1,
    fontSize: 12,
    marginTop: 2,
  },
  taskCheck: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  notifTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },
  profileHeader: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  profileLargeAvatar: {
    width: 76,
    height: 76,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  profileLargeAvatarText: {
    color: MACQUIRES_PALETTE.white,
    fontSize: 26,
    fontWeight: '800',
  },
  profileName: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 4,
  },
  profileRole: {
    fontSize: 14,
    fontWeight: '700',
  },
});
