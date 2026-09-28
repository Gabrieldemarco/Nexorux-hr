import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { db } from '../config/db';

// Extended Request types for multer
interface MulterRequest extends Request {
  file?: Express.Multer.File;
  files?: Express.Multer.File[] | { [fieldname: string]: Express.Multer.File[] };
}
import { JWT_SECRET, authMiddleware, requireEmployeeAccess, requirePermission, tenantMiddleware } from '../middleware/context';
import { HRService } from '../services/HRService';
import { WebhookService } from '../services/WebhookService';
import { CVParserService } from '../services/CVParserService';
import { CVAnalyzerService } from '../services/CVAnalyzerService';
import { CountryEngineFactory } from '../engines/CountryEngineFactory';
import { CountryCode, UserRole } from '../domain/types';
import { rateLimitMiddleware } from '../middleware/rateLimit';
import { setCsrfCookie } from '../middleware/csrf';
import { validate } from '../middleware/validate';
import { sanitizeErrorMessage } from '../utils/sanitize';
import {
  LoginSchema,
  ForgotPasswordSchema,
  ResetPasswordSchema,
  ChangePasswordSchema,
  EmployeeSchema,
  EmployeeUpdateSchema,
  CompanySettingsSchema,
  WebhookSchema,
  LeaveRequestSchema,
  PayrollCalculationSchema,
  RecruitmentCostSchema,
  CandidateStageSchema,
  JobOpeningSchema,
  CandidateCreateSchema,
  CandidateUpdateSchema,
  DocumentUploadSchema,
  AiQuerySchema,
  EngineSimulateSchema,
  MeritCycleSchema,
  EquityGrantSchema,
  CVAnalyzeSchema,
  CVBatchAnalyzeSchema,
  CVResultsQuerySchema
} from '../validation/schemas';

const authRateLimit = rateLimitMiddleware({
  windowMs: 15 * 60 * 1000,
  max: 5,
  keyExtractor: (req) => `${req.ip}:${req.originalUrl}`
});

const cvUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 20
  },
  fileFilter: (req, file, cb) => {
    if (!file.originalname.toLowerCase().endsWith('.pdf')) {
      return cb(new Error('Only PDF files are allowed'));
    }
    cb(null, true);
  }
});

export const apiRouter = Router();

// Apply tenant context to all routes
apiRouter.use(tenantMiddleware);

// ================= AUTH =================
apiRouter.post('/auth/login', authRateLimit, validate(LoginSchema), async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email || !password) {
      return res.status(400).json({ error: 'Email y contraseña son obligatorios' });
    }

    let user: any = null;
    if (req.tenantId) {
      user = db.prepare('SELECT * FROM users WHERE tenant_id = ? AND email = ?').get(req.tenantId!, email);
    } else {
      user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as any;
    }

    if (!user || user.status !== 'ACTIVE' || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    db.prepare("UPDATE users SET last_login_at = datetime('now') WHERE id = ? AND tenant_id = ?").run(user.id, user.tenant_id);

    const token = jwt.sign(
      {
        id: user.id,
        tenant_id: user.tenant_id,
        email: user.email,
        role: user.role,
        employee_id: user.employee_id
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role,
        employee_id: user.employee_id,
        tenant_id: user.tenant_id
      }
    });
  } catch (error: any) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Error interno del servidor', details: process.env.NODE_ENV !== 'production' ? error.message : undefined });
  }
});

apiRouter.get('/auth/csrf-token', (req: Request, res: Response) => {
  setCsrfCookie(req, res);
  res.json({ message: 'CSRF token set' });
});

apiRouter.post('/auth/forgot-password', authRateLimit, validate(ForgotPasswordSchema), (req: Request, res: Response) => {
  const { email } = req.body as { email?: string };
  const genericResponse = { message: 'Si la cuenta existe, recibirás instrucciones para recuperar el acceso.' };
  if (!email) return res.json(genericResponse);

  let user: any = null;
  if (req.tenantId) {
    user = db.prepare("SELECT id, tenant_id FROM users WHERE tenant_id = ? AND email = ? AND status = 'ACTIVE'").get(req.tenantId!, email.trim().toLowerCase());
  } else {
    user = db.prepare("SELECT id, tenant_id FROM users WHERE email = ? AND status = 'ACTIVE'").get(email.trim().toLowerCase()) as any;
  }
  if (!user) return res.json(genericResponse);

  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  db.prepare("UPDATE password_reset_tokens SET used_at = datetime('now') WHERE tenant_id = ? AND user_id = ? AND used_at IS NULL").run(user.tenant_id, user.id);
  db.prepare(`
    INSERT INTO password_reset_tokens (id, tenant_id, user_id, token_hash, expires_at)
    VALUES (?, ?, ?, ?, datetime('now', '+1 hour'))
  `).run(crypto.randomUUID(), user.tenant_id, user.id, tokenHash);

  if (process.env.NODE_ENV !== 'production') {
    return res.json({ ...genericResponse, resetToken: rawToken });
  }
  return res.json(genericResponse);
});

apiRouter.post('/auth/reset-password', authRateLimit, validate(ResetPasswordSchema), (req: Request, res: Response) => {
  const { token, password } = req.body as { token?: string; password?: string };
  if (!token || !password || password.length < 8) {
    return res.status(400).json({ error: 'El token y una contraseña de al menos 8 caracteres son obligatorios' });
  }
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const reset = db.prepare(`
    SELECT * FROM password_reset_tokens
    WHERE token_hash = ? AND used_at IS NULL AND expires_at > datetime('now')
  `).get(tokenHash) as { id: string; tenant_id: string; user_id: string } | undefined;
  if (!reset) return res.status(400).json({ error: 'El enlace de recuperación es inválido o expiró' });
  if (req.tenantId && reset.tenant_id !== req.tenantId) {
    return res.status(403).json({ error: 'Token inválido para este tenant' });
  }

  const passwordHash = bcrypt.hashSync(password, 12);
  const update = db.transaction(() => {
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ? AND tenant_id = ?').run(passwordHash, reset.user_id, reset.tenant_id);
    db.prepare("UPDATE password_reset_tokens SET used_at = datetime('now') WHERE id = ?").run(reset.id);
  });
  update();
  return res.json({ message: 'Contraseña actualizada correctamente' });
});

apiRouter.use(authMiddleware);

apiRouter.get('/auth/me', (req: Request, res: Response) => {
  const user = db.prepare(`
    SELECT id, tenant_id, email, first_name, last_name, role, employee_id, status
    FROM users WHERE tenant_id = ? AND id = ? AND status = 'ACTIVE'
  `).get(req.tenantId!, req.user!.id) as any;
  if (!user) return res.status(401).json({ error: 'Sesión inválida' });
  return res.json({ user });
});

apiRouter.get('/notifications', authMiddleware, (req: Request, res: Response) => {
  const items = db.prepare(`
    SELECT id, action, resource_type, details_json, created_at
    FROM audit_logs
    WHERE tenant_id = ?
    ORDER BY created_at DESC
    LIMIT 12
  `).all(req.tenantId!);
  res.json({ items, unreadCount: items.length });
});

apiRouter.post('/auth/change-password', validate(ChangePasswordSchema), (req: Request, res: Response) => {
  const { currentPassword, newPassword } = req.body as { currentPassword?: string; newPassword?: string };
  if (!currentPassword || !newPassword || newPassword.length < 8) {
    return res.status(400).json({ error: 'La contraseña nueva debe tener al menos 8 caracteres' });
  }
  const user = db.prepare('SELECT password_hash FROM users WHERE id = ? AND tenant_id = ? AND status = \'ACTIVE\'').get(req.user!.id, req.tenantId!) as { password_hash: string } | undefined;
  if (!user || !bcrypt.compareSync(currentPassword, user.password_hash)) {
    return res.status(401).json({ error: 'La contraseña actual es incorrecta' });
  }
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ? AND tenant_id = ?').run(bcrypt.hashSync(newPassword, 12), req.user!.id, req.tenantId!);
  db.prepare("UPDATE password_reset_tokens SET used_at = datetime('now') WHERE user_id = ? AND tenant_id = ? AND used_at IS NULL").run(req.user!.id, req.tenantId!);
  return res.json({ message: 'Contraseña actualizada correctamente' });
});

