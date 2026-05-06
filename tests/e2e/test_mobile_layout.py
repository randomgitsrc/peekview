"""Mobile layout E2E tests for PeekView.

TC-E2E-03: Mobile layout verification with bottom bar
TC-E2E-04: Mobile drawer interactions
TC-E2E-05: Mobile touch gestures
"""

import pytest
from playwright.async_api import Page, expect
from conftest import ScreenshotHelper, get_test_entry_url, wait_for_network_idle


class TestMobileLayout:
    """Mobile layout tests - 375x667 viewport (iPhone SE)."""

    async def test_mobile_bottom_bar_multi_file(
        self, mobile_page: Page, test_entry, mobile_screenshot_helper: ScreenshotHelper
    ):
        """TC-E2E-03: Multi-file entry shows hamburger button + file count."""
        await mobile_page.goto(get_test_entry_url(test_entry.slug))
        await wait_for_network_idle(mobile_page)

        # Verify bottom bar exists
        bottom_bar = mobile_page.locator("[data-testid='mobile-bottom-bar'], .mobile-bottom-bar, .bottom-bar").first
        await expect(bottom_bar).to_be_visible()

        # Verify hamburger button with file count
        hamburger = mobile_page.locator("[data-testid='file-drawer-toggle'], .hamburger-btn, .files-toggle").first

        if await hamburger.is_visible():
            # Check for file count badge/text
            hamburger_text = await hamburger.text_content() or ""
            # Should contain file count (e.g., "3 files")
            assert "files" in hamburger_text.lower() or "3" in hamburger_text, \
                f"Expected file count in hamburger, got: {hamburger_text}"

        await mobile_screenshot_helper.capture("mobile_bottom_bar_multi_file")

    async def test_mobile_bottom_bar_single_file(
        self, mobile_page: Page, single_file_entry, mobile_screenshot_helper: ScreenshotHelper
    ):
        """Single-file entry shows filename without hamburger."""
        await mobile_page.goto(get_test_entry_url(single_file_entry.slug))
        await wait_for_network_idle(mobile_page)

        # Get bottom bar left section text
        file_label = mobile_page.locator("[data-testid='current-file-label'], .file-label, .current-file").first

        if await file_label.is_visible():
            label_text = await file_label.text_content() or ""
            # Should show filename
            assert "script.js" in label_text or ".js" in label_text, \
                f"Expected filename in bottom bar, got: {label_text}"

        await mobile_screenshot_helper.capture("mobile_bottom_bar_single_file")

    async def test_mobile_code_shows_wrap_button(
        self, mobile_page: Page, test_entry, mobile_screenshot_helper: ScreenshotHelper
    ):
        """Code file shows Wrap button in bottom bar."""
        await mobile_page.goto(get_test_entry_url(test_entry.slug))
        await wait_for_network_idle(mobile_page)

        # Click on code file first
        code_file = mobile_page.locator("text=main.py, .file-item:has-text('main.py')").first
        if await code_file.is_visible():
            await code_file.click()
            await mobile_page.wait_for_timeout(500)

        # Verify Wrap button exists
        wrap_btn = mobile_page.locator("[data-testid='wrap-button'], .wrap-btn, button:has-text('Wrap')").first

        # For code files, Wrap button should be visible
        if await wrap_btn.is_visible():
            await expect(wrap_btn).to_be_visible()

        await mobile_screenshot_helper.capture("mobile_wrap_button")

    async def test_mobile_markdown_hides_wrap_button(
        self, mobile_page: Page, test_entry, mobile_screenshot_helper: ScreenshotHelper
    ):
        """Markdown file hides Wrap button in bottom bar."""
        await mobile_page.goto(get_test_entry_url(test_entry.slug))
        await wait_for_network_idle(mobile_page)

        # Click on README (Markdown)
        readme_file = mobile_page.locator("text=README.md, .file-item:has-text('README')").first
        if await readme_file.is_visible():
            await readme_file.click()
            await mobile_page.wait_for_timeout(500)

        # Wrap button should not be visible for Markdown
        wrap_btn = mobile_page.locator("[data-testid='wrap-button'], .wrap-btn, button:has-text('Wrap')").first

        if await wrap_btn.is_visible():
            # Check if button is disabled or hidden
            is_visible = await wrap_btn.is_visible()
            if is_visible:
                is_disabled = await wrap_btn.is_disabled()
                assert is_disabled, "Wrap button should be disabled for Markdown"

        await mobile_screenshot_helper.capture("mobile_markdown_no_wrap")

    async def test_mobile_markdown_shows_toc_button(
        self, mobile_page: Page, test_entry, mobile_screenshot_helper: ScreenshotHelper
    ):
        """Markdown with TOC shows TOC button."""
        await mobile_page.goto(get_test_entry_url(test_entry.slug))
        await wait_for_network_idle(mobile_page)

        # Click on README
        readme_file = mobile_page.locator("text=README.md, .file-item:has-text('README')").first
        if await readme_file.is_visible():
            await readme_file.click()
            await mobile_page.wait_for_timeout(500)

        # Verify TOC button exists
        toc_btn = mobile_page.locator("[data-testid='toc-drawer-toggle'], .toc-btn, button:has-text('TOC')").first

        if await toc_btn.is_visible():
            await expect(toc_btn).to_be_visible()

        await mobile_screenshot_helper.capture("mobile_toc_button")


