import { defineConfig } from '@playwright/test';

/**
 * Screenshot + a11y suite. Uses the installed Chrome (no browser download) and
 * the Vite dev server; every /api call is answered from e2e/fixtures.ts.
 *   npm run screens        → docs/screens/pw/<page>-<desktop|mobile>.png + a11y-*.json
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  fullyParallel: true,
  workers: 3,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5199',
    channel: 'chrome',
    headless: true,
    trace: 'off',
  },
  webServer: {
    command: 'npx vite --port 5199 --strictPort',
    url: 'http://localhost:5199',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
