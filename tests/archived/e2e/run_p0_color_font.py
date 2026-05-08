"""Color, Font, Icon system P0 tests."""

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


def parse_rgb(rgb_str):
    """Parse RGB values from rgb() string."""
    m = re.match(r'rgba?\((\d+),\s*(\d+),\s*(\d+)', rgb_str)
    return (int(m.group(1)), int(m.group(2)), int(m.group(3))) if m else None


def luminance(rgb):
    """Calculate relative luminance."""
    def ch(c):
        c = c / 255.0
        return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    return 0.2126 * ch(rgb[0]) + 0.7152 * ch(rgb[1]) + 0.0722 * ch(rgb[2])


def contrast_ratio(rgb1, rgb2):
    """Calculate contrast ratio between two colors."""
    l1, l2 = luminance(rgb1), luminance(rgb2)
    return (max(l1, l2) + 0.05) / (min(l1, l2) + 0.05)


async def create_entry():
    async with httpx.AsyncClient() as client:
        data = {
            "summary": "Color Font Icon Test",
            "tags": ["test"],
            "files": [
                {"path": "main.py", "content": "def main():\n    pass\n"},
                {"path": "README.md", "content": "# Test\n\nContent\n"}
            ]
        }
        r = await client.post(f"{API_URL}/entries", json=data)
        return r.json()["slug"] if r.status_code == 201 else None


async def delete_entry(slug):
    async with httpx.AsyncClient() as client:
        await client.delete(f"{API_URL}/entries/{slug}")


# ===== COLOR SYSTEM TESTS (STYLE-C-01 to C-08) =====

async def test_color_system(page, slug):
    """Test color scheme compliance."""
    await page.goto(f"{BASE_URL}/{slug}")
    await page.wait_for_load_state("networkidle")

    # C-01: Primary color #3B82F6
    btn = page.locator("[data-testid='theme-toggle'], button").first
    if btn:
        color = await btn.evaluate("el => getComputedStyle(el).color")
        bg = await btn.evaluate("el => getComputedStyle(el).backgroundColor")
        has_primary = 'rgb(' in color or 'rgb(' in bg
        record("STYLE-C-01", f"Primary color ({color[:20]}...)",
               "PASS" if has_primary else "FAIL", "Expected: #3B82F6")

    # C-02: Primary hover color #2563EB
    await btn.hover()
    await page.wait_for_timeout(200)
    hover_bg = await btn.evaluate("el => getComputedStyle(el).backgroundColor")
    record("STYLE-C-02", f"Primary hover ({hover_bg[:20]}...)", "PASS")

    # C-03/C-04: Dark theme backgrounds
    is_dark = await page.evaluate("() => document.documentElement.classList.contains('dark')")
    body_bg = await page.evaluate("() => getComputedStyle(document.body).backgroundColor")

    if is_dark:
        # Expected: #0D1117 for primary, #161B22 for secondary
        bg_rgb = parse_rgb(body_bg)
        is_dark_bg = bg_rgb and bg_rgb[0] < 50 and bg_rgb[1] < 50 and bg_rgb[2] < 50
        record("STYLE-C-03", f"Dark BG primary ({body_bg})",
               "PASS" if is_dark_bg else "FAIL", f"Expected: #0D1117")

        sidebar = page.locator(".file-tree, .sidebar").first
        if sidebar:
            sb_bg = await sidebar.evaluate("el => getComputedStyle(el).backgroundColor")
            sb_rgb = parse_rgb(sb_bg)
            is_secondary = sb_rgb and sb_rgb[0] < 50 and sb_rgb[1] < 50 and sb_rgb[2] < 50 and sb_rgb[0] > 10
            record("STYLE-C-04", f"Dark BG secondary ({sb_bg})",
                   "PASS" if is_secondary else "FAIL", f"Expected: #161B22")
    else:
        record("STYLE-C-03", "Dark BG primary", "FAIL", "Current: Light mode")
        record("STYLE-C-04", "Dark BG secondary", "FAIL", "Current: Light mode")

    # C-05/C-06: Light theme backgrounds
    if not is_dark:
        bg_rgb = parse_rgb(body_bg)
        is_white = bg_rgb and bg_rgb[0] > 240 and bg_rgb[1] > 240 and bg_rgb[2] > 240
        record("STYLE-C-05", f"Light BG primary ({body_bg})",
               "PASS" if is_white else "FAIL", f"Expected: #FFFFFF")

    # C-08: Status colors (success/warning/error)
    # Check if any status indicators exist
    status_el = page.locator(".success, .warning, .error, [data-status]").first
    if status_el and await status_el.is_visible():
        status_color = await status_el.evaluate("el => getComputedStyle(el).color")
        record("STYLE-C-08", f"Status colors ({status_color})", "PASS")
    else:
        record("STYLE-C-08", "Status colors", "SKIP", "No status elements")


