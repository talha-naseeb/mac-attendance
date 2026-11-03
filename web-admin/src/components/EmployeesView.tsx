import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowRightLeft,
  ChevronLeft,
  ChevronRight,
  KeyRound,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  UserCheck,
  UserX,
} from 'lucide-react';
import type { AdminBranch, AdminEmployee } from '../data/mockAdminData';
import { fetchEmployees, getEmployeePendingApprovals, resetEmployeePassword } from '../api/employeesApi';
import type { EmployeeListQuery } from '../api/employeesApi';
import { mapEmployee } from '../api/client';
import { employeeStatusLabel } from '../services/employeeForm';
import { EmployeeFormDrawer } from './EmployeeFormDrawer';
import { EmploymentChangeDrawer } from './EmploymentChangeDrawer';
import { DeactivateEmployeeDialog } from './DeactivateEmployeeDialog';
import { TemporaryPasswordModal } from './TemporaryPasswordModal';

interface EmployeesViewProps {
  isArabic: boolean;
  branches: AdminBranch[];
  managers: AdminEmployee[];
  onChanged: () => Promise<void>;
}

interface QueryState {
  search: string;
  department: string;
  branchId: string;
  status: 'ACTIVE' | 'INACTIVE' | 'ALL';
  sort: 'employeeId' | 'name' | 'department' | 'status';
  direction: 'asc' | 'desc';
  page: number;
  pageSize: number;
}

type DrawerKind = 'create' | 'edit' | 'change' | 'deactivate' | null;

type TemporaryCredential = { name: string; password: string } | null;

const PAGE_SIZES = [10, 25, 50, 100];

const SELECT_CLASS =
  'px-3 py-2 rounded-xl text-xs font-semibold bg-slate-50 dark:bg-macq-surfaceDark border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-macq-orange/40';

const ROW_ACTION_CLASS =
  'rounded-lg p-1.5 text-slate-500 dark:text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white disabled:cursor-not-allowed disabled:opacity-50';

