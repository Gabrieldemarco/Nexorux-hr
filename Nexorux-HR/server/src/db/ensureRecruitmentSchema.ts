import Database from 'better-sqlite3';

function tableExists(db: Database.Database, table: string): boolean {
  const row = db.prepare(
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`
  ).get(table) as { name: string } | undefined;
  return Boolean(row);
}

function columnNames(db: Database.Database, table: string): Set<string> {
  return new Set(
    (db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).map((c) => c.name)
  );
}

function ensureColumn(db: Database.Database, table: string, column: string, definition: string) {
  if (!tableExists(db, table)) return;
  const cols = columnNames(db, table);
  if (!cols.has(column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

/**
 * Aligns recruitment tables with HRService/seed for DBs created from older migrations.
 */
export function ensureRecruitmentSchema(db: Database.Database) {
  db.exec(`
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
  `);

  if (!tableExists(db, 'job_openings')) return;

  const openingCols = columnNames(db, 'job_openings');
  // Legacy 0001 schema used location/employment_type without description/requirements.
  if (!openingCols.has('description') && openingCols.has('location')) {
    db.exec(`
      CREATE TABLE job_openings_new (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        company_id TEXT,
        department_id TEXT,
        position_id TEXT,
        title TEXT NOT NULL,
        description TEXT,
        requirements TEXT,
        openings_count INTEGER NOT NULL DEFAULT 1,
        status TEXT NOT NULL DEFAULT 'OPEN',
        created_by TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
      );
      INSERT INTO job_openings_new (id, tenant_id, department_id, title, description, requirements, openings_count, status, created_at)
      SELECT id, tenant_id, department_id, title, COALESCE(location, ''), COALESCE(employment_type, ''), 1, status, created_at
      FROM job_openings;
      DROP TABLE job_openings;
      ALTER TABLE job_openings_new RENAME TO job_openings;
    `);
  } else {
    ensureColumn(db, 'job_openings', 'company_id', 'TEXT');
    ensureColumn(db, 'job_openings', 'position_id', 'TEXT');
    ensureColumn(db, 'job_openings', 'description', 'TEXT');
    ensureColumn(db, 'job_openings', 'requirements', 'TEXT');
    ensureColumn(db, 'job_openings', 'openings_count', 'INTEGER NOT NULL DEFAULT 1');
    ensureColumn(db, 'job_openings', 'created_by', 'TEXT');
  }

  if (!tableExists(db, 'candidates')) return;

  const candidateCols = columnNames(db, 'candidates');
  if (!candidateCols.has('job_opening_id') && candidateCols.has('opening_id')) {
    db.exec(`
      CREATE TABLE candidates_new (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        job_opening_id TEXT NOT NULL,
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
      INSERT INTO candidates_new (id, tenant_id, job_opening_id, first_name, last_name, email, phone, current_stage, cv_url, rating, notes, applied_date)
      SELECT id, tenant_id, opening_id, first_name, last_name, email, phone, COALESCE(stage, 'APPLIED'), resume_url, 0, notes, created_at
      FROM candidates;
      DROP TABLE candidates;
      ALTER TABLE candidates_new RENAME TO candidates;
    `);
  } else {
    ensureColumn(db, 'candidates', 'cv_url', 'TEXT');
    ensureColumn(db, 'candidates', 'rating', 'INTEGER NOT NULL DEFAULT 0');
    ensureColumn(db, 'candidates', 'applied_date', "TEXT NOT NULL DEFAULT (datetime('now'))");
    ensureColumn(db, 'candidates', 'created_by', 'TEXT');
    ensureColumn(db, 'candidates', 'hired_employee_id', 'TEXT');
    if (candidateCols.has('stage') && !candidateCols.has('current_stage')) {
      ensureColumn(db, 'candidates', 'current_stage', "TEXT NOT NULL DEFAULT 'APPLIED'");
      db.exec(`UPDATE candidates SET current_stage = COALESCE(stage, 'APPLIED') WHERE current_stage IS NULL OR current_stage = ''`);
    }
  }

  ensureColumn(db, 'candidates', 'hired_employee_id', 'TEXT');
  ensureColumn(db, 'candidates', 'created_by', 'TEXT');
  ensureColumn(db, 'job_openings', 'created_by', 'TEXT');
}
