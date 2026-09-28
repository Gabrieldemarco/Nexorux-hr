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

describe('Webhook retry event validation integration', () => {
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

  async function apiPost(path: string, body: any, token: string) {
    const base = (global as any).__BASE_URL__;
    const res = await fetch(`${base}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-ID': tenantId,
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(body)
    });
    return res;
  }

  async function apiGet(path: string, token: string) {
    const base = (global as any).__BASE_URL__;
    const res = await fetch(`${base}${path}`, {
      headers: { 'X-Tenant-ID': tenantId, 'Authorization': `Bearer ${token}` }
    });
    return res;
  }

  async function apiPut(path: string, body: any, token: string) {
    const base = (global as any).__BASE_URL__;
    const res = await fetch(`${base}${path}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-ID': tenantId,
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(body)
    });
    return res;
  }

  it('should disable pending deliveries when webhook no longer matches event', async () => {
    const loginRes = await apiPost('/api/v1/auth/login', { email: 'admin@test.com', password: testPassword }, tenantId);
    expect(loginRes.status).toBe(200);
    const { token } = await loginRes.json();

    const createRes = await apiPost('/api/v1/settings/webhooks', {
      name: 'Hook',
      url: 'https://example.com/hook',
      secret: 'secret',
      events: ['EMPLOYEE_CREATED']
    }, token);
    expect(createRes.status).toBe(201);
    const webhook = await createRes.json();

    const deliveryId = 'delivery-1';
    _db!.prepare(`INSERT INTO webhook_deliveries (id, webhook_id, tenant_id, event_type, payload_json, status, attempt_count, next_attempt_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'PENDING', 0, datetime('now'), datetime('now'), datetime('now'))`).run(deliveryId, webhook.id, tenantId, 'EMPLOYEE_CREATED', '{}');

    const updateRes = await apiPut(`/api/v1/settings/webhooks/${webhook.id}`, {
      events: ['EMPLOYEE_UPDATED']
    }, token);
    expect(updateRes.status).toBe(200);
    const updated = await updateRes.json();
    expect(updated.events).toContain('EMPLOYEE_UPDATED');
    expect(updated.events).not.toContain('EMPLOYEE_CREATED');

    const WebhookService = (await import('../../services/WebhookService')).WebhookService;
    WebhookService.processPendingDeliveries();

    const delivery = _db!.prepare('SELECT * FROM webhook_deliveries WHERE id = ?').get(deliveryId) as any;
    expect(delivery.status).toBe('DISABLED');
  });
});
