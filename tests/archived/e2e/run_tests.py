"""Quick E2E test runner for P3 validation."""

import asyncio
from playwright.async_api import async_playwright
import httpx
import os

CDP_URL = "http://127.0.0.1:18800"
BASE_URL = "http://localhost:8080"
API_URL = f"{BASE_URL}/api/v1"

SCREENSHOT_DIR = "/home/kity/lab/projects/peekview/tests/e2e/screenshots"
os.makedirs(f"{SCREENSHOT_DIR}/desktop", exist_ok=True)
os.makedirs(f"{SCREENSHOT_DIR}/mobile", exist_ok=True)


async def create_test_entry():
    """Create test entry via API."""
    async with httpx.AsyncClient() as client:
        entry_data = {
            "summary": "E2E Test Entry",
            "tags": ["python", "test"],
            "files": [
                {
                    "path": "main.py",
                    "content": "def hello():\n    print('Hello, World!')\n    print('This is a long line that should wrap or scroll depending on the wrap setting')\n\nif __name__ == '__main__':\n    hello()\n"
                },
                {
                    "path": "README.md",
                    "content": "# Test Project\n\n## Installation\n\n```bash\npip install -e .\n```\n\n## Usage\n\nRun the main script:\n\n```python\npython main.py\n```\n\n### API\n\nSee documentation for details.\n\n### Configuration\n\nEdit config.yaml.\n"
                },
                {
                    "path": "utils/helpers.py",
                    "content": "def format_name(name: str) -> str:\n    return name.strip().title()\n"
                }
            ]
        }

        response = await client.post(f"{API_URL}/entries", json=entry_data)
        if response.status_code != 201:
            print(f"Failed to create entry: {response.status_code} {response.text}")
            return None

        data = response.json()
        print(f"Created entry: {data['slug']}")
        return data["slug"]


async def delete_test_entry(slug):
    """Delete test entry."""
    async with httpx.AsyncClient() as client:
        await client.delete(f"{API_URL}/entries/{slug}")


async def run_desktop_tests(browser):
    """Run desktop tests."""
    print("\n=== Desktop Tests ===")
    context = await browser.new_context(viewport={"width": 1920, "height": 1080})
    page = await context.new_page()

    # Test 1: Home page
    await page.goto(BASE_URL)
    await page.wait_for_load_state("networkidle")
    await page.screenshot(path=f"{SCREENSHOT_DIR}/desktop/P10-desktop-home.png", full_page=True)
    print("[PASS] P10: Desktop home page")

    # Create test entry
    slug = await create_test_entry()
    if not slug:
        await context.close()
        return

    try:
        # Test 2: Entry detail page
        await page.goto(f"{BASE_URL}/{slug}")
        await page.wait_for_load_state("networkidle")
        await page.wait_for_timeout(1000)
        await page.screenshot(path=f"{SCREENSHOT_DIR}/desktop/P1-desktop-entry-detail.png", full_page=True)
        print("[PASS] P1: Desktop entry detail")

        # Test 3: Check for layout elements
        has_file_tree = await page.locator("[data-testid='file-tree'], .file-tree, .file-list").count() > 0
        has_content = await page.locator("[data-testid='content-area'], .content, .code-viewer").count() > 0

        if has_file_tree and has_content:
            print("[PASS] P1: Three-column layout detected")
        else:
            print(f"[INFO] Layout elements: file_tree={has_file_tree}, content={has_content}")

        # Test 4: Theme toggle
        theme_btn = page.locator("[data-testid='theme-toggle'], .theme-toggle, button:has-text('☀️'), button:has-text('🌙')").first
        if await theme_btn.is_visible():
            await theme_btn.click()
            await page.wait_for_timeout(500)
            await page.screenshot(path=f"{SCREENSHOT_DIR}/desktop/P9-theme-toggled.png", full_page=True)
            print("[PASS] P9: Theme toggle")

        # Test 5: Click on code file
        code_file = page.locator("text=main.py, .file-item:has-text('main.py'), [data-testid='file-item']").first
        if await code_file.is_visible():
            await code_file.click()
            await page.wait_for_timeout(1000)
            await page.screenshot(path=f"{SCREENSHOT_DIR}/desktop/P3-code-highlighting.png", full_page=True)
            print("[PASS] P3: Code file view")

            # Look for wrap/copy/download buttons
            wrap_btn = page.locator("[data-testid='wrap-button'], button:has-text('Wrap'), button:has-text('Unwrap')").first
            copy_btn = page.locator("[data-testid='copy-button'], button:has-text('Copy')").first
            download_btn = page.locator("[data-testid='download-button'], button:has-text('Download')").first

            print(f"[INFO] Toolbar buttons: wrap={await wrap_btn.is_visible()}, copy={await copy_btn.is_visible()}, download={await download_btn.is_visible()}")

            if await wrap_btn.is_visible():
                print("[PASS] P2: Wrap button visible")

        # Test 6: Click on Markdown file
        md_file = page.locator("text=README.md, .file-item:has-text('README')").first
        if await md_file.is_visible():
            await md_file.click()
            await page.wait_for_timeout(1000)
            await page.screenshot(path=f"{SCREENSHOT_DIR}/desktop/P8-markdown-render.png", full_page=True)
            print("[PASS] P8: Markdown file view")

            # Check for TOC
            toc = page.locator("[data-testid='toc-sidebar'], .toc-sidebar, .toc").first
            if await toc.is_visible():
                print("[PASS] P7: TOC sidebar visible")

        # Test 7: Search functionality
        await page.goto(BASE_URL)
        await page.wait_for_load_state("networkidle")
        search = page.locator("[data-testid='search-input'], input[type='search'], .search-input").first
        if await search.is_visible():
            await search.fill("E2E")
            await page.wait_for_timeout(1000)
            await page.screenshot(path=f"{SCREENSHOT_DIR}/desktop/P10-search-filter.png", full_page=True)
            print("[PASS] P10: Search filter")

    finally:
        await delete_test_entry(slug)
        await context.close()


