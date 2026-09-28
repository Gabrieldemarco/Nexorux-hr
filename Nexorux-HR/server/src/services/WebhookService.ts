import { db } from '../config/db';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { Webhook, WebhookDelivery } from '../domain/types';
import { encrypt, decrypt, isEncrypted, setEncryptionPassword } from './EncryptionService';

setEncryptionPassword(process.env.WEBHOOK_ENCRYPTION_KEY || process.env.JWT_SECRET);

function validateWebhookUrl(url: string): void {
  let parsedUrl: URL;
  try { parsedUrl = new URL(url); } catch {
    throw new Error('La URL del webhook no es válida');
  }
  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    throw new Error('El webhook debe usar HTTP o HTTPS');
  }
}

export class WebhookService {
  public static createWebhook(tenantId: string, data: {
    name: string;
    url: string;
    secret: string;
    events: string[];
    max_retries?: number;
    retry_backoff_base?: number;
  }) {
    validateWebhookUrl(data.url);
    const id = uuidv4();
    const encryptedSecret = encrypt(data.secret);
    db.prepare(`
      INSERT INTO webhooks (id, tenant_id, name, url, secret, events, max_retries, retry_backoff_base)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      tenantId,
      data.name,
      data.url,
      encryptedSecret,
      JSON.stringify(data.events || []),
      data.max_retries || 5,
      data.retry_backoff_base || 1000
    );
    return db.prepare('SELECT * FROM webhooks WHERE id = ? AND tenant_id = ?').get(id, tenantId) as Webhook;
  }

  public static getWebhooks(tenantId: string) {
    return db.prepare('SELECT * FROM webhooks WHERE tenant_id = ? ORDER BY created_at DESC').all(tenantId) as Webhook[];
  }

  public static getWebhookById(tenantId: string, id: string) {
    const webhook = db.prepare('SELECT * FROM webhooks WHERE id = ? AND tenant_id = ?').get(id, tenantId) as Webhook | undefined;
    if (!webhook) return undefined;
    if (isEncrypted(webhook.secret)) {
      return { ...webhook, secret: decrypt(webhook.secret) };
    }
    return webhook;
  }

  public static updateWebhook(tenantId: string, id: string, data: {
    name?: string;
    url?: string;
    secret?: string;
    events?: string[];
    is_active?: number;
    max_retries?: number;
    retry_backoff_base?: number;
  }) {
    const existing = db.prepare('SELECT * FROM webhooks WHERE id = ? AND tenant_id = ?').get(id, tenantId) as Webhook | undefined;
    if (!existing) return undefined;

    if (data.url !== undefined) {
      validateWebhookUrl(data.url);
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (data.name !== undefined) { updates.push('name = ?'); values.push(data.name); }
    if (data.url !== undefined) { updates.push('url = ?'); values.push(data.url); }
    if (data.secret !== undefined) { updates.push('secret = ?'); values.push(encrypt(data.secret)); }
    if (data.events !== undefined) { updates.push('events = ?'); values.push(JSON.stringify(data.events)); }
    if (data.is_active !== undefined) { updates.push('is_active = ?'); values.push(data.is_active); }
    if (data.max_retries !== undefined) { updates.push('max_retries = ?'); values.push(data.max_retries); }
    if (data.retry_backoff_base !== undefined) { updates.push('retry_backoff_base = ?'); values.push(data.retry_backoff_base); }

    updates.push('updated_at = datetime(\'now\')');
    values.push(id, tenantId);

    db.prepare(`UPDATE webhooks SET ${updates.join(', ')} WHERE id = ? AND tenant_id = ?`).run(...values);

    if (data.is_active !== undefined && data.is_active === 0) {
      db.prepare(`
        UPDATE webhook_deliveries SET status = 'DISABLED', updated_at = datetime('now')
        WHERE webhook_id = ? AND status = 'PENDING'
      `).run(id);
    }

    return db.prepare('SELECT * FROM webhooks WHERE id = ? AND tenant_id = ?').get(id, tenantId) as Webhook;
  }

  public static deleteWebhook(tenantId: string, id: string) {
    db.prepare('UPDATE webhook_deliveries SET status = \'DISABLED\', updated_at = datetime(\'now\') WHERE webhook_id = ? AND status = \'PENDING\'').run(id);
    const result = db.prepare('DELETE FROM webhooks WHERE id = ? AND tenant_id = ?').run(id, tenantId);
    return result.changes > 0;
  }

  public static getDeliveries(tenantId: string, webhookId?: string, limit = 50, offset = 0) {
    let query = 'SELECT * FROM webhook_deliveries WHERE tenant_id = ?';
    const params: any[] = [tenantId];
    if (webhookId) {
      query += ' AND webhook_id = ?';
      params.push(webhookId);
    }
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(Math.min(limit, 100), offset);
    return db.prepare(query).all(...params) as WebhookDelivery[];
  }

  public static matchesEvent(webhook: Webhook, eventType: string): boolean {
    try {
      const events = JSON.parse(webhook.events || '[]') as string[];
      if (events.includes('*')) return true;
      return events.includes(eventType);
    } catch {
      return false;
    }
  }

  public static async deliverEvent(tenantId: string, eventType: string, payload: Record<string, any>) {
    const webhooks = db.prepare('SELECT * FROM webhooks WHERE tenant_id = ? AND is_active = 1').all(tenantId) as Webhook[];
    const matching = webhooks.filter(w => this.matchesEvent(w, eventType));

    for (const webhook of matching) {
      const deliveryId = uuidv4();
      const payloadJson = JSON.stringify({
        id: deliveryId,
        event: eventType,
        tenantId,
        timestamp: new Date().toISOString(),
        data: payload
      });

      db.prepare(`
        INSERT INTO webhook_deliveries (id, webhook_id, tenant_id, event_type, payload_json, status, attempt_count, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 'PROCESSING', 0, datetime('now'), datetime('now'))
      `).run(deliveryId, webhook.id, tenantId, eventType, payloadJson);

      const webhookForDelivery = { ...webhook, secret: isEncrypted(webhook.secret) ? decrypt(webhook.secret) : webhook.secret };
      this.attemptDelivery(deliveryId, webhookForDelivery);
    }
  }

  private static async attemptDelivery(deliveryId: string, webhook: Webhook) {
    const delivery = db.prepare('SELECT * FROM webhook_deliveries WHERE id = ?').get(deliveryId) as WebhookDelivery | undefined;
    if (!delivery) return;

    const payload = JSON.parse(delivery.payload_json || '{}');
    const body = JSON.stringify(payload);
    const signature = crypto.createHmac('sha256', webhook.secret).update(body).digest('hex');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Nexorux-Signature': `sha256=${signature}`,
          'X-Nexorux-Event': delivery.event_type,
          'X-Nexorux-Delivery': deliveryId,
          'User-Agent': 'Nexorux-HR-Webhook/1.0'
        },
        body,
        signal: controller.signal
      });

      clearTimeout(timeout);
      const responseText = await response.text();

      if (response.ok) {
        db.prepare(`
          UPDATE webhook_deliveries SET status = 'SUCCESS', http_status = ?, response_body = ?, updated_at = datetime('now')
          WHERE id = ? AND status = 'PROCESSING'
        `).run(response.status, responseText.slice(0, 5000), deliveryId);
      } else {
        this.scheduleRetry(deliveryId, webhook, `HTTP ${response.status}: ${responseText.slice(0, 500)}`);
      }
    } catch (error: any) {
      clearTimeout(timeout);
      const message = error.name === 'AbortError' ? 'Request timeout after 8s' : (error.message || 'Unknown network error');
      this.scheduleRetry(deliveryId, webhook, message);
    }
  }

  private static scheduleRetry(deliveryId: string, webhook: Webhook, errorMessage: string) {
    const delivery = db.prepare('SELECT * FROM webhook_deliveries WHERE id = ?').get(deliveryId) as WebhookDelivery | undefined;
    if (!delivery) return;

    const attemptCount = delivery.attempt_count + 1;
    const maxRetries = webhook.max_retries || 5;
    const backoffBase = webhook.retry_backoff_base || 1000;

    if (attemptCount >= maxRetries) {
      db.prepare(`
        UPDATE webhook_deliveries SET status = 'FAILED', attempt_count = ?, last_error = ?, updated_at = datetime('now')
        WHERE id = ? AND status = 'PROCESSING'
      `).run(attemptCount, errorMessage.slice(0, 1000), deliveryId);
      return;
    }

    const jitter = Math.floor(Math.random() * 500);
    const backoffMs = backoffBase * Math.pow(2, attemptCount - 1) + jitter;
    const nextAttempt = new Date(Date.now() + backoffMs).toISOString();

    db.prepare(`
      UPDATE webhook_deliveries SET status = 'PENDING', attempt_count = ?, last_error = ?, next_attempt_at = ?, updated_at = datetime('now')
      WHERE id = ? AND status = 'PROCESSING'
    `).run(attemptCount, errorMessage.slice(0, 1000), nextAttempt, deliveryId);
  }

  public static processPendingDeliveries() {
    const now = new Date().toISOString();
    const pending = db.prepare(`
      SELECT d.*, w.url, w.secret, w.events, w.max_retries, w.retry_backoff_base, w.is_active
      FROM webhook_deliveries d
      JOIN webhooks w ON w.id = d.webhook_id
      WHERE w.is_active = 1
        AND d.status = 'PENDING'
        AND d.next_attempt_at <= ?
        AND d.attempt_count < (w.max_retries)
    `).all(now) as (WebhookDelivery & { url: string; secret: string; events: string; max_retries: number; retry_backoff_base: number; is_active: number })[];

    for (const row of pending) {
      const webhookForMatch = { id: row.webhook_id, events: row.events } as Webhook;
      if (!this.matchesEvent(webhookForMatch, row.event_type)) {
        db.prepare(`
          UPDATE webhook_deliveries SET status = 'DISABLED', updated_at = datetime('now')
          WHERE id = ?
        `).run(row.id);
        continue;
      }

      const claim = db.prepare(`
        UPDATE webhook_deliveries SET status = 'PROCESSING', updated_at = datetime('now')
        WHERE id = ? AND status = 'PENDING'
      `).run(row.id);
      if (!claim.changes) continue;

      const secret = isEncrypted(row.secret) ? decrypt(row.secret) : row.secret;
      const webhook: Webhook = {
        id: row.webhook_id,
        tenant_id: row.tenant_id,
        name: '',
        url: row.url,
        secret,
        events: row.events,
        is_active: row.is_active,
        max_retries: row.max_retries,
        retry_backoff_base: row.retry_backoff_base,
        created_at: row.created_at,
        updated_at: row.updated_at
      };

      this.attemptDelivery(row.id, webhook);
    }
  }
}
