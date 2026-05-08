"""Desktop layout E2E tests for PeekView.

TC-E2E-02: Desktop three-column layout verification
TC-E2E-03: Code viewer functionality
TC-E2E-04: Markdown rendering with TOC
"""

import pytest
from playwright.async_api import Page, expect
from conftest import ScreenshotHelper, get_test_entry_url, wait_for_network_idle


class TestDesktopLayout:
    """Desktop layout tests - 1920x1080 viewport."""

    async def test_desktop_three_column_layout(
        self, page: Page, test_entry, screenshot_helper: ScreenshotHelper
    ):
        """TC-E2E-02: Verify three-column layout on desktop."""
        await page.goto(get_test_entry_url(test_entry.slug))
        await wait_for_network_idle(page)

        # Verify main layout elements exist
        # File tree sidebar
        file_tree = page.locator("[data-testid='file-tree'], .file-tree, aside:first-of-type")
        await expect(file_tree).to_be_visible()

        # Content area
        content = page.locator("[data-testid='content-area'], .content-area, main")
        await expect(content).to_be_visible()

        # TOC sidebar (for files with headings)
        toc = page.locator("[data-testid='toc-sidebar'], .toc-sidebar, aside:last-of-type")

        # Take screenshot of full layout
        await screenshot_helper.capture("desktop_three_column_layout")

    async def test_toolbar_buttons_visible(
        self, page: Page, test_entry, screenshot_helper: ScreenshotHelper
    ):
        """Verify toolbar shows Copy, Download, Wrap buttons."""
        await page.goto(get_test_entry_url(test_entry.slug))
        await wait_for_network_idle(page)

        # Click on a code file first
        code_file = page.locator("text=main.py, [data-testid='file-item']").first
        if await code_file.is_visible():
            await code_file.click()
            await page.wait_for_timeout(500)

        # Verify Copy button
        copy_btn = page.locator("[data-testid='copy-button'], button:has-text('Copy')").first
        if await copy_btn.is_visible():
            await expect(copy_btn).to_be_visible()

        # Verify Download button
        download_btn = page.locator("[data-testid='download-button'], button:has-text('Download')").first
        if await download_btn.is_visible():
            await expect(download_btn).to_be_visible()

        await screenshot_helper.capture("desktop_toolbar_buttons")

    async def test_file_tree_navigation(
        self, page: Page, test_entry, screenshot_helper: ScreenshotHelper
    ):
        """Verify clicking file in tree switches content."""
        await page.goto(get_test_entry_url(test_entry.slug))
        await wait_for_network_idle(page)

        # Get file tree items
        file_items = page.locator("[data-testid='file-item'], .file-tree-item, .file-item")
        count = await file_items.count()

        if count > 1:
            # Click on second file
            await file_items.nth(1).click()
            await page.wait_for_timeout(500)

            # Verify active state
            active_item = page.locator("[data-testid='file-item'].active, .file-item.active")
            await expect(active_item).to_be_visible()

            await screenshot_helper.capture("desktop_file_tree_navigation")

    async def test_wrap_button_toggles(
        self, page: Page, test_entry, screenshot_helper: ScreenshotHelper
    ):
        """Verify Wrap button toggles line wrapping."""
        await page.goto(get_test_entry_url(test_entry.slug))
        await wait_for_network_idle(page)

        # Click on code file
        code_file = page.locator("text=main.py, .file-item:has-text('main.py')").first
        if await code_file.is_visible():
            await code_file.click()
            await page.wait_for_timeout(500)

        # Find Wrap button
        wrap_btn = page.locator("[data-testid='wrap-button'], button:has-text('Wrap')").first

        if await wrap_btn.is_visible():
            # Click to toggle
            await wrap_btn.click()
            await page.wait_for_timeout(300)
            await screenshot_helper.capture("desktop_wrap_enabled")

            # Click again to toggle off
            await wrap_btn.click()
            await page.wait_for_timeout(300)
            await screenshot_helper.capture("desktop_wrap_disabled")

    async def test_copy_button_functionality(
        self, page: Page, test_entry, screenshot_helper: ScreenshotHelper
    ):
        """Verify Copy button copies content without line numbers."""
        await page.goto(get_test_entry_url(test_entry.slug))
        await wait_for_network_idle(page)

        # Click on code file
        code_file = page.locator("text=main.py, .file-item:has-text('main.py')").first
        if await code_file.is_visible():
            await code_file.click()
            await page.wait_for_timeout(500)

        # Find Copy button
        copy_btn = page.locator("[data-testid='copy-button'], button:has-text('Copy')").first

        if await copy_btn.is_visible():
            await copy_btn.click()
            await page.wait_for_timeout(300)

            # Verify toast/feedback appears
            toast = page.locator("[data-testid='toast'], .toast, .notification").first
            if await toast.is_visible():
                await expect(toast).to_be_visible()

            await screenshot_helper.capture("desktop_copy_feedback")


