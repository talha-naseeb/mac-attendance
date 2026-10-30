import React, { useState } from 'react';
import {
  Building2,
  MapPin,
  Wifi,
  Radio,
  Plus,
  Edit2,
  Users,
  CheckCircle2,
  X,
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
}

export const BranchesView: React.FC<BranchesViewProps> = ({ isArabic, branches, onSave }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<AdminBranch | null>(null);

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

  return (
    <div className="space-y-6">
      {/* Header action */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-extrabold text-base text-slate-900 dark:text-white">
            {isArabic ? 'إدارة الفروع والنطاقات الجغرافية' : 'Office Branches & Geofence Coordinates'}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {isArabic
              ? 'تحديد مواقع المكاتب الرسمية، نصف قطر الـ 150م، والشبكات اللاسلكية المعتمدة'
              : 'Configured corporate office locations for 6-layer anti-spoofing geofencing'}
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-macq-orange text-white hover:bg-macq-orange/90 shadow-md shadow-macq-orange/20 transition-all"
        >
          <Plus size={16} />
          <span>{isArabic ? 'إضافة فرع جديد' : 'Add New Branch'}</span>
        </button>
      </div>

      {/* Branch Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {branches.map((b) => (
          <div
            key={b.id}
            className="p-6 rounded-2xl bg-white dark:bg-macq-cardDark border border-slate-200 dark:border-macq-borderDark/60 shadow-sm flex flex-col justify-between hover:border-macq-navy/40 transition-all"
          >
            <div>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-macq-navy/10 text-macq-navy dark:bg-white/10 dark:text-white flex items-center justify-center font-bold">
                    <Building2 size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                      {isArabic ? b.nameAr : b.name}
                    </h3>
                    <span className="text-[10px] font-bold text-macq-orange tracking-wider">
                      {b.code} • {b.city}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => handleOpenEdit(b)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  title="Edit Geofence"
                >
                  <Edit2 size={15} />
                </button>
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
                    Geofence Radius: <strong className="text-slate-900 dark:text-white">{b.geofenceRadiusMeters} meters</strong>
                  </span>
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                  <Users size={14} className="text-blue-500 flex-shrink-0" />
                  <span>
                    {b.activeEmployeesCount} staff assigned • <strong className="text-emerald-500">{b.todayPunchesCount} present</strong>
                  </span>
                </div>
              </div>

              {/* Wi-Fi & Beacons */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1.5">
                  Authorized Corporate SSIDs
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {b.wifiBssids.map((ssid) => (
                    <span
                      key={ssid}
                      className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                    >
                      <Wifi size={10} />
                      {ssid}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 size={13} />
                ACTIVE ANCHOR
              </span>
              <button
                onClick={() => handleOpenEdit(b)}
                className="text-xs font-bold text-macq-navy dark:text-slate-200 hover:text-macq-orange hover:underline"
              >
                Configure
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Edit / Add Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-macq-cardDark border border-slate-200 dark:border-macq-borderDark/60 shadow-2xl p-6 relative">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X size={18} />
            </button>

            <h3 className="font-extrabold text-base text-slate-900 dark:text-white mb-1">
              {editingBranch ? 'Configure Office Geofence' : 'Create New Office Branch'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Set hardware GPS anchors and allowable radius for employee punch validation.
            </p>

            <form onSubmit={(event) => void handleSave(event)} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Branch Name (English)
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
                  Branch Name (Arabic)
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Branch Code
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
                    City
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Latitude
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
                    Longitude
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
                    Geofence Radius Threshold: {formRadius}m
                  </label>
                  <span className="text-[10px] text-slate-400">Default: 150m</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="500"
                  step="25"
                  value={formRadius}
                  onChange={(e) => setFormRadius(parseInt(e.target.value))}
                  className="w-full accent-macq-orange cursor-pointer"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-macq-orange text-white hover:bg-macq-orange/90 shadow-md shadow-macq-orange/20 transition-all"
                >
                  Save Branch Geofence
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
