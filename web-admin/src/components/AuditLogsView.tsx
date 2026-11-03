import React, { useCallback, useEffect, useState } from 'react';
import {
  ShieldAlert,
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  Clock,
  Globe,
  FileCode2,
} from 'lucide-react';
import {
  ApiError,
  AuditLogItem,
  fetchAuditLogs,
  PaginatedAuditLogs,
} from '../api/client';

interface AuditLogsViewProps {
  isArabic: boolean;
}

const RESOURCE_OPTIONS = [
  { value: 'ALL', labelEn: 'All Resources', labelAr: 'كل الموارد' },
  { value: 'User', labelEn: 'Employees (User)', labelAr: 'الموظفون' },
  { value: 'AuthSession', labelEn: 'Auth & Sessions', labelAr: 'الجلسات والدخول' },
  { value: 'EmploymentChange', labelEn: 'Employment Changes', labelAr: 'التغييرات الوظيفية' },
  { value: 'AttendanceRecord', labelEn: 'Attendance', labelAr: 'الحضور والانصراف' },
  { value: 'LeaveRequest', labelEn: 'Leave Requests', labelAr: 'طلبات الإجازات' },
  { value: 'Branch', labelEn: 'Branches', labelAr: 'الفروع' },
  { value: 'Payroll', labelEn: 'Payroll & WPS', labelAr: 'الرواتب ومدد' },
];

const ACTION_OPTIONS = [
  { value: 'ALL', labelEn: 'All Actions', labelAr: 'كل العمليات' },
  { value: 'AUTH_', labelEn: 'Authentication (AUTH_*)', labelAr: 'عمليات المصادقة' },
  { value: 'EMPLOYEE_', labelEn: 'Employee Lifecycle (EMPLOYEE_*)', labelAr: 'إدارة الموظفين' },
  { value: 'EMPLOYMENT_', labelEn: 'Career & Salary (EMPLOYMENT_*)', labelAr: 'الترقيات والرواتب' },
  { value: 'ATTENDANCE_', labelEn: 'Attendance (ATTENDANCE_*)', labelAr: 'سجلات الحضور' },
  { value: 'LEAVE_', labelEn: 'Leaves (LEAVE_*)', labelAr: 'الإجازات' },
  { value: 'BRANCH_', labelEn: 'Branches (BRANCH_*)', labelAr: 'الفروع' },
  { value: 'PAYROLL_', labelEn: 'Payroll (PAYROLL_*)', labelAr: 'الرواتب' },
];

function badgeStyleForAction(action: string): string {
  if (
    action.includes('FAILED') ||
    action.includes('LOCKED') ||
    action.includes('REJECTED') ||
    action.includes('DEACTIVATED') ||
    action.includes('FORBIDDEN') ||
    action.includes('REUSE')
  ) {
    return 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20';
  }
  if (
    action.includes('CREATED') ||
    action.includes('APPROVED') ||
    action.includes('ACCEPTED') ||
    action.includes('REACTIVATED') ||
    action.includes('SUCCESS')
  ) {
    return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
  }
  return 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20';
}

