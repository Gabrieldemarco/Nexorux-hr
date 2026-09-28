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

CREATE INDEX IF NOT EXISTS idx_merit_cycles_tenant ON compensation_merit_cycles(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_equity_grants_tenant ON equity_grants(tenant_id, status);
