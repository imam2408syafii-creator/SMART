import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { writeMinimalPdf } from './pdfGenerator.ts';

export const DATA_DIR = path.resolve(process.cwd(), 'data');
export const STORAGE_DIR = path.resolve(process.cwd(), 'storage');
export const LETTERS_DIR = path.join(STORAGE_DIR, 'letters');
export const UPLOADS_DIR = path.join(STORAGE_DIR, 'uploads');
export const PHOTOS_DIR = path.join(UPLOADS_DIR, 'photos');
export const LOGOS_DIR = path.join(UPLOADS_DIR, 'logos');
export const DOCS_DIR = path.join(STORAGE_DIR, 'docs');

for (const dir of [DATA_DIR, STORAGE_DIR, LETTERS_DIR, UPLOADS_DIR, PHOTOS_DIR, LOGOS_DIR, DOCS_DIR]) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export const DB_PATH = path.join(DATA_DIR, 'smart_bappeda.db');
const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export const ALL_PERMISSIONS = [
  'dashboard:view',
  'profile:view',
  'profile:edit',
  'activities:view',
  'activities:manage',
  'letters:download',
  'budget:view',
  'budget:manage',
  'data:manage',
  'users:manage',
  'settings:manage',
  'backup:export',
] as const;

export type PermissionCode = (typeof ALL_PERMISSIONS)[number];

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      permissions_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS organization_units (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      head_title TEXT NOT NULL,
      parent_id INTEGER NULL REFERENCES organization_units(id) ON DELETE SET NULL,
      description TEXT NOT NULL,
      tasks_json TEXT NOT NULL DEFAULT '[]',
      sort_order INTEGER NOT NULL DEFAULT 0,
      photo_url TEXT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      nip_demo TEXT NOT NULL DEFAULT '',
      position TEXT NOT NULL DEFAULT '',
      role_id INTEGER NOT NULL REFERENCES roles(id),
      unit_id INTEGER NULL REFERENCES organization_units(id) ON DELETE SET NULL,
      password_hash TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS organization_profiles (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      app_name TEXT NOT NULL,
      app_subtitle TEXT NOT NULL,
      org_name TEXT NOT NULL,
      org_address TEXT NOT NULL,
      org_phone TEXT NOT NULL,
      org_email TEXT NOT NULL,
      org_website TEXT NOT NULL,
      active_budget_year INTEGER NOT NULL,
      logo_url TEXT NULL,
      building_photo_url TEXT NULL,
      history_text TEXT NOT NULL,
      vision_text TEXT NOT NULL,
      mission_json TEXT NOT NULL,
      duties_text TEXT NOT NULL,
      functions_json TEXT NOT NULL,
      supporting_info_json TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS activities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      activity_code TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      activity_date TEXT NOT NULL,
      month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
      year INTEGER NOT NULL,
      location TEXT NOT NULL,
      unit_id INTEGER NULL REFERENCES organization_units(id) ON DELETE SET NULL,
      description TEXT NOT NULL,
      is_demo INTEGER NOT NULL DEFAULT 0,
      created_by INTEGER NULL REFERENCES users(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS activity_photos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      activity_id INTEGER NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
      file_path TEXT NOT NULL,
      caption TEXT NOT NULL DEFAULT '',
      is_cover INTEGER NOT NULL DEFAULT 0,
      uploaded_by INTEGER NULL REFERENCES users(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS assignment_letters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      activity_id INTEGER NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
      letter_number TEXT NOT NULL,
      file_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      mime_type TEXT NOT NULL DEFAULT 'application/pdf',
      uploaded_by INTEGER NULL REFERENCES users(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS budget_data (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fiscal_year INTEGER NOT NULL,
      month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
      unit_id INTEGER NULL REFERENCES organization_units(id) ON DELETE SET NULL,
      program_name TEXT NOT NULL,
      activity_name TEXT NOT NULL DEFAULT '',
      pagu REAL NOT NULL CHECK (pagu >= 0),
      realisasi REAL NOT NULL CHECK (realisasi >= 0),
      notes TEXT NOT NULL DEFAULT '',
      is_demo INTEGER NOT NULL DEFAULT 0,
      updated_by INTEGER NULL REFERENCES users(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NULL REFERENCES users(id) ON DELETE SET NULL,
      username TEXT NOT NULL,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL DEFAULT '',
      details TEXT NOT NULL DEFAULT '',
      ip_address TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const roleCount = db.prepare('SELECT COUNT(*) as cnt FROM roles').get() as { cnt: number };
  if (roleCount.cnt === 0) {
    seedInitialData();
  }
}

function seedInitialData() {
  const insertRole = db.prepare(
    'INSERT INTO roles (code, name, description, permissions_json) VALUES (?, ?, ?, ?)'
  );

  insertRole.run(
    'ADMIN',
    'Administrator',
    'Pengelola penuh seluruh menu, akun pengguna, hak akses, profil organisasi, kegiatan, data anggaran, pengaturan, dan backup database.',
    JSON.stringify([
      'dashboard:view',
      'profile:view',
      'profile:edit',
      'activities:view',
      'activities:manage',
      'letters:download',
      'budget:view',
      'budget:manage',
      'data:manage',
      'users:manage',
      'settings:manage',
      'backup:export',
    ])
  );

  insertRole.run(
    'OPERATOR',
    'Petugas Pengelola Data',
    'Mengelola kegiatan bulanan, mengunggah foto dokumentasi dan surat tugas PDF, serta memperbarui data anggaran sesuai kewenangan.',
    JSON.stringify([
      'dashboard:view',
      'profile:view',
      'activities:view',
      'activities:manage',
      'letters:download',
      'budget:view',
      'budget:manage',
      'data:manage',
    ])
  );

  insertRole.run(
    'PIMPINAN',
    'Pimpinan',
    'Memantau dashboard eksekutif, profil organisasi, pelaksanaan kegiatan bulanan, lampiran surat tugas, dan penyerapan anggaran.',
    JSON.stringify([
      'dashboard:view',
      'profile:view',
      'activities:view',
      'letters:download',
      'budget:view',
    ])
  );

  insertRole.run(
    'INTERNAL',
    'Pengguna Internal',
    'Melihat informasi yang diizinkan, mencari kegiatan bulanan, serta melihat dokumentasi dan lampiran surat tugas sesuai hak akses.',
    JSON.stringify([
      'dashboard:view',
      'profile:view',
      'activities:view',
      'letters:download',
      'budget:view',
    ])
  );

  const insertUnit = db.prepare(
    'INSERT INTO organization_units (code, name, head_title, parent_id, description, tasks_json, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );

  const uKepala = insertUnit.run(
    'KEPALA',
    'Kepala BAPPEDA',
    'Kepala Badan',
    null,
    'Memimpin, mengoordinasikan, dan mengendalikan seluruh penyelenggaraan tugas pokok dan fungsi perencanaan pembangunan daerah Kabupaten Sidoarjo. (Data Struktur DEMO)',
    JSON.stringify([
      'Menetapkan kebijakan teknis perencanaan pembangunan daerah.',
      'Mengoordinasikan penyusunan RPJPD, RPJMD, dan RKPD Kabupaten Sidoarjo.',
      'Melaksanakan pembinaan dan pengendalian evaluasi pembangunan lintas perangkat daerah.',
    ]),
    1
  ).lastInsertRowid as number;

  const uSekretariat = insertUnit.run(
    'SEKRETARIAT',
    'Sekretariat',
    'Sekretaris Badan',
    uKepala,
    'Memberikan pelayanan teknis dan administratif meliputi penyusunan program, pengelolaan keuangan, kepegawaian, perlengkapan, dan ketatausahaan BAPPEDA. (Data DEMO)',
    JSON.stringify([
      'Menyusun rencana kerja, anggaran, dan laporan kinerja internal badan.',
      'Mengelola administrasi kepegawaian, surat-menyurat, dan arsip kedinasan.',
      'Menyelenggarakan pengelolaan keuangan serta penatausahaan barang milik daerah.',
    ]),
    2
  ).lastInsertRowid as number;

  const uPPEPD = insertUnit.run(
    'BID-PPEPD',
    'Bidang Perencanaan, Pengendalian dan Evaluasi Pembangunan Daerah',
    'Kepala Bidang PPEPD',
    uKepala,
    'Melaksanakan pengoordinasian penyusunan dokumen perencanaan makro daerah serta pengendalian dan evaluasi capaian pembangunan. (Data DEMO)',
    JSON.stringify([
      'Menyusun rancangan RPJPD, RPJMD, RKPD, dan sinkronisasi KUA-PPAS.',
      'Mengelola data statistik perencanaan pembangunan dan indikator makro daerah.',
      'Melaksanakan monitoring dan evaluasi triwulanan kinerja perangkat daerah.',
    ]),
    3
  ).lastInsertRowid as number;

  const uPPM = insertUnit.run(
    'BID-PPM',
    'Bidang Pemerintahan dan Pembangunan Manusia',
    'Kepala Bidang PPM',
    uKepala,
    'Mengoordinasikan perencanaan pembangunan sektor pemerintahan, pendidikan, kesehatan, sosial, pemberdayaan masyarakat, dan pelayanan publik. (Data DEMO)',
    JSON.stringify([
      'Merumuskan prioritas pembangunan bidang pendidikan dan layanan kesehatan daerah.',
      'Mengoordinasikan program penanggulangan kemiskinan dan perlindungan sosial.',
      'Melakukan verifikasi rencana kerja perangkat daerah rumpun pemerintahan.',
    ]),
    4
  ).lastInsertRowid as number;

  const uPSDA = insertUnit.run(
    'BID-PSDA',
    'Bidang Perekonomian dan Sumber Daya Alam',
    'Kepala Bidang PSDA',
    uKepala,
    'Melaksanakan perencanaan pembangunan di bidang investasi, UMKM, perindustrian, perdagangan, pertanian, ketahanan pangan, dan lingkungan hidup. (Data DEMO)',
    JSON.stringify([
      'Mendorong penguatan ekonomi lokal, koperasi, UMKM, dan iklim investasi daerah.',
      'Merencanakan kebijakan ketahanan pangan, perikanan, dan pengelolaan sumber daya alam.',
      'Mengevaluasi kontribusi sektor produktif terhadap pertumbuhan ekonomi daerah.',
    ]),
    5
  ).lastInsertRowid as number;

  const uIK = insertUnit.run(
    'BID-IK',
    'Bidang Infrastruktur dan Kewilayahan',
    'Kepala Bidang Infrastruktur & Kewilayahan',
    uKepala,
    'Mengoordinasikan perencanaan prasarana wilayah, jalan, drainase, pengendalian banjir, tata ruang, perumahan, dan transportasi. (Data DEMO)',
    JSON.stringify([
      'Menyelaraskan rencana pembangunan infrastruktur konektivitas dan pengendalian banjir.',
      'Mengoordinasikan sinkronisasi tata ruang wilayah (RTRW) dan kawasan strategis.',
      'Melakukan peninjauan lapangan terhadap usulan prioritas prasarana kewilayahan.',
    ]),
    6
  ).lastInsertRowid as number;

  const uLitbang = insertUnit.run(
    'BID-LITBANG',
    'Bidang Penelitian dan Pengembangan',
    'Kepala Bidang Penelitian & Pengembangan',
    uKepala,
    'Menyelenggarakan kajian, riset kebijakan daerah, serta fasilitasi inovasi tata kelola pemerintahan dan pelayanan publik Kabupaten Sidoarjo. (Data DEMO)',
    JSON.stringify([
      'Melaksanakan kajian ilmiah dan analisis kebijakan strategis pembangunan daerah.',
      'Memfasilitasi ekosistem inovasi daerah dan diseminasi hasil kelitbangan.',
      'Menyusun rekomendasi kebijakan berbasis bukti untuk pimpinan daerah.',
    ]),
    7
  ).lastInsertRowid as number;

  // Seed Users (hashed with bcryptjs)
  const roles = db.prepare('SELECT id, code FROM roles').all() as Array<{ id: number; code: string }>;
  const roleMap = Object.fromEntries(roles.map((r) => [r.code, r.id]));

  const insertUser = db.prepare(
    'INSERT INTO users (username, full_name, email, nip_demo, position, role_id, unit_id, password_hash, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)'
  );

  const adminId = insertUser.run(
    'admin.demo',
    'Administrator Sistem (Akun DEMO)',
    'admin.demo@bappeda-sidoarjo.example',
    'DEMO-ADM-001',
    'Administrator Aplikasi SMART BAPPEDA',
    roleMap['ADMIN'],
    uSekretariat,
    bcrypt.hashSync('AdminDemo2026!', 10)
  ).lastInsertRowid as number;

  const operatorId = insertUser.run(
    'petugas.demo',
    'Petugas Pengelola Data (Akun DEMO)',
    'petugas.demo@bappeda-sidoarjo.example',
    'DEMO-OPR-002',
    'Analis Perencanaan & Pengelola Data',
    roleMap['OPERATOR'],
    uPPEPD,
    bcrypt.hashSync('PetugasDemo2026!', 10)
  ).lastInsertRowid as number;

  insertUser.run(
    'pimpinan.demo',
    'Pimpinan BAPPEDA (Akun DEMO)',
    'pimpinan.demo@bappeda-sidoarjo.example',
    'DEMO-PMP-003',
    'Pimpinan / Kepala Unit Perencanaan',
    roleMap['PIMPINAN'],
    uKepala,
    bcrypt.hashSync('PimpinanDemo2026!', 10)
  );

  insertUser.run(
    'internal.demo',
    'Pengguna Internal (Akun DEMO)',
    'internal.demo@bappeda-sidoarjo.example',
    'DEMO-INT-004',
    'Staf Fungsional Internal',
    roleMap['INTERNAL'],
    uPPM,
    bcrypt.hashSync('InternalDemo2026!', 10)
  );

  // Seed Supporting Document PDF
  const profileDocName = 'Panduan_Struktur_DEMO_SMART_BAPPEDA.pdf';
  const profileDocPath = path.join(DOCS_DIR, profileDocName);
  writeMinimalPdf(profileDocPath, 'DOKUMEN PENDUKUNG PROFIL ORGANISASI (DEMO)', [
    'SMART BAPPEDA KABUPATEN SIDOARJO',
    '------------------------------------------------------------',
    'Catatan: Dokumen ini adalah berkas contoh (DEMO) untuk pengujian',
    'pengunggahan dan pengunduhan lampiran profil organisasi.',
    '',
    'Isi Ringkas:',
    '1. Informasi umum perencanaan pembangunan daerah Kabupaten Sidoarjo.',
    '2. Tata kelola dokumen perencanaan RPJPD, RPJMD, dan RKPD.',
    '3. Dokumentasi dapat diperbarui oleh Administrator melalui menu Profil BAPPEDA.',
  ]);

  db.prepare(`
    INSERT INTO organization_profiles (
      id, app_name, app_subtitle, org_name, org_address, org_phone, org_email, org_website,
      active_budget_year, logo_url, building_photo_url, history_text, vision_text,
      mission_json, duties_text, functions_json, supporting_info_json
    ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'SMART BAPPEDA',
    'KABUPATEN SIDOARJO',
    'Badan Perencanaan Pembangunan Daerah Kabupaten Sidoarjo',
    'Jl. Sultan Agung No. 13, Sidoarjo, Jawa Timur 61212 (Alamat Contoh DEMO)',
    '(031) 892-0000 (Kontak DEMO)',
    'info.demo@bappeda-sidoarjo.example',
    'https://bappeda.sidoarjokab.example',
    2026,
    '/src/assets/images/bappeda_office_facade_1794887970369.jpg',
    'Badan Perencanaan Pembangunan Daerah (BAPPEDA) Kabupaten Sidoarjo merupakan unsur penunjang urusan pemerintahan bidang perencanaan pembangunan daerah serta penelitian dan pengembangan. Aplikasi SMART BAPPEDA dikembangkan sebagai pusat informasi digital internal untuk mendokumentasikan kegiatan bulanan, pengarsipan surat tugas, dan pemantauan penyerapan anggaran secara transparan. (Teks ini merupakan konten DEMO dan dapat disesuaikan oleh Administrator).',
    'Terwujudnya Perencanaan Pembangunan Kabupaten Sidoarjo yang Partisipatif, Akuntabel, Inovatif, dan Berkelanjutan. (Visi Contoh DEMO)',
    JSON.stringify([
      'Meningkatkan kualitas dokumen perencanaan pembangunan daerah berbasis data yang akurat dan terintegrasi.',
      'Memperkuat koordinasi perencanaan lintas perangkat daerah serta partisipasi pemangku kepentingan.',
      'Mengoptimalkan pengendalian, evaluasi program, serta akuntabilitas penyerapan anggaran.',
      'Mendorong inovasi daerah dan kajian kelitbangan untuk mendukung kebijakan pembangunan strategis.',
    ]),
    'Membantu Bupati dalam melaksanakan fungsi penunjang urusan pemerintahan yang menjadi kewenangan daerah di bidang perencanaan pembangunan serta bidang penelitian dan pengembangan. (Konten DEMO)',
    JSON.stringify([
      'Penyusunan kebijakan teknis perencanaan pembangunan daerah dan kelitbangan.',
      'Pelaksanaan tugas dukungan teknis penyusunan RPJPD, RPJMD, dan RKPD.',
      'Pemantauan, evaluasi, dan pelaporan pelaksanaan rencana pembangunan daerah.',
      'Pembinaan teknis penyelenggaraan fungsi penunjang perencanaan perangkat daerah.',
      'Pelaksanaan administrasi kesekretariatan badan sesuai ketentuan perundang-undangan.',
    ]),
    JSON.stringify([
      {
        id: 'doc-demo-1',
        title: 'Dokumen Ikhtisar Tata Kelola Perencanaan (DEMO)',
        description: 'Lampiran contoh format PDF untuk informasi pendukung profil BAPPEDA.',
        fileName: profileDocName,
        downloadUrl: '/api/profile/docs/Panduan_Struktur_DEMO_SMART_BAPPEDA.pdf',
        uploadedAt: '2026-01-15',
      },
    ])
  );

  // Seed DEMO Activities
  const insertActivity = db.prepare(`
    INSERT INTO activities (activity_code, title, activity_date, month, year, location, unit_id, description, is_demo, created_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
  `);
  const insertPhoto = db.prepare(`
    INSERT INTO activity_photos (activity_id, file_path, caption, is_cover, uploaded_by)
    VALUES (?, ?, ?, ?, ?)
  `);
  const insertLetter = db.prepare(`
    INSERT INTO assignment_letters (activity_id, letter_number, file_name, file_path, file_size, uploaded_by)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const demoActivities = [
    {
      code: 'KEG-2026-001',
      title: '[DEMO] Forum Konsultasi Publik Rancangan Awal RKPD Tahun 2027',
      date: '2026-02-18',
      month: 2,
      year: 2026,
      location: 'Aula BAPPEDA Kabupaten Sidoarjo (Lokasi DEMO)',
      unitId: uPPEPD,
      description:
        'Kegiatan DEMO: Penyelenggaraan forum konsultasi publik bersama perangkat daerah, akademisi, dan perwakilan masyarakat untuk menyelaraskan prioritas pembangunan daerah serta target indikator kinerja makro tahun rencana.',
      photo: '/src/assets/images/activity_musrenbang_forum_1794887970770.jpg',
      caption: 'Dokumentasi DEMO diskusi forum konsultasi publik perencanaan daerah.',
      letterNo: '094/DEMO-ST/021/2026',
      createdAt: '2026-02-19 09:15:00',
    },
    {
      code: 'KEG-2026-002',
      title: '[DEMO] Peninjauan Lapangan Infrastruktur Koridor Jalan dan Drainase Wilayah Tengah',
      date: '2026-04-09',
      month: 4,
      year: 2026,
      location: 'Kecamatan Sidoarjo & Buduran (Lokasi DEMO)',
      unitId: uIK,
      description:
        'Kegiatan DEMO: Tim Bidang Infrastruktur dan Kewilayahan melaksanakan survei verifikasi teknis kondisi jaringan jalan penghubung, jalur pedestrian, dan saluran drainase prioritas guna bahan sinkronisasi usulan tahun berjalan.',
      photo: '/src/assets/images/activity_field_survey_1794887972204.jpg',
      caption: 'Dokumentasi DEMO peninjauan lapangan koridor infrastruktur perkotaan.',
      letterNo: '094/DEMO-ST/054/2026',
      createdAt: '2026-04-10 14:20:00',
    },
    {
      code: 'KEG-2026-003',
      title: '[DEMO] Rapat Koordinasi Evaluasi Penyerapan Anggaran dan Capaian Program Triwulan II',
      date: '2026-06-24',
      month: 6,
      year: 2026,
      location: 'Ruang Rapat Lantai 2 BAPPEDA (Lokasi DEMO)',
      unitId: uSekretariat,
      description:
        'Kegiatan DEMO: Evaluasi terpadu realisasi keuangan dan fisik seluruh bidang untuk memastikan kesesuaian jadwal pelaksanaan kegiatan, kelengkapan dokumen pertanggungjawaban, dan percepatan serapan anggaran.',
      photo: '/src/assets/images/activity_data_workshop_1794887971897.jpg',
      caption: 'Dokumentasi DEMO rapat koordinasi evaluasi serapan anggaran triwulan II.',
      letterNo: '094/DEMO-ST/089/2026',
      createdAt: '2026-06-25 10:05:00',
    },
    {
      code: 'KEG-2026-004',
      title: '[DEMO] Desk Verifikasi Usulan Program Pemberdayaan Ekonomi dan UMKM Daerah',
      date: '2026-08-14',
      month: 8,
      year: 2026,
      location: 'Ruang Desk Perencanaan PSDA (Lokasi DEMO)',
      unitId: uPSDA,
      description:
        'Kegiatan DEMO: Pembahasan teknis indikator keluaran sub-kegiatan penguatan daya saing UMKM, fasilitasi kemitraan investasi lokal, dan dukungan ketahanan pangan berkelanjutan.',
      photo: '/src/assets/images/activity_musrenbang_forum_1794887970770.jpg',
      caption: 'Dokumentasi DEMO desk verifikasi program ekonomi dan sumber daya alam.',
      letterNo: '094/DEMO-ST/112/2026',
      createdAt: '2026-08-15 11:40:00',
    },
    {
      code: 'KEG-2026-005',
      title: '[DEMO] Diseminasi Hasil Kajian Inovasi Layanan Publik dan Tata Kelola Data',
      date: '2026-10-07',
      month: 10,
      year: 2026,
      location: 'Ruang Rapat Utama BAPPEDA (Lokasi DEMO)',
      unitId: uLitbang,
      description:
        'Kegiatan DEMO: Pemaparan rekomendasi kebijakan hasil penelitian dan pengembangan terkait integrasi satu data perencanaan daerah serta peningkatan kualitas layanan publik.',
      photo: '/src/assets/images/activity_data_workshop_1794887971897.jpg',
      caption: 'Dokumentasi DEMO workshop diseminasi kajian inovasi daerah.',
      letterNo: '094/DEMO-ST/145/2026',
      createdAt: '2026-10-08 08:50:00',
    },
    {
      code: 'KEG-2026-006',
      title: '[DEMO] Sinkronisasi Program Pendidikan dan Kesehatan dalam Rencana Kerja Daerah',
      date: '2026-11-05',
      month: 11,
      year: 2026,
      location: 'Ruang Rapat Bidang PPM (Lokasi DEMO)',
      unitId: uPPM,
      description:
        'Kegiatan DEMO: Rapat koordinasi lintas perangkat daerah rumpun pemerintahan dan pembangunan manusia untuk memetakan intervensi penurunan stunting dan peningkatan mutu layanan pendidikan dasar.',
      photo: '/src/assets/images/activity_musrenbang_forum_1794887970770.jpg',
      caption: 'Dokumentasi DEMO sinkronisasi program pembangunan manusia.',
      letterNo: '094/DEMO-ST/168/2026',
      createdAt: '2026-11-06 13:15:00',
    },
  ];

  for (const act of demoActivities) {
    const actId = insertActivity.run(
      act.code,
      act.title,
      act.date,
      act.month,
      act.year,
      act.location,
      act.unitId,
      act.description,
      operatorId,
      act.createdAt
    ).lastInsertRowid as number;

    insertPhoto.run(actId, act.photo, act.caption, 1, operatorId);

    const pdfFilename = `Surat_Tugas_${act.code}_DEMO.pdf`;
    const pdfFullPath = path.join(LETTERS_DIR, pdfFilename);
    const pdfSize = writeMinimalPdf(pdfFullPath, `SURAT TUGAS KEGIATAN (DOKUMEN DEMO)`, [
      `Nomor Surat    : ${act.letterNo}`,
      `ID Kegiatan    : ${act.code}`,
      `Nama Kegiatan  : ${act.title}`,
      `Tanggal        : ${act.date}`,
      `Lokasi         : ${act.location}`,
      '--------------------------------------------------------------------',
      'PERHATIAN: Dokumen ini adalah berkas lampiran contoh (DEMO).',
      'Bukan merupakan surat tugas resmi instansi pemerintah.',
      'Dilindungi oleh sistem kontrol akses SMART BAPPEDA Kabupaten Sidoarjo.',
    ]);

    insertLetter.run(actId, act.letterNo, pdfFilename, pdfFilename, pdfSize, operatorId);
  }

  // Seed DEMO Budget Data for 2026 (months 1..11 populated, month 12 intentionally left empty/unavailable!)
  const insertBudget = db.prepare(`
    INSERT INTO budget_data (fiscal_year, month, unit_id, program_name, activity_name, pagu, realisasi, notes, is_demo, updated_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
  `);

  const budgetSeeds = [
    // Secretariat
    { year: 2026, month: 1, unit: uSekretariat, prog: 'Program Penunjang Urusan Pemerintahan Daerah (DEMO)', act: 'Administrasi Keuangan & Operasional Kantor', pagu: 280000000, real: 215000000 },
    { year: 2026, month: 2, unit: uSekretariat, prog: 'Program Penunjang Urusan Pemerintahan Daerah (DEMO)', act: 'Pemeliharaan Sarana Prasarana & Ketatausahaan', pagu: 310000000, real: 268000000 },
    { year: 2026, month: 3, unit: uSekretariat, prog: 'Program Penunjang Urusan Pemerintahan Daerah (DEMO)', act: 'Penyusunan Laporan Kinerja & Keuangan Triwulan I', pagu: 295000000, real: 254000000 },
    { year: 2026, month: 4, unit: uSekretariat, prog: 'Program Penunjang Urusan Pemerintahan Daerah (DEMO)', act: 'Operasional Layanan Administrasi Kepegawaian', pagu: 270000000, real: 229000000 },
    { year: 2026, month: 5, unit: uSekretariat, prog: 'Program Penunjang Urusan Pemerintahan Daerah (DEMO)', act: 'Dukungan Rapat Koordinasi & Pengadaan ATK', pagu: 300000000, real: 261000000 },
    { year: 2026, month: 6, unit: uSekretariat, prog: 'Program Penunjang Urusan Pemerintahan Daerah (DEMO)', act: 'Evaluasi Realisasi Semester I', pagu: 340000000, real: 312000000 },
    { year: 2026, month: 7, unit: uSekretariat, prog: 'Program Penunjang Urusan Pemerintahan Daerah (DEMO)', act: 'Penatausahaan Aset dan Operasional Rutin', pagu: 290000000, real: 245000000 },
    { year: 2026, month: 8, unit: uSekretariat, prog: 'Program Penunjang Urusan Pemerintahan Daerah (DEMO)', act: 'Dukungan Kegiatan Perencanaan Perubahan', pagu: 325000000, real: 289000000 },
    { year: 2026, month: 9, unit: uSekretariat, prog: 'Program Penunjang Urusan Pemerintahan Daerah (DEMO)', act: 'Monitoring Administrasi Triwulan III', pagu: 315000000, real: 274000000 },
    { year: 2026, month: 10, unit: uSekretariat, prog: 'Program Penunjang Urusan Pemerintahan Daerah (DEMO)', act: 'Operasional & Pemeliharaan Sistem Informasi', pagu: 330000000, real: 282000000 },
    { year: 2026, month: 11, unit: uSekretariat, prog: 'Program Penunjang Urusan Pemerintahan Daerah (DEMO)', act: 'Persiapan Penutupan Tahun Anggaran', pagu: 360000000, real: 240000000 },

    // PPEPD
    { year: 2026, month: 2, unit: uPPEPD, prog: 'Program Perencanaan, Pengendalian & Evaluasi Pembangunan (DEMO)', act: 'Forum Konsultasi Publik & Penyusunan RKPD', pagu: 450000000, real: 398000000 },
    { year: 2026, month: 3, unit: uPPEPD, prog: 'Program Perencanaan, Pengendalian & Evaluasi Pembangunan (DEMO)', act: 'Musrenbang Kabupaten & Sinkronisasi Data', pagu: 520000000, real: 472000000 },
    { year: 2026, month: 6, unit: uPPEPD, prog: 'Program Perencanaan, Pengendalian & Evaluasi Pembangunan (DEMO)', act: 'Pengendalian & Evaluasi RPJMD/RKPD Semester I', pagu: 380000000, real: 341000000 },
    { year: 2026, month: 9, unit: uPPEPD, prog: 'Program Perencanaan, Pengendalian & Evaluasi Pembangunan (DEMO)', act: 'Penyusunan KUA-PPAS & Perubahan RKPD', pagu: 410000000, real: 355000000 },
    { year: 2026, month: 11, unit: uPPEPD, prog: 'Program Perencanaan, Pengendalian & Evaluasi Pembangunan (DEMO)', act: 'Evaluasi Kinerja Daerah Triwulan IV Awal', pagu: 350000000, real: 210000000 },

    // PPM
    { year: 2026, month: 3, unit: uPPM, prog: 'Program Koordinasi Pemerintahan & Pembangunan Manusia (DEMO)', act: 'Sinkronisasi Program Pendidikan & Kesehatan', pagu: 320000000, real: 278000000 },
    { year: 2026, month: 5, unit: uPPM, prog: 'Program Koordinasi Pemerintahan & Pembangunan Manusia (DEMO)', act: 'Koordinasi Penanggulangan Kemiskinan Daerah', pagu: 290000000, real: 249000000 },
    { year: 2026, month: 8, unit: uPPM, prog: 'Program Koordinasi Pemerintahan & Pembangunan Manusia (DEMO)', act: 'Evaluasi Capaian Standar Pelayanan Minimal', pagu: 310000000, real: 262000000 },
    { year: 2026, month: 11, unit: uPPM, prog: 'Program Koordinasi Pemerintahan & Pembangunan Manusia (DEMO)', act: 'Rakor Evaluasi Penurunan Stunting', pagu: 280000000, real: 195000000 },

    // PSDA
    { year: 2026, month: 2, unit: uPSDA, prog: 'Program Koordinasi Perekonomian & SDA (DEMO)', act: 'Pemetaan Potensi Investasi & UMKM Daerah', pagu: 310000000, real: 265000000 },
    { year: 2026, month: 5, unit: uPSDA, prog: 'Program Koordinasi Perekonomian & SDA (DEMO)', act: 'Koordinasi Ketahanan Pangan & Lingkungan Hidup', pagu: 340000000, real: 298000000 },
    { year: 2026, month: 8, unit: uPSDA, prog: 'Program Koordinasi Perekonomian & SDA (DEMO)', act: 'Desk Verifikasi Program Ekonomi Produktif', pagu: 360000000, real: 318000000 },
    { year: 2026, month: 10, unit: uPSDA, prog: 'Program Koordinasi Perekonomian & SDA (DEMO)', act: 'Evaluasi Pertumbuhan Sektor Unggulan', pagu: 295000000, real: 242000000 },

    // Infrastruktur
    { year: 2026, month: 4, unit: uIK, prog: 'Program Koordinasi Infrastruktur & Kewilayahan (DEMO)', act: 'Survei Teknis Jalan & Drainase Perkotaan', pagu: 420000000, real: 374000000 },
    { year: 2026, month: 7, unit: uIK, prog: 'Program Koordinasi Infrastruktur & Kewilayahan (DEMO)', act: 'Sinkronisasi Tata Ruang & Kawasan Strategis', pagu: 390000000, real: 332000000 },
    { year: 2026, month: 10, unit: uIK, prog: 'Program Koordinasi Infrastruktur & Kewilayahan (DEMO)', act: 'Monitoring Pembangunan Prasarana Pengendalian Banjir', pagu: 440000000, real: 368000000 },

    // Litbang
    { year: 2026, month: 4, unit: uLitbang, prog: 'Program Penelitian & Pengembangan Daerah (DEMO)', act: 'Kajian Kebijakan Transformasi Layanan Publik', pagu: 260000000, real: 221000000 },
    { year: 2026, month: 7, unit: uLitbang, prog: 'Program Penelitian & Pengembangan Daerah (DEMO)', act: 'Fasilitasi Kompetisi Inovasi Daerah', pagu: 310000000, real: 279000000 },
    { year: 2026, month: 10, unit: uLitbang, prog: 'Program Penelitian & Pengembangan Daerah (DEMO)', act: 'Diseminasi Hasil Kajian & Satu Data', pagu: 275000000, real: 234000000 },

    // 2025 historical DEMO summary
    { year: 2025, month: 3, unit: uPPEPD, prog: 'Program Perencanaan & Evaluasi Daerah 2025 (DEMO)', act: 'Penyusunan RKPD 2026', pagu: 850000000, real: 812000000 },
    { year: 2025, month: 6, unit: uSekretariat, prog: 'Program Penunjang Urusan Pemerintahan 2025 (DEMO)', act: 'Operasional & Pengelolaan Administrasi Semester I', pagu: 1200000000, real: 1140000000 },
    { year: 2025, month: 9, unit: uIK, prog: 'Program Infrastruktur & Kewilayahan 2025 (DEMO)', act: 'Kajian Masterplan Drainase Wilayah Timur', pagu: 760000000, real: 705000000 },
    { year: 2025, month: 12, unit: uLitbang, prog: 'Program Kelitbangan Daerah 2025 (DEMO)', act: 'Evaluasi Indeks Inovasi Daerah Tahun 2025', pagu: 540000000, real: 518000000 },
  ];

  for (const b of budgetSeeds) {
    insertBudget.run(
      b.year,
      b.month,
      b.unit,
      b.prog,
      b.act,
      b.pagu,
      b.real,
      'Data contoh (DEMO) — bukan data resmi anggaran BAPPEDA Kabupaten Sidoarjo.',
      adminId
    );
  }

  // Initial Audit Log entry
  db.prepare(
    'INSERT INTO audit_logs (user_id, username, action, entity_type, entity_id, details, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(
    adminId,
    'admin.demo',
    'SYSTEM_INIT',
    'Database',
    '1',
    'Inisialisasi database terstruktur SMART BAPPEDA Kabupaten Sidoarjo dengan dataset DEMO.',
    '127.0.0.1'
  );
}

export default db;
