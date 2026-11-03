import React from 'react';
import {
  LayoutDashboard,
  Radio,
  Building2,
  CalendarCheck2,
  Users,
  Coins,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  LogOut,
  X,
  type LucideIcon,
} from 'lucide-react';
import { UserSession } from '../api/client';

export type AdminTab =
  | 'overview'
  | 'attendance'
  | 'branches'
  | 'leaves'
  | 'employees'
  | 'payroll'
  | 'logs';

interface SidebarProps {
  currentTab: AdminTab;
  onSelectTab: (tab: AdminTab) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  session: UserSession;
  isArabic: boolean;
  onLogout: () => void;
  isMobile?: boolean;
  onCloseMobile?: () => void;
  pendingLeavesCount?: number;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'MA';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  isCollapsed,
  onToggleCollapse,
  session,
  isArabic,
  onLogout,
  isMobile = false,
  onCloseMobile,
  pendingLeavesCount,
}) => {
  const navItems: Array<{
    id: AdminTab;
    labelEn: string;
    labelAr: string;
    icon: LucideIcon;
    badge?: string;
  }> = [
    {
      id: 'overview',
      labelEn: 'Dashboard',
      labelAr: 'لوحة التحكم',
      icon: LayoutDashboard,
    },
    {
      id: 'attendance',
      labelEn: 'Live Attendance Radar',
      labelAr: 'رادار الحضور المباشر',
      icon: Radio,
      badge: 'LIVE',
    },
    {
      id: 'branches',
      labelEn: 'Branches & Geofences',
      labelAr: 'الفروع والنطاق الجغرافي',
      icon: Building2,
    },
    {
      id: 'leaves',
      labelEn: 'Leave Approvals',
      labelAr: 'اعتمادات الإجازات',
      icon: CalendarCheck2,
      badge:
        typeof pendingLeavesCount === 'number' && pendingLeavesCount > 0
          ? String(pendingLeavesCount)
          : undefined,
    },
    {
      id: 'employees',
      labelEn: 'Employees & Org',
      labelAr: 'الموظفون والهيكل التنظيمي',
      icon: Users,
    },
    {
      id: 'payroll',
      labelEn: 'Payroll & Mudad WPS',
      labelAr: 'الرواتب وحماية الأجور',
      icon: Coins,
    },
    {
      id: 'logs',
      labelEn: 'Audit & Activity Logs',
      labelAr: 'سجل التدقيق والعمليات',
      icon: ShieldAlert,
    },
  ];

  const isSuperAdmin = session.user.role === 'SUPER_ADMIN';
  const collapsed = isMobile ? false : isCollapsed;
  const initials = getInitials(session.user.name);

  return (
    <aside
      aria-label={isArabic ? 'التنقل الرئيسي' : 'Primary navigation'}
      className={
        isMobile
          ? 'w-72 max-w-[85vw] h-full flex flex-col bg-macq-dark text-white shadow-2xl'
          : `fixed top-0 bottom-0 z-40 flex flex-col bg-macq-dark text-white border-r border-macq-borderDark/40 transition-all duration-300 ${
              isArabic ? 'right-0 border-l border-r-0' : 'left-0'
            } ${collapsed ? 'w-20' : 'w-64'}`
      }
    >
      {/* Brand Header */}
      <div className="h-16 px-4 flex items-center justify-between border-b border-macq-borderDark/40 bg-macq-dark/95 backdrop-blur-sm">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="w-10 h-10 rounded-xl bg-macq-navy flex items-center justify-center flex-shrink-0 shadow-lg border border-white/10">
            {/* Concept 02: Dual Shift Pulse */}
            <svg viewBox="0 0 200 200" className="w-6 h-6" fill="none" aria-hidden="true">
              <path
                d="M 88 31 L 113 31 L 68 76 L 68 96 L 54 96 C 38 96, 32 86, 40 74 L 88 31 Z"
                fill="#0F4C7A"
              />
              <path
                d="M 112 169 L 87 169 L 132 124 L 132 104 L 146 104 C 162 104, 168 114, 160 126 L 112 169 Z"
                fill="#0F4C7A"
              />
              <polygon points="173,14 148,14 64,100 89,100" fill="#FFFFFF" />
              <polygon points="111,104 136,104 52,190 27,190" fill="#FFFFFF" />
              <circle cx="140" cy="83" r="11" fill="#FE5800" />
            </svg>
          </div>
          {!collapsed && (
            <div className="flex flex-col min-w-0">
              <span className="font-extrabold text-base tracking-tight text-white flex items-center gap-1.5">
                Shift<span className="text-macq-orange">ly</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-macq-orange/20 text-macq-orange font-bold uppercase tracking-wider">
                  {isArabic ? 'إدارة' : 'Admin'}
                </span>
              </span>
              <span className="text-[11px] text-slate-400 font-medium truncate">
                {isArabic ? 'بوابة الإدارة المركزية' : 'Enterprise Console'}
              </span>
            </div>
          )}
        </div>

        {isMobile ? (
          <button
            type="button"
            onClick={onCloseMobile}
            aria-label={isArabic ? 'إغلاق القائمة' : 'Close menu'}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X size={18} />
          </button>
        ) : (
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            title={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            {collapsed ? (
              <ChevronRight size={18} className="rtl:rotate-180" />
            ) : (
              <ChevronLeft size={18} className="rtl:rotate-180" />
            )}
          </button>
        )}
      </div>

      {/* Role Badge Indicator */}
      <div
        className={`px-4 py-3 bg-white/5 border-b border-white/5 ${
          collapsed ? 'hidden' : 'block'
        }`}
      >
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
            {isArabic ? 'مستوى الصلاحية' : 'Access Tier'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full flex-shrink-0 ${
              isSuperAdmin
                ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]'
                : 'bg-teal-400 shadow-[0_0_8px_rgba(45,212,191,0.8)]'
            }`}
          />
          <span className="text-xs font-bold text-white tracking-wide truncate">
            {isSuperAdmin
              ? isArabic
                ? 'مدير النظام الأعلى (Super Admin)'
                : 'SUPER ADMIN (Owner)'
              : isArabic
                ? 'مسؤول الموارد البشرية (HR Admin)'
                : 'HR ADMIN (Operations)'}
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
              type="button"
              onClick={() => onSelectTab(item.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-xs transition-all duration-150 group relative ${
                isActive
                  ? 'bg-gradient-to-r from-macq-orange to-macq-orange/90 text-white font-bold shadow-md shadow-macq-orange/20'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              } ${collapsed ? 'justify-center' : ''}`}
              title={collapsed ? label : undefined}
            >
              <Icon
                size={18}
                className={`flex-shrink-0 ${
                  isActive ? 'text-white' : 'text-slate-400 group-hover:text-white'
                }`}
              />
              {!collapsed && (
                <span className="truncate flex-1 text-left rtl:text-right">{label}</span>
              )}
              {!collapsed && item.badge && (
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
            collapsed ? 'flex-col justify-center gap-2' : ''
          }`}
        >
          <div className="w-9 h-9 rounded-lg bg-macq-navy border border-white/20 flex items-center justify-center font-bold text-xs text-white shadow-sm flex-shrink-0">
            {initials}
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-white truncate">{session.user.name}</p>
              <p className="text-[10px] text-slate-400 truncate">{session.user.email}</p>
            </div>
          )}
          <button
            type="button"
            onClick={onLogout}
            title={isArabic ? 'تسجيل الخروج' : 'Sign out'}
            className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-bold text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
          >
            <LogOut size={13} />
            {!collapsed && <span>{isArabic ? 'خروج' : 'Sign out'}</span>}
          </button>
        </div>
      </div>
    </aside>
  );
};