apiRouter.post('/auth/switch-role', (req: Request, res: Response) => {
  return res.status(410).json({ error: 'El cambio de identidad demo fue deshabilitado' });
});

// ================= DASHBOARD =================
apiRouter.get('/dashboard/metrics', requirePermission('reports.view'), (req: Request, res: Response) => {
  try {
    const data = HRService.getDashboardMetrics(req.tenantId!);
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: sanitizeErrorMessage(err) });
  }
});

apiRouter.get('/reports/analytics', requirePermission('reports.view'), (req: Request, res: Response) => {
  try {
    res.json(HRService.getAnalytics(req.tenantId!));
  } catch (err: any) {
    res.status(500).json({ error: sanitizeErrorMessage(err) });
  }
});

apiRouter.get('/settings/company', requirePermission('tenant.manage'), (req: Request, res: Response) => {
  const tenant = db.prepare('SELECT id, slug, legal_name, country_code, currency, timezone, branding_json FROM tenants WHERE id = ?').get(req.tenantId!) as any;
  if (!tenant) return res.status(404).json({ error: 'Tenant no encontrado' });
  let branding: Record<string, any> = {};
  try { branding = tenant.branding_json ? JSON.parse(tenant.branding_json) : {}; } catch { branding = {}; }
  res.json({
    companyName: tenant.legal_name,
    domain: tenant.slug,
    defaultCurrency: tenant.currency,
    defaultCountry: tenant.country_code,
    timezone: tenant.timezone,
    tenantId: tenant.id,
    policies: branding.policies || {},
    branding: branding.branding || { primaryColor: '#6366F1', platformName: 'Nexorux HR', logoUrl: '' }
  });
});

apiRouter.put('/settings/company', requirePermission('tenant.manage'), validate(CompanySettingsSchema), (req: Request, res: Response) => {
  const { companyName, domain, defaultCurrency, defaultCountry, timezone, policies, branding: brandingConfig } = req.body;
  if (!companyName || !domain || !defaultCurrency || !defaultCountry || !timezone) {
    return res.status(400).json({ error: 'Empresa, dominio, moneda, país y zona horaria son obligatorios' });
  }
  const current = db.prepare('SELECT branding_json FROM tenants WHERE id = ?').get(req.tenantId!) as { branding_json?: string } | undefined;
  let branding: Record<string, any> = {};
  try { branding = current?.branding_json ? JSON.parse(current.branding_json) : {}; } catch { branding = {}; }
  branding.policies = policies || branding.policies || {};
  branding.branding = brandingConfig || branding.branding || { primaryColor: '#6366F1', platformName: 'Nexorux HR', logoUrl: '' };
  db.prepare(`
    UPDATE tenants SET legal_name = ?, slug = ?, currency = ?, country_code = ?, timezone = ?, branding_json = ?
    WHERE id = ?
  `).run(companyName, domain, defaultCurrency, defaultCountry, timezone, JSON.stringify(branding), req.tenantId!);
  res.json({ message: 'Configuración guardada correctamente' });
});

const defaultNotificationEvents = [
  ['PAYROLL_APPROVED', 'Liquidación de nómina aprobada', true, true, false],
  ['PAYROLL_ERROR', 'Error en motor de cálculo de país', true, true, true],
  ['LEAVE_PENDING', 'Solicitud de licencia pendiente de aprobación', true, true, true],
  ['CONTRACT_EXPIRING', 'Contrato o período de prueba a vencer', true, false, false],
  ['EMPLOYEE_HIRED', 'Nuevo empleado incorporado al sistema', false, true, false],
  ['SECURITY_LOGIN', 'Login desde IP no reconocida', true, true, true]
];

apiRouter.get('/settings/notifications', requirePermission('tenant.manage'), (req: Request, res: Response) => {
  const existing = db.prepare('SELECT * FROM notification_preferences WHERE tenant_id = ?').all(req.tenantId!) as any[];
  res.json(defaultNotificationEvents.map(([eventKey, label, email, slack, push]) => {
    const row = existing.find(item => item.event_key === eventKey);
    return { eventKey, label, email: row ? Boolean(row.email) : email, slack: row ? Boolean(row.slack) : slack, push: row ? Boolean(row.push) : push };
  }));
});

apiRouter.put('/settings/notifications', requirePermission('tenant.manage'), (req: Request, res: Response) => {
  const preferences = Array.isArray(req.body.preferences) ? req.body.preferences : [];
  const save = db.transaction(() => preferences.forEach((item: any) => db.prepare(`
    INSERT INTO notification_preferences (id, tenant_id, event_key, email, slack, push, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(tenant_id, event_key) DO UPDATE SET email = excluded.email, slack = excluded.slack, push = excluded.push, updated_at = datetime('now')
  `).run(crypto.randomUUID(), req.tenantId!, item.eventKey, item.email ? 1 : 0, item.slack ? 1 : 0, item.push ? 1 : 0)));
  save();
  res.json({ message: 'Preferencias de notificación guardadas' });
});

apiRouter.get('/settings/api-keys', requirePermission('tenant.manage'), (req: Request, res: Response) => {
  res.json(db.prepare("SELECT id, name, key_prefix, last_used_at, created_at FROM tenant_api_keys WHERE tenant_id = ? AND revoked_at IS NULL ORDER BY created_at DESC").all(req.tenantId!));
});

apiRouter.post('/settings/api-keys', requirePermission('tenant.manage'), (req: Request, res: Response) => {
  const name = String(req.body.name || 'Production');
  const rawKey = `nx_${name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${crypto.randomBytes(24).toString('hex')}`;
  db.prepare('INSERT INTO tenant_api_keys (id, tenant_id, name, key_hash, key_prefix) VALUES (?, ?, ?, ?, ?)').run(crypto.randomUUID(), req.tenantId!, name, crypto.createHash('sha256').update(rawKey).digest('hex'), rawKey.slice(0, 12));
  res.status(201).json({ message: 'API key creada. Guárdala ahora; no volverá a mostrarse completa.', key: rawKey });
});

apiRouter.delete('/settings/api-keys/:id', requirePermission('tenant.manage'), (req: Request, res: Response) => {
  db.prepare("UPDATE tenant_api_keys SET revoked_at = datetime('now') WHERE id = ? AND tenant_id = ?").run(String(req.params.id), req.tenantId!);
  res.json({ message: 'API key revocada' });
});

apiRouter.get('/settings/integrations', requirePermission('tenant.manage'), (req: Request, res: Response) => {
  const providers = [
    ['Slack', 'Comunicación', 'Notificaciones de aprobación de licencias, payroll y cumplimiento.', '💬'],
    ['Google Workspace', 'Productividad', 'SSO, sincronización de usuarios y directorio corporativo.', '🔵'],
    ['Zapier', 'Automatización', 'Automatización de onboarding, documentos y emails.', '⚡'],
    ['Workday', 'ERP/HCM', 'Sincronización de empleados y estructura organizacional.', '🏢'],
    ['QuickBooks', 'Contabilidad', 'Exportación de asientos contables de nómina.', '📊'],
    ['BambooHR', 'HR Tools', 'Migración de empleados y documentos históricos.', '🎋']
  ];
  const existing = db.prepare('SELECT * FROM api_integrations WHERE tenant_id = ?').all(req.tenantId!) as any[];
  const result = providers.map(([provider, category, description, icon]) => {
    const row = existing.find(item => item.provider === provider);
    return { provider, category, description, icon, status: row?.status || 'DISCONNECTED', lastTestedAt: row?.last_tested_at || null };
  });
  res.json(result);
});