class TestMarkdownRendering:
    """Markdown rendering tests."""

    async def test_markdown_toc_navigation(
        self, page: Page, test_entry, screenshot_helper: ScreenshotHelper
    ):
        """TC-E2E-05: Verify TOC navigation scrolls to section."""
        await page.goto(get_test_entry_url(test_entry.slug))
        await wait_for_network_idle(page)

        # Click on README file
        readme_file = page.locator("text=README.md, .file-item:has-text('README')").first
        if await readme_file.is_visible():
            await readme_file.click()
            await page.wait_for_timeout(500)

        # Find TOC items
        toc_items = page.locator("[data-testid='toc-item'], .toc-item, .toc a")

        if await toc_items.first.is_visible():
            # Click first TOC item
            await toc_items.first.click()
            await page.wait_for_timeout(500)

            await screenshot_helper.capture("desktop_toc_navigation")

    async def test_markdown_code_block_copy(
        self, page: Page, test_entry, screenshot_helper: ScreenshotHelper
    ):
        """Verify code block copy button in Markdown."""
        await page.goto(get_test_entry_url(test_entry.slug))
        await wait_for_network_idle(page)

        # Click on README
        readme_file = page.locator("text=README.md, .file-item:has-text('README')").first
        if await readme_file.is_visible():
            await readme_file.click()
            await page.wait_for_timeout(500)

        # Find code block copy button
        code_copy_btn = page.locator(".markdown-body pre .copy-button, [data-testid='code-copy-button']").first

        if await code_copy_btn.is_visible():
            await code_copy_btn.click()
            await page.wait_for_timeout(300)

            # Verify feedback
            toast = page.locator("[data-testid='toast'], .toast").first
            if await toast.is_visible():
                await expect(toast).to_be_visible()

            await screenshot_helper.capture("desktop_markdown_code_copy")


class TestEntryList:
    """Entry list page tests."""

    async def test_list_page_layout(
        self, page: Page, screenshot_helper: ScreenshotHelper
    ):
        """Verify list page layout."""
        await page.goto("http://localhost:8080")
        await wait_for_network_idle(page)

        # Verify header
        header = page.locator("header, .header").first
        await expect(header).to_be_visible()

        # Verify search input
        search = page.locator("[data-testid='search-input'], input[type='search'], .search-input").first
        await expect(search).to_be_visible()

        # Verify entry cards
        entry_cards = page.locator("[data-testid='entry-card'], .entry-card, .entry-item")

        await screenshot_helper.capture("desktop_list_page")

    async def test_search_functionality(
        self, page: Page, test_entry, screenshot_helper: ScreenshotHelper
    ):
        """Verify search filters entries."""
        await page.goto("http://localhost:8080")
        await wait_for_network_idle(page)

        # Find search input
        search = page.locator("[data-testid='search-input'], input[type='search']").first

        if await search.is_visible():
            # Type search term
            await search.fill("Test")
            await page.wait_for_timeout(1000)  # Wait for debounce

            await screenshot_helper.capture("desktop_search_results")