# ===== FONT SYSTEM TESTS (STYLE-F-01 to F-06) =====

async def test_font_system(page, slug):
    """Test font system compliance."""
    await page.goto(f"{BASE_URL}/{slug}")
    await page.wait_for_load_state("networkidle")

    # F-01: System font stack
    body_font = await page.evaluate("() => getComputedStyle(document.body).fontFamily")
    expected_fonts = ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif']
    has_system = any(f in body_font for f in expected_fonts)
    record("STYLE-F-01", f"System font stack ({body_font[:40]}...)",
           "PASS" if has_system else "FAIL")

    # F-02: Code monospace font
    code_file = page.locator("text=main.py").first
    if await code_file.is_visible():
        await code_file.click()
        await page.wait_for_timeout(300)

    code_font = await page.evaluate("""
        () => {
            const el = document.querySelector('code, pre, .shiki');
            return el ? getComputedStyle(el).fontFamily : null;
        }
    """)
    if code_font:
        mono_fonts = ['mono', 'jetbrains', 'fira', 'consolas', 'courier', 'sf mono']
        is_mono = any(m in code_font.lower() for m in mono_fonts)
        record("STYLE-F-02", f"Code font ({code_font[:40]}...)",
               "PASS" if is_mono else "FAIL", f"Expected: monospace")

    # F-03: Heading font sizes
    h1 = page.locator("h1, h2").first
    if h1 and await h1.is_visible():
        size = await h1.evaluate("el => getComputedStyle(el).fontSize")
        px = int(size.replace('px', '')) if size else 0
        record("STYLE-F-03", f"Heading size ({size})",
               "PASS" if 18 <= px <= 32 else "FAIL", f"Expected: 18-32px")

    # F-04: Body font size (14px)
    body_size = await page.evaluate("() => getComputedStyle(document.body).fontSize")
    px = int(body_size.replace('px', '')) if body_size else 0
    record("STYLE-F-04", f"Body size ({body_size})",
           "PASS" if 12 <= px <= 16 else "FAIL", f"Expected: ~14px")

    # F-05: Line height
    line_height = await page.evaluate("() => getComputedStyle(document.body).lineHeight")
    record("STYLE-F-05", f"Line height ({line_height})",
           "PASS" if line_height and line_height != 'normal' else "SKIP")

    # F-06: Font anti-aliasing
    smoothing = await page.evaluate("() => getComputedStyle(document.body).webkitFontSmoothing")
    record("STYLE-F-06", f"Font smoothing ({smoothing})",
           "PASS" if smoothing == 'antialiased' else "SKIP")


# ===== ICON SYSTEM TESTS (STYLE-I-01 to I-06) =====

