import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  retries: process.env['CI'] ? 1 : 0,
  use: {
    baseURL: 'http://localhost:4174',
    viewport: { width: 1280, height: 900 },
    launchOptions: process.env['PLAYWRIGHT_CHROMIUM_PATH']
      ? { executablePath: process.env['PLAYWRIGHT_CHROMIUM_PATH'] }
      : {},
  },
  webServer: {
    command: 'pnpm exec vite build && pnpm exec vite preview --port 4174 --strictPort',
    url: 'http://localhost:4174',
    reuseExistingServer: !process.env['CI'],
    timeout: 180_000,
  },
});
