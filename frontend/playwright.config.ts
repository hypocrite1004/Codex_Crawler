import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    headless: true,
  },
  outputDir: '../output/playwright/test-results',
  globalSetup: './tests/e2e/global.setup.ts',
  webServer: [
    {
      command: 'cmd /c "..\\venv\\Scripts\\python.exe manage.py runserver 127.0.0.1:8000"',
      cwd: '../backend',
      url: 'http://127.0.0.1:8000/api/categories/',
      reuseExistingServer: true,
      timeout: 120_000,
    },
    {
      command: 'cmd /c "set NEXT_PUBLIC_API_URL=http://127.0.0.1:8000/api && npm run dev -- --hostname 127.0.0.1 --port 3000"',
      cwd: '.',
      url: 'http://127.0.0.1:3000',
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