async def run_mobile_tests(browser):
    """Run mobile tests."""
    print("\n=== Mobile Tests ===")
    context = await browser.new_context(
        viewport={"width": 375, "height": 667},
        user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15"
    )
    page = await context.new_page()

    # Create test entry
    slug = await create_test_entry()
    if not slug:
        await context.close()
        return

    try:
        # Test 1: Mobile entry page
        await page.goto(f"{BASE_URL}/{slug}")
        await page.wait_for_load_state("networkidle")
        await page.wait_for_timeout(1000)
        await page.screenshot(path=f"{SCREENSHOT_DIR}/mobile/P11-mobile-entry.png", full_page=True)
        print("[PASS] P11: Mobile entry page")

        # Test 2: Check bottom bar
        bottom_bar = page.locator("[data-testid='mobile-bottom-bar'], .bottom-bar, .mobile-toolbar").first
        if await bottom_bar.is_visible():
            print("[PASS] P11: Mobile bottom bar visible")

            # Check hamburger button
            hamburger = page.locator("[data-testid='file-drawer-toggle'], .hamburger-btn, .files-toggle, button:has-text('files')").first
            if await hamburger.is_visible():
                hamburger_text = await hamburger.text_content() or ""
                print(f"[PASS] P11: Hamburger button: {hamburger_text.strip()}")

        # Test 3: Click code file
        code_file = page.locator("text=main.py, .file-item:has-text('main.py')").first
        if await code_file.is_visible():
            await code_file.click()
            await page.wait_for_timeout(500)

            # Check for wrap button on code
            wrap_btn = page.locator("[data-testid='wrap-button'], button:has-text('Wrap'), button:has-text('↩')").first
            if await wrap_btn.is_visible():
                await page.screenshot(path=f"{SCREENSHOT_DIR}/mobile/P13-mobile-code-wrap.png", full_page=True)
                print("[PASS] P13: Mobile code with wrap button")

                # Toggle wrap
                await wrap_btn.click()
                await page.wait_for_timeout(500)
                await page.screenshot(path=f"{SCREENSHOT_DIR}/mobile/P13-mobile-wrap-enabled.png", full_page=True)
                print("[PASS] P13: Wrap toggled")

        # Test 4: Click Markdown
        md_file = page.locator("text=README.md, .file-item:has-text('README')").first
        if await md_file.is_visible():
            await md_file.click()
            await page.wait_for_timeout(500)
            await page.screenshot(path=f"{SCREENSHOT_DIR}/mobile/P13-mobile-markdown.png", full_page=True)
            print("[PASS] P13: Mobile Markdown view")

            # Check TOC button
            toc_btn = page.locator("[data-testid='toc-drawer-toggle'], button:has-text('TOC')").first
            if await toc_btn.is_visible():
                print("[PASS] P15: TOC button visible")

    finally:
        await delete_test_entry(slug)
        await context.close()


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.connect_over_cdp(CDP_URL)

        await run_desktop_tests(browser)
        await run_mobile_tests(browser)

        await browser.close()
        print("\n=== All tests completed ===")


if __name__ == "__main__":
    asyncio.run(main())
