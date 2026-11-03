import React, { useState } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Search,
  Radio,
  MapPin,
  Fingerprint,
  Cpu,
  Clock,
  X,
} from 'lucide-react';
import { LivePunchLog } from '../data/mockAdminData';

interface AttendanceViewProps {
  selectedPunch: LivePunchLog | null;
  onCloseInspection: () => void;
  onSelectPunch: (punch: LivePunchLog) => void;
  isArabic: boolean;
  attendance: LivePunchLog[];
}

export const AttendanceView: React.FC<AttendanceViewProps> = ({
  selectedPunch,
  onCloseInspection,
  onSelectPunch,
  isArabic,
  attendance,
}) => {
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'VERIFIED' | 'FLAGGED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredLogs = attendance.filter((log) => {
    if (statusFilter !== 'ALL' && log.status !== statusFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        log.employeeName.toLowerCase().includes(q) ||
        log.employeeId.toLowerCase().includes(q) ||
        log.branchName.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Filter and Search Bar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-macq-cardDark border border-slate-200 dark:border-macq-borderDark/60 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search
            size={16}
            className="absolute left-3 rtl:right-3 rtl:left-auto top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="text"
            placeholder={
              isArabic ? 'البحث بالاسم أو الرقم الوظيفي...' : 'Search employee, ID, or branch...'
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 rtl:pr-9 rtl:pl-3 pr-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-macq-surfaceDark border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-macq-orange/40"
          />
        </div>

        {/* Status Filter Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {(['ALL', 'VERIFIED', 'FLAGGED'] as const).map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => setStatusFilter(filter)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                statusFilter === filter
                  ? 'bg-macq-navy text-white shadow-sm'
                  : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
              }`}
            >
              {filter === 'ALL'
                ? isArabic
                  ? 'الكل'
                  : 'All Punches'
                : filter === 'VERIFIED'
                  ? isArabic
                    ? 'مُعتمد (6 طبقات)'
                    : 'Verified (6-Layers)'
                  : isArabic
                    ? 'مُشبوه أو مخالف'
                    : 'Flagged Anomalies'}
            </button>
          ))}
        </div>
      </div>

      {/* Attendance Logs Container */}
      <div className="p-4 sm:p-6 rounded-2xl bg-white dark:bg-macq-cardDark border border-slate-200 dark:border-macq-borderDark/60 shadow-sm">
        {/* Mobile Responsive Cards (< md) */}
        <div className="md:hidden space-y-3">
          {filteredLogs.length === 0 ? (
            <p className="py-8 text-center text-xs font-semibold text-slate-400">
              {isArabic ? 'لا توجد بصمات مطابقة.' : 'No attendance records match your filter.'}
            </p>
          ) : (
            filteredLogs.map((log) => {
              const isVerified = log.status === 'VERIFIED';
              return (
                <div
                  key={`mobile-att-${log.id}`}
                  onClick={() => onSelectPunch(log)}
                  className="p-4 rounded-xl bg-slate-50 dark:bg-macq-surfaceDark/60 border border-slate-200/70 dark:border-slate-800 space-y-2.5 cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-bold text-slate-900 dark:text-white">
                        {log.employeeName}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {log.employeeId} • {log.jobTitle}
                      </p>
                    </div>
                    {isVerified ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        <ShieldCheck size={12} />
                        {isArabic ? 'مُعتمد' : 'VERIFIED'}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                        <ShieldAlert size={12} />
                        {isArabic ? 'مُبلغ' : 'FLAGGED'}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 dark:text-slate-300">
                    <div>
                      <span className="text-slate-400 block text-[10px]">
                        {isArabic ? 'الفرع' : 'Branch'}
                      </span>
                      <span className="font-semibold">{log.branchName}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">
                        {isArabic ? 'المسافة والدقة' : 'Distance / Acc'}
                      </span>
                      <span className="font-semibold">
                        {log.distanceMeters}m (±{log.accuracyMeters}m)
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800 flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                      {log.timestamp} •{' '}
                      <strong className="text-macq-orange">{log.type}</strong>
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectPunch(log);
                      }}
                      className="px-3 py-1 rounded-lg text-xs font-bold bg-macq-navy text-white"
                    >
                      {isArabic ? 'فحص' : 'Inspect'}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Desktop Structured Table (md+) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left rtl:text-right text-xs border-collapse min-w-[700px]">
            <thead>
              <tr className="border-b border-slate-200 dark:border-zinc-800 text-slate-500 dark:text-zinc-400 font-bold uppercase tracking-wider bg-slate-50/70 dark:bg-zinc-950/40">
                <th className="py-3.5 px-4">{isArabic ? 'الموظف' : 'Employee'}</th>
                <th className="py-3.5 px-4">{isArabic ? 'الفرع' : 'Branch / Mode'}</th>
                <th className="py-3.5 px-4">{isArabic ? 'نوع البصمة' : 'Punch Type'}</th>
                <th className="py-3.5 px-4">{isArabic ? 'التوقيت' : 'Timestamp'}</th>
                <th className="py-3.5 px-4">{isArabic ? 'المسافة والدقة' : 'Geofence / Accuracy'}</th>
                <th className="py-3.5 px-4">{isArabic ? 'نتيجة التحقق الأمني' : '6-Layer Telemetry'}</th>
                <th className="py-3.5 px-4 text-right rtl:text-left">{isArabic ? 'الفحص' : 'Audit'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60 text-slate-800 dark:text-zinc-300">
              {filteredLogs.map((log) => {
                const isVerified = log.status === 'VERIFIED';
                return (
                  <tr
                    key={log.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-zinc-800/40 transition-colors cursor-pointer"
                    onClick={() => onSelectPunch(log)}
                  >
                    <td className="py-3.5 px-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-900 dark:text-white">
                          {log.employeeName}
                        </span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400">
                          {log.employeeId} • {log.jobTitle}
                        </span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-700 dark:text-slate-300">
                      {log.branchName}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                          log.type === 'CHECK_IN'
                            ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                            : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {log.type}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white">
                      {log.timestamp}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-bold text-slate-900 dark:text-white">
                        {log.distanceMeters}m
                      </span>
                      <span className="text-[10px] text-slate-500 block">
                        {isArabic ? 'الدقة' : 'Accuracy'} ±{log.accuracyMeters}m
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      {isVerified ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          <ShieldCheck size={13} />
                          {isArabic ? 'مُعتمد' : 'VERIFIED'}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                          <ShieldAlert size={13} />
                          {isArabic ? 'مُبلغ' : 'FLAGGED'} ({log.securityFlags.join(', ')})
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right rtl:text-left">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectPunch(log);
                        }}
                        className="px-3 py-1 rounded-lg text-xs font-bold bg-macq-navy/10 text-macq-navy dark:bg-white/10 dark:text-white hover:bg-macq-orange hover:text-white transition-colors"
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

      {/* 6-Layer Anti-Spoofing Audit Inspection Modal */}
      {selectedPunch && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn"
          onClick={onCloseInspection}
        >
          <div
            className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white dark:bg-macq-cardDark border border-slate-200 dark:border-macq-borderDark/60 shadow-2xl p-5 sm:p-6 relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={onCloseInspection}
              aria-label={isArabic ? 'إغلاق تقرير الفحص' : 'Close audit report'}
              className="absolute top-4 end-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-2 mb-1 pe-8">
              <span className="w-2.5 h-2.5 rounded-full bg-macq-orange flex-shrink-0" />
              <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">
                {isArabic
                  ? 'تقرير الفحص الأمني (6 طبقات)'
                  : '6-Layer Anti-Spoofing Audit Report'}
              </h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">
              #{selectedPunch.id} • {selectedPunch.employeeName} ({selectedPunch.employeeId})
            </p>

            {/* Checklist */}
            <div className="space-y-2.5">
              {/* Layer 1: Mock Location */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-macq-surfaceDark/60 border border-slate-200/60 dark:border-slate-800 flex items-center justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <Cpu size={16} className="text-slate-500 flex-shrink-0" />
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-slate-900 dark:text-white block truncate">
                      {isArabic
                        ? 'الطبقة 1: كشف المواقع الوهمية'
                        : 'Layer 1: OS Mock Location Detection'}
                    </span>
                    <span className="text-[10px] text-slate-500 block">
                      {isArabic
                        ? 'فحص مزود GPS المزيف على الجهاز'
                        : 'Fake GPS mock provider flag check'}
                    </span>
                  </div>
                </div>
                {!selectedPunch.isMockLocation ? (
                  <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-xs font-bold flex-shrink-0">
                    <CheckCircle2 size={16} /> {isArabic ? 'سليم' : 'PASS'}
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-rose-600 text-xs font-bold flex-shrink-0">
                    <XCircle size={16} /> {isArabic ? 'محظور' : 'BLOCKED'}
                  </span>
                )}
              </div>

              {/* Layer 2: GPS Accuracy Radius */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-macq-surfaceDark/60 border border-slate-200/60 dark:border-slate-800 flex items-center justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <MapPin size={16} className="text-slate-500 flex-shrink-0" />
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-slate-900 dark:text-white block truncate">
                      {isArabic
                        ? 'الطبقة 2: دقة إشارة GPS (≤ 50م)'
                        : 'Layer 2: GPS Accuracy Threshold (≤ 50m)'}
                    </span>
                    <span className="text-[10px] text-slate-500 block">
                      {isArabic ? 'الدقة المسجلة:' : 'Measured accuracy:'} ±
                      {selectedPunch.accuracyMeters}m
                    </span>
                  </div>
                </div>
                {selectedPunch.accuracyMeters <= 50 ? (
                  <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-xs font-bold flex-shrink-0">
                    <CheckCircle2 size={16} /> {isArabic ? 'سليم' : 'PASS'}
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-rose-600 text-xs font-bold flex-shrink-0">
                    <XCircle size={16} /> {isArabic ? 'تجاوز' : 'EXCEEDED'}
                  </span>
                )}
              </div>

              {/* Layer 3: Server NTP Sync */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-macq-surfaceDark/60 border border-slate-200/60 dark:border-slate-800 flex items-center justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <Clock size={16} className="text-slate-500 flex-shrink-0" />
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-slate-900 dark:text-white block truncate">
                      {isArabic
                        ? 'الطبقة 3: مزامنة توقيت الخادم (≤ 5 دقائق)'
                        : 'Layer 3: NTP Clock Synchronization (≤ 5 min drift)'}
                    </span>
                    <span className="text-[10px] text-slate-500 block">
                      {isArabic
                        ? 'مقارنة توقيت الجهاز بالساعة الذرية للخادم'
                        : 'Client device timestamp vs. Server atomic clock'}
                    </span>
                  </div>
                </div>
                <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-xs font-bold flex-shrink-0">
                  <CheckCircle2 size={16} /> {isArabic ? 'سليم' : 'PASS'}
                </span>
              </div>

              {/* Layer 4: Root / Jailbreak */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-macq-surfaceDark/60 border border-slate-200/60 dark:border-slate-800 flex items-center justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <ShieldCheck size={16} className="text-slate-500 flex-shrink-0" />
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-slate-900 dark:text-white block truncate">
                      {isArabic
                        ? 'الطبقة 4: سلامة نظام التشغيل'
                        : 'Layer 4: Operating System Integrity'}
                    </span>
                    <span className="text-[10px] text-slate-500 block">
                      {isArabic
                        ? 'فحص كسر الحماية (Root / Jailbreak)'
                        : 'Root / Magisk / Jailbreak detection'}
                    </span>
                  </div>
                </div>
                {!selectedPunch.isDeviceRooted ? (
                  <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-xs font-bold flex-shrink-0">
                    <CheckCircle2 size={16} /> {isArabic ? 'سليم' : 'PASS'}
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-rose-600 text-xs font-bold flex-shrink-0">
                    <XCircle size={16} /> {isArabic ? 'مخترق' : 'ROOTED'}
                  </span>
                )}
              </div>

              {/* Layer 5: Office Geofence */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-macq-surfaceDark/60 border border-slate-200/60 dark:border-slate-800 flex items-center justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <Radio size={16} className="text-slate-500 flex-shrink-0" />
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-slate-900 dark:text-white block truncate">
                      {isArabic
                        ? 'الطبقة 5: النطاق الجغرافي للفرع (≤ 150م)'
                        : 'Layer 5: Office Geofence Radius (≤ 150m)'}
                    </span>
                    <span className="text-[10px] text-slate-500 block">
                      {isArabic ? 'المسافة عن المركز:' : 'Distance from branch center:'}{' '}
                      {selectedPunch.distanceMeters}m
                    </span>
                  </div>
                </div>
                {selectedPunch.distanceMeters <= 150 ||
                selectedPunch.securityFlags.includes('AUTHORIZED_REMOTE_HUB') ? (
                  <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-xs font-bold flex-shrink-0">
                    <CheckCircle2 size={16} /> {isArabic ? 'سليم' : 'PASS'}
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-rose-600 text-xs font-bold flex-shrink-0">
                    <XCircle size={16} /> {isArabic ? 'خارج النطاق' : 'OUTSIDE'}
                  </span>
                )}
              </div>

              {/* Layer 6: Biometric Verification */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-macq-surfaceDark/60 border border-slate-200/60 dark:border-slate-800 flex items-center justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <Fingerprint size={16} className="text-slate-500 flex-shrink-0" />
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-slate-900 dark:text-white block truncate">
                      {isArabic
                        ? 'الطبقة 6: التحقق الحيوي (Face ID / البصمة)'
                        : 'Layer 6: Biometric Liveness Confirmation'}
                    </span>
                    <span className="text-[10px] text-slate-500 block">
                      {isArabic
                        ? 'تأكيد الهوية البيومترية للموظف'
                        : 'Face ID / Fingerprint prompt passed'}
                    </span>
                  </div>
                </div>
                {selectedPunch.biometricVerified ? (
                  <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-xs font-bold flex-shrink-0">
                    <CheckCircle2 size={16} /> {isArabic ? 'سليم' : 'PASS'}
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-rose-600 text-xs font-bold flex-shrink-0">
                    <XCircle size={16} /> {isArabic ? 'فشل' : 'FAILED'}
                  </span>
                )}
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={onCloseInspection}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-macq-navy text-white hover:bg-macq-navy/90 transition-colors"
              >
                {isArabic ? 'إغلاق التقرير' : 'Close Audit Record'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
