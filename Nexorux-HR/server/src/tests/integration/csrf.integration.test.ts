import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcrypt';
import { createTestDb, seedMinimalData } from './helpers';
import { csrfMiddleware } from '../../middleware/csrf';

let _db: ReturnType<typeof createTestDb> | null = null;

vi.mock('../../config/db', () => ({
  get db() {
    if (!_db) throw new Error('Test DB not initialized');
    return _db;
  }
}));

describe('CSRF integration', () => {
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
    _db!.prepare('DELETE FROM password_reset_tokens').run();
    vi.resetModules();
    const apiRouter = (await import('../../routes/api')).apiRouter;
    app = express();
    app.use(cors({ origin: '*' }));
    app.use(express.json({ limit: '15mb' }));
    app.use(cookieParser());
    app.use(csrfMiddleware);
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

  it('should set CSRF token on auth/csrf-token', async () => {
    const base = (global as any).__BASE_URL__;
    const res = await fetch(`${base}/api/v1/auth/csrf-token`, {
      method: 'GET',
      headers: { 'X-Tenant-ID': tenantId }
    });
    expect(res.status).toBe(200);
    const cookies = res.headers.get('set-cookie');
    expect(cookies).toBeTruthy();
    expect(cookies!.toLowerCase()).toContain('xsrf-token=');
  });

  it('should block state-changing request without CSRF token', async () => {
    const base = (global as any).__BASE_URL__;

    const csrfRes = await fetch(`${base}/api/v1/auth/csrf-token`, {
      method: 'GET',
      headers: { 'X-Tenant-ID': tenantId }
    });
    expect(csrfRes.status).toBe(200);
    const cookies = csrfRes.headers.get('set-cookie')!;
    const cookieMatch = cookies.match(/XSRF-TOKEN=([^;]+)/);
    expect(cookieMatch).toBeTruthy();
    const xsrfCookie = cookieMatch![1];
    const csrfToken = decodeURIComponent(csrfRes.headers.get('x-csrf-token')!);

    const loginRes = await fetch(`${base}/api/v1/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-ID': tenantId,
        'X-XSRF-Token': csrfToken,
        'Cookie': `XSRF-TOKEN=${xsrfCookie}`
      },
      body: JSON.stringify({ email: 'admin@test.com', password: testPassword })
    });
    expect(loginRes.status).toBe(200);
    const { token } = await loginRes.json();

    const createRes = await fetch(`${base}/api/v1/settings/api-keys`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-ID': tenantId,
        'Authorization': `Bearer ${token}`,
        'X-XSRF-Token': csrfToken,
        'Cookie': `XSRF-TOKEN=${xsrfCookie}`
      },
      body: JSON.stringify({ name: 'CSRF Test' })
    });
    expect(createRes.status).toBe(201);

    const badRes = await fetch(`${base}/api/v1/settings/api-keys`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-ID': tenantId,
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ name: 'CSRF Fail' })
    });
    expect(badRes.status).toBe(403);
    const body = await badRes.json();
    expect(body.error).toContain('Invalid CSRF token');
  });
});
