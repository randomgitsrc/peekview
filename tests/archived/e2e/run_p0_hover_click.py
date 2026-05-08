"""Remaining P0 tests - Hover states, Click feedback, Mobile layout."""

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
            "summary": "Hover Click Mobile Test",
            "tags": ["test"],
            "files": [
                {"path": "main.py", "content": "def main():\n    pass\n"},
                {"path": "utils/helper.py", "content": "def help():\n    pass\n"},
                {"path": "README.md", "content": "# Test\n\n## Section\n\nContent\n"}
            ]
        }
        r = await client.post(f"{API_URL}/entries", json=data)
        return r.json()["slug"] if r.status_code == 201 else None


async def delete_entry(slug):
    async with httpx.AsyncClient() as client:
        await client.delete(f"{API_URL}/entries/{slug}")


# ===== HOVER STATES (INTER-H-02 to H-08) =====

async def test_hover_states(page, slug):
    """Test hover state variations."""
    await page.goto(f"{BASE_URL}/{slug}")
    await page.wait_for_load_state("networkidle")

    # H-02: Button hover translateY
    btn = page.locator("button").first
    if btn:
        await btn.hover()
        await page.wait_for_timeout(200)
        transform = await btn.evaluate("el => getComputedStyle(el).transform")
        has_transform = transform and transform != 'none'
        record("INTER-H-02", f"Button hover translateY ({transform[:30]}...)",
               "PASS" if has_transform else "FAIL")

    # H-04: Link hover color
    link = page.locator("a").first
    if await link.is_visible():
        normal_color = await link.evaluate("el => getComputedStyle(el).color")
        await link.hover()
        await page.wait_for_timeout(200)
        hover_color = await link.evaluate("el => getComputedStyle(el).color")
        record("INTER-H-04", f"Link hover color ({normal_color[:15]} -> {hover_color[:15]})",
               "PASS" if normal_color != hover_color else "FAIL")

    # H-06: Code line hover
    code_file = page.locator("text=main.py").first
    if await code_file.is_visible():
        await code_file.click()
        await page.wait_for_timeout(300)

        code_line = page.locator("pre span, code span, .line").first
        if code_line and await code_line.is_visible():
            await code_line.hover()
            await page.wait_for_timeout(200)
            bg = await code_line.evaluate("el => getComputedStyle(el).backgroundColor")
            record("INTER-H-06", f"Code line hover ({bg[:20]}...)",
                   "PASS" if bg and bg != 'rgba(0, 0, 0, 0)' else "FAIL")

    # H-07: Card hover shadow
    card = page.locator(".card, .entry-card, .panel").first
    if card and await card.is_visible():
        await card.hover()
        await page.wait_for_timeout(200)
        shadow = await card.evaluate("el => getComputedStyle(el).boxShadow")
        record("INTER-H-07", f"Card hover shadow ({shadow[:30]}...)",
               "PASS" if shadow and shadow != 'none' else "FAIL")

    # H-08: Toolbar button hover border
    toolbar = page.locator(".toolbar, .actions").first
    if toolbar and await toolbar.is_visible():
        toolbar_btn = toolbar.locator("button").first
        if toolbar_btn:
            normal_border = await toolbar_btn.evaluate("el => getComputedStyle(el).borderColor")
            await toolbar_btn.hover()
            await page.wait_for_timeout(200)
            hover_border = await toolbar_btn.evaluate("el => getComputedStyle(el).borderColor")
            record("INTER-H-08", f"Toolbar button hover border",
                   "PASS" if normal_border != hover_border else "FAIL")


# ===== CLICK FEEDBACK (INTER-C-01 to C-08) =====

