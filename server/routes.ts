import express from 'express';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import db, {
  ALL_PERMISSIONS,
  DOCS_DIR,
  LETTERS_DIR,
  LOGOS_DIR,
  PHOTOS_DIR,
  DATA_DIR,
  type PermissionCode,
} from './db.ts';
import {
  AUTH_COOKIE_NAME,
  logAudit,
  requireAuth,
  requirePermission,
  signToken,
  type AuthRequest,
} from './auth.ts';

const router = express.Router();

// Configure Multer with strict file size & extension limits
const imageStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, PHOTOS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `img_${Date.now()}_${crypto.randomBytes(4).toString('hex')}${ext}`);
  },
});

const logoStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, LOGOS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `logo_${Date.now()}_${crypto.randomBytes(4).toString('hex')}${ext}`);
  },
});

const pdfStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, LETTERS_DIR),
  filename: (_req, _file, cb) => {
    cb(null, `st_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.pdf`);
  },
});

const docPdfStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, DOCS_DIR),
  filename: (_req, _file, cb) => {
    cb(null, `doc_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.pdf`);
  },
});

const imageFileFilter: multer.Options['fileFilter'] = (_req, file, cb) => {
  const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
  const allowedExts = ['.jpg', '.jpeg', '.png', '.webp'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowedMimes.includes(file.mimetype) && allowedExts.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Format gambar tidak didukung. Gunakan JPG, PNG, atau WEBP (maks. 5 MB).'));
  }
};

const pdfFileFilter: multer.Options['fileFilter'] = (_req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (file.mimetype === 'application/pdf' && ext === '.pdf') {
    cb(null, true);
  } else {
    cb(new Error('Hanya file berformat PDF (.pdf) yang diperbolehkan (maks. 10 MB).'));
  }
};

const uploadPhoto = multer({
  storage: imageStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: imageFileFilter,
});

const uploadLogo = multer({
  storage: logoStorage,
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: imageFileFilter,
});

const uploadLetterPdf = multer({
  storage: pdfStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: pdfFileFilter,
});

const uploadDocPdf = multer({
  storage: docPdfStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: pdfFileFilter,
});

function verifyPdfMagicBytes(filePath: string): boolean {
  try {
    const fd = fs.openSync(filePath, 'r');
    const buf = Buffer.alloc(5);
    fs.readSync(fd, buf, 0, 5, 0);
    fs.closeSync(fd);
    return buf.toString('utf8') === '%PDF-';
  } catch {
    return false;
  }
}

function safeJsonParse<T>(str: string, fallback: T): T {
  try {
    return JSON.parse(str) as T;
  } catch {
    return fallback;
  }
}

// ==========================================
// 1. PUBLIC BRANDING & HEALTH
// ==========================================
router.get('/public/branding', (_req, res) => {
  const profile = db
    .prepare(
      'SELECT app_name, app_subtitle, org_name, logo_url, active_budget_year FROM organization_profiles WHERE id = 1'
    )
    .get();
  res.json(profile);
});

// Public logo serving (for login page & header branding)
router.get('/files/uploads/logos/:filename', (req, res) => {
  const filename = path.basename(req.params.filename);
  const fullPath = path.join(LOGOS_DIR, filename);
  if (!fs.existsSync(fullPath)) {
    res.status(404).json({ error: 'Logo tidak ditemukan.' });
    return;
  }
  res.sendFile(fullPath);
});

// Protected activity photo serving
router.get('/files/uploads/photos/:filename', requireAuth, (req, res) => {
  const filename = path.basename(req.params.filename);
  const fullPath = path.join(PHOTOS_DIR, filename);
  if (!fs.existsSync(fullPath)) {
    res.status(404).json({ error: 'Foto tidak ditemukan.' });
    return;
  }
  res.sendFile(fullPath);
});

// ==========================================
// 2. AUTHENTICATION ROUTES
// ==========================================
router.post('/auth/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password || typeof username !== 'string' || typeof password !== 'string') {
    res.status(400).json({ error: 'Nama pengguna dan kata sandi wajib diisi.' });
    return;
  }

  const userRow = db
    .prepare(
      `SELECT u.*, r.code as role_code, r.name as role_name, r.permissions_json, un.name as unit_name
       FROM users u
       JOIN roles r ON r.id = u.role_id
       LEFT JOIN organization_units un ON un.id = u.unit_id
       WHERE u.username = ?`
    )
    .get(username.trim()) as
    | {
        id: number;
        username: string;
        full_name: string;
        email: string;
        nip_demo: string;
        position: string;
        role_id: number;
        role_code: string;
        role_name: string;
        permissions_json: string;
        unit_id: number | null;
        unit_name: string | null;
        password_hash: string;
        is_active: number;
      }
    | undefined;

  if (!userRow) {
    res.status(401).json({ error: 'Nama pengguna atau kata sandi salah.' });
    return;
  }

  if (userRow.is_active !== 1) {
    res.status(403).json({ error: 'Akun pengguna sedang dinonaktifkan oleh Administrator.' });
    return;
  }

  const valid = bcrypt.compareSync(password, userRow.password_hash);
  if (!valid) {
    res.status(401).json({ error: 'Nama pengguna atau kata sandi salah.' });
    return;
  }

  const token = signToken(userRow.id);
  const isProd = process.env.NODE_ENV === 'production';

  res.cookie(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: isProd ? 'none' : 'lax',
    secure: isProd,
    maxAge: 12 * 60 * 60 * 1000,
    path: '/',
  });

  logAudit(
    { id: userRow.id, username: userRow.username },
    'LOGIN',
    'User',
    userRow.id,
    `Login berhasil dengan peran ${userRow.role_name}.`,
    req
  );

  res.json({
    token,
    user: {
      id: userRow.id,
      username: userRow.username,
      full_name: userRow.full_name,
      email: userRow.email,
      nip_demo: userRow.nip_demo,
      position: userRow.position,
      role_id: userRow.role_id,
      role_code: userRow.role_code,
      role_name: userRow.role_name,
      unit_id: userRow.unit_id,
      unit_name: userRow.unit_name,
      permissions: safeJsonParse<PermissionCode[]>(userRow.permissions_json, []),
      is_active: userRow.is_active,
    },
  });
});

router.post('/auth/logout', requireAuth, (req: AuthRequest, res) => {
  logAudit(req.user, 'LOGOUT', 'User', req.user!.id, 'Pengguna keluar dari sistem.', req);
  res.clearCookie(AUTH_COOKIE_NAME, { path: '/' });
  res.json({ success: true });
});

router.get('/auth/me', requireAuth, (req: AuthRequest, res) => {
  res.json({ user: req.user });
});

