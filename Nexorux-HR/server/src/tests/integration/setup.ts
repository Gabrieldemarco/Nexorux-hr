import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import express from 'express';
import cors from 'cors';
import { createTestDb, seedMinimalData, setupTestDb, teardownTestDb } from './helpers';
import { initDatabase } from '../../config/db';

let db: ReturnType<typeof createTestDb>;
let app: express.Express;

function setupApp() {
  db = setupTestDb();
  const tenantId = 'tenant-123';
  seedMinimalData(db, tenantId);

  vi.mock('../../config/db', () => ({
    get db() { return db; }
  }));

  const apiRouter = require('../../routes/api').apiRouter;
  app = express();
  app.use(cors({ origin: '*' }));
  app.use(express.json({ limit: '15mb' }));
  app.use((req: any, _res, next) => {
    req.tenantId = tenantId;
    next();
  });
  app.use('/api/v1', apiRouter);
}

export { setupApp, db };