apiRouter.put('/settings/integrations/:provider', requirePermission('tenant.manage'), (req: Request, res: Response) => {
  const provider = String(req.params.provider);
  const { category, description, status, config } = req.body;
  if (!provider || !['CONNECTED', 'DISCONNECTED', 'ERROR'].includes(status)) return res.status(400).json({ error: 'Proveedor o estado inválido' });
  db.prepare(`
    INSERT INTO api_integrations (id, tenant_id, provider, category, description, status, config_json, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(tenant_id, provider) DO UPDATE SET status = excluded.status, config_json = excluded.config_json, updated_at = datetime('now')
  `).run(crypto.randomUUID(), req.tenantId!, provider, category || 'API', description || '', status, JSON.stringify(config || {}));
  res.json({ message: 'Integración guardada', provider, status });
});

apiRouter.post('/settings/integrations/:provider/test', requirePermission('tenant.manage'), async (req: Request, res: Response) => {
  const provider = String(req.params.provider);
  const row = db.prepare('SELECT * FROM api_integrations WHERE tenant_id = ? AND provider = ?').get(req.tenantId!, provider) as any;
  if (!row) return res.status(404).json({ error: 'La integración aún no está configurada' });
  const config = JSON.parse(row.config_json || '{}');
  const endpoint = config.endpoint as string | undefined;
  if (!endpoint) return res.status(400).json({ error: 'Configura un endpoint antes de probar' });
  let parsedUrl: URL;
  try { parsedUrl = new URL(endpoint); } catch { return res.status(400).json({ error: 'El endpoint no es una URL válida' }); }
  if (!['http:', 'https:'].includes(parsedUrl.protocol)) return res.status(400).json({ error: 'El endpoint debe usar HTTP o HTTPS' });

  const isWebhookProvider = ['Slack', 'Zapier'].includes(provider);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);
  try {
    const response = await fetch(endpoint, {
      method: isWebhookProvider ? 'POST' : 'GET',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'Nexorux-HR-Integration-Test/1.0' },
      body: isWebhookProvider ? JSON.stringify({ source: 'nexorux-hr', event: 'INTEGRATION_TEST', tenantId: req.tenantId, provider }) : undefined,
      signal: controller.signal
    });
    clearTimeout(timeout);
    if (!response.ok) throw new Error(`El proveedor respondió HTTP ${response.status}`);
    db.prepare("UPDATE api_integrations SET status = 'CONNECTED', last_tested_at = datetime('now'), updated_at = datetime('now') WHERE id = ? AND tenant_id = ?").run(row.id, req.tenantId!);
    return res.json({ message: `Conexión real con ${provider} validada`, status: 'CONNECTED', httpStatus: response.status });
  } catch (error: any) {
    clearTimeout(timeout);
    db.prepare("UPDATE api_integrations SET status = 'ERROR', last_tested_at = datetime('now'), updated_at = datetime('now') WHERE id = ? AND tenant_id = ?").run(row.id, req.tenantId!);
    return res.status(502).json({ error: error.name === 'AbortError' ? 'El endpoint agotó el tiempo de espera' : error.message, status: 'ERROR' });
  }
});

// ================= WEBHOOKS =================
apiRouter.get('/settings/webhooks', requirePermission('tenant.manage'), (req: Request, res: Response) => {
  res.json(WebhookService.getWebhooks(req.tenantId!));
});

apiRouter.post('/settings/webhooks', requirePermission('tenant.manage'), validate(WebhookSchema), (req: Request, res: Response) => {
  const { name, url, secret, events, max_retries, retry_backoff_base } = req.body;
  if (!name || !url || !secret) {
    return res.status(400).json({ error: 'Nombre, URL y secreto son obligatorios' });
  }
  try {
    const webhook = WebhookService.createWebhook(req.tenantId!, {
      name,
      url,
      secret,
      events: Array.isArray(events) ? events : [],
      max_retries: Number(max_retries) || 5,
      retry_backoff_base: Number(retry_backoff_base) || 1000
    });
    res.status(201).json(webhook);
  } catch (err: any) {
    res.status(400).json({ error: sanitizeErrorMessage(err) });
  }
});

apiRouter.put('/settings/webhooks/:id', requirePermission('tenant.manage'), (req: Request, res: Response) => {
  const { name, url, secret, events, is_active, max_retries, retry_backoff_base } = req.body;
  const webhook = WebhookService.updateWebhook(req.tenantId!, String(req.params.id), {
    name,
    url,
    secret,
    events: Array.isArray(events) ? events : undefined,
    is_active: is_active !== undefined ? (is_active ? 1 : 0) : undefined,
    max_retries: max_retries !== undefined ? Number(max_retries) : undefined,
    retry_backoff_base: retry_backoff_base !== undefined ? Number(retry_backoff_base) : undefined
  });
  if (!webhook) return res.status(404).json({ error: 'Webhook no encontrado' });
  res.json(webhook);
});

apiRouter.delete('/settings/webhooks/:id', requirePermission('tenant.manage'), (req: Request, res: Response) => {
  const deleted = WebhookService.deleteWebhook(req.tenantId!, String(req.params.id));
  if (!deleted) return res.status(404).json({ error: 'Webhook no encontrado' });
  res.json({ message: 'Webhook eliminado' });
});

apiRouter.get('/settings/webhooks/:id/deliveries', requirePermission('tenant.manage'), (req: Request, res: Response) => {
  const limit = Math.min(Number(req.query.limit) || 50, 100);
  const offset = Number(req.query.offset) || 0;
  const deliveries = WebhookService.getDeliveries(req.tenantId!, String(req.params.id), limit, offset);
  res.json(deliveries);
});

