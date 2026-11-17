import React, { useState } from 'react';
import { Eye, EyeOff, Lock, LogIn, ShieldCheck, User as UserIcon } from 'lucide-react';
import { apiFetch, setAuthToken } from '../lib/api';
import type { User } from '../types';
import { LogoSlot } from './LogoSlot';

interface LoginPageProps {
  branding: {
    app_name: string;
    app_subtitle: string;
    org_name: string;
    logo_url: string | null;
  };
  onLoginSuccess: (user: User) => void;
}

const DEMO_ACCOUNTS = [
  {
    label: 'Administrator',
    username: 'admin.demo',
    password: 'AdminDemo2026!',
    scope: 'Akses penuh seluruh menu, pengguna, hak akses & backup',
  },
  {
    label: 'Petugas Pengelola Data',
    username: 'petugas.demo',
    password: 'PetugasDemo2026!',
    scope: 'Kelola kegiatan bulanan, foto, surat tugas & anggaran',
  },
  {
    label: 'Pimpinan',
    username: 'pimpinan.demo',
    password: 'PimpinanDemo2026!',
    scope: 'Pantau dashboard, profil, kegiatan & serapan anggaran',
  },
  {
    label: 'Pengguna Internal',
    username: 'internal.demo',
    password: 'InternalDemo2026!',
    scope: 'Lihat informasi, cari kegiatan & unduh lampiran sesuai izin',
  },
];

export function LoginPage({ branding, onLoginSuccess }: LoginPageProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await apiFetch<{ token: string; user: User }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      setAuthToken(res.token);
      onLoginSuccess(res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal masuk ke sistem.');
    } finally {
      setLoading(false);
    }
  }

  function applyDemoAccount(acc: (typeof DEMO_ACCOUNTS)[number]) {
    setUsername(acc.username);
    setPassword(acc.password);
    setError('');
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Institutional Bar */}
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-6">
          <div className="flex items-center gap-3.5">
            <LogoSlot logoUrl={branding.logo_url} size="md" />
            <div>
              <h1 className="text-lg font-bold tracking-tight text-blue-950 leading-none">
                {branding.app_name || 'SMART BAPPEDA'}
              </h1>
              <p className="text-xs font-semibold tracking-wide text-amber-700 mt-1">
                {branding.app_subtitle || 'KABUPATEN SIDOARJO'}
              </p>
            </div>
          </div>
          <span className="text-xs text-slate-500 hidden sm:inline">
            Pusat Informasi Digital Perencanaan Pembangunan Daerah
          </span>
        </div>
      </header>

      {/* Main Split Container */}
      <main className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          {/* Left Institutional Panel */}
          <div className="lg:col-span-5 bg-gradient-to-br from-blue-950 via-blue-900 to-blue-800 text-white p-8 flex flex-col justify-between relative overflow-hidden">
            <div>
              <div className="flex items-center gap-3 mb-6">
                <LogoSlot logoUrl={branding.logo_url} size="lg" variant="navy" />
                <div>
                  <p className="text-xs font-semibold tracking-wider text-amber-300">
                    KABUPATEN SIDOARJO
                  </p>
                  <p className="text-xl font-bold tracking-tight text-white mt-0.5">
                    SMART BAPPEDA
                  </p>
                </div>
              </div>

              <h2 className="text-2xl font-bold leading-snug text-white">
                Sistem Informasi Terpadu Profil, Kegiatan &amp; Penyerapan Anggaran
              </h2>
              <p className="text-sm text-blue-100/90 mt-3 leading-relaxed">
                {branding.org_name || 'Badan Perencanaan Pembangunan Daerah Kabupaten Sidoarjo'}.
                Dirancang untuk pengelolaan dokumentasi kegiatan bulanan, arsip surat tugas PDF
                terproteksi, dan pemantauan realisasi anggaran yang akuntabel.
              </p>
            </div>

            <div className="mt-8 pt-6 border-t border-blue-700/60 space-y-2.5 text-xs text-blue-100">
              <div className="flex items-center gap-2 text-amber-200 font-medium">
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span>Akses Terkontrol Berbasis Peran Pengguna</span>
              </div>
              <p className="text-blue-200/80 leading-relaxed">
                Lingkungan ini menggunakan data contoh bertanda <strong>DEMO</strong>. Jangan
                memasukkan data pribadi pegawai atau dokumen rahasia instansi selama pengujian.
              </p>
            </div>
          </div>

          {/* Right Login Form & Demo Accounts */}
          <div className="lg:col-span-7 p-8 sm:p-10">
            <div className="max-w-md mx-auto">
              <h3 className="text-xl font-bold text-slate-900">Masuk ke Sistem</h3>
              <p className="text-sm text-slate-500 mt-1">
                Masukkan nama pengguna dan kata sandi akun Anda untuk mengakses dashboard.
              </p>

              {error && (
                <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <div>
                  <label
                    htmlFor="login-username"
                    className="block text-sm font-medium text-slate-700 mb-1.5"
                  >
                    Nama Pengguna
                  </label>
                  <div className="relative">
                    <UserIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      id="login-username"
                      type="text"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Contoh: admin.demo"
                      className="w-full pl-10 pr-4 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="login-password"
                    className="block text-sm font-medium text-slate-700 mb-1.5"
                  >
                    Kata Sandi
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Masukkan kata sandi"
                      className="w-full pl-10 pr-10 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                      aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 px-4 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  <LogIn className="w-4 h-4" />
                  <span>{loading ? 'Memverifikasi...' : 'Masuk Aplikasi'}</span>
                </button>
              </form>

              {/* Demo Accounts Selector */}
              <div className="mt-8 pt-6 border-t border-slate-200">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-slate-700">
                    Akun Pengujian (DEMO)
                  </span>
                  <span className="text-xs text-amber-700 font-medium">
                    Klik untuk mengisi otomatis
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {DEMO_ACCOUNTS.map((acc) => (
                    <button
                      key={acc.username}
                      type="button"
                      onClick={() => applyDemoAccount(acc)}
                      className="text-left p-3 rounded-lg border border-slate-200 hover:border-blue-400 hover:bg-blue-50/50 transition-colors"
                    >
                      <div className="text-xs font-semibold text-blue-900">{acc.label}</div>
                      <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                        {acc.username}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1 line-clamp-2">
                        {acc.scope}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
