import React, { useState } from 'react';
import { X } from 'lucide-react';
import type { AdminBranch, AdminEmployee } from '../data/mockAdminData';
import type { EmployeeDraft } from '../services/employeeForm';
import { toCreateEmployeePayload, validateEmployeeDraft } from '../services/employeeForm';
import { createEmployee, updateEmployee } from '../api/employeesApi';
import { getStoredAdminSession } from '../api/adminSession';

interface EmployeeFormDrawerProps {
  mode: 'create' | 'edit';
  employee?: AdminEmployee;
  branches: AdminBranch[];
  managers: AdminEmployee[];
  isArabic: boolean;
  onClose: () => void;
  onSaved: (temporaryPassword?: string, employeeName?: string) => Promise<void> | void;
}

const FIELD_CLASS =
  'w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-macq-surfaceDark border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-macq-orange/40 disabled:opacity-60 disabled:cursor-not-allowed';

const LABEL_CLASS = 'block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1';

// `validateEmployeeDraft` returns English copy (pinned by its tests); translate at render.
const ARABIC_VALIDATION_MESSAGES: Record<string, string> = {
  employeeId: 'معرّف الموظف مطلوب.',
  email: 'أدخل بريد عمل صالحًا.',
  firstName: 'الاسم الأول مطلوب.',
  lastName: 'اسم العائلة مطلوب.',
  department: 'القسم مطلوب.',
  jobTitle: 'المسمى الوظيفي مطلوب.',
  basicSalarySar: 'يجب أن يكون الراتب الأساسي صفرًا أو أكثر.',
};

function seedDraft(employee?: AdminEmployee): EmployeeDraft {
  if (!employee) {
    return {
      employeeId: '',
      email: '',
      firstName: '',
      lastName: '',
      department: '',
      jobTitle: '',
      role: 'EMPLOYEE',
      isSaudi: true,
      basicSalarySar: '',
      housingAllowanceSar: '0',
      transportAllowanceSar: '0',
      branchId: '',
      managerId: '',
    };
  }
  const [firstName, ...rest] = employee.name.trim().split(/\s+/);
  return {
    employeeId: employee.employeeId,
    email: employee.email,
    firstName: firstName || '',
    lastName: rest.join(' '),
    department: employee.department,
    jobTitle: employee.jobTitle,
    role: employee.role,
    isSaudi: employee.isSaudi,
    basicSalarySar: String(employee.basicSalarySar),
    housingAllowanceSar: String(employee.housingAllowanceSar),
    transportAllowanceSar: String(employee.transportAllowanceSar),
    branchId: employee.branchId ?? '',
    managerId: employee.managerId ?? '',
  };
}

