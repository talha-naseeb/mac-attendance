import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  ListRenderItemInfo,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { DashboardSectionSkeleton } from '../components/DashboardSkeleton';
import { ExecutiveSidebarDrawer } from '../components/ExecutiveSidebarDrawer';
import { MacqLogo } from '../components/MacqLogo';
import { makeTr } from '../i18n/localize';
import { TRANSLATIONS } from '../i18n/translations';
import {
  createInitialHydrationMap,
  DashboardSectionDescriptor,
  filterActionsByRole,
  getAuthorizedDashboardSections,
  ROLE_REGISTRY,
  SectionHydrationMap,
  UserRole,
} from '../services/dashboardOptimizationService';
import { EditableEmployeeProfile } from '../services/profileSettingsService';
import { MACQUIRES_PALETTE, ThemeColors } from '../theme/colors';
import { AppLanguage, rtlRow, rtlText, TYPOGRAPHY } from '../theme/typography';
import {
  ActionItem,
  ActionModuleId,
  BirthdayEntry,
  CompanyEvent,
  LeaveBalance,
  LeaveType,
  WhosOffEntry,
} from '../types/zenhr';

interface DashboardScreenProps {
  colors: ThemeColors;
  lang: AppLanguage;
  employeeName: string;
  employeeProfile: EditableEmployeeProfile;
  leaveBalances: LeaveBalance[];
  actions: ActionItem[];
  whosOff: WhosOffEntry[];
  birthdays: BirthdayEntry[];
  events: CompanyEvent[];
  unreadNotificationsCount: number;
  onOpenModule: (moduleId: ActionModuleId) => void;
  onOpenProfile: () => void;
  onOpenSettings?: () => void;
  onUpdateProfile?: (updated: EditableEmployeeProfile) => void;
  onOpenNotifications: () => void;
  onOpenQuickRequest: () => void;
  onToggleTheme: () => void;
  onToggleLanguage: () => void;
  onToggleBiometricLock: () => void;
  onRearrangeActions: () => void;
  onOpenMicrosoft365?: () => void;
  microsoftConnected?: boolean;
  teamsAvailability?: string;
  onLogout?: () => void;
  userRole?: UserRole;
  onSelectRole?: (role: UserRole) => void;
}

const ROLES_ORDER: UserRole[] = ['MANAGER', 'EMPLOYEE', 'HR_ADMIN'];

