import React, { useState } from 'react';
import { Search } from 'lucide-react';
import { AdminEmployee } from '../data/mockAdminData';

interface EmployeesViewProps {
  isArabic: boolean;
  employees: AdminEmployee[];
}

export const EmployeesView: React.FC<EmployeesViewProps> = ({ isArabic, employees }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('ALL');

  const filteredEmployees = employees.filter((emp) => {
    if (departmentFilter !== 'ALL' && emp.department !== departmentFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        emp.name.toLowerCase().includes(q) ||
        emp.employeeId.toLowerCase().includes(q) ||
        emp.email.toLowerCase().includes(q) ||
        emp.jobTitle.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Search and Filter */}
      <div className="p-4 rounded-2xl bg-white dark:bg-macq-cardDark border border-slate-200 dark:border-macq-borderDark/60 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-80">
          <Search size={16} className="absolute left-3 rtl:right-3 rtl:left-auto top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder={isArabic ? 'البحث في الموظفين...' : 'Search employee, ID, or title...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 rtl:pr-9 rtl:pl-3 pr-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-macq-surfaceDark border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-macq-orange/40"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-50 dark:bg-macq-surfaceDark border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none"
          >
            <option value="ALL">{isArabic ? 'جميع الأقسام' : 'All Departments'}</option>
            <option value="Executive Board">Executive Board</option>
            <option value="People & Culture">People & Culture</option>
            <option value="Software Engineering">Software Engineering</option>
          </select>
        </div>
      </div>

      {/* Employees Table */}
      <div className="p-6 rounded-2xl bg-white dark:bg-macq-cardDark border border-slate-200 dark:border-macq-borderDark/60 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left rtl:text-right text-xs border-collapse min-w-[750px]">
            <thead>
              <tr className="border-b border-slate-200 dark:border-zinc-800 text-slate-500 dark:text-zinc-400 font-bold uppercase tracking-wider bg-slate-50/70 dark:bg-zinc-950/40">
                <th className="py-3.5 px-4">{isArabic ? 'الموظف' : 'Employee'}</th>
                <th className="py-3.5 px-4">{isArabic ? 'القسم والفرع' : 'Department & Office'}</th>
                <th className="py-3.5 px-4">{isArabic ? 'الصلاحية' : 'Role'}</th>
                <th className="py-3.5 px-4">{isArabic ? 'الجنسية / الهوية' : 'Nationality & ID'}</th>
                <th className="py-3.5 px-4">{isArabic ? 'الراتب الأساسي' : 'Basic (SAR)'}</th>
                <th className="py-3.5 px-4">{isArabic ? 'خصم التأمينات' : 'GOSI (9.75%)'}</th>
                <th className="py-3.5 px-4 text-right rtl:text-left">{isArabic ? 'الصافي' : 'Net Salary'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60 text-slate-800 dark:text-zinc-300">
              {filteredEmployees.map((emp) => (
                <tr
                  key={emp.id}
                  className="hover:bg-slate-50/80 dark:hover:bg-zinc-800/40 transition-colors"
                >
                  <td className="py-3.5 px-4">
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-900 dark:text-white">
                        {emp.name}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {emp.employeeId} • {emp.email}
                      </span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="font-medium text-slate-900 dark:text-white block">
                      {emp.department}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {emp.branchName}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                        emp.role === 'SUPER_ADMIN'
                          ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                          : emp.role === 'HR_ADMIN'
                          ? 'bg-teal-500/10 text-teal-600 dark:text-teal-400'
                          : emp.role === 'MANAGER'
                          ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {emp.role}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold mb-0.5 ${
                        emp.isSaudi
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                      }`}
                    >
                      {emp.isSaudi ? '🇸🇦 Saudi Citizen' : '🌐 Expat Resident'}
                    </span>
                    <span className="text-[10px] font-mono text-slate-500 block">
                      ID: {emp.nationalOrIqamaId}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white">
                    {emp.basicSalarySar.toLocaleString()} SAR
                  </td>
                  <td className="py-3.5 px-4 text-rose-600 dark:text-rose-400 font-medium">
                    {emp.gosiEmployeeDeductionSar > 0
                      ? `-${emp.gosiEmployeeDeductionSar.toLocaleString()} SAR`
                      : '0 SAR (Exempt)'}
                  </td>
                  <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white text-right rtl:text-left">
                    {emp.netSalarySar.toLocaleString()} SAR
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
