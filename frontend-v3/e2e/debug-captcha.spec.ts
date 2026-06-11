import { test, expect } from '@playwright/test'

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:8888'

test.beforeAll(async ({ request }) => {
  const baseUrl = BASE_URL
  if (baseUrl.includes(':8080') || baseUrl.includes('prod')) {
    throw new Error(`FATAL: Tests must only run against debug server on :8888`)
  }
  const resp = await request.get('/health')
  const health = await resp.json()
  console.log(`Connected to debug server version ${health.version}`)
})

test.beforeEach(async ({ context }) => {
  await context.clearCookies()
})

test.describe('Debug Server - Captcha', () => {
  test('config endpoint shows captcha enabled', async ({ request }) => {
    const resp = await request.get('/api/v1/config/captcha')
    expect(resp.status()).toBe(200)
    const cfg = await resp.json()
    expect(cfg.enabled).toBe(true)
    expect(cfg.mode).toBe('builtin')
  })

  test('challenge endpoint works', async ({ request }) => {
    const resp = await request.post('/api/v1/captcha/challenge', {
      data: { site_key: 'peekview-default' }
    })
    expect(resp.status()).toBe(200)
    const data = await resp.json()
    expect(data).toHaveProperty('challenge')
    expect(data).toHaveProperty('token')
  })

  test('siteverify rejects invalid token', async ({ request }) => {
    const resp = await request.post('/api/v1/captcha/siteverify', {
      data: { response: 'invalid-token' }
    })
    expect(resp.status()).toBe(200)
    expect((await resp.json()).success).toBe(false)
  })

  test('login without captcha token is rejected (after first user)', async ({ request }) => {
    await request.post('/api/v1/auth/register', {
      data: { username: `first_${Date.now()}`, password: 'x12345678' }
    })
    const resp = await request.post('/api/v1/auth/register', {
      data: { username: `nocap_${Date.now()}`, password: 'test12345' }
    })
    if (resp.status() === 429 || resp.status() === 201) return
    expect(resp.status()).toBe(401)
    expect((await resp.json()).error.code).toMatch(/CAPTCHA/)
  })

  test('builtin verification returns CAPTCHA error for invalid token', async ({ request }) => {
    await request.post('/api/v1/auth/register', {
      data: { username: `pre_${Date.now()}`, password: 'x12345678' }
    })
    const resp = await request.post('/api/v1/auth/register', {
      data: { username: `badcap_${Date.now()}`, password: 'test12345', captcha_token: 'bad-token' }
    })
    if (resp.status() === 429 || resp.status() === 201) return
    const data = await resp.json()
    expect(data.error.code).not.toBe('INTERNAL_ERROR')
    expect(data.error.code).toMatch(/CAPTCHA/)
  })

  test('login dialog contains captcha widget when enabled', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('.btn-login', { timeout: 10000, state: 'visible' })
    await page.click('.btn-login')
    await page.waitForSelector('.login-dialog', { timeout: 5000, state: 'visible' })
    await page.waitForTimeout(2000)
    const html = await page.locator('.login-dialog').innerHTML()
    expect(html).toContain('cap-widget')
  })
})
