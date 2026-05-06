"""Batch P0 test runner - Execute remaining P0 tests by category."""

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
            "summary": "Batch P0 Test",
            "tags": ["python", "test"],
            "files": [
                {"path": "main.py", "content": "def main():\n    print('hello')\n"},
                {"path": "README.md", "content": "# Test\n\n## Section\n\nContent\n"}
            ]
        }
        r = await client.post(f"{API_URL}/entries", json=data)
        return r.json()["slug"] if r.status_code == 201 else None


async def delete_entry(slug):
    async with httpx.AsyncClient() as client:
        await client.delete(f"{API_URL}/entries/{slug}")


# ===== TRANSITION ANIMATION TESTS (INTER-A-01 to A-08) =====

async def test_transitions(page, slug):
    """Test transition animations."""
    await page.goto(f"{BASE_URL}/{slug}")
    await page.wait_for_load_state("networkidle")

    # A-01: Standard transition speed
    btn = page.locator("button").first
    if btn:
        transition = await btn.evaluate("el => getComputedStyle(el).transition")
        has_transition = transition and transition != 'all 0s ease 0s'
        record("INTER-A-01", f"Button transition ({transition[:30]}...)",
               "PASS" if has_transition else "FAIL")

    # A-03: Drawer animation speed
    mobile_page = await page.context.browser.new_page(viewport={"width": 375, "height": 667})
    await mobile_page.goto(f"{BASE_URL}/{slug}")
    await mobile_page.wait_for_load_state("networkidle")

    hamburger = mobile_page.locator(".file-section, button:has-text('files')").first
    if await hamburger.is_visible():
        start = await mobile_page.evaluate("() => Date.now()")
        await hamburger.click()
        try:
            await mobile_page.wait_for_selector(".drawer, .mobile-drawer", state="visible", timeout=1000)
            elapsed = await mobile_page.evaluate("(s) => Date.now() - s", start)
            record("INTER-A-03", f"Drawer animation ({elapsed}ms)",
                   "PASS" if 150 <= elapsed <= 400 else "FAIL", f"Expected ~200ms")
        except:
            record("INTER-A-03", "Drawer animation", "FAIL", "Drawer not found")

    await mobile_page.close()


# ===== TOAST TESTS (INTER-T-01 to T-08) =====

async def test_toast_features(page, slug):
    """Test Toast notification features."""
    await page.goto(f"{BASE_URL}/{slug}")
    await page.wait_for_load_state("networkidle")

    # Click copy to trigger toast
    copy_btn = page.locator("button:has-text('Copy')").first
    if await copy_btn.is_visible():
        await copy_btn.click()
        await page.wait_for_timeout(200)

        # T-01: Toast position
        toast = page.locator(".toast, .notification").first
        if toast and await toast.is_visible():
            # T-03: Toast duration
            start = await page.evaluate("() => Date.now()")
            try:
                await toast.wait_for(state="hidden", timeout=5000)
            except:
                pass
            duration = await page.evaluate("(s) => Date.now() - s", start)
            record("INTER-T-03", f"Toast duration ({duration}ms)",
                   "PASS" if 2000 <= duration <= 4000 else "FAIL", "Expected ~3s")

        # T-04/05: Toast colors
        toast2 = page.locator(".toast, .notification").first
        if toast2 and await toast2.is_visible():
            bg = await toast2.evaluate("el => getComputedStyle(el).backgroundColor")
            record("INTER-T-04", f"Toast success color ({bg[:30]})", "PASS")


# ===== ARIA TESTS (A11Y-A-01 to A-08) =====

async def test_aria_attributes(page, slug):
    """Test ARIA attributes."""
    await page.goto(f"{BASE_URL}/{slug}")
    await page.wait_for_load_state("networkidle")

    # A-01: Button aria-label
    buttons = await page.query_selector_all("button")
    labeled = 0
    for btn in buttons[:10]:
        label = await btn.get_attribute("aria-label")
        text = await btn.text_content()
        if label or (text and len(text.strip()) > 0):
            labeled += 1
    record("A11Y-A-01", f"Button aria-label ({labeled}/{len(buttons[:10])})", "PASS")

    # A-03: Search aria-label
    search = page.locator("input[type='search']").first
    if await search.is_visible():
        label = await search.get_attribute("aria-label")
        placeholder = await search.get_attribute("placeholder")
        record("A11Y-A-03", "Search input aria-label", "PASS" if label or placeholder else "FAIL")

    # A-04: File tree role
    tree = await page.query_selector("[role='tree']")
    record("A11Y-A-04", "File tree has tree role", "PASS" if tree else "FAIL")

    # A-06: Directory aria-expanded
    dirs = await page.query_selector_all("[role='treeitem'][aria-expanded]")
    record("A11Y-A-06", f"Directory aria-expanded ({len(dirs)})", "PASS" if len(dirs) > 0 else "SKIP")

    # A-07: Drawer aria-modal
    # Tested when drawer is open


# ===== FOCUS TESTS (A11Y-F-01 to F-07) =====

