import React, { useState } from 'react';
import {
  Eye,
  EyeOff,
  Languages,
  LockKeyhole,
  Mail,
  Moon,
  Radio,
  ShieldCheck,
  Sun,
  FileCheck2,
} from 'lucide-react';
import { ApiError, loginAdmin, UserSession } from '../api/client';

interface AdminLoginScreenProps {
  onAuthenticated: (session: UserSession) => void;
  isDark?: boolean;
  onToggleTheme?: () => void;
  isArabic?: boolean;
  onToggleLanguage?: () => void;
}

export const AdminLoginScreen: React.FC<AdminLoginScreenProps> = ({
  onAuthenticated,
  isDark = false,
  onToggleTheme,
  isArabic = false,
  onToggleLanguage,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      onAuthenticated(await loginAdmin(email.trim(), password));
    } catch (requestError) {
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : isArabic
            ? 'تعذر تسجيل الدخول إلى بوابة الإدارة.'
            : 'Unable to sign in to the administration console.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-100 dark:bg-macq-surfaceDark flex flex-col justify-between p-4 sm:p-6 lg:p-10 transition-colors duration-200">
      {/* Top Bar: Brand + Theme & Language Controls */}
      <header className="w-full max-w-5xl mx-auto flex items-center justify-between py-2">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-macq-navy flex items-center justify-center shadow-md border border-white/10">
            <svg viewBox="0 0 100 100" className="w-5 h-5" aria-hidden="true">
              <circle cx="50" cy="30" r="14" fill="#FE5800" />
              <path d="M18 80 L34 46 L50 66 L66 46 L82 80 Z" fill="#FFFFFF" />
            </svg>
          </div>
          <span className="font-extrabold text-sm sm:text-base tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5">
            Mac<span className="text-macq-orange">Q</span>HR
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-macq-orange/15 text-macq-orange font-bold uppercase tracking-wider">
              {isArabic ? 'الإدارة' : 'Admin'}
            </span>
          </span>
        </div>

        <div className="flex items-center gap-2">
          {onToggleLanguage && (
            <button
              type="button"
              onClick={onToggleLanguage}
              aria-label={isArabic ? 'Switch to English' : 'التبديل إلى العربية'}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-white dark:bg-macq-cardDark border border-slate-200 dark:border-macq-borderDark/60 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-sm transition-all"
            >
              <Languages size={14} className="text-macq-orange" />
              <span>{isArabic ? 'English' : 'العربية'}</span>
            </button>
          )}
          {onToggleTheme && (
            <button
              type="button"
              onClick={onToggleTheme}
              aria-label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              className="p-2 rounded-xl bg-white dark:bg-macq-cardDark border border-slate-200 dark:border-macq-borderDark/60 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-sm transition-all"
            >
              {isDark ? (
                <Sun size={15} className="text-amber-400" />
              ) : (
                <Moon size={15} className="text-slate-600" />
              )}
            </button>
          )}
        </div>
      </header>

      {/* Main Responsive Card */}
      <div className="my-auto py-6 w-full max-w-5xl mx-auto">
        <section className="w-full rounded-3xl bg-white dark:bg-macq-cardDark shadow-2xl border border-slate-200/90 dark:border-macq-borderDark/60 overflow-hidden grid grid-cols-1 lg:grid-cols-11">
          {/* Left / Top Brand & Security Posture Panel */}
          <div className="lg:col-span-5 p-6 sm:p-8 lg:p-10 bg-gradient-to-br from-macq-dark via-macq-navy to-slate-900 text-white flex flex-col justify-between relative overflow-hidden">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-macq-orange font-bold text-[11px] uppercase tracking-wider mb-5">
                <ShieldCheck size={14} />
                <span>{isArabic ? 'وصول إداري مقيّد' : 'Restricted Access'}</span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-black tracking-tight leading-tight">
                {isArabic ? 'بوابة إدارة MacQHR المركزية' : 'MacQHR Admin Console'}
              </h1>
              <p className="mt-2.5 text-xs sm:text-sm text-slate-300 leading-relaxed">
                {isArabic
                  ? 'مخصصة لمسؤولي الموارد البشرية ومديري النظام لإدارة الموظفين والحضور والرواتب وسجلات التدقيق.'
                  : 'Only assigned HR and Super Admin accounts can sign in to manage workforce lifecycle, attendance telemetry, payroll, and audit logs.'}
              </p>
            </div>

            <div className="mt-8 space-y-3 hidden sm:block">
              <div className="flex items-start gap-3 p-3 rounded-2xl bg-white/5 border border-white/10">
                <Radio size={16} className="text-emerald-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-bold text-white">
                    {isArabic ? 'رادار الحضور والنطاق الجغرافي' : '6-Layer Attendance & Geofence'}
                  </p>
                  <p className="text-[11px] text-slate-300">
                    {isArabic
                      ? 'تحقق لحظي من مواقع الفروع والعمل عن بُعد'
                      : 'Real-time branch radius & remote work verification'}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-2xl bg-white/5 border border-white/10">
                <FileCheck2 size={16} className="text-macq-orange mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-bold text-white">
                    {isArabic ? 'التأمينات الاجتماعية ونظام مدد' : 'Saudi GOSI & Mudad WPS Ready'}
                  </p>
                  <p className="text-[11px] text-slate-300">
                    {isArabic
                      ? 'سجل تغييرات وظيفية وتدقيق أمني شامل'
                      : 'Full employment ledger & paginated security audit trail'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right / Bottom Sign-In Form */}
          <div className="lg:col-span-6 p-6 sm:p-8 lg:p-10 flex flex-col justify-center">
            <div className="mb-6">
              <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white">
                {isArabic ? 'تسجيل دخول المسؤولين' : 'Administrator Sign In'}
              </h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {isArabic
                  ? 'أدخل بريد العمل وكلمة المرور للوصول إلى لوحة التحكم.'
                  : 'Enter your corporate credentials to establish an audited session.'}
              </p>
            </div>

            <form className="space-y-4 sm:space-y-5" onSubmit={handleSubmit}>
              {error && (
                <p
                  role="alert"
                  className="rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 px-3.5 py-2.5 text-xs font-semibold text-rose-700 dark:text-rose-300"
                >
                  {error}
                </p>
              )}

              <label className="block">
                <span className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-200">
                  {isArabic ? 'البريد الإلكتروني للمسؤول' : 'Administrator email'}
                </span>
                <span className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 focus-within:border-macq-orange focus-within:ring-2 focus-within:ring-macq-orange/30 dark:border-slate-700 dark:bg-macq-surfaceDark transition-all">
                  <Mail size={16} className="text-slate-400 flex-shrink-0" />
                  <input
                    required
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="admin@macquires.com"
                    className="w-full bg-transparent py-3 text-sm text-slate-900 placeholder-slate-400 outline-none dark:text-white"
                    autoComplete="email"
                  />
                </span>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-200">
                  {isArabic ? 'كلمة المرور' : 'Password'}
                </span>
                <span className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 focus-within:border-macq-orange focus-within:ring-2 focus-within:ring-macq-orange/30 dark:border-slate-700 dark:bg-macq-surfaceDark transition-all">
                  <LockKeyhole size={16} className="text-slate-400 flex-shrink-0" />
                  <input
                    required
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="••••••••••••"
                    className="w-full bg-transparent py-3 text-sm text-slate-900 placeholder-slate-400 outline-none dark:text-white"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={
                      showPassword
                        ? isArabic
                          ? 'إخفاء كلمة المرور'
                          : 'Hide password'
                        : isArabic
                          ? 'إظهار كلمة المرور'
                          : 'Show password'
                    }
                    className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </span>
              </label>

              <button
                disabled={submitting}
                className="w-full rounded-xl bg-macq-orange px-4 py-3 text-sm font-extrabold text-white shadow-lg shadow-macq-orange/25 transition-all hover:bg-macq-orange/90 disabled:cursor-not-allowed disabled:opacity-60"
                type="submit"
              >
                {submitting
                  ? isArabic
                    ? 'جاري تسجيل الدخول…'
                    : 'Signing in…'
                  : isArabic
                    ? 'تسجيل الدخول بأمان'
                    : 'Sign in securely'}
              </button>
            </form>
          </div>
        </section>
      </div>

      {/* Footer */}
      <footer className="w-full max-w-5xl mx-auto text-center py-2 text-[11px] text-slate-400 dark:text-slate-500">
        {isArabic
          ? 'MacQHR Enterprise HRMS • جميع الجلسات محمية ومُسجلة في سجل التدقيق الأمني'
          : 'MacQHR Enterprise HRMS • All administrative sessions are token-bound and audited'}
      </footer>
    </main>
  );
};
