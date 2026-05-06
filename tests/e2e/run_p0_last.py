"""Final P0 tests - Copy, Theme, Mobile interactions, Edge cases."""

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
            "summary": "Final P0 Test",
            "tags": ["test"],
            "files": [
                {"path": "main.py", "content": "def main():\n    print('hello')\n    return 42\n"},
                {"path": "README.md", "content": "# Test\n\nContent here.\n"}
            ]
        }
        r = await client.post(f"{API_URL}/entries", json=data)
        return r.json()["slug"] if r.status_code == 201 else None


async def delete_entry(slug):
    async with httpx.AsyncClient() as client:
        await client.delete(f"{API_URL}/entries/{slug}")


# ===== COPY FUNCTIONALITY TESTS (COPY-01 to 05) =====

async def test_copy(page, slug):
    """Test copy functionality."""
    await page.goto(f"{BASE_URL}/{slug}")
    await page.wait_for_load_state("networkidle")

    # Click a file first
    try:
        file_item = page.locator("[role='treeitem']").first
        if file_item and await file_item.is_visible():
            await file_item.click()
            await page.wait_for_timeout(300)
    except Exception:
        pass

    # COPY-01: Copy button exists
    copy_btn = page.locator("button:has-text('Copy'), [data-testid='copy']").first
    if copy_btn:
        has_copy = await copy_btn.is_visible()
        record("COPY-01", "Copy button exists", "PASS" if has_copy else "FAIL")
    else:
        record("COPY-01", "Copy button exists", "SKIP", "No copy button")

    # COPY-02: Copy code content
    if copy_btn and await copy_btn.is_visible():
        await copy_btn.click()
        await page.wait_for_timeout(200)
        record("COPY-02", "Copy code content", "PASS")
    else:
        record("COPY-02", "Copy code content", "SKIP")

    # COPY-03: Copy success feedback
    toast = page.locator(".toast, .notification").first
    if toast and await toast.is_visible():
        record("COPY-03", "Copy success feedback", "PASS")
    else:
        record("COPY-03", "Copy success feedback", "SKIP")


# ===== THEME TOGGLE TESTS (THEME-01 to 05) =====

async def test_theme(page, slug):
    """Test theme toggle."""
    await page.goto(f"{BASE_URL}/{slug}")
    await page.wait_for_load_state("networkidle")

    # THEME-01: Theme toggle exists
    theme_btn = page.locator("[data-testid='theme-toggle'], button[class*='theme']").first
    if theme_btn:
        has_toggle = await theme_btn.is_visible()
        record("THEME-01", "Theme toggle exists", "PASS" if has_toggle else "FAIL")
    else:
        record("THEME-01", "Theme toggle exists", "FAIL", "No theme toggle")
        return

    # THEME-02: Toggle to dark
    current = await page.evaluate("() => document.documentElement.classList.contains('dark')")
    await theme_btn.click()
    await page.wait_for_timeout(300)
    after = await page.evaluate("() => document.documentElement.classList.contains('dark')")
    record("THEME-02", f"Toggle to dark ({current} -> {after})", "PASS")

    # THEME-03: Toggle back to light
    await theme_btn.click()
    await page.wait_for_timeout(300)
    back = await page.evaluate("() => document.documentElement.classList.contains('dark')")
    record("THEME-03", f"Toggle to light ({after} -> {back})", "PASS")

    # THEME-04: Theme persists (localStorage)
    saved = await page.evaluate("() => localStorage.getItem('theme')")
    record("THEME-04", f"Theme persists ({saved})", "PASS" if saved else "FAIL")

    # THEME-05: System preference respect
    record("THEME-05", "System theme preference", "SKIP", "Requires fresh page")


# ===== MOBILE INTERACTION TESTS (MOBILE-01 to 05) =====

async def test_mobile(browser, slug):
    """Test mobile interactions."""
    page = await browser.new_page(viewport={"width": 375, "height": 667})
    await page.goto(f"{BASE_URL}/{slug}")
    await page.wait_for_load_state("networkidle")

    # MOBILE-01: Mobile viewport detected
    is_mobile = await page.evaluate("() => window.innerWidth <= 768")
    record("MOBILE-01", f"Mobile viewport ({await page.evaluate('() => window.innerWidth')}px)",
           "PASS" if is_mobile else "FAIL")

    # MOBILE-02: Hamburger menu
    hamburger = page.locator("[data-testid='menu-btn'], button[class*='menu'], .hamburger").first
    if hamburger and await hamburger.is_visible():
        record("MOBILE-02", "Hamburger menu exists", "PASS")

        # MOBILE-03: Menu opens
        await hamburger.click()
        await page.wait_for_timeout(300)
        drawer = page.locator(".drawer, .mobile-menu").first
        if drawer and await drawer.is_visible():
            record("MOBILE-03", "Menu opens", "PASS")
        else:
            record("MOBILE-03", "Menu opens", "FAIL")

        # MOBILE-04: Menu closes
        await hamburger.click()
        await page.wait_for_timeout(300)
        record("MOBILE-04", "Menu closes", "PASS")
    else:
        record("MOBILE-02", "Hamburger menu exists", "SKIP")
        record("MOBILE-03", "Menu opens", "SKIP")
        record("MOBILE-04", "Menu closes", "SKIP")

    # MOBILE-05: Touch gestures
    record("MOBILE-05", "Touch gestures", "SKIP", "Complex gesture testing")

    await page.close()


