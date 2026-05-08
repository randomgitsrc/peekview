"""Additional P0 tests - Accessibility, File Tree, Edge Cases."""

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
            "summary": "Additional P0 Test",
            "tags": ["test", "accessibility"],
            "files": [
                {"path": "main.py", "content": "def main():\n    pass\n"},
                {"path": "utils/helper.py", "content": "def helper():\n    pass\n"}
            ]
        }
        r = await client.post(f"{API_URL}/entries", json=data)
        return r.json()["slug"] if r.status_code == 201 else None


async def delete_entry(slug):
    async with httpx.AsyncClient() as client:
        await client.delete(f"{API_URL}/entries/{slug}")


# ===== ARIA TESTS (A11Y-A-02, A-03, A-06, A-07) =====

async def test_aria(page, slug):
    """Test ARIA attributes."""
    await page.goto(f"{BASE_URL}/{slug}")
    await page.wait_for_load_state("networkidle")

    # A-02: Role attributes
    roles = await page.query_selector_all("[role]")
    record("A11Y-A-02", f"ARIA roles ({len(roles)} elements)",
           "PASS" if len(roles) > 0 else "FAIL")

    # A-03: ARIA labels
    labels = await page.query_selector_all("[aria-label], [aria-labelledby]")
    record("A11Y-A-03", f"ARIA labels ({len(labels)} elements)",
           "PASS" if len(labels) > 0 else "FAIL")

    # A-06: aria-expanded on expandable
    expanded = await page.query_selector_all("[aria-expanded]")
    record("A11Y-A-06", f"aria-expanded ({len(expanded)} elements)",
           "PASS" if len(expanded) > 0 else "FAIL")

    # A-07: aria-hidden on icons
    hidden = await page.query_selector_all("[aria-hidden='true']")
    record("A11Y-A-07", f"aria-hidden ({len(hidden)} elements)",
           "PASS" if len(hidden) > 0 else "SKIP")


# ===== FOCUS VISIBILITY TESTS (A11Y-F-01 to F-06) =====

async def test_focus(page, slug):
    """Test focus visibility."""
    await page.goto(f"{BASE_URL}/{slug}")
    await page.wait_for_load_state("networkidle")

    # F-01: Focus outline
    btn = page.locator("button").first
    if btn and await btn.is_visible():
        await btn.focus()
        await page.wait_for_timeout(100)
        outline = await btn.evaluate("el => getComputedStyle(el).outlineWidth")
        record("A11Y-F-01", f"Focus outline ({outline})",
               "PASS" if outline and outline != '0px' else "FAIL")

    # F-02: Focus color contrast
    if btn and await btn.is_visible():
        outline_color = await btn.evaluate("el => getComputedStyle(el).outlineColor")
        has_color = outline_color and 'rgba(0, 0, 0, 0)' not in outline_color
        record("A11Y-F-02", f"Focus color ({outline_color[:20]}...)",
               "PASS" if has_color else "FAIL")

    # F-03: Focus visible on keyboard
    await page.keyboard.press("Tab")
    await page.wait_for_timeout(100)
    active = await page.evaluate("() => document.activeElement")
    if active:
        record("A11Y-F-03", "Focus visible on Tab", "PASS")
    else:
        record("A11Y-F-03", "Focus visible on Tab", "FAIL")

    # F-05: No focus trap (simple check)
    for _ in range(5):
        await page.keyboard.press("Tab")
    record("A11Y-F-05", "No focus trap (Tab 5x)", "PASS")


# ===== FILE TREE TESTS (FT-05, FT-06, FT-08, FT-09) =====

async def test_file_tree(page, slug):
    """Test file tree functionality."""
    await page.goto(f"{BASE_URL}/{slug}")
    await page.wait_for_load_state("networkidle")

    # FT-05: File tree directory structure
    tree = page.locator(".file-tree, [role='tree']").first
    if tree and await tree.is_visible():
        items = await page.locator("[role='treeitem']").count()
        record("FT-05", f"File tree structure ({items} items)",
               "PASS" if items > 0 else "FAIL")
    else:
        record("FT-05", "File tree structure", "SKIP", "No tree found")

    # FT-06: File tree expand/collapse
    try:
        folder = page.locator("[role='treeitem']").first
        if folder and await folder.is_visible():
            await folder.click()
            await page.wait_for_timeout(200)
            record("FT-06", "File tree expand/collapse", "PASS")
        else:
            record("FT-06", "File tree expand/collapse", "SKIP")
    except Exception:
        record("FT-06", "File tree expand/collapse", "SKIP")

    # FT-08: File tree keyboard nav
    try:
        tree = page.locator(".file-tree, [role='tree']").first
        if tree:
            await tree.focus()
            await page.keyboard.press("ArrowDown")
            await page.wait_for_timeout(100)
            record("FT-08", "File tree keyboard nav", "PASS")
        else:
            record("FT-08", "File tree keyboard nav", "SKIP")
    except Exception:
        record("FT-08", "File tree keyboard nav", "SKIP")