router.post('/auth/change-password', requireAuth, (req: AuthRequest, res) => {
  const { currentPassword, newPassword, fullName } = req.body || {};
  const userRow = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user!.id) as
    | { id: number; password_hash: string; full_name: string }
    | undefined;

  if (!userRow) {
    res.status(404).json({ error: 'Pengguna tidak ditemukan.' });
    return;
  }

  if (fullName && typeof fullName === 'string' && fullName.trim().length >= 3) {
    db.prepare('UPDATE users SET full_name = ?, updated_at = datetime("now") WHERE id = ?').run(
      fullName.trim(),
      req.user!.id
    );
  }

  if (newPassword) {
    if (!currentPassword || typeof currentPassword !== 'string') {
      res.status(400).json({ error: 'Kata sandi saat ini wajib diisi untuk mengubah kata sandi.' });
      return;
    }
    if (typeof newPassword !== 'string' || newPassword.length < 8) {
      res.status(400).json({ error: 'Kata sandi baru minimal 8 karakter.' });
      return;
    }
    if (!bcrypt.compareSync(currentPassword, userRow.password_hash)) {
      res.status(400).json({ error: 'Kata sandi saat ini tidak sesuai.' });
      return;
    }
    const hash = bcrypt.hashSync(newPassword, 10);
    db.prepare('UPDATE users SET password_hash = ?, updated_at = datetime("now") WHERE id = ?').run(
      hash,
      req.user!.id
    );
    logAudit(req.user, 'UPDATE_PASSWORD', 'User', req.user!.id, 'Mengubah kata sandi akun.', req);
  }

  res.json({ success: true, message: 'Pengaturan akun berhasil diperbarui.' });
});

// ==========================================
// 3. DASHBOARD ROUTE
// ==========================================
router.get('/dashboard', requireAuth, requirePermission('dashboard:view'), (_req, res) => {
  const profile = db.prepare('SELECT * FROM organization_profiles WHERE id = 1').get() as {
    app_name: string;
    app_subtitle: string;
    org_name: string;
    active_budget_year: number;
    logo_url: string | null;
    building_photo_url: string | null;
    vision_text: string;
    duties_text: string;
  };

  const activeYear = profile?.active_budget_year || 2026;

  const activityCountRow = db
    .prepare('SELECT COUNT(*) as total FROM activities WHERE year = ?')
    .get(activeYear) as { total: number };

  const allActivityCountRow = db.prepare('SELECT COUNT(*) as total FROM activities').get() as {
    total: number;
  };

  const unitCountRow = db.prepare('SELECT COUNT(*) as total FROM organization_units').get() as {
    total: number;
  };

  const recentActivities = db
    .prepare(
      `SELECT a.id, a.activity_code, a.title, a.activity_date, a.month, a.year, a.location, a.description, a.is_demo, a.created_at,
              u.name as unit_name,
              (SELECT file_path FROM activity_photos p WHERE p.activity_id = a.id ORDER BY p.is_cover DESC, p.id ASC LIMIT 1) as cover_photo,
              (SELECT COUNT(*) FROM assignment_letters l WHERE l.activity_id = a.id) as letter_count
       FROM activities a
       LEFT JOIN organization_units u ON u.id = a.unit_id
       ORDER BY a.activity_date DESC, a.id DESC
       LIMIT 5`
    )
    .all();

  const recentPhotos = db
    .prepare(
      `SELECT p.id, p.activity_id, p.file_path, p.caption, a.title as activity_title, a.activity_date, a.activity_code
       FROM activity_photos p
       JOIN activities a ON a.id = p.activity_id
       ORDER BY a.activity_date DESC, p.id DESC
       LIMIT 6`
    )
    .all();

  const budgetRows = db
    .prepare(
      `SELECT month, SUM(pagu) as pagu, SUM(realisasi) as realisasi
       FROM budget_data
       WHERE fiscal_year = ?
       GROUP BY month
       ORDER BY month ASC`
    )
    .all(activeYear) as Array<{ month: number; pagu: number; realisasi: number }>;

  const totalPagu = budgetRows.reduce((acc, r) => acc + (r.pagu || 0), 0);
  const totalRealisasi = budgetRows.reduce((acc, r) => acc + (r.realisasi || 0), 0);
  const sisaAnggaran = totalPagu - totalRealisasi;
  const persentasePenyerapan = totalPagu > 0 ? Number(((totalRealisasi / totalPagu) * 100).toFixed(2)) : 0;

  const monthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
    'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des',
  ];

  const monthlySeries = monthNames.map((label, idx) => {
    const m = idx + 1;
    const found = budgetRows.find((r) => r.month === m);
    const pagu = found ? found.pagu : null;
    const realisasi = found ? found.realisasi : null;
    const persen =
      pagu !== null && pagu > 0 && realisasi !== null
        ? Number(((realisasi / pagu) * 100).toFixed(2))
        : null;
    return {
      month: m,
      label,
      pagu,
      realisasi,
      persen,
      available: Boolean(found),
    };
  });

  res.json({
    activeYear,
    profileSummary: {
      appName: profile.app_name,
      appSubtitle: profile.app_subtitle,
      orgName: profile.org_name,
      logoUrl: profile.logo_url,
      buildingPhotoUrl: profile.building_photo_url,
      visionText: profile.vision_text,
      dutiesText: profile.duties_text,
      unitCount: unitCountRow.total,
    },
    stats: {
      activitiesThisYear: activityCountRow.total,
      totalActivities: allActivityCountRow.total,
      totalPagu,
      totalRealisasi,
      sisaAnggaran,
      persentasePenyerapan,
      hasBudgetData: budgetRows.length > 0,
    },
    monthlySeries,
    recentActivities,
    recentPhotos,
  });
});

// ==========================================
// 4. ORGANIZATION PROFILE & UNITS ROUTES
// ==========================================
router.get('/profile', requireAuth, requirePermission('profile:view'), (_req, res) => {
  const profile = db.prepare('SELECT * FROM organization_profiles WHERE id = 1').get() as Record<
    string,
    unknown
  >;
  const units = db
    .prepare('SELECT * FROM organization_units ORDER BY sort_order ASC, id ASC')
    .all() as Array<Record<string, unknown>>;

  res.json({
    profile: {
      ...profile,
      missions: safeJsonParse<string[]>(String(profile.mission_json || '[]'), []),
      functions: safeJsonParse<string[]>(String(profile.functions_json || '[]'), []),
      supportingInfo: safeJsonParse<Array<Record<string, unknown>>>(
        String(profile.supporting_info_json || '[]'),
        []
      ),
    },
    units: units.map((u) => ({
      ...u,
      tasks: safeJsonParse<string[]>(String(u.tasks_json || '[]'), []),
    })),
  });
});