export const DashboardScreen: React.FC<DashboardScreenProps> = ({
  colors,
  lang,
  employeeName,
  employeeProfile,
  leaveBalances,
  actions,
  whosOff,
  birthdays,
  events,
  unreadNotificationsCount,
  onOpenModule,
  onOpenProfile,
  onOpenSettings,
  onOpenNotifications,
  onOpenQuickRequest,
  onToggleTheme,
  onToggleLanguage,
  onToggleBiometricLock,
  onRearrangeActions,
  onOpenMicrosoft365,
  microsoftConnected = true,
  teamsAvailability = 'Available',
  onLogout,
  userRole,
  onSelectRole,
}) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [internalRole, setInternalRole] = useState<UserRole>(userRole ?? 'MANAGER');
  const activeRole = userRole ?? internalRole;
  const [hydratedSections, setHydratedSections] = useState<SectionHydrationMap>(
    () => createInitialHydrationMap(false)
  );

  useEffect(() => {
    if (userRole) {
      setInternalRole(userRole);
    }
  }, [userRole]);

  const isRTL = lang === 'ar';
  const t = TRANSLATIONS[lang] ?? TRANSLATIONS.en;
  const tr = makeTr(lang);

  // Authorized sections & actions resolved synchronously from Role JWT claims (0ms, zero flicker)
  const authorizedSections = useMemo(
    () => getAuthorizedDashboardSections(activeRole),
    [activeRole]
  );
  const roleAuthorizedActions = useMemo(
    () => filterActionsByRole(actions, activeRole),
    [actions, activeRole]
  );

  // Tiered Progressive Skeleton Hydration:
  // Tier 1 (Core Balances) -> Tier 2 (Actions) -> Tier 3 (Feed below the fold)
  useEffect(() => {
    setHydratedSections(createInitialHydrationMap(false));
    const timers = authorizedSections.map((sec) =>
      setTimeout(() => {
        setHydratedSections((prev) => ({
          ...prev,
          [sec.id]: true,
        }));
      }, sec.simulatedColdLatencyMs)
    );
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
    };
  }, [activeRole, authorizedSections]);

  const handleSelectRole = useCallback(
    (nextRole: UserRole) => {
      setInternalRole(nextRole);
      onSelectRole?.(nextRole);
    },
    [onSelectRole]
  );

  // Ensure avatars never blend into the card surface (e.g. Prussian Blue on Prussian Blue in dark mode).
  const avatarBg = useCallback(
    (c: string) =>
      c.toLowerCase() === colors.surface.toLowerCase()
        ? MACQUIRES_PALETTE.bdazzledBlue
        : c,
    [colors.surface]
  );

  const translateLeaveType = useCallback(
    (lt: LeaveType | string): string => {
      switch (lt) {
        case 'Annual Vacation':
          return t.annualVacation;
        case 'Sick Day off':
          return t.sickDayOff;
        case 'Sick on file':
          return t.sickOnFile;
        case 'Remote Work':
          return t.remoteWork;
        case 'Emergency Leave':
          return t.emergencyLeave;
        case 'Unpaid Leave':
          return t.unpaidLeave;
        default:
          return lt;
      }
    },
    [t]
  );

  const translateActionLabel = useCallback(
    (id: ActionModuleId, fallback: string): string => {
      return t[id] || fallback;
    },
    [t]
  );

  const renderSectionItem = useCallback(
    ({ item: section }: ListRenderItemInfo<DashboardSectionDescriptor>) => {
      const isHydrated = hydratedSections[section.id];

      if (section.id === 'balances') {
        return (
          <View>
            <View style={[styles.sectionHeaderRow, rtlRow(isRTL)]}>
              <Text
                style={[
                  TYPOGRAPHY.sectionTitle,
                  { color: colors.textSecondary, flex: 1 },
                  rtlText(isRTL),
                ]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {t.myRemainingBalance}
              </Text>
            </View>
            {!isHydrated ? (
              <DashboardSectionSkeleton
                sectionId="balances"
                colors={colors}
                isRTL={isRTL}
              />
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.balanceScrollContent}
              >
                {leaveBalances.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      styles.balanceCard,
                      rtlRow(isRTL),
                      {
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                      },
                    ]}
                    onPress={onOpenQuickRequest}
                    activeOpacity={0.85}
                  >
                    <View style={styles.balanceCardContent}>
                      <Text
                        style={[
                          styles.balanceTitle,
                          { color: colors.textPrimary },
                          rtlText(isRTL),
                        ]}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {translateLeaveType(item.title)}
                      </Text>
                      <Text
                        style={[
                          styles.balanceValueRow,
                          { color: colors.textMuted },
                          rtlText(isRTL),
                        ]}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        <Text
                          style={[
                            styles.balanceStrong,
                            { color: item.accentColor },
                          ]}
                        >
                          {item.remaining.toFixed(2)}
                        </Text>{' '}
                        / {item.total.toFixed(2)}{' '}
                        {item.unit === 'days' ? t.days : t.hours}
                      </Text>
                    </View>
                    <View style={styles.chevronBox}>
                      <Feather
                        name={isRTL ? 'chevron-left' : 'chevron-right'}
                        size={18}
                        color={colors.textMuted}
                      />
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        );
      }

      if (section.id === 'actions') {
        return (
          <View>
            <View style={[styles.sectionHeaderRow, rtlRow(isRTL)]}>
              <Text
                style={[
                  TYPOGRAPHY.sectionTitle,
                  { color: colors.textSecondary, flex: 1 },
                  rtlText(isRTL),
                ]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {t.myActions}
              </Text>
              <TouchableOpacity
                style={[styles.arrangeBtn, rtlRow(isRTL)]}
                onPress={onRearrangeActions}
              >
                <Feather name="sliders" size={13} color={colors.accent} />
                <Text
                  style={[styles.arrangeButtonText, { color: colors.accent }]}
                  numberOfLines={1}
                >
                  {t.arrange}
                </Text>
              </TouchableOpacity>
            </View>

            {!isHydrated ? (
              <DashboardSectionSkeleton
                sectionId="actions"
                colors={colors}
                isRTL={isRTL}
                actionCardCount={roleAuthorizedActions.length}
              />
            ) : (
              <View style={[styles.actionsGrid, rtlRow(isRTL)]}>
                {roleAuthorizedActions.map((act) => (
                  <TouchableOpacity
                    key={act.id}
                    style={[
                      styles.actionCard,
                      rtlRow(isRTL),
                      {
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                      },
                    ]}
                    onPress={() => onOpenModule(act.id)}
                    activeOpacity={0.8}
                  >
                    {act.badgeCount && act.badgeCount > 0 ? (
                      <View
                        style={[
                          styles.actionBadge,
                          { backgroundColor: colors.badgeRed },
                          isRTL ? { left: 8, right: undefined } : { right: 8 },
                        ]}
                      >
                        <Text style={styles.actionBadgeText} numberOfLines={1}>
                          {act.badgeCount}
                        </Text>
                      </View>
                    ) : null}
                    <View
                      style={[
                        styles.actionIconCircle,
                        { backgroundColor: `${act.tint}18` },
                      ]}
                    >
                      <Feather
                        name={
                          act.icon as React.ComponentProps<typeof Feather>['name']
                        }
                        size={19}
                        color={colors.isDark ? colors.textOnPrimary : act.tint}
                      />
                    </View>
                    <Text
                      style={[
                        styles.actionLabel,
                        { color: colors.textPrimary },
                        rtlText(isRTL),
                      ]}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {translateActionLabel(act.id, act.label)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <View style={styles.dotsRow}>
              <View
                style={[styles.dotActive, { backgroundColor: colors.accent }]}
              />
              <View
                style={[styles.dotInactive, { backgroundColor: colors.border }]}
              />
            </View>
          </View>
        );
      }

      if (section.id === 'whos_off') {
        return (
          <View>
            <View style={[styles.sectionHeaderRow, rtlRow(isRTL)]}>
              <Text
                style={[
                  TYPOGRAPHY.sectionTitle,
                  { color: colors.textSecondary, flex: 1 },
                  rtlText(isRTL),
                ]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {t.whosOffRemote}
              </Text>
            </View>

            {!isHydrated ? (
              <DashboardSectionSkeleton
                sectionId="whos_off"
                colors={colors}
                isRTL={isRTL}
              />
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.horizontalCardsRow}
              >
                {whosOff.map((entry) => (
                  <View
                    key={entry.id}
                    style={[
                      styles.whosOffCard,
                      {
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <View style={[styles.whosOffTopRow, rtlRow(isRTL)]}>
                      <View style={styles.whosOffAvatarWrap}>
                        <View
                          style={[
                            styles.whosOffAvatar,
                            {
                              backgroundColor: avatarBg(entry.avatarColor),
                              borderColor: colors.isDark
                                ? 'rgba(255,255,255,0.2)'
                                : 'rgba(0,0,0,0.06)',
                            },
                          ]}
                        >
                          <Text style={styles.whosOffAvatarText}>
                            {entry.avatarInitials}
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.whosOffMiniIconBadge,
                            isRTL ? styles.badgeStart : styles.badgeEnd,
                            {
                              backgroundColor: colors.isDark
                                ? MACQUIRES_PALETTE.oxfordBlue
                                : MACQUIRES_PALETTE.white,
                              borderColor: colors.isDark
                                ? MACQUIRES_PALETTE.bdazzledBlue
                                : colors.border,
                            },
                          ]}
                        >
                          <Feather
                            name={
                              entry.type === 'Remote Work' ? 'home' : 'sun'
                            }
                            size={11}
                            color={colors.accent}
                          />
                        </View>
                      </View>

                      <View
                        style={[
                          styles.whosOffPillBox,
                          {
                            backgroundColor: colors.surfaceSubtle,
                            borderColor: colors.border,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.whosOffPillTitle,
                            { color: colors.textPrimary },
                          ]}
                          numberOfLines={1}
                          ellipsizeMode="tail"
                        >
                          {translateLeaveType(entry.type)}
                        </Text>
                        <Text
                          style={[
                            styles.whosOffPillSub,
                            { color: colors.textMuted },
                          ]}
                          numberOfLines={1}
                        >
                          {tr(entry.durationLabel)}
                        </Text>
                      </View>
                    </View>

                    <Text
                      style={[
                        styles.whosOffName,
                        { color: colors.textPrimary },
                        rtlText(isRTL),
                      ]}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {tr(entry.employeeName)}
                    </Text>
                    <Text
                      style={[
                        styles.whosOffDates,
                        { color: colors.textMuted },
                        rtlText(isRTL),
                      ]}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {tr(entry.fromDate)} → {tr(entry.toDate)}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        );
      }

      if (section.id === 'birthdays') {
        return (
          <View>
            <View style={[styles.sectionHeaderRow, rtlRow(isRTL)]}>
              <Text
                style={[
                  TYPOGRAPHY.sectionTitle,
                  { color: colors.textSecondary, flex: 1 },
                  rtlText(isRTL),
                ]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {t.upcomingBirthdays}
              </Text>
            </View>

            {!isHydrated ? (
              <DashboardSectionSkeleton
                sectionId="birthdays"
                colors={colors}
                isRTL={isRTL}
              />
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.horizontalCardsRow}
              >
                {birthdays.map((bday) => (
                  <View
                    key={bday.id}
                    style={[
                      styles.whosOffCard,
                      {
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <View style={[styles.whosOffTopRow, rtlRow(isRTL)]}>
                      <View style={styles.whosOffAvatarWrap}>
                        <View
                          style={[
                            styles.whosOffAvatar,
                            {
                              backgroundColor: avatarBg(bday.avatarColor),
                              borderColor: colors.isDark
                                ? 'rgba(255,255,255,0.2)'
                                : 'rgba(0,0,0,0.06)',
                            },
                          ]}
                        >
                          <Text style={styles.whosOffAvatarText}>
                            {bday.avatarInitials}
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.whosOffMiniIconBadge,
                            isRTL ? styles.badgeStart : styles.badgeEnd,
                            {
                              backgroundColor: colors.isDark
                                ? MACQUIRES_PALETTE.oxfordBlue
                                : MACQUIRES_PALETTE.white,
                              borderColor: colors.isDark
                                ? MACQUIRES_PALETTE.bdazzledBlue
                                : colors.border,
                            },
                          ]}
                        >
                          <Feather
                            name="gift"
                            size={11}
                            color={colors.accent}
                          />
                        </View>
                      </View>

                      <View
                        style={[
                          styles.whosOffPillBox,
                          {
                            backgroundColor: colors.surfaceSubtle,
                            borderColor: colors.border,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.birthdayDayText,
                            { color: colors.textPrimary },
                          ]}
                          numberOfLines={1}
                        >
                          {bday.day}
                        </Text>
                        <Text
                          style={[
                            styles.whosOffPillSub,
                            { color: colors.textMuted },
                          ]}
                          numberOfLines={1}
                        >
                          {tr(bday.month)}
                        </Text>
                      </View>
                    </View>

                    <Text
                      style={[
                        styles.whosOffName,
                        { color: colors.textPrimary },
                        rtlText(isRTL),
                      ]}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {tr(bday.employeeName)}
                    </Text>
                    <Text
                      style={[
                        styles.whosOffDates,
                        { color: colors.textMuted },
                        rtlText(isRTL),
                      ]}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {tr(bday.daysLeftLabel)} • {tr(bday.department)}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        );
      }

      // 'events' section
      return (
        <View>
          <View style={[styles.sectionHeaderRow, rtlRow(isRTL)]}>
            <Text
              style={[
                TYPOGRAPHY.sectionTitle,
                { color: colors.textSecondary, flex: 1 },
                rtlText(isRTL),
              ]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {t.upcomingEvents}
            </Text>
          </View>

          {!isHydrated ? (
            <DashboardSectionSkeleton
              sectionId="events"
              colors={colors}
              isRTL={isRTL}
            />
          ) : (
            events.map((evt) => (
              <View
                key={evt.id}
                style={[
                  styles.eventCard,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                ]}
              >
                <View style={[styles.eventTopRow, rtlRow(isRTL)]}>
                  <View
                    style={[
                      styles.eventCalendarCircle,
                      {
                        borderColor: colors.border,
                        backgroundColor: colors.surfaceSubtle,
                      },
                    ]}
                  >
                    <Feather name="calendar" size={19} color={colors.primary} />
                  </View>
                  <View style={styles.eventTitleWrap}>
                    <Text
                      style={[
                        styles.eventTitle,
                        { color: colors.textPrimary },
                        rtlText(isRTL),
                      ]}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {tr(evt.title)}
                    </Text>
                    <Text
                      style={[
                        styles.eventLocation,
                        { color: colors.textMuted },
                        rtlText(isRTL),
                      ]}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {tr(evt.location)}
                    </Text>
                  </View>
                  <View style={styles.chevronBox}>
                    <Feather
                      name={isRTL ? 'chevron-left' : 'chevron-right'}
                      size={18}
                      color={colors.textMuted}
                    />
                  </View>
                </View>
                <Text
                  style={[
                    styles.eventTimeText,
                    { color: colors.textSecondary },
                    rtlText(isRTL),
                  ]}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {tr(evt.timeRange)}
                </Text>
                <Text
                  style={[
                    styles.eventDateText,
                    { color: colors.textMuted },
                    rtlText(isRTL),
                  ]}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {tr(evt.fromDate)} → {tr(evt.toDate)}
                </Text>
              </View>
            ))
          )}
        </View>
      );
    },
    [
      avatarBg,
      birthdays,
      colors,
      events,
      hydratedSections,
      isRTL,
      leaveBalances,
      onOpenModule,
      onOpenQuickRequest,
      onRearrangeActions,
      roleAuthorizedActions,
      t,
      tr,
      translateActionLabel,
      translateLeaveType,
      whosOff,
    ]
  );

  const listHeader = useMemo(
    () => (
      <View>
        {/* Top Header Bar: Clicking Concept A MacqLogo opens Option A Sidebar Drawer */}
        <View style={[styles.headerRow, rtlRow(isRTL)]}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setSidebarOpen(true)}
            accessibilityLabel="Open MacqHR Sidebar and Profile Settings"
          >
            <MacqLogo colors={colors} size="md" showWordmark={false} />
          </TouchableOpacity>

          <View style={[styles.headerIconsRow, rtlRow(isRTL)]}>
            {/* Bilingual EN / عربي Toggle Pill */}
            <TouchableOpacity
              style={[
                styles.langPill,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
              ]}
              onPress={onToggleLanguage}
              accessibilityLabel="Switch Language Arabic or English"
            >
              <Feather
                name="globe"
                size={14}
                color={colors.accent}
                style={{ marginRight: 5 }}
              />
              <Text
                style={[styles.langPillText, { color: colors.textPrimary }]}
                numberOfLines={1}
              >
                {lang === 'en' ? 'عربي' : 'EN'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.iconButton,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
              onPress={() => onOpenModule('schedule')}
              accessibilityLabel="Open Work Schedule"
            >
              <Feather name="calendar" size={19} color={colors.textPrimary} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.iconButton,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
              onPress={onOpenNotifications}
              accessibilityLabel="Open Notifications"
            >
              <Feather name="bell" size={19} color={colors.textPrimary} />
              {unreadNotificationsCount > 0 && (
                <View
                  style={[
                    styles.notifBadge,
                    { backgroundColor: colors.badgeRed },
                  ]}
                >
                  <Text style={styles.notifBadgeText} numberOfLines={1}>
                    {unreadNotificationsCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Employee Greeting Section */}
        <View style={[styles.greetingRow, rtlRow(isRTL)]}>
          <TouchableOpacity
            onPress={onOpenProfile}
            style={[
              styles.avatarBox,
              { backgroundColor: employeeProfile.avatarColor },
            ]}
          >
            <Text style={styles.avatarInitials}>
              {employeeProfile.avatarInitials}
            </Text>
            <View
              style={[
                styles.onlineDot,
                {
                  backgroundColor: colors.accent,
                  borderColor: colors.background,
                },
              ]}
            />
          </TouchableOpacity>
          <View style={styles.greetingTextWrap}>
            <Text
              style={[
                TYPOGRAPHY.h1,
                { color: colors.textPrimary },
                rtlText(isRTL),
              ]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {t.welcome} {employeeName}
            </Text>
            <View
              style={[
                {
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                  flexWrap: 'wrap',
                },
                rtlRow(isRTL),
              ]}
            >
              <TouchableOpacity
                style={[styles.profileLinkRow, rtlRow(isRTL)]}
                onPress={onOpenProfile}
              >
                <Text
                  style={[styles.viewProfileLink, { color: colors.accent }]}
                  numberOfLines={1}
                >
                  {t.viewProfile}
                </Text>
                <Feather
                  name={isRTL ? 'chevron-left' : 'chevron-right'}
                  size={14}
                  color={colors.accent}
                />
              </TouchableOpacity>

              {onOpenMicrosoft365 && (
                <TouchableOpacity
                  style={[
                    {
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 5,
                      paddingHorizontal: 9,
                      paddingVertical: 4,
                      borderRadius: 12,
                      backgroundColor: colors.primarySoft,
                      borderWidth: 1,
                      borderColor: colors.primary,
                    },
                    rtlRow(isRTL),
                  ]}
                  onPress={onOpenMicrosoft365}
                  accessibilityLabel="Open Microsoft 365 & Teams Hub"
                >
                  <View
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: microsoftConnected
                        ? '#10B981'
                        : '#F59E0B',
                    }}
                  />
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: '800',
                      color: colors.primary,
                    }}
                    numberOfLines={1}
                  >
                    {isRTL
                      ? `مايكروسوفت تيمز: ${teamsAvailability}`
                      : `MS Teams: ${teamsAvailability}`}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </View>
    ),
    [
      colors,
      employeeName,
      employeeProfile.avatarColor,
      employeeProfile.avatarInitials,
      isRTL,
      lang,
      microsoftConnected,
      onOpenMicrosoft365,
      onOpenModule,
      onOpenNotifications,
      onOpenProfile,
      onToggleLanguage,
      t.viewProfile,
      t.welcome,
      teamsAvailability,
      unreadNotificationsCount,
    ]
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ExecutiveSidebarDrawer
        visible={sidebarOpen}
        colors={colors}
        lang={lang}
        profile={employeeProfile}
        onClose={() => setSidebarOpen(false)}
        onOpenProfileScreen={onOpenProfile}
        onOpenSettingsScreen={onOpenSettings}
        onToggleTheme={onToggleTheme}
        onToggleLanguage={onToggleLanguage}
        onToggleBiometricLock={onToggleBiometricLock}
        onOpenQuickRequest={onOpenQuickRequest}
        onLogout={() => {
          setSidebarOpen(false);
          onLogout?.();
        }}
      />

      <FlatList
        data={authorizedSections}
        keyExtractor={(item) => item.id}
        renderItem={renderSectionItem}
        ListHeaderComponent={listHeader}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        initialNumToRender={3}
        maxToRenderPerBatch={3}
        windowSize={5}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 110,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  headerIconsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  langPill: {
    height: 38,
    paddingHorizontal: 10,
    borderRadius: 19,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  langPillText: {
    fontSize: 12,
    fontWeight: '800',
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    flexShrink: 0,
  },
  notifBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    gap: 14,
  },
  avatarBox: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    flexShrink: 0,
  },
  avatarInitials: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 1,
    right: 1,
    width: 13,
    height: 13,
    borderRadius: 7,
    borderWidth: 2,
  },
  greetingTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  profileLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
  },
  viewProfileLink: {
    fontSize: 13,
    fontWeight: '700',
  },
  rbacBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 14,
    gap: 8,
  },
  rbacPillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    flexWrap: 'wrap',
  },
  rbacRolePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
  },
  rbacDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  rbacRoleText: {
    fontSize: 11,
    fontWeight: '700',
  },
  skeletonReplayBtn: {
    width: 30,
    height: 30,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 11,
    marginTop: 6,
    gap: 8,
  },
  arrangeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
    gap: 4,
  },
  arrangeButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
  balanceScrollContent: {
    paddingBottom: 14,
    gap: 12,
  },
  balanceCard: {
    width: 230,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  balanceCardContent: {
    flex: 1,
    minWidth: 0,
  },
  balanceTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 5,
  },
  balanceValueRow: {
    fontSize: 13,
    fontWeight: '500',
  },
  balanceStrong: {
    fontSize: 16,
    fontWeight: '800',
  },
  chevronBox: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 10,
  },
  actionCard: {
    width: '48.4%',
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 13,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
    gap: 10,
  },
  actionBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    minWidth: 19,
    height: 19,
    borderRadius: 10,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  actionIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  actionLabel: {
    flex: 1,
    minWidth: 0,
    fontSize: 13,
    fontWeight: '700',
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginVertical: 14,
  },
  dotActive: {
    width: 18,
    height: 6,
    borderRadius: 3,
  },
  dotInactive: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  horizontalCardsRow: {
    paddingBottom: 14,
    gap: 12,
  },
  whosOffCard: {
    width: 260,
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
  },
  whosOffTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 10,
  },
  whosOffAvatarWrap: {
    position: 'relative',
    width: 48,
    height: 48,
    flexShrink: 0,
  },
  whosOffAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  whosOffAvatarText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  badgeEnd: { right: -3 },
  badgeStart: { left: -3 },
  whosOffMiniIconBadge: {
    position: 'absolute',
    bottom: -3,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 3,
  },
  whosOffPillBox: {
    flex: 1,
    minWidth: 0,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  whosOffPillTitle: {
    fontSize: 12,
    fontWeight: '700',
  },
  whosOffPillSub: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 1,
  },
  birthdayDayText: {
    fontSize: 15,
    fontWeight: '800',
  },
  whosOffName: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 3,
  },
  whosOffDates: {
    fontSize: 12,
    fontWeight: '500',
  },
  eventCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 15,
    marginBottom: 12,
  },
  eventTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 12,
  },
  eventCalendarCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  eventTitleWrap: {
    flex: 1,
    minWidth: 0,
  },
  eventTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  eventLocation: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  eventTimeText: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  eventDateText: {
    fontSize: 12,
    fontWeight: '500',
  },
});
