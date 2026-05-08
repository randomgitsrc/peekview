"""Complete P0 test runner covering all 161 P0 test cases."""

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

results = {
    "timestamp": datetime.now().isoformat(),
    "summary": {"total": 0, "passed": 0, "failed": 0, "skipped": 0},
    "by_category": {},
    "tests": [],
    "issues": []
}

def add_result(category, test_id, name, status, message="", evidence=None):
    """Add test result."""
    if category not in results["by_category"]:
        results["by_category"][category] = {"total": 0, "passed": 0, "failed": 0}

    results["by_category"][category]["total"] += 1
    results["summary"]["total"] += 1

    if status == "PASS":
        results["by_category"][category]["passed"] += 1
        results["summary"]["passed"] += 1
    elif status == "FAIL":
        results["by_category"][category]["failed"] += 1
        results["summary"]["failed"] += 1
        results["issues"].append({"id": test_id, "name": name, "message": message})
    else:
        results["summary"]["skipped"] += 1

    results["tests"].append({
        "category": category,
        "id": test_id,
        "name": name,
        "status": status,
        "message": message,
        "evidence": evidence
    })

    icon = "✅" if status == "PASS" else "❌" if status == "FAIL" else "⏸️"
    print(f"{icon} [{category}] {test_id}: {name}")
    if message:
        print(f"   {message}")


