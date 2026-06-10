import { test, expect } from '@playwright/test'

/**
 * Captcha E2E Tests - Enabled Mode
 * These tests require a backend with captcha enabled.
 * Run with: PEEKVIEW_AUTH__CAPTCHA_ENABLED=true make debug-start
 *
 * NOTE: Requires a FRESH database (first user not yet registered).
 * If test data is polluted, restart: make debug-stop && rm -rf /tmp/peekview-debug && PEEKVIEW_AUTH__CAPTCHA_ENABLED=true make debug-start
 */

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:8888'

test.describe('Captcha - Enabled Mode', () => {
  test('captcha widget appears in login dialog', async ({ page }) => {
    await page.goto(BASE_URL + '/')
    await page.waitForSelector('.btn-login', { timeout: 10000 })
    await page.click('.btn-login')
    await page.waitForTimeout(1000)

    // Widget should be visible
    await expect(page.locator('cap-widget')).toBeVisible({ timeout: 15000 })
  })

  test('config endpoint reports enabled and builtin mode', async ({ page }) => {
    const response = await page.request.get(BASE_URL + '/api/v1/config/captcha')
    expect(response.status()).toBe(200)
    const data = await response.json()
    expect(data.enabled).toBe(true)
    expect(data.mode).toBe('builtin')
    expect(data.endpoint).toBe('/api/v1/captcha')
  })

  test('register first user is exempt (no captcha needed)', async ({ page }) => {
    // This test assumes a fresh database
    const checkResp = await page.request.post(BASE_URL + '/api/v1/auth/register', {
      data: { username: `exempt_${Date.now()}`, password: 'testpass123' }
    })
    // First user should succeed without captcha
    if (checkResp.status() === 401) {
      test.skip(true, 'First user already registered, exempt test not applicable')
    }
    expect(checkResp.status()).toBe(201)
  })

  test('submit disabled until captcha solved', async ({ page }) => {
    await page.goto(BASE_URL + '/')
    await page.waitForSelector('.btn-login', { timeout: 10000 })
    await page.click('.btn-login')
    await page.waitForTimeout(1000)

    await page.fill('#login-username', 'captchatest')
    await page.fill('#login-password', 'testpass123')

    const submitBtn = page.locator('.login__submit')
    // Should be disabled because captcha not solved
    await expect(submitBtn).toBeDisabled()

    // Wait for widget to be ready (shadow DOM rendered)
    await page.waitForFunction(() => {
      const widget = document.querySelector('cap-widget') as any
      return widget && widget.shadowRoot && widget.shadowRoot.querySelector('.captcha')
    }, { timeout: 15000 })

    // Solve captcha via widget.solve() API
    await page.evaluate(async () => {
      const widget = document.querySelector('cap-widget') as any
      if (widget) await widget.solve()
    })

    // Wait for solve event to update UI
    await page.waitForTimeout(3000)
    await expect(submitBtn).toBeEnabled()
  })
})
