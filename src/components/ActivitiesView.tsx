import React, { useEffect, useState } from 'react';
import {
  Calendar,
  Download,
  Edit3,
  Eye,
  FileText,
  Image as ImageIcon,
  Lock,
  MapPin,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  apiFetch,
  fetchProtectedBlob,
  formatDateIndo,
  formatFileSize,
} from '../lib/api';
import {
  MONTH_NAMES,
  type ActivityItem,
  type OrganizationUnit,
  type User,
} from '../types';
import { ConfirmModal } from './ConfirmModal';

interface ActivitiesViewProps {
  currentUser: User;
  initialActivityId?: number | null;
  onClearInitialActivity?: () => void;
}

export function ActivitiesView({
  currentUser,
  initialActivityId,
  onClearInitialActivity,
}: ActivitiesViewProps) {
  const canManage = currentUser.permissions.includes('activities:manage');
  const canDownloadLetters = currentUser.permissions.includes('letters:download');

  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [units, setUnits] = useState<OrganizationUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');

  // Filters
  const [year, setYear] = useState<string>('2026');
  const [month, setMonth] = useState<string>('all');
  const [unitId, setUnitId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Detail View Modal
  const [selectedActivity, setSelectedActivity] = useState<ActivityItem | null>(null);
  const [lightboxImg, setLightboxImg] = useState<{ src: string; caption: string } | null>(null);
  const [pdfPreview, setPdfPreview] = useState<{ url: string; title: string } | null>(null);
  const [loadingPdf, setLoadingPdf] = useState(false);

  // Create / Edit Modal
  const [formOpen, setFormOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<ActivityItem | null>(null);
  const [formState, setFormState] = useState({
    title: '',
    activity_date: new Date().toISOString().slice(0, 10),
    location: '',
    unit_id: '',
    description: '',
    is_demo: true,
  });
  const [newPhotos, setNewPhotos] = useState<FileList | null>(null);
  const [newLetterFile, setNewLetterFile] = useState<File | null>(null);
  const [newLetterNumber, setNewLetterNumber] = useState('');
  const [saving, setSaving] = useState(false);

  // Delete Confirm
  const [deleteTarget, setDeleteTarget] = useState<{
    type: 'activity' | 'photo' | 'letter';
    id: number;
    label: string;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Quick upload inside detail view
  const [uploadingExtra, setUploadingExtra] = useState(false);
  const [extraLetterNo, setExtraLetterNo] = useState('');
  const [extraLetterFile, setExtraLetterFile] = useState<File | null>(null);

  async function loadUnits() {
    try {
      const res = await apiFetch<{ units: OrganizationUnit[] }>('/api/profile');
      setUnits(res.units);
    } catch {
      // non-fatal
    }
  }

  async function loadActivities() {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (year !== 'all') params.set('year', year);
      if (month !== 'all') params.set('month', month);
      if (unitId !== 'all') params.set('unit_id', unitId);
      if (searchQuery.trim()) params.set('q', searchQuery.trim());

      const res = await apiFetch<{ activities: ActivityItem[] }>(
        `/api/activities?${params.toString()}`
      );
      setActivities(res.activities);

      if (selectedActivity) {
        const refreshed = res.activities.find((a) => a.id === selectedActivity.id);
        if (refreshed) setSelectedActivity(refreshed);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat daftar kegiatan.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUnits();
  }, []);

  useEffect(() => {
    loadActivities();
  }, [year, month, unitId]);

  useEffect(() => {
    if (initialActivityId) {
      apiFetch<{ activity: ActivityItem }>(`/api/activities/${initialActivityId}`)
        .then((res) => {
          setSelectedActivity(res.activity);
          onClearInitialActivity?.();
        })
        .catch(() => {
          onClearInitialActivity?.();
        });
    }
  }, [initialActivityId]);

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    loadActivities();
  }

  function openCreateModal() {
    setEditingActivity(null);
    setFormState({
      title: '',
      activity_date: `${year === 'all' ? '2026' : year}-${
        month === 'all' ? '11' : month.padStart(2, '0')
      }-15`,
      location: '',
      unit_id: units[1]?.id ? String(units[1].id) : '',
      description: '',
      is_demo: true,
    });
    setNewPhotos(null);
    setNewLetterFile(null);
    setNewLetterNumber('');
    setFormOpen(true);
  }

  function openEditModal(act: ActivityItem) {
    setEditingActivity(act);
    setFormState({
      title: act.title,
      activity_date: act.activity_date,
      location: act.location,
      unit_id: act.unit_id ? String(act.unit_id) : '',
      description: act.description,
      is_demo: act.is_demo === 1,
    });
    setNewPhotos(null);
    setNewLetterFile(null);
    setNewLetterNumber('');
    setFormOpen(true);
  }

  async function handleSaveActivity(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      let actId: number;
      if (editingActivity) {
        await apiFetch(`/api/activities/${editingActivity.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            title: formState.title,
            activity_date: formState.activity_date,
            location: formState.location,
            unit_id: formState.unit_id ? Number(formState.unit_id) : null,
            description: formState.description,
          }),
        });
        actId = editingActivity.id;
      } else {
        const created = await apiFetch<{ id: number }>('/api/activities', {
          method: 'POST',
          body: JSON.stringify({
            title: formState.title,
            activity_date: formState.activity_date,
            location: formState.location,
            unit_id: formState.unit_id ? Number(formState.unit_id) : null,
            description: formState.description,
            is_demo: formState.is_demo,
          }),
        });
        actId = created.id;
      }

      if (newPhotos && newPhotos.length > 0) {
        const fd = new FormData();
        Array.from(newPhotos).forEach((f) => fd.append('photos', f));
        await apiFetch(`/api/activities/${actId}/photos`, { method: 'POST', body: fd });
      }

      if (newLetterFile) {
        const fd = new FormData();
        fd.append('file', newLetterFile);
        fd.append('letter_number', newLetterNumber || `ST-${actId}-${Date.now()}`);
        await apiFetch(`/api/activities/${actId}/letter`, { method: 'POST', body: fd });
      }

      setFormOpen(false);
      setFeedback(
        editingActivity ? 'Kegiatan berhasil diperbarui.' : 'Kegiatan baru berhasil ditambahkan.'
      );
      await loadActivities();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan kegiatan.');
    } finally {
      setSaving(false);
    }
  }

  async function handleAddPhotosToDetail(e: React.ChangeEvent<HTMLInputElement>) {
    if (!selectedActivity || !e.target.files?.length) return;
    setUploadingExtra(true);
    try {
      const fd = new FormData();
      Array.from(e.target.files).forEach((f) => fd.append('photos', f));
      await apiFetch(`/api/activities/${selectedActivity.id}/photos`, {
        method: 'POST',
        body: fd,
      });
      const refreshed = await apiFetch<{ activity: ActivityItem }>(
        `/api/activities/${selectedActivity.id}`
      );
      setSelectedActivity(refreshed.activity);
      setFeedback('Foto dokumentasi berhasil ditambahkan.');
      await loadActivities();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengunggah foto.');
    } finally {
      setUploadingExtra(false);
    }
  }

  async function handleAddLetterToDetail(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedActivity || !extraLetterFile) return;
    setUploadingExtra(true);
    try {
      const fd = new FormData();
      fd.append('file', extraLetterFile);
      fd.append('letter_number', extraLetterNo || `ST-${selectedActivity.activity_code}`);
      await apiFetch(`/api/activities/${selectedActivity.id}/letter`, {
        method: 'POST',
        body: fd,
      });
      setExtraLetterFile(null);
      setExtraLetterNo('');
      const refreshed = await apiFetch<{ activity: ActivityItem }>(
        `/api/activities/${selectedActivity.id}`
      );
      setSelectedActivity(refreshed.activity);
      setFeedback('Lampiran surat tugas PDF berhasil diunggah.');
      await loadActivities();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengunggah surat tugas PDF.');
    } finally {
      setUploadingExtra(false);
    }
  }

  async function handlePreviewLetter(letterId: number, title: string) {
    setLoadingPdf(true);
    setError('');
    try {
      const blob = await fetchProtectedBlob(`/api/files/letters/${letterId}`);
      const url = URL.createObjectURL(blob);
      setPdfPreview({ url, title });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tidak dapat membuka lampiran PDF.');
    } finally {
      setLoadingPdf(false);
    }
  }

  async function handleDownloadLetter(letterId: number, fileName: string) {
    try {
      const blob = await fetchProtectedBlob(`/api/files/letters/${letterId}?download=1`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengunduh surat tugas PDF.');
    }
  }

  async function executeDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      if (deleteTarget.type === 'activity') {
        await apiFetch(`/api/activities/${deleteTarget.id}`, { method: 'DELETE' });
        if (selectedActivity?.id === deleteTarget.id) setSelectedActivity(null);
        setFeedback(`Kegiatan "${deleteTarget.label}" berhasil dihapus.`);
      } else if (deleteTarget.type === 'photo') {
        await apiFetch(`/api/photos/${deleteTarget.id}`, { method: 'DELETE' });
        if (selectedActivity) {
          const refreshed = await apiFetch<{ activity: ActivityItem }>(
            `/api/activities/${selectedActivity.id}`
          );
          setSelectedActivity(refreshed.activity);
        }
        setFeedback('Foto dokumentasi dihapus.');
      } else if (deleteTarget.type === 'letter') {
        await apiFetch(`/api/letters/${deleteTarget.id}`, { method: 'DELETE' });
        if (selectedActivity) {
          const refreshed = await apiFetch<{ activity: ActivityItem }>(
            `/api/activities/${selectedActivity.id}`
          );
          setSelectedActivity(refreshed.activity);
        }
        setFeedback('Lampiran surat tugas dihapus.');
      }
      setDeleteTarget(null);
      await loadActivities();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menghapus data.');
    } finally {
      setDeleting(false);
    }
  }

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

      {/* Header & Primary Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900">Kegiatan Bulanan BAPPEDA</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Daftar kegiatan berdasarkan bulan dan tahun beserta galeri dokumentasi foto dan surat
            tugas PDF
          </p>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={openCreateModal}
            className="px-4 py-2.5 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded-lg flex items-center gap-2 self-start sm:self-auto whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Kegiatan</span>
          </button>
        )}
      </div>

      {/* Filter Bar: Tahun, Bulan (Jan-Des), Bidang, Pencarian */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-slate-500 mb-1">Tahun</label>
            <select
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
            >
              <option value="all">Semua Tahun</option>
              <option value="2027">2027</option>
              <option value="2026">2026</option>
              <option value="2025">2025</option>
              <option value="2024">2024</option>
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

          <form onSubmit={handleSearchSubmit} className="md:col-span-7 flex gap-2 items-end">
            <div className="flex-1">
              <label className="block text-xs font-medium text-slate-500 mb-1">
                Pencarian Kegiatan
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari kode, nama kegiatan, lokasi, atau deskripsi..."
                  className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
                />
              </div>
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium rounded-lg whitespace-nowrap"
            >
              Cari
            </button>
          </form>
        </div>

        {/* Bulan Januari - Desember Quick Selector */}
        <div className="pt-2 border-t border-slate-100">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => setMonth('all')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap shrink-0 transition-colors ${
                month === 'all'
                  ? 'bg-blue-700 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Semua Bulan
            </button>
            {MONTH_NAMES.map((name, idx) => {
              const mVal = String(idx + 1);
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => setMonth(mVal)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap shrink-0 transition-colors ${
                    month === mVal
                      ? 'bg-blue-700 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {name}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Activities Card / Gallery Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-80 bg-slate-200/70 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : activities.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <Calendar className="w-10 h-10 text-slate-300 mx-auto" />
          <h3 className="text-base font-semibold text-slate-900 mt-3">
            Tidak ada kegiatan pada filter ini
          </h3>
          <p className="text-sm text-slate-500 mt-1">
            Coba ubah pilihan bulan, tahun, atau kata kunci pencarian.
          </p>
          {canManage && (
            <button
              type="button"
              onClick={openCreateModal}
              className="mt-4 px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Kegiatan Baru</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {activities.map((act) => {
            const cover = act.photos[0]?.file_path;
            return (
              <article
                key={act.id}
                className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col justify-between hover:border-blue-300 transition-colors"
              >
                <div>
                  <button
                    type="button"
                    onClick={() => setSelectedActivity(act)}
                    className="w-full aspect-[16/10] bg-slate-100 relative overflow-hidden block text-left"
                  >
                    {cover ? (
                      <img
                        src={cover}
                        alt={act.title}
                        className="w-full h-full object-cover hover:scale-105 transition-transform duration-200"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 gap-1">
                        <ImageIcon className="w-8 h-8" />
                        <span className="text-xs">Belum ada foto</span>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900/70 via-transparent to-transparent" />
                    <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between text-xs text-white">
                      <span className="font-mono font-semibold text-amber-300">
                        {act.activity_code}
                      </span>
                      <span className="tabular-nums">
                        {act.photos.length} Foto · {act.letters.length} PDF
                      </span>
                    </div>
                  </button>

                  <div className="p-5">
                    <div className="text-xs text-slate-500 flex flex-wrap items-center gap-1.5">
                      <span className="tabular-nums font-medium text-blue-800">
                        {formatDateIndo(act.activity_date)}
                      </span>
                      {act.unit_name && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="truncate max-w-[200px]">{act.unit_name}</span>
                        </>
                      )}
                    </div>

                    <h3 className="text-base font-bold text-slate-900 mt-1.5 line-clamp-2 leading-snug">
                      {act.title}
                    </h3>

                    <p className="text-xs text-slate-600 mt-2 line-clamp-2 leading-relaxed">
                      {act.description}
                    </p>

                    <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{act.location}</span>
                    </div>
                  </div>
                </div>

                <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedActivity(act)}
                    className="text-xs font-semibold text-blue-700 hover:text-blue-900 inline-flex items-center gap-1"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Detail &amp; Lampiran</span>
                  </button>

                  {canManage && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEditModal(act)}
                        className="p-1.5 text-slate-500 hover:text-blue-700 rounded-md hover:bg-white"
                        title="Edit Kegiatan"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setDeleteTarget({ type: 'activity', id: act.id, label: act.title })
                        }
                        className="p-1.5 text-slate-500 hover:text-red-600 rounded-md hover:bg-white"
                        title="Hapus Kegiatan"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Activity Detail Modal (Full 8 fields + Gallery + Protected PDF) */}
      {selectedActivity && (
        <div className="fixed inset-0 z-40 bg-slate-900/55 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden shadow-xl">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
              <div>
                <div className="text-xs font-mono font-semibold text-blue-700">
                  ID Kegiatan: {selectedActivity.activity_code} ·{' '}
                  {selectedActivity.is_demo ? 'Data DEMO' : 'Data Terinput'}
                </div>
                <h3 className="text-lg font-bold text-slate-900 mt-0.5">
                  {selectedActivity.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedActivity(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6">
              {/* Metadata Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                <div>
                  <span className="text-slate-500 block">Tanggal Pelaksanaan</span>
                  <span className="font-semibold text-slate-900 mt-0.5 block tabular-nums">
                    {formatDateIndo(selectedActivity.activity_date)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Lokasi Kegiatan</span>
                  <span className="font-semibold text-slate-900 mt-0.5 block">
                    {selectedActivity.location}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Bidang Penyelenggara</span>
                  <span className="font-semibold text-slate-900 mt-0.5 block">
                    {selectedActivity.unit_name || '-'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Tanggal Input Data</span>
                  <span className="font-semibold text-slate-900 mt-0.5 block tabular-nums">
                    {formatDateIndo(selectedActivity.created_at)}
                  </span>
                </div>
              </div>

              {/* Description */}
              <div>
                <h4 className="text-sm font-bold text-slate-900 mb-1.5">Deskripsi Kegiatan</h4>
                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                  {selectedActivity.description}
                </p>
              </div>

              {/* Photo Gallery */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-slate-900">
                    Foto Dokumentasi ({selectedActivity.photos.length})
                  </h4>
                  {canManage && (
                    <label className="cursor-pointer px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5">
                      <Upload className="w-3.5 h-3.5" />
                      <span>{uploadingExtra ? 'Mengunggah...' : 'Tambah Foto'}</span>
                      <input
                        type="file"
                        multiple
                        accept="image/jpeg,image/png,image/webp"
                        onChange={handleAddPhotosToDetail}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>

                {selectedActivity.photos.length === 0 ? (
                  <p className="text-xs text-slate-500 py-3">Belum ada foto dokumentasi.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {selectedActivity.photos.map((photo) => (
                      <div
                        key={photo.id}
                        className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50 relative group"
                      >
                        <button
                          type="button"
                          onClick={() =>
                            setLightboxImg({ src: photo.file_path, caption: photo.caption })
                          }
                          className="w-full aspect-[4/3] block overflow-hidden"
                        >
                          <img
                            src={photo.file_path}
                            alt={photo.caption}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            referrerPolicy="no-referrer"
                          />
                        </button>
                        <div className="p-2.5 flex items-center justify-between gap-2">
                          <span className="text-xs text-slate-600 truncate">
                            {photo.caption || 'Dokumentasi kegiatan'}
                          </span>
                          {canManage && (
                            <button
                              type="button"
                              onClick={() =>
                                setDeleteTarget({
                                  type: 'photo',
                                  id: photo.id,
                                  label: photo.caption || 'Foto dokumentasi',
                                })
                              }
                              className="text-slate-400 hover:text-red-600 p-1 shrink-0"
                              title="Hapus Foto"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Assignment Letters (Surat Tugas PDF) */}
              <div className="space-y-3 pt-4 border-t border-slate-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">
                      Lampiran Surat Tugas (PDF Terproteksi)
                    </h4>
                    <p className="text-xs text-slate-500">
                      Akses dokumen PDF diawasi dan dicatat oleh sistem sesuai hak akses peran
                    </p>
                  </div>
                </div>

                {!canDownloadLetters ? (
                  <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-center gap-2">
                    <Lock className="w-4 h-4 shrink-0 text-amber-700" />
                    <span>
                      Peran Anda saat ini tidak memiliki izin untuk membuka atau mengunduh lampiran
                      surat tugas PDF. Hubungi Administrator apabila memerlukan akses.
                    </span>
                  </div>
                ) : selectedActivity.letters.length === 0 ? (
                  <p className="text-xs text-slate-500">Belum ada lampiran surat tugas PDF.</p>
                ) : (
                  <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl">
                    {selectedActivity.letters.map((letter) => (
                      <div
                        key={letter.id}
                        className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-lg bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                            <FileText className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-slate-900 truncate">
                              Nomor: {letter.letter_number}
                            </div>
                            <div className="text-xs text-slate-500 truncate tabular-nums">
                              {letter.file_name} · {formatFileSize(letter.file_size)}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            disabled={loadingPdf}
                            onClick={() =>
                              handlePreviewLetter(letter.id, `Surat Tugas ${letter.letter_number}`)
                            }
                            className="px-3 py-1.5 text-xs font-semibold text-blue-800 bg-blue-50 hover:bg-blue-100 rounded-lg inline-flex items-center gap-1"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Lihat PDF</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDownloadLetter(letter.id, letter.file_name)}
                            className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg inline-flex items-center gap-1"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Unduh</span>
                          </button>
                          {canManage && (
                            <button
                              type="button"
                              onClick={() =>
                                setDeleteTarget({
                                  type: 'letter',
                                  id: letter.id,
                                  label: letter.letter_number,
                                })
                              }
                              className="p-1.5 text-slate-400 hover:text-red-600"
                              title="Hapus Surat Tugas"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {canManage && (
                  <form
                    onSubmit={handleAddLetterToDetail}
                    className="p-4 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-1 sm:grid-cols-12 gap-3 items-end"
                  >
                    <div className="sm:col-span-4">
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Nomor Surat Tugas
                      </label>
                      <input
                        type="text"
                        required
                        value={extraLetterNo}
                        onChange={(e) => setExtraLetterNo(e.target.value)}
                        placeholder="Contoh: 094/102/2026"
                        className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div className="sm:col-span-5">
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        File PDF (Maks. 10 MB)
                      </label>
                      <input
                        type="file"
                        required
                        accept="application/pdf"
                        onChange={(e) => setExtraLetterFile(e.target.files?.[0] || null)}
                        className="w-full text-xs text-slate-600 file:mr-2 file:py-1 file:px-2.5 file:rounded file:border-0 file:bg-blue-100 file:text-blue-800 file:font-semibold"
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <button
                        type="submit"
                        disabled={uploadingExtra || !extraLetterFile}
                        className="w-full py-2 px-3 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg disabled:opacity-60"
                      >
                        Unggah Surat Tugas
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Embedded PDF Viewer Modal */}
      {pdfPreview && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-4xl h-[86vh] flex flex-col overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
              <span className="text-sm font-bold text-slate-900">{pdfPreview.title}</span>
              <button
                type="button"
                onClick={() => {
                  URL.revokeObjectURL(pdfPreview.url);
                  setPdfPreview(null);
                }}
                className="px-3 py-1 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg"
              >
                Tutup Pratinjau
              </button>
            </div>
            <iframe
              src={pdfPreview.url}
              title={pdfPreview.title}
              className="w-full flex-1 bg-slate-100"
            />
          </div>
        </div>
      )}

      {/* Lightbox Photo Modal */}
      {lightboxImg && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/85 flex items-center justify-center p-4"
          onClick={() => setLightboxImg(null)}
        >
          <div
            className="max-w-3xl w-full bg-white rounded-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={lightboxImg.src}
              alt={lightboxImg.caption}
              className="w-full max-h-[75vh] object-contain bg-slate-950"
              referrerPolicy="no-referrer"
            />
            <div className="p-4 flex items-center justify-between gap-4">
              <span className="text-xs text-slate-700">{lightboxImg.caption}</span>
              <button
                type="button"
                onClick={() => setLightboxImg(null)}
                className="px-3 py-1.5 text-xs font-semibold bg-slate-100 rounded-lg"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Activity Modal */}
      {formOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                {editingActivity ? 'Edit Data Kegiatan' : 'Tambah Kegiatan Bulanan'}
              </h3>
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveActivity} className="p-6 overflow-y-auto space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nama / Judul Kegiatan
                </label>
                <input
                  type="text"
                  required
                  value={formState.title}
                  onChange={(e) => setFormState({ ...formState, title: e.target.value })}
                  placeholder="Contoh: Rapat Koordinasi Evaluasi RKPD Triwulan IV"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tanggal Pelaksanaan
                  </label>
                  <input
                    type="date"
                    required
                    value={formState.activity_date}
                    onChange={(e) =>
                      setFormState({ ...formState, activity_date: e.target.value })
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Bidang Penyelenggara
                  </label>
                  <select
                    value={formState.unit_id}
                    onChange={(e) => setFormState({ ...formState, unit_id: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
                  >
                    <option value="">-- Pilih Bidang --</option>
                    {units.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Lokasi Kegiatan
                </label>
                <input
                  type="text"
                  required
                  value={formState.location}
                  onChange={(e) => setFormState({ ...formState, location: e.target.value })}
                  placeholder="Contoh: Aula BAPPEDA Kabupaten Sidoarjo"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Deskripsi Kegiatan
                </label>
                <textarea
                  rows={3}
                  required
                  value={formState.description}
                  onChange={(e) => setFormState({ ...formState, description: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Unggah Foto Dokumentasi (Opsional, JPG/PNG)
                  </label>
                  <input
                    type="file"
                    multiple
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => setNewPhotos(e.target.files)}
                    className="w-full text-xs text-slate-600 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-700 file:font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Lampiran Surat Tugas PDF (Opsional)
                  </label>
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={(e) => setNewLetterFile(e.target.files?.[0] || null)}
                    className="w-full text-xs text-slate-600 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-amber-50 file:text-amber-800 file:font-semibold"
                  />
                  {newLetterFile && (
                    <input
                      type="text"
                      value={newLetterNumber}
                      onChange={(e) => setNewLetterNumber(e.target.value)}
                      placeholder="Nomor Surat Tugas"
                      className="mt-2 w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg"
                    />
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg disabled:opacity-60"
                >
                  {saving ? 'Menyimpan...' : 'Simpan Kegiatan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Konfirmasi Penghapusan"
        message={`Apakah Anda yakin ingin menghapus "${deleteTarget?.label}"? Data dan berkas terkait akan dihapus permanen.`}
        loading={deleting}
        onConfirm={executeDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
