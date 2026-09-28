import { Kysely, PostgresDialect, SqliteDialect } from 'kysely';
import { Pool } from 'pg';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import type { Database as DB } from './database.types';

let dbInstance: Kysely<DB> | null = null;

function createSqliteConnection(): Database.Database {
  const dbDir = path.resolve(__dirname, '../../data');
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  const dbPath = path.join(dbDir, 'nexorux_hr.db');
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}

function createPostgresPool(): Pool {
  return new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'nexorux_hr',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    max: parseInt(process.env.DB_POOL_MAX || '10', 10),
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });
}

export function createDatabase(): Kysely<DB> {
  if (dbInstance) return dbInstance;

  const isTest = process.env.NODE_ENV === 'test';
  const usePostgres = process.env.DB_DIALECT === 'postgres' && !isTest;

  if (usePostgres) {
    const pool = createPostgresPool();
    dbInstance = new Kysely<DB>({
      dialect: new PostgresDialect({ pool }),
      log: process.env.NODE_ENV === 'development' ? ['query', 'error'] : ['error'],
    });
  } else {
    const sqlite = createSqliteConnection();
    dbInstance = new Kysely<DB>({
      dialect: new SqliteDialect({ database: sqlite }),
      log: process.env.NODE_ENV === 'development' ? ['query', 'error'] : ['error'],
    });
  }

  return dbInstance;
}

export function getDatabase(): Kysely<DB> {
  if (!dbInstance) {
    return createDatabase();
  }
  return dbInstance;
}

export async function closeDatabase(): Promise<void> {
  if (dbInstance) {
    await dbInstance.destroy();
    dbInstance = null;
  }
}

// For tests: allow replacing the instance
export function setDatabaseInstance(instance: Kysely<DB> | null): void {
  dbInstance = instance;
}

export type { DB } from './database.types';