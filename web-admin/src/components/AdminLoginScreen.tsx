import React, { useState } from 'react';
import { LockKeyhole, Mail, ShieldCheck } from 'lucide-react';
import { ApiError, loginAdmin, UserSession } from '../api/client';

interface AdminLoginScreenProps {
  onAuthenticated: (session: UserSession) => void;
}

export const AdminLoginScreen: React.FC<AdminLoginScreenProps> = ({
  onAuthenticated,
}) => {
  const [email, setEmail] = useState('superadmin@macqhr.sa');
  const [password, setPassword] = useState('Password123!');
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
          : 'Unable to sign in to the administration console.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-100 dark:bg-macq-surfaceDark flex items-center justify-center p-5">
      <section className="w-full max-w-md rounded-3xl bg-white dark:bg-macq-cardDark shadow-2xl border border-slate-200 dark:border-macq-borderDark/60 overflow-hidden">
        <div className="p-8 bg-gradient-to-br from-macq-dark via-macq-navy to-slate-900 text-white">
          <div className="w-12 h-12 rounded-2xl bg-macq-orange flex items-center justify-center mb-5">
            <ShieldCheck size={26} />
          </div>
          <p className="text-macq-orange font-bold text-xs uppercase tracking-[0.18em]">
            Restricted access
          </p>
          <h1 className="mt-2 text-2xl font-black">MacQHR Admin Console</h1>
          <p className="mt-2 text-sm text-slate-300">
            Only assigned HR and Super Admin accounts can sign in.
          </p>
        </div>

        <form className="p-8 space-y-5" onSubmit={handleSubmit}>
          {error && (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs font-semibold text-rose-700">
              {error}
            </p>
          )}
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-200">
              Administrator email
            </span>
            <span className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 dark:border-slate-700 dark:bg-macq-surfaceDark">
              <Mail size={16} className="text-slate-400" />
              <input
                required
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full bg-transparent py-3 text-sm text-slate-900 outline-none dark:text-white"
                autoComplete="email"
              />
            </span>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-200">
              Password
            </span>
            <span className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 dark:border-slate-700 dark:bg-macq-surfaceDark">
              <LockKeyhole size={16} className="text-slate-400" />
              <input
                required
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full bg-transparent py-3 text-sm text-slate-900 outline-none dark:text-white"
                autoComplete="current-password"
              />
            </span>
          </label>
          <button
            disabled={submitting}
            className="w-full rounded-xl bg-macq-orange px-4 py-3 text-sm font-extrabold text-white shadow-lg shadow-macq-orange/25 transition hover:bg-macq-orange/90 disabled:cursor-not-allowed disabled:opacity-60"
            type="submit"
          >
            {submitting ? 'Signing in…' : 'Sign in securely'}
          </button>
        </form>
      </section>
    </main>
  );
};