router.put('/profile', requireAuth, requirePermission('profile:edit'), (req: AuthRequest, res) => {
  const {
    app_name,
    app_subtitle,
    org_name,
    org_address,
    org_phone,
    org_email,
    org_website,
    active_budget_year,
    history_text,
    vision_text,
    missions,
    duties_text,
    functions,
  } = req.body || {};

  if (!org_name || typeof org_name !== 'string') {
    res.status(400).json({ error: 'Nama organisasi wajib diisi.' });
    return;
  }

  const current = db.prepare('SELECT * FROM organization_profiles WHERE id = 1').get() as Record<
    string,
    unknown
  >;

  db.prepare(
    `UPDATE organization_profiles SET
      app_name = ?,
      app_subtitle = ?,
      org_name = ?,
      org_address = ?,
      org_phone = ?,
      org_email = ?,
      org_website = ?,
      active_budget_year = ?,
      history_text = ?,
      vision_text = ?,
      mission_json = ?,
      duties_text = ?,
      functions_json = ?,
      updated_at = datetime('now')
     WHERE id = 1`
  ).run(
    app_name ? String(app_name).trim() : current.app_name,
    app_subtitle ? String(app_subtitle).trim() : current.app_subtitle,
    org_name.trim(),
    org_address ? String(org_address).trim() : current.org_address,
    org_phone ? String(org_phone).trim() : current.org_phone,
    org_email ? String(org_email).trim() : current.org_email,
    org_website ? String(org_website).trim() : current.org_website,
    Number(active_budget_year) || Number(current.active_budget_year),
    history_text !== undefined ? String(history_text) : current.history_text,
    vision_text !== undefined ? String(vision_text) : current.vision_text,
    Array.isArray(missions) ? JSON.stringify(missions) : current.mission_json,
    duties_text !== undefined ? String(duties_text) : current.duties_text,
    Array.isArray(functions) ? JSON.stringify(functions) : current.functions_json
  );

  logAudit(req.user, 'UPDATE_PROFILE', 'OrganizationProfile', 1, 'Memperbarui profil BAPPEDA.', req);
  res.json({ success: true });
});

router.post(
  '/profile/logo',
  requireAuth,
  requirePermission('settings:manage'),
  uploadLogo.single('logo'),
  (req: AuthRequest, res) => {
    if (!req.file) {
      res.status(400).json({ error: 'File logo belum dipilih.' });
      return;
    }
    const logoUrl = `/api/files/uploads/logos/${req.file.filename}`;
    db.prepare('UPDATE organization_profiles SET logo_url = ?, updated_at = datetime("now") WHERE id = 1').run(
      logoUrl
    );
    logAudit(req.user, 'UPLOAD_LOGO', 'OrganizationProfile', 1, `Mengunggah logo resmi: ${req.file.originalname}`, req);
    res.json({ logo_url: logoUrl });
  }
);

router.delete(
  '/profile/logo',
  requireAuth,
  requirePermission('settings:manage'),
  (req: AuthRequest, res) => {
    db.prepare('UPDATE organization_profiles SET logo_url = NULL, updated_at = datetime("now") WHERE id = 1').run();
    logAudit(req.user, 'REMOVE_LOGO', 'OrganizationProfile', 1, 'Menghapus logo resmi aplikasi.', req);
    res.json({ success: true });
  }
);

router.post(
  '/profile/building-photo',
  requireAuth,
  requirePermission('profile:edit'),
  uploadPhoto.single('photo'),
  (req: AuthRequest, res) => {
    if (!req.file) {
      res.status(400).json({ error: 'File foto gedung belum dipilih.' });
      return;
    }
    const photoUrl = `/api/files/uploads/photos/${req.file.filename}`;
    db.prepare(
      'UPDATE organization_profiles SET building_photo_url = ?, updated_at = datetime("now") WHERE id = 1'
    ).run(photoUrl);
    logAudit(req.user, 'UPLOAD_BUILDING_PHOTO', 'OrganizationProfile', 1, 'Memperbarui foto kantor organisasi.', req);
    res.json({ building_photo_url: photoUrl });
  }
);

router.post(
  '/profile/docs',
  requireAuth,
  requirePermission('profile:edit'),
  uploadDocPdf.single('file'),
  (req: AuthRequest, res) => {
    if (!req.file) {
      res.status(400).json({ error: 'File PDF pendukung wajib diunggah.' });
      return;
    }
    if (!verifyPdfMagicBytes(req.file.path)) {
      fs.unlinkSync(req.file.path);
      res.status(400).json({ error: 'File tidak valid sebagai dokumen PDF.' });
      return;
    }
    const { title, description } = req.body || {};
    const profile = db
      .prepare('SELECT supporting_info_json FROM organization_profiles WHERE id = 1')
      .get() as { supporting_info_json: string };

    const docs = safeJsonParse<Array<Record<string, unknown>>>(profile.supporting_info_json, []);
    const newDoc = {
      id: `doc-${Date.now()}`,
      title: (title && String(title).trim()) || req.file.originalname,
      description: (description && String(description).trim()) || 'Dokumen pendukung profil BAPPEDA.',
      fileName: req.file.filename,
      downloadUrl: `/api/profile/docs/${req.file.filename}`,
      uploadedAt: new Date().toISOString().slice(0, 10),
    };
    docs.unshift(newDoc);
    db.prepare(
      'UPDATE organization_profiles SET supporting_info_json = ?, updated_at = datetime("now") WHERE id = 1'
    ).run(JSON.stringify(docs));

    logAudit(req.user, 'UPLOAD_PROFILE_DOC', 'OrganizationProfile', newDoc.id, `Mengunggah dokumen pendukung: ${newDoc.title}`, req);
    res.json({ document: newDoc });
  }
);

router.delete(
  '/profile/docs/:docId',
  requireAuth,
  requirePermission('profile:edit'),
  (req: AuthRequest, res) => {
    const profile = db
      .prepare('SELECT supporting_info_json FROM organization_profiles WHERE id = 1')
      .get() as { supporting_info_json: string };
    const docs = safeJsonParse<Array<{ id: string; fileName?: string; title?: string }>>(
      profile.supporting_info_json,
      []
    );
    const target = docs.find((d) => d.id === req.params.docId);
    if (!target) {
      res.status(404).json({ error: 'Dokumen tidak ditemukan.' });
      return;
    }
    const updated = docs.filter((d) => d.id !== req.params.docId);
    db.prepare(
      'UPDATE organization_profiles SET supporting_info_json = ?, updated_at = datetime("now") WHERE id = 1'
    ).run(JSON.stringify(updated));

    if (target.fileName) {
      const fp = path.join(DOCS_DIR, path.basename(target.fileName));
      if (fs.existsSync(fp)) {
        fs.unlinkSync(fp);
      }
    }
    logAudit(req.user, 'DELETE_PROFILE_DOC', 'OrganizationProfile', req.params.docId, `Menghapus dokumen: ${target.title}`, req);
    res.json({ success: true });
  }
);

