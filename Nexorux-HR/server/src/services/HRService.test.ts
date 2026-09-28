import { describe, it, expect, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';

function createTestDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  db.exec(`
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
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS branches (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      company_id TEXT NOT NULL,
      name TEXT NOT NULL,
      city TEXT NOT NULL,
      address TEXT NOT NULL,
      timezone TEXT NOT NULL,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
      FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS departments (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      company_id TEXT NOT NULL,
      name TEXT NOT NULL,
      code TEXT NOT NULL,
      parent_id TEXT,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
      FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS positions (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      title TEXT NOT NULL,
      department_id TEXT NOT NULL,
      level TEXT NOT NULL,
      min_salary REAL NOT NULL,
      max_salary REAL NOT NULL,
      description TEXT,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
      FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE RESTRICT
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
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
      FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
      FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE RESTRICT,
      FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE RESTRICT,
      FOREIGN KEY (position_id) REFERENCES positions(id) ON DELETE RESTRICT,
      UNIQUE(tenant_id, employee_code)
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
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
      UNIQUE(tenant_id, employee_id, year)
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
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
      UNIQUE(tenant_id, employee_id, date)
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
  `);
  return db;
}

let mockDb: Database.Database;

vi.mock('../config/db', () => ({
  get db() { return mockDb; }
}));

describe('HRService - createEmployee transaction', () => {
  const tenantId = 'tenant-123';
  const actorUserId = 'actor-1';

  beforeEach(() => {
    mockDb = createTestDb();
    mockDb.prepare('INSERT INTO tenants (id, slug, legal_name, country_code, currency) VALUES (?, ?, ?, ?, ?)').run(tenantId, 'test', 'Test', 'UY', 'USD');
    mockDb.prepare('INSERT INTO companies (id, tenant_id, name, tax_id, country_code, legal_address) VALUES (?, ?, ?, ?, ?, ?)').run('comp-1', tenantId, 'Test Co', '123', 'UY', 'addr');
    mockDb.prepare('INSERT INTO branches (id, tenant_id, company_id, name, city, address, timezone) VALUES (?, ?, ?, ?, ?, ?, ?)').run('branch-1', tenantId, 'comp-1', 'Branch', 'City', 'addr', 'UTC');
    mockDb.prepare('INSERT INTO departments (id, tenant_id, company_id, name, code) VALUES (?, ?, ?, ?, ?)').run('dept-1', tenantId, 'comp-1', 'Dept', 'D1');
    mockDb.prepare('INSERT INTO positions (id, tenant_id, title, department_id, level, min_salary, max_salary, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run('pos-1', tenantId, 'Pos', 'dept-1', 'MID', 1000, 2000, 'desc');
  });

  it('should create employee and related records atomically', async () => {
    const { HRService } = await import('../services/HRService');
    const employee = HRService.createEmployee(tenantId, {
      first_name: 'Test',
      last_name: 'User',
      email: 'test@example.com',
      company_id: 'comp-1',
      branch_id: 'branch-1',
      department_id: 'dept-1',
      position_id: 'pos-1',
      base_salary: 5000
    }, actorUserId, 'actor@example.com');

    const emp = mockDb.prepare('SELECT * FROM employees WHERE id = ?').get(employee.id) as any;
    expect(emp.first_name).toBe('Test');
    expect(emp.last_name).toBe('User');

    const contracts = mockDb.prepare('SELECT * FROM contracts WHERE tenant_id = ? AND employee_id = ?').all(tenantId, employee.id) as any[];
    expect(contracts).toHaveLength(1);

    const balances = mockDb.prepare('SELECT * FROM leave_balances WHERE tenant_id = ? AND employee_id = ?').all(tenantId, employee.id) as any[];
    expect(balances).toHaveLength(1);

    const tasks = mockDb.prepare('SELECT * FROM onboarding_tasks WHERE tenant_id = ? AND employee_id = ?').all(tenantId, employee.id) as any[];
    expect(tasks).toHaveLength(5);

    const audits = mockDb.prepare("SELECT * FROM audit_logs WHERE tenant_id = ? AND action = 'EMPLOYEE_CREATED'").all(tenantId) as any[];
    expect(audits).toHaveLength(1);
  });
});
