import { defineConfig, devices } from '@playwright/test';
import { ANON_KEY, FAKE_HOST } from './tests/e2e/support/fakeBackend';

// The tests run against a local build of the app that talks to a FAKE backend (tests/e2e/support/fakeBackend.ts),
// so they never touch the live site, the real database or any real accounts.
// Run them with:  npm run test:e2e
// To point them at some other server instead (for example a preview deployment), set BASE_URL, but note that the
// app there must also be built against the fake backend host, or the tests will fail.
const PORT = 4173;

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 45_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: process.env.BASE_URL ?? `http://localhost:${PORT}`, trace: 'on-first-retry', screenshot: 'only-on-failure' },
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: `npm run build:web && npx vite preview --port ${PORT} --strictPort`,
        url: `http://localhost:${PORT}`,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
        env: { VITE_SUPABASE_URL: `https://${FAKE_HOST}`, VITE_SUPABASE_ANON_KEY: ANON_KEY },
      },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
});
