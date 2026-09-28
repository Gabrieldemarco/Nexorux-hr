import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { createTestDb, seedMinimalData } from './helpers';

let _db: ReturnType<typeof createTestDb> | null = null;

vi.mock('../../config/db', () => ({
  get db() {
    if (!_db) throw new Error('Test DB not initialized');
    return _db;
  }
}));

describe('API key integration', () => {
  let app: express.Express;
  let server: any;
  const tenantId = 'tenant-123';
  const testPassword = 'password';
  const passwordHash = bcrypt.hashSync(testPassword, 8);

  beforeAll(() => {
    _db = createTestDb();
    seedMinimalData(_db, tenantId);
    _db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, 'user-1');
  });

  afterAll(() => {
    _db?.close();
    _db = null;
  });

  beforeEach(async () => {
    _db!.prepare('DELETE FROM tenant_api_keys').run();
    vi.resetModules();
    const apiRouter = (await import('../../routes/api')).apiRouter;
    app = express();
    app.use(cors({ origin: '*' }));
    app.use(express.json({ limit: '15mb' }));
    app.use((req: any, _res, next) => {
      req.tenantId = tenantId;
      next();
    });
    app.use('/api/v1', apiRouter);
    server = app.listen(0);
    const port = (server.address() as any).port;
    (global as any).__BASE_URL__ = `http://localhost:${port}`;
  });

  afterEach(() => {
    server?.close();
  });

  it('should create API key and allow access with it', async () => {
    const base = (global as any).__BASE_URL__;

    const loginRes = await fetch(`${base}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': tenantId },
      body: JSON.stringify({ email: 'admin@test.com', password: testPassword })
    });
    expect(loginRes.status).toBe(200);
    const { token } = await loginRes.json();

    const createRes = await fetch(`${base}/api/v1/settings/api-keys`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-ID': tenantId,
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ name: 'Test Key' })
    });
    expect(createRes.status).toBe(201);
    const createBody = await createRes.json();
    const apiKey = createBody.key;
    expect(apiKey).toBeTruthy();

    const listRes = await fetch(`${base}/api/v1/settings/api-keys`, {
      headers: { 'X-Tenant-ID': tenantId, 'X-API-Key': apiKey }
    });
    expect(listRes.status).toBe(200);
    const keys = await listRes.json();
    expect(keys).toHaveLength(1);
    expect(keys[0].name).toBe('Test Key');
  });

  it('should reject revoked API key', async () => {
    const base = (global as any).__BASE_URL__;

    const loginRes = await fetch(`${base}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': tenantId },
      body: JSON.stringify({ email: 'admin@test.com', password: testPassword })
    });
    const { token } = await loginRes.json();

    const rawKey = `nx_test_key_${crypto.randomBytes(24).toString('hex')}`;
    _db!.prepare('INSERT INTO tenant_api_keys (id, tenant_id, name, key_hash, key_prefix) VALUES (?, ?, ?, ?, ?)').run(crypto.randomUUID(), tenantId, 'Revoked Key', crypto.createHash('sha256').update(rawKey).digest('hex'), rawKey.slice(0, 12));

    _db!.prepare("UPDATE tenant_api_keys SET revoked_at = datetime('now') WHERE key_hash = ?").run(crypto.createHash('sha256').update(rawKey).digest('hex'));

    const listRes = await fetch(`${base}/api/v1/settings/api-keys`, {
      headers: { 'X-Tenant-ID': tenantId, 'X-API-Key': rawKey }
    });
    expect(listRes.status).toBe(403);
    const body = await listRes.json();
    expect(body.error).toContain('Invalid or revoked API key');
  });
});
