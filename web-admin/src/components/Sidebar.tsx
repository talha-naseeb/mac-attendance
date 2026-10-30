import React from 'react';
import {
  LayoutDashboard,
  Radio,
  Building2,
  CalendarCheck2,
  Users,
  Coins,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { UserSession } from '../api/client';

export type AdminTab =
  | 'overview'
  | 'attendance'
  | 'branches'
  | 'leaves'
  | 'employees'
  | 'payroll';

interface SidebarProps {
  currentTab: AdminTab;
  onSelectTab: (tab: AdminTab) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  session: UserSession;
  isArabic: boolean;
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  isCollapsed,
  onToggleCollapse,
  session,
  isArabic,
  onLogout,
}) => {
  const navItems = [
    {
      id: 'overview' as AdminTab,
      labelEn: 'Executive Overview',
      labelAr: 'نظرة عامة تنفيذية',
      icon: LayoutDashboard,
    },
    {
      id: 'attendance' as AdminTab,
      labelEn: 'Live Attendance Radar',
      labelAr: 'رادار الحضور المباشر',
      icon: Radio,
      badge: 'LIVE',
    },
    {
      id: 'branches' as AdminTab,
      labelEn: 'Branches & Geofences',
      labelAr: 'الفروع والنطاق الجغرافي',
      icon: Building2,
    },
    {
      id: 'leaves' as AdminTab,
      labelEn: 'Leave Approvals',
      labelAr: 'اعتمادات الإجازات',
      icon: CalendarCheck2,
      badge: '2',
    },
    {
      id: 'employees' as AdminTab,
      labelEn: 'Employees & Org',
      labelAr: 'الموظفون والهيكل التنظيمي',
      icon: Users,
    },
    {
      id: 'payroll' as AdminTab,
      labelEn: 'Payroll & Mudad WPS',
      labelAr: 'الرواتب وحماية الأجور',
      icon: Coins,
    },
  ];

  const isSuperAdmin = session.user.role === 'SUPER_ADMIN';

  return (
    <aside
      className={`fixed top-0 bottom-0 z-40 flex flex-col bg-macq-dark text-white border-r border-macq-borderDark/40 transition-all duration-300 ${
        isArabic ? 'right-0 border-l border-r-0' : 'left-0'
      } ${isCollapsed ? 'w-20' : 'w-64'}`}
    >
      {/* Brand Header */}
      <div className="h-16 px-4 flex items-center justify-between border-b border-macq-borderDark/40 bg-macq-dark/95 backdrop-blur-sm">
        <div className="flex items-center gap-3 overflow-hidden">
          {/* Official Concept A Logo Badge */}
          <div className="w-10 h-10 rounded-xl bg-macq-navy flex items-center justify-center flex-shrink-0 shadow-lg border border-white/10">
            <svg viewBox="0 0 100 100" className="w-6 h-6">
              <circle cx="50" cy="30" r="14" fill="#FE5800" />
              <path
                d="M18 80 L34 46 L50 66 L66 46 L82 80 Z"
                fill="#FFFFFF"
              />
            </svg>
          </div>
          {!isCollapsed && (
            <div className="flex flex-col">
              <span className="font-extrabold text-base tracking-tight text-white flex items-center gap-1.5">
                Mac<span className="text-macq-orange">Q</span>HR
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-macq-orange/20 text-macq-orange font-bold uppercase tracking-wider">
                  Admin
                </span>
              </span>
              <span className="text-[11px] text-slate-400 font-medium truncate">
                {isArabic ? 'بوابة الإدارة المركزية' : 'Enterprise Console'}
              </span>
            </div>
          )}
        </div>

        <button
          onClick={onToggleCollapse}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      {/* Role Badge Indicator */}
      <div className={`px-4 py-3 bg-white/5 border-b border-white/5 ${isCollapsed ? 'hidden' : 'block'}`}>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            {isArabic ? 'مستوى الصلاحية' : 'Access Tier'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${
              isSuperAdmin ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]' : 'bg-teal-400 shadow-[0_0_8px_rgba(45,212,191,0.8)]'
            }`}
          />
          <span className="text-xs font-bold text-white tracking-wide">
            {isSuperAdmin ? 'SUPER ADMIN (Owner)' : 'HR ADMIN (Operations)'}
          </span>
        </div>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = currentTab === item.id;
          const Icon = item.icon;
          const label = isArabic ? item.labelAr : item.labelEn;

          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-xs transition-all duration-150 group relative ${
                isActive
                  ? 'bg-gradient-to-r from-macq-orange to-macq-orange/90 text-white font-bold shadow-md shadow-macq-orange/20'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              } ${isCollapsed ? 'justify-center' : ''}`}
              title={isCollapsed ? label : undefined}
            >
              <Icon
                size={18}
                className={`flex-shrink-0 ${
                  isActive ? 'text-white' : 'text-slate-400 group-hover:text-white'
                }`}
              />
              {!isCollapsed && (
                <span className="truncate flex-1 text-left rtl:text-right">
                  {label}
                </span>
              )}
              {!isCollapsed && item.badge && (
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                    item.badge === 'LIVE'
                      ? 'bg-emerald-500/20 text-emerald-300 animate-pulse'
                      : 'bg-white/20 text-white'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* User Session Footer */}
      <div className="p-3 border-t border-macq-borderDark/40 bg-macq-dark/95">
        <div
          className={`flex items-center gap-3 p-2 rounded-xl bg-white/5 ${
            isCollapsed ? 'justify-center' : ''
          }`}
        >
          <div className="w-9 h-9 rounded-lg bg-macq-navy border border-white/20 flex items-center justify-center font-bold text-xs text-white shadow-sm flex-shrink-0">
            {isSuperAdmin ? 'SO' : 'SA'}
          </div>
          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-white truncate">
                {session.user.name}
              </p>
              <p className="text-[10px] text-slate-400 truncate">
                {session.user.email}
              </p>
            </div>
          )}
          {!isCollapsed && (
            <button
              onClick={onLogout}
              className="text-[10px] font-bold text-slate-400 hover:text-white"
            >
              Sign out
            </button>
          )}
        </div>
      </div>
    </aside>
  );
};