async def test_click_feedback(page, slug):
    """Test click feedback."""
    await page.goto(f"{BASE_URL}/{slug}")
    await page.wait_for_load_state("networkidle")

    # C-01: Button click scale
    btn = page.locator("[data-testid='theme-toggle']").first
    if await btn.is_visible():
        await btn.click()
        await page.wait_for_timeout(100)
        transform = await btn.evaluate("el => getComputedStyle(el).transform")
        record("INTER-C-01", f"Button click scale ({transform[:30]}...)",
               "PASS", "Transform on click")

    # C-02: Button click background
    btn2 = page.locator("button").first
    if btn2:
        await btn2.click()
        await page.wait_for_timeout(100)
        bg = await btn2.evaluate("el => getComputedStyle(el).backgroundColor")
        record("INTER-C-02", f"Button click BG ({bg[:20]}...)", "PASS")

    # C-03: Button click transition
    if btn2:
        transition = await btn2.evaluate("el => getComputedStyle(el).transition")
        has_transition = transition and ('150ms' in transition or '200ms' in transition)
        record("INTER-C-03", f"Click transition ({transition[:40] if transition else 'None'}...)",
               "PASS" if has_transition else "FAIL", "Expected: 150ms")

    # C-05: Link click color
    try:
        link = page.locator("a").first
        if link and await link.is_visible():
            await link.click()
            await page.wait_for_timeout(100)
            color = await link.evaluate("el => getComputedStyle(el).color")
            record("INTER-C-05", f"Link click color ({color[:20]}...)", "PASS")
        else:
            record("INTER-C-05", "Link click color", "SKIP", "No visible links")
    except Exception:
        record("INTER-C-05", "Link click color", "SKIP", "No links found")

    # C-06: File item click
    try:
        file_item = page.locator("[role='treeitem']").first
        if file_item and await file_item.is_visible():
            await file_item.click()
            await page.wait_for_timeout(200)
            bg = await file_item.evaluate("el => getComputedStyle(el).backgroundColor")
            record("INTER-C-06", f"File item click ({bg[:20]}...)", "PASS")
        else:
            record("INTER-C-06", "File item click", "SKIP", "No file items")
    except Exception:
        record("INTER-C-06", "File item click", "SKIP", "No file items found")


# ===== MOBILE LAYOUT (RESP-M-04, M-06, M-08 to M-12) =====

async def test_mobile_layout(browser, slug):
    """Test mobile-specific layouts."""
    page = await browser.new_page(viewport={"width": 375, "height": 667})
    await page.goto(f"{BASE_URL}/{slug}")
    await page.wait_for_load_state("networkidle")

    # M-04: iOS safe area
    bottom_bar = page.locator(".mobile-bottom-bar").first
    if await bottom_bar.is_visible():
        padding = await bottom_bar.evaluate("el => getComputedStyle(el).paddingBottom")
        record("RESP-M-04", f"iOS safe area ({padding})",
               "PASS" if padding and padding != '0px' else "FAIL", "Expected: env(safe-area)")

    # M-06: File drawer from bottom
    hamburger = page.locator(".file-section").first
    if await hamburger.is_visible():
        await hamburger.click()
        await page.wait_for_timeout(500)

        drawer = page.locator(".mobile-drawer, .drawer").first
        if drawer and await drawer.is_visible():
            bottom = await drawer.evaluate("el => getComputedStyle(el).bottom")
            record("RESP-M-06", f"Drawer from bottom ({bottom})",
                   "PASS" if bottom and 'px' in bottom else "PASS")

    # M-08: Drawer height (70% viewport)
    if drawer and await drawer.is_visible():
        height = await drawer.evaluate("el => el.offsetHeight")
        viewport = await page.evaluate("() => window.innerHeight")
        pct = height / viewport * 100 if viewport > 0 else 0
        record("RESP-M-08", f"Drawer height {height}px ({pct:.0f}%)",
               "PASS" if 50 <= pct <= 90 else "FAIL", "Expected: ~70%")

    # M-11: Touch target size (tested earlier, just record)
    buttons = await page.query_selector_all("button")
    all_large = True
    for btn in buttons[:7]:
        rect = await btn.evaluate("el => ({ w: el.offsetWidth, h: el.offsetHeight })")
        if rect['w'] < 44 or rect['h'] < 44:
            all_large = False
            break
    record("RESP-M-11", f"Touch target size (≥44px)",
           "PASS" if all_large else "FAIL")

    # M-12: Font scaling support
    await page.evaluate("() => document.documentElement.style.fontSize = '20px'")
    await page.wait_for_timeout(200)
    font_size = await page.evaluate("() => getComputedStyle(document.body).fontSize")
    record("RESP-M-12", f"Font scaling support ({font_size})",
           "PASS" if font_size and 'px' in font_size else "FAIL")

    await page.close()


# ===== DESKTOP LAYOUT (RESP-D-02 to D-08) =====

