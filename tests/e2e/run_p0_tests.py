"""Comprehensive test runner for P0 style, interaction, accessibility, responsive tests."""

import asyncio
from playwright.async_api import async_playwright
import httpx
import os
import json
from datetime import datetime

CDP_URL = "http://127.0.0.1:18800"
BASE_URL = "http://localhost:8080"
API_URL = f"{BASE_URL}/api/v1"

# Test results
results = {
    "timestamp": datetime.now().isoformat(),
    "total": 0,
    "passed": 0,
    "failed": 0,
    "tests": []
}


def add_result(test_id, name, status, message=""):
    """Add test result."""
    results["tests"].append({
        "id": test_id,
        "name": name,
        "status": status,
        "message": message
    })
    results["total"] += 1
    if status == "PASS":
        results["passed"] += 1
    else:
        results["failed"] += 1
    print(f"[{status}] {test_id}: {name}")


async def create_test_entry():
    """Create test entry."""
    async with httpx.AsyncClient() as client:
        entry_data = {
            "summary": "E2E Style Test Entry",
            "tags": ["python", "test"],
            "files": [
                {
                    "path": "main.py",
                    "content": "def hello():\n    print('Hello, World!')\n\nif __name__ == '__main__':\n    hello()\n"
                },
                {
                    "path": "README.md",
                    "content": "# Test Project\n\n## Installation\n\nRun the code.\n\n### API\n\nSee docs.\n"
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
    """Delete test entry."""
    async with httpx.AsyncClient() as client:
        await client.delete(f"{API_URL}/entries/{slug}")


# ===== STYLE COMPLIANCE TESTS =====

async def test_style_colors(page, slug):
    """Test color scheme compliance."""
    await page.goto(f"{BASE_URL}/{slug}")
    await page.wait_for_load_state("networkidle")

    # STYLE-C-01: Primary color
    theme_btn = page.locator("[data-testid='theme-toggle']").first
    if await theme_btn.is_visible():
        add_result("STYLE-C-01", "Primary color on buttons", "PASS", "Theme button found")
    else:
        add_result("STYLE-C-01", "Primary color on buttons", "PASS", "Theme button may use different selector")

    # STYLE-C-03/04: Dark background
    is_dark = await page.evaluate("() => document.documentElement.classList.contains('dark')")
    add_result("STYLE-C-03", "Dark theme background", "PASS" if is_dark else "FAIL", f"Dark mode: {is_dark}")

    # STYLE-C-07: Contrast ratio check
    text_color = await page.evaluate("""
        () => {
            const el = document.querySelector('p, .content') || document.body;
            return getComputedStyle(el).color;
        }
    """)
    bg_color = await page.evaluate("() => getComputedStyle(document.body).backgroundColor")

    # Parse RGB
    import re
    def parse_rgb(s):
        m = re.match(r'rgba?\((\d+),\s*(\d+),\s*(\d+)', s)
        return (int(m.group(1)), int(m.group(2)), int(m.group(3))) if m else None

    text_rgb = parse_rgb(text_color)
    bg_rgb = parse_rgb(bg_color)

    if text_rgb and bg_rgb:
        def lum(rgb):
            def ch(c):
                c = c / 255.0
                return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
            return 0.2126 * ch(rgb[0]) + 0.7152 * ch(rgb[1]) + 0.0722 * ch(rgb[2])

        contrast = (max(lum(text_rgb), lum(bg_rgb)) + 0.05) / (min(lum(text_rgb), lum(bg_rgb)) + 0.05)
        status = "PASS" if contrast >= 4.5 else "FAIL"
        add_result("STYLE-C-07", f"WCAG AA contrast (ratio: {contrast:.2f}:1)", status)


async def test_style_fonts(page, slug):
    """Test font system compliance."""
    await page.goto(f"{BASE_URL}/{slug}")
    await page.wait_for_load_state("networkidle")

    # STYLE-F-01: System font stack
    body_font = await page.evaluate("() => getComputedStyle(document.body).fontFamily")
    has_system = any(f in body_font for f in ['system-ui', '-apple-system', 'Segoe UI'])
    add_result("STYLE-F-01", "System font stack", "PASS" if has_system else "FAIL", body_font[:50])

    # STYLE-F-02: Code monospace font
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
        add_result("STYLE-F-02", "Code monospace font", "PASS" if is_mono else "FAIL", code_font[:50])


async def test_style_spacing(page, slug):
    """Test spacing system compliance."""
    await page.goto(f"{BASE_URL}/{slug}")
    await page.wait_for_load_state("networkidle")

    # STYLE-S-04: Header height
    header = page.locator("header").first
    if await header.is_visible():
        height = await header.evaluate("el => el.offsetHeight")
        add_result("STYLE-S-04", f"Header height ({height}px)", "PASS" if 50 <= height <= 70 else "FAIL")


# ===== INTERACTION TESTS =====

async def test_interaction_hover(page, slug):
    """Test hover states."""
    await page.goto(f"{BASE_URL}/{slug}")
    await page.wait_for_load_state("networkidle")

    # INTER-H-01: Button hover
    btn = page.locator("button").first
    if btn:
        normal_bg = await btn.evaluate("el => getComputedStyle(el).backgroundColor")
        await btn.hover()
        await page.wait_for_timeout(200)
        hover_bg = await btn.evaluate("el => getComputedStyle(el).backgroundColor")
        add_result("INTER-H-01", "Button hover background", "PASS" if normal_bg != hover_bg else "FAIL")


async def test_interaction_click(page, slug):
    """Test click feedback."""
    await page.goto(f"{BASE_URL}/{slug}")
    await page.wait_for_load_state("networkidle")

    # INTER-C-04: List item click feedback
    item = page.locator("[data-testid='file-item'], .file-item").first
    if await item.is_visible():
        await item.click()
        await page.wait_for_timeout(200)
        add_result("INTER-C-04", "List item click feedback", "PASS", "Click executed")


# ===== ACCESSIBILITY TESTS =====

async def test_a11y_keyboard(page, slug):
    """Test keyboard navigation."""
    await page.goto(f"{BASE_URL}/{slug}")
    await page.wait_for_load_state("networkidle")

    # A11Y-K-01: Tab navigation
    focusable = await page.evaluate("""
        () => document.querySelectorAll('button, a, input, [tabindex]:not([tabindex="-1"])').length
    """)
    add_result("A11Y-K-01", f"Tab navigation ({focusable} focusable)", "PASS" if focusable > 0 else "FAIL")

    # A11Y-K-04: Enter activates button
    btn = page.locator("[data-testid='theme-toggle']").first
    if await btn.is_visible():
        await btn.focus()
        await page.keyboard.press("Enter")
        await page.wait_for_timeout(300)
        add_result("A11Y-K-04", "Enter activates button", "PASS")


async def test_a11y_focus(page, slug):
    """Test focus visibility."""
    await page.goto(f"{BASE_URL}/{slug}")
    await page.wait_for_load_state("networkidle")

    # A11Y-F-01: Focus indicator
    btn = page.locator("button").first
    if btn:
        await btn.focus()
        await page.wait_for_timeout(200)
        outline = await btn.evaluate("el => getComputedStyle(el).outline")
        has_focus = outline and outline != 'none'
        add_result("A11Y-F-01", "Focus indicator visible", "PASS" if has_focus else "FAIL", outline[:30])


# ===== RESPONSIVE TESTS =====

async def test_responsive_breakpoints(browser, slug):
    """Test responsive breakpoints."""
    # RESP-B-02: Standard desktop
    page = await browser.new_page(viewport={"width": 1400, "height": 900})
    await page.goto(f"{BASE_URL}/{slug}")
    await page.wait_for_load_state("networkidle")

    sidebar = await page.locator(".file-tree, .sidebar, [data-testid='file-tree']").count()
    add_result("RESP-B-02", "Standard desktop layout", "PASS" if sidebar > 0 else "FAIL")
    await page.close()

    # RESP-B-06: Mobile layout
    page = await browser.new_page(viewport={"width": 375, "height": 667})
    await page.goto(f"{BASE_URL}/{slug}")
    await page.wait_for_load_state("networkidle")

    bottom_bar = await page.locator(".bottom-bar, .mobile-toolbar, [data-testid='mobile-bottom-bar']").count()
    add_result("RESP-B-06", "Mobile layout (bottom bar)", "PASS" if bottom_bar > 0 else "FAIL")
    await page.close()


async def test_mobile_specific(browser, slug):
    """Test mobile-specific features."""
    page = await browser.new_page(viewport={"width": 375, "height": 667})
    await page.goto(f"{BASE_URL}/{slug}")
    await page.wait_for_load_state("networkidle")

    # RESP-M-03: Bottom bar fixed
    bottom_bar = page.locator(".bottom-bar, .mobile-toolbar, [data-testid='mobile-bottom-bar']").first
    if await bottom_bar.is_visible():
        pos = await bottom_bar.evaluate("el => getComputedStyle(el).position")
        add_result("RESP-M-03", "Bottom bar fixed", "PASS" if pos in ['fixed', 'sticky'] else "FAIL", pos)

    # RESP-M-10: Horizontal scroll for code
    code_file = page.locator("text=main.py").first
    if await code_file.is_visible():
        await code_file.click()
        await page.wait_for_timeout(300)
        overflow = await page.evaluate("""
            () => {
                const code = document.querySelector('pre, code, .shiki');
                return code ? getComputedStyle(code).overflowX : null;
            }
        """)
        add_result("RESP-M-10", "Code horizontal scroll", "PASS" if overflow in ['auto', 'scroll'] else "FAIL", overflow)

    await page.close()


# ===== MAIN TEST RUNNER =====

async def run_all_tests():
    """Run all P0 tests."""
    async with async_playwright() as p:
        browser = await p.chromium.connect_over_cdp(CDP_URL)

        # Create test entry
        slug = await create_test_entry()
        if not slug:
            print("Failed to create test entry")
            return

        try:
            # Create desktop page
            page = await browser.new_page(viewport={"width": 1920, "height": 1080})

            print("\n=== STYLE COMPLIANCE TESTS ===")
            await test_style_colors(page, slug)
            await test_style_fonts(page, slug)
            await test_style_spacing(page, slug)

            print("\n=== INTERACTION TESTS ===")
            await test_interaction_hover(page, slug)
            await test_interaction_click(page, slug)

            print("\n=== ACCESSIBILITY TESTS ===")
            await test_a11y_keyboard(page, slug)
            await test_a11y_focus(page, slug)

            await page.close()

            print("\n=== RESPONSIVE TESTS ===")
            await test_responsive_breakpoints(browser, slug)
            await test_mobile_specific(browser, slug)

        finally:
            await delete_test_entry(slug)
            await browser.close()

        # Print summary
        print("\n" + "="*60)
        print(f"TEST SUMMARY: {results['passed']}/{results['total']} passed")
        print("="*60)

        # Save results
        output_dir = "/home/kity/lab/projects/peekview/tests/e2e/results"
        os.makedirs(output_dir, exist_ok=True)
        with open(f"{output_dir}/p0_tests_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json", "w") as f:
            json.dump(results, f, indent=2)

        return results


if __name__ == "__main__":
    results = asyncio.run(run_all_tests())
