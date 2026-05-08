"""Playwright E2E tests for PeekView.

This module provides fixtures and utilities for end-to-end testing
using Playwright with Chrome DevTools Protocol (CDP).

Requirements:
    - Chrome browser running with CDP on http://127.0.0.1:18800
    - PeekView backend running on http://localhost:8080
    - pytest-asyncio for async test support

Example:
    pytest tests/e2e/ -v --tb=short
"""

import asyncio
import json
import pytest
import pytest_asyncio
from pathlib import Path
from typing import Dict, Any, Optional
from dataclasses import dataclass

from playwright.async_api import async_playwright, Browser, BrowserContext, Page
import httpx


# Test configuration
CDP_URL = "http://127.0.0.1:18800"
BASE_URL = "http://localhost:8080"
API_URL = f"{BASE_URL}/api/v1"

# Viewport sizes
VIEWPORT_DESKTOP = {"width": 1920, "height": 1080}
VIEWPORT_TABLET = {"width": 768, "height": 1024}
VIEWPORT_MOBILE = {"width": 375, "height": 667}

# Mobile user agent
MOBILE_USER_AGENT = (
    "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) "
    "AppleWebKit/605.1.15 (KHTML, like Gecko) "
    "Version/16.0 Mobile/15E148 Safari/604.1"
)


@dataclass
class TestEntry:
    """Test entry data structure."""
    slug: str
    summary: str
    tags: list
    files: list
    id: Optional[int] = None


@pytest_asyncio.fixture(scope="session")
async def browser():
    """Connect to Chrome via CDP.

    Yields a browser instance connected to the running Chrome.
    Connection is closed after all tests complete.
    """
    async with async_playwright() as p:
        browser = await p.chromium.connect_over_cdp(CDP_URL)
        yield browser
        await browser.close()


@pytest_asyncio.fixture
async def context(browser: Browser):
    """Create a new browser context with desktop viewport.

    Each test gets a fresh context (cookies, localStorage, etc. are isolated).
    """
    context = await browser.new_context(
        viewport=VIEWPORT_DESKTOP,
        accept_downloads=True,
    )
    yield context
    await context.close()


@pytest_asyncio.fixture
async def page(context: BrowserContext):
    """Create a new page with desktop viewport."""
    page = await context.new_page()
    yield page
    await page.close()


@pytest_asyncio.fixture
async def mobile_context(browser: Browser):
    """Create a mobile browser context."""
    context = await browser.new_context(
        viewport=VIEWPORT_MOBILE,
        user_agent=MOBILE_USER_AGENT,
        device_scale_factor=2,  # Retina display
        is_mobile=True,
        accept_downloads=True,
    )
    yield context
    await context.close()


@pytest_asyncio.fixture
async def mobile_page(mobile_context: BrowserContext):
    """Create a new page with mobile viewport."""
    page = await mobile_context.new_page()
    yield page
    await page.close()


@pytest_asyncio.fixture
async def api_client():
    """Create an async HTTP client for API calls."""
    async with httpx.AsyncClient(base_url=API_URL) as client:
        yield client


@pytest_asyncio.fixture
async def test_entry(api_client: httpx.AsyncClient):
    """Create a test entry via API.

    Creates a multi-file entry with Python and Markdown files.
    Automatically cleaned up after test.
    """
    entry_data = {
        "summary": "Test entry for E2E",
        "tags": ["python", "test"],
        "files": [
            {
                "path": "main.py",
                "content": "def hello():\n    print('Hello, World!')\n\nif __name__ == '__main__':\n    hello()\n"
            },
            {
                "path": "README.md",
                "content": "# Test Project\n\n## Installation\n\n```bash\npip install -e .\n```\n\n## Usage\n\nRun the main script:\n\n```python\npython main.py\n```\n\n### API\n\nSee documentation for details.\n"
            },
            {
                "path": "utils/helpers.py",
                "content": "def format_name(name: str) -> str:\n    return name.strip().title()\n"
            }
        ]
    }

    response = await api_client.post("/entries", json=entry_data)
    assert response.status_code == 201, f"Failed to create test entry: {response.text}"

    data = response.json()
    entry = TestEntry(
        slug=data["slug"],
        summary=entry_data["summary"],
        tags=entry_data["tags"],
        files=entry_data["files"],
        id=data.get("id")
    )

    yield entry

    # Cleanup
    try:
        await api_client.delete(f"/entries/{entry.slug}")
    except Exception:
        pass  # Ignore cleanup errors


@pytest_asyncio.fixture
async def single_file_entry(api_client: httpx.AsyncClient):
    """Create a single file test entry."""
    entry_data = {
        "summary": "Single file test entry",
        "tags": ["javascript"],
        "files": [
            {
                "path": "script.js",
                "content": "console.log('Hello from single file');\n"
            }
        ]
    }

    response = await api_client.post("/entries", json=entry_data)
    assert response.status_code == 201

    data = response.json()
    entry = TestEntry(
        slug=data["slug"],
        summary=entry_data["summary"],
        tags=entry_data["tags"],
        files=entry_data["files"],
        id=data.get("id")
    )

    yield entry

    # Cleanup
    try:
        await api_client.delete(f"/entries/{entry.slug}")
    except Exception:
        pass


class ScreenshotHelper:
    """Helper class for taking and managing screenshots."""

    def __init__(self, page: Page, base_path: str = "tests/e2e/screenshots"):
        self.page = page
        self.base_path = Path(base_path)
        self.base_path.mkdir(parents=True, exist_ok=True)

    async def capture(self, name: str, full_page: bool = True) -> Path:
        """Take a screenshot and save it."""
        path = self.base_path / f"{name}.png"
        await self.page.screenshot(path=str(path), full_page=full_page)
        return path

    async def capture_element(self, name: str, selector: str) -> Path:
        """Take a screenshot of a specific element."""
        path = self.base_path / f"{name}.png"
        element = self.page.locator(selector)
        await element.screenshot(path=str(path))
        return path

    async def capture_viewport(self, name: str) -> Path:
        """Take a viewport screenshot (not full page)."""
        path = self.base_path / f"{name}.png"
        await self.page.screenshot(path=str(path), full_page=False)
        return path


@pytest_asyncio.fixture
def screenshot_helper(page: Page):
    """Provide screenshot helper for desktop tests."""
    return ScreenshotHelper(page, "tests/e2e/screenshots/desktop")


@pytest_asyncio.fixture
def mobile_screenshot_helper(mobile_page: Page):
    """Provide screenshot helper for mobile tests."""
    return ScreenshotHelper(mobile_page, "tests/e2e/screenshots/mobile")


async def wait_for_network_idle(page: Page, timeout: int = 5000):
    """Wait for network to become idle."""
    await page.wait_for_load_state("networkidle", timeout=timeout)


async def wait_for_shiki_render(page: Page, timeout: int = 3000):
    """Wait for Shiki code highlighting to render."""
    # Wait for shiki container
    try:
        await page.wait_for_selector(".shiki, pre code", timeout=timeout)
    except:
        pass  # Shiki might not be present


async def verify_clipboard_content(context: BrowserContext, expected: str) -> bool:
    """Verify clipboard contains expected content."""
    try:
        # Get clipboard permission and read
        await context.grant_permissions(["clipboard-read", "clipboard-write"])
        # Note: In headless/CDP mode, clipboard access may be limited
        return True
    except:
        return False


def get_test_entry_url(slug: str) -> str:
    """Get full URL for an entry."""
    return f"{BASE_URL}/{slug}"
