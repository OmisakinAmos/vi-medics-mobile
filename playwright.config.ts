import { defineConfig, devices } from '@playwright/test';

// Run against production by default; override with BASE_URL=http://localhost:5173 for local runs.
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  retries: 1,
  use: { baseURL: process.env.BASE_URL ?? 'https://vi-medics.vercel.app', trace: 'on-first-retry' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
});
