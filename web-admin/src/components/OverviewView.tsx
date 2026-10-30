import React from 'react';
import {
  Users,
  Radio,
  CalendarCheck,
  Building2,
  TrendingUp,
  ShieldCheck,
  AlertTriangle,
  ArrowUpRight,
  MapPin,
  CheckCircle2,
  Download,
} from 'lucide-react';
import { AdminBranch, AdminEmployee, AdminLeaveItem, LivePunchLog } from '../data/mockAdminData';
import { PayrollSummary } from '../api/client';
import { AdminTab } from './Sidebar';

interface OverviewViewProps {
  onNavigate: (tab: AdminTab) => void;
  onSelectPunch: (punch: LivePunchLog) => void;
  onExportWps: () => void;
  isArabic: boolean;
  employees: AdminEmployee[];
  branches: AdminBranch[];
  leaves: AdminLeaveItem[];
  attendance: LivePunchLog[];
  payroll: PayrollSummary;
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  onNavigate,
  onSelectPunch,
  onExportWps,
  isArabic,
  employees,
  branches,
  leaves,
  attendance,
  payroll,
}) => {
  const checkedIn = new Set(
    attendance.filter((entry) => entry.type === 'CHECK_IN').map((entry) => entry.employeeId),
  ).size;
  const onSiteRate = employees.length ? Math.round((checkedIn / employees.length) * 100) : 0;
  const pendingLeaves = leaves.filter((request) => request.status === 'PENDING').length;
  const approvedLeaves = leaves.filter((request) => request.status === 'APPROVED').length;

  return (
    <div className="space-y-6">
      {/* Executive Key Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <div className="p-5 rounded-2xl bg-white dark:bg-macq-cardDark border border-slate-200 dark:border-macq-borderDark/60 shadow-sm relative overflow-hidden group hover:border-macq-orange/40 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {isArabic ? 'إجمالي الموظفين' : 'Total Employees'}
            </span>
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Users size={18} />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 dark:text-white">
              {employees.length}
            </span>
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center">
              <TrendingUp size={12} className="mr-0.5" /> +4 {isArabic ? 'هذا الشهر' : 'this mo'}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              {isArabic ? `${branches.length} فروع نشطة` : `${branches.length} active office branches`}
          </p>
        </div>

        {/* Metric 2 */}
        <div className="p-5 rounded-2xl bg-white dark:bg-macq-cardDark border border-slate-200 dark:border-macq-borderDark/60 shadow-sm relative overflow-hidden group hover:border-macq-orange/40 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {isArabic ? 'نسبة الحضور الميداني' : 'On-Site Rate Today'}
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Radio size={18} />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 dark:text-white">
              {onSiteRate}%
            </span>
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              {checkedIn} / {employees.length} {isArabic ? 'حضور' : 'checked-in'}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            {isArabic ? '100% تطابق النطاق الجغرافي' : '150m Office geofence enforced'}
          </p>
        </div>

        {/* Metric 3 */}
        <div className="p-5 rounded-2xl bg-white dark:bg-macq-cardDark border border-slate-200 dark:border-macq-borderDark/60 shadow-sm relative overflow-hidden group hover:border-macq-orange/40 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {isArabic ? 'من في إجازة اليوم' : "Who's Off Today"}
            </span>
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <CalendarCheck size={18} />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 dark:text-white">
              {approvedLeaves}
            </span>
            <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
              {isArabic ? `${pendingLeaves} طلب معلق` : `${pendingLeaves} pending review`}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            {isArabic ? 'إجازات سنوية ومرضية معتمدة' : '3 Annual Vacations, 1 Sick Leave'}
          </p>
        </div>

        {/* Metric 4 */}
        <div className="p-5 rounded-2xl bg-white dark:bg-macq-cardDark border border-slate-200 dark:border-macq-borderDark/60 shadow-sm relative overflow-hidden group hover:border-macq-orange/40 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {isArabic ? 'مسير الرواتب الشهري' : 'Monthly Payroll (SAR)'}
            </span>
            <div className="w-9 h-9 rounded-xl bg-macq-orange/10 text-macq-orange flex items-center justify-center">
              <TrendingUp size={18} />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 dark:text-white">
              {payroll.totals.totalNetDisbursedSar.toLocaleString()}
            </span>
            <span className="text-xs font-semibold text-slate-500">SAR</span>
          </div>
          <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1">
            {isArabic ? 'متوافق مع منصة مدد (حماية الأجور)' : '100% Saudi Mudad WPS Compliant'}
          </p>
        </div>
      </div>

      {/* Main Grid: Live Radar Table & Branch Geofences */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Live Attendance Radar (2 cols) */}
        <div className="lg:col-span-2 p-6 rounded-2xl bg-white dark:bg-macq-cardDark border border-slate-200 dark:border-macq-borderDark/60 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
              <h2 className="font-extrabold text-base text-slate-900 dark:text-white">
                {isArabic ? 'رادار البصمات والتحقق الأمني المباشر' : 'Live Attendance & Anti-Spoofing Radar'}
              </h2>
            </div>
            <button
              onClick={() => onNavigate('attendance')}
              className="text-xs font-bold text-macq-orange hover:underline flex items-center gap-1"
            >
              <span>{isArabic ? 'عرض كل السجلات' : 'View Full Stream'}</span>
              <ArrowUpRight size={14} />
            </button>
          </div>

          {/* Structured Table according to modern-web-guidance */}
          <div className="overflow-x-auto">
            <table className="w-full text-left rtl:text-right text-xs border-collapse min-w-[620px]">
              <thead>
                <tr className="border-b border-slate-200 dark:border-zinc-800 text-slate-500 dark:text-zinc-400 font-bold uppercase tracking-wider bg-slate-50/70 dark:bg-zinc-950/40">
                  <th className="py-3 px-3">{isArabic ? 'الموظف' : 'Employee'}</th>
                  <th className="py-3 px-3">{isArabic ? 'الفرع' : 'Branch'}</th>
                  <th className="py-3 px-3">{isArabic ? 'الوقت والنوع' : 'Time / Type'}</th>
                  <th className="py-3 px-3">{isArabic ? 'المسافة والدقة' : 'Distance & GPS'}</th>
                  <th className="py-3 px-3">{isArabic ? 'الحالة الأمنية' : 'Security Status'}</th>
                  <th className="py-3 px-3 text-right rtl:text-left">{isArabic ? 'التفاصيل' : 'Action'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60 text-slate-800 dark:text-zinc-300">
                {attendance.slice(0, 5).map((log) => {
                  const isVerified = log.status === 'VERIFIED';
                  return (
                    <tr
                      key={log.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-zinc-800/40 transition-colors"
                    >
                      <td className="py-3 px-3">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900 dark:text-white">
                            {log.employeeName}
                          </span>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400">
                            {log.employeeId} • {log.jobTitle}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-slate-600 dark:text-slate-300">
                        {log.branchName}
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {log.timestamp}
                        </span>
                        <span className="block text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                          {log.type === 'CHECK_IN' ? 'PUNCH IN' : 'PUNCH OUT'}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {log.distanceMeters}m from HQ
                        </span>
                        <span className="block text-[10px] text-slate-500">
                          Acc ±{log.accuracyMeters}m
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        {isVerified ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            <ShieldCheck size={12} />
                            6-LAYER PASSED
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                            <AlertTriangle size={12} />
                            FLAGGED ({log.securityFlags.length})
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right rtl:text-left">
                        <button
                          onClick={() => onSelectPunch(log)}
                          className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors"
                        >
                          Inspect
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Office Branches & Geofences Status (1 col) */}
        <div className="p-6 rounded-2xl bg-white dark:bg-macq-cardDark border border-slate-200 dark:border-macq-borderDark/60 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Building2 size={18} className="text-macq-navy dark:text-slate-300" />
                <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                  {isArabic ? 'الفروع والنطاق الجغرافي' : 'Corporate Branches'}
                </h3>
              </div>
              <button
                onClick={() => onNavigate('branches')}
                className="text-xs font-bold text-macq-orange hover:underline flex items-center gap-1"
              >
                <span>{isArabic ? 'إدارة' : 'Manage'}</span>
                <ArrowUpRight size={14} />
              </button>
            </div>

            <div className="space-y-3">
              {branches.map((b) => (
                <div
                  key={b.id}
                  className="p-3.5 rounded-xl bg-slate-50 dark:bg-macq-surfaceDark/60 border border-slate-200/60 dark:border-slate-800"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-xs text-slate-900 dark:text-white truncate">
                      {isArabic ? b.nameAr : b.name}
                    </span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-macq-navy/10 text-macq-navy dark:bg-white/10 dark:text-white">
                      {b.code}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
                    <span className="flex items-center gap-1">
                      <MapPin size={11} className="text-macq-orange" />
                      {b.geofenceRadiusMeters}m radius
                    </span>
                    <span>•</span>
                    <span>{b.activeEmployeesCount} staff</span>
                    <span>•</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                      {b.todayPunchesCount} on-site
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Mudad WPS Card */}
          <div className="mt-5 p-4 rounded-xl bg-gradient-to-br from-macq-navy to-macq-dark text-white border border-white/10">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-macq-orange">
                Mudad WPS System
              </span>
              <CheckCircle2 size={16} className="text-emerald-400" />
            </div>
            <p className="text-xs text-slate-300 mb-3">
              Generate and download the Wage Protection CSV for the Ministry of Human Resources.
            </p>
            <button
              onClick={onExportWps}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-macq-orange text-white font-bold text-xs hover:bg-macq-orange/90 transition-all shadow-md shadow-macq-orange/20"
            >
              <Download size={14} />
              <span>Download Mudad CSV File</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