router.get(
  '/profile/docs/:filename',
  requireAuth,
  requirePermission('profile:view'),
  (req, res) => {
    const filename = path.basename(req.params.filename);
    const fullPath = path.join(DOCS_DIR, filename);
    if (!fs.existsSync(fullPath)) {
      res.status(404).json({ error: 'Dokumen pendukung tidak ditemukan.' });
      return;
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.sendFile(fullPath);
  }
);

// Organization Units CRUD
router.post('/units', requireAuth, requirePermission('profile:edit'), (req: AuthRequest, res) => {
  const { code, name, head_title, parent_id, description, tasks, sort_order } = req.body || {};
  if (!code || !name || !head_title) {
    res.status(400).json({ error: 'Kode unit, nama bidang, dan jabatan pimpinan wajib diisi.' });
    return;
  }
  try {
    const info = db
      .prepare(
        'INSERT INTO organization_units (code, name, head_title, parent_id, description, tasks_json, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)'
      )
      .run(
        String(code).trim().toUpperCase(),
        String(name).trim(),
        String(head_title).trim(),
        parent_id ? Number(parent_id) : null,
        String(description || '').trim(),
        JSON.stringify(Array.isArray(tasks) ? tasks : []),
        Number(sort_order) || 10
      );
    logAudit(req.user, 'CREATE_UNIT', 'OrganizationUnit', info.lastInsertRowid as number, `Menambah bidang: ${name}`, req);
    res.status(201).json({ id: info.lastInsertRowid });
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Gagal menambahkan unit.' });
  }
});

router.put('/units/:id', requireAuth, requirePermission('profile:edit'), (req: AuthRequest, res) => {
  const { name, head_title, parent_id, description, tasks, sort_order } = req.body || {};
  const existing = db.prepare('SELECT * FROM organization_units WHERE id = ?').get(req.params.id);
  if (!existing) {
    res.status(404).json({ error: 'Unit organisasi tidak ditemukan.' });
    return;
  }
  db.prepare(
    'UPDATE organization_units SET name = ?, head_title = ?, parent_id = ?, description = ?, tasks_json = ?, sort_order = ? WHERE id = ?'
  ).run(
    String(name || '').trim(),
    String(head_title || '').trim(),
    parent_id ? Number(parent_id) : null,
    String(description || '').trim(),
    JSON.stringify(Array.isArray(tasks) ? tasks : []),
    Number(sort_order) || 10,
    req.params.id
  );
  logAudit(req.user, 'UPDATE_UNIT', 'OrganizationUnit', String(req.params.id), `Memperbarui unit: ${name}`, req);
  res.json({ success: true });
});

router.delete('/units/:id', requireAuth, requirePermission('profile:edit'), (req: AuthRequest, res) => {
  const existing = db.prepare('SELECT name FROM organization_units WHERE id = ?').get(req.params.id) as
    | { name: string }
    | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Unit organisasi tidak ditemukan.' });
    return;
  }
  db.prepare('DELETE FROM organization_units WHERE id = ?').run(req.params.id);
  logAudit(req.user, 'DELETE_UNIT', 'OrganizationUnit', String(req.params.id), `Menghapus unit: ${existing.name}`, req);
  res.json({ success: true });
});