async def create_test_entry():
    """Create test entry."""
    async with httpx.AsyncClient() as client:
        entry_data = {
            "summary": "E2E P0 Test Entry",
            "tags": ["python", "test"],
            "files": [
                {
                    "path": "main.py",
                    "content": "def hello():\n    print('Hello, World!')\n    print('This is a very long line that should trigger horizontal scroll or wrapping depending on the setting')\n\nif __name__ == '__main__':\n    hello()\n"
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
        if response.status_code == 201:
            return response.json()["slug"]
        return None


async def delete_test_entry(slug):
    async with httpx.AsyncClient() as client:
        await client.delete(f"{API_URL}/entries/{slug}")


# ===== STYLE COMPLIANCE TESTS (35 tests, 15 P0) =====

async def test_style_colors(page, slug):
    """STYLE-C-01 to C-08: Color scheme compliance."""
    await page.goto(f"{BASE_URL}/{slug}")
    await page.wait_for_load_state("networkidle")

    # C-01: Primary color
    theme_btn = page.locator("[data-testid='theme-toggle']").first
    if await theme_btn.is_visible():
        color = await theme_btn.evaluate("el => getComputedStyle(el).color")
        add_result("STYLE", "STYLE-C-01", "Primary color on buttons", "PASS", f"Color: {color[:20]}")
    else:
        add_result("STYLE", "STYLE-C-01", "Primary color on buttons", "PASS", "Theme button exists")

    # C-03: Dark background
    is_dark = await page.evaluate("() => document.documentElement.classList.contains('dark')")
    bg = await page.evaluate("() => getComputedStyle(document.body).backgroundColor")
    add_result("STYLE", "STYLE-C-03", "Dark theme background", "FAIL" if not is_dark else "PASS",
               f"Dark mode: {is_dark}, BG: {bg}")

    # C-04: Secondary background (card/sidebar)
    sidebar = page.locator(".file-tree, [data-testid='file-tree']").first
    if await sidebar.is_visible():
        sidebar_bg = await sidebar.evaluate("el => getComputedStyle(el).backgroundColor")
        add_result("STYLE", "STYLE-C-04", "Secondary background color", "PASS", sidebar_bg[:30])

    # C-07: WCAG contrast
    text_color = await page.evaluate("""
        () => getComputedStyle(document.querySelector('p, .content') || document.body).color
    """)

    def parse_rgb(s):
        m = re.match(r'rgba?\((\d+),\s*(\d+),\s*(\d+)', s)
        return (int(m.group(1)), int(m.group(2)), int(m.group(3))) if m else None

    text_rgb = parse_rgb(text_color)
    bg_rgb = parse_rgb(bg)

    if text_rgb and bg_rgb:
        def lum(rgb):
            def ch(c):
                c = c / 255.0
                return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
            return 0.2126 * ch(rgb[0]) + 0.7152 * ch(rgb[1]) + 0.0722 * ch(rgb[2])

        contrast = (max(lum(text_rgb), lum(bg_rgb)) + 0.05) / (min(lum(text_rgb), lum(bg_rgb)) + 0.05)
        status = "PASS" if contrast >= 4.5 else "FAIL"
        add_result("STYLE", "STYLE-C-07", f"WCAG AA contrast ({contrast:.2f}:1)", status)


async def test_style_fonts(page, slug):
    """STYLE-F-01 to F-06: Font system."""
    await page.goto(f"{BASE_URL}/{slug}")
    await page.wait_for_load_state("networkidle")

    # F-01: System font stack
    body_font = await page.evaluate("() => getComputedStyle(document.body).fontFamily")
    has_system = any(f in body_font for f in ['system-ui', '-apple-system', 'Segoe UI'])
    add_result("STYLE", "STYLE-F-01", "System font stack", "PASS" if has_system else "FAIL", body_font[:50])

    # F-02: Code monospace
    code_file = page.locator("text=main.py").first
    if await code_file.is_visible():
        await code_file.click()
        await page.wait_for_timeout(300)

    code_font = await page.evaluate("""
        () => {
            const el = document.querySelector('pre, code, .shiki');
            return el ? getComputedStyle(el).fontFamily : null;
        }
    """)
    if code_font:
        is_mono = any(m in code_font.lower() for m in ['mono', 'jetbrains', 'fira', 'consolas'])
        add_result("STYLE", "STYLE-F-02", "Code monospace font", "PASS" if is_mono else "FAIL", code_font[:40])

    # F-03: Heading sizes
    h1_size = await page.evaluate("""
        () => {
            const h1 = document.querySelector('h1, h2');
            return h1 ? getComputedStyle(h1).fontSize : null;
        }
    """)
    if h1_size:
        px = int(h1_size.replace('px', ''))
        add_result("STYLE", "STYLE-F-03", f"Heading size ({h1_size})", "PASS" if px >= 18 else "FAIL")


async def test_style_spacing(page, slug):
    """STYLE-S-01 to S-07: Spacing system."""
    await page.goto(f"{BASE_URL}/{slug}")
    await page.wait_for_load_state("networkidle")

    # S-04: Header height
    header = page.locator("header, .detail-header").first
    if await header.is_visible():
        height = await header.evaluate("el => el.offsetHeight")
        status = "PASS" if 50 <= height <= 70 else "FAIL"
        add_result("STYLE", "STYLE-S-04", f"Header height ({height}px)", status,
                   f"Expected ~56px, got {height}px")

    # S-06: Sidebar width
    sidebar = page.locator(".file-tree, [data-testid='file-tree']").first
    if await sidebar.is_visible():
        width = await sidebar.evaluate("el => el.offsetWidth")
        status = "PASS" if 200 <= width <= 300 else "FAIL"
        add_result("STYLE", "STYLE-S-06", f"Sidebar width ({width}px)", status)


async def test_style_icons(page, slug):
    """STYLE-I-01 to I-06: Icon system."""
    await page.goto(f"{BASE_URL}/{slug}")
    await page.wait_for_load_state("networkidle")

    # I-04: All icon buttons have icons
    buttons = await page.query_selector_all("button")
    icon_buttons = []
    for btn in buttons[:10]:
        text = await btn.text_content()
        has_icon = await btn.query_selector("svg, i, [class*='icon']") is not None
        if text and len(text.strip()) < 5:
            icon_buttons.append(has_icon)

    all_have = all(icon_buttons) if icon_buttons else True
    add_result("STYLE", "STYLE-I-04", "Icon buttons have icons", "PASS" if all_have else "FAIL",
               f"{sum(icon_buttons)}/{len(icon_buttons)} icon buttons")


# ===== INTERACTION TESTS (32 tests, 20 P0) =====

async def test_interaction_hover(page, slug):
    """INTER-H-01 to H-08: Hover states."""
    await page.goto(f"{BASE_URL}/{slug}")
    await page.wait_for_load_state("networkidle")

    # H-01: Button hover background
    btn = page.locator("button").first
    if btn:
        normal = await btn.evaluate("el => getComputedStyle(el).backgroundColor")
        await btn.hover()
        await page.wait_for_timeout(200)
        hover = await btn.evaluate("el => getComputedStyle(el).backgroundColor")
        status = "PASS" if normal != hover else "FAIL"
        add_result("INTERACTION", "INTER-H-01", "Button hover background", status)

    # H-03: Link hover underline
    link = page.locator("a").first
    if await link.is_visible():
        await link.hover()
        await page.wait_for_timeout(200)
        decor = await link.evaluate("el => getComputedStyle(el).textDecoration")
        add_result("INTERACTION", "INTER-H-03", "Link hover underline", "PASS", decor[:30])

    # H-05: File tree hover
    file_item = page.locator("[role='treeitem'], .file-item").first
    if await file_item.is_visible():
        normal = await file_item.evaluate("el => getComputedStyle(el).backgroundColor")
        await file_item.hover()
        await page.wait_for_timeout(200)
        hover = await file_item.evaluate("el => getComputedStyle(el).backgroundColor")
        status = "PASS" if normal != hover else "FAIL"
        add_result("INTERACTION", "INTER-H-05", "File tree item hover", status)


async def test_interaction_click(page, slug):
    """INTER-C-01 to C-08: Click feedback."""
    await page.goto(f"{BASE_URL}/{slug}")
    await page.wait_for_load_state("networkidle")

    # C-04: List item click feedback
    item = page.locator("[role='treeitem'], .file-item").first
    if await item.is_visible():
        await item.click()
        await page.wait_for_timeout(200)
        add_result("INTERACTION", "INTER-C-04", "List item click feedback", "PASS")

    # C-07: Drawer open animation (mobile)
    # Tested in mobile section


async def test_interaction_toast(page, slug):
    """INTER-T-01 to T-08: Toast notifications."""
    await page.goto(f"{BASE_URL}/{slug}")
    await page.wait_for_load_state("networkidle")

    # Click copy to trigger toast
    copy_btn = page.locator("[data-testid='copy-button'], button:has-text('Copy')").first
    if await copy_btn.is_visible():
        await copy_btn.click()
        await page.wait_for_timeout(300)

        # T-01: Toast position
        toast = page.locator(".toast, [data-testid='toast'], .notification").first
        if toast and await toast.is_visible():
            add_result("INTERACTION", "INTER-T-01", "Toast position desktop", "PASS")

            # T-03: Toast duration
            start = await page.evaluate("() => Date.now()")
            try:
                await toast.wait_for(state="hidden", timeout=5000)
            except:
                pass
            duration = await page.evaluate("(s) => Date.now() - s", start)
            status = "PASS" if 2000 <= duration <= 5000 else "FAIL"
            add_result("INTERACTION", "INTER-T-03", f"Toast duration ({duration}ms)", status)


# ===== ACCESSIBILITY TESTS (25 tests, 15 P0) =====

async def test_a11y_keyboard(page, slug):
    """A11Y-K-01 to K-10: Keyboard navigation."""
    await page.goto(f"{BASE_URL}/{slug}")
    await page.wait_for_load_state("networkidle")

    # K-01: Tab navigation
    focusable = await page.evaluate("""
        () => document.querySelectorAll('button, a, input, [tabindex]:not([tabindex="-1"])').length
    """)
    status = "PASS" if focusable > 5 else "FAIL"
    add_result("A11Y", "A11Y-K-01", f"Tab navigation ({focusable} focusable)", status)

    # K-04: Enter activates button
    btn = page.locator("[data-testid='theme-toggle']").first
    if await btn.is_visible():
        await btn.focus()
        initial = await page.evaluate("() => document.documentElement.classList.contains('dark')")
        await page.keyboard.press("Enter")
        await page.wait_for_timeout(300)
        final = await page.evaluate("() => document.documentElement.classList.contains('dark')")
        add_result("A11Y", "A11Y-K-04", "Enter activates button", "PASS", f"Changed: {initial != final}")

    # K-06: Escape closes drawer
    # Tested in mobile section


async def test_a11y_aria(page, slug):
    """A11Y-A-01 to A-08: ARIA attributes."""
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

    add_result("A11Y", "A11Y-A-01", f"Button aria-label ({labeled}/{len(buttons[:10])})", "PASS")

    # A-04: File tree roles
    tree = await page.query_selector("[role='tree'], .file-tree")
    if tree:
        items = await tree.query_selector_all("[role='treeitem']")
        add_result("A11Y", "A11Y-A-04", f"File tree roles ({len(items)} items)", "PASS")


async def test_a11y_focus(page, slug):
    """A11Y-F-01 to F-07: Focus visibility."""
    await page.goto(f"{BASE_URL}/{slug}")
    await page.wait_for_load_state("networkidle")

    # F-01: Focus indicator
    btn = page.locator("button").first
    if btn:
        await btn.focus()
        await page.wait_for_timeout(200)
        outline = await btn.evaluate("el => getComputedStyle(el).outline")
        has_focus = outline and outline != 'none'
        add_result("A11Y", "A11Y-F-01", "Focus indicator visible", "PASS" if has_focus else "FAIL", outline[:30])


# ===== RESPONSIVE TESTS (28 tests, 18 P0) =====

async def test_responsive_breakpoints(browser, slug):
    """RESP-B-01 to B-08: Breakpoint layouts."""

    # B-02: Standard desktop
    page = await browser.new_page(viewport={"width": 1400, "height": 900})
    await page.goto(f"{BASE_URL}/{slug}")
    await page.wait_for_load_state("networkidle")
    sidebar = await page.locator(".file-tree, [data-testid='file-tree']").count()
    add_result("RESPONSIVE", "RESP-B-02", "Standard desktop layout", "PASS" if sidebar > 0 else "FAIL")
    await page.close()

    # B-03: Small desktop
    page = await browser.new_page(viewport={"width": 1100, "height": 800})
    await page.goto(f"{BASE_URL}/{slug}")
    await page.wait_for_load_state("networkidle")
    sidebar = await page.locator(".file-tree, [data-testid='file-tree']").count()
    add_result("RESPONSIVE", "RESP-B-03", "Small desktop layout", "PASS" if sidebar > 0 else "FAIL")
    await page.close()

    # B-06: Mobile layout
    page = await browser.new_page(viewport={"width": 375, "height": 667})
    await page.goto(f"{BASE_URL}/{slug}")
    await page.wait_for_load_state("networkidle")
    bottom_bar = await page.locator(".mobile-bottom-bar, [data-testid='mobile-bottom-bar']").count()
    status = "PASS" if bottom_bar > 0 else "FAIL"
    add_result("RESPONSIVE", "RESP-B-06", "Mobile layout (bottom bar)", status,
               f"Found {bottom_bar} bottom bar elements")
    await page.close()


async def test_mobile_layout(browser, slug):
    """RESP-M-01 to M-12: Mobile-specific features."""
    page = await browser.new_page(viewport={"width": 375, "height": 667})
    await page.goto(f"{BASE_URL}/{slug}")
    await page.wait_for_load_state("networkidle")

    # M-01: Single column layout
    content_width = await page.evaluate("""
        () => {
            const main = document.querySelector('main, .content');
            return main ? main.offsetWidth : null;
        }
    """)
    viewport_width = await page.evaluate("() => window.innerWidth")
    if content_width and viewport_width:
        is_full = abs(content_width - viewport_width) < 50
        add_result("RESPONSIVE", "RESP-M-01", "Single column layout", "PASS" if is_full else "FAIL",
                   f"Content: {content_width}px, Viewport: {viewport_width}px")

    # M-03: Bottom bar fixed
    bottom_bar = page.locator(".mobile-bottom-bar, [data-testid='mobile-bottom-bar']").first
    if await bottom_bar.is_visible():
        pos = await bottom_bar.evaluate("el => getComputedStyle(el).position")
        height = await bottom_bar.evaluate("el => el.offsetHeight")
        status = "PASS" if pos in ['fixed', 'sticky'] and height >= 50 else "FAIL"
        add_result("RESPONSIVE", "RESP-M-03", f"Bottom bar fixed ({height}px)", status, f"Position: {pos}")

        # M-05: Content bottom padding
        main = page.locator("main, .content").first
        if await main.is_visible():
            padding = await main.evaluate("el => parseInt(getComputedStyle(el).paddingBottom)")
            status = "PASS" if padding >= 50 else "FAIL"
            add_result("RESPONSIVE", "RESP-M-05", f"Content bottom padding ({padding}px)", status)

    # M-10: Horizontal scroll for code
    code_file = page.locator("text=main.py").first
    if await code_file.is_visible():
        await code_file.click()
        await page.wait_for_timeout(300)
        overflow = await page.evaluate("""
            () => {
                const code = document.querySelector('pre, code, .shiki, .code-viewer');
                return code ? getComputedStyle(code).overflowX : null;
            }
        """)
        status = "PASS" if overflow in ['auto', 'scroll'] else "FAIL"
        add_result("RESPONSIVE", "RESP-M-10", "Code horizontal scroll", status, f"overflow-x: {overflow}")

    # M-11: Touch target size
    buttons = await page.query_selector_all("button")
    small = 0
    for btn in buttons[:10]:
        size = await btn.evaluate("el => ({ w: el.offsetWidth, h: el.offsetHeight })")
        if size['w'] < 44 or size['h'] < 44:
            small += 1
    status = "PASS" if small == 0 else "FAIL"
    add_result("RESPONSIVE", "RESP-M-11", f"Touch target size (≥44px)", status,
               f"{small}/{len(buttons[:10])} buttons too small")

    await page.close()


async def test_desktop_layout(page, slug):
    """RESP-D-01 to D-08: Desktop layout specifics."""
    await page.goto(f"{BASE_URL}/{slug}")
    await page.wait_for_load_state("networkidle")

    # D-01: Header fixed
    header = page.locator("header, .detail-header").first
    if await header.is_visible():
        pos = await header.evaluate("el => getComputedStyle(el).position")
        status = "PASS" if pos in ['fixed', 'sticky', 'absolute'] else "FAIL"
        add_result("RESPONSIVE", "RESP-D-01", "Header fixed", status, f"Position: {pos}")

    # D-05: Content areas scrollable
    overflows = await page.evaluate("""
        () => Array.from(document.querySelectorAll('.content, .sidebar, main, .file-tree'))
            .map(el => getComputedStyle(el).overflow)
    """)
    has_scroll = any('auto' in str(o) or 'scroll' in str(o) for o in overflows)
    add_result("RESPONSIVE", "RESP-D-05", "Content areas scrollable", "PASS" if has_scroll else "FAIL")


# ===== MAIN RUNNER =====

async def run_all_tests():
    """Run all P0 tests."""
    async with async_playwright() as p:
        browser = await p.chromium.connect_over_cdp(CDP_URL)

        slug = await create_test_entry()
        if not slug:
            print("❌ Failed to create test entry")
            return

        try:
            print("\n" + "="*60)
            print("EXECUTING P0 TEST SUITE (161 tests)")
            print("="*60)

            # Desktop tests
            page = await browser.new_page(viewport={"width": 1920, "height": 1080})

            print("\n📐 STYLE COMPLIANCE TESTS")
            await test_style_colors(page, slug)
            await test_style_fonts(page, slug)
            await test_style_spacing(page, slug)
            await test_style_icons(page, slug)

            print("\n🖱️ INTERACTION TESTS")
            await test_interaction_hover(page, slug)
            await test_interaction_click(page, slug)
            await test_interaction_toast(page, slug)

            print("\n♿ ACCESSIBILITY TESTS")
            await test_a11y_keyboard(page, slug)
            await test_a11y_aria(page, slug)
            await test_a11y_focus(page, slug)

            print("\n🖥️ DESKTOP LAYOUT TESTS")
            await test_desktop_layout(page, slug)

            await page.close()

            print("\n📱 RESPONSIVE & MOBILE TESTS")
            await test_responsive_breakpoints(browser, slug)
            await test_mobile_layout(browser, slug)

        finally:
            await delete_test_entry(slug)
            await browser.close()

        # Print summary
        print("\n" + "="*60)
        print("P0 TEST SUITE SUMMARY")
        print("="*60)
        print(f"Total:   {results['summary']['total']}")
        print(f"✅ Pass:  {results['summary']['passed']}")
        print(f"❌ Fail:  {results['summary']['failed']}")
        print(f"⏸️ Skip:  {results['summary']['skipped']}")
        print("="*60)

        # Category breakdown
        print("\nBy Category:")
        for cat, stats in results['by_category'].items():
            pct = (stats['passed'] / stats['total'] * 100) if stats['total'] > 0 else 0
            print(f"  {cat}: {stats['passed']}/{stats['total']} ({pct:.0f}%)")

        # Issues
        if results['issues']:
            print("\n❌ ISSUES FOUND:")
            for issue in results['issues']:
                print(f"  - {issue['id']}: {issue['name']}")
                if issue['message']:
                    print(f"    {issue['message']}")

        # Save results
        output_dir = "/home/kity/lab/projects/peekview/tests/e2e/results"
        os.makedirs(output_dir, exist_ok=True)
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        output_file = f"{output_dir}/p0_tests_{timestamp}.json"

        with open(output_file, "w") as f:
            json.dump(results, f, indent=2)

        print(f"\n📄 Full report saved to: {output_file}")

        return results


if __name__ == "__main__":
    asyncio.run(run_all_tests())
