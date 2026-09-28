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

describe('Webhooks integration', () => {
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
    _db!.prepare('DELETE FROM webhook_deliveries').run();
    _db!.prepare('DELETE FROM webhooks').run();
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

  async function apiPost(path: string, body: any) {
    const base = (global as any).__BASE_URL__;
    const res = await fetch(`${base}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-ID': tenantId
      },
      body: JSON.stringify(body)
    });
    return res;
  }

  async function apiGet(path: string, token?: string) {
    const base = (global as any).__BASE_URL__;
    const headers: Record<string, string> = { 'X-Tenant-ID': tenantId };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${base}${path}`, { headers });
    return res;
  }

  it('should create webhook with encrypted secret', async () => {
    const loginRes = await apiPost('/api/v1/auth/login', { email: 'admin@test.com', password: testPassword });
    expect(loginRes.status).toBe(200);
    const loginBody = await loginRes.json();
    const token = loginBody.token;

    const createRes = await fetch(`${(global as any).__BASE_URL__}/api/v1/settings/webhooks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-ID': tenantId,
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        name: 'Integration Hook',
        url: 'https://example.com/hook',
        secret: 'hook-secret',
        events: ['EMPLOYEE_CREATED']
      })
    });
    expect(createRes.status).toBe(201);
    const webhook = await createRes.json();
    expect(webhook.name).toBe('Integration Hook');
    expect(webhook.secret).not.toBe('hook-secret');
  });

  it('should list webhooks', async () => {
    const loginRes = await apiPost('/api/v1/auth/login', { email: 'admin@test.com', password: testPassword });
    const { token } = await loginRes.json();

    const headers = {
      'Content-Type': 'application/json',
      'X-Tenant-ID': tenantId,
      'Authorization': `Bearer ${token}`
    };

    const createRes1 = await fetch(`${(global as any).__BASE_URL__}/api/v1/settings/webhooks`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: 'Hook 1', url: 'https://example.com/hook1', secret: 'secret1', events: ['*'] })
    });
    expect(createRes1.status).toBe(201);

    const createRes2 = await fetch(`${(global as any).__BASE_URL__}/api/v1/settings/webhooks`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: 'Hook 2', url: 'https://example.com/hook2', secret: 'secret2', events: ['EMPLOYEE_CREATED'] })
    });
    expect(createRes2.status).toBe(201);

    const listRes = await fetch(`${(global as any).__BASE_URL__}/api/v1/settings/webhooks`, { headers });
    expect(listRes.status).toBe(200);
    const hooks = await listRes.json();
    expect(hooks).toHaveLength(2);
  });
});