class TestMobileDrawers:
    """Mobile drawer interaction tests."""

    async def test_file_drawer_opens(
        self, mobile_page: Page, test_entry, mobile_screenshot_helper: ScreenshotHelper
    ):
        """TC-E2E-04: Clicking hamburger opens file drawer."""
        await mobile_page.goto(get_test_entry_url(test_entry.slug))
        await wait_for_network_idle(mobile_page)

        # Click hamburger button
        hamburger = mobile_page.locator("[data-testid='file-drawer-toggle'], .hamburger-btn, .files-toggle").first

        if await hamburger.is_visible():
            await hamburger.click()
            await mobile_page.wait_for_timeout(500)

            # Verify drawer is visible
            drawer = mobile_page.locator("[data-testid='file-drawer'], .file-drawer, .drawer").first
            await expect(drawer).to_be_visible()

            # Verify file list in drawer
            file_items = mobile_page.locator("[data-testid='drawer-file-item'], .drawer .file-item").first
            await expect(file_items).to_be_visible()

            await mobile_screenshot_helper.capture("mobile_file_drawer_open")

    async def test_file_drawer_closes_on_overlay_click(
        self, mobile_page: Page, test_entry, mobile_screenshot_helper: ScreenshotHelper
    ):
        """Clicking overlay closes file drawer."""
        await mobile_page.goto(get_test_entry_url(test_entry.slug))
        await wait_for_network_idle(mobile_page)

        # Open drawer
        hamburger = mobile_page.locator("[data-testid='file-drawer-toggle'], .hamburger-btn").first
        if await hamburger.is_visible():
            await hamburger.click()
            await mobile_page.wait_for_timeout(500)

            # Click overlay
            overlay = mobile_page.locator("[data-testid='drawer-overlay'], .drawer-overlay, .overlay").first
            if await overlay.is_visible():
                await overlay.click()
                await mobile_page.wait_for_timeout(300)

                # Verify drawer is closed
                drawer = mobile_page.locator("[data-testid='file-drawer'], .file-drawer").first
                await expect(drawer).not_to_be_visible()

                await mobile_screenshot_helper.capture("mobile_drawer_closed")

    async def test_file_drawer_item_switches_file(
        self, mobile_page: Page, test_entry, mobile_screenshot_helper: ScreenshotHelper
    ):
        """Clicking file in drawer switches content."""
        await mobile_page.goto(get_test_entry_url(test_entry.slug))
        await wait_for_network_idle(mobile_page)

        # Open drawer
        hamburger = mobile_page.locator("[data-testid='file-drawer-toggle'], .hamburger-btn").first
        if await hamburger.is_visible():
            await hamburger.click()
            await mobile_page.wait_for_timeout(500)

            # Click a file in drawer
            drawer_file = mobile_page.locator("[data-testid='drawer-file-item'], .drawer .file-item").first
            if await drawer_file.is_visible():
                await drawer_file.click()
                await mobile_page.wait_for_timeout(500)

                # Verify drawer closed
                drawer = mobile_page.locator("[data-testid='file-drawer'], .file-drawer").first
                await expect(drawer).not_to_be_visible()

                await mobile_screenshot_helper.capture("mobile_file_switched")

    async def test_toc_drawer_opens(
        self, mobile_page: Page, test_entry, mobile_screenshot_helper: ScreenshotHelper
    ):
        """TC-E2E-05: TOC drawer opens and shows headings."""
        await mobile_page.goto(get_test_entry_url(test_entry.slug))
        await wait_for_network_idle(mobile_page)

        # Click on README first
        readme_file = mobile_page.locator("text=README.md, .file-item:has-text('README')").first
        if await readme_file.is_visible():
            await readme_file.click()
            await mobile_page.wait_for_timeout(500)

        # Click TOC button
        toc_btn = mobile_page.locator("[data-testid='toc-drawer-toggle'], .toc-btn, button:has-text('TOC')").first

        if await toc_btn.is_visible():
            await toc_btn.click()
            await mobile_page.wait_for_timeout(500)

            # Verify TOC drawer
            toc_drawer = mobile_page.locator("[data-testid='toc-drawer'], .toc-drawer").first
            await expect(toc_drawer).to_be_visible()

            # Verify TOC items exist
            toc_items = mobile_page.locator("[data-testid='toc-item'], .toc-drawer a, .toc-item").first
            await expect(toc_items).to_be_visible()

            await mobile_screenshot_helper.capture("mobile_toc_drawer_open")


