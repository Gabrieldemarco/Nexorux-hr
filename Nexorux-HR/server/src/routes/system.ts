import { Request, Response } from 'express';
import { db } from '../config/db';

export function systemRouter() {
  const router = require('express').Router();

  router.get('/health', (_req: Request, res: Response) => {
    res.json({
      status: 'healthy',
      product: 'NEXORUX HR',
      version: '1.0.0',
      suite: 'Nexorux Enterprise Suite (CRM, ERP, HR, IA)',
      timestamp: new Date().toISOString()
    });
  });

  router.get('/health/detailed', (_req: Request, res: Response) => {
    const checks: Record<string, { status: 'ok' | 'error'; latency?: number; error?: string }> = {};
    const start = Date.now();

    try {
      db.prepare('SELECT 1').get();
      checks.database = { status: 'ok', latency: Date.now() - start };
    } catch (err: any) {
      checks.database = { status: 'error', error: err.message, latency: Date.now() - start };
    }

    const overall = Object.values(checks).every((c) => c.status === 'ok') ? 'healthy' : 'unhealthy';
    res.status(overall === 'healthy' ? 200 : 503).json({
      status: overall,
      product: 'NEXORUX HR',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      checks
    });
  });

  router.get('/ready', (_req: Request, res: Response) => {
    const checks: Record<string, { status: 'ok' | 'error'; error?: string }> = {};

    try {
      db.prepare('SELECT 1').get();
      checks.db = { status: 'ok' };
    } catch (err: any) {
      checks.db = { status: 'error', error: err.message };
    }

    try {
      const migrations = db.prepare("SELECT COUNT(*) as c FROM schema_migrations").get() as { c: number };
      checks.migrations = migrations.c > 0 ? { status: 'ok' } : { status: 'error', error: 'No migrations applied' };
    } catch (err: any) {
      checks.migrations = { status: 'error', error: err.message };
    }

    const requiredEnv = ['JWT_SECRET', 'CSRF_SECRET'];
    const missing = requiredEnv.filter(k => !process.env[k] || process.env[k].includes('dev-only'));
    checks.env = missing.length === 0 ? { status: 'ok' } : { status: 'error', error: `Missing: ${missing.join(', ')}` };

    const ready = Object.values(checks).every(c => c.status === 'ok');
    res.status(ready ? 200 : 503).json({ ready, checks, timestamp: new Date().toISOString() });
  });

  return router;
}
