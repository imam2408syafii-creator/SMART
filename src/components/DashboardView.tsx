import { useEffect, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ArrowRight,
  Building2,
  Calendar,
  FileText,
  Info,
  MapPin,
  Wallet,
} from 'lucide-react';
import { apiFetch, formatCompactRupiah, formatDateIndo, formatRupiah } from '../lib/api';

interface DashboardData {
  activeYear: number;
  profileSummary: {
    appName: string;
    appSubtitle: string;
    orgName: string;
    logoUrl: string | null;
    buildingPhotoUrl: string | null;
    visionText: string;
    dutiesText: string;
    unitCount: number;
  };
  stats: {
    activitiesThisYear: number;
    totalActivities: number;
    totalPagu: number;
    totalRealisasi: number;
    sisaAnggaran: number;
    persentasePenyerapan: number;
    hasBudgetData: boolean;
  };
  monthlySeries: Array<{
    month: number;
    label: string;
    pagu: number | null;
    realisasi: number | null;
    persen: number | null;
    available: boolean;
  }>;
  recentActivities: Array<{
    id: number;
    activity_code: string;
    title: string;
    activity_date: string;
    location: string;
    description: string;
    unit_name: string | null;
    cover_photo: string | null;
    letter_count: number;
    is_demo: number;
  }>;
  recentPhotos: Array<{
    id: number;
    activity_id: number;
    file_path: string;
    caption: string;
    activity_title: string;
    activity_date: string;
    activity_code: string;
  }>;
}

interface DashboardViewProps {
  onNavigate: (menu: string, activityId?: number) => void;
}

