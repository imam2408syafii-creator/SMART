import React, { useEffect, useState } from 'react';
import {
  Building2,
  Camera,
  Edit3,
  FileText,
  Mail,
  MapPin,
  Phone,
  Plus,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { apiFetch, fetchProtectedBlob } from '../lib/api';
import type { OrganizationProfile, OrganizationUnit, User } from '../types';
import { LogoSlot } from './LogoSlot';
import { ConfirmModal } from './ConfirmModal';

interface ProfileViewProps {
  currentUser: User;
  onBrandingUpdated: () => void;
}

export function ProfileView({ currentUser, onBrandingUpdated }: ProfileViewProps) {
  const canEdit = currentUser.permissions.includes('profile:edit');

  const [profile, setProfile] = useState<OrganizationProfile | null>(null);
  const [units, setUnits] = useState<OrganizationUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');

  // Edit profile modal
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [profileForm, setProfileForm] = useState({
    org_name: '',
    org_address: '',
    org_phone: '',
    org_email: '',
    org_website: '',
    history_text: '',
    vision_text: '',
    missionsText: '',
    duties_text: '',
    functionsText: '',
  });
  const [savingProfile, setSavingProfile] = useState(false);

  // Unit modal
  const [unitModalOpen, setUnitModalOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<OrganizationUnit | null>(null);
  const [unitForm, setUnitForm] = useState({
    code: '',
    name: '',
    head_title: '',
    parent_id: '',
    description: '',
    tasksText: '',
    sort_order: 10,
  });
  const [savingUnit, setSavingUnit] = useState(false);

  // Confirm delete
  const [deleteTarget, setDeleteTarget] = useState<{
    type: 'unit' | 'doc';
    id: string | number;
    name: string;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Upload supporting doc modal
  const [docModalOpen, setDocModalOpen] = useState(false);
  const [docTitle, setDocTitle] = useState('');
  const [docDesc, setDocDesc] = useState('');
  const [docFile, setDocFile] = useState<File | null>(null);
  const [uploadingDoc, setUploadingDoc] = useState(false);

  async function loadProfile() {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch<{ profile: OrganizationProfile; units: OrganizationUnit[] }>(
        '/api/profile'
      );
      setProfile(res.profile);
      setUnits(res.units);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat profil BAPPEDA.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProfile();
  }, []);

  function openEditProfile() {
    if (!profile) return;
    setProfileForm({
      org_name: profile.org_name,
      org_address: profile.org_address,
      org_phone: profile.org_phone,
      org_email: profile.org_email,
      org_website: profile.org_website,
      history_text: profile.history_text,
      vision_text: profile.vision_text,
      missionsText: profile.missions.join('\n'),
      duties_text: profile.duties_text,
      functionsText: profile.functions.join('\n'),
    });
    setEditProfileOpen(true);
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    setError('');
    try {
      await apiFetch('/api/profile', {
        method: 'PUT',
        body: JSON.stringify({
          org_name: profileForm.org_name,
          org_address: profileForm.org_address,
          org_phone: profileForm.org_phone,
          org_email: profileForm.org_email,
          org_website: profileForm.org_website,
          history_text: profileForm.history_text,
          vision_text: profileForm.vision_text,
          missions: profileForm.missionsText
            .split('\n')
            .map((s) => s.trim())
            .filter(Boolean),
          duties_text: profileForm.duties_text,
          functions: profileForm.functionsText
            .split('\n')
            .map((s) => s.trim())
            .filter(Boolean),
        }),
      });
      setEditProfileOpen(false);
      setFeedback('Informasi profil BAPPEDA berhasil diperbarui.');
      await loadProfile();
      onBrandingUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan profil.');
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleBuildingPhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('photo', file);
    try {
      await apiFetch('/api/profile/building-photo', { method: 'POST', body: fd });
      setFeedback('Foto kantor organisasi berhasil diperbarui.');
      await loadProfile();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengunggah foto kantor.');
    }
  }

  function openCreateUnit() {
    setEditingUnit(null);
    setUnitForm({
      code: '',
      name: '',
      head_title: '',
      parent_id: units[0]?.id ? String(units[0].id) : '',
      description: '',
      tasksText: '',
      sort_order: units.length + 1,
    });
    setUnitModalOpen(true);
  }

  function openEditUnit(u: OrganizationUnit) {
    setEditingUnit(u);
    setUnitForm({
      code: u.code,
      name: u.name,
      head_title: u.head_title,
      parent_id: u.parent_id ? String(u.parent_id) : '',
      description: u.description,
      tasksText: u.tasks.join('\n'),
      sort_order: u.sort_order,
    });
    setUnitModalOpen(true);
  }

  async function handleSaveUnit(e: React.FormEvent) {
    e.preventDefault();
    setSavingUnit(true);
    setError('');
    try {
      const payload = {
        code: unitForm.code,
        name: unitForm.name,
        head_title: unitForm.head_title,
        parent_id: unitForm.parent_id ? Number(unitForm.parent_id) : null,
        description: unitForm.description,
        tasks: unitForm.tasksText
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean),
        sort_order: Number(unitForm.sort_order) || 10,
      };
      if (editingUnit) {
        await apiFetch(`/api/units/${editingUnit.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        setFeedback(`Unit "${unitForm.name}" berhasil diperbarui.`);
      } else {
        await apiFetch('/api/units', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setFeedback(`Unit "${unitForm.name}" berhasil ditambahkan.`);
      }
      setUnitModalOpen(false);
      await loadProfile();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan unit organisasi.');
    } finally {
      setSavingUnit(false);
    }
  }

  async function handleUploadSupportingDoc(e: React.FormEvent) {
    e.preventDefault();
    if (!docFile) return;
    setUploadingDoc(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('title', docTitle);
      fd.append('description', docDesc);
      fd.append('file', docFile);
      await apiFetch('/api/profile/docs', { method: 'POST', body: fd });
      setDocModalOpen(false);
      setDocTitle('');
      setDocDesc('');
      setDocFile(null);
      setFeedback('Dokumen pendukung PDF berhasil diunggah.');
      await loadProfile();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengunggah dokumen.');
    } finally {
      setUploadingDoc(false);
    }
  }

  async function handleOpenDoc(downloadUrl: string, fileName: string) {
    try {
      const blob = await fetchProtectedBlob(downloadUrl);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal membuka dokumen.');
    }
  }

  async function executeDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      if (deleteTarget.type === 'unit') {
        await apiFetch(`/api/units/${deleteTarget.id}`, { method: 'DELETE' });
        setFeedback(`Bidang "${deleteTarget.name}" telah dihapus.`);
      } else {
        await apiFetch(`/api/profile/docs/${deleteTarget.id}`, { method: 'DELETE' });
        setFeedback(`Dokumen "${deleteTarget.name}" telah dihapus.`);
      }
      setDeleteTarget(null);
      await loadProfile();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menghapus data.');
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return <div className="h-96 bg-slate-200/70 rounded-xl animate-pulse" />;
  }

  if (!profile) {
    return (
      <div className="p-6 bg-white border border-red-200 rounded-xl text-sm text-red-700">
        {error || 'Data profil tidak ditemukan.'}
      </div>
    );
  }

  const headUnit = units.find((u) => !u.parent_id) || units[0];
  const childUnits = units.filter((u) => u.id !== headUnit?.id);

  return (
    <div className="space-y-6">
      {feedback && (
        <div className="px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-800 flex items-center justify-between">
          <span>{feedback}</span>
          <button type="button" onClick={() => setFeedback('')} className="text-emerald-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {error && (
        <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700 flex items-center justify-between">
          <span>{error}</span>
          <button type="button" onClick={() => setError('')} className="text-red-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Hero Profile Banner */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="relative h-56 sm:h-64 bg-slate-100">
          {profile.building_photo_url ? (
            <img
              src={profile.building_photo_url}
              alt="Kantor BAPPEDA Kabupaten Sidoarjo"
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-400">
              <Building2 className="w-16 h-16" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/35 to-transparent" />

          {canEdit && (
            <label className="absolute top-4 right-4 cursor-pointer px-3 py-1.5 rounded-lg bg-white/95 hover:bg-white text-slate-800 text-xs font-semibold shadow-sm flex items-center gap-1.5">
              <Camera className="w-3.5 h-3.5" />
              <span>Ganti Foto Kantor</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleBuildingPhotoUpload}
                className="hidden"
              />
            </label>
          )}

          <div className="absolute bottom-5 left-6 right-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="flex items-center gap-4">
              <LogoSlot logoUrl={profile.logo_url} size="lg" />
              <div className="text-white">
                <p className="text-xs font-semibold tracking-wide text-amber-300">
                  PROFIL ORGANISASI · DATA DEMO
                </p>
                <h2 className="text-xl sm:text-2xl font-bold mt-0.5">{profile.org_name}</h2>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-200 mt-1.5">
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-amber-300" />
                    {profile.org_address}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-amber-300" />
                    {profile.org_phone}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Mail className="w-3.5 h-3.5 text-amber-300" />
                    {profile.org_email}
                  </span>
                </div>
              </div>
            </div>

            {canEdit && (
              <button
                type="button"
                onClick={openEditProfile}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 shrink-0 self-start sm:self-auto"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit Profil Organisasi</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Sejarah, Visi & Misi */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <h3 className="text-base font-bold text-slate-900">Sejarah Singkat</h3>
          <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
            {profile.history_text}
          </p>
        </div>

        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div>
            <h3 className="text-base font-bold text-slate-900">Visi</h3>
            <p className="mt-2 text-base font-medium text-blue-950 bg-blue-50/70 border border-blue-100 rounded-lg p-4 leading-relaxed">
              &ldquo;{profile.vision_text}&rdquo;
            </p>
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Misi</h3>
            <ol className="mt-2 space-y-2">
              {profile.missions.map((m, idx) => (
                <li key={idx} className="flex items-start gap-2.5 text-sm text-slate-700">
                  <span className="w-6 h-6 rounded-md bg-blue-50 text-blue-800 font-mono text-xs font-semibold flex items-center justify-center shrink-0 mt-0.5">
                    {idx + 1}
                  </span>
                  <span className="leading-relaxed">{m}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>

      {/* Tugas & Fungsi */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5">
          <h3 className="text-base font-bold text-slate-900">Tugas Pokok</h3>
          <p className="mt-2 text-sm text-slate-700 leading-relaxed">{profile.duties_text}</p>
        </div>
        <div className="lg:col-span-7 lg:border-l lg:border-slate-100 lg:pl-6">
          <h3 className="text-base font-bold text-slate-900">Fungsi BAPPEDA</h3>
          <ul className="mt-2 space-y-2">
            {profile.functions.map((fn, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm text-slate-700">
                <span className="text-amber-600 font-bold mt-0.5">•</span>
                <span className="leading-relaxed">{fn}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Struktur Organisasi & Profil Masing-masing Bidang */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Struktur Organisasi &amp; Profil Bidang
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Susunan perangkat unit kerja dan tugas pokok masing-masing bidang (Data DEMO)
            </p>
          </div>
          {canEdit && (
            <button
              type="button"
              onClick={openCreateUnit}
              className="px-3.5 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Bidang / Unit</span>
            </button>
          )}
        </div>

        {/* Top Leadership Box */}
        {headUnit && (
          <div className="max-w-xl mx-auto p-4 rounded-xl bg-blue-950 text-white text-center relative">
            <div className="text-xs font-mono text-amber-300">{headUnit.code}</div>
            <div className="text-base font-bold mt-0.5">{headUnit.name}</div>
            <div className="text-xs text-blue-200 mt-0.5">{headUnit.head_title}</div>
            {canEdit && (
              <button
                type="button"
                onClick={() => openEditUnit(headUnit)}
                className="absolute top-3 right-3 text-blue-200 hover:text-white p-1"
                title="Edit Pimpinan Unit"
              >
                <Edit3 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {/* Sub-Units Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {childUnits.map((unit) => (
            <div
              key={unit.id}
              className="border border-slate-200 rounded-xl p-5 flex flex-col justify-between bg-slate-50/40"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-xs font-mono font-semibold text-blue-700">
                      {unit.code}
                    </span>
                    <h4 className="text-sm font-bold text-slate-900 mt-0.5">{unit.name}</h4>
                    <p className="text-xs text-amber-700 font-medium mt-0.5">{unit.head_title}</p>
                  </div>
                  {canEdit && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => openEditUnit(unit)}
                        className="p-1.5 text-slate-500 hover:text-blue-700 rounded-md hover:bg-white"
                        title="Edit Bidang"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setDeleteTarget({ type: 'unit', id: unit.id, name: unit.name })
                        }
                        className="p-1.5 text-slate-500 hover:text-red-600 rounded-md hover:bg-white"
                        title="Hapus Bidang"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
                <p className="text-xs text-slate-600 mt-3 leading-relaxed">{unit.description}</p>
                {unit.tasks.length > 0 && (
                  <ul className="mt-3 pt-3 border-t border-slate-200/80 space-y-1.5">
                    {unit.tasks.map((t, i) => (
                      <li key={i} className="text-xs text-slate-600 flex items-start gap-1.5">
                        <span className="text-blue-700 font-bold">•</span>
                        <span>{t}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Informasi & Dokumen Pendukung */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">Informasi &amp; Dokumen Pendukung</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Berkas panduan organisasi, struktur, dan dokumen profil dalam format PDF
            </p>
          </div>
          {canEdit && (
            <button
              type="button"
              onClick={() => setDocModalOpen(true)}
              className="px-3.5 py-2 bg-white hover:bg-slate-50 text-blue-800 border border-blue-200 text-xs font-semibold rounded-lg flex items-center gap-1.5 self-start sm:self-auto"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Unggah Dokumen PDF</span>
            </button>
          )}
        </div>

        {profile.supportingInfo.length === 0 ? (
          <p className="text-sm text-slate-500 py-4">Belum ada dokumen pendukung yang diunggah.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {profile.supportingInfo.map((doc) => (
              <div
                key={doc.id}
                className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900">{doc.title}</h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {doc.description} · Diunggah {doc.uploadedAt}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleOpenDoc(doc.downloadUrl, doc.fileName)}
                    className="px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg"
                  >
                    Unduh PDF
                  </button>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() =>
                        setDeleteTarget({ type: 'doc', id: doc.id, name: doc.title })
                      }
                      className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg"
                      title="Hapus Dokumen"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit Profile Modal */}
      {editProfileOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Edit Profil BAPPEDA</h3>
              <button
                type="button"
                onClick={() => setEditProfileOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveProfile} className="p-6 overflow-y-auto space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nama Resmi Instansi
                  </label>
                  <input
                    type="text"
                    required
                    value={profileForm.org_name}
                    onChange={(e) => setProfileForm({ ...profileForm, org_name: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Telepon Kantor
                  </label>
                  <input
                    type="text"
                    value={profileForm.org_phone}
                    onChange={(e) => setProfileForm({ ...profileForm, org_phone: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Alamat Kantor
                  </label>
                  <input
                    type="text"
                    value={profileForm.org_address}
                    onChange={(e) =>
                      setProfileForm({ ...profileForm, org_address: e.target.value })
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Email Instansi
                  </label>
                  <input
                    type="email"
                    value={profileForm.org_email}
                    onChange={(e) => setProfileForm({ ...profileForm, org_email: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Sejarah Singkat
                </label>
                <textarea
                  rows={3}
                  value={profileForm.history_text}
                  onChange={(e) => setProfileForm({ ...profileForm, history_text: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Visi</label>
                <textarea
                  rows={2}
                  value={profileForm.vision_text}
                  onChange={(e) => setProfileForm({ ...profileForm, vision_text: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Misi (1 baris per poin)
                </label>
                <textarea
                  rows={4}
                  value={profileForm.missionsText}
                  onChange={(e) =>
                    setProfileForm({ ...profileForm, missionsText: e.target.value })
                  }
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tugas Pokok
                </label>
                <textarea
                  rows={2}
                  value={profileForm.duties_text}
                  onChange={(e) => setProfileForm({ ...profileForm, duties_text: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Fungsi BAPPEDA (1 baris per poin)
                </label>
                <textarea
                  rows={4}
                  value={profileForm.functionsText}
                  onChange={(e) =>
                    setProfileForm({ ...profileForm, functionsText: e.target.value })
                  }
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEditProfileOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="px-4 py-2 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg disabled:opacity-60"
                >
                  {savingProfile ? 'Menyimpan...' : 'Simpan Perubahan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Unit Create/Edit Modal */}
      {unitModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                {editingUnit ? 'Edit Unit / Bidang' : 'Tambah Unit / Bidang Baru'}
              </h3>
              <button
                type="button"
                onClick={() => setUnitModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveUnit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Kode Unit
                  </label>
                  <input
                    type="text"
                    required
                    disabled={Boolean(editingUnit)}
                    value={unitForm.code}
                    onChange={(e) => setUnitForm({ ...unitForm, code: e.target.value })}
                    placeholder="Contoh: BID-EVAL"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg disabled:bg-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Urutan</label>
                  <input
                    type="number"
                    value={unitForm.sort_order}
                    onChange={(e) =>
                      setUnitForm({ ...unitForm, sort_order: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nama Bidang / Unit
                </label>
                <input
                  type="text"
                  required
                  value={unitForm.name}
                  onChange={(e) => setUnitForm({ ...unitForm, name: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Jabatan Pimpinan Unit
                </label>
                <input
                  type="text"
                  required
                  value={unitForm.head_title}
                  onChange={(e) => setUnitForm({ ...unitForm, head_title: e.target.value })}
                  placeholder="Contoh: Kepala Bidang"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Deskripsi Singkat
                </label>
                <textarea
                  rows={2}
                  value={unitForm.description}
                  onChange={(e) => setUnitForm({ ...unitForm, description: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Uraian Tugas Bidang (1 baris per poin)
                </label>
                <textarea
                  rows={3}
                  value={unitForm.tasksText}
                  onChange={(e) => setUnitForm({ ...unitForm, tasksText: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setUnitModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingUnit}
                  className="px-4 py-2 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg disabled:opacity-60"
                >
                  {savingUnit ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Upload Supporting PDF Modal */}
      {docModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Unggah Dokumen Pendukung (PDF)</h3>
              <button
                type="button"
                onClick={() => setDocModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleUploadSupportingDoc} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Judul Dokumen
                </label>
                <input
                  type="text"
                  required
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  placeholder="Contoh: Peraturan Struktur Organisasi"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Keterangan
                </label>
                <input
                  type="text"
                  value={docDesc}
                  onChange={(e) => setDocDesc(e.target.value)}
                  placeholder="Deskripsi singkat dokumen"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Pilih Berkas PDF (Maks. 10 MB)
                </label>
                <input
                  type="file"
                  required
                  accept="application/pdf"
                  onChange={(e) => setDocFile(e.target.files?.[0] || null)}
                  className="w-full text-sm text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-700 file:font-semibold"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setDocModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={uploadingDoc || !docFile}
                  className="px-4 py-2 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg disabled:opacity-60"
                >
                  {uploadingDoc ? 'Mengunggah...' : 'Unggah PDF'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title={deleteTarget?.type === 'unit' ? 'Hapus Bidang Organisasi' : 'Hapus Dokumen Pendukung'}
        message={`Apakah Anda yakin ingin menghapus "${deleteTarget?.name}"? Tindakan ini tidak dapat dibatalkan.`}
        loading={deleting}
        onConfirm={executeDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
