import React, { useState } from 'react';
import { X } from 'lucide-react';
import type { AdminBranch, AdminEmployee } from '../data/mockAdminData';
import { applyEmploymentChange } from '../api/employeesApi';
import { getStoredAdminSession } from '../api/adminSession';

type ChangeType =
  | 'TRANSFER'
  | 'PROMOTION'
  | 'SALARY'
  | 'ROLE'
  | 'MANAGER'
  | 'REMOTE_ELIGIBILITY';

interface EmploymentChangeDrawerProps {
  employee: AdminEmployee;
  branches: AdminBranch[];
  managers: AdminEmployee[];
  isArabic: boolean;
  onClose: () => void;
  onApplied: () => Promise<void> | void;
}

const FIELD_CLASS =
  'w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-macq-surfaceDark border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-macq-orange/40 disabled:opacity-60';

const LABEL_CLASS = 'block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1';

const NO_MANAGER = '__none__';

const CHANGE_TYPES: ChangeType[] = [
  'TRANSFER',
  'PROMOTION',
  'SALARY',
  'ROLE',
  'MANAGER',
  'REMOTE_ELIGIBILITY',
];

function localToday(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

function typeLabel(type: ChangeType, isArabic: boolean): string {
  const labels: Record<ChangeType, { en: string; ar: string }> = {
    TRANSFER: { en: 'Branch transfer', ar: 'نقل بين الفروع' },
    PROMOTION: { en: 'Promotion', ar: 'ترقية' },
    SALARY: { en: 'Salary adjustment', ar: 'تعديل الراتب' },
    ROLE: { en: 'Role change', ar: 'تغيير الصلاحية' },
    MANAGER: { en: 'Reporting manager', ar: 'تغيير المدير' },
    REMOTE_ELIGIBILITY: { en: 'Remote eligibility', ar: 'أهلية العمل عن بُعد' },
  };
  return isArabic ? labels[type].ar : labels[type].en;
}

export const EmploymentChangeDrawer: React.FC<EmploymentChangeDrawerProps> = ({
  employee,
  branches,
  managers,
  isArabic,
  onClose,
  onApplied,
}) => {
  const storedRole = getStoredAdminSession()?.user.role;
  // A non-SUPER_ADMIN actor must not be able to touch a SUPER_ADMIN target's role: the
  // server only refuses to remove the last active one, so a mid-tier demotion succeeds.
  const canChangeTargetRole = !(
    employee.role === 'SUPER_ADMIN' && storedRole !== 'SUPER_ADMIN'
  );
  const changeTypes: ChangeType[] = canChangeTargetRole
    ? CHANGE_TYPES
    : CHANGE_TYPES.filter((option) => option !== 'ROLE');

  const [type, setType] = useState<ChangeType>('TRANSFER');
  const [effectiveDate, setEffectiveDate] = useState(localToday());
  const [reason, setReason] = useState('');
  const [branchId, setBranchId] = useState(employee.branchId ?? '');
  const [jobTitle, setJobTitle] = useState(employee.jobTitle);
  const [basicSalarySar, setBasicSalarySar] = useState(String(employee.basicSalarySar));
  const [housingAllowanceSar, setHousingAllowanceSar] = useState(
    String(employee.housingAllowanceSar),
  );
  const [transportAllowanceSar, setTransportAllowanceSar] = useState(
    String(employee.transportAllowanceSar),
  );
  const [role, setRole] = useState<AdminEmployee['role']>(employee.role);
  const [managerId, setManagerId] = useState(employee.managerId ?? NO_MANAGER);
  const [isRemoteAllowed, setIsRemoteAllowed] = useState(employee.isRemoteAllowed ?? false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const today = localToday();
  const canAssignSuperAdmin = storedRole === 'SUPER_ADMIN';
  const roleOptions: AdminEmployee['role'][] = canAssignSuperAdmin
    ? ['EMPLOYEE', 'MANAGER', 'HR_ADMIN', 'SUPER_ADMIN']
    : ['EMPLOYEE', 'MANAGER', 'HR_ADMIN'];

  const validate = (): Record<string, string> => {
    const errors: Record<string, string> = {};
    const trimmedReason = reason.trim();
    if (trimmedReason.length < 3 || trimmedReason.length > 300) {
      errors.reason = isArabic
        ? 'السبب مطلوب بين 3 و300 حرف.'
        : 'Reason must be between 3 and 300 characters.';
    }
    if (!effectiveDate) {
      errors.effectiveDate = isArabic ? 'تاريخ السريان مطلوب.' : 'An effective date is required.';
    } else if (effectiveDate > today) {
      errors.effectiveDate = isArabic
        ? 'لا يمكن أن يكون تاريخ السريان في المستقبل.'
        : 'The effective date cannot be in the future.';
    }
    if (type === 'TRANSFER' && !branchId) {
      errors.branchId = isArabic ? 'اختر الفرع الجديد.' : 'Select the destination branch.';
    }
    if (type === 'PROMOTION' && (jobTitle.trim().length < 2 || jobTitle.trim().length > 120)) {
      errors.jobTitle = isArabic
        ? 'المسمى الوظيفي مطلوب بين 2 و120 حرف.'
        : 'Job title must be between 2 and 120 characters.';
    }
    if (type === 'SALARY') {
      const amounts = [basicSalarySar, housingAllowanceSar, transportAllowanceSar];
      if (amounts.some((amount) => amount.trim() === '' || Number(amount) < 0 || Number.isNaN(Number(amount)))) {
        errors.salary = isArabic
          ? 'يجب أن تكون جميع مبالغ الراتب صفراً أو أكثر.'
          : 'All salary amounts must be zero or more.';
      }
    }
    return errors;
  };

  const buildPayload = (): Record<string, unknown> => {
    const base = { type, effectiveDate, reason: reason.trim() };
    switch (type) {
      case 'TRANSFER':
        return { ...base, branchId };
      case 'PROMOTION':
        return { ...base, jobTitle: jobTitle.trim() };
      case 'SALARY':
        return {
          ...base,
          basicSalarySar: Number(basicSalarySar),
          housingAllowanceSar: Number(housingAllowanceSar),
          transportAllowanceSar: Number(transportAllowanceSar),
        };
      case 'ROLE':
        return { ...base, role };
      case 'MANAGER':
        return { ...base, managerId: managerId === NO_MANAGER ? null : managerId };
      case 'REMOTE_ELIGIBILITY':
        return { ...base, isRemoteAllowed };
      default:
        return base;
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setPending(true);
    setSubmitError(null);
    try {
      await applyEmploymentChange(employee.id, buildPayload());
      await onApplied();
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : isArabic
            ? 'تعذر تطبيق التغيير.'
            : 'Unable to apply the change.',
      );
    } finally {
      setPending(false);
    }
  };

  const inputError = (key: string) =>
    fieldErrors[key] ? (
      <p className="mt-1 text-[10px] font-semibold text-rose-600 dark:text-rose-400">
        {fieldErrors[key]}
      </p>
    ) : null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-label={isArabic ? 'تغيير بيانات التوظيف' : 'Employment change'}
    >
      <div className="h-full w-full max-w-lg overflow-y-auto bg-white dark:bg-macq-cardDark border-s border-slate-200 dark:border-macq-borderDark/60 shadow-2xl">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 dark:border-macq-borderDark/60 bg-white/95 dark:bg-macq-cardDark/95 px-4 sm:px-6 py-4 backdrop-blur">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-macq-orange" />
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                {isArabic ? 'تغيير بيانات التوظيف' : 'Employment change'}
              </h3>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {employee.name} • {employee.employeeId}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={isArabic ? 'إغلاق لوحة التغيير' : 'Close change panel'}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-800 dark:hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4 px-4 sm:px-6 py-5">
          <div>
            <label htmlFor="change-type" className={LABEL_CLASS}>
              {isArabic ? 'نوع التغيير' : 'Change type'}
            </label>
            <select
              id="change-type"
              value={type}
              onChange={(event) => {
                const nextType = event.target.value as ChangeType;
                if (nextType === 'ROLE' && !canChangeTargetRole) return;
                setType(nextType);
                setFieldErrors({});
              }}
              className={FIELD_CLASS}
            >
              {changeTypes.map((option) => (
                <option key={option} value={option}>
                  {typeLabel(option, isArabic)}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="change-date" className={LABEL_CLASS}>
                {isArabic ? 'تاريخ السريان' : 'Effective date'}
              </label>
              <input
                id="change-date"
                type="date"
                value={effectiveDate}
                max={today}
                onChange={(event) => setEffectiveDate(event.target.value)}
                className={FIELD_CLASS}
              />
              {inputError('effectiveDate')}
            </div>
            <div>
              <label htmlFor="change-reason" className={LABEL_CLASS}>
                {isArabic ? 'السبب' : 'Reason'}
              </label>
              <textarea
                id="change-reason"
                value={reason}
                rows={2}
                maxLength={300}
                onChange={(event) => setReason(event.target.value)}
                className={FIELD_CLASS}
                placeholder={
                  isArabic ? 'اذكر سبب التغيير (3–300 حرف)' : 'Record why this change is happening (3–300 characters)'
                }
              />
              <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">
                {reason.trim().length}/300
              </p>
              {inputError('reason')}
            </div>
          </div>

          {type === 'TRANSFER' && (
            <div>
              <label htmlFor="change-branch" className={LABEL_CLASS}>
                {isArabic ? 'الفرع الجديد' : 'Destination branch'}
              </label>
              <select
                id="change-branch"
                value={branchId}
                onChange={(event) => setBranchId(event.target.value)}
                className={FIELD_CLASS}
              >
                <option value="">{isArabic ? 'اختر الفرع' : 'Select a branch'}</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {isArabic ? branch.nameAr : branch.name}
                  </option>
                ))}
              </select>
              {inputError('branchId')}
            </div>
          )}

          {type === 'PROMOTION' && (
            <div>
              <label htmlFor="change-title" className={LABEL_CLASS}>
                {isArabic ? 'المسمى الوظيفي الجديد' : 'New job title'}
              </label>
              <input
                id="change-title"
                type="text"
                value={jobTitle}
                maxLength={120}
                onChange={(event) => setJobTitle(event.target.value)}
                className={FIELD_CLASS}
              />
              {inputError('jobTitle')}
            </div>
          )}

          {type === 'SALARY' && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label htmlFor="change-basic" className={LABEL_CLASS}>
                  {isArabic ? 'الأساسي' : 'Basic (SAR)'}
                </label>
                <input
                  id="change-basic"
                  type="number"
                  min={0}
                  step="0.01"
                  value={basicSalarySar}
                  onChange={(event) => setBasicSalarySar(event.target.value)}
                  className={FIELD_CLASS}
                />
              </div>
              <div>
                <label htmlFor="change-housing" className={LABEL_CLASS}>
                  {isArabic ? 'السكن' : 'Housing (SAR)'}
                </label>
                <input
                  id="change-housing"
                  type="number"
                  min={0}
                  step="0.01"
                  value={housingAllowanceSar}
                  onChange={(event) => setHousingAllowanceSar(event.target.value)}
                  className={FIELD_CLASS}
                />
              </div>
              <div>
                <label htmlFor="change-transport" className={LABEL_CLASS}>
                  {isArabic ? 'النقل' : 'Transport (SAR)'}
                </label>
                <input
                  id="change-transport"
                  type="number"
                  min={0}
                  step="0.01"
                  value={transportAllowanceSar}
                  onChange={(event) => setTransportAllowanceSar(event.target.value)}
                  className={FIELD_CLASS}
                />
              </div>
              {inputError('salary')}
            </div>
          )}

          {type === 'ROLE' && (
            <div>
              <label htmlFor="change-role" className={LABEL_CLASS}>
                {isArabic ? 'الصلاحية الجديدة' : 'New role'}
              </label>
              <select
                id="change-role"
                value={role}
                onChange={(event) => setRole(event.target.value as AdminEmployee['role'])}
                className={FIELD_CLASS}
              >
                {!roleOptions.includes(role) && (
                  <option value={role} disabled>
                    {role}
                  </option>
                )}
                {roleOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
          )}

          {type === 'MANAGER' && (
            <div>
              <label htmlFor="change-manager" className={LABEL_CLASS}>
                {isArabic ? 'المدير المباشر' : 'Reporting manager'}
              </label>
              <select
                id="change-manager"
                value={managerId}
                onChange={(event) => setManagerId(event.target.value)}
                className={FIELD_CLASS}
              >
                <option value={NO_MANAGER}>{isArabic ? 'بدون مدير' : 'No manager'}</option>
                {managers
                  .filter((manager) => manager.id !== employee.id)
                  .map((manager) => (
                    <option key={manager.id} value={manager.id}>
                      {manager.name}
                    </option>
                  ))}
              </select>
            </div>
          )}

          {type === 'REMOTE_ELIGIBILITY' && (
            <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-xs font-semibold text-slate-700 dark:border-macq-borderDark/60 dark:text-slate-300">
              <input
                type="checkbox"
                checked={isRemoteAllowed}
                onChange={(event) => setIsRemoteAllowed(event.target.checked)}
                className="h-4 w-4 rounded border-slate-300 accent-macq-orange"
              />
              {isArabic ? 'السماح بالعمل عن بُعد' : 'Allow remote work'}
            </label>
          )}

          {submitError && (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
              {submitError}
            </p>
          )}

          <div className="flex items-center justify-end gap-2 border-t border-slate-200 dark:border-macq-borderDark/60 pt-4">
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
              className="rounded-xl bg-macq-orange px-4 py-2 text-xs font-bold text-white shadow-md shadow-macq-orange/20 transition-all hover:bg-macq-orange/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending
                ? isArabic
                  ? 'جارٍ التطبيق…'
                  : 'Applying…'
                : isArabic
                  ? 'تطبيق التغيير'
                  : 'Apply change'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
