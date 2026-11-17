import React, { useEffect, useState } from 'react';
import { Activity, Edit3, Plus, Shield, Trash2, Users as UsersIcon, X } from 'lucide-react';
import { apiFetch } from '../lib/api';
import type { AuditLogItem, OrganizationUnit, RoleItem, User } from '../types';
import { ConfirmModal } from './ConfirmModal';

interface UsersViewProps {
  currentUser: User;
}

export function UsersView({ currentUser }: UsersViewProps) {
  const [tab, setTab] = useState<'users' | 'audit'>('users');
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [units, setUnits] = useState<OrganizationUnit[]>([]);
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formState, setFormState] = useState({
    username: '',
    full_name: '',
    email: '',
    nip_demo: '',
    position: '',
    role_id: '',
    unit_id: '',
    password: '',
    is_active: true,
  });
  const [saving, setSaving] = useState(false);

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function loadAll() {
    setLoading(true);
    setError('');
    try {
      const [uRes, rRes, pRes, aRes] = await Promise.all([
        apiFetch<{ users: User[] }>('/api/users'),
        apiFetch<{ roles: RoleItem[] }>('/api/roles'),
        apiFetch<{ units: OrganizationUnit[] }>('/api/profile'),
        apiFetch<{ logs: AuditLogItem[] }>('/api/audit-logs?limit=100'),
      ]);
      setUsers(uRes.users);
      setRoles(rRes.roles);
      setUnits(pRes.units);
      setLogs(aRes.logs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat manajemen pengguna.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  function openCreate() {
    setEditingUser(null);
    setFormState({
      username: '',
      full_name: '',
      email: '',
      nip_demo: '',
      position: '',
      role_id: roles[3]?.id ? String(roles[3].id) : String(roles[0]?.id || ''),
      unit_id: '',
      password: '',
      is_active: true,
    });
    setModalOpen(true);
  }

  function openEdit(u: User) {
    setEditingUser(u);
    setFormState({
      username: u.username,
      full_name: u.full_name,
      email: u.email,
      nip_demo: u.nip_demo,
      position: u.position,
      role_id: String(u.role_id),
      unit_id: u.unit_id ? String(u.unit_id) : '',
      password: '',
      is_active: u.is_active === 1,
    });
    setModalOpen(true);
  }

  async function handleSaveUser(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (editingUser) {
        await apiFetch(`/api/users/${editingUser.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            full_name: formState.full_name,
            email: formState.email,
            nip_demo: formState.nip_demo,
            position: formState.position,
            role_id: Number(formState.role_id),
            unit_id: formState.unit_id ? Number(formState.unit_id) : null,
            is_active: formState.is_active ? 1 : 0,
            new_password: formState.password || undefined,
          }),
        });
        setFeedback(`Akun "${editingUser.username}" berhasil diperbarui.`);
      } else {
        await apiFetch('/api/users', {
          method: 'POST',
          body: JSON.stringify({
            username: formState.username,
            full_name: formState.full_name,
            email: formState.email,
            nip_demo: formState.nip_demo,
            position: formState.position,
            role_id: Number(formState.role_id),
            unit_id: formState.unit_id ? Number(formState.unit_id) : null,
            password: formState.password,
          }),
        });
        setFeedback(`Akun baru "${formState.username}" berhasil dibuat.`);
      }
      setModalOpen(false);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan akun pengguna.');
    } finally {
      setSaving(false);
    }
  }

  async function executeDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiFetch(`/api/users/${deleteTarget.id}`, { method: 'DELETE' });
      setFeedback(`Akun "${deleteTarget.username}" telah dihapus.`);
      setDeleteTarget(null);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menghapus pengguna.');
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

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
            Manajemen Pengguna &amp; Log Keamanan
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Kelola akun pengguna, pembagian peran, dan catatan aktivitas penting administrator
          </p>
        </div>
        {tab === 'users' && (
          <button
            type="button"
            onClick={openCreate}
            className="px-4 py-2.5 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded-lg flex items-center gap-2 self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Pengguna</span>
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg w-fit">
        <button
          type="button"
          onClick={() => setTab('users')}
          className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 ${
            tab === 'users'
              ? 'bg-white text-blue-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <UsersIcon className="w-3.5 h-3.5" />
          <span>Daftar Akun ({users.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setTab('audit')}
          className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 ${
            tab === 'audit'
              ? 'bg-white text-blue-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          <span>Catatan Aktivitas / Audit Log ({logs.length})</span>
        </button>
      </div>

      {loading ? (
        <div className="h-72 bg-slate-200/70 rounded-xl animate-pulse" />
      ) : tab === 'users' ? (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4">Username</th>
                  <th className="py-3 px-4">Nama Lengkap &amp; Jabatan</th>
                  <th className="py-3 px-4">Peran</th>
                  <th className="py-3 px-4">Bidang</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 font-mono font-semibold text-blue-800 whitespace-nowrap">
                      {u.username}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">{u.full_name}</div>
                      <div className="text-slate-500 mt-0.5">
                        {u.position || '-'} · {u.email}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-800 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1">
                        <Shield className="w-3.5 h-3.5 text-amber-600" />
                        <span>{u.role_name}</span>
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600 max-w-[180px] truncate">
                      {u.unit_name || '-'}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`font-semibold ${
                          u.is_active === 1 ? 'text-emerald-700' : 'text-red-600'
                        }`}
                      >
                        {u.is_active === 1 ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => openEdit(u)}
                        className="p-1.5 text-slate-500 hover:text-blue-700 rounded"
                        title="Edit Pengguna"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      {u.id !== currentUser.id && (
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(u)}
                          className="p-1.5 text-slate-500 hover:text-red-600 rounded"
                          title="Hapus Pengguna"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
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
                  <th className="py-3 px-4">Waktu (UTC)</th>
                  <th className="py-3 px-4">Pengguna</th>
                  <th className="py-3 px-4">Aksi</th>
                  <th className="py-3 px-4">Entitas</th>
                  <th className="py-3 px-4">Rincian Aktivitas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/70">
                    <td className="py-2.5 px-4 font-mono tabular-nums text-slate-500 whitespace-nowrap">
                      {log.created_at}
                    </td>
                    <td className="py-2.5 px-4 font-mono font-medium text-blue-800 whitespace-nowrap">
                      {log.username}
                    </td>
                    <td className="py-2.5 px-4 font-mono font-semibold text-slate-800 whitespace-nowrap">
                      {log.action}
                    </td>
                    <td className="py-2.5 px-4 text-slate-600 whitespace-nowrap">
                      {log.entity_type} #{log.entity_id}
                    </td>
                    <td className="py-2.5 px-4 text-slate-700">{log.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* User Form Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                {editingUser ? `Edit Pengguna: ${editingUser.username}` : 'Tambah Pengguna Baru'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveUser} className="p-6 overflow-y-auto space-y-4">
              {!editingUser && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nama Pengguna (Username)
                  </label>
                  <input
                    type="text"
                    required
                    value={formState.username}
                    onChange={(e) => setFormState({ ...formState, username: e.target.value })}
                    placeholder="Contoh: staf.perencanaan"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nama Lengkap
                </label>
                <input
                  type="text"
                  required
                  value={formState.full_name}
                  onChange={(e) => setFormState({ ...formState, full_name: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    required
                    value={formState.email}
                    onChange={(e) => setFormState({ ...formState, email: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    ID / Kode Pegawai (DEMO)
                  </label>
                  <input
                    type="text"
                    value={formState.nip_demo}
                    onChange={(e) => setFormState({ ...formState, nip_demo: e.target.value })}
                    placeholder="DEMO-005"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Jabatan</label>
                <input
                  type="text"
                  value={formState.position}
                  onChange={(e) => setFormState({ ...formState, position: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Peran (Role)
                  </label>
                  <select
                    required
                    value={formState.role_id}
                    onChange={(e) => setFormState({ ...formState, role_id: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
                  >
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Bidang / Unit
                  </label>
                  <select
                    value={formState.unit_id}
                    onChange={(e) => setFormState({ ...formState, unit_id: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
                  >
                    <option value="">-- Tidak terikat bidang --</option>
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
                  {editingUser
                    ? 'Kata Sandi Baru (Kosongkan jika tidak ingin mengubah)'
                    : 'Kata Sandi (Minimal 8 karakter)'}
                </label>
                <input
                  type="password"
                  required={!editingUser}
                  minLength={8}
                  value={formState.password}
                  onChange={(e) => setFormState({ ...formState, password: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              {editingUser && (
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={formState.is_active}
                    onChange={(e) => setFormState({ ...formState, is_active: e.target.checked })}
                    className="rounded border-slate-300"
                  />
                  <span>Akun Aktif (dapat masuk ke sistem)</span>
                </label>
              )}

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
                  {saving ? 'Menyimpan...' : 'Simpan Akun'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Hapus Akun Pengguna"
        message={`Apakah Anda yakin ingin menghapus akun "${deleteTarget?.username}"?`}
        loading={deleting}
        onConfirm={executeDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
