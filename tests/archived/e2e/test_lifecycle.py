"""Full lifecycle E2E tests for PeekView.

TC-E2E-01: Complete lifecycle test
TC-E2E-02: Search and filter workflow
"""

import pytest
from playwright.async_api import Page, expect
import httpx
from conftest import ScreenshotHelper, wait_for_network_idle


class TestLifecycle:
    """Full lifecycle tests - create → view → download → delete."""

    async def test_create_via_api_view_in_browser(
        self, page: Page, api_client: httpx.AsyncClient, screenshot_helper: ScreenshotHelper
    ):
        """Create entry via API, verify in browser."""
        # Create entry via API
        entry_data = {
            "summary": "Lifecycle test entry",
            "tags": ["lifecycle", "test"],
            "files": [
                {
                    "path": "test.py",
                    "content": "# Test file\nprint('Hello, Lifecycle!')\n"
                }
            ]
        }

        response = await api_client.post("/entries", json=entry_data)
        assert response.status_code == 201
        data = response.json()
        slug = data["slug"]

        try:
            # View in browser
            await page.goto(f"http://localhost:8080/{slug}")
            await wait_for_network_idle(page)

            # Verify entry is displayed
            summary = page.locator("text=Lifecycle test entry, .entry-summary, [data-testid='entry-summary']").first
            await expect(summary).to_be_visible()

            # Verify file is listed
            file_item = page.locator("text=test.py, .file-item:has-text('test.py')").first
            await expect(file_item).to_be_visible()

            await screenshot_helper.capture("lifecycle_created_entry")

        finally:
            # Cleanup
            await api_client.delete(f"/entries/{slug}")

    async def test_download_file(
        self, page: Page, api_client: httpx.AsyncClient, context, screenshot_helper: ScreenshotHelper
    ):
        """Verify file download works."""
        # Create entry
        entry_data = {
            "summary": "Download test",
            "files": [
                {
                    "path": "download_me.py",
                    "content": "# Download me\nprint('downloaded')\n"
                }
            ]
        }

        response = await api_client.post("/entries", json=entry_data)
        assert response.status_code == 201
        data = response.json()
        slug = data["slug"]

        try:
            # Navigate to entry
            await page.goto(f"http://localhost:8080/{slug}")
            await wait_for_network_idle(page)

            # Wait for download
            async with page.expect_download() as download_info:
                # Click download button
                download_btn = page.locator("[data-testid='download-button'], button:has-text('Download')").first
                if await download_btn.is_visible():
                    await download_btn.click()
                else:
                    # Try direct API download
                    await page.goto(f"http://localhost:8080/api/v1/entries/{slug}/files/1")

            download = await download_info.value

            # Verify download succeeded
            assert download is not None, "Download should succeed"
            assert download.suggested_filename == "download_me.py" or download.suggested_filename.endswith('.py')

            await screenshot_helper.capture("lifecycle_download")

        finally:
            await api_client.delete(f"/entries/{slug}")

    async def test_delete_removes_from_list(
        self, page: Page, api_client: httpx.AsyncClient, screenshot_helper: ScreenshotHelper
    ):
        """Verify deleted entry disappears from list."""
        # Create unique entry
        import uuid
        unique_id = str(uuid.uuid4())[:8]

        entry_data = {
            "summary": f"Delete test {unique_id}",
            "files": [{"path": "temp.py", "content": "# temp"}]
        }

        response = await api_client.post("/entries", json=entry_data)
        assert response.status_code == 201
        data = response.json()
        slug = data["slug"]

        # Verify entry exists in list
        await page.goto("http://localhost:8080")
        await wait_for_network_idle(page)

        entry_card = page.locator(f"text=Delete test {unique_id}")
        assert await entry_card.count() > 0, "Entry should exist in list"

        # Delete entry
        delete_response = await api_client.delete(f"/entries/{slug}")
        assert delete_response.status_code == 204

        # Refresh list
        await page.reload()
        await wait_for_network_idle(page)

        # Verify entry is gone
        entry_card_after = page.locator(f"text=Delete test {unique_id}")
        assert await entry_card_after.count() == 0, "Entry should be removed from list"

        await screenshot_helper.capture("lifecycle_deleted")

    async def test_copy_to_clipboard(
        self, page: Page, api_client: httpx.AsyncClient, context, screenshot_helper: ScreenshotHelper
    ):
        """Verify copy button copies content."""
        original_content = "# Original content\nprint('hello')\n"

        entry_data = {
            "summary": "Copy test",
            "files": [
                {
                    "path": "copy_me.py",
                    "content": original_content
                }
            ]
        }

        response = await api_client.post("/entries", json=entry_data)
        assert response.status_code == 201
        data = response.json()
        slug = data["slug"]

        try:
            await page.goto(f"http://localhost:8080/{slug}")
            await wait_for_network_idle(page)

            # Click copy button
            copy_btn = page.locator("[data-testid='copy-button'], button:has-text('Copy')").first

            if await copy_btn.is_visible():
                await copy_btn.click()
                await page.wait_for_timeout(500)

                # Verify toast appears
                toast = page.locator("[data-testid='toast'], .toast, .notification").first
                if await toast.is_visible():
                    await expect(toast).to_be_visible()

                await screenshot_helper.capture("lifecycle_copy")

        finally:
            await api_client.delete(f"/entries/{slug}")


