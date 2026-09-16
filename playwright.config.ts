import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  retries: 1,
  reporter: [['json', { outputFile: 'certification/reports/e2e.json' }], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry'
  },
  webServer: {
    command: 'npm run build && npm run dev',
    port: 3000,
    reuseExistingServer: !process.env.CI
  }
});
