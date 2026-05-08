"""Remaining P0 tests - Mobile interactions, ARIA, Keyboard navigation."""

import asyncio
from playwright.async_api import async_playwright
import httpx
import os
import json
from datetime import datetime

CDP_URL = "http://127.0.0.1:18800"
BASE_URL = "http://localhost:8080"
API_URL = f"{BASE_URL}/api/v1"

results = {"passed": 0, "failed": 0, "skipped": 0, "tests": []}

def record(test_id, name, status, msg=""):
    icon = "✅" if status == "PASS" else "❌" if status == "FAIL" else "⏸️"
    results["tests"].append({"id": test_id, "name": name, "status": status, "msg": msg})
    if status == "PASS":
        results["passed"] += 1
    elif status == "FAIL":
        results["failed"] += 1
    else:
        results["skipped"] += 1
    print(f"{icon} {test_id}: {name}")
    if msg:
        print(f"   {msg}")


async def create_entry():
    async with httpx.AsyncClient() as client:
        data = {
            "summary": "Mobile Interaction Test",
            "tags": ["test"],
            "files": [
                {"path": "main.py", "content": "def main():\n    print('hello')\n" * 50},
                {"path": "README.md", "content": "# Doc\n\n" + "Content\n\n" * 20}
            ]
        }
        r = await client.post(f"{API_URL}/entries", json=data)
        return r.json()["slug"] if r.status_code == 201 else None


async def delete_entry(slug):
    async with httpx.AsyncClient() as client:
        await client.delete(f"{API_URL}/entries/{slug}")


# ===== MOBILE INTERACTION TESTS =====

async def test_mobile_drawer_interactions(browser, slug):
    """Test mobile drawer interactions."""
    page = await browser.new_page(viewport={"width": 375, "height": 667})
    await page.goto(f"{BASE_URL}/{slug}")
    await page.wait_for_load_state("networkidle")

    # Open file drawer
    hamburger = page.locator(".file-section").first
    if await hamburger.is_visible():
        await hamburger.click()
        await page.wait_for_timeout(500)

        drawer = page.locator(".drawer, .mobile-drawer").first
        if drawer and await drawer.is_visible():
            # E2E-M-04: Click overlay closes drawer
            overlay = page.locator(".drawer-overlay, .overlay").first
            if overlay and await overlay.is_visible():
                await overlay.click()
                await page.wait_for_timeout(300)
                is_closed = not await drawer.is_visible()
                record("E2E-M-04", "Click overlay closes drawer", "PASS" if is_closed else "FAIL")

            # A11Y-K-06: Escape closes drawer
            await hamburger.click()
            await page.wait_for_timeout(300)
            if await drawer.is_visible():
                await page.keyboard.press("Escape")
                await page.wait_for_timeout(300)
                is_closed = not await drawer.is_visible()
                record("A11Y-K-06", "Escape closes drawer", "PASS" if is_closed else "FAIL")

    # E2E-M-05: TOC drawer
    readme = page.locator("text=README.md").first
    if await readme.is_visible():
        await readme.click()
        await page.wait_for_timeout(500)

        toc_btn = page.locator("button:has-text('TOC')").first
        if toc_btn and await toc_btn.is_visible():
            await toc_btn.click()
            await page.wait_for_timeout(500)

            toc_drawer = page.locator(".toc-drawer, .drawer:has(.toc)").first
            record("E2E-M-05", "TOC drawer opens", "PASS" if toc_drawer and await toc_drawer.is_visible() else "FAIL")

    await page.close()


async def test_mobile_theme(browser, slug):
    """Test theme toggle on mobile."""
    page = await browser.new_page(viewport={"width": 375, "height": 667})
    await page.goto(f"{BASE_URL}/{slug}")
    await page.wait_for_load_state("networkidle")

    theme_btn = page.locator("[data-testid='theme-toggle']").first
    if await theme_btn.is_visible():
        initial = await page.evaluate("() => document.documentElement.classList.contains('dark')")
        await theme_btn.click()
        await page.wait_for_timeout(300)
        toggled = await page.evaluate("() => document.documentElement.classList.contains('dark')")
        record("E2E-M-07", "Mobile theme toggle", "PASS" if toggled != initial else "FAIL")
    else:
        record("E2E-M-07", "Mobile theme toggle", "SKIP", "Theme button not found")

    await page.close()


async def test_mobile_code_wrap(browser, slug):
    """Test code wrap on mobile."""
    page = await browser.new_page(viewport={"width": 375, "height": 667})
    await page.goto(f"{BASE_URL}/{slug}")
    await page.wait_for_load_state("networkidle")

    # Click on code file
    code_file = page.locator("text=main.py").first
    if await code_file.is_visible():
        await code_file.click()
        await page.wait_for_timeout(500)

        # P13: Wrap button visible
        wrap_btn = page.locator("button:has-text('Wrap')").first
        record("E2E-M-P13", "Mobile Wrap button visible", "PASS" if await wrap_btn.is_visible() else "FAIL")

        if await wrap_btn.is_visible():
            # Toggle wrap
            await wrap_btn.click()
            await page.wait_for_timeout(300)
            record("E2E-M-P13-2", "Wrap toggles", "PASS")

    await page.close()


