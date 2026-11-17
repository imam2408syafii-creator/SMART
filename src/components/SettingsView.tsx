import React, { useEffect, useState } from 'react';
import {
  Check,
  Database,
  Download,
  KeyRound,
  Settings as SettingsIcon,
  ShieldCheck,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { apiFetch, fetchProtectedBlob } from '../lib/api';
import {
  PERMISSION_LABELS,
  type OrganizationProfile,
  type PermissionCode,
  type RoleItem,
  type User,
} from '../types';
import { LogoSlot } from './LogoSlot';

interface SettingsViewProps {
  currentUser: User;
  onUserUpdated: () => void;
  onBrandingUpdated: () => void;
}

export function SettingsView({
  currentUser,
  onUserUpdated,
  onBrandingUpdated,
}: SettingsViewProps) {
  const isAdmin = currentUser.permissions.includes('settings:manage');
  const canBackup = currentUser.permissions.includes('backup:export');

  const [tab, setTab] = useState<'account' | 'app' | 'roles' | 'backup'>('account');
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');

  // Account settings
  const [fullName, setFullName] = useState(currentUser.full_name);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [savingAccount, setSavingAccount] = useState(false);

  // App identity & logo
  const [profile, setProfile] = useState<OrganizationProfile | null>(null);
  const [appForm, setAppForm] = useState({
    app_name: '',
    app_subtitle: '',
    org_name: '',
    active_budget_year: 2026,
  });
  const [savingApp, setSavingApp] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // Role Permissions Matrix
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [allPerms, setAllPerms] = useState<PermissionCode[]>([]);
  const [savingRoleId, setSavingRoleId] = useState<number | null>(null);

  useEffect(() => {
    if (isAdmin) {
      Promise.all([
        apiFetch<{ profile: OrganizationProfile }>('/api/profile'),
        apiFetch<{ roles: RoleItem[]; allPermissions: PermissionCode[] }>('/api/roles'),
      ])
        .then(([pRes, rRes]) => {
          setProfile(pRes.profile);
          setAppForm({
            app_name: pRes.profile.app_name,
            app_subtitle: pRes.profile.app_subtitle,
            org_name: pRes.profile.org_name,
            active_budget_year: pRes.profile.active_budget_year,
          });
          setRoles(rRes.roles);
          setAllPerms(rRes.allPermissions);
        })
        .catch(() => {
          // ignore if not permitted
        });
    }
  }, [isAdmin]);

  async function handleSaveAccount(e: React.FormEvent) {
    e.preventDefault();
    setSavingAccount(true);
    setError('');
    setFeedback('');
    try {
      await apiFetch('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({
          fullName,
          currentPassword: currentPassword || undefined,
          newPassword: newPassword || undefined,
        }),
      });
      setCurrentPassword('');
      setNewPassword('');
      setFeedback('Pengaturan akun berhasil diperbarui.');
      onUserUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memperbarui akun.');
    } finally {
      setSavingAccount(false);
    }
  }

  async function handleSaveAppSettings(e: React.FormEvent) {
    e.preventDefault();
    setSavingApp(true);
    setError('');
    setFeedback('');
    try {
      await apiFetch('/api/profile', {
        method: 'PUT',
        body: JSON.stringify(appForm),
      });
      setFeedback('Identitas aplikasi & tahun anggaran aktif berhasil disimpan.');
      onBrandingUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan pengaturan.');
    } finally {
      setSavingApp(false);
    }
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('logo', file);
      const res = await apiFetch<{ logo_url: string }>('/api/profile/logo', {
        method: 'POST',
        body: fd,
      });
      setProfile((prev) => (prev ? { ...prev, logo_url: res.logo_url } : prev));
      setFeedback('Logo resmi BAPPEDA berhasil diunggah.');
      onBrandingUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengunggah logo.');
    } finally {
      setUploadingLogo(false);
    }
  }

  async function handleRemoveLogo() {
    setError('');
    try {
      await apiFetch('/api/profile/logo', { method: 'DELETE' });
      setProfile((prev) => (prev ? { ...prev, logo_url: null } : prev));
      setFeedback('Logo dikembalikan ke slot kosong resmi.');
      onBrandingUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menghapus logo.');
    }
  }

  async function togglePermission(role: RoleItem, perm: PermissionCode) {
    const has = role.permissions.includes(perm);
    const nextPerms = has
      ? role.permissions.filter((p) => p !== perm)
      : [...role.permissions, perm];

    setSavingRoleId(role.id);
    setError('');
    try {
      const res = await apiFetch<{ permissions: PermissionCode[] }>(`/api/roles/${role.id}`, {
        method: 'PUT',
        body: JSON.stringify({ permissions: nextPerms }),
      });
      setRoles((prev) =>
        prev.map((r) => (r.id === role.id ? { ...r, permissions: res.permissions } : r))
      );
      setFeedback(`Hak akses peran "${role.name}" berhasil diperbarui.`);
      onUserUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memperbarui hak akses.');
    } finally {
      setSavingRoleId(null);
    }
  }

  async function handleDownloadBackup(format: 'sqlite' | 'json') {
    setError('');
    try {
      const blob = await fetchProtectedBlob(`/api/admin/backup?format=${format}`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      a.download = `smart_bappeda_backup_${stamp}.${format === 'sqlite' ? 'db' : 'json'}`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      setFeedback(`Backup database (${format.toUpperCase()}) berhasil diunduh.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengunduh backup database.');
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

      <div>
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">Pengaturan Aplikasi</h2>
        <p className="text-sm text-slate-500 mt-0.5">
          Konfigurasi akun pengguna, identitas resmi aplikasi, hak akses peran, dan backup database
        </p>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-200/70 rounded-lg w-fit">
        <button
          type="button"
          onClick={() => setTab('account')}
          className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 ${
            tab === 'account'
              ? 'bg-white text-blue-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <KeyRound className="w-3.5 h-3.5" />
          <span>Pengaturan Akun</span>
        </button>
        {isAdmin && (
          <>
            <button
              type="button"
              onClick={() => setTab('app')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 ${
                tab === 'app'
                  ? 'bg-white text-blue-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <SettingsIcon className="w-3.5 h-3.5" />
              <span>Identitas, Logo &amp; Tahun Aktif</span>
            </button>
            <button
              type="button"
              onClick={() => setTab('roles')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 ${
                tab === 'roles'
                  ? 'bg-white text-blue-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Pengaturan Hak Akses</span>
            </button>
          </>
        )}
        {canBackup && (
          <button
            type="button"
            onClick={() => setTab('backup')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 ${
              tab === 'backup'
                ? 'bg-white text-blue-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>Backup Database</span>
          </button>
        )}
      </div>

      {/* Tab 1: Account */}
      {tab === 'account' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 max-w-xl">
          <h3 className="text-base font-bold text-slate-900">Profil Akun &amp; Kata Sandi</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Username: <span className="font-mono font-semibold">{currentUser.username}</span> ·
            Peran: <span className="font-semibold">{currentUser.role_name}</span>
          </p>

          <form onSubmit={handleSaveAccount} className="mt-5 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nama Tampilan
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>

            <div className="pt-3 border-t border-slate-100 space-y-3">
              <p className="text-xs font-semibold text-slate-700">
                Ubah Kata Sandi (Opsional)
              </p>
              <div>
                <label className="block text-xs text-slate-600 mb-1">Kata Sandi Saat Ini</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">
                  Kata Sandi Baru (Minimal 8 karakter)
                </label>
                <input
                  type="password"
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={savingAccount}
              className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded-lg disabled:opacity-60"
            >
              {savingAccount ? 'Menyimpan...' : 'Simpan Pengaturan Akun'}
            </button>
          </form>
        </div>
      )}

      {/* Tab 2: App Identity & Official Logo */}
      {tab === 'app' && isAdmin && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900">Logo Resmi BAPPEDA</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Aplikasi tidak membuat atau mengubah logo resmi instansi. Unggah file logo resmi
              Kabupaten Sidoarjo / BAPPEDA (PNG, JPG, atau WEBP) di sini.
            </p>
            <div className="p-5 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-4">
              <LogoSlot logoUrl={profile?.logo_url} size="lg" />
              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-800">
                  {profile?.logo_url ? 'Logo resmi terpasang' : 'Slot Logo Resmi (Belum Diunggah)'}
                </div>
                <div className="flex flex-wrap gap-2">
                  <label className="cursor-pointer px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5">
                    <Upload className="w-3.5 h-3.5" />
                    <span>{uploadingLogo ? 'Mengunggah...' : 'Unggah Logo'}</span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={handleLogoUpload}
                      className="hidden"
                    />
                  </label>
                  {profile?.logo_url && (
                    <button
                      type="button"
                      onClick={handleRemoveLogo}
                      className="px-3 py-1.5 bg-white hover:bg-red-50 text-red-600 border border-red-200 text-xs font-semibold rounded-lg inline-flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Hapus</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6">
            <h3 className="text-base font-bold text-slate-900">
              Identitas Aplikasi &amp; Tahun Anggaran Aktif
            </h3>
            <form onSubmit={handleSaveAppSettings} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nama Aplikasi
                  </label>
                  <input
                    type="text"
                    required
                    value={appForm.app_name}
                    onChange={(e) => setAppForm({ ...appForm, app_name: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Subjudul / Wilayah
                  </label>
                  <input
                    type="text"
                    required
                    value={appForm.app_subtitle}
                    onChange={(e) => setAppForm({ ...appForm, app_subtitle: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Identitas Lengkap Organisasi
                </label>
                <input
                  type="text"
                  required
                  value={appForm.org_name}
                  onChange={(e) => setAppForm({ ...appForm, org_name: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              <div className="max-w-xs">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tahun Anggaran Aktif (Dashboard)
                </label>
                <select
                  value={appForm.active_budget_year}
                  onChange={(e) =>
                    setAppForm({ ...appForm, active_budget_year: Number(e.target.value) })
                  }
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
                >
                  <option value={2027}>2027</option>
                  <option value={2026}>2026</option>
                  <option value={2025}>2025</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={savingApp}
                className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded-lg disabled:opacity-60"
              >
                {savingApp ? 'Menyimpan...' : 'Simpan Pengaturan Aplikasi'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Tab 3: Role Permissions Matrix */}
      {tab === 'roles' && isAdmin && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200">
            <h3 className="text-base font-bold text-slate-900">
              Matriks Pengaturan Hak Akses Peran
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Aktifkan atau batasi kewenangan menu dan unduhan dokumen PDF untuk setiap peran
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4">Kewenangan / Fitur</th>
                  {roles.map((r) => (
                    <th key={r.id} className="py-3 px-4 text-center whitespace-nowrap">
                      {r.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {allPerms.map((perm) => {
                  const meta = PERMISSION_LABELS[perm];
                  return (
                    <tr key={perm} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{meta?.label || perm}</div>
                        <div className="text-[11px] text-slate-500">
                          {meta?.group} · <span className="font-mono">{perm}</span>
                        </div>
                      </td>
                      {roles.map((r) => {
                        const checked = r.permissions.includes(perm);
                        const lockedAdmin =
                          r.code === 'ADMIN' &&
                          ['users:manage', 'settings:manage', 'dashboard:view', 'backup:export'].includes(
                            perm
                          );
                        return (
                          <td key={r.id} className="py-3 px-4 text-center">
                            <button
                              type="button"
                              disabled={lockedAdmin || savingRoleId === r.id}
                              onClick={() => togglePermission(r, perm)}
                              className={`w-7 h-7 rounded-md inline-flex items-center justify-center border transition-colors ${
                                checked
                                  ? 'bg-blue-700 border-blue-700 text-white'
                                  : 'bg-white border-slate-300 text-transparent hover:border-blue-400'
                              } ${lockedAdmin ? 'opacity-60 cursor-not-allowed' : ''}`}
                              title={lockedAdmin ? 'Hak akses inti Administrator' : 'Ubah hak akses'}
                            >
                              <Check className="w-4 h-4" />
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: Database Backup */}
      {tab === 'backup' && canBackup && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 max-w-2xl space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Backup &amp; Arsip Database</h3>
              <p className="text-sm text-slate-600 mt-1 leading-relaxed">
                Unduh salinan cadangan basis data relasional secara konsisten untuk keperluan arsip
                berkala. Setiap tindakan pengunduhan backup dicatat di dalam Audit Log sistem.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <button
              type="button"
              onClick={() => handleDownloadBackup('sqlite')}
              className="p-4 rounded-xl border border-blue-200 bg-blue-50/70 hover:bg-blue-100/70 text-left transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-blue-950">Backup SQLite (.db)</span>
                <Download className="w-4 h-4 text-blue-700" />
              </div>
              <p className="text-xs text-slate-600 mt-1">
                Salinan biner penuh seluruh 9 tabel database terstruktur.
              </p>
            </button>

            <button
              type="button"
              onClick={() => handleDownloadBackup('json')}
              className="p-4 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-left transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-slate-900">Ekspor Snapshot (.json)</span>
                <Download className="w-4 h-4 text-slate-700" />
              </div>
              <p className="text-xs text-slate-600 mt-1">
                Format JSON terstruktur tanpa hash kata sandi untuk audit atau migrasi.
              </p>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
