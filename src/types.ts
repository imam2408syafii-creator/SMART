export type PermissionCode =
  | 'dashboard:view'
  | 'profile:view'
  | 'profile:edit'
  | 'activities:view'
  | 'activities:manage'
  | 'letters:download'
  | 'budget:view'
  | 'budget:manage'
  | 'data:manage'
  | 'users:manage'
  | 'settings:manage'
  | 'backup:export';

export interface User {
  id: number;
  username: string;
  full_name: string;
  email: string;
  nip_demo: string;
  position: string;
  role_id: number;
  role_code: 'ADMIN' | 'OPERATOR' | 'PIMPINAN' | 'INTERNAL' | string;
  role_name: string;
  unit_id: number | null;
  unit_name: string | null;
  permissions: PermissionCode[];
  is_active: number;
  created_at?: string;
}

export interface RoleItem {
  id: number;
  code: string;
  name: string;
  description: string;
  permissions: PermissionCode[];
}

export interface SupportingDoc {
  id: string;
  title: string;
  description: string;
  fileName: string;
  downloadUrl: string;
  uploadedAt: string;
}

export interface OrganizationProfile {
  id: number;
  app_name: string;
  app_subtitle: string;
  org_name: string;
  org_address: string;
  org_phone: string;
  org_email: string;
  org_website: string;
  active_budget_year: number;
  logo_url: string | null;
  building_photo_url: string | null;
  history_text: string;
  vision_text: string;
  missions: string[];
  duties_text: string;
  functions: string[];
  supportingInfo: SupportingDoc[];
  updated_at: string;
}

export interface OrganizationUnit {
  id: number;
  code: string;
  name: string;
  head_title: string;
  parent_id: number | null;
  description: string;
  tasks: string[];
  sort_order: number;
}

export interface ActivityPhoto {
  id: number;
  activity_id: number;
  file_path: string;
  caption: string;
  is_cover: number;
  created_at: string;
}

export interface AssignmentLetter {
  id: number;
  activity_id: number;
  letter_number: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  created_at: string;
}

export interface ActivityItem {
  id: number;
  activity_code: string;
  title: string;
  activity_date: string;
  month: number;
  year: number;
  location: string;
  unit_id: number | null;
  unit_name: string | null;
  creator_name: string | null;
  description: string;
  is_demo: number;
  created_at: string;
  updated_at: string;
  photos: ActivityPhoto[];
  letters: AssignmentLetter[];
}

export interface BudgetItem {
  id: number;
  fiscal_year: number;
  month: number;
  unit_id: number | null;
  unit_name: string | null;
  unit_code: string | null;
  program_name: string;
  activity_name: string;
  pagu: number;
  realisasi: number;
  sisa: number;
  persentase: number;
  notes: string;
  is_demo: number;
  updated_at: string;
}

export interface AuditLogItem {
  id: number;
  user_id: number | null;
  username: string;
  action: string;
  entity_type: string;
  entity_id: string;
  details: string;
  ip_address: string;
  created_at: string;
}

export const MONTH_NAMES = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

export const PERMISSION_LABELS: Record<PermissionCode, { label: string; group: string }> = {
  'dashboard:view': { label: 'Melihat Dashboard Utama', group: 'Informasi Umum' },
  'profile:view': { label: 'Melihat Profil BAPPEDA', group: 'Profil Organisasi' },
  'profile:edit': { label: 'Mengubah Profil & Struktur Bidang', group: 'Profil Organisasi' },
  'activities:view': { label: 'Melihat & Mencari Kegiatan Bulanan', group: 'Kegiatan' },
  'activities:manage': { label: 'Tambah, Edit, Hapus Kegiatan & Upload Foto/PDF', group: 'Kegiatan' },
  'letters:download': { label: 'Membuka & Mengunduh Surat Tugas PDF', group: 'Kegiatan' },
  'budget:view': { label: 'Melihat Grafik & Data Penyerapan Anggaran', group: 'Anggaran' },
  'budget:manage': { label: 'Input, Edit & Hapus Data Anggaran', group: 'Anggaran' },
  'data:manage': { label: 'Mengakses Menu Manajemen Data', group: 'Administrasi' },
  'users:manage': { label: 'Mengelola Akun Pengguna & Log Audit', group: 'Administrasi' },
  'settings:manage': { label: 'Mengubah Pengaturan Aplikasi, Logo & Hak Akses', group: 'Administrasi' },
  'backup:export': { label: 'Mengunduh Backup Database', group: 'Administrasi' },
};
