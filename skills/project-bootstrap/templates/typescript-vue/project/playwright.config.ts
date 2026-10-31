import { defineConfig, devices } from '@playwright/test';

// E2E の構成（docs/tooling/testing.md）。主要フローのハッピーパスだけを e2e/ に置く。
// test/ の *.spec.ts は Vitest が拾うので、E2E は *.e2e.ts にして混ざらないようにする。
// baseURL の外へのリクエストは e2e/fixtures.ts が止める（TEST-06）。Service Worker の通信は
// route で止められないことがあるので、Service Worker を登録させない
const port = 9000;
const isCi = process.env['CI'] != undefined;

export default defineConfig({
  testDir: 'e2e',
  testMatch: '**/*.e2e.ts',
  forbidOnly: isCi,
  reporter: isCi ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${port}`,
    trace: 'retain-on-failure',
    serviceWorkers: 'block',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // CI では毎回起動し、ローカルでは起動済みの dev サーバーを使う
  webServer: {
    command: `bun run dev --port ${port}`,
    url: `http://localhost:${port}`,
    reuseExistingServer: !isCi,
  },
});
