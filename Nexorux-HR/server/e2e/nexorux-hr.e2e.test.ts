import { test, expect } from '@playwright/test';

test.describe('Health and System Endpoints', () => {
  test('GET /health returns healthy status', async ({ request }) => {
    const response = await request.get('/health');
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.status).toBe('healthy');
    expect(body.product).toBe('NEXORUX HR');
  });

  test('GET /health/detailed returns system checks', async ({ request }) => {
    const response = await request.get('/health/detailed');
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.status).toBe('healthy');
    expect(body.checks.database.status).toBe('ok');
  });

  test('GET /api-docs serves Swagger UI', async ({ page }) => {
    await page.goto('/api-docs');
    await expect(page).toHaveTitle(/Nexorux HR API/);
  });
});

test.describe('Auth Flow', () => {
  test('POST /api/v1/auth/login with valid credentials', async ({ request }) => {
    const response = await request.post('/api/v1/auth/login', {
      data: {
        email: 'admin@nexorux.com',
        password: 'Nexorux2026!'
      },
      headers: {
        'X-Tenant-ID': 'demo'
      }
    });
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.token).toBeDefined();
    expect(body.user.email).toBe('admin@nexorux.com');
  });

  test('POST /api/v1/auth/login with missing fields returns 400', async ({ request }) => {
    const response = await request.post('/api/v1/auth/login', {
      data: {},
      headers: { 'X-Tenant-ID': 'demo' }
    });
    expect(response.status()).toBe(400);
  });
});

test.describe('Employees', () => {
  test('GET /api/v1/employees requires authentication', async ({ request }) => {
    const response = await request.get('/api/v1/employees', {
      headers: { 'X-Tenant-ID': 'demo' }
    });
    expect(response.status()).toBe(401);
  });
});
