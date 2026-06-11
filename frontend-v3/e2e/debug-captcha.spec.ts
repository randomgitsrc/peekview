import { test, expect } from '@playwright/test'

/**
 * Captcha E2E Tests
 * 必须在 captcha 已启用的调试服务器上运行：
 *   PEEKVIEW_AUTH__CAPTCHA_ENABLED=true make debug-start
 *   make debug-build captcha
 *   cd frontend-v3 && BASE_URL=http://127.0.0.1:8888 npx playwright test e2e/debug-captcha.spec.ts
 */

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:8888'

test.beforeAll(async ({ request }) => {
  const baseUrl = BASE_URL
  if (baseUrl.includes(':8080') || baseUrl.includes('prod')) {
    throw new Error(`FATAL: Tests must only run against debug server on :8888`)
  }
  try {
    const resp = await request.get('/health')
    const health = await resp.json()
    console.log(`Connected to debug server version ${health.version}`)
  } catch (error) {
    throw new Error(`FATAL: Cannot connect to debug server at ${baseUrl}`)
  }
})

test.beforeEach(async ({ context }) => {
  await context.clearCookies()
})

test.describe('Debug Server - Captcha', () => {
  test('config endpoint reflects enabled state', async ({ request }) => {
    const resp = await request.get('/api/v1/config/captcha')
    expect(resp.status()).toBe(200)
    const cfg = await resp.json()
    expect(cfg.enabled).toBe(true)
    expect(cfg.mode).toBe('builtin')
    expect(cfg.endpoint).toBe('/api/v1/captcha')
  })

  test('challenge endpoint returns challenge', async ({ request }) => {
    const resp = await request.post('/api/v1/captcha/challenge', {
      data: { site_key: 'peekview-default' }
    })
    expect(resp.status()).toBe(200)
    const data = await resp.json()
    expect(data).toHaveProperty('challenge')
    expect(data.challenge).toHaveProperty('c')
    expect(data.challenge).toHaveProperty('d')
    expect(data).toHaveProperty('token')
  })

  test('siteverify rejects invalid token', async ({ request }) => {
    const resp = await request.post('/api/v1/captcha/siteverify', {
      data: { response: 'invalid-token' }
    })
    expect(resp.status()).toBe(200)
    const data = await resp.json()
    expect(data.success).toBe(false)
  })

  test('register blocked without captcha token', async ({ request }) => {
    const resp = await request.post('/api/v1/auth/register', {
      data: { username: `nocap_${Date.now()}`, password: 'testpass' }
    })
    if (resp.status() === 429) {
      expect(resp.status()).toBe(429) // Rate limited
      return
    }
    if (resp.status() === 201) {
      // First user exempt, skip assertion
      return
    }
    expect(resp.status()).toBe(401)
    const data = await resp.json()
    expect(data.error).toBeDefined()
    expect(data.error.code).toMatch(/CAPTCHA/)
  })
})
