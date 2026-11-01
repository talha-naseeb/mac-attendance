import React, { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import type { AdminEmployee } from '../data/mockAdminData';
import { deactivateEmployee, reactivateEmployee } from '../api/employeesApi';

interface DeactivateEmployeeDialogProps {
  employee: AdminEmployee;
  isArabic: boolean;
  onClose: () => void;
  onDone: () => Promise<void> | void;
}

export const DeactivateEmployeeDialog: React.FC<DeactivateEmployeeDialogProps> = ({
  employee,
  isArabic,
  onClose,
  onDone,
}) => {
  const isDeactivation = employee.status !== 'INACTIVE';
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const title = isDeactivation
    ? isArabic
      ? 'إلغاء تنشيط الموظف'
      : 'Deactivate employee'
    : isArabic
      ? 'إعادة تنشيط الموظف'
      : 'Reactivate employee';

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = reason.trim();
    if (trimmed.length < 3 || trimmed.length > 300) {
      setReasonError(
        isArabic
          ? 'السبب مطلوب بين 3 و300 حرف.'
          : 'Reason must be between 3 and 300 characters.',
      );
      return;
    }
    setReasonError(null);
    setPending(true);
    setSubmitError(null);
    try {
      if (isDeactivation) {
        await deactivateEmployee(employee.id, trimmed);
      } else {
        await reactivateEmployee(employee.id, trimmed);
      }
      await onDone();
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : isArabic
            ? 'تعذر تحديث حالة الموظف.'
            : 'Unable to update the employee status.',
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-macq-borderDark/60 dark:bg-macq-cardDark">
        <button
          type="button"
          onClick={onClose}
          aria-label={isArabic ? 'إغلاق مربع الحوار' : 'Close dialog'}
          className="absolute end-4 top-4 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-800 dark:hover:text-white"
        >
          <X size={18} />
        </button>

        <div className="mb-1 flex items-center gap-2">
          <AlertTriangle
            size={18}
            className={isDeactivation ? 'text-rose-500' : 'text-emerald-500'}
          />
          <h3 className="text-base font-extrabold text-slate-900 dark:text-white">{title}</h3>
        </div>
        <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
          {employee.name} • {employee.employeeId}
        </p>

        <div
          className={`mb-4 rounded-xl border px-3 py-2 text-[11px] font-semibold leading-relaxed ${
            isDeactivation
              ? 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300'
              : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300'
          }`}
        >
          {isDeactivation
            ? isArabic
              ? 'سيتم إلغاء جميع طلبات الإجازة المعلّقة وإنهاء جلسات الموظف النشطة. سيفقد الموظف الوصول فوراً.'
              : 'All pending leave requests will be cancelled and active sessions revoked. The employee loses access immediately.'
            : isArabic
              ? 'سيستعيد الموظف إمكانية تسجيل الدخول. لن تُستعاد طلبات الإجازة الملغاة.'
              : 'The employee regains sign-in access. Previously cancelled leave requests are not restored.'}
        </div>

        <form onSubmit={(event) => void handleSubmit(event)} className="space-y-3">
          <div>
            <label
              htmlFor="status-reason"
              className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300"
            >
              {isArabic ? 'السبب' : 'Reason'}
            </label>
            <textarea
              id="status-reason"
              value={reason}
              rows={3}
              maxLength={300}
              onChange={(event) => setReason(event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-macq-orange/40 dark:border-slate-800 dark:bg-macq-surfaceDark dark:text-white"
              placeholder={
                isArabic ? 'اذكر سبب الإجراء (3–300 حرف)' : 'Record the reason (3–300 characters)'
              }
            />
            <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">
              {reason.trim().length}/300
            </p>
            {reasonError && (
              <p className="mt-1 text-[10px] font-semibold text-rose-600 dark:text-rose-400">
                {reasonError}
              </p>
            )}
          </div>

          {submitError && (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
              {submitError}
            </p>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={pending}
              className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-100 disabled:opacity-60 dark:border-macq-borderDark/60 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              {isArabic ? 'إلغاء' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={pending}
              className={`rounded-xl px-4 py-2 text-xs font-bold text-white shadow-md transition-all disabled:cursor-not-allowed disabled:opacity-60 ${
                isDeactivation
                  ? 'bg-rose-600 shadow-rose-600/20 hover:bg-rose-500'
                  : 'bg-emerald-600 shadow-emerald-600/20 hover:bg-emerald-500'
              }`}
            >
              {pending
                ? isArabic
                  ? 'جارٍ التنفيذ…'
                  : 'Working…'
                : isDeactivation
                  ? isArabic
                    ? 'تأكيد إلغاء التنشيط'
                    : 'Confirm deactivation'
                  : isArabic
                    ? 'تأكيد إعادة التنشيط'
                    : 'Confirm reactivation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