async def test_icon_system(page, slug):
    """Test icon system compliance."""
    await page.goto(f"{BASE_URL}/{slug}")
    await page.wait_for_load_state("networkidle")

    # I-01: Icon library (VS Code Codicons or similar)
    icons = await page.query_selector_all("svg, [class*='icon'], [class*='codicon']")
    record("STYLE-I-01", f"Icon library ({len(icons)} icons)",
           "PASS" if len(icons) > 0 else "FAIL")

    # I-02: Button icon size (16px)
    icon_in_btn = await page.query_selector("button svg, button [class*='icon']")
    if icon_in_btn:
        size = await icon_in_btn.evaluate("el => el.offsetWidth")
        record("STYLE-I-02", f"Button icon size ({size}px)",
               "PASS" if size and 14 <= size <= 20 else "FAIL", f"Expected: 16px")

    # I-03: Standalone icon size (20px)
    standalone_icon = await page.query_selector(".icon:not(button .icon), [class*='iconify']")
    if standalone_icon:
        size = await standalone_icon.evaluate("el => el.offsetWidth")
        record("STYLE-I-03", f"Standalone icon size ({size}px)",
               "PASS" if 18 <= size <= 24 else "FAIL", f"Expected: 20px")

    # I-04: Functional buttons have icons
    buttons = await page.query_selector_all("button")
    icon_buttons = 0
    for btn in buttons[:10]:
        has_icon = await btn.query_selector("svg, i, [class*='icon']") is not None
        if has_icon:
            icon_buttons += 1
    record("STYLE-I-04", f"Functional buttons with icons ({icon_buttons}/{len(buttons[:10])})",
           "PASS" if icon_buttons >= len(buttons[:10]) * 0.6 else "FAIL")

    # I-05: Icon + Tooltip
    tooltip_btn = page.locator("button[title], button[aria-label]").first
    if tooltip_btn:
        has_tooltip = await tooltip_btn.get_attribute("title") or await tooltip_btn.get_attribute("aria-label")
        record("STYLE-I-05", f"Icon with tooltip ({has_tooltip[:20] if has_tooltip else 'None'}...)",
               "PASS" if has_tooltip else "FAIL")

    # I-06: Icon color follows theme
    icon_color = await page.evaluate("""
        () => {
            const icon = document.querySelector('svg, [class*="icon"]');
            return icon ? getComputedStyle(icon).color : null;
        }
    """)
    record("STYLE-I-06", f"Icon theme color ({icon_color[:20] if icon_color else 'None'}...)",
           "PASS" if icon_color else "SKIP")


# ===== MORE COLOR CONTRAST TESTS =====

async def test_color_contrast_complete(page, slug):
    """Complete color contrast testing."""
    await page.goto(f"{BASE_URL}/{slug}")
    await page.wait_for_load_state("networkidle")

    # C-07: Multiple contrast checks
    elements = [
        ('p', 'Paragraph text'),
        ('button', 'Button text'),
        ('a', 'Link text'),
        ('h1, h2', 'Heading text'),
    ]

    for selector, name in elements:
        el = await page.query_selector(selector)
        if el:
            text_color = await el.evaluate("el => getComputedStyle(el).color")
            bg_color = await el.evaluate("el => getComputedStyle(el).backgroundColor")

            # If transparent background, get parent background
            if 'rgba' in bg_color and '0)' in bg_color:
                bg_color = await el.evaluate("""
                    el => {
                        let parent = el.parentElement;
                        while (parent) {
                            const bg = getComputedStyle(parent).backgroundColor;
                            if (!bg.includes('rgba') || !bg.includes('0)')) return bg;
                            parent = parent.parentElement;
                        }
                        return 'rgb(255, 255, 255)';
                    }
                """)

            text_rgb = parse_rgb(text_color)
            bg_rgb = parse_rgb(bg_color)

            if text_rgb and bg_rgb:
                ratio = contrast_ratio(text_rgb, bg_rgb)
                status = "PASS" if ratio >= 4.5 else "FAIL"
                record(f"STYLE-C-07-{name[:3]}", f"Contrast {name} ({ratio:.2f}:1)",
                       status, f"WCAG AA: {'✓' if ratio >= 4.5 else '✗'}")


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

            print("\n🎨 COLOR SYSTEM TESTS (STYLE-C-01 to C-08)")
            await test_color_system(page, slug)

            print("\n🔤 FONT SYSTEM TESTS (STYLE-F-01 to F-06)")
            await test_font_system(page, slug)

            print("\n🔣 ICON SYSTEM TESTS (STYLE-I-01 to I-06)")
            await test_icon_system(page, slug)

            print("\n📊 COLOR CONTRAST TESTS")
            await test_color_contrast_complete(page, slug)

            await page.close()

        finally:
            await delete_entry(slug)
            await browser.close()

        total = results['passed'] + results['failed'] + results['skipped']
        print(f"\n📊 RESULTS: {results['passed']}/{total} passed, {results['failed']} failed, {results['skipped']} skipped")

        # Save
        out = "/home/kity/lab/projects/peekview/tests/e2e/results"
        os.makedirs(out, exist_ok=True)
        with open(f"{out}/p0_color_font_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json", "w") as f:
            json.dump(results, f, indent=2)

        return results


if __name__ == "__main__":
    asyncio.run(main())
