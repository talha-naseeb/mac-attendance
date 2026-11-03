import React, { useEffect, useRef, useState } from 'react';
import {
  Sun,
  Moon,
  Languages,
  Clock,
  Home,
  Bell,
  LogOut,
  Menu,
  ChevronDown,
} from 'lucide-react';
import { AdminTab } from './Sidebar';
import { UserSession } from '../api/client';

interface HeaderProps {
  currentTab: AdminTab;
  onSelectTab: (tab: AdminTab) => void;
  isDark: boolean;
  onToggleTheme: () => void;
  isArabic: boolean;
  onToggleLanguage: () => void;
  onToggleMobileDrawer: () => void;
  session: UserSession;
  onLogout: () => void;
  pendingLeavesCount?: number;
}

function formatRiyadhTime(isArabic: boolean): string {
  try {
    return new Intl.DateTimeFormat(isArabic ? 'ar-SA' : 'en-US', {
      timeZone: 'Asia/Riyadh',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(new Date());
  } catch {
    return '09:45 AM';
  }
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'MA';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onSelectTab,
  isDark,
  onToggleTheme,
  isArabic,
  onToggleLanguage,
  onToggleMobileDrawer,
  session,
  onLogout,
  pendingLeavesCount = 0,
}) => {
  const [ksaTime, setKsaTime] = useState(() => formatRiyadhTime(isArabic));
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setKsaTime(formatRiyadhTime(isArabic));
    const timer = window.setInterval(() => {
      setKsaTime(formatRiyadhTime(isArabic));
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [isArabic]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setNotifOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="sticky top-0 z-30 h-16 bg-white/95 dark:bg-macq-surfaceDark/95 backdrop-blur-md border-b border-slate-200 dark:border-macq-borderDark/40 px-3 sm:px-6 flex items-center justify-between gap-2">
      {/* Left: Mobile Drawer Trigger + Home */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onToggleMobileDrawer}
          aria-label={isArabic ? 'فتح القائمة الجانبية' : 'Open navigation menu'}
          className="md:hidden p-2 rounded-xl text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white bg-slate-100/80 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
        >
          <Menu size={18} />
        </button>

        <button
          type="button"
          onClick={() => onSelectTab('overview')}
          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
            currentTab === 'overview'
              ? 'bg-macq-navy text-white dark:bg-white/10 dark:text-white'
              : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200'
          }`}
          title={isArabic ? 'لوحة التحكم' : 'Dashboard'}
        >
          <Home size={15} className={currentTab === 'overview' ? 'text-macq-orange' : ''} />
          <span>{isArabic ? 'لوحة التحكم' : 'Dashboard'}</span>
        </button>
      </div>

      {/* Right: KSA Time Zone, Bilingual, Dark Mode, Notifications, Profile */}
      <div className="flex items-center gap-1.5 sm:gap-2.5">
        {/* 1. KSA Time Zone */}
        <div
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 text-xs font-semibold"
          title="Asia/Riyadh (UTC+3)"
        >
          <Clock size={13} className="text-macq-orange flex-shrink-0" />
          <span className="whitespace-nowrap">
            <span className="hidden sm:inline">{isArabic ? 'الرياض · ' : 'KSA · '}</span>
            {ksaTime}
          </span>
        </div>

        {/* 2. Bilingual Toggle */}
        <button
          type="button"
          onClick={onToggleLanguage}
          aria-label={isArabic ? 'Switch to English' : 'التبديل إلى العربية'}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors"
          title="Switch Language / تبديل اللغة"
        >
          <Languages size={15} />
          <span>{isArabic ? 'EN' : 'عربي'}</span>
        </button>

        {/* 3. Dark Mode Toggle */}
        <button
          type="button"
          onClick={onToggleTheme}
          aria-label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors"
          title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {isDark ? (
            <Sun size={16} className="text-amber-400" />
          ) : (
            <Moon size={16} className="text-slate-600" />
          )}
        </button>

        {/* 4. Notifications */}
        <div className="relative" ref={notifRef}>
          <button
            type="button"
            onClick={() => {
              setNotifOpen((prev) => !prev);
              setProfileOpen(false);
            }}
            aria-label={isArabic ? 'الإشعارات' : 'Notifications'}
            className="relative p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors"
            title={isArabic ? 'الإشعارات' : 'Notifications'}
          >
            <Bell size={16} />
            {pendingLeavesCount > 0 && (
              <span className="absolute -top-1 -end-1 min-w-[16px] h-4 px-1 rounded-full bg-macq-orange text-white text-[10px] font-extrabold flex items-center justify-center">
                {pendingLeavesCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="absolute end-0 mt-2 w-72 rounded-2xl bg-white dark:bg-macq-cardDark border border-slate-200 dark:border-slate-700 shadow-xl p-3 z-50 space-y-2">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                <span className="text-xs font-extrabold text-slate-900 dark:text-white">
                  {isArabic ? 'الإشعارات' : 'Notifications'}
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-macq-orange/10 text-macq-orange">
                  {pendingLeavesCount} {isArabic ? 'جديد' : 'pending'}
                </span>
              </div>

              {pendingLeavesCount > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    setNotifOpen(false);
                    onSelectTab('leaves');
                  }}
                  className="w-full text-left rtl:text-right p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/60 dark:hover:bg-slate-800 transition-colors"
                >
                  <p className="text-xs font-bold text-slate-900 dark:text-white">
                    {isArabic
                      ? `${pendingLeavesCount} طلب إجازة بانتظار المراجعة`
                      : `${pendingLeavesCount} leave request(s) awaiting approval`}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {isArabic ? 'اضغط لفتح اعتمادات الإجازات' : 'Click to open Leave Approvals'}
                  </p>
                </button>
              ) : (
                <p className="py-4 text-center text-xs text-slate-400">
                  {isArabic ? 'لا توجد إشعارات جديدة' : 'All caught up — no pending alerts'}
                </p>
              )}
            </div>
          )}
        </div>

        {/* 5. Profile */}
        <div className="relative" ref={profileRef}>
          <button
            type="button"
            onClick={() => {
              setProfileOpen((prev) => !prev);
              setNotifOpen(false);
            }}
            className="flex items-center gap-2 pl-1.5 pr-2.5 rtl:pl-2.5 rtl:pr-1.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition-colors"
            title={session.user.name}
          >
            <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-macq-navy to-macq-orange flex items-center justify-center text-white text-[11px] font-extrabold">
              {getInitials(session.user.name)}
            </div>
            <span className="hidden sm:inline text-xs font-bold text-slate-800 dark:text-slate-100 max-w-[110px] truncate">
              {session.user.name}
            </span>
            <ChevronDown size={13} className="text-slate-400" />
          </button>

          {profileOpen && (
            <div className="absolute end-0 mt-2 w-60 rounded-2xl bg-white dark:bg-macq-cardDark border border-slate-200 dark:border-slate-700 shadow-xl p-3 z-50 space-y-2.5">
              <div className="pb-2.5 border-b border-slate-100 dark:border-slate-800">
                <p className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
                  {session.user.name}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                  {session.user.email}
                </p>
                <span className="inline-block mt-1.5 px-2 py-0.5 rounded-md bg-macq-orange/10 text-macq-orange text-[10px] font-bold">
                  {session.user.role}
                </span>
              </div>

              <button
                type="button"
                onClick={() => {
                  setProfileOpen(false);
                  onLogout();
                }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
              >
                <LogOut size={14} />
                <span>{isArabic ? 'تسجيل الخروج' : 'Sign Out'}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