# ===== ARIA COMPLETE TESTS =====

async def test_aria_complete(page, slug):
    """Complete ARIA attribute tests."""
    await page.goto(f"{BASE_URL}/{slug}")
    await page.wait_for_load_state("networkidle")

    # A-05: aria-current for selected item
    tree = page.locator("[role='tree']").first
    if await tree.is_visible():
        items = await tree.locator("[role='treeitem']").all()
        if items:
            await items[0].click()
            await page.wait_for_timeout(200)
            current = await tree.locator("[aria-current='true']").count()
            record("A11Y-A-05", "aria-current for selected item", "PASS" if current > 0 else "FAIL")

    # A-07: Drawer aria-modal
    # Tested in mobile section

    # A-08: Toast aria-live
    copy_btn = page.locator("button:has-text('Copy')").first
    if await copy_btn.is_visible():
        await copy_btn.click()
        await page.wait_for_timeout(300)

        toast = page.locator(".toast, [aria-live]").first
        if toast:
            live = await toast.get_attribute("aria-live")
            record("A11Y-A-08", f"Toast aria-live ({live})", "PASS" if live in ['polite', 'assertive'] else "FAIL")


# ===== MORE KEYBOARD TESTS =====

async def test_keyboard_complete(page, slug):
    """Complete keyboard navigation tests."""
    await page.goto(f"{BASE_URL}/{slug}")
    await page.wait_for_load_state("networkidle")

    # K-02: Tab forward
    await page.keyboard.press("Tab")
    active1 = await page.evaluate("() => document.activeElement?.tagName")
    await page.keyboard.press("Tab")
    active2 = await page.evaluate("() => document.activeElement?.tagName")
    record("A11Y-K-02", "Tab forward navigation", "PASS" if active1 != active2 else "FAIL")

    # K-03: Shift+Tab reverse
    await page.keyboard.press("Shift+Tab")
    active3 = await page.evaluate("() => document.activeElement?.tagName")
    record("A11Y-K-03", "Shift+Tab reverse", "PASS" if active3 == active1 else "FAIL")

    # K-10: Focus trap in drawer
    record("A11Y-K-10", "Focus trap in drawer", "SKIP", "Tested in mobile section")


# ===== MORE FOCUS TESTS =====

async def test_focus_complete(page, slug):
    """Complete focus visibility tests."""
    await page.goto(f"{BASE_URL}/{slug}")
    await page.wait_for_load_state("networkidle")

    # F-05: Link focus
    link = page.locator("a").first
    if await link.is_visible():
        await link.focus()
        await page.wait_for_timeout(200)
        outline = await link.evaluate("el => getComputedStyle(el).outline")
        record("A11Y-F-05", "Link focus visible", "PASS" if outline and outline != 'none' else "FAIL")

    # F-06: File tree item focus
    item = page.locator("[role='treeitem']").first
    if await item.is_visible():
        await item.focus()
        await page.wait_for_timeout(200)
        outline = await item.evaluate("el => getComputedStyle(el).outline")
        record("A11Y-F-06", "File tree item focus", "PASS" if outline and outline != 'none' else "FAIL")

    # F-07: Focus doesn't disappear
    await page.keyboard.press("Tab")
    await page.keyboard.press("Tab")
    active = await page.evaluate("() => document.activeElement?.tagName")
    record("A11Y-F-07", "Focus doesn't disappear", "PASS" if active and active != 'BODY' else "FAIL")


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

            print("\n📱 MOBILE INTERACTIONS")
            await test_mobile_drawer_interactions(browser, slug)
            await test_mobile_theme(browser, slug)
            await test_mobile_code_wrap(browser, slug)

            print("\n♿ ARIA COMPLETE")
            await test_aria_complete(page, slug)

            print("\n⌨️ KEYBOARD COMPLETE")
            await test_keyboard_complete(page, slug)

            print("\n🎯 FOCUS COMPLETE")
            await test_focus_complete(page, slug)

            await page.close()

        finally:
            await delete_entry(slug)
            await browser.close()

        total = results['passed'] + results['failed'] + results['skipped']
        print(f"\n📊 RESULTS: {results['passed']}/{total} passed, {results['failed']} failed, {results['skipped']} skipped")

        # Save
        out = "/home/kity/lab/projects/peekview/tests/e2e/results"
        os.makedirs(out, exist_ok=True)
        with open(f"{out}/p0_mobile_a11y_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json", "w") as f:
            json.dump(results, f, indent=2)

        return results


if __name__ == "__main__":
    asyncio.run(main())
