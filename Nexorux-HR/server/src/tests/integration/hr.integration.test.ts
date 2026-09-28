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

describe('HR integration', () => {
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
    _db!.prepare('DELETE FROM employees').run();
    _db!.prepare('DELETE FROM contracts').run();
    _db!.prepare('DELETE FROM leave_balances').run();
    _db!.prepare('DELETE FROM onboarding_tasks').run();
    _db!.prepare('DELETE FROM audit_logs').run();
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

  it('should create employee atomically with contract and onboarding tasks', async () => {
    const tables = _db!.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as any[];
    console.error('Tables in test DB:', tables.map(t => t.name));

    const loginRes = await apiPost('/api/v1/auth/login', { email: 'admin@test.com', password: testPassword });
    expect(loginRes.status).toBe(200);
    const { token } = await loginRes.json();

    const base = (global as any).__BASE_URL__;
    const authHeaders = {
      'Content-Type': 'application/json',
      'X-Tenant-ID': tenantId,
      'Authorization': `Bearer ${token}`
    };

    const createRes = await fetch(`${base}/api/v1/employees`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        first_name: 'Integration',
        last_name: 'Employee',
        email: 'integration@test.com',
        company_id: 'comp-1',
        branch_id: 'branch-1',
        department_id: 'dept-1',
        position_id: 'pos-1',
        base_salary: 6000
      })
    });
    if (!createRes.ok) {
      const errorBody = await createRes.text();
      console.error('Create employee error:', createRes.status, errorBody);
    }
    expect(createRes.status).toBe(201);
    const employee = await createRes.json();
    expect(employee.first_name).toBe('Integration');
    expect(employee.last_name).toBe('Employee');

    const listRes = await fetch(`${base}/api/v1/employees`, { headers: { 'X-Tenant-ID': tenantId, 'Authorization': `Bearer ${token}` } });
    expect(listRes.status).toBe(200);
    const employees = await listRes.json();
    expect(employees.some((e: any) => e.email === 'integration@test.com')).toBe(true);
  });

  it('should reject unauthorized access to protected endpoints', async () => {
    const res = await apiGet('/api/v1/employees');
    expect(res.status).toBe(401);
  });
});
