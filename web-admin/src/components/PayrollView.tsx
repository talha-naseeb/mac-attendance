import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Lock,
  PlugZap,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { AdminEmployee } from '../data/mockAdminData';
import {
  fetchIntegrationConfigs,
  fetchPayrollRuns,
  IntegrationConfigItem,
  lockPayrollRunApi,
  PayrollRunRecord,
  PayrollSummary,
  preparePayrollRunApi,
  retryFailedIntegrations,
  reviewPayrollRunApi,
  testIntegrationConnection,
  toggleIntegrationProvider,
} from '../api/client';

interface PayrollViewProps {
  onExportWps: () => void;
  isArabic: boolean;
  employees: AdminEmployee[];
  payroll: PayrollSummary;
}

export const PayrollView: React.FC<PayrollViewProps> = ({
  onExportWps,
  isArabic,
  employees,
  payroll,
}) => {
  const { totals } = payroll;
  const defaultPeriod = `${new Date().getFullYear()}-${String(
    new Date().getMonth() + 1,
  ).padStart(2, '0')}`;
  const [selectedPeriod, setSelectedPeriod] = useState(defaultPeriod);
  const [runs, setRuns] = useState<PayrollRunRecord[]>([]);
  const [integrations, setIntegrations] = useState<IntegrationConfigItem[]>([]);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState(false);

  const loadPhase11Data = async () => {
    try {
      const [runList, intData] = await Promise.all([
        fetchPayrollRuns(),
        fetchIntegrationConfigs(),
      ]);
      setRuns(runList);
      setIntegrations(intData.configs || []);
    } catch {
      // Non-fatal in offline/unit-test environments
    }
  };

  useEffect(() => {
    void loadPhase11Data();
  }, []);

  const activeRun = runs.find((r) => r.period === selectedPeriod) || null;
  const displayTotals = activeRun?.totals ?? totals;

  const handlePrepare = async () => {
    setBusyAction(true);
    setStatusBanner(null);
    try {
      await preparePayrollRunApi(selectedPeriod);
      await loadPhase11Data();
      setStatusBanner(
        isArabic
          ? `تم إعداد مسير الرواتب للفترة ${selectedPeriod} بنجاح.`
          : `Payroll run for ${selectedPeriod} prepared with GOSI & unpaid leave snapshots.`,
      );
    } catch (err: any) {
      setStatusBanner(err?.message || 'Failed to prepare payroll run.');
    } finally {
      setBusyAction(false);
    }
  };

  const handleReview = async () => {
    if (!activeRun) return;
    setBusyAction(true);
    setStatusBanner(null);
    try {
      await reviewPayrollRunApi(activeRun.id);
      await loadPhase11Data();
      setStatusBanner(
        isArabic
          ? `تمت مراجعة مسير الرواتب للفترة ${selectedPeriod}.`
          : `Payroll run for ${selectedPeriod} marked as REVIEWED.`,
      );
    } catch (err: any) {
      setStatusBanner(err?.message || 'Failed to review payroll run.');
    } finally {
      setBusyAction(false);
    }
  };

  const handleLock = async () => {
    if (!activeRun) return;
    setBusyAction(true);
    setStatusBanner(null);
    try {
      await lockPayrollRunApi(activeRun.id);
      await loadPhase11Data();
      setStatusBanner(
        isArabic
          ? `تم قفل واعتماد مسير الرواتب للفترة ${selectedPeriod} نهائياً.`
          : `Payroll run for ${selectedPeriod} is now LOCKED and immutable.`,
      );
    } catch (err: any) {
      setStatusBanner(err?.message || 'Failed to lock payroll run.');
    } finally {
      setBusyAction(false);
    }
  };

  const handleToggleProvider = async (
    provider: 'TEAMS' | 'OUTLOOK' | 'ENTRA_SSO',
    enabled: boolean,
  ) => {
    try {
      await toggleIntegrationProvider(provider, enabled);
      await loadPhase11Data();
    } catch (err: any) {
      setStatusBanner(err?.message || 'Failed to update integration config.');
    }
  };

  const handleTestProvider = async (
    provider: 'TEAMS' | 'OUTLOOK' | 'ENTRA_SSO',
  ) => {
    try {
      const res = await testIntegrationConnection(provider);
      setStatusBanner(res.message);
      await loadPhase11Data();
    } catch (err: any) {
      setStatusBanner(err?.message || 'Connection test failed.');
    }
  };

  const handleRetryOutbox = async () => {
    try {
      const res = await retryFailedIntegrations();
      setStatusBanner(
        `Retried ${res.retriedCount} queued event(s); ${res.deliveredCount} delivered.`,
      );
      await loadPhase11Data();
    } catch (err: any) {
      setStatusBanner(err?.message || 'Retry failed.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Mudad WPS Action Card */}
      <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-r from-macq-navy via-macq-dark to-slate-900 text-white border border-white/10 shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping flex-shrink-0" />
            <h2 className="font-extrabold text-base sm:text-lg text-white">
              {isArabic
                ? 'نظام حماية الأجور السعودي (منصة مدد)'
                : 'Saudi Wage Protection System (Mudad WPS)'}
            </h2>
          </div>
          <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
            {isArabic
              ? 'توليد وتصدير ملف مسير الرواتب المعتمد من وزارة الموارد البشرية والتنمية الاجتماعية والبنك المركزي السعودي (ساما)'
              : 'Direct integration file conforming to Saudi Ministry of Human Resources and SAMA banking standards.'}
          </p>
        </div>

        <button
          type="button"
          onClick={onExportWps}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-macq-orange hover:bg-macq-orange/90 text-white font-bold text-xs shadow-lg shadow-macq-orange/25 transition-all flex-shrink-0"
        >
          <Download size={16} />
          <span>
            {isArabic ? 'تحميل ملف مدد (WPS CSV)' : 'Download Mudad WPS File'}
          </span>
        </button>
      </div>

      {statusBanner && (
        <div className="p-3.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-xs font-semibold text-blue-900 dark:text-blue-200 flex items-center justify-between">
          <span>{statusBanner}</span>
          <button
            type="button"
            onClick={() => setStatusBanner(null)}
            className="text-blue-500 hover:underline ml-4"
          >
            {isArabic ? 'إغلاق' : 'Dismiss'}
          </button>
        </div>
      )}

      {/* Phase 11 (M8): Period Payroll Run Approval & Lock Pipeline */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-macq-cardDark border border-slate-200 dark:border-macq-borderDark/60 shadow-sm flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} className="text-emerald-500" />
            <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
              {isArabic
                ? 'دورة اعتماد وقفل مسير الرواتب الشهري (M8)'
                : 'Period Payroll Run Approval & Lock Pipeline'}
            </h3>
            {activeRun && (
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                  activeRun.status === 'LOCKED'
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                    : activeRun.status === 'REVIEWED'
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                      : 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                }`}
              >
                {activeRun.status}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {isArabic
              ? 'إعداد اللقطة الشهرية (الأساسي، البدلات، التأمينات، الإجازات غير المدفوعة) ثم المراجعة والقفل النهائي غير القابل للتعديل.'
              : 'Snapshots salaries, GOSI caps, and approved unpaid leaves. Locked periods are immutable.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          <input
            type="month"
            aria-label="Payroll Period"
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-900 text-xs font-mono text-slate-900 dark:text-white"
          />
          <button
            type="button"
            disabled={busyAction || activeRun?.status === 'LOCKED'}
            onClick={handlePrepare}
            className="px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold disabled:opacity-40"
          >
            {isArabic ? '1. إعداد المسير' : '1. Prepare Run'}
          </button>
          <button
            type="button"
            disabled={
              busyAction || !activeRun || activeRun.status === 'LOCKED'
            }
            onClick={handleReview}
            className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold flex items-center gap-1 disabled:opacity-40"
          >
            <CheckCircle2 size={14} />
            <span>{isArabic ? '2. مراجعة' : '2. Review'}</span>
          </button>
          <button
            type="button"
            disabled={
              busyAction || !activeRun || activeRun.status !== 'REVIEWED'
            }
            onClick={handleLock}
            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1 disabled:opacity-40"
          >
            <Lock size={14} />
            <span>{isArabic ? '3. قفل نهائي' : '3. Lock Period'}</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-white dark:bg-macq-cardDark border border-slate-200 dark:border-macq-borderDark/60 shadow-sm">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
            {isArabic ? 'إجمالي الراتب الأساسي' : 'Total Basic Salaries'}
          </span>
          <span className="text-xl font-black text-slate-900 dark:text-white">
            {displayTotals.totalBasicSar.toLocaleString()}{' '}
            <span className="text-xs font-semibold text-slate-400">SAR</span>
          </span>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-macq-cardDark border border-slate-200 dark:border-macq-borderDark/60 shadow-sm">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
            {isArabic ? 'بدلات السكن والنقل' : 'Housing & Transport'}
          </span>
          <span className="text-xl font-black text-slate-900 dark:text-white">
            {(
              displayTotals.totalHousingSar + displayTotals.totalTransportSar
            ).toLocaleString()}{' '}
            <span className="text-xs font-semibold text-slate-400">SAR</span>
          </span>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-macq-cardDark border border-slate-200 dark:border-macq-borderDark/60 shadow-sm">
          <span className="text-[11px] font-bold text-rose-500 uppercase tracking-wider block mb-1">
            {isArabic
              ? 'استقطاعات التأمينات (الموظفون 9.75%)'
              : 'GOSI Employee Share (9.75%)'}
          </span>
          <span className="text-xl font-black text-rose-600 dark:text-rose-400">
            {displayTotals.totalGosiEmployeeSar.toLocaleString()}{' '}
            <span className="text-xs font-semibold text-slate-400">SAR</span>
          </span>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-macq-cardDark border border-slate-200 dark:border-macq-borderDark/60 shadow-sm">
          <span className="text-[11px] font-bold text-emerald-500 uppercase tracking-wider block mb-1">
            {isArabic ? 'صافي مسير الرواتب المودع' : 'Net Disbursed via Bank'}
          </span>
          <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">
            {displayTotals.totalNetDisbursedSar.toLocaleString()}{' '}
            <span className="text-xs font-semibold text-slate-400">SAR</span>
          </span>
        </div>
      </div>

      {/* WPS File Preview Container */}
      <div className="p-4 sm:p-6 rounded-2xl bg-white dark:bg-macq-cardDark border border-slate-200 dark:border-macq-borderDark/60 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            <FileSpreadsheet size={18} className="text-macq-orange" />
            <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">
              {isArabic
                ? 'معاينة سجلات مسير الرواتب المعتمدة'
                : 'Mudad WPS Payroll Ledger Preview'}
            </h3>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">
            EST_ID: 7001928374 • SAMA COMPLIANT
          </span>
        </div>

        {/* Mobile Responsive Payroll Cards (< md) */}
        <div className="md:hidden space-y-3">
          {employees.map((emp) => (
            <div
              key={`mobile-pay-${emp.id}`}
              className="p-4 rounded-xl bg-slate-50 dark:bg-macq-surfaceDark/60 border border-slate-200/70 dark:border-slate-800 space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-bold text-slate-900 dark:text-white">
                    {emp.name}
                  </p>
                  <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                    {emp.employeeId} • ID: {emp.nationalOrIqamaId}
                  </p>
                </div>
                <span className="text-xs font-black font-mono text-emerald-600 dark:text-emerald-400">
                  {emp.netSalarySar.toLocaleString()} SAR
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200/60 dark:border-slate-800 text-[11px] font-mono">
                <div>
                  <span className="text-slate-400 font-sans block text-[10px]">
                    {isArabic ? 'الأساسي' : 'Basic'}
                  </span>
                  <span className="text-slate-800 dark:text-slate-200">
                    {emp.basicSalarySar.toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 font-sans block text-[10px]">
                    {isArabic ? 'السكن' : 'Housing'}
                  </span>
                  <span className="text-slate-800 dark:text-slate-200">
                    {emp.housingAllowanceSar.toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 font-sans block text-[10px]">
                    {isArabic ? 'التأمينات' : 'GOSI'}
                  </span>
                  <span className="text-rose-500">
                    -{emp.gosiEmployeeDeductionSar.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop Structured Table (md+) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left rtl:text-right text-xs border-collapse min-w-[700px]">
            <thead>
              <tr className="border-b border-slate-200 dark:border-zinc-800 text-slate-500 dark:text-zinc-400 font-bold uppercase tracking-wider bg-slate-50/70 dark:bg-zinc-950/40">
                <th className="py-3 px-3">RECORD_TYPE</th>
                <th className="py-3 px-3">EMPLOYEE_ID</th>
                <th className="py-3 px-3">NATIONAL_ID / IQAMA</th>
                <th className="py-3 px-3">NAME</th>
                <th className="py-3 px-3">BASIC_SALARY</th>
                <th className="py-3 px-3">HOUSING</th>
                <th className="py-3 px-3">GOSI_DEDUCTION</th>
                <th className="py-3 px-3 text-right rtl:text-left">NET_DISBURSED</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60 font-mono text-[11px] text-slate-800 dark:text-zinc-300">
              {employees.map((emp) => (
                <tr key={emp.id} className="hover:bg-slate-50/80 dark:hover:bg-zinc-800/40">
                  <td className="py-3 px-3 font-bold text-macq-orange">WPS</td>
                  <td className="py-3 px-3 font-semibold">{emp.employeeId}</td>
                  <td className="py-3 px-3">{emp.nationalOrIqamaId}</td>
                  <td className="py-3 px-3 font-sans font-semibold text-slate-900 dark:text-white">
                    {emp.name}
                  </td>
                  <td className="py-3 px-3">{emp.basicSalarySar.toFixed(2)}</td>
                  <td className="py-3 px-3">{emp.housingAllowanceSar.toFixed(2)}</td>
                  <td className="py-3 px-3 text-rose-500">
                    -{emp.gosiEmployeeDeductionSar.toFixed(2)}
                  </td>
                  <td className="py-3 px-3 font-bold text-emerald-600 dark:text-emerald-400 text-right rtl:text-left">
                    {emp.netSalarySar.toFixed(2)} SAR
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Phase 11 (M7.7): Microsoft 365 & Enterprise Integrations Panel */}
      {integrations.length > 0 && (
        <div className="p-4 sm:p-6 rounded-2xl bg-white dark:bg-macq-cardDark border border-slate-200 dark:border-macq-borderDark/60 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <PlugZap size={18} className="text-macq-orange" />
              <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">
                {isArabic
                  ? 'تكاملات مايكروسوفت 365 والمؤسسة (M7.3–M7.7)'
                  : 'Microsoft 365 & Enterprise Integrations (Teams, Outlook, Entra ID)'}
              </h3>
            </div>
            <button
              type="button"
              onClick={handleRetryOutbox}
              className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5"
            >
              <RefreshCw size={13} />
              <span>
                {isArabic
                  ? 'إعادة محاولة المهام الفاشلة'
                  : 'Retry Queued Outbox'}
              </span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {integrations.map((cfg) => (
              <div
                key={cfg.provider}
                className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-900/60 border border-slate-200/80 dark:border-zinc-800 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-xs text-slate-900 dark:text-white">
                    {cfg.provider}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      cfg.enabled
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                        : 'bg-slate-200 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400'
                    }`}
                  >
                    {cfg.enabled ? 'ENABLED' : 'DISABLED'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                  {cfg.lastErrorMessage
                    ? `Last error: ${cfg.lastErrorMessage}`
                    : cfg.lastSuccessAt
                      ? `Last OK: ${new Date(cfg.lastSuccessAt).toLocaleTimeString()}`
                      : 'Ready for dispatch'}
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() =>
                      handleToggleProvider(cfg.provider, !cfg.enabled)
                    }
                    className="px-2.5 py-1 rounded-md border border-slate-300 dark:border-zinc-700 text-[11px] font-bold text-slate-700 dark:text-slate-200"
                  >
                    {cfg.enabled ? 'Disable' : 'Enable'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTestProvider(cfg.provider)}
                    className="px-2.5 py-1 rounded-md bg-macq-navy text-white text-[11px] font-bold"
                  >
                    Test Connection
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
