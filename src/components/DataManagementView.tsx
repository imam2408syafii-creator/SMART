import { useEffect, useState } from 'react';
import { Download, FileSpreadsheet, FileText, FolderKanban } from 'lucide-react';
import { apiFetch, formatDateIndo, formatRupiah } from '../lib/api';
import { MONTH_NAMES, type ActivityItem, type BudgetItem, type User } from '../types';

interface DataManagementViewProps {
  currentUser: User;
  onOpenActivity: (activityId: number) => void;
  onNavigate: (menu: string) => void;
}

export function DataManagementView({
  currentUser,
  onOpenActivity,
  onNavigate,
}: DataManagementViewProps) {
  const [tab, setTab] = useState<'activities' | 'budget'>('activities');
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [budgets, setBudgets] = useState<BudgetItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      apiFetch<{ activities: ActivityItem[] }>('/api/activities'),
      apiFetch<{ items: BudgetItem[] }>('/api/budget?year=2026'),
    ])
      .then(([actRes, budRes]) => {
        setActivities(actRes.activities);
        setBudgets(budRes.items);
      })
      .finally(() => setLoading(false));
  }, []);

  function exportCsv() {
    let csv = '';
    let filename = '';
    if (tab === 'activities') {
      csv = 'ID Kegiatan,Judul,Tanggal,Lokasi,Bidang,Jumlah Foto,Jumlah Surat Tugas\n';
      for (const a of activities) {
        const row = [
          a.activity_code,
          `"${a.title.replace(/"/g, '""')}"`,
          a.activity_date,
          `"${a.location.replace(/"/g, '""')}"`,
          `"${(a.unit_name || '-').replace(/"/g, '""')}"`,
          a.photos.length,
          a.letters.length,
        ].join(',');
        csv += row + '\n';
      }
      filename = 'rekap_kegiatan_smart_bappeda.csv';
    } else {
      csv = 'Tahun,Bulan,Bidang,Program,Kegiatan,Pagu,Realisasi,Sisa,Persentase\n';
      for (const b of budgets) {
        const row = [
          b.fiscal_year,
          MONTH_NAMES[b.month - 1],
          `"${(b.unit_name || '-').replace(/"/g, '""')}"`,
          `"${b.program_name.replace(/"/g, '""')}"`,
          `"${b.activity_name.replace(/"/g, '""')}"`,
          b.pagu,
          b.realisasi,
          b.sisa,
          `${b.persentase}%`,
        ].join(',');
        csv += row + '\n';
      }
      filename = 'rekap_anggaran_smart_bappeda.csv';
    }

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900">Manajemen Data Terpadu</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Pusat pemeriksaan kelengkapan data kegiatan, lampiran surat tugas, dan entri anggaran (
            {currentUser.role_name})
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={exportCsv}
            className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 text-xs font-semibold rounded-lg inline-flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Ekspor CSV</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate(tab === 'activities' ? 'activities' : 'budget')}
            className="px-3.5 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg"
          >
            Kelola di Halaman Utama
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg w-fit">
        <button
          type="button"
          onClick={() => setTab('activities')}
          className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 ${
            tab === 'activities'
              ? 'bg-white text-blue-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <FolderKanban className="w-3.5 h-3.5" />
          <span>Data Kegiatan ({activities.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setTab('budget')}
          className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 ${
            tab === 'budget'
              ? 'bg-white text-blue-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <FileSpreadsheet className="w-3.5 h-3.5" />
          <span>Data Anggaran TA 2026 ({budgets.length})</span>
        </button>
      </div>

      {loading ? (
        <div className="h-72 bg-slate-200/70 rounded-xl animate-pulse" />
      ) : tab === 'activities' ? (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4">ID Kegiatan</th>
                  <th className="py-3 px-4">Judul Kegiatan</th>
                  <th className="py-3 px-4">Tanggal</th>
                  <th className="py-3 px-4">Bidang</th>
                  <th className="py-3 px-4 text-center">Foto</th>
                  <th className="py-3 px-4 text-center">Surat Tugas PDF</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {activities.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 font-mono font-semibold text-blue-800 whitespace-nowrap">
                      {a.activity_code}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-900 max-w-xs truncate">
                      {a.title}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap tabular-nums text-slate-600">
                      {formatDateIndo(a.activity_date)}
                    </td>
                    <td className="py-3 px-4 text-slate-600 max-w-[180px] truncate">
                      {a.unit_name || '-'}
                    </td>
                    <td className="py-3 px-4 text-center tabular-nums">{a.photos.length}</td>
                    <td className="py-3 px-4 text-center">
                      {a.letters.length > 0 ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                          <FileText className="w-3.5 h-3.5" />
                          <span>{a.letters.length} Terlampir</span>
                        </span>
                      ) : (
                        <span className="text-amber-700">Belum diunggah</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => onOpenActivity(a.id)}
                        className="text-blue-700 hover:text-blue-900 font-semibold"
                      >
                        Buka Detail
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4">Bulan</th>
                  <th className="py-3 px-4">Bidang</th>
                  <th className="py-3 px-4">Program</th>
                  <th className="py-3 px-4 text-right">Pagu</th>
                  <th className="py-3 px-4 text-right">Realisasi</th>
                  <th className="py-3 px-4 text-right">Serapan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {budgets.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 whitespace-nowrap font-medium text-slate-800">
                      {MONTH_NAMES[b.month - 1]} {b.fiscal_year}
                    </td>
                    <td className="py-3 px-4 text-slate-600 max-w-[180px] truncate">
                      {b.unit_name || '-'}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-900">{b.program_name}</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums">
                      {formatRupiah(b.pagu)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-blue-800">
                      {formatRupiah(b.realisasi)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-amber-700">
                      {b.persentase.toFixed(2)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
