import React, { useCallback, useEffect, useState } from 'react';
import { Sidebar, AdminTab } from './components/Sidebar';
import { Header } from './components/Header';
import { OverviewView } from './components/OverviewView';
import { AttendanceView } from './components/AttendanceView';
import { BranchesView } from './components/BranchesView';
import { LeavesView } from './components/LeavesView';
import { EmployeesView } from './components/EmployeesView';
import { PayrollView } from './components/PayrollView';
import { AdminLoginScreen } from './components/AdminLoginScreen';
import {
  AdminPortalData,
  ApiError,
  clearAdminSession,
  decideLeave,
  downloadWps,
  getStoredAdminSession,
  loadAdminPortalData,
  saveBranch,
  UserSession,
} from './api/client';
import { LivePunchLog } from './data/mockAdminData';
import { X } from 'lucide-react';

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<AdminTab>('overview');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [isArabic, setIsArabic] = useState(false);
  const [session, setSession] = useState<UserSession | null>(() => getStoredAdminSession());
  const [portalData, setPortalData] = useState<AdminPortalData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedPunch, setSelectedPunch] = useState<LivePunchLog | null>(null);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
  }, [isDark]);

  useEffect(() => {
    document.documentElement.setAttribute('dir', isArabic ? 'rtl' : 'ltr');
    document.documentElement.setAttribute('lang', isArabic ? 'ar' : 'en');
  }, [isArabic]);

  const refreshPortalData = useCallback(async () => {
    if (!session) return;
    setLoadError(null);
    try {
      setPortalData(await loadAdminPortalData());
    } catch (error) {
      setLoadError(
        error instanceof ApiError
          ? error.message
          : 'Unable to load administration data.',
      );
    }
  }, [session]);

  useEffect(() => {
    void refreshPortalData();
  }, [refreshPortalData]);

  const handleLogout = () => {
    clearAdminSession();
    setSession(null);
    setPortalData(null);
    setSelectedPunch(null);
  };

  const handleExportWps = async () => {
    try {
      await downloadWps();
    } catch (error) {
      setLoadError(
        error instanceof ApiError ? error.message : 'Unable to download the WPS file.',
      );
    }
  };

  if (!session) {
    return <AdminLoginScreen onAuthenticated={setSession} />;
  }

  if (!portalData) {
    return (
      <main className="min-h-screen bg-slate-100 dark:bg-macq-surfaceDark flex items-center justify-center p-6">
        <div className="max-w-md rounded-2xl bg-white dark:bg-macq-cardDark p-6 text-center shadow-lg">
          <p className="text-sm font-bold text-slate-900 dark:text-white">
            {loadError || 'Loading secure administration data…'}
          </p>
          {loadError && (
            <button
              onClick={() => void refreshPortalData()}
              className="mt-4 rounded-xl bg-macq-orange px-4 py-2 text-xs font-bold text-white"
            >
              Try again
            </button>
          )}
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-macq-surfaceDark text-slate-900 dark:text-slate-100 flex">
      <div className="hidden md:block">
        <Sidebar
          currentTab={currentTab}
          onSelectTab={setCurrentTab}
          isCollapsed={isCollapsed}
          onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
          session={session}
          isArabic={isArabic}
          onLogout={handleLogout}
        />
      </div>

      {isMobileDrawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden bg-black/70 backdrop-blur-sm flex">
          <div className="w-64 bg-macq-dark text-white h-full relative">
            <button
              onClick={() => setIsMobileDrawerOpen(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white"
            >
              <X size={20} />
            </button>
            <Sidebar
              currentTab={currentTab}
              onSelectTab={(tab) => {
                setCurrentTab(tab);
                setIsMobileDrawerOpen(false);
              }}
              isCollapsed={false}
              onToggleCollapse={() => {}}
              session={session}
              isArabic={isArabic}
              onLogout={handleLogout}
            />
          </div>
          <div className="flex-1" onClick={() => setIsMobileDrawerOpen(false)} />
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
          onSelectTab={setCurrentTab}
          isDark={isDark}
          onToggleTheme={() => setIsDark(!isDark)}
          isArabic={isArabic}
          onToggleLanguage={() => setIsArabic(!isArabic)}
          onExportWps={() => void handleExportWps()}
          onToggleMobileDrawer={() => setIsMobileDrawerOpen(true)}
        />

        <main className="flex-1 p-6 max-w-7xl w-full mx-auto">
          {loadError && (
            <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
              {loadError}
            </p>
          )}
          {currentTab === 'overview' && (
            <OverviewView
              onNavigate={setCurrentTab}
              onSelectPunch={(punch) => {
                setSelectedPunch(punch);
                setCurrentTab('attendance');
              }}
              onExportWps={() => void handleExportWps()}
              isArabic={isArabic}
              employees={portalData.employees}
              branches={portalData.branches}
              leaves={portalData.leaves}
              attendance={portalData.attendance}
              payroll={portalData.payroll}
            />
          )}
          {currentTab === 'attendance' && (
            <AttendanceView
              selectedPunch={selectedPunch}
              onCloseInspection={() => setSelectedPunch(null)}
              onSelectPunch={setSelectedPunch}
              isArabic={isArabic}
              attendance={portalData.attendance}
            />
          )}
          {currentTab === 'branches' && (
            <BranchesView
              isArabic={isArabic}
              branches={portalData.branches}
              onSave={async (branch, id) => {
                await saveBranch(branch, id);
                await refreshPortalData();
              }}
            />
          )}
          {currentTab === 'leaves' && (
            <LeavesView
              isArabic={isArabic}
              requests={portalData.leaves}
              onDecision={async (id, decision) => {
                await decideLeave(id, decision);
                await refreshPortalData();
              }}
            />
          )}
          {currentTab === 'employees' && (
            <EmployeesView isArabic={isArabic} employees={portalData.employees} />
          )}
          {currentTab === 'payroll' && (
            <PayrollView
              onExportWps={() => void handleExportWps()}
              isArabic={isArabic}
              employees={portalData.employees}
              payroll={portalData.payroll}
            />
          )}
        </main>
      </div>
    </div>
  );
};

export default App;
