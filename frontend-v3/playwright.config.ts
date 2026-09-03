import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  timeout: 60000, // Global test timeout
  use: {
    // E2E 必须针对 debug backend（:8888，数据隔离），由 `make debug-test` 注入 BASE_URL。
    // 默认值对齐 debug 端口而非 :5173——vite dev 会把 /api 代理到 :8080 生产（铁律）。
    baseURL: process.env.BASE_URL || 'http://127.0.0.1:8888',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    actionTimeout: 30000,
    navigationTimeout: 30000,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // CDP: connect to Windows Chrome (WSL mirrored networking, port 18800)
        cdpEndpoint: process.env.CDP_ENDPOINT || undefined,
      },
    },
    {
      name: 'Mobile Chrome',
      use: {
        ...devices['Pixel 5'],
        cdpEndpoint: process.env.CDP_ENDPOINT || undefined,
        // Longer timeouts for Mobile Chrome
        actionTimeout: 45000,
        navigationTimeout: 45000,
      },
      // More retries for mobile tests
      retries: process.env.CI ? 3 : 2,
    },
  ],
  // 不配置 webServer 自启：项目纪律是 E2E 必须针对运行中的 debug backend
  // （`make debug-start` → :8888，数据隔离），由 `make debug-test` 注入 BASE_URL。
  // 自启 vite（:5173）会把 /api 代理到 :8080 生产（铁律），此处刻意留空——
  // 未起服务时 Playwright 连 :8888 失败即快速报错，而不是静默转到生产。
})