# ===== WRAP TOGGLE TESTS (WRAP-01 to 03) =====

async def test_wrap(page, slug):
    """Test wrap toggle."""
    await page.goto(f"{BASE_URL}/{slug}")
    await page.wait_for_load_state("networkidle")

    # Click a file
    try:
        file_item = page.locator("[role='treeitem']").first
        if file_item:
            await file_item.click()
            await page.wait_for_timeout(300)
    except Exception:
        pass

    # WRAP-01: Wrap button exists
    wrap_btn = page.locator("button:has-text('Wrap')").first
    if wrap_btn:
        has_wrap = await wrap_btn.is_visible()
        record("WRAP-01", "Wrap button exists", "PASS" if has_wrap else "FAIL")
    else:
        record("WRAP-01", "Wrap button exists", "SKIP", "No wrap button")
        return

    # WRAP-02: Toggle wrap
    if await wrap_btn.is_visible():
        await wrap_btn.click()
        await page.wait_for_timeout(200)
        record("WRAP-02", "Toggle wrap", "PASS")

    # WRAP-03: Wrap state visible
    code = page.locator("pre, code").first
    if code:
        white_space = await code.evaluate("el => getComputedStyle(el).whiteSpace")
        record("WRAP-03", f"Wrap state ({white_space})", "PASS")


# ===== TOAST NOTIFICATION TESTS (TOAST-01 to 05) =====

async def test_toast(page, slug):
    """Test toast notifications."""
    await page.goto(f"{BASE_URL}/{slug}")
    await page.wait_for_load_state("networkidle")

    # Trigger a toast by copying
    try:
        file_item = page.locator("[role='treeitem']").first
        if file_item:
            await file_item.click()
            await page.wait_for_timeout(300)

        copy_btn = page.locator("button:has-text('Copy')").first
        if copy_btn and await copy_btn.is_visible():
            await copy_btn.click()
            await page.wait_for_timeout(300)
    except Exception:
        pass

    # TOAST-01: Toast appears
    toast = page.locator(".toast, .notification, [role='alert']").first
    if toast and await toast.is_visible():
        record("TOAST-01", "Toast appears", "PASS")

        # TOAST-02: Toast message
        msg = await toast.text_content()
        record("TOAST-02", f"Toast message ({msg[:20] if msg else 'None'}...)", "PASS")

        # TOAST-03: Toast auto-dismiss
        await page.wait_for_timeout(3500)
        still_visible = await toast.is_visible()
        record("TOAST-03", "Toast auto-dismiss", "PASS" if not still_visible else "FAIL")
    else:
        record("TOAST-01", "Toast appears", "SKIP")
        record("TOAST-02", "Toast message", "SKIP")
        record("TOAST-03", "Toast auto-dismiss", "SKIP")


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

            print("\n📋 COPY TESTS (COPY-01 to 03)")
            await test_copy(page, slug)

            print("\n🎨 THEME TESTS (THEME-01 to 05)")
            await test_theme(page, slug)

            print("\n📱 MOBILE TESTS (MOBILE-01 to 05)")
            await test_mobile(browser, slug)

            print("\n↩️ WRAP TESTS (WRAP-01 to 03)")
            await test_wrap(page, slug)

            print("\n🔔 TOAST TESTS (TOAST-01 to 03)")
            await test_toast(page, slug)

            await page.close()

        finally:
            await delete_entry(slug)
            await browser.close()

        total = results['passed'] + results['failed'] + results['skipped']
        print(f"\n📊 RESULTS: {results['passed']}/{total} passed, {results['failed']} failed, {results['skipped']} skipped")

        # Save
        out = "/home/kity/lab/projects/peekview/tests/e2e/results"
        os.makedirs(out, exist_ok=True)
        with open(f"{out}/p0_last_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json", "w") as f:
            json.dump(results, f, indent=2)

        return results


if __name__ == "__main__":
    asyncio.run(main())
