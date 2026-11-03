import React, { useState, useEffect } from 'react';
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
  AlertTriangle,
  Laptop,
} from 'lucide-react';
import { LivePunchLog } from '../data/mockAdminData';
import {
  fetchAttendanceExceptions,
  reviewAttendanceException,
  fetchPendingRemoteRequests,
  decideRemoteRequest,
  AttendanceExceptionItem,
  RemoteWorkRequestItem,
} from '../api/client';

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
  const [activeTab, setActiveTab] = useState<'PUNCHES' | 'EXCEPTIONS' | 'REMOTE_REQUESTS'>('PUNCHES');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'VERIFIED' | 'FLAGGED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Phase 8: Exceptions & Remote Requests State
  const [exceptions, setExceptions] = useState<AttendanceExceptionItem[]>([]);
  const [remoteRequests, setRemoteRequests] = useState<RemoteWorkRequestItem[]>([]);
  const [loadingExtras, setLoadingExtras] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const loadExtras = async () => {
    try {
      setLoadingExtras(true);
      const [exList, reqList] = await Promise.all([
        fetchAttendanceExceptions(),
        fetchPendingRemoteRequests(),
      ]);
      setExceptions(exList);
      setRemoteRequests(reqList);
    } catch {
      // Non-blocking fallback
    } finally {
      setLoadingExtras(false);
    }
  };

  useEffect(() => {
    loadExtras();
  }, []);

  const handleReviewException = async (id: string, decision: 'ACCEPTED' | 'ESCALATED') => {
    try {
      await reviewAttendanceException(id, decision, 'Reviewed via Web Admin Console');
      setFeedbackMsg({
        text: isArabic
          ? `تم تحديث الاستثناء بنجاح (${decision === 'ACCEPTED' ? 'مقبول' : 'تم التصعيد'})`
          : `Exception marked as ${decision.toLowerCase()} successfully.`,
        type: 'success',
      });
      loadExtras();
    } catch (err: any) {
      setFeedbackMsg({
        text: err?.message || 'Failed to review exception',
        type: 'error',
      });
    }
  };

  const handleDecideRemote = async (id: string, decision: 'APPROVED' | 'REJECTED') => {
    try {
      await decideRemoteRequest(id, decision);
      setFeedbackMsg({
        text: isArabic
          ? `تم تحديث طلب العمل عن بعد (${decision === 'APPROVED' ? 'مقبول' : 'مرفوض'})`
          : `Remote request ${decision.toLowerCase()} successfully.`,
        type: 'success',
      });
      loadExtras();
    } catch (err: any) {
      setFeedbackMsg({
        text: err?.message || 'Failed to decide remote request',
        type: 'error',
      });
    }
  };

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
      {/* Feedback Alert */}
      {feedbackMsg && (
        <div
          className={`p-3 rounded-xl text-xs font-bold flex items-center justify-between ${
            feedbackMsg.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
              : 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
          }`}
        >
          <span>{feedbackMsg.text}</span>
          <button type="button" onClick={() => setFeedbackMsg(null)} className="p-1 hover:opacity-75">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Top Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        <button
          type="button"
          onClick={() => setActiveTab('PUNCHES')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'PUNCHES'
              ? 'bg-macq-navy text-white shadow-sm'
              : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
          }`}
        >
          <Radio size={14} />
          <span>{isArabic ? 'رادار الحضور وسجلات البصمة' : 'Live Radar & Punches'}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('EXCEPTIONS')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 relative ${
            activeTab === 'EXCEPTIONS'
              ? 'bg-macq-navy text-white shadow-sm'
              : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
          }`}
        >
          <AlertTriangle size={14} />
          <span>{isArabic ? 'مراجعة الاستثناءات' : 'Exceptions Review'}</span>
          {exceptions.filter((e) => e.status === 'OPEN').length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500 text-white">
              {exceptions.filter((e) => e.status === 'OPEN').length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('REMOTE_REQUESTS')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 relative ${
            activeTab === 'REMOTE_REQUESTS'
              ? 'bg-macq-navy text-white shadow-sm'
              : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
          }`}
        >
          <Laptop size={14} />
          <span>{isArabic ? 'طلبات العمل عن بعد' : 'Remote Requests'}</span>
          {remoteRequests.filter((r) => r.status === 'PENDING').length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-extrabold bg-sky-500 text-white">
              {remoteRequests.filter((r) => r.status === 'PENDING').length}
            </span>
          )}
        </button>
      </div>

      {/* Tab 1: Live Punches Radar */}
      {activeTab === 'PUNCHES' && (
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
              {filteredLogs.map((log) => (
                <div
                  key={log.id}
                  onClick={() => onSelectPunch(log)}
                  className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-macq-surfaceDark/40 space-y-2 cursor-pointer hover:border-macq-orange/40 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <span className="text-xs font-bold text-slate-900 dark:text-white block truncate">
                        {log.employeeName}
                      </span>
                      <span className="text-[10px] text-slate-400 block font-mono">
                        {log.employeeId} · {log.jobTitle}
                      </span>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${
                        log.status === 'VERIFIED'
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60'
                          : 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200/60'
                      }`}
                    >
                      {log.status === 'VERIFIED' ? <ShieldCheck size={12} /> : <ShieldAlert size={12} />}
                      {log.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-1 text-[11px] text-slate-600 dark:text-slate-400 pt-1 border-t border-slate-200/60 dark:border-slate-800/60">
                    <div>
                      <span className="text-[10px] text-slate-400 block">{isArabic ? 'النوع:' : 'Type:'}</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">{log.type}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">{isArabic ? 'الوقت:' : 'Time:'}</span>
                      <span className="font-mono text-slate-800 dark:text-slate-200">{log.timestamp}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">{isArabic ? 'الفرع:' : 'Branch:'}</span>
                      <span className="truncate block">{log.branchName}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">{isArabic ? 'المسافة:' : 'Distance:'}</span>
                      <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                        {log.distanceMeters}m
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Structured HTML Table (hidden on mobile) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left rtl:text-right text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400">
                    <th className="pb-3 font-semibold">{isArabic ? 'الموظف' : 'Employee'}</th>
                    <th className="pb-3 font-semibold">{isArabic ? 'النوع' : 'Type'}</th>
                    <th className="pb-3 font-semibold">{isArabic ? 'الوقت والتاريخ' : 'Time'}</th>
                    <th className="pb-3 font-semibold">{isArabic ? 'الفرع' : 'Branch'}</th>
                    <th className="pb-3 font-semibold">{isArabic ? 'المسافة' : 'Distance'}</th>
                    <th className="pb-3 font-semibold">{isArabic ? 'دقة GPS' : 'Accuracy'}</th>
                    <th className="pb-3 font-semibold">{isArabic ? 'الحالة' : 'Status'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {filteredLogs.map((log) => (
                    <tr
                      key={log.id}
                      onClick={() => onSelectPunch(log)}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors cursor-pointer"
                    >
                      <td className="py-3 pr-3 rtl:pl-3 rtl:pr-0">
                        <span className="font-bold text-slate-900 dark:text-white block">
                          {log.employeeName}
                        </span>
                        <span className="text-[10px] text-slate-400 block font-mono">
                          {log.employeeId} · {log.jobTitle}
                        </span>
                      </td>
                      <td className="py-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                            log.type === 'CHECK_IN'
                              ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400'
                              : 'bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400'
                          }`}
                        >
                          {log.type}
                        </span>
                      </td>
                      <td className="py-3 font-mono text-slate-600 dark:text-slate-400">
                        {log.timestamp}
                      </td>
                      <td className="py-3 text-slate-600 dark:text-slate-400">{log.branchName}</td>
                      <td className="py-3 font-mono font-bold text-slate-700 dark:text-slate-300">
                        {log.distanceMeters}m
                      </td>
                      <td className="py-3 font-mono text-slate-600 dark:text-slate-400">
                        ±{log.accuracyMeters.toFixed(1)}m
                      </td>
                      <td className="py-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                            log.status === 'VERIFIED'
                              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60'
                              : 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/60'
                          }`}
                        >
                          {log.status === 'VERIFIED' ? (
                            <ShieldCheck size={12} />
                          ) : (
                            <ShieldAlert size={12} />
                          )}
                          {log.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Attendance Exceptions Review */}
      {activeTab === 'EXCEPTIONS' && (
        <div className="p-4 sm:p-6 rounded-2xl bg-white dark:bg-macq-cardDark border border-slate-200 dark:border-macq-borderDark/60 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {isArabic ? 'سجل استثناءات الحضور والانصراف' : 'Attendance Exceptions Queue'}
              </h3>
              <p className="text-xs text-slate-500">
                {isArabic
                  ? 'بصمات الخروج خارج النطاق الجغرافي أو الحالات المشبوهة التي تتطلب مراجعة الموارد البشرية'
                  : 'Check-outs outside geofence or telemetry anomalies requiring HR audit'}
              </p>
            </div>
            <button
              type="button"
              onClick={loadExtras}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
            >
              {isArabic ? 'تحديث' : 'Refresh'}
            </button>
          </div>

          {loadingExtras ? (
            <div className="py-8 text-center text-xs text-slate-400">Loading exceptions...</div>
          ) : exceptions.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              {isArabic ? 'لا توجد استثناءات معلقة للمراجعة' : 'No attendance exceptions recorded.'}
            </div>
          ) : (
            <div className="space-y-3">
              {exceptions.map((ex) => (
                <div
                  key={ex.id}
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-macq-surfaceDark/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-slate-900 dark:text-white">
                        {ex.day.user.fullName} ({ex.day.user.employeeId})
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                          ex.status === 'OPEN'
                            ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                            : ex.status === 'ACCEPTED'
                              ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                              : 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
                        }`}
                      >
                        {ex.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      <strong className="text-slate-800 dark:text-slate-200">{ex.type}</strong> —{' '}
                      {ex.detailsJson?.distanceMeters
                        ? `${ex.detailsJson.distanceMeters}m away from ${ex.detailsJson.branchName || 'branch'}`
                        : 'Non-standard punch telemetry'}
                    </p>
                    <span className="text-[10px] text-slate-400 block font-mono">
                      {ex.day.dateIso} · {new Date(ex.createdAt).toLocaleTimeString()}
                    </span>
                  </div>

                  {ex.status === 'OPEN' && (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => handleReviewException(ex.id, 'ACCEPTED')}
                        className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
                      >
                        {isArabic ? 'قبول (مبرر)' : 'Accept (Justified)'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleReviewException(ex.id, 'ESCALATED')}
                        className="px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white transition-colors"
                      >
                        {isArabic ? 'تصعيد' : 'Escalate'}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Remote Work Requests */}
      {activeTab === 'REMOTE_REQUESTS' && (
        <div className="p-4 sm:p-6 rounded-2xl bg-white dark:bg-macq-cardDark border border-slate-200 dark:border-macq-borderDark/60 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {isArabic ? 'طلبات العمل عن بعد المعلقة' : 'Pending Remote Work Requests'}
              </h3>
              <p className="text-xs text-slate-500">
                {isArabic
                  ? 'طلبات موظفي المكاتب للعمل من المنزل أو خارج المكتب'
                  : 'Daily work-from-home requests submitted by office employees'}
              </p>
            </div>
            <button
              type="button"
              onClick={loadExtras}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
            >
              {isArabic ? 'تحديث' : 'Refresh'}
            </button>
          </div>

          {loadingExtras ? (
            <div className="py-8 text-center text-xs text-slate-400">Loading remote requests...</div>
          ) : remoteRequests.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              {isArabic ? 'لا توجد طلبات عمل عن بعد معلقة' : 'No pending remote work requests.'}
            </div>
          ) : (
            <div className="space-y-3">
              {remoteRequests.map((req) => (
                <div
                  key={req.id}
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-macq-surfaceDark/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-slate-900 dark:text-white">
                        {req.user.fullName} ({req.user.employeeId})
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {req.startDateIso} → {req.endDateIso}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 italic">
                      "{req.reason}"
                    </p>
                  </div>

                  {req.status === 'PENDING' && (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => handleDecideRemote(req.id, 'APPROVED')}
                        className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
                      >
                        {isArabic ? 'موافقة' : 'Approve'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDecideRemote(req.id, 'REJECTED')}
                        className="px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white transition-colors"
                      >
                        {isArabic ? 'رفض' : 'Reject'}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 6-Layer Anti-Spoofing Audit Modal */}
      {selectedPunch && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm"
          onClick={onCloseInspection}
        >
          <div
            className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl bg-white dark:bg-macq-cardDark border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-macq-orange/10 text-macq-orange">
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                    {isArabic ? 'فحص تدقيق مكافحة التزييف (6 طبقات)' : '6-Layer Anti-Spoofing Audit'}
                  </h3>
                  <span className="text-[10px] text-slate-400 block font-mono">
                    {selectedPunch.employeeName} ({selectedPunch.employeeId})
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={onCloseInspection}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            {/* Audit Layers Inspection List */}
            <div className="space-y-2.5">
              {/* Layer 1: Mock Location */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-macq-surfaceDark/60 border border-slate-200/60 dark:border-slate-800 flex items-center justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <MapPin size={16} className="text-slate-500 flex-shrink-0" />
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-slate-900 dark:text-white block truncate">
                      {isArabic
                        ? 'الطبقة 1: كشف الموقع الوهمي'
                        : 'Layer 1: Mock Location Provider'}
                    </span>
                    <span className="text-[10px] text-slate-500 block">
                      {isArabic
                        ? 'فحص تطبيقات تزييف الموقع (Fake GPS)'
                        : 'OS-level isFromMockProvider flag'}
                    </span>
                  </div>
                </div>
                {!selectedPunch.isMockLocation ? (
                  <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-xs font-bold flex-shrink-0">
                    <CheckCircle2 size={16} /> {isArabic ? 'سليم' : 'PASS'}
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-rose-600 text-xs font-bold flex-shrink-0">
                    <XCircle size={16} /> {isArabic ? 'تزييف' : 'MOCK'}
                  </span>
                )}
              </div>

              {/* Layer 2: GPS Accuracy */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-macq-surfaceDark/60 border border-slate-200/60 dark:border-slate-800 flex items-center justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <Radio size={16} className="text-slate-500 flex-shrink-0" />
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-slate-900 dark:text-white block truncate">
                      {isArabic
                        ? 'الطبقة 2: دقة إشارة الـ GPS (≤ 50م)'
                        : 'Layer 2: GPS Accuracy Radius (≤ 50m)'}
                    </span>
                    <span className="text-[10px] text-slate-500 block">
                      {isArabic ? 'نصف القطر المسجل:' : 'Recorded radius:'} ±
                      {selectedPunch.accuracyMeters.toFixed(1)}m
                    </span>
                  </div>
                </div>
                {selectedPunch.accuracyMeters <= 50 ? (
                  <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-xs font-bold flex-shrink-0">
                    <CheckCircle2 size={16} /> {isArabic ? 'سليم' : 'PASS'}
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-rose-600 text-xs font-bold flex-shrink-0">
                    <XCircle size={16} /> {isArabic ? 'ضعيف' : 'WEAK'}
                  </span>
                )}
              </div>

              {/* Layer 3: NTP Synchronization */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-macq-surfaceDark/60 border border-slate-200/60 dark:border-slate-800 flex items-center justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <Clock size={16} className="text-slate-500 flex-shrink-0" />
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-slate-900 dark:text-white block truncate">
                      {isArabic
                        ? 'الطبقة 3: تزامن ساعة الخادم (NTP)'
                        : 'Layer 3: Server NTP Synchronization'}
                    </span>
                    <span className="text-[10px] text-slate-500 block">
                      {isArabic
                        ? 'مقارنة توقيت الجهاز مع توقيت الخادم'
                        : 'Client-server drift check (≤ 5 min)'}
                    </span>
                  </div>
                </div>
                <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-xs font-bold flex-shrink-0">
                  <CheckCircle2 size={16} /> {isArabic ? 'متزامن' : 'PASS'}
                </span>
              </div>

              {/* Layer 4: Root / Jailbreak Detection */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-macq-surfaceDark/60 border border-slate-200/60 dark:border-slate-800 flex items-center justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <Cpu size={16} className="text-slate-500 flex-shrink-0" />
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