apiRouter.post('/settings/webhooks/:id/test', requirePermission('tenant.manage'), async (req: Request, res: Response) => {
  const webhook = WebhookService.getWebhookById(req.tenantId!, String(req.params.id));
  if (!webhook) return res.status(404).json({ error: 'Webhook no encontrado' });

  const payload = {
    id: 'test-' + Date.now(),
    event: 'WEBHOOK_TEST',
    tenantId: req.tenantId,
    timestamp: new Date().toISOString(),
    data: { source: 'nexorux-hr', message: 'Test webhook delivery' }
  };

  const body = JSON.stringify(payload);
  const signature = crypto.createHmac('sha256', webhook.secret).update(body).digest('hex');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);
  try {
    const response = await fetch(webhook.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Nexorux-Signature': `sha256=${signature}`,
        'X-Nexorux-Event': 'WEBHOOK_TEST',
        'X-Nexorux-Delivery': payload.id,
        'User-Agent': 'Nexorux-HR-Webhook/1.0'
      },
      body,
      signal: controller.signal
    });
    clearTimeout(timeout);
    const responseText = await response.text();
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${responseText.slice(0, 500)}`);
    return res.json({ message: 'Webhook test exitoso', status: 'SUCCESS', httpStatus: response.status, response: responseText.slice(0, 1000) });
  } catch (error: any) {
    clearTimeout(timeout);
    return res.status(502).json({ error: error.name === 'AbortError' ? 'El endpoint agotó el tiempo de espera' : error.message, status: 'ERROR' });
  }
});

// ================= EMPLOYEES =================
apiRouter.get('/employees', requirePermission('employee.view_all'), (req: Request, res: Response) => {
  try {
    const { search, departmentId, status, page, limit } = req.query;
    const employees = HRService.getEmployees(
      req.tenantId!,
      search as string,
      departmentId as string,
      status as string,
      Number(page) || 1,
      Number(limit) || 50
    );
    res.json(employees);
  } catch (err: any) {
    res.status(500).json({ error: sanitizeErrorMessage(err) });
  }
});

apiRouter.get('/employees/:id', requireEmployeeAccess, (req: Request, res: Response) => {
  try {
    const employee = HRService.getEmployeeById(req.tenantId!, String(req.params.id));
    if (!employee) return res.status(404).json({ error: 'Empleado no encontrado' });
    res.json(employee);
  } catch (err: any) {
    res.status(500).json({ error: sanitizeErrorMessage(err) });
  }
});

apiRouter.post('/employees', requirePermission('employee.create'), validate(EmployeeSchema), (req: Request, res: Response) => {
  try {
    const actorId = req.user?.id;
    const actorEmail = req.user?.email;
    if (!actorId) return res.status(401).json({ error: 'Authentication required' });
    const newEmp = HRService.createEmployee(req.tenantId!, req.body, actorId, actorEmail);
    res.status(201).json(newEmp);
  } catch (err: any) {
    res.status(500).json({ error: sanitizeErrorMessage(err) });
  }
});

apiRouter.put('/employees/:id', requirePermission('employee.update'), validate(EmployeeUpdateSchema), (req: Request, res: Response) => {
  try {
    if (!req.user?.id) return res.status(401).json({ error: 'Authentication required' });
    const updated = HRService.updateEmployee(req.tenantId!, String(req.params.id), req.body, req.user!.id, req.user!.email);
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: sanitizeErrorMessage(err) });
  }
});

// ================= ORGANIZATION =================
apiRouter.get('/org/tree', requirePermission('org.manage'), (req: Request, res: Response) => {
  try {
    const tree = HRService.getOrganizationTree(req.tenantId!);
    res.json(tree);
  } catch (err: any) {
    res.status(500).json({ error: sanitizeErrorMessage(err) });
  }
});

apiRouter.get('/org/companies', requirePermission('org.manage'), (req: Request, res: Response) => {
  res.json(HRService.getCompanies(req.tenantId!));
});

apiRouter.get('/org/branches', requirePermission('org.manage'), (req: Request, res: Response) => {
  res.json(HRService.getBranches(req.tenantId!));
});

apiRouter.get('/org/departments', requirePermission('org.manage', 'recruitment.manage'), (req: Request, res: Response) => {
  res.json(HRService.getDepartments(req.tenantId!));
});

apiRouter.get('/org/positions', requirePermission('org.manage', 'recruitment.manage'), (req: Request, res: Response) => {
  res.json(HRService.getPositions(req.tenantId!));
});

// ================= ATTENDANCE =================
apiRouter.get('/attendance', authMiddleware, (req: Request, res: Response) => {
  try {
    const { date, employeeId } = req.query;
    res.json(HRService.getAttendances(req.tenantId!, date as string, employeeId as string));
  } catch (err: any) {
    res.status(500).json({ error: sanitizeErrorMessage(err) });
  }
});

apiRouter.post('/attendance/clock-in', authMiddleware, (req: Request, res: Response) => {
  try {
    const { employeeId, notes } = req.body;
    const targetEmpId = employeeId || req.user?.employee_id;
    if (!targetEmpId) {
      return res.status(400).json({ error: 'Debes especificar el empleado para fichar' });
    }
    const result = HRService.clockIn(req.tenantId!, targetEmpId, notes);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: sanitizeErrorMessage(err) });
  }
});

apiRouter.post('/attendance/clock-out', authMiddleware, (req: Request, res: Response) => {
  try {
    const { employeeId, notes } = req.body;
    const targetEmpId = employeeId || req.user?.employee_id;
    if (!targetEmpId) {
      return res.status(400).json({ error: 'Debes especificar el empleado para fichar' });
    }
    const result = HRService.clockOut(req.tenantId!, targetEmpId, notes);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: sanitizeErrorMessage(err) });
  }
});

// ================= LEAVES & VACATIONS =================
apiRouter.get('/leaves', authMiddleware, (req: Request, res: Response) => {
  try {
    const { employeeId } = req.query;
    res.json(HRService.getLeaveRequests(req.tenantId!, employeeId as string));
  } catch (err: any) {
    res.status(500).json({ error: sanitizeErrorMessage(err) });
  }
});

apiRouter.post('/leaves', authMiddleware, validate(LeaveRequestSchema), (req: Request, res: Response) => {
  try {
    const result = HRService.createLeaveRequest(req.tenantId!, req.body);
    res.status(201).json(result);
  } catch (err: any) {
    res.status(400).json({ error: sanitizeErrorMessage(err) });
  }
});

apiRouter.put('/leaves/:id/approve', requirePermission('leave.approve'), (req: Request, res: Response) => {
  try {
    if (!req.user?.id) return res.status(401).json({ error: 'Authentication required' });
    const result = HRService.approveLeaveRequest(req.tenantId!, String(req.params.id), req.user!.id, req.user!.email);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: sanitizeErrorMessage(err) });
  }
});

apiRouter.put('/leaves/:id/reject', requirePermission('leave.approve'), (req: Request, res: Response) => {
  try {
    if (!req.user?.id) return res.status(401).json({ error: 'Authentication required' });
    const { reason } = req.body;
    const result = HRService.rejectLeaveRequest(req.tenantId!, String(req.params.id), req.user!.id, reason, req.user!.email);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: sanitizeErrorMessage(err) });
  }
});

// ================= PAYROLL CORE & RUNS =================
apiRouter.get('/payroll/runs', requirePermission('payroll.view'), (req: Request, res: Response) => {
  try {
    res.json(HRService.getPayrollRuns(req.tenantId!));
  } catch (err: any) {
    res.status(500).json({ error: sanitizeErrorMessage(err) });
  }
});

apiRouter.post('/payroll/calculate', requirePermission('payroll.run'), validate(PayrollCalculationSchema), (req: Request, res: Response) => {
  try {
    if (!req.user?.id) return res.status(401).json({ error: 'Authentication required' });
    const { companyId, periodName, periodType, countryCode } = req.body;

    const result = HRService.runPayrollCalculation(
      req.tenantId!,
      companyId,
      periodName || 'Nómina General',
      periodType || 'MONTHLY',
      countryCode || 'UY',
      req.user!.id,
      req.user!.email
    );
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: sanitizeErrorMessage(err) });
  }
});

apiRouter.get('/payroll/slips/:runId', requirePermission('payroll.view'), (req: Request, res: Response) => {
  try {
    res.json(HRService.getPayrollSlips(req.tenantId!, String(req.params.runId)));
  } catch (err: any) {
    res.status(500).json({ error: sanitizeErrorMessage(err) });
  }
});

// ================= RECRUITMENT & ATS =================
apiRouter.get('/recruitment/openings', requirePermission('recruitment.manage'), (req: Request, res: Response) => {
  try {
    res.json(HRService.getJobOpenings(req.tenantId!));
  } catch (err: any) {
    res.status(500).json({ error: sanitizeErrorMessage(err) });
  }
});

apiRouter.get('/recruitment/costs', requirePermission('recruitment.manage'), (req: Request, res: Response) => {
  try {
    res.json(HRService.getRecruitmentCosts(req.tenantId!));
  } catch (err: any) {
    res.status(500).json({ error: sanitizeErrorMessage(err) });
  }
});

apiRouter.post('/recruitment/costs', requirePermission('recruitment.manage'), validate(RecruitmentCostSchema), (req: Request, res: Response) => {
  try {
    const { category, description, amount, hired_count, currency, incurred_at, job_opening_id } = req.body;
    if (!category || !description || amount === undefined || Number(amount) < 0) {
      return res.status(400).json({ error: 'Categoría, descripción y monto válido son obligatorios' });
    }
    res.status(201).json(HRService.createRecruitmentCost(req.tenantId!, {
      category, description, amount, hired_count, currency, incurred_at, job_opening_id
    }));
  } catch (err: any) {
    res.status(400).json({ error: sanitizeErrorMessage(err) });
  }
});

apiRouter.get('/recruitment/candidates', requirePermission('recruitment.manage'), (req: Request, res: Response) => {
  try {
    const { openingId } = req.query;
    res.json(HRService.getCandidates(req.tenantId!, openingId as string));
  } catch (err: any) {
    res.status(500).json({ error: sanitizeErrorMessage(err) });
  }
});

apiRouter.put('/recruitment/candidates/:id/stage', requirePermission('recruitment.manage'), validate(CandidateStageSchema), (req: Request, res: Response) => {
  try {
    if (!req.user?.id) return res.status(401).json({ error: 'Authentication required' });
    const { stage } = req.body;
    res.json(HRService.updateCandidateStage(req.tenantId!, String(req.params.id), stage, req.user!.id));
  } catch (err: any) {
    res.status(400).json({ error: sanitizeErrorMessage(err) });
  }
});

apiRouter.post('/recruitment/candidates/:id/hire', requirePermission('recruitment.manage'), (req: Request, res: Response) => {
  try {
    if (!req.user?.id) return res.status(401).json({ error: 'Authentication required' });
    const result = HRService.hireCandidate(req.tenantId!, String(req.params.id), req.user!.id, req.user!.email);
    res.status(201).json(result);
  } catch (err: any) {
    res.status(400).json({ error: sanitizeErrorMessage(err) });
  }
});

apiRouter.post('/recruitment/openings', requirePermission('recruitment.manage'), validate(JobOpeningSchema), (req: Request, res: Response) => {
  try {
    if (!req.user?.id) return res.status(401).json({ error: 'Authentication required' });
    const result = HRService.createJobOpening(req.tenantId!, req.body, req.user!.id, req.user!.email);
    res.status(201).json(result);
  } catch (err: any) {
    res.status(400).json({ error: sanitizeErrorMessage(err) });
  }
});

apiRouter.put('/recruitment/openings/:id', requirePermission('recruitment.manage'), validate(JobOpeningSchema), (req: Request, res: Response) => {
  try {
    if (!req.user?.id) return res.status(401).json({ error: 'Authentication required' });
    const result = HRService.updateJobOpening(req.tenantId!, String(req.params.id), req.body, req.user!.id, req.user!.email);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: sanitizeErrorMessage(err) });
  }
});

apiRouter.delete('/recruitment/openings/:id', requirePermission('recruitment.manage'), (req: Request, res: Response) => {
  try {
    if (!req.user?.id) return res.status(401).json({ error: 'Authentication required' });
    const result = HRService.closeJobOpening(req.tenantId!, String(req.params.id), req.user!.id, req.user!.email);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: sanitizeErrorMessage(err) });
  }
});

apiRouter.post('/recruitment/candidates', requirePermission('recruitment.manage'), validate(CandidateCreateSchema), (req: Request, res: Response) => {
  try {
    if (!req.user?.id) return res.status(401).json({ error: 'Authentication required' });
    const result = HRService.createCandidate(req.tenantId!, req.body, req.user!.id, req.user!.email);
    res.status(201).json(result);
  } catch (err: any) {
    res.status(400).json({ error: sanitizeErrorMessage(err) });
  }
});

apiRouter.put('/recruitment/candidates/:id', requirePermission('recruitment.manage'), validate(CandidateUpdateSchema), (req: Request, res: Response) => {
  try {
    if (!req.user?.id) return res.status(401).json({ error: 'Authentication required' });
    const result = HRService.updateCandidate(req.tenantId!, String(req.params.id), req.body, req.user!.id, req.user!.email);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: sanitizeErrorMessage(err) });
  }
});

apiRouter.delete('/recruitment/candidates/:id', requirePermission('recruitment.manage'), (req: Request, res: Response) => {
  try {
    if (!req.user?.id) return res.status(401).json({ error: 'Authentication required' });
    const result = HRService.rejectCandidate(req.tenantId!, String(req.params.id), req.user!.id, req.user!.email);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: sanitizeErrorMessage(err) });
  }
});

// ================= CV ANALYSIS =================
apiRouter.post('/recruitment/cv/parse', requirePermission('recruitment.manage'), cvUpload.single('cv'), async (req: MulterRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se proporcionó archivo PDF' });
    }

    const validation = CVParserService.validateFile(req.file);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    const parsed = await CVParserService.parsePDF(req.file.buffer, req.file.originalname);
    res.json({ text: parsed.text, pageCount: parsed.pageCount, fileSize: parsed.fileSize });
  } catch (err: any) {
    res.status(400).json({ error: sanitizeErrorMessage(err) });
  }
});

apiRouter.post('/recruitment/cv/parse-batch', requirePermission('recruitment.manage'), cvUpload.array('cvs', 20), async (req: MulterRequest, res: Response) => {
  try {
    const files = (req.files as Express.Multer.File[]) || [];
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No se proporcionaron archivos PDF' });
    }

    const validFiles: Array<{ buffer: Buffer; filename: string }> = [];
    const errors: Array<{ filename: string; error: string }> = [];

    for (const file of files) {
      const validation = CVParserService.validateFile(file);
      if (validation.valid) {
        validFiles.push({ buffer: file.buffer, filename: file.originalname });
      } else {
        errors.push({ filename: file.originalname, error: validation.error! });
      }
    }

    if (validFiles.length === 0) {
      return res.status(400).json({ error: 'Ningún archivo válido', errors });
    }

    const parsed = await CVParserService.parseMultiplePDFs(validFiles);
    const results = parsed.map((p, i) => ({
      filename: validFiles[i].filename,
      text: p.text,
      pageCount: p.pageCount,
      fileSize: p.fileSize
    }));

    res.json({ results, errors });
  } catch (err: any) {
    res.status(400).json({ error: sanitizeErrorMessage(err) });
  }
});

apiRouter.post('/recruitment/cv/analyze', requirePermission('recruitment.manage'), validate(CVAnalyzeSchema), async (req: Request, res: Response) => {
  try {
    if (!req.tenantId) return res.status(400).json({ error: 'Tenant requerido' });
    const { jobOpeningId, cvText, candidateId } = req.body;
    const result = await CVAnalyzerService.analyzeCV(req.tenantId, { jobOpeningId, cvText, candidateId, originalFilename: 'manual-input.txt' });
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: sanitizeErrorMessage(err) });
  }
});

apiRouter.post('/recruitment/cv/batch-analyze', requirePermission('recruitment.manage'), validate(CVBatchAnalyzeSchema), async (req: Request, res: Response) => {
  try {
    if (!req.tenantId) return res.status(400).json({ error: 'Tenant requerido' });
    const { jobOpeningId, cvs } = req.body;
    const results = await CVAnalyzerService.batchAnalyzeCVs(req.tenantId, jobOpeningId, cvs);
    res.json({ results, total: results.length, elegible: results.filter(r => r.clasificacion === 'elegible').length });
  } catch (err: any) {
    res.status(400).json({ error: sanitizeErrorMessage(err) });
  }
});

apiRouter.get('/recruitment/cv/results/:jobOpeningId', requirePermission('recruitment.manage'), validate(CVResultsQuerySchema), (req: Request, res: Response) => {
  try {
    if (!req.tenantId) return res.status(400).json({ error: 'Tenant requerido' });
    const { jobOpeningId } = req.params;
    
    const getFirst = (val: unknown): string | undefined => {
      if (Array.isArray(val) && val.length > 0) return String(val[0]);
      if (typeof val === 'string') return val;
      return undefined;
    };
    
    const limitNum = getFirst(req.query.limit) ? Number(getFirst(req.query.limit)) : 50;
    const offsetNum = getFirst(req.query.offset) ? Number(getFirst(req.query.offset)) : 0;

    const classificationFilter: string | undefined = String(req.query.classification);
    const minScoreFilter: string | undefined = String(req.query.minScore);
    const results = CVAnalyzerService.getCVAnalysisResults(
      req.tenantId as string,
      jobOpeningId as string,
      classificationFilter,
      minScoreFilter ? Number(minScoreFilter) : undefined
    );

    const paginated = results.slice(offsetNum, offsetNum + limitNum);
    res.json({ 
      results: paginated, 
      total: results.length,
      elegible: results.filter(r => r.classification === 'elegible').length,
      descartado: results.filter(r => r.classification === 'descartado').length
    });
  } catch (err: any) {
    res.status(400).json({ error: sanitizeErrorMessage(err) });
  }
});

apiRouter.post('/recruitment/cv/link-candidate', requirePermission('recruitment.manage'), async (req: Request, res: Response) => {
  try {
    if (!req.tenantId) return res.status(400).json({ error: 'Tenant requerido' });
    const { analysisId, candidateId } = req.body;
    if (!analysisId || !candidateId) {
      return res.status(400).json({ error: 'analysisId y candidateId son obligatorios' });
    }
    const success = CVAnalyzerService.linkToCandidate(req.tenantId, analysisId, candidateId);
    if (!success) return res.status(404).json({ error: 'Análisis no encontrado' });
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: sanitizeErrorMessage(err) });
  }
});

// ================= DOCUMENTS =================
apiRouter.get('/documents', authMiddleware, (req: Request, res: Response) => {
  try {
    const { employeeId } = req.query;
    res.json(HRService.getDocuments(req.tenantId!, employeeId as string));
  } catch (err: any) {
    res.status(500).json({ error: sanitizeErrorMessage(err) });
  }
});

apiRouter.post('/documents', requirePermission('document.upload'), validate(DocumentUploadSchema), (req: Request, res: Response) => {
  try {
    const { employee_id, title, category, fileName, mimeType, data, expiry_date, is_confidential } = req.body;
    if (!employee_id || !title || !category || !fileName || !mimeType || !data) {
      return res.status(400).json({ error: 'Empleado, título, categoría y archivo son obligatorios' });
    }
    const employee = db.prepare('SELECT id FROM employees WHERE id = ? AND tenant_id = ?').get(employee_id, req.tenantId!);
    if (!employee) return res.status(404).json({ error: 'Empleado no encontrado' });
    const documentId = crypto.randomUUID();
    const safeName = `${documentId}-${path.basename(fileName).replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const storageDir = path.resolve(__dirname, '../../data/documents', req.tenantId!);
    fs.mkdirSync(storageDir, { recursive: true });
    const base64 = String(data).replace(/^data:[^;]+;base64,/, '');
    const fileBuffer = Buffer.from(base64, 'base64');
    if (fileBuffer.length > 10 * 1024 * 1024) return res.status(413).json({ error: 'El documento no puede superar 10 MB' });
    fs.writeFileSync(path.join(storageDir, safeName), fileBuffer);
    db.prepare(`
      INSERT INTO employee_documents (id, tenant_id, employee_id, title, category, file_url, file_size_bytes, mime_type, expiry_date, is_confidential)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(documentId, req.tenantId!, employee_id, title, category, safeName, fileBuffer.length, mimeType, expiry_date || null, is_confidential ? 1 : 0);
    res.status(201).json({ id: documentId, message: 'Documento cargado correctamente' });
  } catch (err: any) {
    res.status(400).json({ error: sanitizeErrorMessage(err) });
  }
});

apiRouter.get('/documents/:id/download', authMiddleware, (req: Request, res: Response) => {
  const document = db.prepare('SELECT * FROM employee_documents WHERE id = ? AND tenant_id = ?').get(String(req.params.id), req.tenantId!) as any;
  if (!document) return res.status(404).json({ error: 'Documento no encontrado' });
  const storageDir = path.resolve(__dirname, '../../data/documents', req.tenantId!);
  let filePath = path.resolve(storageDir, path.basename(document.file_url));
  if (!fs.existsSync(filePath) && String(document.file_url).startsWith('/docs/')) {
    const legacyName = `legacy-${document.id}.pdf`;
    filePath = path.join(storageDir, legacyName);
    fs.mkdirSync(storageDir, { recursive: true });
    const escapePdf = document.title.replace(/[\\()]/g, '\\$&');
    const stream = `BT /F1 16 Tf 50 760 Td (${escapePdf}) Tj ET`;
    const objects = [
      '<< /Type /Catalog /Pages 2 0 R >>',
      '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
      `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`
    ];
    let pdf = '%PDF-1.4\n';
    const offsets = [0];
    objects.forEach((object, index) => { offsets.push(Buffer.byteLength(pdf)); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; });
    const xref = Buffer.byteLength(pdf);
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n `).join('\n')}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
    fs.writeFileSync(filePath, pdf);
    db.prepare('UPDATE employee_documents SET file_url = ?, file_size_bytes = ?, mime_type = ? WHERE id = ? AND tenant_id = ?').run(legacyName, Buffer.byteLength(pdf), 'application/pdf', document.id, req.tenantId!);
  }
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Archivo no disponible en la bóveda' });
  res.download(filePath, document.title.replace(/[^a-zA-Z0-9._-]/g, '_'), { headers: { 'Content-Type': document.mime_type } });
});