export const EmployeesView: React.FC<EmployeesViewProps> = ({
  isArabic,
  branches,
  managers,
  onChanged,
}) => {
  const [query, setQuery] = useState<QueryState>({
    search: '',
    department: '',
    branchId: '',
    status: 'ACTIVE',
    sort: 'employeeId',
    direction: 'asc',
    page: 1,
    pageSize: 25,
  });
  const [searchInput, setSearchInput] = useState('');
  const [rows, setRows] = useState<AdminEmployee[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [selected, setSelected] = useState<AdminEmployee | null>(null);
  const [drawer, setDrawer] = useState<DrawerKind>(null);
  const [pendingRowId, setPendingRowId] = useState<string | null>(null);
  const [temporaryPassword, setTemporaryPassword] = useState<TemporaryCredential>(null);
  const [pendingApprovals, setPendingApprovals] = useState<number | null>(null);
  // Guards against a slow count landing after the dialog closed or moved on.
  const pendingApprovalsRequest = useRef(0);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const next = searchInput.trim();
      setQuery((current) =>
        current.search === next ? current : { ...current, search: next, page: 1 },
      );
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    let active = true;
    const params: EmployeeListQuery = {
      status: query.status,
      sort: query.sort,
      direction: query.direction,
      page: query.page,
      pageSize: query.pageSize,
    };
    if (query.search) params.search = query.search;
    if (query.department) params.department = query.department;
    if (query.branchId) params.branchId = query.branchId;

    setLoading(true);
    setError(null);
    fetchEmployees(params)
      .then((page) => {
        if (!active) return;
        setRows(page.items.map(mapEmployee));
        setTotal(page.total);
        const pages = Math.max(1, Math.ceil(page.total / page.pageSize));
        if (query.page > pages) {
          setQuery((current) => ({ ...current, page: pages }));
        }
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setRows([]);
        setTotal(0);
        setError(
          cause instanceof Error
            ? cause.message
            : isArabic
              ? 'تعذر تحميل قائمة الموظفين.'
              : 'Unable to load the employee list.',
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [query, reloadToken, isArabic]);

  const refresh = useCallback(async () => {
    setReloadToken((token) => token + 1);
    try {
      await onChanged();
    } catch {
      // The shell surfaces portal load failures through its own banner.
    }
  }, [onChanged]);

  const updateQuery = (patch: Partial<QueryState>) => {
    setQuery((current) => ({ ...current, ...patch, page: 1 }));
  };

  const closeOverlay = () => {
    pendingApprovalsRequest.current += 1;
    setPendingApprovals(null);
    setDrawer(null);
    setSelected(null);
  };

  /**
   * Deactivation warns when the manager still owns approvals. The count is
   * advisory: a failed lookup leaves it unknown and never blocks the dialog.
   */
  const openStatusDialog = async (employee: AdminEmployee) => {
    const request = pendingApprovalsRequest.current + 1;
    pendingApprovalsRequest.current = request;
    setSelected(employee);
    setPendingApprovals(null);
    setDrawer('deactivate');
    if (employee.status === 'INACTIVE') return;

    try {
      const result = await getEmployeePendingApprovals(employee.id);
      if (request === pendingApprovalsRequest.current) {
        setPendingApprovals(result.pendingApprovals);
      }
    } catch {
      // The dialog still opens; the operator simply sees no count.
    }
  };

  const afterMutation = async () => {
    closeOverlay();
    await refresh();
  };

  const handleResetPassword = async (employee: AdminEmployee) => {
    setPendingRowId(employee.id);
    setActionError(null);
    try {
      const result = await resetEmployeePassword(employee.id);
      setTemporaryPassword({ name: employee.name, password: result.temporaryPassword });
      await refresh();
    } catch (cause) {
      setActionError(
        cause instanceof Error
          ? cause.message
          : isArabic
            ? 'تعذر إعادة تعيين كلمة المرور.'
            : 'Unable to reset the password.',
      );
    } finally {
      setPendingRowId(null);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / query.pageSize));
  const departments: string[] = [];
  rows.forEach((row) => {
    if (!departments.includes(row.department)) departments.push(row.department);
  });
  if (query.department && !departments.includes(query.department)) {
    departments.push(query.department);
  }
  departments.sort((left, right) => left.localeCompare(right));

  const isMutating = (employee: AdminEmployee) => pendingRowId === employee.id;

  const roleBadgeClass = (role: AdminEmployee['role']) =>
    role === 'SUPER_ADMIN'
      ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
      : role === 'HR_ADMIN'
        ? 'bg-teal-500/10 text-teal-600 dark:text-teal-400'
        : role === 'MANAGER'
          ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300';

  const statusBadgeClass = (employee: AdminEmployee) =>
    employee.status === 'ACTIVE'
      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
      : employee.status === 'REMOTE'
        ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20'
        : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20';

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
            {isArabic ? 'إدارة الموظفين ودورة الحياة' : 'Employee management'}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {isArabic
              ? 'بيانات حقيقية من الخادم مع ترقيم صفحات، تعديل الملف، وتغييرات التوظيف المسجلة.'
              : 'Server-paginated records with profile editing and audited lifecycle changes.'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setSelected(null);
            setDrawer('create');
          }}
          className="flex items-center gap-1.5 rounded-xl bg-macq-orange px-3.5 py-2 text-xs font-bold text-white shadow-md shadow-macq-orange/20 transition-all hover:bg-macq-orange/90"
        >
          <Plus size={16} />
          <span>{isArabic ? 'إضافة موظف' : 'Onboard employee'}</span>
        </button>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-macq-borderDark/60 dark:bg-macq-cardDark lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:w-72">
          <Search
            size={16}
            className="absolute left-3 rtl:right-3 rtl:left-auto top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="text"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder={
              isArabic ? 'ابحث بالاسم أو الرقم أو المسمى…' : 'Search name, ID, email or title…'
            }
            aria-label={isArabic ? 'البحث في الموظفين' : 'Search employees'}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-macq-orange/40 dark:border-slate-800 dark:bg-macq-surfaceDark dark:text-white rtl:pr-9 rtl:pl-3"
          />
        </div>

        <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 w-full lg:w-auto">
          <select
            value={query.department}
            onChange={(event) => updateQuery({ department: event.target.value })}
            aria-label={isArabic ? 'تصفية حسب القسم' : 'Filter by department'}
            className={SELECT_CLASS}
          >
            <option value="">{isArabic ? 'جميع الأقسام' : 'All departments'}</option>
            {departments.map((department) => (
              <option key={department} value={department}>
                {department}
              </option>
            ))}
          </select>

          <select
            value={query.branchId}
            onChange={(event) => updateQuery({ branchId: event.target.value })}
            aria-label={isArabic ? 'تصفية حسب الفرع' : 'Filter by branch'}
            className={SELECT_CLASS}
          >
            <option value="">{isArabic ? 'جميع الفروع' : 'All branches'}</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {isArabic ? branch.nameAr : branch.name}
              </option>
            ))}
          </select>

          <select
            value={query.status}
            onChange={(event) =>
              updateQuery({ status: event.target.value as QueryState['status'] })
            }
            aria-label={isArabic ? 'تصفية حسب الحالة' : 'Filter by status'}
            className={SELECT_CLASS}
          >
            <option value="ACTIVE">{isArabic ? 'النشطون' : 'Active'}</option>
            <option value="INACTIVE">{isArabic ? 'غير النشطين' : 'Inactive'}</option>
            <option value="ALL">{isArabic ? 'جميع الحالات' : 'All statuses'}</option>
          </select>

          <select
            value={query.sort}
            onChange={(event) =>
              updateQuery({ sort: event.target.value as QueryState['sort'] })
            }
            aria-label={isArabic ? 'ترتيب حسب' : 'Sort by'}
            className={SELECT_CLASS}
          >
            <option value="employeeId">{isArabic ? 'الرقم الوظيفي' : 'Employee ID'}</option>
            <option value="name">{isArabic ? 'الاسم' : 'Name'}</option>
            <option value="department">{isArabic ? 'القسم' : 'Department'}</option>
            <option value="status">{isArabic ? 'الحالة' : 'Status'}</option>
          </select>

          <select
            value={query.direction}
            onChange={(event) =>
              updateQuery({ direction: event.target.value as QueryState['direction'] })
            }
            aria-label={isArabic ? 'اتجاه الترتيب' : 'Sort direction'}
            className={SELECT_CLASS}
          >
            <option value="asc">{isArabic ? 'تصاعدي' : 'Ascending'}</option>
            <option value="desc">{isArabic ? 'تنازلي' : 'Descending'}</option>
          </select>

          <select
            value={query.pageSize}
            onChange={(event) => updateQuery({ pageSize: Number(event.target.value) })}
            aria-label={isArabic ? 'عدد الصفوف لكل صفحة' : 'Rows per page'}
            className={SELECT_CLASS}
          >
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size} / {isArabic ? 'صفحة' : 'page'}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-semibold text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setReloadToken((token) => token + 1)}
            className="flex items-center gap-1.5 rounded-lg border border-rose-300 px-2.5 py-1 text-[10px] font-bold transition-colors hover:bg-rose-100 dark:border-rose-500/40 dark:hover:bg-rose-500/20"
          >
            <RefreshCw size={12} />
            {isArabic ? 'إعادة المحاولة' : 'Retry'}
          </button>
        </div>
      )}

      {actionError && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-semibold text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
          <span>{actionError}</span>
          <button
            type="button"
            onClick={() => setActionError(null)}
            className="rounded-lg border border-rose-300 px-2.5 py-1 text-[10px] font-bold transition-colors hover:bg-rose-100 dark:border-rose-500/40 dark:hover:bg-rose-500/20"
          >
            {isArabic ? 'إخفاء' : 'Dismiss'}
          </button>
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm dark:border-macq-borderDark/60 dark:bg-macq-cardDark">
        {/* Mobile Responsive Employee Cards (< md) */}
        <div
          className={`md:hidden space-y-3 transition-opacity ${
            loading && rows.length > 0 ? 'opacity-60' : ''
          }`}
        >
          {loading &&
            rows.length === 0 &&
            Array.from({ length: 3 }).map((_, index) => (
              <div
                key={`mobile-emp-skel-${index}`}
                className="h-28 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse"
              />
            ))}

          {!loading && !error && rows.length === 0 && (
            <div className="py-10 text-center">
              <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                {isArabic ? 'لا يوجد موظفون مطابقون' : 'No employees match these filters'}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {isArabic
                  ? 'جرّب مسح البحث أو تغيير الحالة.'
                  : 'Try clearing the search or changing the status filter.'}
              </p>
            </div>
          )}

          {rows.map((employee) => (
            <div
              key={`mobile-emp-${employee.id}`}
              className="p-4 rounded-xl bg-slate-50 dark:bg-macq-surfaceDark/60 border border-slate-200/70 dark:border-slate-800 space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                    {employee.name}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    {employee.employeeId} • {employee.email}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {employee.jobTitle} ({employee.department})
                  </p>
                </div>
                <span
                  className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold flex-shrink-0 ${statusBadgeClass(
                    employee,
                  )}`}
                >
                  {employeeStatusLabel(employee, isArabic)}
                </span>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span
                    className={`inline-block rounded px-2 py-0.5 text-[10px] font-bold ${roleBadgeClass(
                      employee.role,
                    )}`}
                  >
                    {employee.role}
                  </span>
                  <span className="text-slate-500 dark:text-slate-400">
                    {employee.branchName}
                  </span>
                </div>
                <span className="font-bold text-slate-900 dark:text-white">
                  {employee.netSalarySar.toLocaleString()} SAR
                </span>
              </div>

              <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800 flex items-center justify-end gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setSelected(employee);
                    setDrawer('edit');
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-700 dark:text-slate-200"
                >
                  <Pencil size={13} />
                  <span>{isArabic ? 'تعديل' : 'Edit'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelected(employee);
                    setDrawer('change');
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-700 dark:text-slate-200"
                >
                  <ArrowRightLeft size={13} />
                  <span>{isArabic ? 'التوظيف' : 'Change'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => void handleResetPassword(employee)}
                  disabled={isMutating(employee)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-700 dark:text-slate-200 disabled:opacity-50"
                >
                  <KeyRound size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => void openStatusDialog(employee)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-[11px] font-bold ${
                    employee.status === 'INACTIVE'
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                      : 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {employee.status === 'INACTIVE' ? (
                    <UserCheck size={13} />
                  ) : (
                    <UserX size={13} />
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop Structured Table (md+) */}
        <div
          className={`hidden md:block overflow-x-auto transition-opacity ${
            loading && rows.length > 0 ? 'opacity-60' : ''
          }`}
        >
          <table className="w-full min-w-[960px] border-collapse text-left text-xs rtl:text-right">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 font-bold uppercase tracking-wider text-slate-500 dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-400">
                <th className="px-4 py-3.5">{isArabic ? 'الموظف' : 'Employee'}</th>
                <th className="px-4 py-3.5">{isArabic ? 'القسم' : 'Department'}</th>
                <th className="px-4 py-3.5">{isArabic ? 'الفرع' : 'Branch'}</th>
                <th className="px-4 py-3.5">{isArabic ? 'الصلاحية' : 'Role'}</th>
                <th className="px-4 py-3.5">{isArabic ? 'الحالة' : 'Status'}</th>
                <th className="px-4 py-3.5">{isArabic ? 'عن بُعد' : 'Remote'}</th>
                <th className="px-4 py-3.5">{isArabic ? 'الصافي (ر.س)' : 'Net (SAR)'}</th>
                <th className="px-4 py-3.5 text-right rtl:text-left">
                  {isArabic ? 'إجراءات' : 'Actions'}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800 dark:divide-zinc-800/60 dark:text-zinc-300">
              {loading && rows.length === 0 &&
                Array.from({ length: 5 }).map((_, index) => (
                  <tr key={`skeleton-${index}`} className="animate-pulse">
                    <td className="px-4 py-4" colSpan={8}>
                      <div className="h-3 w-full rounded bg-slate-100 dark:bg-slate-800" />
                    </td>
                  </tr>
                ))}

              {!loading && !error && rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center">
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                      {isArabic ? 'لا يوجد موظفون مطابقون' : 'No employees match these filters'}
                    </p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {isArabic
                        ? 'جرّب مسح البحث أو تغيير الحالة.'
                        : 'Try clearing the search or changing the status filter.'}
                    </p>
                  </td>
                </tr>
              )}

              {rows.map((employee) => (
                <tr
                  key={employee.id}
                  className="transition-colors hover:bg-slate-50/80 dark:hover:bg-zinc-800/40"
                >
                  <td className="px-4 py-3.5">
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-900 dark:text-white">
                        {employee.name}
                      </span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400">
                        {employee.employeeId} • {employee.email}
                      </span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500">
                        {employee.jobTitle}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 font-medium text-slate-700 dark:text-slate-300">
                    {employee.department}
                  </td>
                  <td className="px-4 py-3.5 text-slate-600 dark:text-slate-400">
                    {employee.branchName}
                  </td>
                  <td className="px-4 py-3.5">
                    <span
                      className={`inline-block rounded px-2 py-0.5 text-[10px] font-bold ${roleBadgeClass(
                        employee.role,
                      )}`}
                    >
                      {employee.role}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${statusBadgeClass(
                        employee,
                      )}`}
                    >
                      {employeeStatusLabel(employee, isArabic)}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span
                      className={`inline-block rounded px-2 py-0.5 text-[10px] font-bold ${
                        employee.isRemoteAllowed
                          ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400'
                          : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                      }`}
                    >
                      {employee.isRemoteAllowed
                        ? isArabic
                          ? 'مسموح'
                          : 'Allowed'
                        : isArabic
                          ? 'غير مسموح'
                          : 'Not allowed'}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="block font-bold text-slate-900 dark:text-white">
                      {employee.netSalarySar.toLocaleString()}
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">
                      {isArabic ? 'أساسي' : 'Basic'} {employee.basicSalarySar.toLocaleString()}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center justify-end gap-1 rtl:justify-start">
                      <button
                        type="button"
                        onClick={() => {
                          setSelected(employee);
                          setDrawer('edit');
                        }}
                        aria-label={
                          isArabic ? `تعديل ملف ${employee.name}` : `Edit ${employee.name}'s profile`
                        }
                        title={isArabic ? 'تعديل الملف' : 'Edit profile'}
                        className={ROW_ACTION_CLASS}
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSelected(employee);
                          setDrawer('change');
                        }}
                        aria-label={
                          isArabic
                            ? `تغيير توظيف ${employee.name}`
                            : `Employment change for ${employee.name}`
                        }
                        title={isArabic ? 'تغيير التوظيف' : 'Employment change'}
                        className={ROW_ACTION_CLASS}
                      >
                        <ArrowRightLeft size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleResetPassword(employee)}
                        disabled={isMutating(employee)}
                        aria-label={
                          isArabic
                            ? `إعادة تعيين كلمة مرور ${employee.name}`
                            : `Reset password for ${employee.name}`
                        }
                        title={isArabic ? 'إعادة تعيين كلمة المرور' : 'Reset password'}
                        className={ROW_ACTION_CLASS}
                      >
                        <KeyRound size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => void openStatusDialog(employee)}
                        aria-label={
                          employee.status === 'INACTIVE'
                            ? isArabic
                              ? `إعادة تنشيط ${employee.name}`
                              : `Reactivate ${employee.name}`
                            : isArabic
                              ? `إلغاء تنشيط ${employee.name}`
                              : `Deactivate ${employee.name}`
                        }
                        title={
                          employee.status === 'INACTIVE'
                            ? isArabic
                              ? 'إعادة التنشيط'
                              : 'Reactivate'
                            : isArabic
                              ? 'إلغاء التنشيط'
                              : 'Deactivate'
                        }
                        className={`${ROW_ACTION_CLASS} ${
                          employee.status === 'INACTIVE'
                            ? 'hover:text-emerald-600 dark:hover:text-emerald-400'
                            : 'hover:text-rose-600 dark:hover:text-rose-400'
                        }`}
                      >
                        {employee.status === 'INACTIVE' ? (
                          <UserCheck size={15} />
                        ) : (
                          <UserX size={15} />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex flex-col items-center justify-between gap-3 border-t border-slate-100 pt-4 text-xs text-slate-500 dark:border-zinc-800/60 dark:text-slate-400 sm:flex-row">
          <span>
            {isArabic
              ? `${total} موظف • الصفحة ${query.page} من ${totalPages}`
              : `${total} employees • Page ${query.page} of ${totalPages}`}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setQuery((current) => ({ ...current, page: current.page - 1 }))}
              disabled={loading || query.page <= 1}
              className="flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-1.5 text-[11px] font-bold text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-macq-borderDark/60 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <ChevronLeft size={14} className="rtl:rotate-180" />
              {isArabic ? 'السابق' : 'Previous'}
            </button>
            <button
              type="button"
              onClick={() => setQuery((current) => ({ ...current, page: current.page + 1 }))}
              disabled={loading || query.page >= totalPages}
              className="flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-1.5 text-[11px] font-bold text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-macq-borderDark/60 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              {isArabic ? 'التالي' : 'Next'}
              <ChevronRight size={14} className="rtl:rotate-180" />
            </button>
          </div>
        </div>
      </div>

      {drawer === 'create' && (
        <EmployeeFormDrawer
          mode="create"
          branches={branches}
          managers={managers}
          isArabic={isArabic}
          onClose={closeOverlay}
          onSaved={async (password, name) => {
            closeOverlay();
            if (password) {
              setTemporaryPassword({ name: name ?? 'New employee', password });
            }
            await refresh();
          }}
        />
      )}

      {drawer === 'edit' && selected && (
        <EmployeeFormDrawer
          mode="edit"
          employee={selected}
          branches={branches}
          managers={managers}
          isArabic={isArabic}
          onClose={closeOverlay}
          onSaved={afterMutation}
        />
      )}

      {drawer === 'change' && selected && (
        <EmploymentChangeDrawer
          employee={selected}
          branches={branches}
          managers={managers}
          isArabic={isArabic}
          onClose={closeOverlay}
          onApplied={afterMutation}
        />
      )}

      {drawer === 'deactivate' && selected && (
        <DeactivateEmployeeDialog
          employee={selected}
          pendingApprovals={pendingApprovals}
          isArabic={isArabic}
          onClose={closeOverlay}
          onDone={afterMutation}
        />
      )}

      {temporaryPassword && (
        <TemporaryPasswordModal
          password={temporaryPassword.password}
          employeeName={temporaryPassword.name}
          isArabic={isArabic}
          onClose={() => setTemporaryPassword(null)}
        />
      )}
    </div>
  );
};
