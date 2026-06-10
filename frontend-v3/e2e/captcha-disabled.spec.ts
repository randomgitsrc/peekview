import { test, expect } from '@playwright/test'

/**
 * Captcha E2E Tests - Disabled Mode
 * These tests run against the default debug server (captcha disabled)
 */

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:8888'

test.describe('Captcha - Disabled Mode', () => {
  test('login dialog does not show captcha widget when disabled', async ({ page }) => {
    await page.goto(BASE_URL + '/')
    await page.waitForSelector('.btn-login', { timeout: 10000 })
    await page.click('.btn-login')
    await page.waitForTimeout(500)

    // Widget should not be present
    await expect(page.locator('cap-widget')).toHaveCount(0)

    // Submit button should be enabled (no captcha requirement)
    await page.fill('#login-username', 'testuser123')
    await page.fill('#login-password', 'testpass123')
    const submitBtn = page.locator('.login__submit')
    await expect(submitBtn).toBeEnabled()
  })

  test('register without captcha works when disabled', async ({ page }) => {
    const uniqueUser = `nocap_${Date.now()}`
    await page.goto(BASE_URL + '/')
    await page.waitForSelector('.btn-login', { timeout: 10000 })
    await page.click('.btn-login')
    await page.waitForTimeout(500)

    // Switch to register
    await page.click('.login__switch-btn')
    await page.waitForTimeout(300)

    await page.fill('#login-username', uniqueUser)
    await page.fill('#login-password', 'testpass123')
    await page.fill('#login-confirm', 'testpass123')

    await page.click('.login__submit')
    await expect(page.locator('.login-dialog')).not.toBeVisible({ timeout: 10000 })
    await expect(page.locator('.user-menu-trigger')).toBeVisible({ timeout: 10000 })
  })

  test('config endpoint reports disabled', async ({ page }) => {
    const response = await page.request.get(BASE_URL + '/api/v1/config/captcha')
    expect(response.status()).toBe(200)
    const data = await response.json()
    expect(data.enabled).toBe(false)
  })
})
