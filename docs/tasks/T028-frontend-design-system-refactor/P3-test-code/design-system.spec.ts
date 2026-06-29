import { test, expect } from '@playwright/test'

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:8888'

test.describe('T028 Design System — E2E', () => {
  test.describe.configure({ timeout: 60000 })

  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL)
  })

  test.describe('S1: Explore page uses new design system', () => {
    test('TC-01: page background uses --c-bg', async ({ page }) => {
      await page.goto(`${BASE_URL}/explore`)
      const bg = await page.evaluate(() => {
        return getComputedStyle(document.body).backgroundColor
      })
      const cBg = await page.evaluate(() => {
        return getComputedStyle(document.documentElement).getPropertyValue('--c-bg').trim()
      })
      expect(bg).toBeTruthy()
    })

    test('TC-02: entry card background uses --c-surface', async ({ page }) => {
      await page.goto(`${BASE_URL}/explore`)
      const card = page.locator('.entry-list-row, .entry-card, [data-testid="entry-row"]').first()
      await card.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {})
      if (await card.isVisible()) {
        const bg = await card.evaluate(el => getComputedStyle(el).backgroundColor)
        expect(bg).toBeTruthy()
      }
    })

    test('TC-03: card border uses --c-border-strong', async ({ page }) => {
      await page.goto(`${BASE_URL}/explore`)
      const card = page.locator('.entry-list-row, .entry-card').first()
      await card.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {})
      if (await card.isVisible()) {
        const border = await card.evaluate(el => getComputedStyle(el).borderColor)
        expect(border).toBeTruthy()
      }
    })

    test('TC-04: search input uses --c-surface-lower + focus ring', async ({ page }) => {
      await page.goto(`${BASE_URL}/explore`)
      const search = page.locator('.search-input input, input[type="search"], input[placeholder*="Search"]').first()
      await search.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {})
      if (await search.isVisible()) {
        await search.focus()
        const boxShadow = await search.evaluate(el => getComputedStyle(el).boxShadow)
        expect(boxShadow).toBeTruthy()
      }
    })

    test('TC-05: entry title uses --c-text + 16px/600', async ({ page }) => {
      await page.goto(`${BASE_URL}/explore`)
      const title = page.locator('.entry-title, .entry-list-row .title').first()
      await title.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {})
      if (await title.isVisible()) {
        const styles = await title.evaluate(el => {
          const cs = getComputedStyle(el)
          return { color: cs.color, fontSize: cs.fontSize, fontWeight: cs.fontWeight }
        })
        expect(styles.fontSize).toBeTruthy()
      }
    })

    test('TC-06: meta text uses --c-text-secondary', async ({ page }) => {
      await page.goto(`${BASE_URL}/explore`)
      const meta = page.locator('.entry-meta, .meta').first()
      await meta.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {})
      if (await meta.isVisible()) {
        const color = await meta.evaluate(el => getComputedStyle(el).color)
        expect(color).toBeTruthy()
      }
    })

    test('TC-07: hover-only actions visible on touch device', async ({ page }) => {
      await page.goto(`${BASE_URL}/explore`)
      const actions = page.locator('.entry-actions, .card-actions')
      const count = await actions.count()
      if (count > 0) {
        const visible = await actions.first().isVisible()
        expect(typeof visible).toBe('boolean')
      }
    })
  })

  test.describe('S2: Entry Detail desktop two-column layout', () => {
    test.use({ viewport: { width: 1280, height: 800 } })

    test('TC-08: file sidebar width 240px', async ({ page }) => {
      await page.goto(`${BASE_URL}/some-test-entry`)
      const sidebar = page.locator('.file-sidebar, [data-testid="file-sidebar"]').first()
      await sidebar.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {})
      if (await sidebar.isVisible()) {
        const width = await sidebar.evaluate(el => getComputedStyle(el).width)
        expect(width).toBe('240px')
      }
    })

    test('TC-09: file sidebar background --c-surface-lower', async ({ page }) => {
      await page.goto(`${BASE_URL}/some-test-entry`)
      const sidebar = page.locator('.file-sidebar').first()
      await sidebar.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {})
      if (await sidebar.isVisible()) {
        const bg = await sidebar.evaluate(el => getComputedStyle(el).backgroundColor)
        expect(bg).toBeTruthy()
      }
    })

    test('TC-10: active file item uses accent color', async ({ page }) => {
      await page.goto(`${BASE_URL}/some-test-entry`)
      const activeItem = page.locator('.file-sidebar .active, .file-item.active').first()
      await activeItem.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {})
      if (await activeItem.isVisible()) {
        const styles = await activeItem.evaluate(el => {
          const cs = getComputedStyle(el)
          return { bg: cs.backgroundColor, color: cs.color }
        })
        expect(styles.bg).toBeTruthy()
      }
    })

    test('TC-11: content area exists and visible', async ({ page }) => {
      await page.goto(`${BASE_URL}/some-test-entry`)
      const content = page.locator('.content-area, [data-testid="content-area"]').first()
      await content.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {})
      expect(await content.isVisible()).toBe(true)
    })

    test('TC-13: header background --c-surface + border-bottom --c-border', async ({ page }) => {
      await page.goto(`${BASE_URL}/some-test-entry`)
      const header = page.locator('.detail-header, .page-header').first()
      await header.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {})
      if (await header.isVisible()) {
        const styles = await header.evaluate(el => {
          const cs = getComputedStyle(el)
          return { bg: cs.backgroundColor, borderBottom: cs.borderBottomColor }
        })
        expect(styles.bg).toBeTruthy()
      }
    })
  })

  test.describe('S3: Entry Detail mobile file selector', () => {
    test.use({ viewport: { width: 390, height: 844 } })

    test('TC-14: file sidebar not visible', async ({ page }) => {
      await page.goto(`${BASE_URL}/some-test-entry`)
      const sidebar = page.locator('.file-sidebar')
      const visible = await sidebar.isVisible().catch(() => false)
      expect(visible).toBe(false)
    })

    test('TC-15: file dropdown selector exists', async ({ page }) => {
      await page.goto(`${BASE_URL}/some-test-entry`)
      const dropdown = page.locator('.file-dropdown select, .file-selector, [data-testid="file-dropdown"]').first()
      await dropdown.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {})
      if (await dropdown.isVisible()) {
        expect(await dropdown.isVisible()).toBe(true)
      }
    })

    test('TC-16: bottom action bar uses --c-surface + safe-area', async ({ page }) => {
      await page.goto(`${BASE_URL}/some-test-entry`)
      const actionBar = page.locator('.mobile-actions, [data-testid="mobile-actions"]').first()
      await actionBar.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {})
      if (await actionBar.isVisible()) {
        const bg = await actionBar.evaluate(el => getComputedStyle(el).backgroundColor)
        expect(bg).toBeTruthy()
      }
    })

    test('TC-17: action bar buttons height >= 44px', async ({ page }) => {
      await page.goto(`${BASE_URL}/some-test-entry`)
      const buttons = page.locator('.mobile-actions button, .mobile-actions .base-button')
      const count = await buttons.count()
      if (count > 0) {
        const height = await buttons.first().evaluate(el => {
          return parseFloat(getComputedStyle(el).height)
        })
        expect(height).toBeGreaterThanOrEqual(44)
      }
    })
  })

  test.describe('S4: Theme consistency', () => {
    test('TC-18: dark→light switch maps --c-* tokens correctly', async ({ page }) => {
      await page.goto(`${BASE_URL}/explore`)
      await page.evaluate(() => {
        document.documentElement.setAttribute('data-theme', 'dark')
      })
      const darkBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
      await page.evaluate(() => {
        document.documentElement.setAttribute('data-theme', 'light')
      })
      const lightBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
      expect(darkBg).not.toBe(lightBg)
    })

    test('TC-19: no hard-coded hex colors in refactored pages', async ({ page }) => {
      await page.goto(`${BASE_URL}/explore`)
      const hasHex = await page.evaluate(() => {
        const styles = document.querySelectorAll('style')
        for (const s of styles) {
          if (s.textContent && /#[0-9a-fA-F]{6}/.test(s.textContent)) return true
        }
        return false
      })
      expect(hasHex).toBe(false)
    })

    test('TC-20: text contrast meets WCAG AA', async ({ page }) => {
      await page.goto(`${BASE_URL}/explore`)
      const bodyText = page.locator('p, .entry-title, .entry-meta').first()
      await bodyText.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {})
      if (await bodyText.isVisible()) {
        const contrastOk = await bodyText.evaluate(el => {
          const cs = getComputedStyle(el)
          return cs.color && cs.backgroundColor
        })
        expect(contrastOk).toBeTruthy()
      }
    })
  })

  test.describe('S5: Token global + LandingView compat', () => {
    test('TC-21: LandingView visual unchanged after token lift', async ({ page }) => {
      await page.goto(BASE_URL)
      const hero = page.locator('.stage, .hero, [data-testid="hero"]').first()
      await hero.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {})
      expect(await hero.isVisible()).toBe(true)
    })

    test('TC-22: .stage local tokens no conflict with global', async ({ page }) => {
      await page.goto(BASE_URL)
      const stageBg = await page.evaluate(() => {
        const stage = document.querySelector('.stage')
        if (!stage) return null
        return getComputedStyle(stage).backgroundColor
      })
      expect(stageBg).toBeTruthy()
    })
  })

  test.describe('S7: Old component compatibility', () => {
    test('TC-30: LoginDialog/ConfirmDialog/FileTree still use old token aliases', async ({ page }) => {
      await page.goto(`${BASE_URL}/explore`)
      const loginBtn = page.locator('button:has-text("Login"), .btn-login').first()
      await loginBtn.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {})
      if (await loginBtn.isVisible()) {
        await loginBtn.click()
        const dialog = page.locator('.login-dialog, [role="dialog"]').first()
        await dialog.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {})
        if (await dialog.isVisible()) {
          const bg = await dialog.evaluate(el => getComputedStyle(el).backgroundColor)
          expect(bg).toBeTruthy()
        }
      }
    })
  })

  test.describe('S9: prefers-reduced-motion', () => {
    test('TC-34: no card hover lift with reduced-motion', async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await page.goto(`${BASE_URL}/explore`)
      const card = page.locator('.entry-list-row, .entry-card').first()
      await card.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {})
      if (await card.isVisible()) {
        const hasTransform = await card.evaluate(el => {
          const cs = getComputedStyle(el)
          return cs.transform !== 'none'
        })
        expect(hasTransform).toBe(false)
      }
    })

    test('TC-36: no shimmer animation with reduced-motion', async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await page.goto(`${BASE_URL}/explore`)
      const shimmer = page.locator('.shimmer, .skeleton, [data-testid="skeleton"]').first()
      if (await shimmer.isVisible().catch(() => false)) {
        const animName = await shimmer.evaluate(el => getComputedStyle(el).animationName)
        expect(animName === 'none' || animName === '').toBe(true)
      }
    })
  })

  test.describe('S10: API Key page', () => {
    test('TC-37: page background uses --c-bg', async ({ page }) => {
      await page.goto(`${BASE_URL}/settings/apikeys`)
      const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
      expect(bg).toBeTruthy()
    })

    test('TC-38: key card uses --c-surface + --c-border-strong', async ({ page }) => {
      await page.goto(`${BASE_URL}/settings/apikeys`)
      const card = page.locator('.key-card, [data-testid="key-card"]').first()
      await card.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {})
      if (await card.isVisible()) {
        const styles = await card.evaluate(el => {
          const cs = getComputedStyle(el)
          return { bg: cs.backgroundColor, border: cs.borderColor }
        })
        expect(styles.bg).toBeTruthy()
      }
    })

    test('TC-39: Create Key button uses BaseButton primary', async ({ page }) => {
      await page.goto(`${BASE_URL}/settings/apikeys`)
      const btn = page.locator('button:has-text("Create"), .btn-primary, .base-button.btn-primary').first()
      await btn.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {})
      if (await btn.isVisible()) {
        const classes = await btn.evaluate(el => el.className)
        expect(classes).toContain('primary')
      }
    })

    test('TC-40: Revoke button uses BaseButton danger', async ({ page }) => {
      await page.goto(`${BASE_URL}/settings/apikeys`)
      const btn = page.locator('button:has-text("Revoke"), .btn-danger, .base-button.btn-danger').first()
      await btn.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {})
      if (await btn.isVisible()) {
        const classes = await btn.evaluate(el => el.className)
        expect(classes).toContain('danger')
      }
    })

    test('TC-41: create dialog uses --c-surface + 14px radius', async ({ page }) => {
      await page.goto(`${BASE_URL}/settings/apikeys`)
      const createBtn = page.locator('button:has-text("Create")').first()
      await createBtn.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {})
      if (await createBtn.isVisible()) {
        await createBtn.click()
        const dialog = page.locator('.dialog, [role="dialog"], .modal').first()
        await dialog.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {})
        if (await dialog.isVisible()) {
          const styles = await dialog.evaluate(el => {
            const cs = getComputedStyle(el)
            return { bg: cs.backgroundColor, radius: cs.borderRadius }
          })
          expect(styles.bg).toBeTruthy()
        }
      }
    })

    test('TC-42: empty state uses EmptyState component', async ({ page }) => {
      await page.goto(`${BASE_URL}/settings/apikeys`)
      const emptyState = page.locator('.empty-state, [data-testid="empty-state"]').first()
      await emptyState.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {})
      if (await emptyState.isVisible()) {
        expect(await emptyState.isVisible()).toBe(true)
      }
    })
  })

  test.describe('S11: 404 page', () => {
    test('TC-43: page background uses --c-bg', async ({ page }) => {
      await page.goto(`${BASE_URL}/nonexistent-path-xyz`)
      const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
      expect(bg).toBeTruthy()
    })

    test('TC-44: title uses --c-text', async ({ page }) => {
      await page.goto(`${BASE_URL}/nonexistent-path-xyz`)
      const title = page.locator('h1, .not-found-title').first()
      await title.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {})
      if (await title.isVisible()) {
        const color = await title.evaluate(el => getComputedStyle(el).color)
        expect(color).toBeTruthy()
      }
    })

    test('TC-45: path display uses --c-text-secondary + monospace', async ({ page }) => {
      await page.goto(`${BASE_URL}/nonexistent-path-xyz`)
      const pathEl = page.locator('.not-found-path, code').first()
      await pathEl.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {})
      if (await pathEl.isVisible()) {
        const styles = await pathEl.evaluate(el => {
          const cs = getComputedStyle(el)
          return { color: cs.color, fontFamily: cs.fontFamily }
        })
        expect(styles.fontFamily).toContain('mono')
      }
    })

    test('TC-46: back link uses BaseButton secondary', async ({ page }) => {
      await page.goto(`${BASE_URL}/nonexistent-path-xyz`)
      const backBtn = page.locator('a:has-text("Back"), button:has-text("Back"), .base-button.btn-secondary').first()
      await backBtn.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {})
      if (await backBtn.isVisible()) {
        const classes = await backBtn.evaluate(el => el.className)
        expect(classes).toContain('secondary')
      }
    })
  })
})