apiRouter.put('/documents/:id', requirePermission('document.upload'), (req: Request, res: Response) => {
  try {
    if (!req.user?.id) return res.status(401).json({ error: 'Authentication required' });
    const result = HRService.updateDocumentMetadata(req.tenantId!, String(req.params.id), req.body, req.user!.id, req.user!.email);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: sanitizeErrorMessage(err) });
  }
});

apiRouter.post('/documents/:id/replace', requirePermission('document.upload'), (req: Request, res: Response) => {
  try {
    if (!req.user?.id) return res.status(401).json({ error: 'Authentication required' });
    const { fileName, mimeType, data } = req.body;
    if (!fileName || !mimeType || !data) {
      return res.status(400).json({ error: 'Archivo, tipo y contenido son obligatorios' });
    }
    const result = HRService.replaceDocumentFile(req.tenantId!, String(req.params.id), { fileName, mimeType, data }, req.user!.id, req.user!.email);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: sanitizeErrorMessage(err) });
  }
});

apiRouter.delete('/documents/:id', requirePermission('document.delete'), (req: Request, res: Response) => {
  try {
    if (!req.user?.id) return res.status(401).json({ error: 'Authentication required' });
    const result = HRService.deleteDocument(req.tenantId!, String(req.params.id), req.user!.id, req.user!.email);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: sanitizeErrorMessage(err) });
  }
});

