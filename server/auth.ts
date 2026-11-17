import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';
import db, { type PermissionCode } from './db.ts';

// Runtime-generated fallback secret when SESSION_SECRET is not provided in environment.
// Never embed a fixed static secret in source code for production use.
const RUNTIME_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

export const AUTH_COOKIE_NAME = 'smart_bappeda_token';

export interface AuthUser {
  id: number;
  username: string;
  full_name: string;
  email: string;
  nip_demo: string;
  position: string;
  role_id: number;
  role_code: string;
  role_name: string;
  unit_id: number | null;
  unit_name: string | null;
  permissions: PermissionCode[];
  is_active: number;
}

export interface AuthRequest extends Request {
  user?: AuthUser;
}

export function signToken(userId: number): string {
  return jwt.sign({ uid: userId }, RUNTIME_SECRET, { expiresIn: '12h' });
}

export function verifyToken(token: string): { uid: number } | null {
  try {
    const decoded = jwt.verify(token, RUNTIME_SECRET) as { uid: number };
    return decoded;
  } catch {
    return null;
  }
}

export function getUserWithPermissions(userId: number): AuthUser | null {
  const row = db
    .prepare(
      `SELECT u.id, u.username, u.full_name, u.email, u.nip_demo, u.position,
              u.role_id, u.unit_id, u.is_active,
              r.code as role_code, r.name as role_name, r.permissions_json,
              un.name as unit_name
       FROM users u
       JOIN roles r ON r.id = u.role_id
       LEFT JOIN organization_units un ON un.id = u.unit_id
       WHERE u.id = ?`
    )
    .get(userId) as
    | (Omit<AuthUser, 'permissions'> & { permissions_json: string })
    | undefined;

  if (!row || row.is_active !== 1) {
    return null;
  }

  let permissions: PermissionCode[] = [];
  try {
    permissions = JSON.parse(row.permissions_json);
  } catch {
    permissions = [];
  }

  return {
    id: row.id,
    username: row.username,
    full_name: row.full_name,
    email: row.email,
    nip_demo: row.nip_demo,
    position: row.position,
    role_id: row.role_id,
    role_code: row.role_code,
    role_name: row.role_name,
    unit_id: row.unit_id,
    unit_name: row.unit_name,
    permissions,
    is_active: row.is_active,
  };
}

export function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  const cookieToken = req.cookies?.[AUTH_COOKIE_NAME];
  if (cookieToken && typeof cookieToken === 'string') {
    return cookieToken;
  }
  if (typeof req.query.token === 'string' && req.query.token.length > 0) {
    return req.query.token;
  }
  return null;
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const token = extractToken(req);
  if (!token) {
    res.status(401).json({ error: 'Sesi tidak ditemukan. Silakan masuk terlebih dahulu.' });
    return;
  }
  const decoded = verifyToken(token);
  if (!decoded) {
    res.status(401).json({ error: 'Sesi kedaluwarsa atau tidak valid. Silakan masuk kembali.' });
    return;
  }
  const user = getUserWithPermissions(decoded.uid);
  if (!user) {
    res.status(401).json({ error: 'Akun pengguna tidak aktif atau tidak ditemukan.' });
    return;
  }
  req.user = user;
  next();
}

export function requirePermission(permission: PermissionCode) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ error: 'Autentikasi diperlukan.' });
      return;
    }
    if (!req.user.permissions.includes(permission)) {
      res.status(403).json({
        error: 'Anda tidak memiliki hak akses untuk melakukan tindakan ini.',
        requiredPermission: permission,
      });
      return;
    }
    next();
  };
}

export function logAudit(
  user: { id: number | null; username: string } | undefined | null,
  action: string,
  entityType: string,
  entityId: string | number,
  details: string,
  req?: Request
) {
  const ip =
    (req?.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    req?.socket?.remoteAddress ||
    '';
  db.prepare(
    'INSERT INTO audit_logs (user_id, username, action, entity_type, entity_id, details, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(user?.id ?? null, user?.username ?? 'system', action, entityType, String(entityId), details, ip);
}
