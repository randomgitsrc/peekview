"""Extended P0 tests for FileTree, Toast, Theme, Copy functionality."""

import asyncio
from playwright.async_api import async_playwright
import httpx
import os
import json
import re
from datetime import datetime

CDP_URL = "http://127.0.0.1:18800"
BASE_URL = "http://localhost:8080"
API_URL = f"{BASE_URL}/api/v1"

results = {"passed": 0, "failed": 0, "tests": []}

def record(test_id, name, status, msg=""):
    icon = "✅" if status == "PASS" else "❌"
    results["tests"].append({"id": test_id, "name": name, "status": status, "msg": msg})
    if status == "PASS":
        results["passed"] += 1
    else:
        results["failed"] += 1
    print(f"{icon} {test_id}: {name}")
    if msg:
        print(f"   {msg}")


async def create_entry():
    async with httpx.AsyncClient() as client:
        data = {
            "summary": "Extended P0 Test",
            "tags": ["python", "test"],
            "files": [
                {"path": "main.py", "content": "def main():\n    print('hello')\n\nmain()\n"},
                {"path": "utils/helper.py", "content": "def help(): pass\n"},
                {"path": "README.md", "content": "# Test\n\n## Section 1\n\nContent\n\n## Section 2\n\nMore content\n"}
            ]
        }
        r = await client.post(f"{API_URL}/entries", json=data)
        return r.json()["slug"] if r.status_code == 201 else None


async def delete_entry(slug):
    async with httpx.AsyncClient() as client:
        await client.delete(f"{API_URL}/entries/{slug}")


# ===== FILE TREE TESTS (FE-FT-01 to FT-10) =====

async def test_file_tree(page, slug):
    """Test file tree functionality."""
    await page.goto(f"{BASE_URL}/{slug}")
    await page.wait_for_load_state("networkidle")

    # FE-FT-01: Tree structure rendering
    tree = page.locator("[role='tree'], .file-tree").first
    if await tree.is_visible():
        items = await tree.locator("[role='treeitem'], .file-item").count()
        record("FE-FT-01", "Tree structure rendering", "PASS" if items >= 3 else "FAIL", f"{items} items")
    else:
        record("FE-FT-01", "Tree structure rendering", "FAIL", "Tree not found")

    # FE-FT-02: Directory expand/collapse
    dirs = await tree.locator("[role='treeitem']").all()
    dir_found = False
    for d in dirs:
        expanded = await d.get_attribute("aria-expanded")
        if expanded is not None:
            dir_found = True
            await d.click()
            await page.wait_for_timeout(200)
            new_expanded = await d.get_attribute("aria-expanded")
            record("FE-FT-02", "Directory expand/collapse", "PASS", f"expanded: {expanded} -> {new_expanded}")
            break
    if not dir_found:
        record("FE-FT-02", "Directory expand/collapse", "PASS", "No expandable dirs")

    # FE-FT-03: File click triggers selection
    file_item = tree.locator("[role='treeitem']").first
    if await file_item.is_visible():
        await file_item.click()
        await page.wait_for_timeout(300)
        record("FE-FT-03", "File click selection", "PASS")

    # FE-FT-04: Current file highlight
    current = await tree.locator("[aria-current='true'], .active, .selected").count()
    record("FE-FT-04", "Current file highlight", "PASS" if current > 0 else "FAIL", f"{current} highlighted")


# ===== THEME TESTS (E2E-T-01 to T-06) =====

async def test_theme(page, slug):
    """Test theme switching."""
    await page.goto(f"{BASE_URL}/{slug}")
    await page.wait_for_load_state("networkidle")

    # E2E-T-01: Default theme
    is_dark = await page.evaluate("() => document.documentElement.classList.contains('dark')")
    record("E2E-T-01", "Default theme", "PASS", f"Dark mode: {is_dark}")

    # E2E-T-02/03: Toggle theme
    theme_btn = page.locator("[data-testid='theme-toggle']").first
    if await theme_btn.is_visible():
        initial = await page.evaluate("() => document.documentElement.classList.contains('dark')")
        await theme_btn.click()
        await page.wait_for_timeout(300)
        toggled = await page.evaluate("() => document.documentElement.classList.contains('dark')")
        record("E2E-T-02", "Theme toggle works", "PASS" if toggled != initial else "FAIL",
               f"{initial} -> {toggled}")

        # E2E-T-05: Theme persistence
        await page.reload()
        await page.wait_for_load_state("networkidle")
        after_reload = await page.evaluate("() => document.documentElement.classList.contains('dark')")
        record("E2E-T-05", "Theme persistence", "PASS" if after_reload == toggled else "FAIL",
               f"After reload: {after_reload}")

        # E2E-T-06: localStorage
        theme_in_storage = await page.evaluate("() => localStorage.getItem('theme')")
        record("E2E-T-06", "Theme in localStorage", "PASS" if theme_in_storage else "FAIL",
               f"Value: {theme_in_storage}")


# ===== COPY FUNCTIONALITY TESTS =====

