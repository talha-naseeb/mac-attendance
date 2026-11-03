import React, { useState } from 'react';
import {
  Building2,
  MapPin,
  Wifi,
  Radio,
  Plus,
  Edit2,
  Trash2,
  Users,
  CheckCircle2,
  X,
  AlertTriangle,
} from 'lucide-react';
import { AdminBranch } from '../data/mockAdminData';

interface BranchesViewProps {
  isArabic: boolean;
  branches: AdminBranch[];
  onSave: (
    branch: Omit<
      AdminBranch,
      'id' | 'activeEmployeesCount' | 'todayPunchesCount' | 'wifiBssids' | 'bleBeacons'
    >,
    id?: string,
  ) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
}

export const BranchesView: React.FC<BranchesViewProps> = ({
  isArabic,
  branches,
  onSave,
  onDelete,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<AdminBranch | null>(null);
  const [deletingBranch, setDeletingBranch] = useState<AdminBranch | null>(null);
  const [deletePending, setDeletePending] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [formName, setFormName] = useState('');
  const [formNameAr, setFormNameAr] = useState('');
  const [formCode, setFormCode] = useState('');
  const [formCity, setFormCity] = useState('Riyadh');
  const [formLat, setFormLat] = useState('24.7136');
  const [formLng, setFormLng] = useState('46.6753');
  const [formRadius, setFormRadius] = useState(150);

  const handleOpenAdd = () => {
    setEditingBranch(null);
    setFormName('');
    setFormNameAr('');
    setFormCode('RUH-NEW');
    setFormCity('Riyadh');
    setFormLat('24.7136');
    setFormLng('46.6753');
    setFormRadius(150);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (branch: AdminBranch) => {
    setEditingBranch(branch);
    setFormName(branch.name);
    setFormNameAr(branch.nameAr);
    setFormCode(branch.code);
    setFormCity(branch.city);
    setFormLat(branch.latitude.toString());
    setFormLng(branch.longitude.toString());
    setFormRadius(branch.geofenceRadiusMeters);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave(
      {
        name: formName,
        nameAr: formNameAr,
        code: formCode,
        city: formCity,
        address: editingBranch?.address || `${formCity}, Kingdom of Saudi Arabia`,
        latitude: parseFloat(formLat),
        longitude: parseFloat(formLng),
        geofenceRadiusMeters: formRadius,
      },
      editingBranch?.id,
    );
    setIsModalOpen(false);
  };

  const handleConfirmDelete = async () => {
    if (!deletingBranch || !onDelete) return;
    setDeletePending(true);
    setDeleteError(null);
    try {
      await onDelete(deletingBranch.id);
      setDeletingBranch(null);
      if (editingBranch?.id === deletingBranch.id) {
        setIsModalOpen(false);
      }
    } catch (error) {
      setDeleteError(
        error instanceof Error
          ? error.message
          : isArabic
            ? 'تعذر حذف الفرع.'
            : 'Unable to delete the branch.',
      );
    } finally {
      setDeletePending(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-extrabold text-base text-slate-900 dark:text-white">
            {isArabic
              ? 'إدارة الفروع والنطاقات الجغرافية'
              : 'Office Branches & Geofence Coordinates'}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {isArabic
              ? 'تحديد مواقع المكاتب الرسمية، نصف قطر الـ 150م، والشبكات اللاسلكية المعتمدة'
              : 'Configured corporate office locations for 6-layer anti-spoofing geofencing'}
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenAdd}
          className="self-start sm:self-auto flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-macq-orange text-white hover:bg-macq-orange/90 shadow-md shadow-macq-orange/20 transition-all"
        >
          <Plus size={16} />
          <span>{isArabic ? 'إضافة فرع جديد' : 'Add New Branch'}</span>
        </button>
      </div>

      {/* Branch Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {branches.map((b) => (
          <div
            key={b.id}
            className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-macq-cardDark border border-slate-200 dark:border-macq-borderDark/60 shadow-sm flex flex-col justify-between hover:border-macq-navy/40 transition-all"
          >
            <div>
              <div className="flex items-start justify-between mb-3 gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-macq-navy/10 text-macq-navy dark:bg-white/10 dark:text-white flex items-center justify-center font-bold flex-shrink-0">
                    <Building2 size={20} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white truncate">
                      {isArabic ? b.nameAr : b.name}
                    </h3>
                    <span className="text-[10px] font-bold text-macq-orange tracking-wider">
                      {b.code} • {b.city}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(b)}
                    aria-label={isArabic ? `تعديل ${b.nameAr}` : `Edit ${b.name}`}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    title={isArabic ? 'تعديل النطاق الجغرافي' : 'Edit Geofence'}
                  >
                    <Edit2 size={15} />
                  </button>
                  {onDelete && (
                    <button
                      type="button"
                      onClick={() => {
                        setDeleteError(null);
                        setDeletingBranch(b);
                      }}
                      aria-label={isArabic ? `حذف ${b.nameAr}` : `Delete ${b.name}`}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
                      title={isArabic ? 'حذف الفرع' : 'Delete Branch'}
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                  <MapPin size={14} className="text-macq-orange flex-shrink-0" />
                  <span className="font-mono text-[11px] truncate">
                    {b.latitude.toFixed(4)}, {b.longitude.toFixed(4)}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                  <Radio size={14} className="text-emerald-500 flex-shrink-0" />
                  <span>
                    {isArabic ? 'نصف القطر الجغرافي:' : 'Geofence Radius:'}{' '}
                    <strong className="text-slate-900 dark:text-white">
                      {b.geofenceRadiusMeters} {isArabic ? 'متر' : 'meters'}
                    </strong>
                  </span>
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                  <Users size={14} className="text-blue-500 flex-shrink-0" />
                  <span>
                    {b.activeEmployeesCount} {isArabic ? 'موظف مسجل' : 'staff assigned'} •{' '}
                    <strong className="text-emerald-500">
                      {b.todayPunchesCount} {isArabic ? 'حاضر اليوم' : 'present'}
                    </strong>
                  </span>
                </div>
              </div>

              {/* Wi-Fi & Beacons */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1.5">
                  {isArabic ? 'شبكات Wi-Fi المعتمدة' : 'Authorized Corporate SSIDs'}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {b.wifiBssids.length === 0 ? (
                    <span className="text-[11px] text-slate-400 italic">
                      {isArabic ? 'إحداثيات GPS فقط' : 'GPS anchor only'}
                    </span>
                  ) : (
                    b.wifiBssids.map((ssid) => (
                      <span
                        key={ssid}
                        className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                      >
                        <Wifi size={10} />
                        {ssid}
                      </span>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 size={13} />
                {isArabic ? 'نطاق نشط' : 'ACTIVE ANCHOR'}
              </span>
              <div className="flex items-center gap-3">
                {onDelete && (
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteError(null);
                      setDeletingBranch(b);
                    }}
                    className="text-xs font-bold text-rose-600 dark:text-rose-400 hover:underline"
                  >
                    {isArabic ? 'حذف' : 'Delete'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleOpenEdit(b)}
                  className="text-xs font-bold text-macq-navy dark:text-slate-200 hover:text-macq-orange hover:underline"
                >
                  {isArabic ? 'ضبط الإعدادات' : 'Configure'}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Edit / Add Modal */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl bg-white dark:bg-macq-cardDark border border-slate-200 dark:border-macq-borderDark/60 shadow-2xl p-5 sm:p-6 relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              aria-label={isArabic ? 'إغلاق النموذج' : 'Close modal'}
              className="absolute top-4 end-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X size={18} />
            </button>

            <h3 className="font-extrabold text-base text-slate-900 dark:text-white mb-1 pe-8">
              {editingBranch
                ? isArabic
                  ? 'ضبط النطاق الجغرافي للفرع'
                  : 'Configure Office Geofence'
                : isArabic
                  ? 'إنشاء فرع مكتبي جديد'
                  : 'Create New Office Branch'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              {isArabic
                ? 'حدد إحداثيات GPS ونصف القطر المسموح به للتحقق من بصمات الموظفين.'
                : 'Set hardware GPS anchors and allowable radius for employee punch validation.'}
            </p>

            <form onSubmit={(event) => void handleSave(event)} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {isArabic ? 'اسم الفرع (بالإنجليزية)' : 'Branch Name (English)'}
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-macq-surfaceDark border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-macq-orange/40"
                  placeholder="e.g. Riyadh HQ - Digital City"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {isArabic ? 'اسم الفرع (بالعربية)' : 'Branch Name (Arabic)'}
                </label>
                <input
                  type="text"
                  required
                  value={formNameAr}
                  onChange={(e) => setFormNameAr(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-macq-surfaceDark border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-macq-orange/40"
                  placeholder="مثال: المقر الرئيسي - الرياض"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {isArabic ? 'رمز الفرع' : 'Branch Code'}
                  </label>
                  <input
                    type="text"
                    required
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-macq-surfaceDark border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {isArabic ? 'المدينة' : 'City'}
                  </label>
                  <input
                    type="text"
                    required
                    value={formCity}
                    onChange={(e) => setFormCity(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-macq-surfaceDark border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {isArabic ? 'خط العرض (Latitude)' : 'Latitude'}
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={formLat}
                    onChange={(e) => setFormLat(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-macq-surfaceDark border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {isArabic ? 'خط الطول (Longitude)' : 'Longitude'}
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={formLng}
                    onChange={(e) => setFormLng(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-macq-surfaceDark border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {isArabic
                      ? `نصف قطر النطاق الجغرافي: ${formRadius} متر`
                      : `Geofence Radius Threshold: ${formRadius}m`}
                  </label>
                  <span className="text-[10px] text-slate-400">
                    {isArabic ? 'الافتراضي: 150م' : 'Default: 150m'}
                  </span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="500"
                  step="25"
                  value={formRadius}
                  onChange={(e) => setFormRadius(parseInt(e.target.value, 10))}
                  className="w-full accent-macq-orange cursor-pointer"
                />
              </div>

              <div className="pt-3 flex items-center justify-between gap-2">
                {editingBranch && onDelete ? (
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteError(null);
                      setDeletingBranch(editingBranch);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 transition-colors"
                  >
                    <Trash2 size={14} />
                    <span>{isArabic ? 'حذف الفرع' : 'Delete Branch'}</span>
                  </button>
                ) : (
                  <span />
                )}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors"
                  >
                    {isArabic ? 'إلغاء' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-macq-orange text-white hover:bg-macq-orange/90 shadow-md shadow-macq-orange/20 transition-all"
                  >
                    {isArabic ? 'حفظ إعدادات الفرع' : 'Save Branch Geofence'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingBranch && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn"
          onClick={() => !deletePending && setDeletingBranch(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white dark:bg-macq-cardDark border border-slate-200 dark:border-macq-borderDark/60 shadow-2xl p-5 sm:p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                  {isArabic ? 'تأكيد حذف الفرع' : 'Delete Office Branch?'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {isArabic
                    ? `هل أنت متأكد من حذف فرع "${deletingBranch.nameAr}" (${deletingBranch.code})؟`
                    : `Are you sure you want to delete "${deletingBranch.name}" (${deletingBranch.code})?`}
                </p>
              </div>
            </div>

            {deletingBranch.activeEmployeesCount > 0 && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 text-xs font-semibold text-amber-800 dark:text-amber-300">
                {isArabic
                  ? `تنبيه: يوجد ${deletingBranch.activeEmployeesCount} موظف مسجل في هذا الفرع. عند الحذف سيتم إلغاء ربطهم بالفرع تلقائياً.`
                  : `Note: ${deletingBranch.activeEmployeesCount} employee(s) are currently assigned to this branch and will be set to Unassigned.`}
              </div>
            )}

            {deleteError && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-2.5 text-xs font-semibold text-rose-700 dark:text-rose-300">
                {deleteError}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={deletePending}
                onClick={() => setDeletingBranch(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors disabled:opacity-50"
              >
                {isArabic ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="button"
                disabled={deletePending}
                onClick={() => void handleConfirmDelete()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-600/20 transition-all disabled:opacity-50"
              >
                <Trash2 size={14} />
                <span>
                  {deletePending
                    ? isArabic
                      ? 'جارٍ الحذف...'
                      : 'Deleting...'
                    : isArabic
                      ? 'تأكيد الحذف'
                      : 'Delete Branch'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