// ================= ONBOARDING =================
apiRouter.get('/onboarding', authMiddleware, (req: Request, res: Response) => {
  try {
    const { employeeId } = req.query;
    res.json(HRService.getOnboardingTasks(req.tenantId!, employeeId as string));
  } catch (err: any) {
    res.status(500).json({ error: sanitizeErrorMessage(err) });
  }
});

apiRouter.put('/onboarding/:id/toggle', authMiddleware, (req: Request, res: Response) => {
  try {
    res.json(HRService.toggleOnboardingTask(req.tenantId!, String(req.params.id)));
  } catch (err: any) {
    res.status(400).json({ error: sanitizeErrorMessage(err) });
  }
});

apiRouter.post('/onboarding', authMiddleware, (req: Request, res: Response) => {
  try {
    if (!req.user?.id) return res.status(401).json({ error: 'Authentication required' });
    const result = HRService.createOnboardingTask(req.tenantId!, req.body, req.user!.id, req.user!.email);
    res.status(201).json(result);
  } catch (err: any) {
    res.status(400).json({ error: sanitizeErrorMessage(err) });
  }
});

apiRouter.put('/onboarding/:id', authMiddleware, (req: Request, res: Response) => {
  try {
    if (!req.user?.id) return res.status(401).json({ error: 'Authentication required' });
    const result = HRService.updateOnboardingTask(req.tenantId!, String(req.params.id), req.body, req.user!.id, req.user!.email);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: sanitizeErrorMessage(err) });
  }
});

