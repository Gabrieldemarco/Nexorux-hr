import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { db } from '../config/db';
import { Permission, ROLE_PERMISSIONS, UserRole } from '../domain/types';
import { v4 as uuidv4 } from 'uuid';
import { WebhookService } from '../services/WebhookService';

const configuredJwtSecret = process.env.JWT_SECRET;
if (process.env.NODE_ENV === 'production' && !configuredJwtSecret) {
  throw new Error('JWT_SECRET debe estar configurado en producción');
}
export const JWT_SECRET = configuredJwtSecret || (() => {
  if (process.env.NODE_ENV !== 'production') {
    console.warn('JWT_SECRET not set; using dev fallback. Set JWT_SECRET in production.');
    return 'dev-only-fallback-do-not-use-in-production';
  }
  throw new Error('JWT_SECRET debe estar configurado en producción');
})();

export interface AuthenticatedUser {
  id: string;
  tenant_id: string;
  email: string;
  role: UserRole;
  employee_id?: string;
}

declare global {
  namespace Express {
    interface Request {
      tenantId?: string;
      user?: AuthenticatedUser;
      requestId?: string;
    }
  }
}

export function requestIdMiddleware(req: Request, _res: Response, next: NextFunction) {
  req.requestId = req.headers['x-request-id'] as string || uuidv4();
  next();
}

const PUBLIC_PATHS = ['/health', '/health/detailed', '/auth/login', '/auth/forgot-password', '/auth/reset-password', '/api-docs'];

export function tenantMiddleware(req: Request, res: Response, next: NextFunction) {
  let tenantId = req.headers['x-tenant-id'] as string;

  if (!tenantId && req.query.tenantId) {
    tenantId = req.query.tenantId as string;
  }

  const host = req.headers.host || '';
  if (!tenantId && host.includes('.nexorux.')) {
    const slug = host.split('.')[0];
    const tenantRow = db.prepare('SELECT id FROM tenants WHERE slug = ?').get(slug) as { id: string } | undefined;
    if (tenantRow) {
      tenantId = tenantRow.id;
    }
  }

  const normalizedPath = req.originalUrl.split('?')[0].replace(/^\/api\/v1/, '') || '/';

  if (!tenantId && !PUBLIC_PATHS.includes(normalizedPath)) {
    return res.status(400).json({ error: 'X-Tenant-ID header or tenantId query param is required' });
  }

  req.tenantId = tenantId;
  next();
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const apiKey = req.headers['x-api-key'] as string | undefined;

  if (apiKey) {
    const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
    const keyRecord = db.prepare(`
      SELECT * FROM tenant_api_keys
      WHERE key_hash = ? AND revoked_at IS NULL
      ORDER BY created_at DESC
      LIMIT 1
    `).get(keyHash) as { id: string; tenant_id: string } | undefined;

    if (!keyRecord) {
      return res.status(403).json({ error: 'Invalid or revoked API key' });
    }

    db.prepare("UPDATE tenant_api_keys SET last_used_at = datetime('now') WHERE id = ?").run(keyRecord.id);
    req.tenantId = keyRecord.tenant_id;
    req.user = {
      id: 'api-key',
      tenant_id: keyRecord.tenant_id,
      email: 'api-key@nexorux.local',
      role: 'TENANT_OWNER',
      employee_id: ''
    };
    return next();
  }

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid authorization token' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthenticatedUser;
    req.user = decoded;
    req.tenantId = decoded.tenant_id;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
  }
}

// Optional Auth (populates req.user if token present, otherwise lets guest proceed or use default tenant admin)
export function optionalAuthMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, JWT_SECRET) as AuthenticatedUser;
      req.user = decoded;
      req.tenantId = decoded.tenant_id;
    } catch (e) {
      // ignore invalid optional token
    }
  }
  next();
}

export function requirePermission(...permissions: Permission[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const role = req.user.role;
    const rolePermissions = ROLE_PERMISSIONS[role] || [];

    const allowed = permissions.some((permission) => rolePermissions.includes(permission));
    if (!allowed) {
      return res.status(403).json({
        error: `Forbidden: Role '${role}' lacks permission '${permissions.join(' | ')}'`,
        requiredPermission: permissions.length === 1 ? permissions[0] : permissions,
        role
      });
    }

    next();
  };
}

export function requireEmployeeAccess(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });

  const permissions = ROLE_PERMISSIONS[req.user.role] || [];
  if (permissions.includes('employee.view_all') || permissions.includes('employee.view_team')) {
    return next();
  }

  if (permissions.includes('employee.view_self') && req.params.id === req.user.employee_id) {
    return next();
  }

  return res.status(403).json({ error: 'No tienes permiso para ver este perfil de empleado' });
}

export function recordAudit(
  tenantId: string,
  userId: string,
  userEmail: string | undefined,
  action: string,
  resourceType: string,
  resourceId: string,
  details: Record<string, any>,
  ipAddress: string = '127.0.0.1'
) {
  try {
    db.prepare(`
      INSERT INTO audit_logs (id, tenant_id, user_id, user_email, action, resource_type, resource_id, details_json, ip_address, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(
      uuidv4(),
      tenantId,
      userId,
      userEmail || 'system',
      action,
      resourceType,
      resourceId,
      JSON.stringify(details),
      ipAddress
    );

    setImmediate(() => {
      WebhookService.deliverEvent(tenantId, action, {
        resourceType,
        resourceId,
        details,
        userId,
        userEmail: userEmail || 'system',
        ipAddress
      }).catch(() => {});
    });
  } catch (err) {
    console.error('Failed to record audit log:', err);
  }
}
