import { describe, it, expect, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';

function createTestDb(): Database.Database {
  const db = new Database(':memory:');
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
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
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
  `);
  return db;
}

let mockDb: Database.Database;

vi.mock('../config/db', () => ({
  get db() { return mockDb; }
}));

describe('WebhookService', () => {
  const tenantId = 'tenant-123';

  beforeEach(() => {
    mockDb = createTestDb();
    mockDb.prepare('INSERT INTO tenants (id, slug, legal_name, country_code, currency) VALUES (?, ?, ?, ?, ?)').run(tenantId, 'test', 'Test', 'UY', 'USD');
  });

  it('should create a webhook with encrypted secret', async () => {
    const { WebhookService } = await import('../services/WebhookService');
    const webhook = WebhookService.createWebhook(tenantId, {
      name: 'Test Hook',
      url: 'https://example.com/webhook',
      secret: 'my-secret',
      events: ['EMPLOYEE_CREATED']
    });
    expect(webhook.name).toBe('Test Hook');
    expect(webhook.url).toBe('https://example.com/webhook');
    expect(webhook.secret).not.toBe('my-secret');
    expect(JSON.parse(webhook.events)).toEqual(['EMPLOYEE_CREATED']);
  });

  it('should reject invalid webhook URLs', async () => {
    const { WebhookService } = await import('../services/WebhookService');
    expect(() => WebhookService.createWebhook(tenantId, {
      name: 'Bad Hook',
      url: 'ftp://invalid',
      secret: 'secret',
      events: []
    })).toThrow('El webhook debe usar HTTP o HTTPS');
  });

  it('should list webhooks by tenant', async () => {
    const { WebhookService } = await import('../services/WebhookService');
    WebhookService.createWebhook(tenantId, {
      name: 'Hook 1',
      url: 'https://example.com/hook1',
      secret: 'secret1',
      events: ['*']
    });
    WebhookService.createWebhook(tenantId, {
      name: 'Hook 2',
      url: 'https://example.com/hook2',
      secret: 'secret2',
      events: ['EMPLOYEE_CREATED']
    });
    const hooks = WebhookService.getWebhooks(tenantId);
    expect(hooks).toHaveLength(2);
  });

  it('should decrypt secret on getWebhookById', async () => {
    const { WebhookService } = await import('../services/WebhookService');
    const created = WebhookService.createWebhook(tenantId, {
      name: 'Secret Hook',
      url: 'https://example.com/secret',
      secret: 'plain-secret',
      events: ['*']
    });
    const fetched = WebhookService.getWebhookById(tenantId, created.id);
    expect(fetched?.secret).toBe('plain-secret');
  });

  it('should match events including wildcard', async () => {
    const { WebhookService } = await import('../services/WebhookService');
    const webhook = WebhookService.createWebhook(tenantId, {
      name: 'Wildcard',
      url: 'https://example.com/wild',
      secret: 's',
      events: ['*']
    });
    expect(WebhookService.matchesEvent(webhook, 'ANY_EVENT')).toBe(true);
    expect(WebhookService.matchesEvent(webhook, 'OTHER_EVENT')).toBe(true);
  });

  it('should match specific events', async () => {
    const { WebhookService } = await import('../services/WebhookService');
    const webhook = WebhookService.createWebhook(tenantId, {
      name: 'Specific',
      url: 'https://example.com/specific',
      secret: 's',
      events: ['EMPLOYEE_CREATED', 'EMPLOYEE_UPDATED']
    });
    expect(WebhookService.matchesEvent(webhook, 'EMPLOYEE_CREATED')).toBe(true);
    expect(WebhookService.matchesEvent(webhook, 'EMPLOYEE_DELETED')).toBe(false);
  });

  it('should update webhook and disable pending deliveries', async () => {
    const { WebhookService } = await import('../services/WebhookService');
    const created = WebhookService.createWebhook(tenantId, {
      name: 'To Disable',
      url: 'https://example.com/disable',
      secret: 's',
      events: ['*']
    });
    const deliveryId = 'delivery-1';
    mockDb.prepare(`INSERT INTO webhook_deliveries (id, webhook_id, tenant_id, event_type, payload_json, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'PENDING', datetime('now'), datetime('now'))`).run(deliveryId, created.id, tenantId, 'TEST', '{}');
    const updated = WebhookService.updateWebhook(tenantId, created.id, { is_active: 0 });
    expect(updated?.is_active).toBe(0);
    const delivery = mockDb.prepare('SELECT * FROM webhook_deliveries WHERE id = ?').get(deliveryId) as any;
    expect(delivery.status).toBe('DISABLED');
  });
});
