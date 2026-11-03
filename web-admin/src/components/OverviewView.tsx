import React, { useMemo, useState } from 'react';
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
  BarChart3,
  PieChart as PieChartIcon,
  Layers,
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
  const [hoveredDayIdx, setHoveredDayIdx] = useState<number | null>(null);

  const checkedIn = new Set(
    attendance.filter((entry) => entry.type === 'CHECK_IN').map((entry) => entry.employeeId),
  ).size;
  const onSiteRate = employees.length ? Math.round((checkedIn / employees.length) * 100) : 0;
  const pendingLeaves = leaves.filter((request) => request.status === 'PENDING').length;

  const activeEmployeeIds = new Set(employees.map((employee) => employee.employeeId));
  const approvedLeaves = leaves.filter(
    (request) =>
      request.status === 'APPROVED' && activeEmployeeIds.has(request.employeeId),
  ).length;

  const verifiedPunchesCount = attendance.filter((a) => a.status === 'VERIFIED').length;
  const flaggedPunchesCount = attendance.length - verifiedPunchesCount;

  // Workforce composition metrics
  const saudiCount = employees.filter((e) => e.isSaudi).length;
  const expatCount = Math.max(0, employees.length - saudiCount);
  const saudizationRate = employees.length
    ? Math.round((saudiCount / employees.length) * 100)
    : 0;
  const remoteEligibleCount = employees.filter((e) => e.isRemoteAllowed).length;
  const officeAssignedCount = Math.max(0, employees.length - remoteEligibleCount);

  // 7-day Saudi workweek attendance trend (anchored to live headcount & today's punches)
  const weeklyTrend = useMemo(() => {
    const total = Math.max(employees.length, 5);
    const todayVerified = Math.max(checkedIn, Math.round(total * 0.78));
    const todayRemote = Math.min(remoteEligibleCount, total);
    const todayFlagged = flaggedPunchesCount;

    const days = [
      { en: 'Sun', ar: 'الأحد', verified: Math.round(total * 0.88), remote: Math.max(1, remoteEligibleCount), flagged: 0 },
      { en: 'Mon', ar: 'الإثنين', verified: Math.round(total * 0.92), remote: Math.max(1, remoteEligibleCount), flagged: 1 },
      { en: 'Tue', ar: 'الثلاثاء', verified: Math.round(total * 0.86), remote: Math.max(1, remoteEligibleCount), flagged: 0 },
      { en: 'Wed', ar: 'الأربعاء', verified: Math.round(total * 0.9), remote: Math.max(1, remoteEligibleCount), flagged: 1 },
      { en: 'Thu', ar: 'الخميس', verified: Math.round(total * 0.84), remote: Math.max(1, remoteEligibleCount), flagged: 0 },
      { en: 'Fri', ar: 'الجمعة', verified: Math.round(total * 0.15), remote: Math.min(1, remoteEligibleCount), flagged: 0 },
      { en: 'Today', ar: 'اليوم', verified: todayVerified, remote: todayRemote, flagged: todayFlagged },
    ];
    return days;
  }, [employees.length, checkedIn, remoteEligibleCount, flaggedPunchesCount]);

  // SVG coordinates for the 7-day area chart (width 640, height 210)
  const chartGeom = useMemo(() => {
    const width = 640;
    const height = 190;
    const padX = 34;
    const padTop = 18;
    const padBottom = 28;
    const plotW = width - padX * 2;
    const plotH = height - padTop - padBottom;
    const maxVal = Math.max(
      employees.length + 2,
      ...weeklyTrend.map((d) => d.verified + d.remote),
      6,
    );

    const points = weeklyTrend.map((d, i) => {
      const x = padX + (i / (weeklyTrend.length - 1)) * plotW;
      const yVerified = padTop + plotH - (d.verified / maxVal) * plotH;
      const yRemote = padTop + plotH - (d.remote / maxVal) * plotH;
      return { x, yVerified, yRemote, data: d };
    });

    const buildSmoothPath = (coords: Array<{ x: number; y: number }>) => {
      if (coords.length === 0) return '';
      return coords.reduce((acc, pt, i, arr) => {
        if (i === 0) return `M ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`;
        const prev = arr[i - 1];
        const cx1 = prev.x + (pt.x - prev.x) * 0.45;
        const cy1 = prev.y;
        const cx2 = prev.x + (pt.x - prev.x) * 0.55;
        const cy2 = pt.y;
        return `${acc} C ${cx1.toFixed(1)} ${cy1.toFixed(1)}, ${cx2.toFixed(1)} ${cy2.toFixed(1)}, ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`;
      }, '');
    };

    const verifiedLine = buildSmoothPath(
      points.map((p) => ({ x: p.x, y: p.yVerified })),
    );
    const remoteLine = buildSmoothPath(
      points.map((p) => ({ x: p.x, y: p.yRemote })),
    );
    const baselineY = padTop + plotH;
    const verifiedArea = `${verifiedLine} L ${points[points.length - 1].x.toFixed(1)} ${baselineY} L ${points[0].x.toFixed(1)} ${baselineY} Z`;
    const remoteArea = `${remoteLine} L ${points[points.length - 1].x.toFixed(1)} ${baselineY} L ${points[0].x.toFixed(1)} ${baselineY} Z`;

    return {
      width,
      height,
      padX,
      padTop,
      baselineY,
      plotH,
      maxVal,
      points,
      verifiedLine,
      verifiedArea,
      remoteLine,
      remoteArea,
    };
  }, [weeklyTrend, employees.length]);

  // Department payroll & headcount breakdown for horizontal bar chart
  const departmentBreakdown = useMemo(() => {
    const map = new Map<
      string,
      {
        department: string;
        count: number;
        basicSar: number;
        allowancesSar: number;
        netSar: number;
      }
    >();

    for (const emp of employees) {
      const dept = emp.department || 'General';
      const current = map.get(dept) ?? {
        department: dept,
        count: 0,
        basicSar: 0,
        allowancesSar: 0,
        netSar: 0,
      };
      current.count += 1;
      current.basicSar += emp.basicSalarySar;
      current.allowancesSar += emp.housingAllowanceSar + emp.transportAllowanceSar;
      current.netSar += emp.netSalarySar;
      map.set(dept, current);
    }

    const list = Array.from(map.values()).sort((a, b) => b.netSar - a.netSar);
    const maxDeptSar = Math.max(...list.map((d) => d.basicSar + d.allowancesSar), 1);
    return { list: list.slice(0, 5), maxDeptSar };
  }, [employees]);

  // SVG Donut geometry (radius = 58, circumference = 2 * PI * 58 = 364.4)
  const donutRadius = 58;
  const donutCircumference = 2 * Math.PI * donutRadius;
  const officeArc = employees.length
    ? (officeAssignedCount / employees.length) * donutCircumference
    : donutCircumference * 0.7;
  const remoteArc = Math.max(0, donutCircumference - officeArc);

  return (
    <div className="space-y-6">
      {/* Row 1: Executive KPI Cards with Sparklines & Progress Indicators */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* KPI 1: Total Workforce */}
        <button
          type="button"
          onClick={() => onNavigate('employees')}
          className="text-left rtl:text-right p-5 rounded-2xl bg-white dark:bg-macq-cardDark border border-slate-200 dark:border-macq-borderDark/60 shadow-sm relative overflow-hidden group hover:border-macq-orange/50 transition-all"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {isArabic ? 'إجمالي القوى العاملة' : 'Total Workforce'}
            </span>
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Users size={18} />
            </div>
          </div>
          <div className="flex items-end justify-between gap-2">
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-slate-900 dark:text-white">
                  {employees.length}
                </span>
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 inline-flex items-center">
                  <TrendingUp size={12} className="mr-0.5" />
                  {saudizationRate}% {isArabic ? 'سعودة' : 'Saudi'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                {isArabic
                  ? `${saudiCount} سعودي · ${expatCount} مقيم`
                  : `${saudiCount} Saudi · ${expatCount} Expat`}
              </p>
            </div>
            {/* Mini Sparkline */}
            <svg width="72" height="32" viewBox="0 0 72 32" className="overflow-visible">
              <path
                d="M2 26 L16 22 L30 24 L44 15 L58 12 L70 6"
                fill="none"
                stroke="#3B82F6"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
              <circle cx="70" cy="6" r="3" fill="#3B82F6" />
            </svg>
          </div>
        </button>

        {/* KPI 2: On-Site Attendance Rate with Radial Gauge */}
        <button
          type="button"
          onClick={() => onNavigate('attendance')}
          className="text-left rtl:text-right p-5 rounded-2xl bg-white dark:bg-macq-cardDark border border-slate-200 dark:border-macq-borderDark/60 shadow-sm relative overflow-hidden group hover:border-macq-orange/50 transition-all"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {isArabic ? 'نسبة الحضور اليوم' : 'Attendance Rate Today'}
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Radio size={18} />
            </div>
          </div>
          <div className="flex items-end justify-between gap-2">
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-slate-900 dark:text-white">
                  {onSiteRate}%
                </span>
                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  {checkedIn}/{employees.length} {isArabic ? 'حاضر' : 'present'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                {isArabic
                  ? `${verifiedPunchesCount} بصمة موثقة · ${flaggedPunchesCount} تنبيه`
                  : `${verifiedPunchesCount} verified · ${flaggedPunchesCount} flagged`}
              </p>
            </div>
            {/* Mini Radial Ring */}
            <svg width="42" height="42" viewBox="0 0 42 42" className="-rotate-90 flex-shrink-0">
              <circle
                cx="21"
                cy="21"
                r="16"
                fill="none"
                stroke="currentColor"
                strokeWidth="4"
                className="text-slate-100 dark:text-slate-800"
              />
              <circle
                cx="21"
                cy="21"
                r="16"
                fill="none"
                stroke="#10B981"
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 16}
                strokeDashoffset={
                  2 * Math.PI * 16 * (1 - Math.min(100, Math.max(8, onSiteRate)) / 100)
                }
              />
            </svg>
          </div>
        </button>

        {/* KPI 3: Who's Off & Leave Pipeline */}
        <button
          type="button"
          onClick={() => onNavigate('leaves')}
          className="text-left rtl:text-right p-5 rounded-2xl bg-white dark:bg-macq-cardDark border border-slate-200 dark:border-macq-borderDark/60 shadow-sm relative overflow-hidden group hover:border-macq-orange/50 transition-all"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {isArabic ? 'الإجازات والطلبات' : "Who's Off & Leaves"}
            </span>
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <CalendarCheck size={18} />
            </div>
          </div>
          <div className="flex items-end justify-between gap-2">
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-slate-900 dark:text-white">
                  {approvedLeaves}
                </span>
                <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                  {isArabic ? `${pendingLeaves} بانتظار الاعتماد` : `${pendingLeaves} pending`}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                {isArabic
                  ? `${remoteEligibleCount} موظف عمل عن بُعد`
                  : `${remoteEligibleCount} remote-enabled staff`}
              </p>
            </div>
            {/* Mini Bar Spark */}
            <div className="flex items-end gap-1 h-8">
              {[40, 75, 55, 90, 65].map((h, idx) => (
                <span
                  key={idx}
                  style={{ height: `${h}%` }}
                  className={`w-2 rounded-t ${
                    idx === 3 ? 'bg-amber-500' : 'bg-amber-500/30 dark:bg-amber-500/25'
                  }`}
                />
              ))}
            </div>
          </div>
        </button>

        {/* KPI 4: Monthly Net Payroll */}
        <button
          type="button"
          onClick={() => onNavigate('payroll')}
          className="text-left rtl:text-right p-5 rounded-2xl bg-white dark:bg-macq-cardDark border border-slate-200 dark:border-macq-borderDark/60 shadow-sm relative overflow-hidden group hover:border-macq-orange/50 transition-all"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {isArabic ? 'صافي مسير الرواتب' : 'Monthly Net Payroll'}
            </span>
            <div className="w-9 h-9 rounded-xl bg-macq-orange/10 text-macq-orange flex items-center justify-center">
              <TrendingUp size={18} />
            </div>
          </div>
          <div className="flex items-end justify-between gap-2">
            <div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-slate-900 dark:text-white">
                  {payroll.totals.totalNetDisbursedSar.toLocaleString()}
                </span>
                <span className="text-xs font-bold text-slate-500">SAR</span>
              </div>
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1">
                {isArabic
                  ? `التأمينات (GOSI): ${Math.round(payroll.totals.totalGosiEmployeeSar + payroll.totals.totalGosiEmployerSar).toLocaleString()} ر.س`
                  : `GOSI Combined: ${Math.round(payroll.totals.totalGosiEmployeeSar + payroll.totals.totalGosiEmployerSar).toLocaleString()} SAR`}
              </p>
            </div>
            <svg width="68" height="32" viewBox="0 0 68 32" className="overflow-visible">
              <path
                d="M2 24 L18 20 L34 18 L50 10 L66 7"
                fill="none"
                stroke="#F26B3A"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
              <circle cx="66" cy="7" r="3" fill="#F26B3A" />
            </svg>
          </div>
        </button>
      </div>

      {/* Row 2: Executive Charts — 7-Day Attendance Area Graph & Workforce Composition Donut */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* 7-Day Attendance & Anti-Spoofing Trend Graph (8 cols) */}
        <div className="lg:col-span-8 p-5 sm:p-6 rounded-2xl bg-white dark:bg-macq-cardDark border border-slate-200 dark:border-macq-borderDark/60 shadow-sm flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <div className="flex items-center gap-2">
                <BarChart3 size={18} className="text-macq-orange" />
                <h2 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">
                  {isArabic
                    ? 'منحنى الحضور والتحقق الجغرافي الأسبوعي'
                    : 'Weekly Attendance & Geofence Verification Trend'}
                </h2>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {isArabic
                  ? 'مقارنة الحضور الميداني الموثق مع العمل عن بُعد والتنبيهات الأمنية'
                  : 'On-site verified check-ins vs. remote hub activity across the Saudi workweek'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-[11px] font-bold">
              <span className="inline-flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                <span className="w-2.5 h-2.5 rounded-full bg-teal-500" />
                {isArabic ? 'حضور ميداني موثق' : 'Verified On-Site'}
              </span>
              <span className="inline-flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                <span className="w-2.5 h-2.5 rounded-full bg-macq-orange" />
                {isArabic ? 'عمل عن بُعد' : 'Remote Hub'}
              </span>
            </div>
          </div>

          {/* Interactive SVG Area Line Chart */}
          <div className="w-full overflow-x-auto">
            <svg
              viewBox={`0 0 ${chartGeom.width} ${chartGeom.height}`}
              className="w-full h-52 min-w-[460px] select-none"
              role="img"
              aria-label="Weekly attendance area graph"
            >
              <defs>
                <linearGradient id="verifiedGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#14B8A6" stopOpacity="0.32" />
                  <stop offset="100%" stopColor="#14B8A6" stopOpacity="0.0" />
                </linearGradient>
                <linearGradient id="remoteGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#F26B3A" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#F26B3A" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Horizontal Grid Lines */}
              {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
                const y = chartGeom.padTop + ratio * chartGeom.plotH;
                const val = Math.round(chartGeom.maxVal * (1 - ratio));
                return (
                  <g key={idx}>
                    <line
                      x1={chartGeom.padX}
                      y1={y}
                      x2={chartGeom.width - chartGeom.padX}
                      y2={y}
                      stroke="currentColor"
                      strokeDasharray="4 4"
                      className="text-slate-200 dark:text-slate-800"
                    />
                    <text
                      x={chartGeom.padX - 8}
                      y={y + 3}
                      textAnchor="end"
                      className="fill-slate-400 text-[10px] font-mono"
                    >
                      {val}
                    </text>
                  </g>
                );
              })}

              {/* Gradient Areas & Smooth Curves */}
              <path d={chartGeom.verifiedArea} fill="url(#verifiedGrad)" />
              <path d={chartGeom.remoteArea} fill="url(#remoteGrad)" />

              <path
                d={chartGeom.verifiedLine}
                fill="none"
                stroke="#14B8A6"
                strokeWidth="3"
                strokeLinecap="round"
              />
              <path
                d={chartGeom.remoteLine}
                fill="none"
                stroke="#F26B3A"
                strokeWidth="2.5"
                strokeDasharray="5 4"
                strokeLinecap="round"
              />

              {/* Data Nodes & Interactive Hover Columns */}
              {chartGeom.points.map((pt, idx) => {
                const isHovered = hoveredDayIdx === idx;
                return (
                  <g
                    key={pt.data.en}
                    onMouseEnter={() => setHoveredDayIdx(idx)}
                    onMouseLeave={() => setHoveredDayIdx(null)}
                    className="cursor-pointer"
                  >
                    {isHovered && (
                      <line
                        x1={pt.x}
                        y1={chartGeom.padTop}
                        x2={pt.x}
                        y2={chartGeom.baselineY}
                        stroke="#F26B3A"
                        strokeWidth="1"
                        strokeDasharray="2 2"
                      />
                    )}
                    <circle
                      cx={pt.x}
                      cy={pt.yVerified}
                      r={isHovered ? 6 : 4}
                      fill="#14B8A6"
                      stroke="#ffffff"
                      strokeWidth="2"
                    />
                    <circle
                      cx={pt.x}
                      cy={pt.yRemote}
                      r={isHovered ? 5 : 3.5}
                      fill="#F26B3A"
                      stroke="#ffffff"
                      strokeWidth="1.5"
                    />
                    {/* Day Label */}
                    <text
                      x={pt.x}
                      y={chartGeom.height - 6}
                      textAnchor="middle"
                      className={`text-[10px] font-bold ${
                        idx === chartGeom.points.length - 1
                          ? 'fill-macq-orange'
                          : 'fill-slate-500 dark:fill-slate-400'
                      }`}
                    >
                      {isArabic ? pt.data.ar : pt.data.en}
                    </text>

                    {/* Value Badge on Hover or Today */}
                    {(isHovered || idx === chartGeom.points.length - 1) && (
                      <g transform={`translate(${pt.x}, ${Math.max(14, pt.yVerified - 12)})`}>
                        <rect
                          x="-24"
                          y="-14"
                          width="48"
                          height="16"
                          rx="5"
                          className="fill-slate-900 dark:fill-white"
                        />
                        <text
                          x="0"
                          y="-3"
                          textAnchor="middle"
                          className="fill-white dark:fill-slate-900 text-[9px] font-extrabold"
                        >
                          {pt.data.verified} / {pt.data.remote}R
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Bottom Summary Bar */}
          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-3 gap-3 text-center">
            <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50">
              <p className="text-[10px] font-bold text-slate-400 uppercase">
                {isArabic ? 'بصمات موثقة (6 طبقات)' : '6-Layer Verified'}
              </p>
              <p className="text-sm font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                {verifiedPunchesCount}
              </p>
            </div>
            <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50">
              <p className="text-[10px] font-bold text-slate-400 uppercase">
                {isArabic ? 'المتواجدون عن بُعد' : 'Remote Hub Eligible'}
              </p>
              <p className="text-sm font-black text-macq-orange mt-0.5">
                {remoteEligibleCount}
              </p>
            </div>
            <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50">
              <p className="text-[10px] font-bold text-slate-400 uppercase">
                {isArabic ? 'حالات التزييف المحجوبة' : 'Spoofing Flags'}
              </p>
              <p className="text-sm font-black text-amber-600 dark:text-amber-400 mt-0.5">
                {flaggedPunchesCount}
              </p>
            </div>
          </div>
        </div>

        {/* Workforce Distribution & Work-Mode Donut Chart (4 cols) */}
        <div className="lg:col-span-4 p-5 sm:p-6 rounded-2xl bg-white dark:bg-macq-cardDark border border-slate-200 dark:border-macq-borderDark/60 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <PieChartIcon size={18} className="text-macq-navy dark:text-macq-orange" />
              <h2 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">
                {isArabic ? 'توزيع القوى العاملة ونمط العمل' : 'Workforce & Mode Split'}
              </h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {isArabic
                ? 'توزيع المقر الرئيسي والعمل عن بُعد ونسبة السعودة'
                : 'HQ Office vs. Remote Hub & Nitaqat Saudization'}
            </p>
          </div>

          {/* SVG Donut Chart */}
          <div className="my-4 flex items-center justify-center relative">
            <svg width="160" height="160" viewBox="0 0 160 160" className="-rotate-90">
              <circle
                cx="80"
                cy="80"
                r={donutRadius}
                fill="none"
                stroke="currentColor"
                strokeWidth="16"
                className="text-slate-100 dark:text-slate-800"
              />
              {/* Office Segment */}
              <circle
                cx="80"
                cy="80"
                r={donutRadius}
                fill="none"
                stroke="#002C52"
                strokeWidth="16"
                strokeDasharray={`${officeArc} ${donutCircumference}`}
                strokeDashoffset="0"
              />
              {/* Remote Segment */}
              <circle
                cx="80"
                cy="80"
                r={donutRadius}
                fill="none"
                stroke="#F26B3A"
                strokeWidth="16"
                strokeDasharray={`${remoteArc} ${donutCircumference}`}
                strokeDashoffset={-officeArc}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
              <span className="text-2xl font-black text-slate-900 dark:text-white">
                {employees.length}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {isArabic ? 'موظف نشط' : 'Active Staff'}
              </span>
            </div>
          </div>

          {/* Breakdown Legend */}
          <div className="space-y-2.5 text-xs">
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60">
              <span className="inline-flex items-center gap-2 font-bold text-slate-700 dark:text-slate-200">
                <span className="w-2.5 h-2.5 rounded-full bg-macq-navy" />
                {isArabic ? 'مقر الشركة (حضوري)' : 'Office HQ Staff'}
              </span>
              <span className="font-extrabold text-slate-900 dark:text-white">
                {officeAssignedCount} (
                {employees.length
                  ? Math.round((officeAssignedCount / employees.length) * 100)
                  : 0}
                %)
              </span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60">
              <span className="inline-flex items-center gap-2 font-bold text-slate-700 dark:text-slate-200">
                <span className="w-2.5 h-2.5 rounded-full bg-macq-orange" />
                {isArabic ? 'العمل عن بُعد (باكستان/دولي)' : 'Remote Hub Eligible'}
              </span>
              <span className="font-extrabold text-macq-orange">
                {remoteEligibleCount} (
                {employees.length
                  ? Math.round((remoteEligibleCount / employees.length) * 100)
                  : 0}
                %)
              </span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <span className="inline-flex items-center gap-2 font-bold text-emerald-700 dark:text-emerald-300">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                {isArabic ? 'نسبة التوطين (نطاقات)' : 'Saudization (Nitaqat)'}
              </span>
              <span className="font-extrabold text-emerald-700 dark:text-emerald-300">
                {saudizationRate}% ({saudiCount}/{employees.length})
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Row 3: Department Payroll Distribution Graph + Corporate Branches & Mudad Hub */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Department Payroll & Headcount Stacked Bar Chart (7 cols) */}
        <div className="lg:col-span-7 p-5 sm:p-6 rounded-2xl bg-white dark:bg-macq-cardDark border border-slate-200 dark:border-macq-borderDark/60 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 mb-1">
              <div className="flex items-center gap-2">
                <Layers size={18} className="text-macq-orange" />
                <h2 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">
                  {isArabic
                    ? 'توزيع الرواتب والبدلات حسب الإدارة (ر.س)'
                    : 'Payroll & Allowances by Department (SAR)'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('payroll')}
                className="text-xs font-bold text-macq-orange hover:underline flex items-center gap-1"
              >
                <span>{isArabic ? 'مسير الرواتب' : 'Payroll Hub'}</span>
                <ArrowUpRight size={14} />
              </button>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              {isArabic
                ? 'مقارنة الراتب الأساسي والبدلات السكنية والنقل لكل قسم'
                : 'Stacked breakdown of Basic Salary vs. Housing & Transport Allowances'}
            </p>

            <div className="space-y-3.5">
              {departmentBreakdown.list.map((dept) => {
                const basicPct = Math.round(
                  (dept.basicSar / departmentBreakdown.maxDeptSar) * 100,
                );
                const allowPct = Math.round(
                  (dept.allowancesSar / departmentBreakdown.maxDeptSar) * 100,
                );
                return (
                  <div key={dept.department} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-800 dark:text-slate-100">
                        {dept.department}{' '}
                        <span className="text-[11px] font-semibold text-slate-400">
                          ({dept.count} {isArabic ? 'موظف' : 'staff'})
                        </span>
                      </span>
                      <span className="font-mono font-bold text-slate-900 dark:text-white">
                        {dept.netSar.toLocaleString()} SAR
                      </span>
                    </div>
                    <div className="w-full h-3 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden flex">
                      <div
                        style={{ width: `${Math.max(6, basicPct)}%` }}
                        className="h-full bg-macq-navy dark:bg-blue-500 transition-all"
                        title={`Basic: ${dept.basicSar.toLocaleString()} SAR`}
                      />
                      <div
                        style={{ width: `${Math.max(4, allowPct)}%` }}
                        className="h-full bg-macq-orange transition-all"
                        title={`Allowances: ${dept.allowancesSar.toLocaleString()} SAR`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-4 font-semibold">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-macq-navy dark:bg-blue-500" />
                {isArabic ? 'الراتب الأساسي' : 'Basic Salary'}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-macq-orange" />
                {isArabic ? 'بدل السكن والنقل' : 'Housing & Transport'}
              </span>
            </div>
            <span className="font-bold text-slate-700 dark:text-slate-200">
              {isArabic ? 'إجمالي الإيداع الصافي:' : 'Total Net Disbursed:'}{' '}
              {payroll.totals.totalNetDisbursedSar.toLocaleString()} SAR
            </span>
          </div>
        </div>

        {/* Corporate Branches & Mudad WPS Export Card (5 cols) */}
        <div className="lg:col-span-5 p-5 sm:p-6 rounded-2xl bg-white dark:bg-macq-cardDark border border-slate-200 dark:border-macq-borderDark/60 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Building2 size={18} className="text-macq-navy dark:text-slate-300" />
                <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">
                  {isArabic ? 'إشغال الفروع والنطاق الجغرافي' : 'Branch Geofence Utilization'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('branches')}
                className="text-xs font-bold text-macq-orange hover:underline flex items-center gap-1"
              >
                <span>{isArabic ? 'إدارة' : 'Manage'}</span>
                <ArrowUpRight size={14} />
              </button>
            </div>

            <div className="space-y-3">
              {branches.map((b) => {
                const occPct = b.activeEmployeesCount
                  ? Math.min(100, Math.round((b.todayPunchesCount / b.activeEmployeesCount) * 100))
                  : 0;
                return (
                  <div
                    key={b.id}
                    className="p-3.5 rounded-xl bg-slate-50 dark:bg-macq-surfaceDark/60 border border-slate-200/60 dark:border-slate-800 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-900 dark:text-white truncate">
                        {isArabic ? b.nameAr : b.name}
                      </span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-macq-navy/10 text-macq-navy dark:bg-white/10 dark:text-white">
                        {b.code}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                      <span className="flex items-center gap-1">
                        <MapPin size={11} className="text-macq-orange" />
                        {b.geofenceRadiusMeters}m {isArabic ? 'نطاق' : 'radius'}
                      </span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                        {b.todayPunchesCount}/{b.activeEmployeesCount}{' '}
                        {isArabic ? 'متواجد' : 'on-site'} ({occPct}%)
                      </span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                      <div
                        style={{ width: `${Math.max(8, occPct)}%` }}
                        className="h-full bg-emerald-500 rounded-full transition-all"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Mudad WPS Export Banner */}
          <div className="mt-5 p-4 rounded-xl bg-gradient-to-br from-macq-navy to-macq-dark text-white border border-white/10">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-macq-orange">
                {isArabic ? 'نظام حماية الأجور (مدد)' : 'Saudi Mudad WPS Export'}
              </span>
              <CheckCircle2 size={16} className="text-emerald-400" />
            </div>
            <p className="text-xs text-slate-300 mb-3">
              {isArabic
                ? 'تحميل ملف مسير الرواتب المعتمد لوزارة الموارد البشرية والتنمية الاجتماعية.'
                : 'Download the official Wage Protection CSV for HRSD & Saudi banking submission.'}
            </p>
            <button
              type="button"
              onClick={onExportWps}
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-macq-orange text-white font-bold text-xs hover:bg-macq-orange/90 transition-all shadow-md shadow-macq-orange/20"
            >
              <Download size={14} />
              <span>{isArabic ? 'تحميل ملف مدد CSV' : 'Download Mudad CSV File'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Row 4: Live Attendance & Anti-Spoofing Radar Stream */}
      <div className="p-4 sm:p-6 rounded-2xl bg-white dark:bg-macq-cardDark border border-slate-200 dark:border-macq-borderDark/60 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
            <h2 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">
              {isArabic
                ? 'رادار البصمات والتحقق الأمني المباشر'
                : 'Live Attendance & Anti-Spoofing Stream'}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('attendance')}
            className="text-xs font-bold text-macq-orange hover:underline flex items-center gap-1"
          >
            <span>{isArabic ? 'عرض كل السجلات' : 'View Full Stream'}</span>
            <ArrowUpRight size={14} />
          </button>
        </div>

        {/* Mobile Responsive Card List (< md) */}
        <div className="md:hidden space-y-3">
          {attendance.slice(0, 5).map((log) => {
            const isVerified = log.status === 'VERIFIED';
            return (
              <div
                key={`mobile-${log.id}`}
                className="p-3.5 rounded-xl bg-slate-50 dark:bg-macq-surfaceDark/60 border border-slate-200/70 dark:border-slate-800 space-y-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-bold text-slate-900 dark:text-white">
                      {log.employeeName}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {log.employeeId} • {log.branchName}
                    </p>
                  </div>
                  {isVerified ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      <ShieldCheck size={11} />
                      {isArabic ? 'مُعتمد' : 'PASSED'}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                      <AlertTriangle size={11} />
                      {isArabic ? 'مُبلغ' : 'FLAGGED'}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-300">
                  <span>
                    {log.timestamp} ({log.type === 'CHECK_IN' ? 'IN' : 'OUT'})
                  </span>
                  <button
                    type="button"
                    onClick={() => onSelectPunch(log)}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                  >
                    {isArabic ? 'فحص' : 'Inspect'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Structured HTML Table (md+) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left rtl:text-right text-xs border-collapse min-w-[620px]">
            <thead>
              <tr className="border-b border-slate-200 dark:border-zinc-800 text-slate-500 dark:text-zinc-400 font-bold uppercase tracking-wider bg-slate-50/70 dark:bg-zinc-950/40">
                <th className="py-3 px-3">{isArabic ? 'الموظف' : 'Employee'}</th>
                <th className="py-3 px-3">{isArabic ? 'الفرع' : 'Branch'}</th>
                <th className="py-3 px-3">{isArabic ? 'الوقت والنوع' : 'Time / Type'}</th>
                <th className="py-3 px-3">{isArabic ? 'المسافة والدقة' : 'Distance & GPS'}</th>
                <th className="py-3 px-3">{isArabic ? 'الحالة الأمنية' : 'Security Status'}</th>
                <th className="py-3 px-3 text-right rtl:text-left">
                  {isArabic ? 'التفاصيل' : 'Action'}
                </th>
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
                        {log.type === 'CHECK_IN'
                          ? isArabic
                            ? 'تسجيل حضور'
                            : 'PUNCH IN'
                          : isArabic
                            ? 'تسجيل انصراف'
                            : 'PUNCH OUT'}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {log.distanceMeters}m {isArabic ? 'عن الفرع' : 'from HQ'}
                      </span>
                      <span className="block text-[10px] text-slate-500">
                        {isArabic ? 'دقة' : 'Acc'} ±{log.accuracyMeters}m
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      {isVerified ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          <ShieldCheck size={12} />
                          {isArabic ? '6 طبقات ناجحة' : '6-LAYER PASSED'}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                          <AlertTriangle size={12} />
                          {isArabic ? 'مُبلغ' : 'FLAGGED'} ({log.securityFlags.length})
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right rtl:text-left">
                      <button
                        type="button"
                        onClick={() => onSelectPunch(log)}
                        className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors"
                      >
                        {isArabic ? 'فحص' : 'Inspect'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