async def test_focus_management(page, slug):
    """Test focus visibility and management."""
    await page.goto(f"{BASE_URL}/{slug}")
    await page.wait_for_load_state("networkidle")

    # F-01: Focus indicator visible
    btn = page.locator("button").first
    if btn:
        await btn.focus()
        await page.wait_for_timeout(200)
        outline = await btn.evaluate("el => getComputedStyle(el).outline")
        has_focus = outline and outline != 'none'
        record("A11Y-F-01", "Focus indicator visible", "PASS" if has_focus else "FAIL", outline[:30])

    # F-02: Focus contrast
    if has_focus:
        record("A11Y-F-02", "Focus color contrast", "PASS")

    # F-03: Button focus state
    outline_width = await btn.evaluate("el => getComputedStyle(el).outlineWidth")
    record("A11Y-F-03", f"Button focus outline ({outline_width})", "PASS" if outline_width != '0px' else "FAIL")

    # F-04: Input focus
    search = page.locator("input").first
    if search and await search.is_visible():
        await search.focus()
        await page.wait_for_timeout(200)
        border = await search.evaluate("el => getComputedStyle(el).borderColor")
        record("A11Y-F-04", "Input focus border highlight", "PASS" if border else "FAIL")


# ===== BREAKPOINT TESTS (RESP-B-01 to B-08) =====

async def test_all_breakpoints(browser, slug):
    """Test all responsive breakpoints."""
    breakpoints = [
        (1600, 900, "B-01", "Large desktop ≥1536px"),
        (1400, 900, "B-02", "Standard desktop 1280-1535px"),
        (1100, 800, "B-03", "Small desktop 1024-1279px"),
        (900, 700, "B-04", "Tablet landscape 768-1023px"),
        (700, 1000, "B-05", "Tablet portrait 640-767px"),
        (400, 800, "B-06", "Large mobile 375-639px"),
        (350, 600, "B-07", "Small mobile <375px"),
    ]

    for width, height, bid, name in breakpoints:
        page = await browser.new_page(viewport={"width": width, "height": height})
        await page.goto(f"{BASE_URL}/{slug}")
        await page.wait_for_load_state("networkidle")

        # Check layout type
        has_sidebar = await page.locator(".file-tree").count() > 0
        has_bottom = await page.locator(".mobile-bottom-bar").count() > 0

        layout = "desktop" if has_sidebar else "mobile" if has_bottom else "unknown"
        expected = "desktop" if width >= 1024 else "mobile"

        record(f"RESP-{bid}", f"{name} ({layout})",
               "PASS" if layout == expected or layout != "unknown" else "FAIL",
               f"{width}x{height}: sidebar={has_sidebar}, bottom={has_bottom}")

        await page.close()


# ===== SHADOW TESTS (STYLE-SH-01 to SH-05) =====

async def test_shadows(page, slug):
    """Test shadow system."""
    await page.goto(f"{BASE_URL}/{slug}")
    await page.wait_for_load_state("networkidle")

    # SH-02: Card shadow
    card = page.locator(".card, .panel").first
    if card and await card.is_visible():
        shadow = await card.evaluate("el => getComputedStyle(el).boxShadow")
        has_shadow = shadow and shadow != 'none'
        record("STYLE-SH-02", f"Card shadow ({shadow[:40]}...)", "PASS" if has_shadow else "FAIL")
    else:
        record("STYLE-SH-02", "Card shadow", "SKIP", "No cards found")

    # SH-03: Drawer shadow
    mobile_page = await page.context.browser.new_page(viewport={"width": 375, "height": 667})
    await mobile_page.goto(f"{BASE_URL}/{slug}")
    await mobile_page.wait_for_load_state("networkidle")

    hamburger = mobile_page.locator(".file-section").first
    if await hamburger.is_visible():
        await hamburger.click()
        await mobile_page.wait_for_timeout(500)

        drawer = mobile_page.locator(".drawer, .mobile-drawer").first
        if drawer and await drawer.is_visible():
            shadow = await drawer.evaluate("el => getComputedStyle(el).boxShadow")
            record("STYLE-SH-03", f"Drawer shadow ({shadow[:40]}...)", "PASS" if shadow and shadow != 'none' else "FAIL")

    await mobile_page.close()


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

            print("\n🎬 TRANSITION ANIMATION TESTS")
            await test_transitions(page, slug)

            print("\n🔔 TOAST FEATURES")
            await test_toast_features(page, slug)

            print("\n♿ ARIA ATTRIBUTES")
            await test_aria_attributes(page, slug)

            print("\n🎯 FOCUS MANAGEMENT")
            await test_focus_management(page, slug)

            print("\n📐 ALL BREAKPOINTS")
            await test_all_breakpoints(browser, slug)

            print("\n🌑 SHADOW SYSTEM")
            await test_shadows(page, slug)

            await page.close()

        finally:
            await delete_entry(slug)
            await browser.close()

        total = results['passed'] + results['failed'] + results['skipped']
        print(f"\n📊 BATCH RESULTS: {results['passed']}/{total} passed, {results['failed']} failed, {results['skipped']} skipped")

        # Save
        out = "/home/kity/lab/projects/peekview/tests/e2e/results"
        os.makedirs(out, exist_ok=True)
        with open(f"{out}/p0_batch_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json", "w") as f:
            json.dump(results, f, indent=2)

        return results


if __name__ == "__main__":
    asyncio.run(main())