apiRouter.delete('/onboarding/:id', authMiddleware, (req: Request, res: Response) => {
  try {
    if (!req.user?.id) return res.status(401).json({ error: 'Authentication required' });
    const result = HRService.deleteOnboardingTask(req.tenantId!, String(req.params.id), req.user!.id, req.user!.email);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: sanitizeErrorMessage(err) });
  }
});

// ================= ORGANIZATION: COMPANIES =================
apiRouter.get('/companies', authMiddleware, (req: Request, res: Response) => {
  try {
    res.json(HRService.getCompanies(req.tenantId!));
  } catch (err: any) {
    res.status(500).json({ error: sanitizeErrorMessage(err) });
  }
});

apiRouter.get('/companies/:id', authMiddleware, (req: Request, res: Response) => {
  try {
    const company = HRService.getCompany(req.tenantId!, String(req.params.id));
    if (!company) return res.status(404).json({ error: 'Empresa no encontrada' });
    res.json(company);
  } catch (err: any) {
    res.status(500).json({ error: sanitizeErrorMessage(err) });
  }
});

apiRouter.post('/companies', requirePermission('org.manage'), (req: Request, res: Response) => {
  try {
    if (!req.user?.id) return res.status(401).json({ error: 'Authentication required' });
    const result = HRService.createCompany(req.tenantId!, req.body, req.user!.id, req.user!.email);
    res.status(201).json(result);
  } catch (err: any) {
    res.status(400).json({ error: sanitizeErrorMessage(err) });
  }
});

apiRouter.put('/companies/:id', requirePermission('org.manage'), (req: Request, res: Response) => {
  try {
    if (!req.user?.id) return res.status(401).json({ error: 'Authentication required' });
    const result = HRService.updateCompany(req.tenantId!, String(req.params.id), req.body, req.user!.id, req.user!.email);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: sanitizeErrorMessage(err) });
  }
});

apiRouter.delete('/companies/:id', requirePermission('org.manage'), (req: Request, res: Response) => {
  try {
    if (!req.user?.id) return res.status(401).json({ error: 'Authentication required' });
    const result = HRService.deleteCompany(req.tenantId!, String(req.params.id), req.user!.id, req.user!.email);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: sanitizeErrorMessage(err) });
  }
});

// ================= ORGANIZATION: BRANCHES =================
apiRouter.get('/branches', authMiddleware, (req: Request, res: Response) => {
  try {
    const companyId = req.query.companyId ? String(req.query.companyId) : undefined;
    res.json(HRService.getBranches(req.tenantId!, companyId));
  } catch (err: any) {
    res.status(500).json({ error: sanitizeErrorMessage(err) });
  }
});

apiRouter.post('/branches', requirePermission('org.manage'), (req: Request, res: Response) => {
  try {
    if (!req.user?.id) return res.status(401).json({ error: 'Authentication required' });
    const result = HRService.createBranch(req.tenantId!, req.body, req.user!.id, req.user!.email);
    res.status(201).json(result);
  } catch (err: any) {
    res.status(400).json({ error: sanitizeErrorMessage(err) });
  }
});

apiRouter.put('/branches/:id', requirePermission('org.manage'), (req: Request, res: Response) => {
  try {
    if (!req.user?.id) return res.status(401).json({ error: 'Authentication required' });
    const result = HRService.updateBranch(req.tenantId!, String(req.params.id), req.body, req.user!.id, req.user!.email);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: sanitizeErrorMessage(err) });
  }
});

apiRouter.delete('/branches/:id', requirePermission('org.manage'), (req: Request, res: Response) => {
  try {
    if (!req.user?.id) return res.status(401).json({ error: 'Authentication required' });
    const result = HRService.deleteBranch(req.tenantId!, String(req.params.id), req.user!.id, req.user!.email);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: sanitizeErrorMessage(err) });
  }
});

// ================= ORGANIZATION: DEPARTMENTS =================
apiRouter.get('/departments', authMiddleware, (req: Request, res: Response) => {
  try {
    const companyId = req.query.companyId ? String(req.query.companyId) : undefined;
    res.json(HRService.getDepartments(req.tenantId!, companyId));
  } catch (err: any) {
    res.status(500).json({ error: sanitizeErrorMessage(err) });
  }
});

apiRouter.post('/departments', requirePermission('org.manage'), (req: Request, res: Response) => {
  try {
    if (!req.user?.id) return res.status(401).json({ error: 'Authentication required' });
    const result = HRService.createDepartment(req.tenantId!, req.body, req.user!.id, req.user!.email);
    res.status(201).json(result);
  } catch (err: any) {
    res.status(400).json({ error: sanitizeErrorMessage(err) });
  }
});

apiRouter.put('/departments/:id', requirePermission('org.manage'), (req: Request, res: Response) => {
  try {
    if (!req.user?.id) return res.status(401).json({ error: 'Authentication required' });
    const result = HRService.updateDepartment(req.tenantId!, String(req.params.id), req.body, req.user!.id, req.user!.email);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: sanitizeErrorMessage(err) });
  }
});

apiRouter.delete('/departments/:id', requirePermission('org.manage'), (req: Request, res: Response) => {
  try {
    if (!req.user?.id) return res.status(401).json({ error: 'Authentication required' });
    const result = HRService.deleteDepartment(req.tenantId!, String(req.params.id), req.user!.id, req.user!.email);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: sanitizeErrorMessage(err) });
  }
});

// ================= ORGANIZATION: POSITIONS =================
apiRouter.get('/positions', authMiddleware, (req: Request, res: Response) => {
  try {
    const departmentId = req.query.departmentId ? String(req.query.departmentId) : undefined;
    res.json(HRService.getPositions(req.tenantId!, departmentId));
  } catch (err: any) {
    res.status(500).json({ error: sanitizeErrorMessage(err) });
  }
});

apiRouter.post('/positions', requirePermission('org.manage'), (req: Request, res: Response) => {
  try {
    if (!req.user?.id) return res.status(401).json({ error: 'Authentication required' });
    const result = HRService.createPosition(req.tenantId!, req.body, req.user!.id, req.user!.email);
    res.status(201).json(result);
  } catch (err: any) {
    res.status(400).json({ error: sanitizeErrorMessage(err) });
  }
});

apiRouter.put('/positions/:id', requirePermission('org.manage'), (req: Request, res: Response) => {
  try {
    if (!req.user?.id) return res.status(401).json({ error: 'Authentication required' });
    const result = HRService.updatePosition(req.tenantId!, String(req.params.id), req.body, req.user!.id, req.user!.email);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: sanitizeErrorMessage(err) });
  }
});

apiRouter.delete('/positions/:id', requirePermission('org.manage'), (req: Request, res: Response) => {
  try {
    if (!req.user?.id) return res.status(401).json({ error: 'Authentication required' });
    const result = HRService.deletePosition(req.tenantId!, String(req.params.id), req.user!.id, req.user!.email);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: sanitizeErrorMessage(err) });
  }
});

// ================= AUDIT LOGS =================
apiRouter.get('/audit', requirePermission('audit.view'), (req: Request, res: Response) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const offset = Number(req.query.offset) || 0;
    res.json(HRService.getAuditLogs(req.tenantId!, limit, offset));
  } catch (err: any) {
    res.status(500).json({ error: sanitizeErrorMessage(err) });
  }
});

// ================= NEXORUX IA COPILOT =================
apiRouter.post('/ai/query', requirePermission('ai.use'), validate(AiQuerySchema), async (req: Request, res: Response) => {
  try {
    const { prompt } = req.body;
    const userRole = req.user!.role;
    const userEmail = req.user!.email;

    console.log('[AI][REQ]', { prompt, userRole, userEmail, tenantId: req.tenantId });
    const reply = await HRService.queryNexoruxAI(req.tenantId!, { role: userRole, email: userEmail }, prompt || '');
    console.log('[AI][REPLY]', JSON.stringify(reply));
    res.json(reply);
  } catch (err: any) {
    console.error('[AI][ERROR]', err);
    res.status(500).json({ error: sanitizeErrorMessage(err) });
  }
});

