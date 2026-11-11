import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
import { ShiftlyLogo } from './src/components/ShiftlyLogo';
import { NotchedBottomBar } from './src/components/NotchedBottomBar';
import { AdminOrgPanelModal } from './src/components/AdminOrgPanelModal';
import { WorkspaceModal } from './src/components/WorkspaceModal';
import { resolveWorkspaceDisplayRole } from './src/services/workspaceService';
import { TRANSLATIONS } from './src/i18n/translations';
import { ApprovalsScreen } from './src/screens/ApprovalsScreen';
import { AttendanceScreen } from './src/screens/AttendanceScreen';
import { ChangePasswordScreen } from './src/screens/ChangePasswordScreen';
import { ClockInScreen } from './src/screens/ClockInScreen';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { RequestTimeOffModal } from './src/screens/RequestTimeOffModal';
import { SubModalType, SubModuleModal } from './src/screens/SubModuleModal';
import { AuthSession } from './src/services/authService';
import { loadStoredAuthSession, saveAuthSession } from './src/services/authStorage';
import {
  isTokenExpiringSoon,
  refreshStoredSession,
  signOutStoredSession,
  subscribeToSession,
  subscribeToSessionExpired,
} from './src/services/sessionManager';
import {
  decideLeaveToBackend,
  loadMobileApiData,
  markAllNotificationsAsRead,
  submitLeaveToBackend,
  submitPunchToBackend,
} from './src/services/backendApi';
import { UserRole } from './src/services/dashboardOptimizationService';
import {
  buildTeamsApprovalAdaptiveCard,
  createOutlookLeaveCalendarEvent,
  MACQUIRES_ENTRA_CONFIG,
  MicrosoftEntraAccount,
  OutlookCalendarEvent,
  resolveTeamsPresenceFromAttendance,
} from './src/services/microsoftGraph';
import {
  OfflineAttendancePunch,
  verifyPunchSignature,
} from './src/services/offlineSyncAndCompliance';
import {
  deriveAvatarInitials,
  EditableEmployeeProfile,
} from './src/services/profileSettingsService';
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

