import { defineConfig, devices } from '@playwright/test';

/**
 * E2E — TRD 12절: 온보딩·문자입력·최적화 3개 시나리오.
 * 각 테스트는 독립 브라우저 컨텍스트(빈 IndexedDB)에서 시작한다.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3300',
    trace: 'on-first-retry',
    locale: 'ko-KR',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev -- -p 3300',
    url: 'http://localhost:3300',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
