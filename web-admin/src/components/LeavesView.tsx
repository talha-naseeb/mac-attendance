import React, { useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  Send,
  MessageSquare,
} from 'lucide-react';
import { AdminLeaveItem } from '../data/mockAdminData';

interface LeavesViewProps {
  isArabic: boolean;
  requests: AdminLeaveItem[];
  onDecision: (id: string, decision: 'APPROVED' | 'REJECTED') => Promise<void>;
}

export const LeavesView: React.FC<LeavesViewProps> = ({ isArabic, requests, onDecision }) => {
  const [activeTab, setActiveTab] = useState<'PENDING' | 'HISTORY'>('PENDING');
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const handleDecision = async (id: string, decision: 'APPROVED' | 'REJECTED') => {
    setError(null);
    setPendingId(id);
    try {
      await onDecision(id, decision);
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

  const displayedRequests = requests.filter((r) =>
    activeTab === 'PENDING' ? r.status === 'PENDING' : r.status !== 'PENDING',
  );

  return (
    <div className="space-y-6">
      {error && (
        <p className="rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 px-3.5 py-2.5 text-xs font-semibold text-rose-700 dark:text-rose-300">
          {error}
        </p>
      )}
      {/* Tab filter */}
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
            {isArabic ? 'الطلبات المعلقة للاعتماد' : 'Pending Approvals Queue'} (
            {requests.filter((r) => r.status === 'PENDING').length})
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
            {isArabic ? 'سجل القرارات السابقة' : 'Reviewed History'} (
            {requests.filter((r) => r.status !== 'PENDING').length})
          </button>
        </div>

        <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <Send size={14} className="text-macq-orange" />
          <span>{isArabic ? 'إشعارات مايكروسوفت تيمز مفعلة' : 'MS Teams Webhooks Active'}</span>
        </div>
      </div>

      {/* Requests Container */}
      <div className="p-4 sm:p-6 rounded-2xl bg-white dark:bg-macq-cardDark border border-slate-200 dark:border-macq-borderDark/60 shadow-sm">
        {/* Mobile Responsive Leave Cards (< md) */}
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
                  <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400">
                    {req.type}
                  </span>
                </div>

                <div className="text-xs text-slate-700 dark:text-slate-200 font-semibold">
                  {req.startDate} → {req.endDate} ({req.daysCount}{' '}
                  {isArabic ? 'أيام' : 'days'})
                </div>

                {req.reason && (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {req.reason}
                  </p>
                )}

                <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800 flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full">
                    <MessageSquare size={11} />
                    {isArabic ? 'بطاقة تيمز' : 'Adaptive Card'}
                  </span>

                  {req.status === 'PENDING' ? (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={pendingId === req.id}
                        onClick={() => void handleDecision(req.id, 'APPROVED')}
                        className="px-3 py-1 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50"
                      >
                        {isArabic ? 'اعتماد' : 'Approve'}
                      </button>
                      <button
                        type="button"
                        disabled={pendingId === req.id}
                        onClick={() => void handleDecision(req.id, 'REJECTED')}
                        className="px-3 py-1 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white disabled:opacity-50"
                      >
                        {isArabic ? 'رفض' : 'Reject'}
                      </button>
                    </div>
                  ) : (
                    <span
                      className={`inline-flex items-center gap-1 text-[11px] font-bold ${
                        req.status === 'APPROVED'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {req.status === 'APPROVED' ? (
                        <>
                          <CheckCircle2 size={13} /> {isArabic ? 'معتمد' : 'APPROVED'}
                        </>
                      ) : (
                        <>
                          <XCircle size={13} /> {isArabic ? 'مرفوض' : 'REJECTED'}
                        </>
                      )}
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop Structured Table (md+) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left rtl:text-right text-xs border-collapse min-w-[700px]">
            <thead>
              <tr className="border-b border-slate-200 dark:border-zinc-800 text-slate-500 dark:text-zinc-400 font-bold uppercase tracking-wider bg-slate-50/70 dark:bg-zinc-950/40">
                <th className="py-3.5 px-4">{isArabic ? 'الموظف' : 'Employee'}</th>
                <th className="py-3.5 px-4">{isArabic ? 'نوع الإجازة' : 'Leave Type'}</th>
                <th className="py-3.5 px-4">{isArabic ? 'الفترة' : 'Date Range'}</th>
                <th className="py-3.5 px-4">{isArabic ? 'المدة' : 'Days'}</th>
                <th className="py-3.5 px-4">{isArabic ? 'السبب' : 'Reason / Note'}</th>
                <th className="py-3.5 px-4">{isArabic ? 'تكامل تيمز' : 'MS Teams Sync'}</th>
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
                      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400">
                        {req.type}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white">
                      {req.startDate} → {req.endDate}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-bold text-slate-900 dark:text-white">
                        {req.daysCount} {isArabic ? 'أيام' : 'days'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300 max-w-xs truncate">
                      {req.reason}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full">
                        <MessageSquare size={11} />
                        {isArabic ? 'تم إرسال البطاقة' : 'Adaptive Card Sent'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right rtl:text-left">
                      {req.status === 'PENDING' ? (
                        <div className="flex items-center justify-end rtl:justify-start gap-1.5">
                          <button
                            type="button"
                            disabled={pendingId === req.id}
                            onClick={() => void handleDecision(req.id, 'APPROVED')}
                            className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors disabled:opacity-50"
                          >
                            {isArabic ? 'اعتماد' : 'Approve'}
                          </button>
                          <button
                            type="button"
                            disabled={pendingId === req.id}
                            onClick={() => void handleDecision(req.id, 'REJECTED')}
                            className="px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white transition-colors disabled:opacity-50"
                          >
                            {isArabic ? 'رفض' : 'Reject'}
                          </button>
                        </div>
                      ) : (
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] font-bold ${
                            req.status === 'APPROVED'
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {req.status === 'APPROVED' ? (
                            <>
                              <CheckCircle2 size={13} /> {isArabic ? 'معتمد' : 'APPROVED'}
                            </>
                          ) : (
                            <>
                              <XCircle size={13} /> {isArabic ? 'مرفوض' : 'REJECTED'}
                            </>
                          )}
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
    </div>
  );
};