// ==========================================
// 5. ACTIVITIES, PHOTOS & PROTECTED LETTERS
// ==========================================
router.get('/activities', requireAuth, requirePermission('activities:view'), (req, res) => {
  const { year, month, unit_id, q } = req.query;
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (year && year !== 'all') {
    conditions.push('a.year = ?');
    params.push(Number(year));
  }
  if (month && month !== 'all') {
    conditions.push('a.month = ?');
    params.push(Number(month));
  }
  if (unit_id && unit_id !== 'all') {
    conditions.push('a.unit_id = ?');
    params.push(Number(unit_id));
  }
  if (q && typeof q === 'string' && q.trim().length > 0) {
    conditions.push('(a.title LIKE ? OR a.location LIKE ? OR a.description LIKE ? OR a.activity_code LIKE ?)');
    const kw = `%${q.trim()}%`;
    params.push(kw, kw, kw, kw);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const rows = db
    .prepare(
      `SELECT a.*, u.name as unit_name, usr.full_name as creator_name
       FROM activities a
       LEFT JOIN organization_units u ON u.id = a.unit_id
       LEFT JOIN users usr ON usr.id = a.created_by
       ${whereClause}
       ORDER BY a.activity_date DESC, a.id DESC`
    )
    .all(...params) as Array<Record<string, unknown>>;

  const photosStmt = db.prepare('SELECT * FROM activity_photos WHERE activity_id = ? ORDER BY is_cover DESC, id ASC');
  const lettersStmt = db.prepare(
    'SELECT id, activity_id, letter_number, file_name, file_size, mime_type, created_at FROM assignment_letters WHERE activity_id = ? ORDER BY id DESC'
  );

  const enriched = rows.map((row) => ({
    ...row,
    photos: photosStmt.all(row.id),
    letters: lettersStmt.all(row.id),
  }));

  res.json({ activities: enriched });
});

router.get('/activities/:id', requireAuth, requirePermission('activities:view'), (req, res) => {
  const row = db
    .prepare(
      `SELECT a.*, u.name as unit_name, usr.full_name as creator_name
       FROM activities a
       LEFT JOIN organization_units u ON u.id = a.unit_id
       LEFT JOIN users usr ON usr.id = a.created_by
       WHERE a.id = ?`
    )
    .get(req.params.id);

  if (!row) {
    res.status(404).json({ error: 'Kegiatan tidak ditemukan.' });
    return;
  }

  const photos = db
    .prepare('SELECT * FROM activity_photos WHERE activity_id = ? ORDER BY is_cover DESC, id ASC')
    .all(req.params.id);
  const letters = db
    .prepare(
      'SELECT id, activity_id, letter_number, file_name, file_size, mime_type, created_at FROM assignment_letters WHERE activity_id = ? ORDER BY id DESC'
    )
    .all(req.params.id);

  res.json({ activity: { ...row, photos, letters } });
});

router.post('/activities', requireAuth, requirePermission('activities:manage'), (req: AuthRequest, res) => {
  const { title, activity_date, location, unit_id, description, is_demo } = req.body || {};
  if (!title || !activity_date || !location || !description) {
    res.status(400).json({ error: 'Judul, tanggal pelaksanaan, lokasi, dan deskripsi kegiatan wajib diisi.' });
    return;
  }

  const parsedDate = new Date(activity_date);
  if (Number.isNaN(parsedDate.getTime())) {
    res.status(400).json({ error: 'Format tanggal pelaksanaan tidak valid.' });
    return;
  }

  const year = parsedDate.getFullYear();
  const month = parsedDate.getMonth() + 1;
  const countRow = db
    .prepare('SELECT COUNT(*) as cnt FROM activities WHERE year = ?')
    .get(year) as { cnt: number };
  const seq = String(countRow.cnt + 1).padStart(3, '0');
  const activityCode = `KEG-${year}-${seq}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;

  const info = db
    .prepare(
      `INSERT INTO activities (activity_code, title, activity_date, month, year, location, unit_id, description, is_demo, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      activityCode,
      String(title).trim(),
      String(activity_date).slice(0, 10),
      month,
      year,
      String(location).trim(),
      unit_id ? Number(unit_id) : null,
      String(description).trim(),
      is_demo ? 1 : 0,
      req.user!.id
    );

  logAudit(req.user, 'CREATE_ACTIVITY', 'Activity', info.lastInsertRowid as number, `Menambah kegiatan: ${title}`, req);
  res.status(201).json({ id: info.lastInsertRowid, activity_code: activityCode });
});

router.put('/activities/:id', requireAuth, requirePermission('activities:manage'), (req: AuthRequest, res) => {
  const { title, activity_date, location, unit_id, description } = req.body || {};
  const existing = db.prepare('SELECT * FROM activities WHERE id = ?').get(req.params.id);
  if (!existing) {
    res.status(404).json({ error: 'Kegiatan tidak ditemukan.' });
    return;
  }
  const parsedDate = new Date(activity_date);
  if (Number.isNaN(parsedDate.getTime())) {
    res.status(400).json({ error: 'Format tanggal pelaksanaan tidak valid.' });
    return;
  }
  const year = parsedDate.getFullYear();
  const month = parsedDate.getMonth() + 1;

  db.prepare(
    `UPDATE activities
     SET title = ?, activity_date = ?, month = ?, year = ?, location = ?, unit_id = ?, description = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).run(
    String(title).trim(),
    String(activity_date).slice(0, 10),
    month,
    year,
    String(location).trim(),
    unit_id ? Number(unit_id) : null,
    String(description).trim(),
    req.params.id
  );

  logAudit(req.user, 'UPDATE_ACTIVITY', 'Activity', String(req.params.id), `Memperbarui kegiatan: ${title}`, req);
  res.json({ success: true });
});

router.delete('/activities/:id', requireAuth, requirePermission('activities:manage'), (req: AuthRequest, res) => {
  const existing = db.prepare('SELECT title FROM activities WHERE id = ?').get(req.params.id) as
    | { title: string }
    | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Kegiatan tidak ditemukan.' });
    return;
  }

  // Delete attached files from disk cleanly
  const photos = db
    .prepare('SELECT file_path FROM activity_photos WHERE activity_id = ?')
    .all(req.params.id) as Array<{ file_path: string }>;
  for (const p of photos) {
    if (p.file_path.startsWith('/api/files/uploads/photos/')) {
      const fp = path.join(PHOTOS_DIR, path.basename(p.file_path));
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
    }
  }

  const letters = db
    .prepare('SELECT file_path FROM assignment_letters WHERE activity_id = ?')
    .all(req.params.id) as Array<{ file_path: string }>;
  for (const l of letters) {
    const fp = path.join(LETTERS_DIR, path.basename(l.file_path));
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
  }

  db.prepare('DELETE FROM activities WHERE id = ?').run(req.params.id);
  logAudit(req.user, 'DELETE_ACTIVITY', 'Activity', String(req.params.id), `Menghapus kegiatan: ${existing.title}`, req);
  res.json({ success: true });
});

router.post(
  '/activities/:id/photos',
  requireAuth,
  requirePermission('activities:manage'),
  uploadPhoto.array('photos', 6),
  (req: AuthRequest, res) => {
    const act = db.prepare('SELECT id, title FROM activities WHERE id = ?').get(req.params.id) as
      | { id: number; title: string }
      | undefined;
    if (!act) {
      res.status(404).json({ error: 'Kegiatan tidak ditemukan.' });
      return;
    }

    const files = req.files as Express.Multer.File[] | undefined;
    if (!files || files.length === 0) {
      res.status(400).json({ error: 'Minimal 1 foto dokumentasi harus dipilih.' });
      return;
    }

    const existingPhotos = db
      .prepare('SELECT COUNT(*) as cnt FROM activity_photos WHERE activity_id = ?')
      .get(act.id) as { cnt: number };

    const caption = typeof req.body?.caption === 'string' ? req.body.caption.trim() : '';
    const inserted: Array<Record<string, unknown>> = [];

    const stmt = db.prepare(
      'INSERT INTO activity_photos (activity_id, file_path, caption, is_cover, uploaded_by) VALUES (?, ?, ?, ?, ?)'
    );

    files.forEach((f, idx) => {
      const url = `/api/files/uploads/photos/${f.filename}`;
      const isCover = existingPhotos.cnt === 0 && idx === 0 ? 1 : 0;
      const info = stmt.run(act.id, url, caption || f.originalname, isCover, req.user!.id);
      inserted.push({ id: info.lastInsertRowid, file_path: url, caption: caption || f.originalname, is_cover: isCover });
    });

    logAudit(req.user, 'UPLOAD_PHOTOS', 'Activity', act.id, `Mengunggah ${files.length} foto dokumentasi untuk "${act.title}".`, req);
    res.status(201).json({ photos: inserted });
  }
);

router.delete(
  '/photos/:photoId',
  requireAuth,
  requirePermission('activities:manage'),
  (req: AuthRequest, res) => {
    const photo = db.prepare('SELECT * FROM activity_photos WHERE id = ?').get(req.params.photoId) as
      | { id: number; activity_id: number; file_path: string }
      | undefined;
    if (!photo) {
      res.status(404).json({ error: 'Foto tidak ditemukan.' });
      return;
    }
    if (photo.file_path.startsWith('/api/files/uploads/photos/')) {
      const fp = path.join(PHOTOS_DIR, path.basename(photo.file_path));
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
    }
    db.prepare('DELETE FROM activity_photos WHERE id = ?').run(photo.id);
    logAudit(req.user, 'DELETE_PHOTO', 'ActivityPhoto', photo.id, `Menghapus foto dokumentasi kegiatan #${photo.activity_id}.`, req);
    res.json({ success: true });
  }
);

router.post(
  '/activities/:id/letter',
  requireAuth,
  requirePermission('activities:manage'),
  uploadLetterPdf.single('file'),
  (req: AuthRequest, res) => {
    const act = db.prepare('SELECT id, title FROM activities WHERE id = ?').get(req.params.id) as
      | { id: number; title: string }
      | undefined;
    if (!act) {
      if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      res.status(404).json({ error: 'Kegiatan tidak ditemukan.' });
      return;
    }

    if (!req.file) {
      res.status(400).json({ error: 'File PDF surat tugas wajib dipilih.' });
      return;
    }

    if (!verifyPdfMagicBytes(req.file.path)) {
      fs.unlinkSync(req.file.path);
      res.status(400).json({ error: 'Berkas yang diunggah bukan file PDF yang valid.' });
      return;
    }

    const letterNumber =
      typeof req.body?.letter_number === 'string' && req.body.letter_number.trim()
        ? req.body.letter_number.trim()
        : `ST-${Date.now()}`;

    const info = db
      .prepare(
        'INSERT INTO assignment_letters (activity_id, letter_number, file_name, file_path, file_size, mime_type, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, ?)'
      )
      .run(
        act.id,
        letterNumber,
        req.file.originalname,
        req.file.filename,
        req.file.size,
        'application/pdf',
        req.user!.id
      );

    logAudit(
      req.user,
      'UPLOAD_SURAT_TUGAS',
      'AssignmentLetter',
      info.lastInsertRowid as number,
      `Mengunggah surat tugas PDF (${letterNumber}) untuk kegiatan "${act.title}".`,
      req
    );

    res.status(201).json({
      letter: {
        id: info.lastInsertRowid,
        activity_id: act.id,
        letter_number: letterNumber,
        file_name: req.file.originalname,
        file_size: req.file.size,
      },
    });
  }
);

router.delete(
  '/letters/:letterId',
  requireAuth,
  requirePermission('activities:manage'),
  (req: AuthRequest, res) => {
    const letter = db
      .prepare('SELECT * FROM assignment_letters WHERE id = ?')
      .get(req.params.letterId) as
      | { id: number; letter_number: string; file_path: string }
      | undefined;
    if (!letter) {
      res.status(404).json({ error: 'Lampiran surat tugas tidak ditemukan.' });
      return;
    }
    const fp = path.join(LETTERS_DIR, path.basename(letter.file_path));
    if (fs.existsSync(fp)) fs.unlinkSync(fp);

    db.prepare('DELETE FROM assignment_letters WHERE id = ?').run(letter.id);
    logAudit(req.user, 'DELETE_SURAT_TUGAS', 'AssignmentLetter', letter.id, `Menghapus surat tugas ${letter.letter_number}.`, req);
    res.json({ success: true });
  }
);

// Protected PDF Streaming/Download for Assignment Letters
router.get(
  '/files/letters/:id',
  requireAuth,
  requirePermission('letters:download'),
  (req: AuthRequest, res) => {
    const letter = db
      .prepare('SELECT * FROM assignment_letters WHERE id = ?')
      .get(req.params.id) as
      | { id: number; letter_number: string; file_name: string; file_path: string }
      | undefined;
    if (!letter) {
      res.status(404).json({ error: 'Surat tugas tidak ditemukan.' });
      return;
    }

    const fp = path.join(LETTERS_DIR, path.basename(letter.file_path));
    if (!fs.existsSync(fp)) {
      res.status(404).json({ error: 'File fisik surat tugas tidak ditemukan di server.' });
      return;
    }

    const isDownload = req.query.download === '1';
    logAudit(
      req.user,
      isDownload ? 'DOWNLOAD_SURAT_TUGAS' : 'VIEW_SURAT_TUGAS',
      'AssignmentLetter',
      letter.id,
      `Mengakses file PDF surat tugas ${letter.letter_number}.`,
      req
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader(
      'Content-Disposition',
      `${isDownload ? 'attachment' : 'inline'}; filename="${letter.file_name.replace(/[^a-zA-Z0-9._-]/g, '_')}"`
    );
    res.sendFile(fp);
  }
);

// ==========================================
// 6. BUDGET ABSORPTION (PENYERAPAN ANGGARAN)
// ==========================================
router.get('/budget', requireAuth, requirePermission('budget:view'), (req, res) => {
  const { year, month, unit_id, q } = req.query;
  const profile = db
    .prepare('SELECT active_budget_year FROM organization_profiles WHERE id = 1')
    .get() as { active_budget_year: number };

  const selectedYear = year && year !== 'all' ? Number(year) : profile.active_budget_year;
  const conditions: string[] = ['b.fiscal_year = ?'];
  const params: unknown[] = [selectedYear];

  if (month && month !== 'all') {
    conditions.push('b.month = ?');
    params.push(Number(month));
  }
  if (unit_id && unit_id !== 'all') {
    conditions.push('b.unit_id = ?');
    params.push(Number(unit_id));
  }
  if (q && typeof q === 'string' && q.trim().length > 0) {
    conditions.push('(b.program_name LIKE ? OR b.activity_name LIKE ? OR b.notes LIKE ?)');
    const kw = `%${q.trim()}%`;
    params.push(kw, kw, kw);
  }

  const rows = db
    .prepare(
      `SELECT b.*, u.name as unit_name, u.code as unit_code
       FROM budget_data b
       LEFT JOIN organization_units u ON u.id = b.unit_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY b.month ASC, b.unit_id ASC, b.id ASC`
    )
    .all(...params) as Array<{
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
    notes: string;
    is_demo: number;
    updated_at: string;
  }>;

  const totalPagu = rows.reduce((sum, r) => sum + (r.pagu || 0), 0);
  const totalRealisasi = rows.reduce((sum, r) => sum + (r.realisasi || 0), 0);
  const sisaAnggaran = totalPagu - totalRealisasi;
  const persentasePenyerapan =
    totalPagu > 0 ? Number(((totalRealisasi / totalPagu) * 100).toFixed(2)) : 0;

  // Group by Unit/Bidang for Bar & Percentage Charts
  const unitMap = new Map<
    string,
    { unitId: number | null; unitName: string; unitCode: string; pagu: number; realisasi: number }
  >();

  for (const r of rows) {
    const key = String(r.unit_id ?? 'other');
    const current = unitMap.get(key) || {
      unitId: r.unit_id,
      unitName: r.unit_name || 'Umum / Lainnya',
      unitCode: r.unit_code || 'UMUM',
      pagu: 0,
      realisasi: 0,
    };
    current.pagu += r.pagu;
    current.realisasi += r.realisasi;
    unitMap.set(key, current);
  }

  const byUnit = Array.from(unitMap.values()).map((u) => ({
    ...u,
    sisa: u.pagu - u.realisasi,
    persentase: u.pagu > 0 ? Number(((u.realisasi / u.pagu) * 100).toFixed(2)) : 0,
  }));

  // Monthly progression for selected year (respecting unit_id & q filter, ignoring month filter so chart shows full year trend)
  const trendConditions: string[] = ['b.fiscal_year = ?'];
  const trendParams: unknown[] = [selectedYear];
  if (unit_id && unit_id !== 'all') {
    trendConditions.push('b.unit_id = ?');
    trendParams.push(Number(unit_id));
  }
  if (q && typeof q === 'string' && q.trim().length > 0) {
    trendConditions.push('(b.program_name LIKE ? OR b.activity_name LIKE ? OR b.notes LIKE ?)');
    const kw = `%${q.trim()}%`;
    trendParams.push(kw, kw, kw);
  }

  const monthlyAgg = db
    .prepare(
      `SELECT month, SUM(pagu) as pagu, SUM(realisasi) as realisasi
       FROM budget_data b
       WHERE ${trendConditions.join(' AND ')}
       GROUP BY month
       ORDER BY month ASC`
    )
    .all(...trendParams) as Array<{ month: number; pagu: number; realisasi: number }>;

  const monthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
    'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des',
  ];

  const byMonth = monthNames.map((label, idx) => {
    const m = idx + 1;
    const found = monthlyAgg.find((x) => x.month === m);
    if (!found) {
      return { month: m, label, pagu: null, realisasi: null, persentase: null, available: false };
    }
    return {
      month: m,
      label,
      pagu: found.pagu,
      realisasi: found.realisasi,
      persentase: found.pagu > 0 ? Number(((found.realisasi / found.pagu) * 100).toFixed(2)) : 0,
      available: true,
    };
  });

  // Available years list
  const yearsRows = db
    .prepare('SELECT DISTINCT fiscal_year FROM budget_data ORDER BY fiscal_year DESC')
    .all() as Array<{ fiscal_year: number }>;
  const availableYears = Array.from(
    new Set([selectedYear, profile.active_budget_year, 2026, 2025, ...yearsRows.map((y) => y.fiscal_year)])
  ).sort((a, b) => b - a);

  res.json({
    fiscalYear: selectedYear,
    availableYears,
    hasData: rows.length > 0,
    summary: {
      totalPagu,
      totalRealisasi,
      sisaAnggaran,
      persentasePenyerapan,
      paguZero: totalPagu === 0,
      recordCount: rows.length,
    },
    byUnit,
    byMonth,
    items: rows.map((r) => ({
      ...r,
      sisa: r.pagu - r.realisasi,
      persentase: r.pagu > 0 ? Number(((r.realisasi / r.pagu) * 100).toFixed(2)) : 0,
    })),
  });
});

router.post('/budget', requireAuth, requirePermission('budget:manage'), (req: AuthRequest, res) => {
  const { fiscal_year, month, unit_id, program_name, activity_name, pagu, realisasi, notes, is_demo } =
    req.body || {};

  const numYear = Number(fiscal_year);
  const numMonth = Number(month);
  const numPagu = Number(pagu);
  const numRealisasi = Number(realisasi);

  if (!numYear || numYear < 2000 || numYear > 2100) {
    res.status(400).json({ error: 'Tahun anggaran tidak valid.' });
    return;
  }
  if (!numMonth || numMonth < 1 || numMonth > 12) {
    res.status(400).json({ error: 'Bulan harus bernilai antara 1 hingga 12.' });
    return;
  }
  if (!program_name || typeof program_name !== 'string' || !program_name.trim()) {
    res.status(400).json({ error: 'Nama program anggaran wajib diisi.' });
    return;
  }
  if (Number.isNaN(numPagu) || numPagu < 0) {
    res.status(400).json({ error: 'Nilai Pagu Anggaran tidak boleh negatif.' });
    return;
  }
  if (Number.isNaN(numRealisasi) || numRealisasi < 0) {
    res.status(400).json({ error: 'Nilai Realisasi Anggaran tidak boleh negatif.' });
    return;
  }

  const info = db
    .prepare(
      `INSERT INTO budget_data (fiscal_year, month, unit_id, program_name, activity_name, pagu, realisasi, notes, is_demo, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      numYear,
      numMonth,
      unit_id ? Number(unit_id) : null,
      program_name.trim(),
      String(activity_name || '').trim(),
      numPagu,
      numRealisasi,
      String(notes || '').trim(),
      is_demo ? 1 : 0,
      req.user!.id
    );

  logAudit(
    req.user,
    'CREATE_BUDGET',
    'BudgetData',
    info.lastInsertRowid as number,
    `Menambah data anggaran ${program_name} (${numMonth}/${numYear}).`,
    req
  );
  res.status(201).json({ id: info.lastInsertRowid });
});

router.put('/budget/:id', requireAuth, requirePermission('budget:manage'), (req: AuthRequest, res) => {
  const existing = db.prepare('SELECT * FROM budget_data WHERE id = ?').get(req.params.id);
  if (!existing) {
    res.status(404).json({ error: 'Data anggaran tidak ditemukan.' });
    return;
  }

  const { fiscal_year, month, unit_id, program_name, activity_name, pagu, realisasi, notes } =
    req.body || {};
  const numYear = Number(fiscal_year);
  const numMonth = Number(month);
  const numPagu = Number(pagu);
  const numRealisasi = Number(realisasi);

  if (Number.isNaN(numPagu) || numPagu < 0 || Number.isNaN(numRealisasi) || numRealisasi < 0) {
    res.status(400).json({ error: 'Nilai pagu dan realisasi tidak boleh negatif.' });
    return;
  }
  if (!numMonth || numMonth < 1 || numMonth > 12) {
    res.status(400).json({ error: 'Bulan tidak valid.' });
    return;
  }

  db.prepare(
    `UPDATE budget_data
     SET fiscal_year = ?, month = ?, unit_id = ?, program_name = ?, activity_name = ?, pagu = ?, realisasi = ?, notes = ?, updated_by = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).run(
    numYear,
    numMonth,
    unit_id ? Number(unit_id) : null,
    String(program_name || '').trim(),
    String(activity_name || '').trim(),
    numPagu,
    numRealisasi,
    String(notes || '').trim(),
    req.user!.id,
    req.params.id
  );

  logAudit(req.user, 'UPDATE_BUDGET', 'BudgetData', String(req.params.id), `Memperbarui anggaran: ${program_name}`, req);
  res.json({ success: true });
});

router.delete('/budget/:id', requireAuth, requirePermission('budget:manage'), (req: AuthRequest, res) => {
  const existing = db.prepare('SELECT program_name FROM budget_data WHERE id = ?').get(req.params.id) as
    | { program_name: string }
    | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Data anggaran tidak ditemukan.' });
    return;
  }
  db.prepare('DELETE FROM budget_data WHERE id = ?').run(req.params.id);
  logAudit(req.user, 'DELETE_BUDGET', 'BudgetData', String(req.params.id), `Menghapus data anggaran: ${existing.program_name}`, req);
  res.json({ success: true });
});

// ==========================================
// 7. USERS, ROLES & AUDIT LOGS
// ==========================================
router.get('/users', requireAuth, requirePermission('users:manage'), (_req, res) => {
  const users = db
    .prepare(
      `SELECT u.id, u.username, u.full_name, u.email, u.nip_demo, u.position,
              u.role_id, u.unit_id, u.is_active, u.created_at, u.updated_at,
              r.code as role_code, r.name as role_name,
              un.name as unit_name
       FROM users u
       JOIN roles r ON r.id = u.role_id
       LEFT JOIN organization_units un ON un.id = u.unit_id
       ORDER BY u.id ASC`
    )
    .all();
  res.json({ users });
});

router.post('/users', requireAuth, requirePermission('users:manage'), (req: AuthRequest, res) => {
  const { username, full_name, email, nip_demo, position, role_id, unit_id, password } = req.body || {};
  if (!username || !full_name || !email || !role_id || !password) {
    res.status(400).json({ error: 'Username, nama lengkap, email, peran, dan kata sandi wajib diisi.' });
    return;
  }
  if (typeof password !== 'string' || password.length < 8) {
    res.status(400).json({ error: 'Kata sandi minimal 8 karakter.' });
    return;
  }

  try {
    const hash = bcrypt.hashSync(password, 10);
    const info = db
      .prepare(
        `INSERT INTO users (username, full_name, email, nip_demo, position, role_id, unit_id, password_hash, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`
      )
      .run(
        String(username).trim(),
        String(full_name).trim(),
        String(email).trim(),
        String(nip_demo || '').trim(),
        String(position || '').trim(),
        Number(role_id),
        unit_id ? Number(unit_id) : null,
        hash
      );
    logAudit(req.user, 'CREATE_USER', 'User', info.lastInsertRowid as number, `Menambah pengguna baru: ${username}`, req);
    res.status(201).json({ id: info.lastInsertRowid });
  } catch (err: unknown) {
    const msg = err instanceof Error && err.message.includes('UNIQUE')
      ? 'Username atau email sudah terdaftar.'
      : 'Gagal membuat akun pengguna.';
    res.status(400).json({ error: msg });
  }
});

router.put('/users/:id', requireAuth, requirePermission('users:manage'), (req: AuthRequest, res) => {
  const targetId = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(targetId) as
    | { id: number; username: string }
    | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Pengguna tidak ditemukan.' });
    return;
  }

  const { full_name, email, nip_demo, position, role_id, unit_id, is_active, new_password } =
    req.body || {};

  // Prevent admin from deactivating their own currently logged-in account
  if (targetId === req.user!.id && is_active === 0) {
    res.status(400).json({ error: 'Anda tidak dapat menonaktifkan akun yang sedang Anda gunakan.' });
    return;
  }

  db.prepare(
    `UPDATE users
     SET full_name = ?, email = ?, nip_demo = ?, position = ?, role_id = ?, unit_id = ?, is_active = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).run(
    String(full_name).trim(),
    String(email).trim(),
    String(nip_demo || '').trim(),
    String(position || '').trim(),
    Number(role_id),
    unit_id ? Number(unit_id) : null,
    is_active ? 1 : 0,
    targetId
  );

  if (new_password && typeof new_password === 'string') {
    if (new_password.length < 8) {
      res.status(400).json({ error: 'Kata sandi baru minimal 8 karakter.' });
      return;
    }
    const hash = bcrypt.hashSync(new_password, 10);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, targetId);
  }

  logAudit(req.user, 'UPDATE_USER', 'User', targetId, `Memperbarui data pengguna: ${existing.username}`, req);
  res.json({ success: true });
});

router.delete('/users/:id', requireAuth, requirePermission('users:manage'), (req: AuthRequest, res) => {
  const targetId = Number(req.params.id);
  if (targetId === req.user!.id) {
    res.status(400).json({ error: 'Anda tidak dapat menghapus akun Anda sendiri.' });
    return;
  }
  const existing = db.prepare('SELECT username FROM users WHERE id = ?').get(targetId) as
    | { username: string }
    | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Pengguna tidak ditemukan.' });
    return;
  }
  db.prepare('DELETE FROM users WHERE id = ?').run(targetId);
  logAudit(req.user, 'DELETE_USER', 'User', targetId, `Menghapus akun pengguna: ${existing.username}`, req);
  res.json({ success: true });
});

router.get('/roles', requireAuth, (req: AuthRequest, res) => {
  if (!req.user!.permissions.includes('users:manage') && !req.user!.permissions.includes('settings:manage')) {
    res.status(403).json({ error: 'Akses ditolak.' });
    return;
  }
  const roles = db.prepare('SELECT * FROM roles ORDER BY id ASC').all() as Array<{
    id: number;
    code: string;
    name: string;
    description: string;
    permissions_json: string;
  }>;

  res.json({
    allPermissions: ALL_PERMISSIONS,
    roles: roles.map((r) => ({
      ...r,
      permissions: safeJsonParse<string[]>(r.permissions_json, []),
    })),
  });
});

router.put('/roles/:id', requireAuth, requirePermission('settings:manage'), (req: AuthRequest, res) => {
  const roleId = Number(req.params.id);
  const role = db.prepare('SELECT * FROM roles WHERE id = ?').get(roleId) as
    | { id: number; code: string; name: string }
    | undefined;
  if (!role) {
    res.status(404).json({ error: 'Peran tidak ditemukan.' });
    return;
  }
  const { permissions } = req.body || {};
  if (!Array.isArray(permissions)) {
    res.status(400).json({ error: 'Daftar hak akses harus berupa array.' });
    return;
  }

  let validPerms = permissions.filter((p): p is PermissionCode =>
    (ALL_PERMISSIONS as readonly string[]).includes(p)
  );

  // Guardrail: ADMIN must always retain users:manage and settings:manage
  if (role.code === 'ADMIN') {
    const requiredAdmin = ['users:manage', 'settings:manage', 'dashboard:view', 'backup:export'];
    for (const reqP of requiredAdmin) {
      if (!validPerms.includes(reqP as PermissionCode)) {
        validPerms.push(reqP as PermissionCode);
      }
    }
  }

  db.prepare('UPDATE roles SET permissions_json = ? WHERE id = ?').run(
    JSON.stringify(validPerms),
    roleId
  );

  logAudit(
    req.user,
    'UPDATE_ROLE_PERMISSIONS',
    'Role',
    roleId,
    `Mengubah matriks hak akses peran ${role.name}.`,
    req
  );
  res.json({ success: true, permissions: validPerms });
});

router.get('/audit-logs', requireAuth, requirePermission('users:manage'), (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 100, 300);
  const logs = db
    .prepare('SELECT * FROM audit_logs ORDER BY id DESC LIMIT ?')
    .all(limit);
  res.json({ logs });
});

// ==========================================
// 8. DATABASE BACKUP ENDPOINT
// ==========================================
router.get('/admin/backup', requireAuth, requirePermission('backup:export'), async (req: AuthRequest, res) => {
  const format = req.query.format === 'json' ? 'json' : 'sqlite';
  const dateStamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');

  if (format === 'json') {
    const snapshot = {
      exportedAt: new Date().toISOString(),
      application: 'SMART BAPPEDA KABUPATEN SIDOARJO',
      tables: {
        roles: db.prepare('SELECT * FROM roles').all(),
        users: db
          .prepare(
            'SELECT id, username, full_name, email, nip_demo, position, role_id, unit_id, is_active, created_at FROM users'
          )
          .all(),
        organization_profiles: db.prepare('SELECT * FROM organization_profiles').all(),
        organization_units: db.prepare('SELECT * FROM organization_units').all(),
        activities: db.prepare('SELECT * FROM activities').all(),
        activity_photos: db.prepare('SELECT * FROM activity_photos').all(),
        assignment_letters: db.prepare('SELECT * FROM assignment_letters').all(),
        budget_data: db.prepare('SELECT * FROM budget_data').all(),
        audit_logs: db.prepare('SELECT * FROM audit_logs ORDER BY id DESC LIMIT 500').all(),
      },
    };

    logAudit(req.user, 'BACKUP_DATABASE', 'Database', 'json', 'Mengunduh backup database format JSON.', req);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="smart_bappeda_backup_${dateStamp}.json"`
    );
    res.send(JSON.stringify(snapshot, null, 2));
    return;
  }

  const backupFile = path.join(DATA_DIR, `backup_temp_${Date.now()}.db`);
  try {
    await db.backup(backupFile);
    logAudit(req.user, 'BACKUP_DATABASE', 'Database', 'sqlite', 'Mengunduh backup database SQLite (.db).', req);
    res.download(backupFile, `smart_bappeda_backup_${dateStamp}.db`, () => {
      if (fs.existsSync(backupFile)) {
        fs.unlinkSync(backupFile);
      }
    });
  } catch (err) {
    if (fs.existsSync(backupFile)) {
      fs.unlinkSync(backupFile);
    }
    res.status(500).json({ error: err instanceof Error ? err.message : 'Gagal membuat backup database.' });
  }
});

// Multer & API Error Handler
router.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      res.status(400).json({ error: 'Ukuran file melebihi batas maksimal yang diizinkan.' });
      return;
    }
    res.status(400).json({ error: err.message });
    return;
  }
  if (err instanceof Error) {
    res.status(400).json({ error: err.message });
    return;
  }
  res.status(500).json({ error: 'Terjadi kesalahan internal pada server.' });
});

export default router;
