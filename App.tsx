import React, { useEffect, useState } from 'react';
import {
  BackHandler,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import {
  CURRENT_EMPLOYEE,
  INITIAL_ACTIONS,
  INITIAL_APPROVALS,
  INITIAL_BIRTHDAYS,
  INITIAL_DIRECTORY,
  INITIAL_DOCUMENTS,
  INITIAL_EVENTS,
  INITIAL_LEAVE_BALANCES,
  INITIAL_MY_ATTENDANCE,
  INITIAL_NOTIFICATIONS,
  INITIAL_SALARY_SLIPS,
  INITIAL_SCHEDULE,
  INITIAL_SUBORDINATES_ATTENDANCE,
  INITIAL_TASKS,
  INITIAL_TRANSACTIONS,
  INITIAL_WHOS_OFF,
} from './src/data/mockData';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { TRANSLATIONS } from './src/i18n/translations';
import { ApprovalsScreen } from './src/screens/ApprovalsScreen';
import { AttendanceScreen } from './src/screens/AttendanceScreen';
import { ClockInScreen } from './src/screens/ClockInScreen';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { RequestTimeOffModal } from './src/screens/RequestTimeOffModal';
import { SubModalType, SubModuleModal } from './src/screens/SubModuleModal';
import { darkColors, lightColors, MACQUIRES_PALETTE } from './src/theme/colors';
import { AppLanguage, rtlRow, TYPOGRAPHY } from './src/theme/typography';
import {
  ActionItem,
  ActionModuleId,
  ApprovalItem,
  AttendanceRecord,
  FinancialTransaction,
  LeaveBalance,
  LeaveType,
  NotificationItem,
  TaskItem,
  WhosOffEntry,
} from './src/types/zenhr';

if (Platform.OS === 'web') {
  require('./src/theme/palette.css');
}

function MacqHRApp() {
  const [darkMode, setDarkMode] = useState(false);
  const [lang, setLang] = useState<AppLanguage>('en');
  const [biometricLocked, setBiometricLocked] = useState(false);
  const [activeBottomTab, setActiveBottomTab] = useState<'dashboard' | 'clock'>(
    'dashboard'
  );
  const [activeScreen, setActiveScreen] = useState<
    'main' | 'approvals' | 'attendance'
  >('main');
  const [requestTimeOffVisible, setRequestTimeOffVisible] = useState(false);
  const [activeSubModal, setActiveSubModal] = useState<SubModalType>(null);

  // App state
  const [leaveBalances, setLeaveBalances] = useState<LeaveBalance[]>(
    INITIAL_LEAVE_BALANCES
  );
  const [actions, setActions] = useState<ActionItem[]>(INITIAL_ACTIONS);
  const [whosOff, setWhosOff] = useState<WhosOffEntry[]>(INITIAL_WHOS_OFF);
  const [approvals, setApprovals] = useState<ApprovalItem[]>(INITIAL_APPROVALS);
  const [myAttendance, setMyAttendance] = useState<AttendanceRecord[]>(
    INITIAL_MY_ATTENDANCE
  );
  const [transactions, setTransactions] = useState<FinancialTransaction[]>(
    INITIAL_TRANSACTIONS
  );
  const [tasks, setTasks] = useState<TaskItem[]>(INITIAL_TASKS);
  const [notifications, setNotifications] = useState<NotificationItem[]>(
    INITIAL_NOTIFICATIONS
  );

  // Clock-in state
  const [isClockedIn, setIsClockedIn] = useState(true);
  const [isOnBreak, setIsOnBreak] = useState(false);
  const [clockInTime, setClockInTime] = useState('10:00 AM');
  const [clockOutTime, setClockOutTime] = useState('-- : --');
  const [breakInTime, setBreakInTime] = useState('-- : --');
  const [breakOutTime, setBreakOutTime] = useState('-- : --');
  const [elapsedMinutes, setElapsedMinutes] = useState(132); // 2 hours 12 minutes

  const colors = darkMode ? darkColors : lightColors;
  const t = TRANSLATIONS[lang] ?? TRANSLATIONS.en;
  const isRTL = lang === 'ar';
  const unreadNotificationsCount = notifications.filter((n) => !n.read).length;

  // Consistent Hardware Back Navigation handler across all screens & modals
  useEffect(() => {
    const onHardwareBackPress = (): boolean => {
      if (biometricLocked) {
        return true; // Prevent exiting while locked
      }
      if (requestTimeOffVisible) {
        setRequestTimeOffVisible(false);
        return true;
      }
      if (activeSubModal !== null) {
        setActiveSubModal(null);
        return true;
      }
      if (activeScreen !== 'main') {
        setActiveScreen('main');
        return true;
      }
      if (activeBottomTab === 'clock') {
        setActiveBottomTab('dashboard');
        return true;
      }
      return false; // On root dashboard screen, allow default OS behavior
    };

    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      onHardwareBackPress
    );
    return () => subscription.remove();
  }, [
    biometricLocked,
    requestTimeOffVisible,
    activeSubModal,
    activeScreen,
    activeBottomTab,
  ]);

  const formatNowTime = () => {
    const now = new Date();
    let hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
  };

  const handleToggleClockInOut = () => {
    const nowStr = formatNowTime();
    if (isClockedIn) {
      setIsClockedIn(false);
      setIsOnBreak(false);
      setClockOutTime(nowStr);
      setMyAttendance((prev) =>
        prev.map((rec, idx) =>
          idx === 0
            ? {
                ...rec,
                clockOut: nowStr,
                status: 'Complete',
                workingHoursLabel: 'Working hours: 8 hours',
              }
            : rec
        )
      );
    } else {
      setIsClockedIn(true);
      setClockInTime(nowStr);
      setClockOutTime('-- : --');
      setElapsedMinutes(1);
    }
  };

  const handleToggleBreak = () => {
    const nowStr = formatNowTime();
    if (!isOnBreak) {
      setIsOnBreak(true);
      setBreakInTime(nowStr);
    } else {
      setIsOnBreak(false);
      setBreakOutTime(nowStr);
    }
  };

  const handleDecideApproval = (
    id: string,
    decision: 'Approved' | 'Rejected'
  ) => {
    setApprovals((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, status: decision } : item
      )
    );
  };

  const handleRearrangeActions = () => {
    setActions((prev) => {
      if (prev.length < 2) return prev;
      const copy = [...prev];
      const first = copy.shift()!;
      copy.push(first);
      return copy;
    });
  };

  const handleOpenModule = (moduleId: ActionModuleId) => {
    if (moduleId === 'approvals') {
      setActiveScreen('approvals');
    } else if (moduleId === 'attendance') {
      setActiveScreen('attendance');
    } else {
      setActiveSubModal(moduleId);
    }
  };

  const handleSubmitTimeOff = (payload: {
    leaveType: LeaveType;
    fromDay: number;
    toDay: number;
    daysCount: number;
    notes: string;
    hasAttachment: boolean;
  }) => {
    setLeaveBalances((prev) =>
      prev.map((bal) =>
        bal.title === payload.leaveType
          ? {
              ...bal,
              remaining: Math.max(0, bal.remaining - payload.daysCount),
            }
          : bal
      )
    );
    const newEntry: WhosOffEntry = {
      id: `off-${Date.now()}`,
      employeeName:
        lang === 'ar' ? CURRENT_EMPLOYEE.fullNameAr : CURRENT_EMPLOYEE.fullName,
      role: lang === 'ar' ? CURRENT_EMPLOYEE.titleAr : CURRENT_EMPLOYEE.title,
      avatarInitials: 'RA',
      avatarColor: MACQUIRES_PALETTE.prussianBlue,
      type:
        payload.leaveType === 'Remote Work'
          ? 'Remote Work'
          : payload.leaveType === 'Sick Day off'
            ? 'Sick Day off'
            : 'Annual Vacation',
      durationLabel: `${payload.daysCount} days`,
      fromDate: `Jun ${String(payload.fromDay).padStart(2, '0')}, 2026`,
      toDate: `Jun ${String(payload.toDay).padStart(2, '0')}, 2026`,
    };
    setWhosOff((prev) => [newEntry, ...prev]);
    setRequestTimeOffVisible(false);
  };

  const handleToggleTask = (taskId: string) => {
    setTasks((prev) =>
      prev.map((tItem) =>
        tItem.id === taskId ? { ...tItem, completed: !tItem.completed } : tItem
      )
    );
  };

  const handleAddFinancialTransaction = (title: string, amountSar: number) => {
    const newTx: FinancialTransaction = {
      id: `tx-${Date.now()}`,
      title,
      type: 'Expense Claim',
      dateIso: new Date().toISOString().slice(0, 10),
      dateFormatted: '17 Oct 2026',
      amountSar,
      status: 'Pending',
      referenceCode: `FIN-2026-${Math.floor(100 + Math.random() * 900)}`,
    };
    setTransactions((prev) => [newTx, ...prev]);
  };

  const handleMarkAllNotificationsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  if (biometricLocked) {
    return (
      <SafeAreaProvider>
        <SafeAreaView
          style={[
            styles.lockScreen,
            { backgroundColor: MACQUIRES_PALETTE.oxfordBlue },
          ]}
        >
          <StatusBar barStyle="light-content" />
          <View style={styles.lockCard}>
            <View style={styles.lockLogoRow}>
              <Text style={styles.lockLogoZen}>macq</Text>
              <Text style={styles.lockLogoHR}>HR</Text>
              <Text style={styles.lockLogoReg}>®</Text>
            </View>
            <Text style={styles.lockTitle} numberOfLines={1}>
              {t.biometricSecurityLock}
            </Text>
            <Text style={styles.lockSubtitle}>{t.biometricSubtitle}</Text>
            <TouchableOpacity
              style={[styles.unlockBtn, rtlRow(isRTL)]}
              onPress={() => setBiometricLocked(false)}
            >
              <View style={styles.unlockIconSlot}>
                <Feather name="unlock" size={16} color={colors.textOnPrimary} />
              </View>
              <Text style={styles.unlockBtnText} numberOfLines={1}>
                {t.authenticateAs}{' '}
                {lang === 'ar'
                  ? CURRENT_EMPLOYEE.fullNameAr
                  : CURRENT_EMPLOYEE.fullName}
              </Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <View
        style={[
          styles.webOuterFrame,
          {
            backgroundColor: darkMode
              ? MACQUIRES_PALETTE.oxfordBlue
              : '#DCE3EC',
          },
        ]}
      >
        <SafeAreaView
          style={[styles.root, { backgroundColor: colors.background }]}
          edges={['top', 'left', 'right', 'bottom']}
        >
          <StatusBar barStyle={darkMode ? 'light-content' : 'dark-content'} />

          {/* Main Content Area */}
          <View style={styles.contentArea}>
            {activeScreen === 'approvals' ? (
              <ApprovalsScreen
                colors={colors}
                lang={lang}
                approvals={approvals}
                onDecideApproval={handleDecideApproval}
                onBack={() => setActiveScreen('main')}
              />
            ) : activeScreen === 'attendance' ? (
              <AttendanceScreen
                colors={colors}
                lang={lang}
                myAttendance={myAttendance}
                subordinatesAttendance={INITIAL_SUBORDINATES_ATTENDANCE}
                onBack={() => setActiveScreen('main')}
              />
            ) : activeBottomTab === 'clock' ? (
              <ClockInScreen
                colors={colors}
                lang={lang}
                isClockedIn={isClockedIn}
                isOnBreak={isOnBreak}
                clockInTime={clockInTime}
                clockOutTime={clockOutTime}
                breakInTime={breakInTime}
                breakOutTime={breakOutTime}
                elapsedMinutes={elapsedMinutes}
                onToggleClockInOut={handleToggleClockInOut}
                onToggleBreak={handleToggleBreak}
                onOpenAttendanceHistory={() => setActiveScreen('attendance')}
                onBackToDashboard={() => setActiveBottomTab('dashboard')}
              />
            ) : (
              <DashboardScreen
                colors={colors}
                lang={lang}
                employeeName={
                  lang === 'ar'
                    ? CURRENT_EMPLOYEE.firstNameAr
                    : CURRENT_EMPLOYEE.firstName
                }
                leaveBalances={leaveBalances}
                actions={actions}
                whosOff={whosOff}
                birthdays={INITIAL_BIRTHDAYS}
                events={INITIAL_EVENTS}
                unreadNotificationsCount={unreadNotificationsCount}
                onOpenModule={handleOpenModule}
                onOpenProfile={() => setActiveSubModal('profile')}
                onOpenNotifications={() => setActiveSubModal('notifications')}
                onOpenQuickRequest={() => setRequestTimeOffVisible(true)}
                onToggleTheme={() => setDarkMode((d) => !d)}
                onToggleLanguage={() =>
                  setLang((prev) => (prev === 'en' ? 'ar' : 'en'))
                }
                onToggleBiometricLock={() => setBiometricLocked(true)}
                onRearrangeActions={handleRearrangeActions}
              />
            )}
          </View>

          {/* Bottom Navigation Bar with Center Floating '+' Button */}
          {activeScreen === 'main' && (
            <View
              style={[
                styles.bottomBarContainer,
                rtlRow(isRTL),
                {
                  backgroundColor: colors.surface,
                  borderTopColor: colors.border,
                },
              ]}
            >
              {/* Left Tab: Dashboard Grid Icon */}
              <TouchableOpacity
                style={styles.navTab}
                onPress={() => setActiveBottomTab('dashboard')}
                accessibilityLabel={t.dashboardTab}
              >
                <View style={styles.navIconSlot}>
                  <Feather
                    name="grid"
                    size={20}
                    color={
                      activeBottomTab === 'dashboard'
                        ? colors.accent
                        : colors.textMuted
                    }
                  />
                </View>
                <Text
                  style={[
                    styles.navTabLabel,
                    {
                      color:
                        activeBottomTab === 'dashboard'
                          ? colors.accent
                          : colors.textMuted,
                    },
                  ]}
                  numberOfLines={1}
                >
                  {t.dashboardTab}
                </Text>
                {activeBottomTab === 'dashboard' && (
                  <View
                    style={[
                      styles.activeIndicator,
                      { backgroundColor: colors.accent },
                    ]}
                  />
                )}
              </TouchableOpacity>

              {/* Center Floating '+' Quick Request Button (Orange Pantone #FE5800) */}
              <View style={styles.fabSlot}>
                <TouchableOpacity
                  style={[
                    styles.fabButton,
                    {
                      backgroundColor: colors.accent,
                      borderColor: colors.surface,
                    },
                  ]}
                  onPress={() => setRequestTimeOffVisible(true)}
                  accessibilityLabel={t.requestTimeOff}
                >
                  <Feather name="plus" size={28} color={colors.textOnPrimary} />
                </TouchableOpacity>
              </View>

              {/* Right Tab: Attendance Clock / Stopwatch Icon */}
              <TouchableOpacity
                style={styles.navTab}
                onPress={() => setActiveBottomTab('clock')}
                accessibilityLabel={t.clockIn}
              >
                <View style={styles.navIconSlot}>
                  <Feather
                    name="clock"
                    size={20}
                    color={
                      activeBottomTab === 'clock'
                        ? colors.accent
                        : colors.textMuted
                    }
                  />
                </View>
                <Text
                  style={[
                    styles.navTabLabel,
                    {
                      color:
                        activeBottomTab === 'clock'
                          ? colors.accent
                          : colors.textMuted,
                    },
                  ]}
                  numberOfLines={1}
                >
                  {t.clockIn}
                </Text>
                {activeBottomTab === 'clock' && (
                  <View
                    style={[
                      styles.activeIndicator,
                      { backgroundColor: colors.accent },
                    ]}
                  />
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* Request Time Off Modal */}
          <RequestTimeOffModal
            visible={requestTimeOffVisible}
            colors={colors}
            lang={lang}
            onClose={() => setRequestTimeOffVisible(false)}
            onSubmitRequest={handleSubmitTimeOff}
          />

          {/* Secondary Module Modal */}
          <SubModuleModal
            activeModal={activeSubModal}
            colors={colors}
            lang={lang}
            transactions={transactions}
            salarySlips={INITIAL_SALARY_SLIPS}
            directory={INITIAL_DIRECTORY}
            documents={INITIAL_DOCUMENTS}
            schedule={INITIAL_SCHEDULE}
            tasks={tasks}
            notifications={notifications}
            onClose={() => setActiveSubModal(null)}
            onToggleTask={handleToggleTask}
            onAddFinancialTransaction={handleAddFinancialTransaction}
            onMarkAllNotificationsRead={handleMarkAllNotificationsRead}
          />
        </SafeAreaView>
      </View>
    </SafeAreaProvider>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <MacqHRApp />
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  webOuterFrame: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  root: {
    flex: 1,
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 430 : undefined,
    maxHeight: Platform.OS === 'web' ? 920 : undefined,
    borderRadius: Platform.OS === 'web' ? 28 : 0,
    overflow: 'hidden',
    shadowColor: MACQUIRES_PALETTE.oxfordBlue,
    shadowOpacity: Platform.OS === 'web' ? 0.22 : 0,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
  },
  contentArea: {
    flex: 1,
  },
  bottomBarContainer: {
    height: 68,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    paddingHorizontal: 16,
    shadowColor: MACQUIRES_PALETTE.oxfordBlue,
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -2 },
    elevation: 8,
  },
  navTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    paddingHorizontal: 6,
  },
  navIconSlot: {
    width: 24,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTabLabel: {
    ...TYPOGRAPHY.caption,
    fontSize: 11,
    marginTop: 2,
    maxWidth: '100%',
  },
  activeIndicator: {
    width: 20,
    height: 3,
    borderRadius: 2,
    marginTop: 3,
  },
  fabSlot: {
    width: 74,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  fabButton: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -28,
    shadowColor: MACQUIRES_PALETTE.orangePantone,
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
    borderWidth: 4,
  },
  lockScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  lockCard: {
    width: '100%',
    backgroundColor: MACQUIRES_PALETTE.white,
    borderRadius: 20,
    padding: 26,
    alignItems: 'center',
  },
  lockLogoRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 14,
  },
  lockLogoZen: {
    fontSize: 32,
    fontWeight: '300',
    color: MACQUIRES_PALETTE.prussianBlue,
  },
  lockLogoHR: {
    fontSize: 32,
    fontWeight: '800',
    color: MACQUIRES_PALETTE.orangePantone,
  },
  lockLogoReg: {
    fontSize: 14,
    fontWeight: '700',
    color: MACQUIRES_PALETTE.spanishGrey,
  },
  lockTitle: {
    ...TYPOGRAPHY.h2,
    color: MACQUIRES_PALETTE.oxfordBlue,
    marginBottom: 8,
  },
  lockSubtitle: {
    ...TYPOGRAPHY.bodySmall,
    color: MACQUIRES_PALETTE.davysGrey,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  unlockBtn: {
    backgroundColor: MACQUIRES_PALETTE.prussianBlue,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  unlockIconSlot: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  unlockBtnText: {
    ...TYPOGRAPHY.button,
    color: MACQUIRES_PALETTE.white,
    flexShrink: 1,
  },
});