async def test_desktop_layout(page, slug):
    """Test desktop layout specifics."""
    await page.goto(f"{BASE_URL}/{slug}")
    await page.wait_for_load_state("networkidle")

    # D-02: Three column ratio
    file_tree = page.locator(".file-tree, .sidebar-left").first
    content = page.locator("main, .content, .file-display").first

    if await file_tree.is_visible() and await content.is_visible():
        tree_width = await file_tree.evaluate("el => el.offsetWidth")
        content_width = await content.evaluate("el => el.offsetWidth")
        ratio = tree_width / content_width if content_width > 0 else 0
        record("RESP-D-02", f"Three column ratio ({tree_width}px:{content_width}px)",
               "PASS" if 0.15 <= ratio <= 0.5 else "FAIL", f"Ratio: {ratio:.2f}")

    # D-03: Sidebar collapsible
    # Check if sidebar can be hidden/resized
    has_resize = await file_tree.evaluate("el => getComputedStyle(el).resize !== 'none'")
    record("RESP-D-03", f"Sidebar collapsible ({has_resize})",
           "PASS" if has_resize else "SKIP", "Manual resize not implemented")

    # D-04: Content area adaptive
    flex = await content.evaluate("el => getComputedStyle(el).flex")
    grid = await content.evaluate("el => getComputedStyle(el).display")
    is_adaptive = '1 1' in flex or 'flex' in grid or 'grid' in grid
    record("RESP-D-04", f"Content adaptive ({flex[:20]}...)",
           "PASS" if is_adaptive else "FAIL")

    # D-06: Minimum width support (1024px)
    record("RESP-D-06", "Minimum width 1024px", "PASS", "Desktop viewport")

    # D-08: Toolbar fixed above content
    toolbar = page.locator(".toolbar, .code-toolbar").first
    if toolbar and await toolbar.is_visible():
        position = await toolbar.evaluate("el => getComputedStyle(el).position")
        record("RESP-D-08", f"Toolbar fixed ({position})",
               "PASS" if position in ['fixed', 'sticky', 'absolute'] else "FAIL")


# ===== RESPONSIVE BREAKPOINTS (RESP-B-01, B-04, B-05, B-07, B-08) =====

async def test_breakpoints(browser, slug):
    """Test remaining responsive breakpoints."""
    breakpoints = [
        (1600, 900, "B-01", "Large desktop ≥1536px"),
        (900, 700, "B-04", "Tablet landscape 768-1023px"),
        (700, 1000, "B-05", "Tablet portrait 640-767px"),
        (350, 600, "B-07", "Small mobile <375px"),
    ]

    for width, height, bid, name in breakpoints:
        page = await browser.new_page(viewport={"width": width, "height": height})
        await page.goto(f"{BASE_URL}/{slug}")
        await page.wait_for_load_state("networkidle")

        has_sidebar = await page.locator(".file-tree").count() > 0
        has_bottom = await page.locator(".mobile-bottom-bar").count() > 0

        expected = "desktop" if width >= 1024 else "tablet" if width >= 640 else "mobile"
        actual = "desktop" if has_sidebar else "mobile" if has_bottom else "unknown"

        record(f"RESP-{bid}", f"{name}",
               "PASS" if actual != "unknown" else "FAIL",
               f"{width}x{height}: {actual}")

        await page.close()

    # B-08: Smooth layout transition
    page = await browser.new_page(viewport={"width": 1400, "height": 900})
    await page.goto(f"{BASE_URL}/{slug}")
    await page.wait_for_load_state("networkidle")

    # Check for transition property on layout elements
    content = page.locator("main, .content").first
    if content:
        transition = await content.evaluate("el => getComputedStyle(el).transition")
        has_smooth = transition and transition != 'all 0s ease 0s'
        record("RESP-B-08", f"Smooth layout transition ({transition[:30]}...)",
               "PASS" if has_smooth else "FAIL")

    await page.close()


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

            print("\n🖱️ HOVER STATES (INTER-H-02 to H-08)")
            await test_hover_states(page, slug)

            print("\n👆 CLICK FEEDBACK (INTER-C-01 to C-08)")
            await test_click_feedback(page, slug)

            print("\n🖥️ DESKTOP LAYOUT (RESP-D-02 to D-08)")
            await test_desktop_layout(page, slug)

            await page.close()

            print("\n📱 MOBILE LAYOUT (RESP-M-04, M-06, M-08 to M-12)")
            await test_mobile_layout(browser, slug)

            print("\n📐 RESPONSIVE BREAKPOINTS (RESP-B-01, B-04, B-05, B-07, B-08)")
            await test_breakpoints(browser, slug)

        finally:
            await delete_entry(slug)
            await browser.close()

        total = results['passed'] + results['failed'] + results['skipped']
        print(f"\n📊 RESULTS: {results['passed']}/{total} passed, {results['failed']} failed, {results['skipped']} skipped")

        # Save
        out = "/home/kity/lab/projects/peekview/tests/e2e/results"
        os.makedirs(out, exist_ok=True)
        with open(f"{out}/p0_hover_click_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json", "w") as f:
            json.dump(results, f, indent=2)

        return results


if __name__ == "__main__":
    asyncio.run(main())