export const AuditLogsView: React.FC<AuditLogsViewProps> = ({ isArabic }) => {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [resource, setResource] = useState('ALL');
  const [action, setAction] = useState('ALL');
  const [data, setData] = useState<PaginatedAuditLogs | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);

  const loadPage = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchAuditLogs({
        page,
        pageSize: 50,
        search,
        resource,
        action,
      });
      setData(response);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : isArabic
            ? 'تعذر تحميل سجلات النظام.'
            : 'Unable to load system audit logs.',
      );
    } finally {
      setLoading(false);
    }
  }, [page, search, resource, action, isArabic]);

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  };

  const totalPages = data?.totalPages ?? 1;
  const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1);

  return (
    <div className="space-y-6">
      {/* Top Summary Banner */}
      <div className="bg-white dark:bg-macq-cardDark rounded-2xl border border-slate-200/80 dark:border-macq-borderDark/60 p-5 shadow-sm flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-macq-navy text-white flex items-center justify-center flex-shrink-0 shadow-sm">
            <ShieldAlert size={20} className="text-macq-orange" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
              {isArabic
                ? 'سجل التدقيق والعمليات الأمنية'
                : 'System & Security Audit Trail'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {isArabic
                ? 'يتم إرسال 50 سجلاً لكل صفحة (بحد أقصى 20 صفحة نشطة) عند الطلب لكل صفحة'
                : 'Paginated on-demand delivery: 50 logs per page across up to 20 pages (1,000 recent events)'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 text-xs font-semibold text-slate-700 dark:text-slate-300">
            {isArabic ? 'إجمالي السجلات:' : 'Total Matching:'}{' '}
            <span className="font-extrabold text-slate-900 dark:text-white">
              {data?.total ?? 0}
            </span>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 text-xs font-semibold text-slate-700 dark:text-slate-300">
            {isArabic ? 'الصفحة:' : 'Page:'}{' '}
            <span className="font-extrabold text-macq-orange">
              {data?.page ?? page} / {totalPages}
            </span>{' '}
            <span className="text-[11px] text-slate-400">
              (50 / {isArabic ? 'صفحة' : 'page'})
            </span>
          </div>
          <button
            type="button"
            onClick={() => void loadPage()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-macq-navy text-white text-xs font-bold hover:bg-macq-navy/90 disabled:opacity-50 transition-all"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>{isArabic ? 'تحديث الصفحة' : 'Refresh Page'}</span>
          </button>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="bg-white dark:bg-macq-cardDark rounded-2xl border border-slate-200/80 dark:border-macq-borderDark/60 p-4 shadow-sm">
        <form
          onSubmit={handleSearchSubmit}
          className="grid grid-cols-1 md:grid-cols-4 gap-3"
        >
          <div className="md:col-span-2 relative">
            <Search
              size={15}
              className="absolute top-1/2 -translate-y-1/2 left-3 rtl:left-auto rtl:right-3 text-slate-400"
            />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={
                isArabic
                  ? 'ابحث بالعملية، الموظف، البريد، أو عنوان IP...'
                  : 'Search by action, actor name/email/ID, resource, or IP...'
              }
              className="w-full pl-9 pr-20 rtl:pr-9 rtl:pl-20 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-macq-orange"
            />
            <button
              type="submit"
              className="absolute top-1/2 -translate-y-1/2 right-1.5 rtl:right-auto rtl:left-1.5 px-2.5 py-1 rounded-lg bg-macq-orange text-white text-[11px] font-bold hover:bg-macq-orange/90"
            >
              {isArabic ? 'بحث' : 'Search'}
            </button>
          </div>

          <select
            aria-label={isArabic ? 'تصفية حسب المورد' : 'Filter by resource'}
            value={resource}
            onChange={(e) => {
              setPage(1);
              setResource(e.target.value);
            }}
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 text-xs font-semibold text-slate-800 dark:text-slate-100"
          >
            {RESOURCE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {isArabic ? opt.labelAr : opt.labelEn}
              </option>
            ))}
          </select>

          <select
            aria-label={isArabic ? 'تصفية حسب العملية' : 'Filter by action'}
            value={action}
            onChange={(e) => {
              setPage(1);
              setAction(e.target.value);
            }}
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 text-xs font-semibold text-slate-800 dark:text-slate-100"
          >
            {ACTION_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {isArabic ? opt.labelAr : opt.labelEn}
              </option>
            ))}
          </select>
        </form>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 dark:bg-rose-950/40 dark:border-rose-800 px-4 py-3 text-xs font-semibold text-rose-700 dark:text-rose-300">
          {error}
        </div>
      )}

      {/* Logs Container: Mobile Cards (< md) + Structured Desktop Table (>= md) */}
      <div className="bg-white dark:bg-macq-cardDark rounded-2xl border border-slate-200/80 dark:border-macq-borderDark/60 shadow-sm overflow-hidden">
        {/* Mobile Log Cards (< md) */}
        <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800/60">
          {loading ? (
            <div className="py-12 px-4 text-center text-xs text-slate-400 font-semibold">
              {isArabic
                ? `جاري تحميل الصفحة ${page} (50 سجلاً)...`
                : `Loading page ${page} (up to 50 audit logs)...`}
            </div>
          ) : !data || data.items.length === 0 ? (
            <div className="py-12 px-4 text-center text-xs text-slate-400 font-semibold">
              {isArabic
                ? 'لا توجد سجلات مطابقة لمعايير البحث.'
                : 'No audit log entries match the current filters.'}
            </div>
          ) : (
            data.items.map((item) => (
              <div key={item.id} className="p-4 space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${badgeStyleForAction(
                      item.action,
                    )}`}
                  >
                    {item.action}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[11px] font-mono text-slate-500 dark:text-slate-400">
                    <Clock size={11} className="text-slate-400" />
                    {new Date(item.createdAt).toLocaleString(
                      isArabic ? 'ar-SA' : 'en-SA',
                      {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      },
                    )}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2 text-xs">
                  <div className="min-w-0">
                    {item.actor ? (
                      <div className="truncate">
                        <span className="font-bold text-slate-900 dark:text-white inline-flex items-center gap-1">
                          <UserCheck size={12} className="text-teal-500 flex-shrink-0" />
                          <span className="truncate">{item.actor.name}</span>
                          <span className="text-[10px] font-mono text-slate-400">
                            ({item.actor.employeeId})
                          </span>
                        </span>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                          {item.actor.email} · {item.actor.role}
                        </p>
                      </div>
                    ) : (
                      <span className="text-slate-400 italic text-[11px]">
                        {isArabic ? 'النظام / غير مصادق' : 'System / Unauthenticated'}
                      </span>
                    )}
                  </div>

                  <span className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-700 dark:text-slate-300 flex-shrink-0">
                    {item.resource}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="inline-flex items-center gap-1 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                    <Globe size={11} className="text-slate-400" />
                    {item.ipAddress || '—'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedLog(item)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-[11px] font-semibold text-slate-700 dark:text-slate-200 transition-colors"
                  >
                    <FileCode2 size={12} className="text-macq-orange" />
                    <span>{isArabic ? 'عرض البيانات' : 'Inspect JSON'}</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Structured Desktop Table (>= md) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left rtl:text-right border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <th className="py-3 px-4">{isArabic ? 'التوقيت' : 'Timestamp'}</th>
                <th className="py-3 px-4">{isArabic ? 'العملية' : 'Action'}</th>
                <th className="py-3 px-4">{isArabic ? 'المورد' : 'Resource'}</th>
                <th className="py-3 px-4">{isArabic ? 'المنفذ' : 'Actor'}</th>
                <th className="py-3 px-4">{isArabic ? 'عنوان IP' : 'IP Address'}</th>
                <th className="py-3 px-4">{isArabic ? 'التفاصيل' : 'Details'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 font-semibold">
                    {isArabic
                      ? `جاري تحميل الصفحة ${page} (50 سجلاً)...`
                      : `Loading page ${page} (up to 50 audit logs)...`}
                  </td>
                </tr>
              ) : !data || data.items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 font-semibold">
                    {isArabic
                      ? 'لا توجد سجلات مطابقة لمعايير البحث.'
                      : 'No audit log entries match the current filters.'}
                  </td>
                </tr>
              ) : (
                data.items.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/30 transition-colors"
                  >
                    <td className="py-3 px-4 whitespace-nowrap text-slate-600 dark:text-slate-300 font-mono text-[11px]">
                      <span className="inline-flex items-center gap-1.5">
                        <Clock size={12} className="text-slate-400" />
                        {new Date(item.createdAt).toLocaleString(
                          isArabic ? 'ar-SA' : 'en-SA',
                          {
                            dateStyle: 'short',
                            timeStyle: 'medium',
                          },
                        )}
                      </span>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${badgeStyleForAction(
                          item.action,
                        )}`}
                      >
                        {item.action}
                      </span>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap font-semibold text-slate-700 dark:text-slate-200">
                      {item.resource}
                    </td>
                    <td className="py-3 px-4">
                      {item.actor ? (
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900 dark:text-white inline-flex items-center gap-1">
                            <UserCheck size={12} className="text-teal-500" />
                            {item.actor.name}{' '}
                            <span className="text-[10px] font-mono text-slate-400">
                              ({item.actor.employeeId})
                            </span>
                          </span>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400">
                            {item.actor.email} · {item.actor.role}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic text-[11px]">
                          {isArabic ? 'النظام / غير مصادق' : 'System / Unauthenticated'}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap font-mono text-[11px] text-slate-500 dark:text-slate-400">
                      <span className="inline-flex items-center gap-1">
                        <Globe size={12} className="text-slate-400" />
                        {item.ipAddress || '—'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <button
                        type="button"
                        onClick={() => setSelectedLog(item)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-[11px] font-semibold text-slate-700 dark:text-slate-200 transition-colors"
                      >
                        <FileCode2 size={12} className="text-macq-orange" />
                        <span>{isArabic ? 'عرض البيانات' : 'Inspect JSON'}</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* 20-Page On-Request Paginator Footer */}
        <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium text-center sm:text-left rtl:sm:text-right">
            {isArabic
              ? `عرض ${data?.items.length ?? 0} سجل في الصفحة ${page} من أصل ${totalPages} صفحات متاحة (50 سجل لكل طلب)`
              : `Showing ${data?.items.length ?? 0} logs on page ${page} of ${totalPages} (50 logs fetched per page request, max 20 pages)`}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-1">
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-700"
              title={isArabic ? 'الصفحة السابقة' : 'Previous Page'}
            >
              <ChevronLeft size={14} />
            </button>

            {pageNumbers.map((num) => (
              <button
                key={num}
                type="button"
                disabled={loading}
                onClick={() => setPage(num)}
                className={`min-w-[28px] h-7 px-2 rounded-lg text-xs font-bold transition-all ${
                  num === page
                    ? 'bg-macq-orange text-white shadow-sm'
                    : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                {num}
              </button>
            ))}

            <button
              type="button"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-700"
              title={isArabic ? 'الصفحة التالية' : 'Next Page'}
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* JSON Payload Modal */}
      {selectedLog && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setSelectedLog(null)}
        >
          <div
            className="bg-white dark:bg-macq-cardDark border border-slate-200 dark:border-slate-700 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-5 shadow-xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${badgeStyleForAction(
                    selectedLog.action,
                  )}`}
                >
                  {selectedLog.action}
                </span>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-mono">
                  ID: {selectedLog.id}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200"
              >
                {isArabic ? 'إغلاق' : 'Close'}
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">{isArabic ? 'المورد:' : 'Resource:'}</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {selectedLog.resource}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{isArabic ? 'المنفذ:' : 'Actor:'}</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {selectedLog.actor
                    ? `${selectedLog.actor.name} (${selectedLog.actor.employeeId})`
                    : 'System / Unauthenticated'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{isArabic ? 'عنوان IP:' : 'IP Address:'}</span>
                <span className="font-mono text-slate-700 dark:text-slate-300">
                  {selectedLog.ipAddress || '—'}
                </span>
              </div>
            </div>

            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                {isArabic ? 'تفاصيل الحدث (JSON)' : 'Event Metadata (JSON)'}
              </p>
              <pre className="rounded-xl bg-slate-900 text-emerald-300 p-3.5 text-[11px] font-mono overflow-x-auto max-h-64">
                {JSON.stringify(selectedLog.detailsJson ?? {}, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
