import React, { useState } from 'react';
import { Check, Copy, KeyRound, X } from 'lucide-react';

interface TemporaryPasswordModalProps {
  password: string;
  employeeName: string;
  isArabic: boolean;
  onClose: () => void;
}

export const TemporaryPasswordModal: React.FC<TemporaryPasswordModalProps> = ({
  password,
  employeeName,
  isArabic,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      setCopyError(false);
    } catch {
      setCopied(false);
      setCopyError(true);
    }
  };

  const title = isArabic ? 'كلمة المرور المؤقتة' : 'Temporary password';

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-macq-borderDark/60 dark:bg-macq-cardDark">
        <button
          type="button"
          onClick={onClose}
          aria-label={isArabic ? 'إغلاق كلمة المرور المؤقتة' : 'Close temporary password'}
          className="absolute end-4 top-4 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-800 dark:hover:text-white"
        >
          <X size={18} />
        </button>

        <div className="mb-1 flex items-center gap-2">
          <KeyRound size={18} className="text-macq-orange" />
          <h3 className="text-base font-extrabold text-slate-900 dark:text-white">{title}</h3>
        </div>
        <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">{employeeName}</p>

        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 dark:border-slate-800 dark:bg-macq-surfaceDark">
          <code className="flex-1 select-all break-all font-mono text-sm font-bold text-slate-900 dark:text-white">
            {password}
          </code>
          <button
            type="button"
            onClick={() => void handleCopy()}
            aria-label={isArabic ? 'نسخ كلمة المرور' : 'Copy password'}
            className="flex items-center gap-1.5 rounded-lg bg-macq-orange px-2.5 py-1.5 text-[10px] font-bold text-white transition-all hover:bg-macq-orange/90"
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {copied
              ? isArabic
                ? 'تم النسخ'
                : 'Copied'
              : isArabic
                ? 'نسخ'
                : 'Copy'}
          </button>
        </div>

        {copyError && (
          <p className="mt-2 text-[10px] font-semibold text-rose-600 dark:text-rose-400">
            {isArabic
              ? 'تعذر النسخ التلقائي — انسخ كلمة المرور يدوياً.'
              : 'Automatic copy failed — copy the password manually.'}
          </p>
        )}

        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-semibold leading-relaxed text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
          {isArabic
            ? 'تظهر كلمة المرور مرة واحدة فقط. اطلب من الموظف تغييرها بعد تسجيل الدخول.'
            : 'This is shown once. Ask the employee to change it after signing in.'}
        </p>

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-macq-navy px-4 py-2 text-xs font-bold text-white transition-all hover:bg-macq-navy/90 dark:bg-white/10 dark:hover:bg-white/20"
          >
            {isArabic ? 'تم' : 'Done'}
          </button>
        </div>
      </div>
    </div>
  );
};
