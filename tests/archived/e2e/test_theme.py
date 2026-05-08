"""Theme switching E2E tests for PeekView.

TC-E2E-04: Theme toggle and persistence
"""

import pytest
from playwright.async_api import Page, expect
from conftest import ScreenshotHelper, wait_for_network_idle


class TestThemeSwitching:
    """Theme switching tests."""

    async def test_default_theme_applied(
        self, page: Page, screenshot_helper: ScreenshotHelper
    ):
        """Verify default theme is applied on page load."""
        await page.goto("http://localhost:8080")
        await wait_for_network_idle(page)

        # Check data-theme attribute or class
        theme = await page.evaluate("() => document.documentElement.getAttribute('data-theme') || document.documentElement.className")

        # Should have either 'dark' or 'light'
        assert "dark" in theme.lower() or "light" in theme.lower(), f"Expected theme class, got: {theme}"

        await screenshot_helper.capture("theme_default")

    async def test_theme_toggle_button_exists(
        self, page: Page, screenshot_helper: ScreenshotHelper
    ):
        """Verify theme toggle button exists."""
        await page.goto("http://localhost:8080")
        await wait_for_network_idle(page)

        # Find theme toggle button
        theme_btn = page.locator("[data-testid='theme-toggle'], .theme-toggle, button[aria-label*='theme' i], button[title*='theme' i]").first

        await expect(theme_btn).to_be_visible()

        await screenshot_helper.capture("theme_toggle_button")

    async def test_theme_toggle_switches(
        self, page: Page, screenshot_helper: ScreenshotHelper
    ):
        """Verify clicking theme toggle switches theme."""
        await page.goto("http://localhost:8080")
        await wait_for_network_idle(page)

        # Get initial theme
        initial_theme = await page.evaluate("() => document.documentElement.getAttribute('data-theme') || (document.documentElement.classList.contains('dark') ? 'dark' : 'light')")

        # Find and click theme toggle
        theme_btn = page.locator("[data-testid='theme-toggle'], .theme-toggle, button[aria-label*='theme' i]").first

        if await theme_btn.is_visible():
            await theme_btn.click()
            await page.wait_for_timeout(500)

            # Get new theme
            new_theme = await page.evaluate("() => document.documentElement.getAttribute('data-theme') || (document.documentElement.classList.contains('dark') ? 'dark' : 'light')")

            # Theme should have changed
            assert new_theme != initial_theme, f"Theme should change from {initial_theme} to {new_theme}"

            await screenshot_helper.capture(f"theme_toggled_{new_theme}")

    async def test_theme_persists_on_reload(
        self, page: Page, context, screenshot_helper: ScreenshotHelper
    ):
        """Verify theme persists after page reload."""
        await page.goto("http://localhost:8080")
        await wait_for_network_idle(page)

        # Get initial theme
        initial_theme = await page.evaluate("() => document.documentElement.getAttribute('data-theme') || (document.documentElement.classList.contains('dark') ? 'dark' : 'light')")

        # Toggle theme
        theme_btn = page.locator("[data-testid='theme-toggle'], .theme-toggle, button[aria-label*='theme' i]").first

        if await theme_btn.is_visible():
            await theme_btn.click()
            await page.wait_for_timeout(500)

            # Get toggled theme
            toggled_theme = await page.evaluate("() => document.documentElement.getAttribute('data-theme') || (document.documentElement.classList.contains('dark') ? 'dark' : 'light')")

            # Reload page
            await page.reload()
            await wait_for_network_idle(page)

            # Get theme after reload
            persisted_theme = await page.evaluate("() => document.documentElement.getAttribute('data-theme') || (document.documentElement.classList.contains('dark') ? 'dark' : 'light')")

            # Should match toggled theme
            assert persisted_theme == toggled_theme, f"Theme should persist: {toggled_theme} vs {persisted_theme}"

            await screenshot_helper.capture(f"theme_persisted_{persisted_theme}")

    async def test_theme_code_highlighting(
        self, page: Page, test_entry, screenshot_helper: ScreenshotHelper
    ):
        """Verify code highlighting adapts to theme."""
        from conftest import get_test_entry_url

        await page.goto(get_test_entry_url(test_entry.slug))
        await wait_for_network_idle(page)

        # Click on code file
        code_file = page.locator("text=main.py, .file-item:has-text('main.py')").first
        if await code_file.is_visible():
            await code_file.click()
            await page.wait_for_timeout(1000)  # Wait for Shiki

        # Get initial background color
        initial_bg = await page.evaluate("() => { const el = document.querySelector('.shiki, pre code'); return el ? getComputedStyle(el).backgroundColor : null; }")

        # Toggle theme
        theme_btn = page.locator("[data-testid='theme-toggle'], .theme-toggle, button[aria-label*='theme' i]").first

        if await theme_btn.is_visible():
            await theme_btn.click()
            await page.wait_for_timeout(1000)  # Wait for theme transition

            # Get new background color
            new_bg = await page.evaluate("() => { const el = document.querySelector('.shiki, pre code'); return el ? getComputedStyle(el).backgroundColor : null; }")

            # Colors should be different
            if initial_bg and new_bg:
                assert initial_bg != new_bg, f"Code background should change: {initial_bg} vs {new_bg}"

            await screenshot_helper.capture("theme_code_highlighting")

    async def test_mobile_theme_toggle(
        self, mobile_page: Page, mobile_screenshot_helper: ScreenshotHelper
    ):
        """Verify theme toggle works on mobile."""
        await mobile_page.goto("http://localhost:8080")
        await wait_for_network_idle(mobile_page)

        # Find theme toggle (usually in header)
        theme_btn = mobile_page.locator("[data-testid='theme-toggle'], .theme-toggle, header button").first

        if await theme_btn.is_visible():
            # Get initial theme
            initial_theme = await mobile_page.evaluate("() => document.documentElement.getAttribute('data-theme') || (document.documentElement.classList.contains('dark') ? 'dark' : 'light')")

            await theme_btn.click()
            await mobile_page.wait_for_timeout(500)

            # Get new theme
            new_theme = await mobile_page.evaluate("() => document.documentElement.getAttribute('data-theme') || (document.documentElement.classList.contains('dark') ? 'dark' : 'light')")

            assert new_theme != initial_theme

            await mobile_screenshot_helper.capture(f"mobile_theme_{new_theme}")

    async def test_theme_localstorage(
        self, page: Page, context, screenshot_helper: ScreenshotHelper
    ):
        """Verify theme is stored in localStorage."""
        await page.goto("http://localhost:8080")
        await wait_for_network_idle(page)

        # Toggle theme
        theme_btn = page.locator("[data-testid='theme-toggle'], .theme-toggle, button[aria-label*='theme' i]").first

        if await theme_btn.is_visible():
            await theme_btn.click()
            await page.wait_for_timeout(500)

            # Check localStorage
            theme_in_storage = await page.evaluate("() => localStorage.getItem('theme') || localStorage.getItem('peek-theme') || localStorage.getItem('color-theme')")

            # Should have stored theme preference
            assert theme_in_storage is not None, "Theme should be stored in localStorage"
            assert theme_in_storage in ['dark', 'light'], f"Theme value should be 'dark' or 'light', got: {theme_in_storage}"

            await screenshot_helper.capture("theme_localstorage")
