import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './server/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5000',
    trace: 'on-first-retry'
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ],
  webServer: {
    command: 'npm run dev:server',
    url: 'http://localhost:5000/health',
    reuseExistingServer: !process.env.CI,
    timeout: 30000
  }
});