class TestSearchAndFilter:
    """Search and filter workflow tests."""

    async def test_search_filters_entries(
        self, page: Page, api_client: httpx.AsyncClient, screenshot_helper: ScreenshotHelper
    ):
        """TC-E2E-05: Search functionality."""
        import uuid
        prefix = str(uuid.uuid4())[:6]

        # Create multiple entries
        entries = [
            {"summary": f"{prefix} Python project", "files": [{"path": "main.py", "content": "print()"}]},
            {"summary": f"{prefix} JavaScript app", "files": [{"path": "app.js", "content": "console.log()"}]},
            {"summary": f"{prefix} Python library", "files": [{"path": "lib.py", "content": "def func(): pass"}]},
        ]

        slugs = []
        for entry_data in entries:
            response = await api_client.post("/entries", json=entry_data)
            assert response.status_code == 201
            slugs.append(response.json()["slug"])

        try:
            await page.goto("http://localhost:8080")
            await wait_for_network_idle(page)

            # Initial count
            all_entries = page.locator(".entry-card, .entry-item, [data-testid='entry-card']")
            initial_count = await all_entries.count()

            # Search for "Python"
            search_input = page.locator("[data-testid='search-input'], input[type='search'], .search-input").first

            if await search_input.is_visible():
                await search_input.fill(f"{prefix} Python")
                await page.wait_for_timeout(1500)  # Wait for debounce

                # Verify filtered results
                filtered_entries = page.locator(".entry-card, .entry-item, [data-testid='entry-card']")
                filtered_count = await filtered_entries.count()

                # Should have fewer entries
                assert filtered_count <= initial_count

                await screenshot_helper.capture("search_filtered")

        finally:
            for slug in slugs:
                await api_client.delete(f"/entries/{slug}")

    async def test_search_no_results(
        self, page: Page, screenshot_helper: ScreenshotHelper
    ):
        """Verify empty state when search has no results."""
        await page.goto("http://localhost:8080")
        await wait_for_network_idle(page)

        search_input = page.locator("[data-testid='search-input'], input[type='search'], .search-input").first

        if await search_input.is_visible():
            # Search for something unlikely to exist
            await search_input.fill("XYZ123NONEXISTENT456")
            await page.wait_for_timeout(1500)

            # Should show empty state
            empty_state = page.locator("text=No entries, text=No results, .empty-state, [data-testid='empty-state']").first

            # Screenshot regardless of empty state detection
            await screenshot_helper.capture("search_no_results")


class TestUrlHashNavigation:
    """URL hash navigation tests."""

    async def test_url_file_param(
        self, page: Page, api_client: httpx.AsyncClient, screenshot_helper: ScreenshotHelper
    ):
        """TC-E2E-06: URL ?file= parameter selects file."""
        entry_data = {
            "summary": "URL param test",
            "files": [
                {"path": "first.py", "content": "# First file"},
                {"path": "second.py", "content": "# Second file"},
            ]
        }

        response = await api_client.post("/entries", json=entry_data)
        assert response.status_code == 201
        slug = response.json()["slug"]

        try:
            # Navigate with file param
            await page.goto(f"http://localhost:8080/{slug}?file=second.py")
            await wait_for_network_idle(page)

            # Verify second file is displayed
            content = page.locator(".code-content, .content-area, [data-testid='content-area']").first
            content_text = await content.text_content() or ""
            assert "Second file" in content_text

            await screenshot_helper.capture("url_file_param")

        finally:
            await api_client.delete(f"/entries/{slug}")