function formatDateForNotification(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function toLocalIsoDate(year: number, monthIndex: number, day: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function MacqHRApp() {
  const [darkMode, setDarkMode] = useState(false);
  const [lang, setLang] = useState<AppLanguage>('en');
  const [showOpeningSplash, setShowOpeningSplash] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authSession, setAuthSession] = useState<AuthSession | null>(null);
  const [userRole, setUserRole] = useState<UserRole>('EMPLOYEE');
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [assignedBranchId, setAssignedBranchId] = useState<string | undefined>();
  const [isRemoteAllowed, setIsRemoteAllowed] = useState(false);
  const [biometricLocked, setBiometricLocked] = useState(false);
  const [activeBottomTab, setActiveBottomTab] = useState<'dashboard' | 'clock'>(
    'dashboard'
  );
  const [activeScreen, setActiveScreen] = useState<
    'main' | 'approvals' | 'attendance'
  >('main');
  const [requestTimeOffVisible, setRequestTimeOffVisible] = useState(false);
  const [activeSubModal, setActiveSubModal] = useState<SubModalType>(null);
  const [adminPanelVisible, setAdminPanelVisible] = useState(false);
  const [workspaceModalVisible, setWorkspaceModalVisible] = useState(false);

  // Live Editable Employee Profile State (Option A Sidebar)
  const [employeeProfile, setEmployeeProfile] =
    useState<EditableEmployeeProfile>({
      ...CURRENT_EMPLOYEE,
      avatarInitials: deriveAvatarInitials(CURRENT_EMPLOYEE.fullName),
      avatarPresetId: 'navy',
      avatarColor: MACQUIRES_PALETTE.prussianBlue,
    });

  // App state
  const [leaveBalances, setLeaveBalances] = useState<LeaveBalance[]>(
    INITIAL_LEAVE_BALANCES
  );
  const [actions, setActions] = useState<ActionItem[]>(INITIAL_ACTIONS);
  const [selectedActionIds, setSelectedActionIds] = useState<ActionModuleId[]>([
    'attendance',
    'payroll',
    'transactions',
    'schedule',
  ]);
  const [whosOff, setWhosOff] = useState<WhosOffEntry[]>(INITIAL_WHOS_OFF);
  const [approvals, setApprovals] = useState<ApprovalItem[]>(INITIAL_APPROVALS);
  const [myAttendance, setMyAttendance] = useState<AttendanceRecord[]>(
    INITIAL_MY_ATTENDANCE
  );
  const [subordinatesAttendance, setSubordinatesAttendance] = useState<AttendanceRecord[]>(
    INITIAL_SUBORDINATES_ATTENDANCE
  );
  const [directory, setDirectory] = useState(INITIAL_DIRECTORY);
  const [salarySlips, setSalarySlips] = useState(INITIAL_SALARY_SLIPS);
  const [transactions, setTransactions] = useState<FinancialTransaction[]>(
    INITIAL_TRANSACTIONS
  );
  const [tasks, setTasks] = useState<TaskItem[]>(INITIAL_TASKS);
  const [notifications, setNotifications] = useState<NotificationItem[]>(
    INITIAL_NOTIFICATIONS
  );

  // Clock-in state (Clean initial state; counts up only after clocking in)
  const [isClockedIn, setIsClockedIn] = useState(false);
  const [isOnBreak, setIsOnBreak] = useState(false);
  const [clockInTime, setClockInTime] = useState('-- : --');
  const [clockOutTime, setClockOutTime] = useState('-- : --');
  const [breakInTime, setBreakInTime] = useState('-- : --');
  const [breakOutTime, setBreakOutTime] = useState('-- : --');
  const [elapsedMinutes, setElapsedMinutes] = useState(0);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      const stored = await loadStoredAuthSession({ allowExpired: true });
      if (!mounted || !stored) return;
      const session = isTokenExpiringSoon(stored.token)
        ? await refreshStoredSession()
        : stored;
      if (!mounted || !session) return;
      setAuthSession(session);
      setUserRole(session.role);
      setEmployeeProfile(session.profile);
      setAuthToken(session.token);
      setAssignedBranchId(session.branchId);
      setIsRemoteAllowed(session.isRemoteAllowed);
      setIsAuthenticated(true);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const applyMobileApiData = useCallback((data: Awaited<ReturnType<typeof loadMobileApiData>>) => {
    setLeaveBalances(data.leaveBalances);
    setApprovals(data.approvals);
    setMyAttendance(data.myAttendance);
    setSubordinatesAttendance(data.subordinatesAttendance);
    setWhosOff(data.whosOff);
    setDirectory(data.directory);
    setSalarySlips(data.salarySlips);
    if (data.notifications && data.notifications.length > 0) {
      setNotifications(data.notifications);
    }
  }, []);

  const refreshMobileApiData = useCallback(async (token: string, role: UserRole) => {
    const data = await loadMobileApiData(token, role);
    applyMobileApiData(data);
    return data;
  }, [applyMobileApiData]);

  useEffect(() => {
    if (!authToken) return;
    let mounted = true;
    void loadMobileApiData(authToken, userRole)
      .then((data) => {
        if (mounted) applyMobileApiData(data);
      })
      .catch((error) => {
        if (!mounted) return;
        setNotifications((prev) => [
          {
            id: `api-load-${Date.now()}`,
            title: 'Some live data could not be loaded',
            body: error instanceof Error ? error.message : 'Please try again later.',
            timeAgo: 'Just now',
            read: false,
          },
          ...prev,
        ]);
      });
    return () => {
      mounted = false;
    };
  }, [authToken, userRole, applyMobileApiData]);

  // Live timer counting up while clocked in and not on break
  useEffect(() => {
    if (!isClockedIn || isOnBreak) return;
    const timer = setInterval(() => {
      setElapsedMinutes((prev) => prev + 1);
    }, 60000);
    return () => clearInterval(timer);
  }, [isClockedIn, isOnBreak]);

  // Microsoft 365 & Offline Queue State
  const [microsoftAccount, setMicrosoftAccount] =
    useState<MicrosoftEntraAccount>({
      tenantId: MACQUIRES_ENTRA_CONFIG.tenantId,
      objectId: 'obj-rahaf-1042',
      userPrincipalName: CURRENT_EMPLOYEE.email,
      displayName: CURRENT_EMPLOYEE.fullName,
      jobTitle: CURRENT_EMPLOYEE.title,
      department: CURRENT_EMPLOYEE.department,
      officeLocation: CURRENT_EMPLOYEE.branch,
      accessToken: 'msal-jwt-verified-token-2026',
      expiresAtIso: new Date(Date.now() + 3600 * 1000).toISOString(),
      isConnected: true,
    });
  const [outlookEvents, setOutlookEvents] = useState<OutlookCalendarEvent[]>([
    createOutlookLeaveCalendarEvent({
      employeeName: 'Mohammad Jamal',
      leaveType: 'Annual Vacation',
      fromDay: 5,
      toDay: 5,
    }),
  ]);
  const [offlinePunches, setOfflinePunches] = useState<
    OfflineAttendancePunch[]
  >([]);

  const teamsPresence = resolveTeamsPresenceFromAttendance({
    isClockedIn,
    isOnBreak,
  });

  const colors = darkMode ? darkColors : lightColors;
  const t = TRANSLATIONS[lang] ?? TRANSLATIONS.en;
  const isRTL = lang === 'ar';
  const unreadNotificationsCount = notifications.filter((n) => !n.read).length;

  // Consistent Hardware Back Navigation handler across all screens & modals
  useEffect(() => {
    const onHardwareBackPress = (): boolean => {
      if (!isAuthenticated) {
        return false;
      }
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
    isAuthenticated,
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
      setElapsedMinutes(0);
    }
  };

  const handleSubmitAttendancePunch = async (punch: {
    type: 'CHECK_IN' | 'CHECK_OUT' | 'BREAK_START' | 'BREAK_END';
    latitude: number;
    longitude: number;
    accuracyMeters: number;
    isMockLocation: boolean;
    isDeviceRooted: boolean;
    biometricVerified: boolean;
    workMode: 'OFFICE' | 'REMOTE';
  }) => {
    if (!authToken) throw new Error('Your session has expired. Please sign in again.');
    if (!assignedBranchId) throw new Error('No attendance branch is assigned to this account.');
    await submitPunchToBackend(authToken, {
      ...punch,
      clientTimestamp: new Date().toISOString(),
      branchId: assignedBranchId,
      workMode: punch.workMode,
    });
    await refreshMobileApiData(authToken, userRole);
  };

  const handleToggleBreak = async () => {
    const nextType = !isOnBreak ? 'BREAK_START' : 'BREAK_END';
    const nowStr = formatNowTime();
    if (!isOnBreak) {
      setIsOnBreak(true);
      setBreakInTime(nowStr);
    } else {
      setIsOnBreak(false);
      setBreakOutTime(nowStr);
    }
    if (authToken && assignedBranchId) {
      try {
        await submitPunchToBackend(authToken, {
          type: nextType,
          latitude: 24.7136,
          longitude: 46.6753,
          accuracyMeters: 10,
          isMockLocation: false,
          isDeviceRooted: false,
          biometricVerified: true,
          clientTimestamp: new Date().toISOString(),
          branchId: assignedBranchId,
          workMode: 'OFFICE',
        });
      } catch {
        // Fallback gracefully
      }
    }
  };

  const handleDecideApproval = async (
    id: string,
    decision: 'Approved' | 'Rejected'
  ) => {
    const target = approvals.find((a) => a.id === id);
    if (authToken && target?.category === 'Time Off' && !id.startsWith('apr-')) {
      try {
        await decideLeaveToBackend(authToken, id, decision === 'Approved' ? 'APPROVED' : 'REJECTED');
        await refreshMobileApiData(authToken, userRole);
      } catch (error) {
        setNotifications((prev) => [
          {
            id: `approval-error-${Date.now()}`,
            title: 'Approval was not saved',
            body: error instanceof Error ? error.message : 'Please try again.',
            timeAgo: 'Just now',
            read: false,
          },
          ...prev,
        ]);
      }
      return;
    }
    setApprovals((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              status: decision,
              stage: decision === 'Approved' ? 'APPROVED' : 'REJECTED',
            }
          : item
      )
    );

    if (target) {
      if (
        decision === 'Approved' &&
        (target.category === 'Time Off' || target.leaveType)
      ) {
        const leaveDays = target.daysCount ?? 1;
        const targetLeaveType = target.leaveType ?? 'Annual Vacation';

        // 1. Deduct from remaining balance
        setLeaveBalances((prev) =>
          prev.map((bal) =>
            bal.title === targetLeaveType
              ? {
                  ...bal,
                  remaining: Math.max(0, bal.remaining - leaveDays),
                }
              : bal
          )
        );

        // 2. Add to Who's Off
        const newOffEntry: WhosOffEntry = {
          id: `off-${Date.now()}`,
          employeeName: target.employeeName,
          role: target.role,
          avatarInitials: target.avatarInitials,
          avatarColor: target.avatarColor,
          type:
            targetLeaveType === 'Remote Work'
              ? 'Remote Work'
              : targetLeaveType === 'Sick Day off'
                ? 'Sick Day off'
                : 'Annual Vacation',
          durationLabel: `${leaveDays} days`,
          fromDate: target.startDate,
          toDate: target.endDate,
          department: 'Software Engineering',
          location: 'Remote (Pakistan)',
          contactStatus:
            targetLeaveType === 'Remote Work' ? 'Reachable' : 'Do Not Disturb',
        };
        setWhosOff((prev) => [newOffEntry, ...prev]);

        // 3. Notify HR and Employee
        setNotifications((prev) => [
          {
            id: `notif-hr-${Date.now()}`,
            title: `HR Log: Leave Approved (${target.employeeName})`,
            body: `Manager Tariq Al-Ghamdi approved ${targetLeaveType} for ${target.employeeName} (${target.startDate} – ${target.endDate}). Record logged into HR system.`,
            timeAgo: 'Just now',
            read: false,
          },
          {
            id: `notif-emp-${Date.now() + 1}`,
            title: `Leave Request Approved`,
            body: `Your manager Tariq Al-Ghamdi approved your ${targetLeaveType} request (${leaveDays} days).`,
            timeAgo: 'Just now',
            read: false,
          },
          ...prev,
        ]);
      } else if (
        decision === 'Rejected' &&
        (target.category === 'Time Off' || target.leaveType)
      ) {
        setNotifications((prev) => [
          {
            id: `notif-emp-rej-${Date.now()}`,
            title: `Leave Request Declined`,
            body: `Your manager Tariq Al-Ghamdi declined your ${target.leaveType ?? 'leave'} request.`,
            timeAgo: 'Just now',
            read: false,
          },
          ...prev,
        ]);
      }

      buildTeamsApprovalAdaptiveCard({
        id: target.id,
        employeeName: target.employeeName,
        role: target.role,
        category: target.category,
        headline: target.headline,
        startDate: target.startDate,
        endDate: target.endDate,
        amountSar: target.amountSar,
        decision,
      });

      if (target.category !== 'Time Off') {
        setNotifications((prev) => [
          {
            id: `notif-ms-${Date.now()}`,
            title: `Teams Adaptive Card: ${decision}`,
            body: `${target.employeeName}'s ${target.headline} was ${decision.toLowerCase()} and synced to Microsoft Teams.`,
            timeAgo: 'Just now',
            read: false,
          },
          ...prev,
        ]);
      }
    }
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

  const handleSubmitTimeOff = async (payload: {
    leaveType: LeaveType;
    startDate: string;
    endDate: string;
    fromDay: number;
    toDay: number;
    daysCount: number;
    notes: string;
    hasAttachment: boolean;
    attachmentUrl?: string;
    isHalfDay?: boolean;
    halfDayPeriod?: 'MORNING' | 'AFTERNOON';
  }) => {
    const apiLeaveType = {
      'Annual Vacation': 'ANNUAL',
      'Sick Day off': 'SICK',
      'Sick on file': 'SICK_ON_FILE',
      'Hajj Leave': 'HAJJ',
      'Paternity Leave': 'PATERNITY',
      'Maternity Leave': 'MATERNITY',
      'Marriage Leave': 'MARRIAGE',
      'Bereavement Leave': 'BEREAVEMENT',
      'Remote Work': 'REMOTE_WORK',
      'Emergency Leave': 'EMERGENCY',
      'Unpaid Leave': 'UNPAID',
    }[payload.leaveType] || 'UNPAID';

    const startDate = payload.startDate;
    const endDate = payload.endDate;

    if (authToken) {
      try {
        await submitLeaveToBackend(authToken, {
          type: apiLeaveType,
          startDate,
          endDate,
          reason: payload.notes || payload.leaveType,
          isHalfDay: payload.isHalfDay,
          halfDayPeriod: payload.halfDayPeriod,
          attachmentUrl: payload.attachmentUrl,
        });
        await refreshMobileApiData(authToken, userRole);
      } catch (error) {
        setNotifications((prev) => [
          {
            id: `leave-error-${Date.now()}`,
            title: 'Leave request was not submitted',
            body: error instanceof Error ? error.message : 'Please try again.',
            timeAgo: 'Just now',
            read: false,
          },
          ...prev,
        ]);
        return;
      }
    }

    const empName = lang === 'ar' ? employeeProfile.fullNameAr : employeeProfile.fullName;
    const fromDateStr = formatDateForNotification(startDate);
    const toDateStr = formatDateForNotification(endDate);
    const durationLabel = payload.isHalfDay
      ? `${payload.daysCount} day (${payload.halfDayPeriod === 'MORNING' ? 'Morning' : 'Afternoon'})`
      : `${payload.daysCount} days`;

    setNotifications((prev) => [
      {
        id: `notif-mgr-${Date.now()}`,
        title:
          lang === 'ar'
            ? `طلب إجازة جديد: ${empName}`
            : `New Leave Request: ${empName}`,
        body:
          lang === 'ar'
            ? `قدم ${empName} طلباً لإجازة (${payload.leaveType}) لمدة ${durationLabel} (${fromDateStr} إلى ${toDateStr}). المرحلة 1: بانتظار موافقة المدير المباشر.`
            : `${empName} requested ${durationLabel} of ${payload.leaveType} (${fromDateStr} to ${toDateStr}). Stage 1: Awaiting manager approval.`,
        timeAgo: 'Just now',
        read: false,
      },
      ...prev,
    ]);

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
    if (authToken) {
      void markAllNotificationsAsRead(authToken).catch(() => {});
    }
  };

  const handleSecurityAuditEvent = (message: string, blocked: boolean) => {
    if (blocked) {
      setNotifications((prev) => [
        {
          id: `sec-${Date.now()}`,
          title: 'Anti-Spoofing Security Alert',
          body: message,
          timeAgo: 'Just now',
          read: false,
        },
        ...prev,
      ]);
    }
  };

  const handleQueueOfflinePunch = (punch: OfflineAttendancePunch) => {
    if (verifyPunchSignature(punch)) {
      setOfflinePunches((prev) => [punch, ...prev]);
    }
  };

  const handleSyncOfflinePunches = () => {
    setOfflinePunches((prev) =>
      prev.map((p) => (verifyPunchSignature(p) ? { ...p, synced: true } : p))
    );
  };

  const handleToggleMicrosoftSso = () => {
    setMicrosoftAccount((prev) => ({
      ...prev,
      isConnected: true,
      expiresAtIso: new Date(Date.now() + 3600 * 1000).toISOString(),
    }));
  };

  const handleLoginSuccess = (session: AuthSession) => {
    setAuthSession(session);
    setUserRole(session.role);
    setEmployeeProfile(session.profile);
    setAuthToken(session.token);
    setAssignedBranchId(session.branchId);
    setIsRemoteAllowed(session.isRemoteAllowed);
    void saveAuthSession(session);
    setIsAuthenticated(true);
  };

  const handlePasswordChanged = (session: AuthSession) => {
    handleLoginSuccess(session);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setAuthSession(null);
    setAuthToken(null);
    setAssignedBranchId(undefined);
    setIsRemoteAllowed(false);
    void signOutStoredSession();
    setActiveScreen('main');
    setActiveBottomTab('dashboard');
  };

  useEffect(() => {
    const unsubscribeSession = subscribeToSession((next) => {
      setAuthSession(next);
      setAuthToken(next.token);
      setUserRole(next.role);
      setEmployeeProfile(next.profile);
      setAssignedBranchId(next.branchId);
      setIsRemoteAllowed(next.isRemoteAllowed);
    });
    const unsubscribeExpired = subscribeToSessionExpired(() => {
      handleLogout();
    });
    return () => {
      unsubscribeSession();
      unsubscribeExpired();
    };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowOpeningSplash(false);
    }, 1800);
    return () => clearTimeout(timer);
  }, []);

  if (showOpeningSplash) {
    return (
      <SafeAreaProvider>
        <TouchableOpacity
          activeOpacity={0.95}
          onPress={() => setShowOpeningSplash(false)}
          style={[
            styles.lockScreen,
            { backgroundColor: MACQUIRES_PALETTE.oxfordBlue },
          ]}
        >
          <StatusBar barStyle="light-content" />
          <ShiftlyLogo
            colors={darkColors}
            size="xl"
            layout="stacked"
            showWordmark={true}
            showSubtitle={false}
            forceLightWordmark={true}
          />
          <View style={{ position: 'absolute', bottom: 56, alignItems: 'center' }}>
            <ActivityIndicator size="small" color={MACQUIRES_PALETTE.orangePantone} />
            <Text
              style={{
                color: '#94A3B8',
                fontSize: 12,
                fontWeight: '700',
                marginTop: 12,
                letterSpacing: 2,
                textTransform: 'uppercase',
              }}
            >
              Smart Attendance
            </Text>
          </View>
        </TouchableOpacity>
      </SafeAreaProvider>
    );
  }

  if (!isAuthenticated) {
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
            <LoginScreen
              colors={colors}
              lang={lang}
              onLoginSuccess={handleLoginSuccess}
              onToggleLanguage={() =>
                setLang((prev) => (prev === 'en' ? 'ar' : 'en'))
              }
              onToggleTheme={() => setDarkMode((d) => !d)}
            />
          </SafeAreaView>
        </View>
      </SafeAreaProvider>
    );
  }

  if (authSession?.mustChangePassword) {
    return (
      <SafeAreaProvider>
        <View
          style={[
            styles.webOuterFrame,
            { backgroundColor: darkMode ? MACQUIRES_PALETTE.oxfordBlue : '#DCE3EC' },
          ]}
        >
          <SafeAreaView
            style={[styles.root, { backgroundColor: colors.background }]}
            edges={['top', 'left', 'right', 'bottom']}
          >
            <StatusBar barStyle={darkMode ? 'light-content' : 'dark-content'} />
            <ChangePasswordScreen
              colors={colors}
              lang={lang}
              session={authSession}
              onChanged={handlePasswordChanged}
              onSignOut={handleLogout}
            />
          </SafeAreaView>
        </View>
      </SafeAreaProvider>
    );
  }

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
            <View style={{ marginBottom: 16 }}>
              <ShiftlyLogo
                colors={lightColors}
                size="lg"
                layout="stacked"
                showWordmark={true}
                showSubtitle={false}
              />
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
                  ? employeeProfile.fullNameAr
                  : employeeProfile.fullName}
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
          edges={['top', 'left', 'right']}
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
                 subordinatesAttendance={subordinatesAttendance}
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
                isRemoteAllowed={isRemoteAllowed}
                teamsPresence={teamsPresence}
                offlineQueueCount={offlinePunches.length}
                onToggleClockInOut={handleToggleClockInOut}
                onSubmitAttendancePunch={handleSubmitAttendancePunch}
                onToggleBreak={handleToggleBreak}
                onOpenAttendanceHistory={() => setActiveScreen('attendance')}
                onBackToDashboard={() => setActiveBottomTab('dashboard')}
                onSecurityAuditEvent={handleSecurityAuditEvent}
                onQueueOfflinePunch={handleQueueOfflinePunch}
              />
            ) : (
              <DashboardScreen
                colors={colors}
                lang={lang}
                employeeName={
                  lang === 'ar'
                    ? employeeProfile.firstNameAr
                    : employeeProfile.firstName
                }
                employeeProfile={employeeProfile}
                leaveBalances={leaveBalances}
                actions={actions}
                whosOff={whosOff}
                birthdays={INITIAL_BIRTHDAYS}
                events={INITIAL_EVENTS}
                unreadNotificationsCount={unreadNotificationsCount}
                onOpenModule={handleOpenModule}
                onOpenProfile={() => setActiveSubModal('profile')}
                onOpenSettings={() => setActiveSubModal('settings')}
                onUpdateProfile={setEmployeeProfile}
                onOpenNotifications={() => setActiveSubModal('notifications')}
                onOpenQuickRequest={() => setRequestTimeOffVisible(true)}
                onToggleTheme={() => setDarkMode((d) => !d)}
                onToggleLanguage={() =>
                  setLang((prev) => (prev === 'en' ? 'ar' : 'en'))
                }
                onToggleBiometricLock={() => setBiometricLocked(true)}
                onRearrangeActions={handleRearrangeActions}
                selectedActionIds={selectedActionIds}
                onSaveSelectedActions={setSelectedActionIds}
                onOpenMicrosoft365={() => setActiveSubModal('microsoft365')}
                microsoftConnected={microsoftAccount.isConnected}
                teamsAvailability={teamsPresence.availability}
                onLogout={handleLogout}
                userRole={userRole}
                onOpenAdminPanel={() => setAdminPanelVisible(true)}
                workspaceName={authSession?.workspace?.name}
                workspaceRoleLabel={
                  authSession?.workspace && authSession?.membership
                    ? resolveWorkspaceDisplayRole(
                        authSession.membership.role,
                        authSession.workspace.type,
                        lang,
                      )
                    : undefined
                }
                onOpenWorkspaces={() => setWorkspaceModalVisible(true)}
              />
            )}
          </View>

          {/* Option A: Smooth Bezier Cradle Bottom Navigation Bar (Flush to Bottom Edge) */}
          {activeScreen === 'main' && (
            <NotchedBottomBar
              colors={colors}
              isRTL={isRTL}
              activeBottomTab={activeBottomTab}
              dashboardLabel={t.dashboardTab}
              clockInLabel={t.clockIn}
              requestTimeOffLabel={t.requestTimeOff}
              onSelectTab={(tab) => setActiveBottomTab(tab)}
              onPressQuickRequest={() => setRequestTimeOffVisible(true)}
            />
          )}

          {/* Request Time Off Modal */}
          <RequestTimeOffModal
            visible={requestTimeOffVisible}
            colors={colors}
            lang={lang}
            onClose={() => setRequestTimeOffVisible(false)}
            onSubmitRequest={handleSubmitTimeOff}
          />

          {/* Secondary Module Modal (Includes Separate Profile Screen & Separate Settings Screen) */}
          <SubModuleModal
            activeModal={activeSubModal}
            colors={colors}
            lang={lang}
            employeeProfile={employeeProfile}
            transactions={transactions}
             salarySlips={salarySlips}
             directory={directory}
            documents={INITIAL_DOCUMENTS}
            schedule={INITIAL_SCHEDULE}
            tasks={tasks}
            notifications={notifications}
            microsoftAccount={microsoftAccount}
            teamsPresence={teamsPresence}
            outlookEvents={outlookEvents}
            offlinePunches={offlinePunches}
            onClose={() => setActiveSubModal(null)}
            onUpdateProfile={setEmployeeProfile}
            onToggleTheme={() => setDarkMode((d) => !d)}
            onToggleLanguage={() =>
              setLang((prev) => (prev === 'en' ? 'ar' : 'en'))
            }
            onToggleBiometricLock={() => setBiometricLocked(true)}
            onSwitchModal={(modal) => setActiveSubModal(modal)}
            onToggleTask={handleToggleTask}
            onAddFinancialTransaction={handleAddFinancialTransaction}
            onMarkAllNotificationsRead={handleMarkAllNotificationsRead}
            onToggleMicrosoftSso={handleToggleMicrosoftSso}
            onSyncOfflinePunches={handleSyncOfflinePunches}
          />

          {/* Admin & Organization Hierarchy Panel Modal */}
          <AdminOrgPanelModal
            visible={adminPanelVisible}
            colors={colors}
            lang={lang}
            activeRole={userRole}
            approvals={approvals}
            onClose={() => setAdminPanelVisible(false)}
            onDecideApproval={handleDecideApproval}
          />

          {/* Multi-Tenant Workspace Switcher, Creation & Invite Acceptance Modal */}
          <WorkspaceModal
            visible={workspaceModalVisible}
            colors={colors}
            lang={lang}
            authToken={authToken}
            activeWorkspace={authSession?.workspace}
            activeMembership={authSession?.membership}
            activeEntitlements={authSession?.entitlements}
            onClose={() => setWorkspaceModalVisible(false)}
            onWorkspaceSwitched={async (nextApiSession) => {
              const nextSession: AuthSession = {
                token: nextApiSession.token,
                refreshToken: nextApiSession.refreshToken,
                role: nextApiSession.role,
                profile: nextApiSession.profile,
                branchId: nextApiSession.branchId,
                isRemoteAllowed: nextApiSession.isRemoteAllowed,
                authenticatedAt: Date.now(),
                authMethod: 'PASSWORD',
                mustChangePassword: nextApiSession.mustChangePassword,
                workspace: nextApiSession.workspace,
                membership: nextApiSession.membership,
                entitlements: nextApiSession.entitlements,
              };
              handleLoginSuccess(nextSession);
              await refreshMobileApiData(nextApiSession.token, nextApiSession.role);
            }}
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
