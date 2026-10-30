import React from 'react';
import {
  Download,
  FileSpreadsheet,
} from 'lucide-react';
import { AdminEmployee } from '../data/mockAdminData';
import { PayrollSummary } from '../api/client';

interface PayrollViewProps {
  onExportWps: () => void;
  isArabic: boolean;
  employees: AdminEmployee[];
  payroll: PayrollSummary;
}

export const PayrollView: React.FC<PayrollViewProps> = ({ onExportWps, isArabic, employees, payroll }) => {
  const { totals } = payroll;

  return (
    <div className="space-y-6">
      {/* Mudad WPS Action Card */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-macq-navy via-macq-dark to-slate-900 text-white border border-white/10 shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
            <h2 className="font-extrabold text-lg text-white">
              {isArabic ? 'نظام حماية الأجور السعودي (منصة مدد)' : 'Saudi Wage Protection System (Mudad WPS)'}
            </h2>
          </div>
          <p className="text-xs text-slate-300 max-w-2xl">
            {isArabic
              ? 'توليد وتصدير ملف مسير الرواتب المعتمد من وزارة الموارد البشرية والتنمية الاجتماعية والبنك المركزي السعودي (ساما)'
              : 'Direct integration file conforming to Saudi Ministry of Human Resources and SAMA banking standards.'}
          </p>
        </div>

        <button
          onClick={onExportWps}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-macq-orange hover:bg-macq-orange/90 text-white font-bold text-xs shadow-lg shadow-macq-orange/25 transition-all flex-shrink-0"
        >
          <Download size={16} />
          <span>{isArabic ? 'تحميل ملف مدد (WPS CSV)' : 'Download Mudad WPS File'}</span>
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-white dark:bg-macq-cardDark border border-slate-200 dark:border-macq-borderDark/60 shadow-sm">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
            {isArabic ? 'إجمالي الراتب الأساسي' : 'Total Basic Salaries'}
          </span>
          <span className="text-xl font-black text-slate-900 dark:text-white">
            {totals.totalBasicSar.toLocaleString()} <span className="text-xs font-semibold text-slate-400">SAR</span>
          </span>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-macq-cardDark border border-slate-200 dark:border-macq-borderDark/60 shadow-sm">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
            {isArabic ? 'بدلات السكن والنقل' : 'Housing & Transport'}
          </span>
          <span className="text-xl font-black text-slate-900 dark:text-white">
            {(totals.totalHousingSar + totals.totalTransportSar).toLocaleString()} <span className="text-xs font-semibold text-slate-400">SAR</span>
          </span>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-macq-cardDark border border-slate-200 dark:border-macq-borderDark/60 shadow-sm">
          <span className="text-[11px] font-bold text-rose-500 uppercase tracking-wider block mb-1">
            {isArabic ? 'استقطاعات التأمينات (الموظفون 9.75%)' : 'GOSI Employee Share (9.75%)'}
          </span>
          <span className="text-xl font-black text-rose-600 dark:text-rose-400">
            {totals.totalGosiEmployeeSar.toLocaleString()} <span className="text-xs font-semibold text-slate-400">SAR</span>
          </span>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-macq-cardDark border border-slate-200 dark:border-macq-borderDark/60 shadow-sm">
          <span className="text-[11px] font-bold text-emerald-500 uppercase tracking-wider block mb-1">
            {isArabic ? 'صافي مسير الرواتب المودع' : 'Net Disbursed via Bank'}
          </span>
          <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">
            {totals.totalNetDisbursedSar.toLocaleString()} <span className="text-xs font-semibold text-slate-400">SAR</span>
          </span>
        </div>
      </div>

      {/* WPS File Preview Table */}
      <div className="p-6 rounded-2xl bg-white dark:bg-macq-cardDark border border-slate-200 dark:border-macq-borderDark/60 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FileSpreadsheet size={18} className="text-macq-orange" />
            <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
              {isArabic ? 'معاينة سجلات مسير الرواتب المعتمدة' : 'Mudad WPS Payroll Ledger Preview'}
            </h3>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            EST_ID: 7001928374 • SAMA COMPLIANT
          </span>
        </div>

        <div className="overflow-x-auto">
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
    </div>
  );
};