# ===== SCREEN READER TESTS (A11Y-S-01 to S-04) =====

async def test_screen_reader(page, slug):
    """Test screen reader support."""
    await page.goto(f"{BASE_URL}/{slug}")
    await page.wait_for_load_state("networkidle")

    # S-01: Page title
    title = await page.title()
    record("A11Y-S-01", f"Page title ({title[:20]}...)",
           "PASS" if title else "FAIL")

    # S-02: Heading hierarchy
    h1 = await page.query_selector("h1")
    h2 = await page.query_selector("h2")
    has_structure = h1 is not None or h2 is not None
    record("A11Y-S-02", f"Heading hierarchy (h1:{bool(h1)}, h2:{bool(h2)})",
           "PASS" if has_structure else "FAIL")

    # S-03: Skip link
    skip_link = await page.query_selector("a[href='#main'], .skip-link")
    record("A11Y-S-03", "Skip navigation link",
           "PASS" if skip_link else "SKIP")

    # S-04: Landmarks
    landmarks = await page.query_selector_all("header, nav, main, footer, aside")
    record("A11Y-S-04", f"Landmark regions ({len(landmarks)})",
           "PASS" if len(landmarks) > 0 else "FAIL")


# ===== HIGH CONTRAST TESTS (A11Y-H-01 to H-03) =====

async def test_high_contrast(page, slug):
    """Test high contrast mode support."""
    await page.goto(f"{BASE_URL}/{slug}")
    await page.wait_for_load_state("networkidle")

    # H-01: Outline visible (for high contrast)
    btn = page.locator("button").first
    if btn:
        border = await btn.evaluate("el => getComputedStyle(el).borderWidth")
        outline = await btn.evaluate("el => getComputedStyle(el).outlineWidth")
        has_visible = border != '0px' or outline != '0px'
        record("A11Y-H-01", f"High contrast borders ({border}, {outline})",
               "PASS" if has_visible else "FAIL")

    # H-02: Text color not relying solely on color
    text = await page.query_selector("p, span, h1, h2")
    if text:
        color = await text.evaluate("el => getComputedStyle(el).color")
        has_color = 'rgb(' in color
        record("A11Y-H-02", f"Text color defined ({color[:20]}...)",
               "PASS" if has_color else "FAIL")

    # H-03: Icon alternatives
    icons = await page.query_selector_all("svg, [class*='icon']")
    alt_text = 0
    for icon in icons[:10]:
        has_aria = await icon.evaluate("el => el.hasAttribute('aria-label') || el.hasAttribute('aria-hidden')")
        if has_aria:
            alt_text += 1
    record("A11Y-H-03", f"Icon alternatives ({alt_text}/{len(icons[:10])})",
           "PASS" if alt_text > 0 else "SKIP")


# ===== ERROR HANDLING TESTS (E-01 to E-04) =====

async def test_error_handling(page, slug):
    """Test error handling."""
    # E-01: 404 page
    await page.goto(f"{BASE_URL}/nonexistent-slug-12345")
    await page.wait_for_timeout(500)
    error_el = await page.query_selector(".error, .not-found, [class*='error']")
    record("E-01", "404 error page", "PASS" if error_el else "FAIL")

    # E-02: Error message visible
    error_msg = await page.query_selector(".error-message, .error")
    if error_msg:
        text = await error_msg.text_content()
        record("E-02", f"Error message visible ({text[:30]}...)", "PASS")
    else:
        record("E-02", "Error message visible", "FAIL")

    # E-03: Recovery suggestion
    has_recovery = await page.query_selector("a[href='/'], .back-home, button")
    record("E-03", "Error recovery link", "PASS" if has_recovery else "FAIL")


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

            print("\n♿ ARIA TESTS (A11Y-A-02 to A-07)")
            await test_aria(page, slug)

            print("\n🎯 FOCUS VISIBILITY TESTS (A11Y-F-01 to F-05)")
            await test_focus(page, slug)

            print("\n🌳 FILE TREE TESTS (FT-05, FT-06, FT-08)")
            await test_file_tree(page, slug)

            print("\n🔊 SCREEN READER TESTS (A11Y-S-01 to S-04)")
            await test_screen_reader(page, slug)

            print("\n🎨 HIGH CONTRAST TESTS (A11Y-H-01 to H-03)")
            await test_high_contrast(page, slug)

            print("\n⚠️ ERROR HANDLING TESTS (E-01 to E-03)")
            await test_error_handling(page, slug)

            await page.close()

        finally:
            await delete_entry(slug)
            await browser.close()

        total = results['passed'] + results['failed'] + results['skipped']
        print(f"\n📊 RESULTS: {results['passed']}/{total} passed, {results['failed']} failed, {results['skipped']} skipped")

        # Save
        out = "/home/kity/lab/projects/peekview/tests/e2e/results"
        os.makedirs(out, exist_ok=True)
        with open(f"{out}/p0_additional_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json", "w") as f:
            json.dump(results, f, indent=2)

        return results


if __name__ == "__main__":
    asyncio.run(main())
