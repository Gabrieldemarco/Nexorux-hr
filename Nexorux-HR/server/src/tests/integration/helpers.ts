import { vi } from 'vitest';
import { Kysely, SqliteDialect } from 'kysely';
import Database from 'better-sqlite3';
import type { Database as DB } from '../../config/database.types';

let _db: Kysely<DB> | null = null;

/**
 * Creates a test database using Kysely with SQLite in-memory
 * This maintains compatibility with existing integration tests
 */
export function createTestDb(): Kysely<DB> {
  const sqlite = new Database(':memory:');
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');

  const db = new Kysely<DB>({
    dialect: new SqliteDialect({ database: sqlite }),
  });

  // Run schema creation (adapted from old helpers.ts)
  db.executeQuery(`
    CREATE TABLE IF NOT EXISTS tenants (
      id TEXT PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      legal_name TEXT NOT NULL,
      country_code TEXT NOT NULL,
      currency TEXT NOT NULL,
      timezone TEXT NOT NULL DEFAULT 'America/Montevideo',
      is_active INTEGER NOT NULL DEFAULT 1,
      branding_json TEXT,
      allowed_origins TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS companies (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      name TEXT NOT NULL,
      tax_id TEXT NOT NULL,
      country_code TEXT NOT NULL,
      legal_address TEXT NOT NULL,
      is_headquarters INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS branches (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      company_id TEXT NOT NULL,
      name TEXT NOT NULL,
      city TEXT NOT NULL,
      address TEXT NOT NULL,
      timezone TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS departments (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      company_id TEXT NOT NULL,
      name TEXT NOT NULL,
      code TEXT NOT NULL,
      parent_id TEXT
    );
    CREATE TABLE IF NOT EXISTS positions (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      title TEXT NOT NULL,
      department_id TEXT NOT NULL,
      level TEXT NOT NULL,
      min_salary REAL NOT NULL,
      max_salary REAL NOT NULL,
      description TEXT
    );
    CREATE TABLE IF NOT EXISTS employees (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      company_id TEXT NOT NULL,
      branch_id TEXT NOT NULL,
      department_id TEXT NOT NULL,
      position_id TEXT NOT NULL,
      manager_id TEXT,
      employee_code TEXT NOT NULL,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL,
      gender TEXT NOT NULL,
      birth_date TEXT NOT NULL,
      national_id TEXT NOT NULL,
      tax_id TEXT NOT NULL,
      hire_date TEXT NOT NULL,
      employment_status TEXT NOT NULL DEFAULT 'ACTIVE',
      contract_type TEXT NOT NULL DEFAULT 'INDEFINITE',
      base_salary REAL NOT NULL,
      currency TEXT NOT NULL,
      photo_url TEXT,
      emergency_contact_json TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS contracts (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      employee_id TEXT NOT NULL,
      contract_number TEXT NOT NULL,
      type TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT,
      probation_end_date TEXT,
      base_salary REAL NOT NULL,
      currency TEXT NOT NULL,
      work_hours_per_week REAL NOT NULL DEFAULT 40,
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS leave_requests (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      employee_id TEXT NOT NULL,
      leave_type TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      days_count INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING',
      reason TEXT,
      approver_id TEXT,
      rejection_reason TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS compensation_merit_cycles (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      employee_id TEXT NOT NULL,
      proposed_salary REAL NOT NULL,
      merit_score REAL,
      performance_rating TEXT,
      effective_date TEXT NOT NULL,
      status TEXT DEFAULT 'DRAFT',
      notes TEXT,
      created_by TEXT,
      approved_by TEXT,
      approved_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS equity_grants (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      employee_id TEXT NOT NULL,
      grant_type TEXT NOT NULL,
      shares INTEGER NOT NULL,
      strike_price REAL,
      vesting_years INTEGER NOT NULL,
      cliff_months INTEGER DEFAULT 12,
      status TEXT DEFAULT 'ACTIVE',
      notes TEXT,
      created_by TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS payroll_runs (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      company_id TEXT NOT NULL,
      period_name TEXT NOT NULL,
      period_type TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      country_code TEXT NOT NULL,
      total_gross REAL NOT NULL,
      total_deductions REAL NOT NULL,
      total_net REAL NOT NULL,
      total_employer_contributions REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'DRAFT',
      processed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS payroll_slips (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      payroll_run_id TEXT NOT NULL,
      employee_id TEXT NOT NULL,
      base_salary REAL NOT NULL,
      gross_earnings REAL NOT NULL,
      statutory_bonus REAL NOT NULL,
      overtime_pay REAL NOT NULL,
      deductions REAL NOT NULL,
      net_pay REAL NOT NULL,
      employer_taxes REAL NOT NULL,
      breakdown_json TEXT NOT NULL,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
      FOREIGN KEY (payroll_run_id) REFERENCES payroll_runs(id) ON DELETE CASCADE,
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS job_openings (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      requirements TEXT,
      openings_count INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'OPEN',
      company_id TEXT,
      department_id TEXT,
      position_id TEXT,
      created_by TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS candidates (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      job_opening_id TEXT,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT,
      current_stage TEXT NOT NULL DEFAULT 'APPLIED',
      cv_url TEXT,
      rating INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      applied_date TEXT NOT NULL DEFAULT (datetime('now')),
      created_by TEXT,
      hired_employee_id TEXT,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
      FOREIGN KEY (job_opening_id) REFERENCES job_openings(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS recruitment_costs (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      job_opening_id TEXT,
      category TEXT NOT NULL,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      hired_count INTEGER NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'USD',
      incurred_at TEXT NOT NULL DEFAULT (date('now')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
      FOREIGN KEY (job_opening_id) REFERENCES job_openings(id) ON DELETE SET NULL
    );
    CREATE TABLE IF NOT EXISTS notification_preferences (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      event_key TEXT NOT NULL,
      email INTEGER NOT NULL DEFAULT 1,
      slack INTEGER NOT NULL DEFAULT 0,
      push INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
      UNIQUE(tenant_id, event_key)
    );
    CREATE TABLE IF NOT EXISTS api_integrations (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      provider TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'DISCONNECTED',
      config_json TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
      UNIQUE(tenant_id, provider)
    );
    CREATE TABLE IF NOT EXISTS leave_balances (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      employee_id TEXT NOT NULL,
      year INTEGER NOT NULL,
      allocated_days INTEGER NOT NULL,
      used_days INTEGER NOT NULL DEFAULT 0,
      pending_days INTEGER NOT NULL DEFAULT 0,
      remaining_days INTEGER NOT NULL,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS onboarding_tasks (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      employee_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      category TEXT NOT NULL,
      due_date TEXT NOT NULL,
      is_completed INTEGER NOT NULL DEFAULT 0,
      completed_at TEXT,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS salary_histories (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      employee_id TEXT NOT NULL,
      effective_date TEXT NOT NULL,
      previous_salary REAL NOT NULL,
      new_salary REAL NOT NULL,
      currency TEXT NOT NULL,
      reason TEXT NOT NULL,
      approved_by_user_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS employee_documents (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      employee_id TEXT NOT NULL,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      file_url TEXT NOT NULL,
      file_size_bytes INTEGER NOT NULL,
      mime_type TEXT NOT NULL,
      expiry_date TEXT,
      is_confidential INTEGER NOT NULL DEFAULT 0,
      uploaded_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS attendances (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      employee_id TEXT NOT NULL,
      date TEXT NOT NULL,
      clock_in TEXT,
      clock_out TEXT,
      break_minutes INTEGER NOT NULL DEFAULT 0,
      regular_hours REAL NOT NULL DEFAULT 0,
      overtime_hours REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'PRESENT',
      notes TEXT,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      user_email TEXT,
      action TEXT NOT NULL,
      resource_type TEXT NOT NULL,
      resource_id TEXT NOT NULL,
      details_json TEXT NOT NULL,
      ip_address TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS webhooks (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      secret TEXT NOT NULL,
      events TEXT NOT NULL DEFAULT '[]',
      is_active INTEGER NOT NULL DEFAULT 1,
      max_retries INTEGER NOT NULL DEFAULT 5,
      retry_backoff_base INTEGER NOT NULL DEFAULT 1000,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS webhook_deliveries (
      id TEXT PRIMARY KEY,
      webhook_id TEXT NOT NULL,
      tenant_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING',
      http_status INTEGER,
      response_body TEXT,
      attempt_count INTEGER NOT NULL DEFAULT 0,
      next_attempt_at TEXT,
      last_error TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      email TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      role TEXT NOT NULL,
      employee_id TEXT,
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      last_login_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
      UNIQUE(tenant_id, email)
    );
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      used_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS tenant_api_keys (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      name TEXT NOT NULL,
      key_hash TEXT NOT NULL,
      key_prefix TEXT NOT NULL,
      revoked_at TEXT,
      last_used_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS cv_analyses (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      job_opening_id TEXT NOT NULL,
      candidate_id TEXT,
      candidate_name TEXT NOT NULL,
      candidate_email TEXT NOT NULL,
      match_score REAL NOT NULL,
      classification TEXT NOT NULL,
      strengths_json TEXT NOT NULL,
      gaps_json TEXT NOT NULL,
      missing_requirements_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  return db;
}

export function seedMinimalData(db: Kysely<DB>, tenantId: string): void {
  db.insertInto('tenants').values({
    id: tenantId,
    slug: 'test',
    legal_name: 'Test',
    country_code: 'UY',
    currency: 'USD',
    timezone: 'America/Montevideo',
    is_active: 1,
    branding_json: null,
    allowed_origins: '*',
    created_at: new Date().toISOString(),
  }).executeSync();

  db.insertInto('companies').values({
    id: 'comp-1',
    tenant_id: tenantId,
    name: 'Test Co',
    tax_id: '123',
    country_code: 'UY',
    legal_address: 'addr',
    is_headquarters: 1,
    created_at: new Date().toISOString(),
  }).executeSync();

  db.insertInto('branches').values({
    id: 'branch-1',
    tenant_id: tenantId,
    company_id: 'comp-1',
    name: 'Branch',
    city: 'City',
    address: 'addr',
    timezone: 'UTC',
  }).executeSync();

  db.insertInto('departments').values({
    id: 'dept-1',
    tenant_id: tenantId,
    company_id: 'comp-1',
    name: 'Dept',
    code: 'D1',
    parent_id: null,
  }).executeSync();

  db.insertInto('positions').values({
    id: 'pos-1',
    tenant_id: tenantId,
    title: 'Pos',
    department_id: 'dept-1',
    level: 'MID',
    min_salary: 1000,
    max_salary: 2000,
    description: 'desc',
  }).executeSync();

  db.insertInto('users').values({
    id: 'user-1',
    tenant_id: tenantId,
    email: 'admin@test.com',
    password_hash: 'hash',
    first_name: 'Admin',
    last_name: 'Test',
    role: 'TENANT_OWNER',
    employee_id: null,
    status: 'ACTIVE',
    last_login_at: null,
    created_at: new Date().toISOString(),
  }).executeSync();
}

// Compatibility: sync execute for tests
declare module 'kysely' {
  interface Kysely<DB> {
    executeSync<T = any>(this: Kysely<DB>, query: string): T;
  }
}

// Add executeSync helper to Kysely instance
function addExecuteSync(db: Kysely<DB>): Kysely<DB> {
  (db as any).executeSync = function<T = any>(query: string): T {
    return this.executeQuery(query) as any;
  };
  return db;
}

let _wrappedDb: Kysely<DB> | null = null;

export function getTestDbInstance(): Kysely<DB> {
  if (!_wrappedDb) {
    _wrappedDb = addExecuteSync(createTestDb());
  }
  return _wrappedDb;
}

export function setTestDb(db: Kysely<DB>): void {
  _wrappedDb = addExecuteSync(db);
}

export function clearTestDb(): void {
  if (_wrappedDb) {
    _wrappedDb.destroy();
    _wrappedDb = null;
  }
}

// Mock pdf-parse for tests
vi.mock('pdf-parse', () => {
  const mockFn = vi.fn().mockResolvedValue({
    text: 'Mock PDF content for testing',
    numpages: 1,
    info: {},
    metadata: {},
    version: '1.0',
  });
  return { default: mockFn, __esModule: true };
});

// Suppress EncryptionService warnings
const originalWarn = console.warn;
console.warn = (...args: unknown[]) => {
  if (args[0]?.includes?.('EncryptionService: no encryption key')) return;
  originalWarn.apply(console, args);
};

declare global {
  var __BASE_URL__: string;
}