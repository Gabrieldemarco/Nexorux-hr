import { beforeAll, afterAll, afterEach, vi } from 'vitest';
import { Kysely, SqliteDialect } from 'kysely';
import Database from 'better-sqlite3';
import type { Database as DB } from '../config/database.types';

let testDb: Kysely<DB> | null = null;
let pgContainer: any = null;

export async function setupTestDatabase(): Promise<Kysely<DB>> {
  const usePostgres = process.env.TEST_DB === 'postgres';

  if (usePostgres) {
    // Use testcontainers for PostgreSQL
    const { GenericContainer, StartedNetwork } = await import('testcontainers');

    const network = await new StartedNetwork().start();

    pgContainer = await new GenericContainer('postgres:16-alpine')
      .withEnvironment({
        POSTGRES_USER: 'test',
        POSTGRES_PASSWORD: 'test',
        POSTGRES_DB: 'nexorux_hr_test',
      })
      .withExposedPorts(5432)
      .withNetwork(network)
      .withNetworkAliases('postgres')
      .start();

    const host = pgContainer.getHost();
    const port = pgContainer.getMappedPort(5432);

    process.env.DB_HOST = host;
    process.env.DB_PORT = String(port);
    process.env.DB_NAME = 'nexorux_hr_test';
    process.env.DB_USER = 'test';
    process.env.DB_PASSWORD = 'test';
    process.env.DB_DIALECT = 'postgres';

    const { createDatabase, closeDatabase } = await import('../config/db');
    await closeDatabase(); // Close any existing
    testDb = createDatabase();

    // Run migrations
    await runMigrationsOnDb(testDb);

    return testDb;
  } else {
    // Use in-memory SQLite for fast unit tests
    const sqlite = new Database(':memory:');
    sqlite.pragma('journal_mode = WAL');
    sqlite.pragma('foreign_keys = ON');

    testDb = new Kysely<DB>({
      dialect: new SqliteDialect({ database: sqlite }),
    });

    // Run migrations
    await runMigrationsOnDb(testDb);

    return testDb;
  }
}

async function runMigrationsOnDb(db: Kysely<DB>): Promise<void> {
  const fs = await import('fs');
  const path = await import('path');

  const migrationsDir = path.resolve(__dirname, '../../migrations');

  await db.schema
    .createTable('schema_migrations')
    .ifNotExists()
    .addColumn('version', 'text', (col) => col.primaryKey())
    .addColumn('applied_at', 'text', (col) => col.notNull().defaultTo(sql`datetime('now')`))
    .execute();

  if (!fs.existsSync(migrationsDir)) return;

  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b));

  const applied = new Set(
    (await db.selectFrom('schema_migrations').select('version').execute()).map(r => r.version)
  );

  for (const file of files) {
    const version = file.replace('.sql', '');
    if (applied.has(version)) continue;

    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');

    // Convert SQLite-specific SQL to work with both dialects
    const adaptedSql = adaptSqlForDialect(sql, usePostgres);

    await db.transaction().execute(async (trx) => {
      await trx.executeQuery(adaptedSql);
      await trx.insertInto('schema_migrations').values({ version }).execute();
    });
  }
}

function adaptSqlForDialect(sql: string, isPostgres: boolean): string {
  if (!isPostgres) return sql;

  return sql
    .replace(/INTEGER PRIMARY KEY AUTOINCREMENT/g, 'SERIAL PRIMARY KEY')
    .replace(/TEXT PRIMARY KEY/g, 'UUID PRIMARY KEY')
    .replace(/INTEGER NOT NULL/g, 'INTEGER NOT NULL')
    .replace(/REAL NOT NULL/g, 'DOUBLE PRECISION NOT NULL')
    .replace(/datetime\('now'\)/g, 'NOW()')
    .replace(/date\('now'\)/g, 'CURRENT_DATE')
    .replace(/AUTOINCREMENT/g, '')
    // UUID generation for PG
    .replace(/uuid\(\)/gi, 'gen_random_uuid()')
    // JSON/JSONB
    .replace(/TEXT\s+.*_json/g, (match) => match.replace('TEXT', 'JSONB'))
    // Boolean
    .replace(/INTEGER\s+DEFAULT\s+([01])/gi, (_, val) => `BOOLEAN DEFAULT ${val === '1' ? 'TRUE' : 'FALSE'}`);
}

export function getTestDb(): Kysely<DB> {
  if (!testDb) throw new Error('Test DB not initialized. Call setupTestDatabase() first.');
  return testDb;
}

export async function teardownTestDatabase(): Promise<void> {
  if (testDb) {
    await testDb.destroy();
    testDb = null;
  }
  if (pgContainer) {
    await pgContainer.stop();
    pgContainer = null;
  }
}

// Seed minimal data for tests
export async function seedMinimalData(db: Kysely<DB>, tenantId: string): Promise<void> {
  await db.insertInto('tenants').values({
    id: tenantId,
    slug: 'test',
    legal_name: 'Test Tenant',
    country_code: 'UY',
    currency: 'USD',
    timezone: 'America/Montevideo',
    is_active: 1,
    branding_json: null,
    allowed_origins: '*',
    created_at: new Date().toISOString(),
  }).execute();

  await db.insertInto('companies').values({
    id: 'comp-1',
    tenant_id: tenantId,
    name: 'Test Company',
    tax_id: '123456789',
    country_code: 'UY',
    legal_address: 'Test Address',
    is_headquarters: 1,
    created_at: new Date().toISOString(),
  }).execute();

  await db.insertInto('branches').values({
    id: 'branch-1',
    tenant_id: tenantId,
    company_id: 'comp-1',
    name: 'Main Branch',
    city: 'Montevideo',
    address: 'Test Address',
    timezone: 'America/Montevideo',
  }).execute();

  await db.insertInto('departments').values({
    id: 'dept-1',
    tenant_id: tenantId,
    company_id: 'comp-1',
    name: 'Engineering',
    code: 'ENG',
    parent_id: null,
  }).execute();

  await db.insertInto('positions').values({
    id: 'pos-1',
    tenant_id: tenantId,
    title: 'Software Engineer',
    department_id: 'dept-1',
    level: 'MID',
    min_salary: 50000,
    max_salary: 80000,
    description: 'Software engineering position',
  }).execute();

  const bcrypt = await import('bcrypt');
  const passwordHash = await bcrypt.hash('password', 8);

  await db.insertInto('users').values({
    id: 'user-1',
    tenant_id: tenantId,
    email: 'admin@test.com',
    password_hash: passwordHash,
    first_name: 'Admin',
    last_name: 'Test',
    role: 'TENANT_OWNER',
    employee_id: null,
    status: 'ACTIVE',
    last_login_at: null,
    created_at: new Date().toISOString(),
  }).execute();
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