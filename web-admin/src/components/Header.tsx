import React from 'react';
import {
  Sun,
  Moon,
  Languages,
  Clock,
  Download,
  Radio,
  FileCheck2,
  Menu,
} from 'lucide-react';
import { AdminTab } from './Sidebar';

interface HeaderProps {
  currentTab: AdminTab;
  onSelectTab: (tab: AdminTab) => void;
  isDark: boolean;
  onToggleTheme: () => void;
  isArabic: boolean;
  onToggleLanguage: () => void;
  onExportWps: () => void;
  onToggleMobileDrawer: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onSelectTab,
  isDark,
  onToggleTheme,
  isArabic,
  onToggleLanguage,
  onExportWps,
  onToggleMobileDrawer,
}) => {
  const tabTitles: Record<AdminTab, { en: string; ar: string; descEn: string; descAr: string }> = {
    overview: {
      en: 'Executive Command Center',
      ar: 'مركز القيادة التنفيذي',
      descEn: 'Real-time corporate attendance, branch telemetry & compliance metrics',
      descAr: 'مؤشرات الحضور المباشر والنطاق الجغرافي والامتثال في الوقت الفعلي',
    },
    attendance: {
      en: 'Live Attendance Radar',
      ar: 'رادار الحضور والتحقق الأمني',
      descEn: '6-Layer anti-spoofing telemetry & geofence boundary stream',
      descAr: 'تحليل البصمات المباشر وتتبع النطاق الجغرافي والحماية من التزييف',
    },
    branches: {
      en: 'Office Branches & Geofences',
      ar: 'الفروع والنطاقات الجغرافية',
      descEn: 'GPS coordinate anchors, radius thresholds, Wi-Fi BSSID & BLE beacons',
      descAr: 'إحداثيات الفروع، محيط الـ 150م، والشبكات اللاسلكية المعتمدة',
    },
    leaves: {
      en: 'Leave Approvals Pipeline',
      ar: 'اعتمادات الإجازات والطلبات',
      descEn: 'Saudi Labor Law compliant requests & MS Teams Adaptive Cards',
      descAr: 'طلبات الإجازات وفق نظام العمل وبطاقات مايكروسوفت تيمز التفاعلية',
    },
    employees: {
      en: 'Employee Directory & Hierarchy',
      ar: 'دليل الموظفين والهيكل الوظيفي',
      descEn: 'Corporate roster, Saudi national/expat records, and reporting lines',
      descAr: 'سجل الموظفين والمواطنين والمقيمين وخطوط التقارير المباشرة',
    },
    payroll: {
      en: 'Payroll & Mudad WPS Hub',
      ar: 'الرواتب وحماية الأجور (مدد)',
      descEn: 'GOSI calculation engine (9.75% / 11.75%) & official WPS file generation',
      descAr: 'احتساب التأمينات الاجتماعية وتصدير ملفات نظام حماية الأجور (مدد)',
    },
  };

  const currentInfo = tabTitles[currentTab];

  return (
    <header className="sticky top-0 z-30 h-16 bg-white/90 dark:bg-macq-surfaceDark/90 backdrop-blur-md border-b border-slate-200 dark:border-macq-borderDark/40 px-6 flex items-center justify-between">
      {/* Left: Mobile trigger & Page Title */}
      <div className="flex items-center gap-4">
        <button
          onClick={onToggleMobileDrawer}
          className="md:hidden p-2 rounded-lg text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <Menu size={20} />
        </button>

        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <h1 className="font-extrabold text-base text-slate-900 dark:text-white tracking-tight">
              {isArabic ? currentInfo.ar : currentInfo.en}
            </h1>
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
              API Online (4000)
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 hidden lg:block">
            {isArabic ? currentInfo.descAr : currentInfo.descEn}
          </p>
        </div>
      </div>

      {/* Right: Quick Action Toolbar & Utility Controls */}
      <div className="flex items-center gap-3">
        {/* Quick Links Toolbar */}
        <div className="hidden xl:flex items-center gap-2 pr-3 border-r border-slate-200 dark:border-slate-800">
          <button
            onClick={() => onSelectTab('attendance')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              currentTab === 'attendance'
                ? 'bg-macq-navy text-white shadow-sm'
                : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200'
            }`}
          >
            <Radio size={14} className="text-macq-orange" />
            <span>{isArabic ? 'رادار الحضور' : 'Live Radar'}</span>
          </button>

          <button
            onClick={() => onSelectTab('leaves')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              currentTab === 'leaves'
                ? 'bg-macq-navy text-white shadow-sm'
                : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200'
            }`}
          >
            <FileCheck2 size={14} className="text-emerald-500" />
            <span>{isArabic ? 'طلبات الإجازات' : 'Pending Leaves'}</span>
          </button>

          <button
            onClick={onExportWps}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-macq-orange text-white hover:bg-macq-orange/90 shadow-sm transition-all"
            title="Export official Saudi Mudad WPS file"
          >
            <Download size={14} />
            <span>{isArabic ? 'تصدير ملف مدد' : 'Export WPS'}</span>
          </button>
        </div>

        {/* Riyadh KSA Time */}
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 text-xs font-medium">
          <Clock size={13} className="text-slate-400" />
          <span>KSA 09:42 AM</span>
        </div>

        {/* Language Switcher */}
        <button
          onClick={onToggleLanguage}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors"
          title="Switch Language / تبديل اللغة"
        >
          <Languages size={15} />
          <span>{isArabic ? 'English' : 'العربية'}</span>
        </button>

        {/* Theme Switcher */}
        <button
          onClick={onToggleTheme}
          className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors"
          title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {isDark ? <Sun size={16} className="text-amber-400" /> : <Moon size={16} className="text-slate-600" />}
        </button>
      </div>
    </header>
  );
};