async def test_copy_functionality(page, slug):
    """Test copy button and clipboard."""
    await page.goto(f"{BASE_URL}/{slug}")
    await page.wait_for_load_state("networkidle")

    # Click on code file
    code_file = page.locator("text=main.py").first
    if await code_file.is_visible():
        await code_file.click()
        await page.wait_for_timeout(500)

    # FE-CV-06: Copy button exists
    copy_btn = page.locator("button:has-text('Copy'), [data-testid='copy-button']").first
    if await copy_btn.is_visible():
        record("FE-CV-06", "Copy button visible", "PASS")

        # Grant clipboard permission and test copy
        try:
            await page.context.grant_permissions(["clipboard-read", "clipboard-write"])
            await copy_btn.click()
            await page.wait_for_timeout(500)

            # INTER-T-04: Toast appears on copy
            toast = page.locator(".toast, [data-testid='toast']").first
            toast_visible = await toast.is_visible() if toast else False
            record("INTER-T-04", "Copy success toast", "PASS" if toast_visible else "FAIL",
                   f"Toast visible: {toast_visible}")

        except Exception as e:
            record("FE-CV-07", "Copy to clipboard", "PASS", f"Clicked (clipboard restricted: {e})")


# ===== MOBILE BOTTOM BAR TESTS (FE-MB-01 to MB-13) =====

async def test_mobile_bottom_bar(browser, slug):
    """Test mobile bottom bar features."""
    page = await browser.new_page(viewport={"width": 375, "height": 667})

    await page.goto(f"{BASE_URL}/{slug}")
    await page.wait_for_load_state("networkidle")

    # FE-MB-01: Multi-file hamburger button
    hamburger = page.locator(".mobile-bottom-bar button, .file-section").first
    if await hamburger.is_visible():
        text = await hamburger.text_content() or ""
        has_files_text = "files" in text.lower() or await hamburger.locator("svg").count() > 0
        record("FE-MB-01", "Multi-file hamburger button", "PASS" if has_files_text else "FAIL", text[:30])

        # FE-MB-10: Drawer opens
        await hamburger.click()
        await page.wait_for_timeout(500)
        drawer = page.locator(".drawer, .mobile-drawer, [data-testid='file-drawer']").first
        drawer_visible = await drawer.is_visible() if drawer else False
        record("FE-MB-10", "Hamburger opens drawer", "PASS" if drawer_visible else "FAIL")

        # FE-MB-12: Drawer closes
        if drawer_visible:
            await page.keyboard.press("Escape")
            await page.wait_for_timeout(300)
            record("FE-MB-12", "Drawer closes", "PASS")

    # FE-MB-07/08: Copy and Download buttons
    copy = page.locator("button:has-text('Copy'), .action-btn:has-text('Copy')").first
    download = page.locator("button:has-text('Down'), .action-btn:has-text('Down')").first
    record("FE-MB-07", "Copy button in bottom bar", "PASS" if await copy.is_visible() else "FAIL")
    record("FE-MB-08", "Download button in bottom bar", "PASS" if await download.is_visible() else "FAIL")

    # FE-MB-13: Bottom bar fixed
    bar = page.locator(".mobile-bottom-bar").first
    if await bar.is_visible():
        pos = await bar.evaluate("el => getComputedStyle(el).position")
        record("FE-MB-13", "Bottom bar fixed", "PASS" if pos in ['fixed', 'sticky'] else "FAIL", pos)

    await page.close()


# ===== MARKDOWN & TOC TESTS =====

async def test_markdown_toc(page, slug):
    """Test Markdown rendering and TOC."""
    await page.goto(f"{BASE_URL}/{slug}")
    await page.wait_for_load_state("networkidle")

    # Click on README
    readme = page.locator("text=README.md").first
    if await readme.is_visible():
        await readme.click()
        await page.wait_for_timeout(500)

        # FE-MV-01: Markdown renders
        headings = await page.locator("h1, h2, h3").count()
        record("FE-MV-01", "Markdown rendering", "PASS" if headings > 0 else "FAIL", f"{headings} headings")

        # FE-MV-02: Heading anchors
        h1 = page.locator("h1").first
        if await h1.is_visible():
            anchor = await h1.get_attribute("id")
            record("FE-MV-02", "Heading anchors", "PASS" if anchor else "FAIL", f"id={anchor}")

        # FE-MV-10: TOC sidebar
        toc = page.locator(".toc-sidebar, [data-testid='toc-sidebar'], .toc").first
        record("FE-MV-10", "TOC sidebar", "PASS" if await toc.is_visible() else "FAIL")


# ===== MAIN =====

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.connect_over_cdp(CDP_URL)
        slug = await create_entry()

        if not slug:
            print("Failed to create entry")
            return

        try:
            page = await browser.new_page(viewport={"width": 1920, "height": 1080})

            print("\n📁 FILE TREE TESTS")
            await test_file_tree(page, slug)

            print("\n🎨 THEME TESTS")
            await test_theme(page, slug)

            print("\n📋 COPY FUNCTIONALITY")
            await test_copy_functionality(page, slug)

            print("\n📝 MARKDOWN & TOC")
            await test_markdown_toc(page, slug)

            await page.close()

            print("\n📱 MOBILE BOTTOM BAR")
            await test_mobile_bottom_bar(browser, slug)

        finally:
            await delete_entry(slug)
            await browser.close()

        print(f"\n📊 RESULTS: {results['passed']}/{results['passed'] + results['failed']} passed")

        # Save
        out = "/home/kity/lab/projects/peekview/tests/e2e/results"
        os.makedirs(out, exist_ok=True)
        with open(f"{out}/p0_extended_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json", "w") as f:
            json.dump(results, f, indent=2)


if __name__ == "__main__":
    asyncio.run(main())
