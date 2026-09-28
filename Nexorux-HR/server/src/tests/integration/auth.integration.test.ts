import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcrypt';
import { createTestDb, seedMinimalData } from './helpers';

let _db: ReturnType<typeof createTestDb> | null = null;

vi.mock('../../config/db', () => ({
  get db() {
    if (!_db) throw new Error('Test DB not initialized');
    return _db;
  }
}));

describe('Auth integration', () => {
  let app: express.Express;
  let server: any;
  const tenantA = 'tenant-a';
  const tenantB = 'tenant-b';
  const testPassword = 'password';
  const passwordHash = bcrypt.hashSync(testPassword, 8);

  beforeAll(() => {
    _db = createTestDb();
    seedMinimalData(_db, tenantA);
    _db.prepare('INSERT INTO tenants (id, slug, legal_name, country_code, currency) VALUES (?, ?, ?, ?, ?)').run(tenantB, 'tenant-b', 'Tenant B', 'UY', 'USD');
    _db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, 'user-1');

    const userIdB = 'user-b';
    _db.prepare('INSERT INTO users (id, tenant_id, email, password_hash, first_name, last_name, role) VALUES (?, ?, ?, ?, ?, ?, ?)').run(userIdB, tenantB, 'admin@test.com', passwordHash, 'Admin', 'B', 'TENANT_OWNER');
  });

  afterAll(() => {
    _db?.close();
    _db = null;
  });

  beforeEach(async () => {
    _db!.prepare('DELETE FROM password_reset_tokens').run();
    vi.resetModules();
    const apiRouter = (await import('../../routes/api')).apiRouter;
    app = express();
    app.use(cors({ origin: '*' }));
    app.use(express.json({ limit: '15mb' }));
    app.use((req: any, _res, next) => {
      req.tenantId = req.headers['x-tenant-id'] as string;
      next();
    });
    app.use('/api/v1', apiRouter);
    server = app.listen(0);
    const port = (server.address() as any).port;
    (global as any).__BASE_URL__ = `http://localhost:${port}`;
  });

  afterEach(() => {
    if (server) server.close();
  });

  async function apiPost(path: string, body: any, tenantId?: string) {
    const base = (global as any).__BASE_URL__;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (tenantId) headers['X-Tenant-ID'] = tenantId;
    const res = await fetch(`${base}${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });
    return res;
  }

  it('should not allow password reset across tenants', async () => {
    const forgotRes = await apiPost('/api/v1/auth/forgot-password', { email: 'admin@test.com' }, tenantA);
    if (!forgotRes.ok) {
      const errorBody = await forgotRes.text();
      console.error('Forgot password error:', forgotRes.status, errorBody);
    }
    expect(forgotRes.status).toBe(200);
    const forgotBody = await forgotRes.json();
    const token = (forgotBody as any).resetToken;
    expect(token).toBeDefined();

    const resetRes = await apiPost('/api/v1/auth/reset-password', { token, password: 'newpass123' }, tenantB);
    expect(resetRes.status).toBe(403);
    const resetBody = await resetRes.json();
    expect(resetBody.error).toContain('Token inválido para este tenant');
  });
});