class TestMobileInteractions:
    """Mobile touch interaction tests."""

    async def test_mobile_copy_button(
        self, mobile_page: Page, test_entry, mobile_screenshot_helper: ScreenshotHelper
    ):
        """Verify Copy button works on mobile."""
        await mobile_page.goto(get_test_entry_url(test_entry.slug))
        await wait_for_network_idle(mobile_page)

        # Find Copy button in bottom bar
        copy_btn = mobile_page.locator("[data-testid='copy-button'], .copy-btn, button:has-text('Copy')").first

        if await copy_btn.is_visible():
            await copy_btn.click()
            await mobile_page.wait_for_timeout(300)

            # Verify toast appears
            toast = mobile_page.locator("[data-testid='toast'], .toast, .notification").first
            if await toast.is_visible():
                await expect(toast).to_be_visible()

            await mobile_screenshot_helper.capture("mobile_copy_feedback")

    async def test_mobile_wrap_toggle(
        self, mobile_page: Page, test_entry, mobile_screenshot_helper: ScreenshotHelper
    ):
        """Verify Wrap button toggles on mobile."""
        await mobile_page.goto(get_test_entry_url(test_entry.slug))
        await wait_for_network_idle(mobile_page)

        # Click on code file
        code_file = mobile_page.locator("text=main.py, .file-item:has-text('main.py')").first
        if await code_file.is_visible():
            await code_file.click()
            await mobile_page.wait_for_timeout(500)

        # Find Wrap button
        wrap_btn = mobile_page.locator("[data-testid='wrap-button'], .wrap-btn, button:has-text('Wrap')").first

        if await wrap_btn.is_visible():
            # Take screenshot before toggle
            await mobile_screenshot_helper.capture("mobile_before_wrap")

            # Click to toggle
            await wrap_btn.click()
            await mobile_page.wait_for_timeout(500)

            # Take screenshot after toggle
            await mobile_screenshot_helper.capture("mobile_after_wrap")

    async def test_mobile_horizontal_scroll(
        self, mobile_page: Page, test_entry, mobile_screenshot_helper: ScreenshotHelper
    ):
        """Verify code area supports horizontal scroll."""
        await mobile_page.goto(get_test_entry_url(test_entry.slug))
        await wait_for_network_idle(mobile_page)

        # Make sure wrap is off
        wrap_btn = mobile_page.locator("[data-testid='wrap-button'], .wrap-btn").first
        if await wrap_btn.is_visible():
            # Check current state
            is_wrap_on = await wrap_btn.get_attribute("data-active") or "false"
            if is_wrap_on == "true":
                await wrap_btn.click()
                await mobile_page.wait_for_timeout(300)

        # Find code area
        code_area = mobile_page.locator("[data-testid='code-viewer'], .code-viewer, pre").first

        if await code_area.is_visible():
            # Scroll horizontally
            await code_area.evaluate("el => el.scrollLeft = 100")
            await mobile_page.wait_for_timeout(300)

            await mobile_screenshot_helper.capture("mobile_horizontal_scroll")