export const EmployeeFormDrawer: React.FC<EmployeeFormDrawerProps> = ({
  mode,
  employee,
  branches,
  managers,
  isArabic,
  onClose,
  onSaved,
}) => {
  const [draft, setDraft] = useState<EmployeeDraft>(() => seedDraft(employee));
  const [isRemoteAllowed, setIsRemoteAllowed] = useState(
    employee?.isRemoteAllowed ?? false,
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const isEdit = mode === 'edit';

  const canAssignSuperAdmin =
    getStoredAdminSession()?.user.role === 'SUPER_ADMIN';
  const roleOptions: EmployeeDraft['role'][] = canAssignSuperAdmin
    ? ['EMPLOYEE', 'MANAGER', 'HR_ADMIN', 'SUPER_ADMIN']
    : ['EMPLOYEE', 'MANAGER', 'HR_ADMIN'];

  const setField = <K extends keyof EmployeeDraft>(key: K, value: EmployeeDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const nextErrors = validateEmployeeDraft(draft);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setPending(true);
    setFormError(null);
    try {
      if (isEdit && employee) {
        await updateEmployee(employee.id, {
          firstName: draft.firstName.trim(),
          lastName: draft.lastName.trim(),
          jobTitle: draft.jobTitle.trim(),
          department: draft.department.trim(),
        });
        await onSaved();
      } else {
        const payload = {
          ...toCreateEmployeePayload(draft),
          ...(isRemoteAllowed ? { isRemoteAllowed: true } : {}),
        };
        const result = await createEmployee(payload);
        const createdName = `${result.employee.firstName} ${result.employee.lastName}`.trim();
        await onSaved(result.temporaryPassword, createdName || undefined);
      }
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : isArabic
            ? 'تعذر حفظ بيانات الموظف.'
            : 'Unable to save the employee.',
      );
    } finally {
      setPending(false);
    }
  };

  const fieldError = (key: keyof EmployeeDraft) => {
    const message = errors[key];
    if (!message) return null;
    const localized = isArabic ? ARABIC_VALIDATION_MESSAGES[key] ?? message : message;
    return (
      <p className="mt-1 text-[10px] font-semibold text-rose-600 dark:text-rose-400">
        {localized}
      </p>
    );
  };

  const title = isEdit
    ? isArabic
      ? 'تعديل ملف الموظف'
      : 'Edit employee profile'
    : isArabic
      ? 'إضافة موظف جديد'
      : 'Onboard new employee';
  const subtitle = isEdit
    ? isArabic
      ? 'يتم إرسال الاسم والمسمى الوظيفي والقسم فقط. استخدم تغيير التوظيف للفرع أو الراتب أو الصلاحية.'
      : 'Only name, job title and department are sent. Use Employment change for branch, salary or role.'
    : isArabic
      ? 'سيتم إنشاء كلمة مرور مؤقتة تُعرض مرة واحدة.'
      : 'A temporary password will be issued and shown once.';

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="h-full w-full max-w-xl overflow-y-auto bg-white dark:bg-macq-cardDark border-s border-slate-200 dark:border-macq-borderDark/60 shadow-2xl">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 dark:border-macq-borderDark/60 bg-white/95 dark:bg-macq-cardDark/95 px-4 sm:px-6 py-4 backdrop-blur">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-macq-orange" />
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                {title}
              </h3>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={isArabic ? 'إغلاق النموذج' : 'Close form'}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-800 dark:hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4 px-4 sm:px-6 py-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="emp-id" className={LABEL_CLASS}>
                {isArabic ? 'الرقم الوظيفي' : 'Employee ID'}
              </label>
              <input
                id="emp-id"
                type="text"
                value={draft.employeeId}
                disabled={isEdit}
                onChange={(event) => setField('employeeId', event.target.value)}
                className={FIELD_CLASS}
                placeholder="EMP-006"
              />
              {fieldError('employeeId')}
            </div>
            <div>
              <label htmlFor="emp-email" className={LABEL_CLASS}>
                {isArabic ? 'البريد الإلكتروني للعمل' : 'Work email'}
              </label>
              <input
                id="emp-email"
                type="email"
                value={draft.email}
                disabled={isEdit}
                onChange={(event) => setField('email', event.target.value)}
                className={FIELD_CLASS}
                placeholder="name@macqhr.sa"
              />
              {fieldError('email')}
            </div>
            <div>
              <label htmlFor="emp-first" className={LABEL_CLASS}>
                {isArabic ? 'الاسم الأول' : 'First name'}
              </label>
              <input
                id="emp-first"
                type="text"
                value={draft.firstName}
                onChange={(event) => setField('firstName', event.target.value)}
                className={FIELD_CLASS}
              />
              {fieldError('firstName')}
            </div>
            <div>
              <label htmlFor="emp-last" className={LABEL_CLASS}>
                {isArabic ? 'اسم العائلة' : 'Last name'}
              </label>
              <input
                id="emp-last"
                type="text"
                value={draft.lastName}
                onChange={(event) => setField('lastName', event.target.value)}
                className={FIELD_CLASS}
              />
              {fieldError('lastName')}
            </div>
            <div>
              <label htmlFor="emp-department" className={LABEL_CLASS}>
                {isArabic ? 'القسم' : 'Department'}
              </label>
              <input
                id="emp-department"
                type="text"
                value={draft.department}
                onChange={(event) => setField('department', event.target.value)}
                className={FIELD_CLASS}
              />
              {fieldError('department')}
            </div>
            <div>
              <label htmlFor="emp-title" className={LABEL_CLASS}>
                {isArabic ? 'المسمى الوظيفي' : 'Job title'}
              </label>
              <input
                id="emp-title"
                type="text"
                value={draft.jobTitle}
                onChange={(event) => setField('jobTitle', event.target.value)}
                className={FIELD_CLASS}
              />
              {fieldError('jobTitle')}
            </div>
            <div>
              <label htmlFor="emp-role" className={LABEL_CLASS}>
                {isArabic ? 'الصلاحية' : 'Role'}
              </label>
              <select
                id="emp-role"
                value={draft.role}
                disabled={isEdit}
                onChange={(event) => setField('role', event.target.value as EmployeeDraft['role'])}
                className={FIELD_CLASS}
              >
                {!roleOptions.includes(draft.role) && (
                  <option value={draft.role} disabled>
                    {draft.role}
                  </option>
                )}
                {roleOptions.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
              {isEdit && (
                <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">
                  {isArabic ? 'غيّر الصلاحية من تغيير التوظيف.' : 'Change the role from Employment change.'}
                </p>
              )}
            </div>
            <div>
              <label htmlFor="emp-branch" className={LABEL_CLASS}>
                {isArabic ? 'الفرع' : 'Branch'}
              </label>
              <select
                id="emp-branch"
                value={draft.branchId}
                disabled={isEdit}
                onChange={(event) => setField('branchId', event.target.value)}
                className={FIELD_CLASS}
              >
                <option value="">{isArabic ? 'بدون فرع' : 'Unassigned'}</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {isArabic ? branch.nameAr : branch.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="emp-manager" className={LABEL_CLASS}>
                {isArabic ? 'المدير المباشر' : 'Reporting manager'}
              </label>
              <select
                id="emp-manager"
                value={draft.managerId}
                disabled={isEdit}
                onChange={(event) => setField('managerId', event.target.value)}
                className={FIELD_CLASS}
              >
                <option value="">{isArabic ? 'بدون مدير' : 'No manager'}</option>
                {managers.map((manager) => (
                  <option key={manager.id} value={manager.id}>
                    {manager.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="emp-basic" className={LABEL_CLASS}>
                {isArabic ? 'الراتب الأساسي (ر.س)' : 'Basic salary (SAR)'}
              </label>
              <input
                id="emp-basic"
                type="number"
                min={0}
                step="0.01"
                value={draft.basicSalarySar}
                disabled={isEdit}
                onChange={(event) => setField('basicSalarySar', event.target.value)}
                className={FIELD_CLASS}
              />
              {fieldError('basicSalarySar')}
            </div>
            <div>
              <label htmlFor="emp-housing" className={LABEL_CLASS}>
                {isArabic ? 'بدل السكن (ر.س)' : 'Housing allowance (SAR)'}
              </label>
              <input
                id="emp-housing"
                type="number"
                min={0}
                step="0.01"
                value={draft.housingAllowanceSar}
                disabled={isEdit}
                onChange={(event) => setField('housingAllowanceSar', event.target.value)}
                className={FIELD_CLASS}
              />
            </div>
            <div>
              <label htmlFor="emp-transport" className={LABEL_CLASS}>
                {isArabic ? 'بدل النقل (ر.س)' : 'Transport allowance (SAR)'}
              </label>
              <input
                id="emp-transport"
                type="number"
                min={0}
                step="0.01"
                value={draft.transportAllowanceSar}
                disabled={isEdit}
                onChange={(event) => setField('transportAllowanceSar', event.target.value)}
                className={FIELD_CLASS}
              />
            </div>
          </div>

          <div className="flex flex-col gap-3 rounded-xl border border-slate-200 dark:border-macq-borderDark/60 px-4 py-3">
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={draft.isSaudi}
                disabled={isEdit}
                onChange={(event) => setField('isSaudi', event.target.checked)}
                className="h-4 w-4 rounded border-slate-300 accent-macq-orange"
              />
              {isArabic ? 'مواطن سعودي (يُطبق التأمينات)' : 'Saudi citizen (GOSI applies)'}
            </label>
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={isRemoteAllowed}
                disabled={isEdit}
                onChange={(event) => setIsRemoteAllowed(event.target.checked)}
                className="h-4 w-4 rounded border-slate-300 accent-macq-orange"
              />
              {isArabic ? 'مؤهل للعمل عن بُعد' : 'Remote work eligible'}
            </label>
            {isEdit && (
              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                {isArabic
                  ? 'الجنسية والراتب والفرع والحالة عن بُعد تُعدّل من خلال تغيير التوظيف.'
                  : 'Nationality, pay, branch and remote eligibility are changed from Employment change.'}
              </p>
            )}
          </div>

          {formError && (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
              {formError}
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
                  ? 'جارٍ الحفظ…'
                  : 'Saving…'
                : isEdit
                  ? isArabic
                    ? 'حفظ التغييرات'
                    : 'Save changes'
                  : isArabic
                    ? 'إنشاء الموظف'
                    : 'Create employee'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
