import React, { useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  Clock,
  Send,
  Paperclip,
  ShieldAlert,
  Calendar,
  UserCheck,
} from 'lucide-react';
import { AdminLeaveItem } from '../data/mockAdminData';

interface LeavesViewProps {
  isArabic: boolean;
  requests: AdminLeaveItem[];
  onDecision: (
    id: string,
    decision: 'APPROVED' | 'REJECTED',
    comments?: string,
    isHrOverride?: boolean,
  ) => Promise<void>;
}

export const LeavesView: React.FC<LeavesViewProps> = ({ isArabic, requests, onDecision }) => {
  const [activeTab, setActiveTab] = useState<'PENDING' | 'HISTORY'>('PENDING');
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  // Rejection Dialog State
  const [rejectingItem, setRejectingItem] = useState<AdminLeaveItem | null>(null);
  const [rejectionComments, setRejectionComments] = useState<string>('');

  const handleDecision = async (
    id: string,
    decision: 'APPROVED' | 'REJECTED',
    comments?: string,
    isHrOverride?: boolean,
  ) => {
    setError(null);
    setPendingId(id);
    try {
      await onDecision(id, decision, comments, isHrOverride);
      if (rejectingItem) {
        setRejectingItem(null);
        setRejectionComments('');
      }
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : isArabic
            ? 'تعذر حفظ قرار الإجازة.'
            : 'Unable to save this leave decision.',
      );
    } finally {
      setPendingId(null);
    }
  };

  const isPendingStatus = (status: string) =>
    status === 'PENDING' || status === 'PENDING_MANAGER' || status === 'PENDING_HR';

  const pendingRequests = requests.filter((r) => isPendingStatus(r.status));
  const historyRequests = requests.filter((r) => !isPendingStatus(r.status));
  const displayedRequests = activeTab === 'PENDING' ? pendingRequests : historyRequests;

  const renderStatusBadge = (req: AdminLeaveItem) => {
    if (req.status === 'PENDING_MANAGER' || (req.status === 'PENDING' && req.stage === 'STAGE_1_MANAGER')) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
          <Clock size={11} />
          {isArabic ? 'المرحلة 1: مراجعة المدير المباشر' : 'Stage 1: Line Manager Review'}
        </span>
      );
    }

    if (req.status === 'PENDING_HR' || (req.status === 'PENDING' && req.stage === 'STAGE_2_HR')) {
      return (
        <div className="flex flex-col gap-0.5">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
            <UserCheck size={11} />
            {isArabic ? 'المرحلة 2: اعتماد الموارد البشرية' : 'Stage 2: HR Final Approval'}
          </span>
          {req.managerReviewedByName && (
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold px-1">
              {isArabic ? `✓ تم التأييد من ${req.managerReviewedByName}` : `✓ Endorsed by ${req.managerReviewedByName}`}
            </span>
          )}
          {req.routedDirectlyToHr && (
            <span className="text-[10px] text-purple-600 dark:text-purple-400 font-semibold px-1">
              {isArabic ? 'تحويل مباشر (بدون مدير مباشر)' : 'Direct to HR (Manager / Executive)'}
            </span>
          )}
        </div>
      );
    }

    if (req.status === 'APPROVED') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
          <CheckCircle2 size={11} />
          {isArabic ? 'معتمد نهائياً' : 'Approved'}
        </span>
      );
    }

    if (req.status === 'REJECTED') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
          <XCircle size={11} />
          {isArabic ? 'مرفوض' : 'Rejected'}
        </span>
      );
    }

    if (req.status === 'CANCELLED') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-500/10 text-slate-500 dark:text-slate-400 border border-slate-500/20">
          <XCircle size={11} />
          {isArabic ? 'ملغي من الموظف' : 'Cancelled'}
        </span>
      );
    }

    return null;
  };

  return (
    <div className="space-y-6">
      {error && (
        <p className="rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 px-3.5 py-2.5 text-xs font-semibold text-rose-700 dark:text-rose-300">
          {error}
        </p>
      )}

      {/* Tab Filter Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('PENDING')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'PENDING'
                ? 'bg-macq-navy text-white shadow-sm'
                : 'bg-white dark:bg-macq-cardDark text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-macq-borderDark/60'
            }`}
          >
            {isArabic ? 'الطلبات المعلقة للاعتماد' : 'Pending Approvals Queue'} ({pendingRequests.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('HISTORY')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'HISTORY'
                ? 'bg-macq-navy text-white shadow-sm'
                : 'bg-white dark:bg-macq-cardDark text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-macq-borderDark/60'
            }`}
          >
            {isArabic ? 'سجل القرارات السابقة' : 'Reviewed History'} ({historyRequests.length})
          </button>
        </div>

        <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <Send size={14} className="text-macq-orange" />
          <span>{isArabic ? 'خط موافقات ثنائي المراحل مفعّل' : '2-Stage Approval Pipeline Active'}</span>
        </div>
      </div>

      {/* Requests Container */}
      <div className="p-4 sm:p-6 rounded-2xl bg-white dark:bg-macq-cardDark border border-slate-200 dark:border-macq-borderDark/60 shadow-sm">
        {/* Mobile Responsive Cards (< md) */}
        <div className="md:hidden space-y-3">
          {displayedRequests.length === 0 ? (
            <p className="py-8 text-center text-xs font-semibold text-slate-400">
              {isArabic ? 'لا توجد طلبات في هذه القائمة.' : 'No leave requests in this queue.'}
            </p>
          ) : (
            displayedRequests.map((req) => (
              <div
                key={`mobile-leave-${req.id}`}
                className="p-4 rounded-xl bg-slate-50 dark:bg-macq-surfaceDark/60 border border-slate-200/70 dark:border-slate-800 space-y-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-bold text-slate-900 dark:text-white">
                      {req.employeeName}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {req.employeeId} • {req.department}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400">
                      {req.type}
                    </span>
                    {req.isHalfDay && (
                      <span className="text-[10px] font-semibold text-sky-600 bg-sky-50 dark:bg-sky-950/40 px-1.5 py-0.5 rounded">
                        {isArabic ? 'نصف يوم' : `0.5 Day (${req.halfDayPeriod || 'Day'})`}
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-xs text-slate-700 dark:text-slate-200 font-semibold flex items-center gap-1.5">
                  <Calendar size={13} className="text-slate-400" />
                  {req.startDate} → {req.endDate} ({req.daysCount} {isArabic ? 'أيام' : 'days'})
                </div>

                {req.reason && (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {req.reason}
                  </p>
                )}

                {req.attachmentUrl && (
                  <a
                    href={req.attachmentUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-macq-orange hover:underline"
                  >
                    <Paperclip size={12} />
                    {isArabic ? 'عرض المرفق الطبي / الداعم' : 'View Attachment'}
                  </a>
                )}

                <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800 flex flex-col gap-2">
                  {renderStatusBadge(req)}

                  {isPendingStatus(req.status) && (
                    <div className="flex items-center gap-1.5 pt-1">
                      {req.status === 'PENDING_MANAGER' ? (
                        <button
                          type="button"
                          disabled={pendingId === req.id}
                          onClick={() => void handleDecision(req.id, 'APPROVED', undefined, true)}
                          className="px-2.5 py-1 rounded-lg text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50"
                        >
                          {isArabic ? 'اعتماد الموارد البشرية (تجاوز)' : 'HR Override & Approve'}
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={pendingId === req.id}
                          onClick={() => void handleDecision(req.id, 'APPROVED')}
                          className="px-3 py-1 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50"
                        >
                          {isArabic ? 'اعتماد نهائي' : 'Final Approve'}
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={pendingId === req.id}
                        onClick={() => setRejectingItem(req)}
                        className="px-3 py-1 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white disabled:opacity-50"
                      >
                        {isArabic ? 'رفض' : 'Reject'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop Structured Table (md+) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left rtl:text-right text-xs border-collapse min-w-[760px]">
            <thead>
              <tr className="border-b border-slate-200 dark:border-zinc-800 text-slate-500 dark:text-zinc-400 font-bold uppercase tracking-wider bg-slate-50/70 dark:bg-zinc-950/40">
                <th className="py-3.5 px-4">{isArabic ? 'الموظف' : 'Employee'}</th>
                <th className="py-3.5 px-4">{isArabic ? 'نوع الإجازة' : 'Leave Type'}</th>
                <th className="py-3.5 px-4">{isArabic ? 'الفترة' : 'Date Range'}</th>
                <th className="py-3.5 px-4">{isArabic ? 'المدة' : 'Days'}</th>
                <th className="py-3.5 px-4">{isArabic ? 'مرحلة الاعتماد' : 'Approval Stage'}</th>
                <th className="py-3.5 px-4">{isArabic ? 'المرفقات والسبب' : 'Details & Proof'}</th>
                <th className="py-3.5 px-4 text-right rtl:text-left">{isArabic ? 'القرار' : 'Action'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60 text-slate-800 dark:text-zinc-300">
              {displayedRequests.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-400 font-semibold">
                    {isArabic ? 'لا توجد طلبات في هذه القائمة.' : 'No leave requests in this queue.'}
                  </td>
                </tr>
              ) : (
                displayedRequests.map((req) => (
                  <tr
                    key={req.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-zinc-800/40 transition-colors"
                  >
                    <td className="py-3.5 px-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-900 dark:text-white">
                          {req.employeeName}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          {req.employeeId} • {req.department}
                        </span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400">
                          {req.type}
                        </span>
                        {req.isHalfDay && (
                          <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-sky-500/10 text-sky-600 dark:text-sky-400">
                            0.5
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                      {req.startDate} → {req.endDate}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-bold text-slate-900 dark:text-white">
                        {req.daysCount} {isArabic ? 'أيام' : 'days'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      {renderStatusBadge(req)}
                    </td>
                    <td className="py-3.5 px-4 max-w-xs">
                      <p className="truncate text-slate-600 dark:text-slate-300 font-medium">
                        {req.reason}
                      </p>
                      {req.attachmentUrl && (
                        <a
                          href={req.attachmentUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[10px] font-bold text-macq-orange hover:underline mt-0.5"
                        >
                          <Paperclip size={11} />
                          {isArabic ? 'مرفق داعم' : 'Attachment'}
                        </a>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right rtl:text-left">
                      {isPendingStatus(req.status) ? (
                        <div className="flex items-center justify-end rtl:justify-start gap-1.5">
                          {req.status === 'PENDING_MANAGER' ? (
                            <button
                              type="button"
                              disabled={pendingId === req.id}
                              onClick={() => void handleDecision(req.id, 'APPROVED', undefined, true)}
                              title={isArabic ? 'تجاوز مدير الخط والاعتماد كمسؤول موارد بشرية' : 'Approve directly as HR Admin'}
                              className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-purple-600 hover:bg-purple-700 text-white transition-colors disabled:opacity-50"
                            >
                              {isArabic ? 'تجاوز واعتماد' : 'HR Override'}
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={pendingId === req.id}
                              onClick={() => void handleDecision(req.id, 'APPROVED')}
                              className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors disabled:opacity-50"
                            >
                              {isArabic ? 'اعتماد' : 'Approve'}
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={pendingId === req.id}
                            onClick={() => setRejectingItem(req)}
                            className="px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white transition-colors disabled:opacity-50"
                          >
                            {isArabic ? 'رفض' : 'Reject'}
                          </button>
                        </div>
                      ) : (
                        <span className="text-[11px] font-semibold text-slate-400">
                          {req.status === 'APPROVED' ? '✓' : '—'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Rejection Reason Modal */}
      {rejectingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-macq-cardDark border border-slate-200 dark:border-macq-borderDark/60 p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-2.5 text-rose-600 dark:text-rose-400">
              <ShieldAlert size={20} />
              <h3 className="font-bold text-base">
                {isArabic ? 'رفض طلب الإجازة' : 'Reject Leave Request'}
              </h3>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300">
              {isArabic
                ? `أنت على وشك رفض طلب إجازة ${rejectingItem.employeeName} (${rejectingItem.type} - ${rejectingItem.daysCount} أيام). يرجى تقديم سبب الرفض:`
                : `You are rejecting ${rejectingItem.employeeName}'s ${rejectingItem.type} request (${rejectingItem.daysCount} days). Please provide a reason:`}
            </p>

            <textarea
              required
              rows={3}
              value={rejectionComments}
              onChange={(e) => setRejectionComments(e.target.value)}
              placeholder={
                isArabic
                  ? 'سبب الرفض (مثال: ضغط عمل خلال فترة الإصدار، يرجى التنسيق مجدداً)...'
                  : 'Rejection reason (e.g. Schedule conflict with release sprint)...'
              }
              className="w-full rounded-xl border border-slate-200 dark:border-macq-borderDark/60 bg-slate-50 dark:bg-macq-surfaceDark/60 p-3 text-xs text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:border-rose-500"
            />

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setRejectingItem(null);
                  setRejectionComments('');
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                {isArabic ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="button"
                disabled={!rejectionComments.trim() || pendingId === rejectingItem.id}
                onClick={() =>
                  void handleDecision(rejectingItem.id, 'REJECTED', rejectionComments.trim())
                }
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white disabled:opacity-50"
              >
                {isArabic ? 'تأكيد الرفض' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
