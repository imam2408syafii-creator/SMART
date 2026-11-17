import React, { useEffect, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AlertCircle, Edit3, Plus, Search, Trash2, X } from 'lucide-react';
import { apiFetch, formatCompactRupiah, formatRupiah } from '../lib/api';
import { MONTH_NAMES, type BudgetItem, type OrganizationUnit, type User } from '../types';
import { ConfirmModal } from './ConfirmModal';

interface BudgetResponse {
  fiscalYear: number;
  availableYears: number[];
  hasData: boolean;
  summary: {
    totalPagu: number;
    totalRealisasi: number;
    sisaAnggaran: number;
    persentasePenyerapan: number;
    paguZero: boolean;
    recordCount: number;
  };
  byUnit: Array<{
    unitId: number | null;
    unitName: string;
    unitCode: string;
    pagu: number;
    realisasi: number;
    sisa: number;
    persentase: number;
  }>;
  byMonth: Array<{
    month: number;
    label: string;
    pagu: number | null;
    realisasi: number | null;
    persentase: number | null;
    available: boolean;
  }>;
  items: BudgetItem[];
}

interface BudgetViewProps {
  currentUser: User;
}

export function BudgetView({ currentUser }: BudgetViewProps) {
  const canManage = currentUser.permissions.includes('budget:manage');

  const [data, setData] = useState<BudgetResponse | null>(null);
  const [units, setUnits] = useState<OrganizationUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');

  // Filters
  const [year, setYear] = useState('2026');
  const [month, setMonth] = useState('all');
  const [unitId, setUnitId] = useState('all');
  const [programQuery, setProgramQuery] = useState('');

  // CRUD modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<BudgetItem | null>(null);
  const [formState, setFormState] = useState({
    fiscal_year: 2026,
    month: 11,
    unit_id: '',
    program_name: '',
    activity_name: '',
    pagu: '',
    realisasi: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<BudgetItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function loadUnits() {
    try {
      const res = await apiFetch<{ units: OrganizationUnit[] }>('/api/profile');
      setUnits(res.units);
    } catch {
      // ignore
    }
  }

  async function loadBudget() {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      params.set('year', year);
      if (month !== 'all') params.set('month', month);
      if (unitId !== 'all') params.set('unit_id', unitId);
      if (programQuery.trim()) params.set('q', programQuery.trim());

      const res = await apiFetch<BudgetResponse>(`/api/budget?${params.toString()}`);
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat data anggaran.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUnits();
  }, []);

  useEffect(() => {
    loadBudget();
  }, [year, month, unitId]);

  function openCreateModal() {
    setEditingItem(null);
    setFormState({
      fiscal_year: Number(year) || 2026,
      month: month !== 'all' ? Number(month) : 11,
      unit_id: units[1]?.id ? String(units[1].id) : '',
      program_name: '',
      activity_name: '',
      pagu: '',
      realisasi: '',
      notes: '',
    });
    setModalOpen(true);
  }

  function openEditModal(item: BudgetItem) {
    setEditingItem(item);
    setFormState({
      fiscal_year: item.fiscal_year,
      month: item.month,
      unit_id: item.unit_id ? String(item.unit_id) : '',
      program_name: item.program_name,
      activity_name: item.activity_name,
      pagu: String(item.pagu),
      realisasi: String(item.realisasi),
      notes: item.notes,
    });
    setModalOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = {
        fiscal_year: Number(formState.fiscal_year),
        month: Number(formState.month),
        unit_id: formState.unit_id ? Number(formState.unit_id) : null,
        program_name: formState.program_name,
        activity_name: formState.activity_name,
        pagu: Number(formState.pagu),
        realisasi: Number(formState.realisasi),
        notes: formState.notes,
      };
      if (editingItem) {
        await apiFetch(`/api/budget/${editingItem.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        setFeedback('Data anggaran berhasil diperbarui.');
      } else {
        await apiFetch('/api/budget', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setFeedback('Data anggaran baru berhasil ditambahkan.');
      }
      setModalOpen(false);
      await loadBudget();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan data anggaran.');
    } finally {
      setSaving(false);
    }
  }

  async function executeDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiFetch(`/api/budget/${deleteTarget.id}`, { method: 'DELETE' });
      setDeleteTarget(null);
      setFeedback('Data anggaran berhasil dihapus.');
      await loadBudget();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menghapus data anggaran.');
    } finally {
      setDeleting(false);
    }
  }

  const yearsOptions = data?.availableYears || [2027, 2026, 2025];

  return (
    <div className="space-y-6">
      {feedback && (
        <div className="px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-800 flex items-center justify-between">
          <span>{feedback}</span>
          <button type="button" onClick={() => setFeedback('')}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {error && (
        <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700 flex items-center justify-between">
          <span>{error}</span>
          <button type="button" onClick={() => setError('')}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
            Penyerapan Anggaran (Data DEMO)
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Pemantauan pagu, realisasi, sisa anggaran, dan persentase penyerapan per bidang dan bulan
          </p>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={openCreateModal}
            className="px-4 py-2.5 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded-lg flex items-center gap-2 self-start sm:self-auto whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>Input Data Anggaran</span>
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
        <div className="md:col-span-2">
          <label className="block text-xs font-medium text-slate-500 mb-1">Tahun Anggaran</label>
          <select
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
          >
            {[...new Set([...yearsOptions, 2027, 2026, 2025])]
              .sort((a, b) => b - a)
              .map((y) => (
                <option key={y} value={String(y)}>
                  TA {y}
                </option>
              ))}
          </select>
        </div>

        <div className="md:col-span-3">
          <label className="block text-xs font-medium text-slate-500 mb-1">Bulan</label>
          <select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
          >
            <option value="all">Semua Bulan (Jan - Des)</option>
            {MONTH_NAMES.map((m, i) => (
              <option key={m} value={String(i + 1)}>
                {m}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-3">
          <label className="block text-xs font-medium text-slate-500 mb-1">Bidang / Unit</label>
          <select
            value={unitId}
            onChange={(e) => setUnitId(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
          >
            <option value="all">Semua Bidang</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            loadBudget();
          }}
          className="md:col-span-4 flex gap-2"
        >
          <div className="flex-1">
            <label className="block text-xs font-medium text-slate-500 mb-1">
              Program / Kegiatan
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={programQuery}
                onChange={(e) => setProgramQuery(e.target.value)}
                placeholder="Cari program atau sub-kegiatan..."
                className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
              />
            </div>
          </div>
          <button
            type="submit"
            className="self-end px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium rounded-lg"
          >
            Terapkan
          </button>
        </form>
      </div>

      {loading ? (
        <div className="h-96 bg-slate-200/70 rounded-xl animate-pulse" />
      ) : !data || !data.hasData ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-3">
          <AlertCircle className="w-10 h-10 text-amber-600 mx-auto" />
          <h3 className="text-base font-bold text-slate-900">
            Data Anggaran Belum Tersedia
          </h3>
          <p className="text-sm text-slate-600 max-w-lg mx-auto">
            Belum ada catatan pagu dan realisasi anggaran untuk kombinasi filter{' '}
            <strong>
              TA {year}
              {month !== 'all' ? ` · ${MONTH_NAMES[Number(month) - 1]}` : ''}
            </strong>
            . Sistem tidak membuat angka perkiraan otomatis apabila data resmi belum diinput.
          </p>
          {canManage && (
            <button
              type="button"
              onClick={openCreateModal}
              className="mt-2 px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Input Anggaran untuk Periode Ini</span>
            </button>
          )}
        </div>
      ) : (
        <>
          {/* 4 Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="text-xs font-medium text-slate-500">
                Pagu Anggaran (TA {data.fiscalYear})
              </div>
              <div className="mt-2 text-2xl font-bold text-slate-900 tabular-nums">
                {formatCompactRupiah(data.summary.totalPagu)}
              </div>
              <div className="mt-1 text-xs font-mono text-slate-500 tabular-nums">
                {formatRupiah(data.summary.totalPagu)}
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="text-xs font-medium text-slate-500">Realisasi Anggaran</div>
              <div className="mt-2 text-2xl font-bold text-blue-800 tabular-nums">
                {formatCompactRupiah(data.summary.totalRealisasi)}
              </div>
              <div className="mt-1 text-xs font-mono text-slate-500 tabular-nums">
                {formatRupiah(data.summary.totalRealisasi)}
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="text-xs font-medium text-slate-500">
                Sisa Anggaran (Pagu - Realisasi)
              </div>
              <div
                className={`mt-2 text-2xl font-bold tabular-nums ${
                  data.summary.sisaAnggaran < 0 ? 'text-red-600' : 'text-slate-900'
                }`}
              >
                {formatCompactRupiah(data.summary.sisaAnggaran)}
              </div>
              <div className="mt-1 text-xs font-mono text-slate-500 tabular-nums">
                {formatRupiah(data.summary.sisaAnggaran)}
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="text-xs font-medium text-slate-500">
                Persentase Penyerapan
              </div>
              <div className="mt-2 text-2xl font-bold text-amber-700 tabular-nums">
                {data.summary.paguZero
                  ? '0,00% (Pagu 0)'
                  : `${data.summary.persentasePenyerapan.toFixed(2)}%`}
              </div>
              <div className="mt-2.5 w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-600 rounded-full"
                  style={{
                    width: `${Math.min(Math.max(data.summary.persentasePenyerapan, 0), 100)}%`,
                  }}
                />
              </div>
            </div>
          </div>

          {/* 3 Interactive Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Chart 1: Pagu vs Realisasi per Bidang */}
            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6">
              <h3 className="text-base font-bold text-slate-900">
                1. Grafik Batang Pagu &amp; Realisasi per Bidang (Juta Rp)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5 mb-4">
                Perbandingan alokasi pagu dan serapan aktual berdasarkan filter aktif (Data DEMO)
              </p>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={data.byUnit.map((u) => ({
                      name: u.unitCode,
                      fullName: u.unitName,
                      Pagu: Number((u.pagu / 1_000_000).toFixed(1)),
                      Realisasi: Number((u.realisasi / 1_000_000).toFixed(1)),
                    }))}
                    margin={{ top: 10, right: 10, left: 0, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <Tooltip
                      formatter={(v: unknown, name: unknown) => [
                        `Rp ${Number(v).toLocaleString('id-ID')} Juta`,
                        String(name),
                      ]}
                      labelFormatter={(_label, payload) =>
                        payload?.[0]?.payload?.fullName || String(_label)
                      }
                      contentStyle={{
                        backgroundColor: '#fff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    <Bar dataKey="Pagu" fill="#1d4ed8" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Realisasi" fill="#d97706" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 3: Persentase Penyerapan per Bidang */}
            <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6">
              <h3 className="text-base font-bold text-slate-900">
                2. Grafik Persentase Penyerapan (%)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5 mb-4">
                Rumus: (Realisasi / Pagu) × 100% · Aman terhadap pagu nol
              </p>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    layout="vertical"
                    data={data.byUnit.map((u) => ({
                      name: u.unitCode,
                      fullName: u.unitName,
                      persentase: u.persentase,
                    }))}
                    margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                    <XAxis
                      type="number"
                      domain={[0, 100]}
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      tickFormatter={(v) => `${v}%`}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={85}
                      tick={{ fontSize: 11, fill: '#334155' }}
                    />
                    <Tooltip
                      formatter={(v: unknown) => [`${Number(v).toFixed(2)}%`, 'Penyerapan']}
                      labelFormatter={(_label, payload) =>
                        payload?.[0]?.payload?.fullName || String(_label)
                      }
                      contentStyle={{
                        backgroundColor: '#fff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                    />
                    <Bar dataKey="persentase" name="Penyerapan" radius={[0, 4, 4, 0]}>
                      {data.byUnit.map((u, idx) => (
                        <Cell
                          key={u.unitCode + idx}
                          fill={u.persentase >= 80 ? '#1d4ed8' : '#d97706'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Chart 2: Perkembangan Realisasi per Bulan */}
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <h3 className="text-base font-bold text-slate-900">
              3. Grafik Perkembangan Realisasi per Bulan (TA {data.fiscalYear})
            </h3>
            <p className="text-xs text-slate-500 mt-0.5 mb-4">
              Tren realisasi bulanan (bulan yang belum memiliki data tampil sebagai titik kosong /
              belum tersedia)
            </p>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={data.byMonth.map((m) => ({
                    ...m,
                    paguJuta: m.pagu !== null ? Number((m.pagu / 1_000_000).toFixed(1)) : null,
                    realJuta:
                      m.realisasi !== null ? Number((m.realisasi / 1_000_000).toFixed(1)) : null,
                  }))}
                  margin={{ top: 10, right: 15, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis
                    tick={{ fontSize: 12, fill: '#64748b' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `${v} Jt`}
                  />
                  <Tooltip
                    formatter={(v: unknown, name: unknown) => {
                      if (v === null || v === undefined) return ['Belum tersedia', String(name)];
                      return [`Rp ${Number(v).toLocaleString('id-ID')} Juta`, String(name)];
                    }}
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="paguJuta"
                    name="Pagu Bulanan"
                    stroke="#1d4ed8"
                    fill="#dbeafe"
                    strokeWidth={2}
                    connectNulls={false}
                  />
                  <Area
                    type="monotone"
                    dataKey="realJuta"
                    name="Realisasi Bulanan"
                    stroke="#16a34a"
                    fill="#dcfce7"
                    strokeWidth={2}
                    connectNulls={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Detail Table */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                Rincian Data Anggaran ({data.items.length} Baris)
              </h3>
              <span className="text-xs text-slate-500">Semua angka berlabel DEMO</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                    <th className="py-3 px-4">Periode</th>
                    <th className="py-3 px-4">Bidang</th>
                    <th className="py-3 px-4">Program &amp; Kegiatan</th>
                    <th className="py-3 px-4 text-right">Pagu</th>
                    <th className="py-3 px-4 text-right">Realisasi</th>
                    <th className="py-3 px-4 text-right">Sisa</th>
                    <th className="py-3 px-4 text-right">Serapan</th>
                    {canManage && <th className="py-3 px-4 text-right">Aksi</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {data.items.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 whitespace-nowrap tabular-nums text-slate-700 font-medium">
                        {MONTH_NAMES[item.month - 1]} {item.fiscal_year}
                      </td>
                      <td className="py-3 px-4 text-slate-600 max-w-[160px] truncate">
                        {item.unit_name || '-'}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{item.program_name}</div>
                        {item.activity_name && (
                          <div className="text-slate-500 mt-0.5">{item.activity_name}</div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-800 whitespace-nowrap">
                        {formatRupiah(item.pagu)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-blue-800 font-medium whitespace-nowrap">
                        {formatRupiah(item.realisasi)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700 whitespace-nowrap">
                        {formatRupiah(item.sisa)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-amber-700 whitespace-nowrap">
                        {item.pagu === 0 ? '0,00% (Pagu 0)' : `${item.persentase.toFixed(2)}%`}
                      </td>
                      {canManage && (
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => openEditModal(item)}
                            className="p-1.5 text-slate-500 hover:text-blue-700 rounded"
                            title="Edit"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(item)}
                            className="p-1.5 text-slate-500 hover:text-red-600 rounded"
                            title="Hapus"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Create / Edit Budget Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                {editingItem ? 'Edit Data Anggaran' : 'Input Data Anggaran'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tahun Anggaran
                  </label>
                  <input
                    type="number"
                    required
                    min={2020}
                    max={2050}
                    value={formState.fiscal_year}
                    onChange={(e) =>
                      setFormState({ ...formState, fiscal_year: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Bulan</label>
                  <select
                    value={formState.month}
                    onChange={(e) => setFormState({ ...formState, month: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
                  >
                    {MONTH_NAMES.map((m, idx) => (
                      <option key={m} value={idx + 1}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Bidang</label>
                <select
                  value={formState.unit_id}
                  onChange={(e) => setFormState({ ...formState, unit_id: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
                >
                  <option value="">-- Umum / BAPPEDA --</option>
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nama Program
                </label>
                <input
                  type="text"
                  required
                  value={formState.program_name}
                  onChange={(e) => setFormState({ ...formState, program_name: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Sub-Kegiatan / Uraian
                </label>
                <input
                  type="text"
                  value={formState.activity_name}
                  onChange={(e) => setFormState({ ...formState, activity_name: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Pagu Anggaran (Rp)
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    step="1"
                    value={formState.pagu}
                    onChange={(e) => setFormState({ ...formState, pagu: e.target.value })}
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Realisasi Anggaran (Rp)
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    step="1"
                    value={formState.realisasi}
                    onChange={(e) => setFormState({ ...formState, realisasi: e.target.value })}
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Catatan</label>
                <input
                  type="text"
                  value={formState.notes}
                  onChange={(e) => setFormState({ ...formState, notes: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg disabled:opacity-60"
                >
                  {saving ? 'Menyimpan...' : 'Simpan Data'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Hapus Data Anggaran"
        message={`Apakah Anda yakin ingin menghapus entri anggaran "${deleteTarget?.program_name}"?`}
        loading={deleting}
        onConfirm={executeDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
