import React, { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { Sidebar, AdminTab } from './components/Sidebar';
import { Header } from './components/Header';
import { AdminLoginScreen } from './components/AdminLoginScreen';
import {
  clearAdminSession,
  getStoredAdminSession,
  SESSION_EXPIRED_EVENT,
} from './api/adminSession';
import {
  ApiError,
  decideLeave,
  deleteBranch,
  downloadWps,
  fetchAdminAttendance,
  fetchAdminBranches,
  fetchAdminEmployees,
  fetchAdminLeaves,
  fetchAdminPayrollSummary,
  PayrollSummary,
  saveBranch,
  UserSession,
} from './api/client';
import {
  AdminBranch,
  AdminEmployee,
  AdminLeaveItem,
  LivePunchLog,
} from './data/mockAdminData';
import { pathForTab, tabFromPath } from './router';

const THEME_STORAGE_KEY = 'macqhr:admin:theme';
const LANG_STORAGE_KEY = 'macqhr:admin:lang';

const OverviewView = lazy(() =>
  import('./components/OverviewView').then((m) => ({ default: m.OverviewView })),
);
const AttendanceView = lazy(() =>
  import('./components/AttendanceView').then((m) => ({ default: m.AttendanceView })),
);
const BranchesView = lazy(() =>
  import('./components/BranchesView').then((m) => ({ default: m.BranchesView })),
);
const LeavesView = lazy(() =>
  import('./components/LeavesView').then((m) => ({ default: m.LeavesView })),
);
const EmployeesView = lazy(() =>
  import('./components/EmployeesView').then((m) => ({ default: m.EmployeesView })),
);
const PayrollView = lazy(() =>
  import('./components/PayrollView').then((m) => ({ default: m.PayrollView })),
);
const AuditLogsView = lazy(() =>
  import('./components/AuditLogsView').then((m) => ({ default: m.AuditLogsView })),
);

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<AdminTab>(() =>
    typeof window !== 'undefined' ? tabFromPath(window.location.pathname) : 'overview',
  );
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      return window.localStorage.getItem(THEME_STORAGE_KEY) === 'dark';
    } catch {
      return false;
    }
  });
  const [isArabic, setIsArabic] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      return window.localStorage.getItem(LANG_STORAGE_KEY) === 'ar';
    } catch {
      return false;
    }
  });
  const [session, setSession] = useState<UserSession | null>(() => getStoredAdminSession());
  const [sessionExpiredNotice, setSessionExpiredNotice] = useState<string | null>(null);

  // Route-scoped cached slices (loaded lazily only when the active route needs them)
  const [employees, setEmployees] = useState<AdminEmployee[] | null>(null);
  const [branches, setBranches] = useState<AdminBranch[] | null>(null);
  const [leaves, setLeaves] = useState<AdminLeaveItem[] | null>(null);
  const [attendance, setAttendance] = useState<LivePunchLog[] | null>(null);
  const [payroll, setPayroll] = useState<PayrollSummary | null>(null);

  const [routeLoading, setRouteLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedPunch, setSelectedPunch] = useState<LivePunchLog | null>(null);

  const navigateTab = useCallback((tab: AdminTab) => {
    setCurrentTab(tab);
    if (typeof window !== 'undefined') {
      const targetPath = pathForTab(tab);
      if (window.location.pathname !== targetPath) {
        window.history.pushState({ tab }, '', targetPath);
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    // Normalize "/" to "/overview" on initial mount without adding a history entry
    const resolved = tabFromPath(window.location.pathname);
    const canonical = pathForTab(resolved);
    if (window.location.pathname !== canonical) {
      window.history.replaceState({ tab: resolved }, '', canonical);
    }
    const onPopState = () => {
      setCurrentTab(tabFromPath(window.location.pathname));
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    document.body.classList.toggle('dark', isDark);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, isDark ? 'dark' : 'light');
    } catch {
      // ignore storage errors
    }
  }, [isDark]);

  useEffect(() => {
    document.documentElement.setAttribute('dir', isArabic ? 'rtl' : 'ltr');
    document.documentElement.setAttribute('lang', isArabic ? 'ar' : 'en');
    try {
      window.localStorage.setItem(LANG_STORAGE_KEY, isArabic ? 'ar' : 'en');
    } catch {
      // ignore storage errors
    }
  }, [isArabic]);

  useEffect(() => {
    if (!isMobileDrawerOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMobileDrawerOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isMobileDrawerOpen]);

  const loadRouteData = useCallback(
    async (tab: AdminTab, force = false) => {
      if (!session) return;
      // /logs manages its own paginated requests inside AuditLogsView
      if (tab === 'logs') return;

      setLoadError(null);
      const tasks: Promise<void>[] = [];

      if (tab === 'overview') {
        if (force || !employees) tasks.push(fetchAdminEmployees().then(setEmployees));
        if (force || !branches) tasks.push(fetchAdminBranches().then(setBranches));
        if (force || !leaves) tasks.push(fetchAdminLeaves().then(setLeaves));
        if (force || !attendance) tasks.push(fetchAdminAttendance().then(setAttendance));
        if (force || !payroll) tasks.push(fetchAdminPayrollSummary().then(setPayroll));
      } else if (tab === 'attendance') {
        if (force || !attendance) tasks.push(fetchAdminAttendance().then(setAttendance));
      } else if (tab === 'branches') {
        if (force || !branches) tasks.push(fetchAdminBranches().then(setBranches));
      } else if (tab === 'leaves') {
        if (force || !leaves) tasks.push(fetchAdminLeaves().then(setLeaves));
      } else if (tab === 'employees') {
        if (force || !branches) tasks.push(fetchAdminBranches().then(setBranches));
        if (force || !employees) tasks.push(fetchAdminEmployees().then(setEmployees));
      } else if (tab === 'payroll') {
        if (force || !employees) tasks.push(fetchAdminEmployees().then(setEmployees));
        if (force || !payroll) tasks.push(fetchAdminPayrollSummary().then(setPayroll));
      }

      if (tasks.length === 0) return;

      setRouteLoading(true);
      try {
        await Promise.all(tasks);
      } catch (error) {
        setLoadError(
          error instanceof ApiError
            ? error.message
            : 'Unable to load administration data for this route.',
        );
      } finally {
        setRouteLoading(false);
      }
    },
    [session, employees, branches, leaves, attendance, payroll],
  );

  useEffect(() => {
    void loadRouteData(currentTab, false);
  }, [currentTab, loadRouteData]);

  useEffect(() => {
    const handleSessionExpired = () => {
      setSession(null);
      setEmployees(null);
      setBranches(null);
      setLeaves(null);
      setAttendance(null);
      setPayroll(null);
      setSelectedPunch(null);
      setSessionExpiredNotice(
        isArabic
          ? 'انتهت صلاحية جلسة العمل الخاصة بك. يرجى إعادة تسجيل الدخول للمتابعة.'
          : 'Your administrative session has expired. Please sign in again to continue.',
      );
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
    return () =>
      window.removeEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
  }, [isArabic]);

  const handleLogout = () => {
    clearAdminSession();
    setSessionExpiredNotice(null);
    setSession(null);
    setEmployees(null);
    setBranches(null);
    setLeaves(null);
    setAttendance(null);
    setPayroll(null);
    setSelectedPunch(null);
  };

  const handleExportWps = async (month?: string) => {
    try {
      await downloadWps(month);
    } catch (error) {
      setLoadError(
        error instanceof ApiError ? error.message : 'Unable to download the WPS file.',
      );
    }
  };

  if (!session) {
    return (
      <AdminLoginScreen
        onAuthenticated={(newSession) => {
          setSessionExpiredNotice(null);
          setSession(newSession);
        }}
        isDark={isDark}
        onToggleTheme={() => setIsDark((d) => !d)}
        isArabic={isArabic}
        onToggleLanguage={() => setIsArabic((a) => !a)}
        sessionExpiredNotice={sessionExpiredNotice}
      />
    );
  }

  const pendingLeavesCount = leaves
    ? leaves.filter((leave) => leave.status === 'PENDING').length
    : undefined;

  const routeFallback = (
    <div className="rounded-2xl bg-white dark:bg-macq-cardDark border border-slate-200/80 dark:border-macq-borderDark/60 p-8 text-center shadow-sm">
      <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
        {isArabic ? 'جاري تحميل بيانات القسم...' : `Loading /${currentTab} view…`}
      </p>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-macq-surfaceDark text-slate-900 dark:text-slate-100 flex">
      <div className="hidden md:block">
        <Sidebar
          currentTab={currentTab}
          onSelectTab={navigateTab}
          isCollapsed={isCollapsed}
          onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
          session={session}
          isArabic={isArabic}
          onLogout={handleLogout}
          pendingLeavesCount={pendingLeavesCount}
        />
      </div>

      {isMobileDrawerOpen && (
        <div
          className="fixed inset-0 z-50 md:hidden bg-black/70 backdrop-blur-sm flex"
          role="dialog"
          aria-modal="true"
          aria-label={isArabic ? 'قائمة التنقل' : 'Navigation menu'}
        >
          <Sidebar
            currentTab={currentTab}
            onSelectTab={(tab) => {
              navigateTab(tab);
              setIsMobileDrawerOpen(false);
            }}
            isCollapsed={false}
            onToggleCollapse={() => {}}
            session={session}
            isArabic={isArabic}
            onLogout={handleLogout}
            isMobile
            onCloseMobile={() => setIsMobileDrawerOpen(false)}
            pendingLeavesCount={pendingLeavesCount}
          />
          <div
            className="flex-1"
            onClick={() => setIsMobileDrawerOpen(false)}
            aria-hidden="true"
          />
        </div>
      )}

      <div
        className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${
          isArabic
            ? isCollapsed
              ? 'md:mr-20'
              : 'md:mr-64'
            : isCollapsed
              ? 'md:ml-20'
              : 'md:ml-64'
        }`}
      >
        <Header
          currentTab={currentTab}
          onSelectTab={navigateTab}
          isDark={isDark}
          onToggleTheme={() => setIsDark(!isDark)}
          isArabic={isArabic}
          onToggleLanguage={() => setIsArabic(!isArabic)}
          onToggleMobileDrawer={() => setIsMobileDrawerOpen(true)}
          session={session}
          onLogout={handleLogout}
          pendingLeavesCount={pendingLeavesCount}
        />

        <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto">
          {loadError && (
            <div className="mb-4 flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
              <span>{loadError}</span>
              <button
                onClick={() => void loadRouteData(currentTab, true)}
                className="ml-3 rounded-lg bg-rose-600 px-2.5 py-1 text-[11px] font-bold text-white"
              >
                {isArabic ? 'إعادة المحاولة' : 'Retry'}
              </button>
            </div>
          )}

          <Suspense fallback={routeFallback}>
            {currentTab === 'overview' &&
              (employees && branches && leaves && attendance && payroll ? (
                <OverviewView
                  onNavigate={navigateTab}
                  onSelectPunch={(punch) => {
                    setSelectedPunch(punch);
                    navigateTab('attendance');
                  }}
                  onExportWps={() => void handleExportWps()}
                  isArabic={isArabic}
                  employees={employees}
                  branches={branches}
                  leaves={leaves}
                  attendance={attendance}
                  payroll={payroll}
                />
              ) : (
                routeFallback
              ))}

            {currentTab === 'attendance' &&
              (attendance ? (
                <AttendanceView
                  selectedPunch={selectedPunch}
                  onCloseInspection={() => setSelectedPunch(null)}
                  onSelectPunch={setSelectedPunch}
                  isArabic={isArabic}
                  attendance={attendance}
                />
              ) : (
                routeFallback
              ))}

            {currentTab === 'branches' &&
              (branches ? (
                <BranchesView
                  isArabic={isArabic}
                  branches={branches}
                  onSave={async (branch, id) => {
                    await saveBranch(branch, id);
                    setBranches(await fetchAdminBranches());
                  }}
                  onDelete={async (id) => {
                    await deleteBranch(id);
                    const [updatedBranches, updatedEmployees] = await Promise.all([
                      fetchAdminBranches(),
                      employees ? fetchAdminEmployees() : Promise.resolve(null),
                    ]);
                    setBranches(updatedBranches);
                    if (updatedEmployees) setEmployees(updatedEmployees);
                  }}
                />
              ) : (
                routeFallback
              ))}

            {currentTab === 'leaves' &&
              (leaves ? (
                <LeavesView
                  isArabic={isArabic}
                  requests={leaves}
                  onDecision={async (id, decision, comments, isHrOverride) => {
                    await decideLeave(id, decision, comments, isHrOverride);
                    setLeaves(await fetchAdminLeaves());
                  }}
                />
              ) : (
                routeFallback
              ))}

            {currentTab === 'employees' && (
              <EmployeesView
                isArabic={isArabic}
                branches={branches ?? []}
                managers={(employees ?? []).filter((employee) => employee.role === 'MANAGER')}
                onChanged={async () => {
                  const [updatedEmployees, updatedPayroll] = await Promise.all([
                    fetchAdminEmployees(),
                    payroll ? fetchAdminPayrollSummary() : Promise.resolve(null),
                  ]);
                  setEmployees(updatedEmployees);
                  if (updatedPayroll) setPayroll(updatedPayroll);
                }}
              />
            )}

            {currentTab === 'payroll' &&
              (employees && payroll ? (
                <PayrollView
                  onExportWps={() => void handleExportWps()}
                  isArabic={isArabic}
                  employees={employees}
                  payroll={payroll}
                />
              ) : (
                routeFallback
              ))}

            {currentTab === 'logs' && <AuditLogsView isArabic={isArabic} />}
          </Suspense>
          {routeLoading && currentTab !== 'logs' && (
            <span className="sr-only">Loading route data</span>
          )}
        </main>
      </div>
    </div>
  );
};

export default App;