export function DashboardView({ onNavigate }: DashboardViewProps) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lightboxPhoto, setLightboxPhoto] = useState<{ src: string; caption: string; title: string } | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    apiFetch<DashboardData>('/api/dashboard')
      .then((res) => {
        if (active) setData(res);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Gagal memuat dashboard.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-14 rounded-xl bg-slate-200/70 animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 rounded-xl bg-slate-200/70 animate-pulse" />
          ))}
        </div>
        <div className="h-80 rounded-xl bg-slate-200/70 animate-pulse" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 bg-white border border-red-200 rounded-xl text-sm text-red-700">
        {error || 'Data dashboard tidak tersedia.'}
      </div>
    );
  }

  const { activeYear, profileSummary, stats, monthlySeries, recentActivities, recentPhotos } = data;

  return (
    <div className="space-y-6">
      {/* DEMO Notice Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200/90 text-amber-950">
        <div className="flex items-start sm:items-center gap-2.5 text-sm">
          <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5 sm:mt-0" />
          <span>
            <strong>Lingkungan Data DEMO:</strong> Angka anggaran, kegiatan, dan dokumen pada
            tampilan awal merupakan contoh simulasi untuk pengujian sistem, bukan data resmi BAPPEDA
            Kabupaten Sidoarjo.
          </span>
        </div>
        <span className="text-xs font-mono font-semibold text-amber-800 whitespace-nowrap shrink-0">
          TA {activeYear}
        </span>
      </div>

      {/* Hero Title + Quick Context */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-wide text-blue-700">
            PUSAT INFORMASI DIGITAL · {profileSummary.appSubtitle}
          </p>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-1">
            {profileSummary.appName} Kabupaten Sidoarjo
          </h2>
          <p className="text-sm text-slate-600 mt-1 max-w-2xl">{profileSummary.orgName}</p>
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => onNavigate('activities')}
            className="px-4 py-2 text-sm font-medium text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors whitespace-nowrap"
          >
            Lihat Kegiatan
          </button>
          <button
            type="button"
            onClick={() => onNavigate('budget')}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors whitespace-nowrap"
          >
            Rincian Anggaran
          </button>
        </div>
      </div>

      {/* 4-Column KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Kegiatan Tercatat (TA {activeYear})</span>
            <Calendar className="w-4 h-4 text-blue-700" />
          </div>
          <div className="mt-3 text-2xl font-bold text-slate-900 tabular-nums">
            {stats.activitiesThisYear} Kegiatan
          </div>
          <p className="mt-1.5 text-xs text-slate-500 tabular-nums">
            Total seluruh periode: {stats.totalActivities} kegiatan · Label DEMO
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Pagu Anggaran (DEMO)</span>
            <Wallet className="w-4 h-4 text-blue-700" />
          </div>
          <div className="mt-3 text-2xl font-bold text-slate-900 tabular-nums">
            {stats.hasBudgetData ? formatCompactRupiah(stats.totalPagu) : 'Belum tersedia'}
          </div>
          <p className="mt-1.5 text-xs text-slate-500 font-mono tabular-nums">
            {stats.hasBudgetData ? formatRupiah(stats.totalPagu) : 'Menunggu input anggaran'}
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Realisasi Anggaran (DEMO)</span>
            <Wallet className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-3 text-2xl font-bold text-slate-900 tabular-nums">
            {stats.hasBudgetData ? formatCompactRupiah(stats.totalRealisasi) : 'Belum tersedia'}
          </div>
          <p className="mt-1.5 text-xs text-slate-500 font-mono tabular-nums">
            {stats.hasBudgetData ? formatRupiah(stats.totalRealisasi) : '-'}
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Sisa &amp; Persentase Penyerapan</span>
            <span className="text-xs font-mono font-semibold text-amber-700 tabular-nums">
              {stats.hasBudgetData ? `${stats.persentasePenyerapan.toFixed(2)}%` : '0,00%'}
            </span>
          </div>
          <div className="mt-3 text-2xl font-bold text-slate-900 tabular-nums">
            {stats.hasBudgetData ? formatCompactRupiah(stats.sisaAnggaran) : 'Belum tersedia'}
          </div>
          <div className="mt-2.5 w-full h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-700 rounded-full transition-all"
              style={{ width: `${Math.min(Math.max(stats.persentasePenyerapan, 0), 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Main Content Split: Chart + Organization Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Monthly Absorption Chart */}
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl p-6 flex flex-col">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-5">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Perkembangan Penyerapan Anggaran Tahun {activeYear} (DEMO)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Perbandingan pagu dan realisasi bulanan dalam juta Rupiah (bulan tanpa data ditandai
                kosong)
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('budget')}
              className="text-xs font-semibold text-blue-700 hover:text-blue-900 flex items-center gap-1 whitespace-nowrap"
            >
              <span>Buka Analisis Lengkap</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex-1 min-h-[290px]">
            <ResponsiveContainer width="100%" height={290}>
              <AreaChart
                data={monthlySeries.map((m) => ({
                  ...m,
                  paguJuta: m.pagu !== null ? Number((m.pagu / 1_000_000).toFixed(1)) : null,
                  realisasiJuta:
                    m.realisasi !== null ? Number((m.realisasi / 1_000_000).toFixed(1)) : null,
                }))}
                margin={{ top: 10, right: 12, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="dashPaguGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1d4ed8" stopOpacity={0.14} />
                    <stop offset="95%" stopColor="#1d4ed8" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="dashRealGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#d97706" stopOpacity={0.22} />
                    <stop offset="95%" stopColor="#d97706" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 12, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `${v} Jt`}
                />
                <Tooltip
                  formatter={(value: unknown, name: unknown) => {
                    if (value === null || value === undefined) return ['Belum tersedia', String(name)];
                    return [`Rp ${Number(value).toLocaleString('id-ID')} Juta`, String(name)];
                  }}
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="paguJuta"
                  name="Pagu Anggaran"
                  stroke="#1d4ed8"
                  strokeWidth={2}
                  fill="url(#dashPaguGrad)"
                  connectNulls={false}
                />
                <Area
                  type="monotone"
                  dataKey="realisasiJuta"
                  name="Realisasi"
                  stroke="#d97706"
                  strokeWidth={2.2}
                  fill="url(#dashRealGrad)"
                  connectNulls={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Organization Profile Summary */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col">
          <div className="h-36 bg-slate-100 relative overflow-hidden">
            {profileSummary.buildingPhotoUrl ? (
              <img
                src={profileSummary.buildingPhotoUrl}
                alt="Gedung BAPPEDA Kabupaten Sidoarjo"
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-400">
                <Building2 className="w-10 h-10" />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900/75 via-slate-900/20 to-transparent" />
            <div className="absolute bottom-3 left-4 right-4 text-white">
              <p className="text-xs font-medium text-amber-300">Ringkasan Profil Organisasi</p>
              <p className="text-sm font-bold leading-snug line-clamp-1">{profileSummary.orgName}</p>
            </div>
          </div>

          <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div>
                <h4 className="text-xs font-semibold text-slate-500">Visi Organisasi</h4>
                <p className="text-sm text-slate-800 mt-1 leading-relaxed line-clamp-3">
                  {profileSummary.visionText}
                </p>
              </div>
              <div className="pt-3 border-t border-slate-100">
                <h4 className="text-xs font-semibold text-slate-500">Tugas Pokok</h4>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed line-clamp-3">
                  {profileSummary.dutiesText}
                </p>
              </div>
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
                <span>Struktur Unit / Bidang Terdaftar</span>
                <span className="font-mono font-semibold text-blue-800 tabular-nums">
                  {profileSummary.unitCount} Unit
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onNavigate('profile')}
              className="w-full py-2 px-4 text-xs font-semibold text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors flex items-center justify-center gap-1.5"
            >
              <span>Lihat Profil Lengkap</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Split: Recent Activities + Latest Documentation Gallery */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Recent Activities List */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">Ringkasan Kegiatan Terbaru</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Klik kegiatan untuk melihat detail lengkap, galeri foto, dan surat tugas PDF
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('activities')}
              className="text-xs font-semibold text-blue-700 hover:text-blue-900 whitespace-nowrap"
            >
              Semua Kegiatan
            </button>
          </div>

          {recentActivities.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-500">
              Belum ada kegiatan yang tercatat.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {recentActivities.map((act) => (
                <button
                  key={act.id}
                  type="button"
                  onClick={() => onNavigate('activities', act.id)}
                  className="w-full text-left py-3.5 first:pt-1 last:pb-1 hover:bg-slate-50/80 rounded-lg px-2 -mx-2 transition-colors flex items-start gap-3.5"
                >
                  <div className="w-16 h-12 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden shrink-0">
                    {act.cover_photo ? (
                      <img
                        src={act.cover_photo}
                        alt={act.title}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-400">
                        <Calendar className="w-4 h-4" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-slate-500 flex flex-wrap items-center gap-1.5">
                      <span className="font-mono text-blue-700 font-medium">{act.activity_code}</span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">{formatDateIndo(act.activity_date)}</span>
                      {act.unit_name && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="truncate max-w-[180px]">{act.unit_name}</span>
                        </>
                      )}
                    </div>
                    <h4 className="text-sm font-semibold text-slate-900 mt-0.5 line-clamp-1">
                      {act.title}
                    </h4>
                    <div className="mt-1 flex items-center gap-3 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1 truncate">
                        <MapPin className="w-3 h-3 shrink-0" />
                        <span className="truncate">{act.location}</span>
                      </span>
                      {act.letter_count > 0 && (
                        <span className="inline-flex items-center gap-1 text-amber-700 font-medium shrink-0">
                          <FileText className="w-3 h-3" />
                          <span>{act.letter_count} Surat Tugas PDF</span>
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Recent Documentation Photos */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">Dokumentasi Kegiatan Terbaru</h3>
              <p className="text-xs text-slate-500 mt-0.5">Klik foto untuk memperbesar tampilan</p>
            </div>
          </div>

          {recentPhotos.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-500">
              Belum ada foto dokumentasi kegiatan.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {recentPhotos.map((photo) => (
                <button
                  key={photo.id}
                  type="button"
                  onClick={() =>
                    setLightboxPhoto({
                      src: photo.file_path,
                      caption: photo.caption,
                      title: photo.activity_title,
                    })
                  }
                  className="group relative aspect-[4/3] rounded-lg overflow-hidden border border-slate-200 bg-slate-100 text-left"
                >
                  <img
                    src={photo.file_path}
                    alt={photo.caption || photo.activity_title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent" />
                  <div className="absolute bottom-2 left-2.5 right-2.5 text-white">
                    <div className="text-[10px] font-mono text-amber-300">{photo.activity_code}</div>
                    <div className="text-xs font-medium line-clamp-1">{photo.activity_title}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Photo Lightbox */}
      {lightboxPhoto && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/80 flex items-center justify-center p-4"
          onClick={() => setLightboxPhoto(null)}
        >
          <div
            className="max-w-3xl w-full bg-white rounded-xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={lightboxPhoto.src}
              alt={lightboxPhoto.caption}
              className="w-full max-h-[70vh] object-contain bg-slate-950"
              referrerPolicy="no-referrer"
            />
            <div className="p-4 flex items-center justify-between gap-4">
              <div>
                <h4 className="text-sm font-semibold text-slate-900">{lightboxPhoto.title}</h4>
                <p className="text-xs text-slate-500 mt-0.5">{lightboxPhoto.caption}</p>
              </div>
              <button
                type="button"
                onClick={() => setLightboxPhoto(null)}
                className="px-3 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