// ================= COUNTRY ENGINES SIMULATION & STATUTORY RULES =================
apiRouter.get('/engines/supported', (_req: Request, res: Response) => {
  res.json(CountryEngineFactory.getAllSupportedCountries());
});

apiRouter.post('/engines/simulate', validate(EngineSimulateSchema), (req: Request, res: Response) => {
  try {
    const { countryCode, baseSalary, overtimeHours, seniorityYears } = req.body;
    const engine = CountryEngineFactory.getEngine(countryCode || 'UY');
    const calculation = engine.calculatePayroll({
      baseSalary: Number(baseSalary) || 50000,
      workedDays: 30,
      totalDaysInMonth: 30,
      regularHours: 160,
      overtimeHours: Number(overtimeHours) || 0,
      seniorityYears: Number(seniorityYears) || 1
    });
    const vacationRules = engine.calculateVacationDays(Number(seniorityYears) || 1);
    const vacationBonus = engine.calculateVacationBonus(Number(baseSalary) || 50000, vacationRules.totalEntitledDays);
    const statutoryBonus = engine.calculateStatutoryBonus('MID_YEAR', Number(baseSalary) || 50000, 6);

    res.json({
      calculation,
      vacationRules,
      vacationBonus,
      statutoryBonus
    });
  } catch (err: any) {
    res.status(400).json({ error: sanitizeErrorMessage(err) });
  }
});

// ================= COMPENSATION =================
apiRouter.get('/compensation/bands', requirePermission('salary.view'), (req: Request, res: Response) => {
  try {
    const bands = db.prepare(`
      SELECT p.level, MIN(p.min_salary) as min_salary, MAX(p.max_salary) as max_salary,
             COUNT(e.id) as headcount
      FROM positions p
      LEFT JOIN employees e ON p.tenant_id = e.tenant_id AND p.id = e.position_id
      WHERE p.tenant_id = ?
      GROUP BY p.level
      ORDER BY MIN(p.min_salary) ASC
    `).all(req.tenantId!) as any[];
    res.json(bands);
  } catch (err: any) {
    res.status(500).json({ error: sanitizeErrorMessage(err) });
  }
});

apiRouter.post('/compensation/merit-cycle', requirePermission('salary.update'), validate(MeritCycleSchema), (req: Request, res: Response) => {
  try {
    const { employee_id, proposed_salary, merit_score, performance_rating, effective_date, notes } = req.body;
    if (!employee_id || !proposed_salary || !effective_date) {
      return res.status(400).json({ error: 'Empleado, salario propuesto y fecha efectiva son obligatorios' });
    }
    const id = crypto.randomUUID();
    db.prepare(`
      INSERT INTO compensation_merit_cycles (id, tenant_id, employee_id, proposed_salary, merit_score, performance_rating, effective_date, status, notes, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'DRAFT', ?, ?, datetime('now'))
    `).run(id, req.tenantId!, employee_id, proposed_salary, merit_score || null, performance_rating || null, effective_date, notes || null, req.user?.id);
    res.status(201).json({ id, message: 'Ciclo de méritos creado' });
  } catch (err: any) {
    res.status(400).json({ error: sanitizeErrorMessage(err) });
  }
});

apiRouter.get('/compensation/merit-cycles', requirePermission('salary.view'), (req: Request, res: Response) => {
  try {
    const cycles = db.prepare(`
      SELECT mc.*, e.first_name, e.last_name, e.employee_code
      FROM compensation_merit_cycles mc
      JOIN employees e ON mc.tenant_id = e.tenant_id AND mc.employee_id = e.id
      WHERE mc.tenant_id = ?
      ORDER BY mc.created_at DESC
    `).all(req.tenantId!) as any[];
    res.json(cycles);
  } catch (err: any) {
    res.status(500).json({ error: sanitizeErrorMessage(err) });
  }
});

apiRouter.put('/compensation/merit-cycles/:id/approve', requirePermission('salary.update'), (req: Request, res: Response) => {
  try {
    db.prepare(`
      UPDATE compensation_merit_cycles SET status = 'APPROVED', approved_by = ?, approved_at = datetime('now')
      WHERE id = ? AND tenant_id = ?
    `).run(req.user?.id, req.params.id, req.tenantId!);
    res.json({ message: 'Ciclo aprobado' });
  } catch (err: any) {
    res.status(400).json({ error: sanitizeErrorMessage(err) });
  }
});

apiRouter.post('/compensation/equity-grants', requirePermission('salary.update'), validate(EquityGrantSchema), (req: Request, res: Response) => {
  try {
    const { employee_id, grant_type, shares, strike_price, vesting_years, cliff_months, notes } = req.body;
    if (!employee_id || !grant_type || !shares || !vesting_years) {
      return res.status(400).json({ error: 'Campos obligatorios faltantes' });
    }
    const id = crypto.randomUUID();
    db.prepare(`
      INSERT INTO equity_grants (id, tenant_id, employee_id, grant_type, shares, strike_price, vesting_years, cliff_months, status, notes, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?, datetime('now'))
    `).run(id, req.tenantId!, employee_id, grant_type, shares, strike_price || null, vesting_years, cliff_months || 12, notes || null, req.user?.id);
    res.status(201).json({ id, message: 'Equity grant creado' });
  } catch (err: any) {
    res.status(400).json({ error: sanitizeErrorMessage(err) });
  }
});

apiRouter.get('/compensation/equity-grants', requirePermission('salary.view'), (req: Request, res: Response) => {
  try {
    const grants = db.prepare(`
      SELECT eg.*, e.first_name, e.last_name, e.employee_code
      FROM equity_grants eg
      JOIN employees e ON eg.tenant_id = e.tenant_id AND eg.employee_id = e.id
      WHERE eg.tenant_id = ?
      ORDER BY eg.created_at DESC
    `).all(req.tenantId!) as any[];
    res.json(grants);
  } catch (err: any) {
    res.status(500).json({ error: sanitizeErrorMessage(err) });
  }
});

apiRouter.get('/compensation/analytics', requirePermission('salary.view'), (req: Request, res: Response) => {
  try {
    const totalComp = db.prepare(`
      SELECT SUM(base_salary) as total_fixed FROM employees WHERE tenant_id = ? AND employment_status IN ('ACTIVE', 'PROBATION')
    `).get(req.tenantId!) as { total_fixed: number };
    const equityValue = db.prepare(`
      SELECT SUM(shares * COALESCE(strike_price, 0)) as total_equity FROM equity_grants WHERE tenant_id = ? AND status = 'ACTIVE'
    `).get(req.tenantId!) as { total_equity: number };
    const activeMeritCycles = db.prepare(`
      SELECT COUNT(*) as count FROM compensation_merit_cycles WHERE tenant_id = ? AND status IN ('DRAFT', 'SUBMITTED', 'PENDING')
    `).get(req.tenantId!) as { count: number };

    res.json({
      totalComp: totalComp.total_fixed || 0,
      equityValue: equityValue.total_equity || 0,
      totalCompensation: (totalComp.total_fixed || 0) + (equityValue.total_equity || 0),
      activeMeritCycles: activeMeritCycles.count || 0,
      compRatioByLevel: [
        { level: 'JUNIOR', compRatio: 105 },
        { level: 'MID', compRatio: 98 },
        { level: 'SENIOR', compRatio: 102 },
        { level: 'LEAD', compRatio: 95 },
        { level: 'EXECUTIVE', compRatio: 110 }
      ]
    });
  } catch (err: any) {
    res.status(500).json({ error: sanitizeErrorMessage(err) });
  }
});
