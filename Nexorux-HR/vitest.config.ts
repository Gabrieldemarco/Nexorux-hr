import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['server/src/**/*.test.ts'],
    setupFiles: ['server/src/tests/setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['server/src/services/**/*.ts', 'server/src/middleware/**/*.ts'],
      reporter: ['text', 'json', 'html']
    }
  }
});
