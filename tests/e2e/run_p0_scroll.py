"""Scroll behavior tests - Page, code, tree, markdown scrolling."""

import asyncio
from playwright.async_api import async_playwright
import httpx
import os
import json
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


async def create_large_entry():
    """Create entry with large content for scroll testing."""
    async with httpx.AsyncClient() as client:
        # Generate large Python file (100 lines)
        large_code = "\n".join([f"def function_{i}():\n    return {i}" for i in range(50)])

        # Generate large Markdown with many sections
        large_md = "# Large Document\n\n"
        for i in range(20):
            large_md += f"## Section {i}\n\nThis is content for section {i}.\n\n```python\nprint({i})\n```\n\n"

        data = {
            "summary": "Scroll Test Entry",
            "tags": ["test"],
            "files": [
                {"path": "large_code.py", "content": large_code},
                {"path": "large_doc.md", "content": large_md},
                {"path": "utils/" + "/".join([f"module_{i}.py" for i in range(10)]), "content": "# module\n"}
            ]
        }
        # Fix path
        data["files"][2]["path"] = "utils/module_a.py"
        data["files"].append({"path": "utils/module_b.py", "content": "# b\n"})
        data["files"].append({"path": "utils/module_c.py", "content": "# c\n"})

        r = await client.post(f"{API_URL}/entries", json=data)
        return r.json()["slug"] if r.status_code == 201 else None


async def delete_entry(slug):
    async with httpx.AsyncClient() as client:
        await client.delete(f"{API_URL}/entries/{slug}")


# ===== PAGE SCROLL TESTS =====

async def test_page_scroll(page, slug):
    """Test page-level scrolling."""
    await page.goto(f"{BASE_URL}/{slug}")
    await page.wait_for_load_state("networkidle")

    # SCROLL-01: Page is scrollable
    scroll_height = await page.evaluate("() => document.documentElement.scrollHeight")
    client_height = await page.evaluate("() => document.documentElement.clientHeight")
    is_scrollable = scroll_height > client_height

    record("SCROLL-01", f"Page scrollable ({scroll_height}px > {client_height}px)",
           "PASS" if is_scrollable else "FAIL",
           f"scrollHeight: {scroll_height}, clientHeight: {client_height}")

    # SCROLL-02: Scroll to bottom works
    if is_scrollable:
        await page.evaluate("() => window.scrollTo(0, document.body.scrollHeight)")
        await page.wait_for_timeout(300)
        scroll_pos = await page.evaluate("() => window.scrollY")
        record("SCROLL-02", "Scroll to bottom", "PASS" if scroll_pos > 0 else "FAIL", f"scrollY: {scroll_pos}")

    # SCROLL-03: Scroll to top works
        await page.evaluate("() => window.scrollTo(0, 0)")
        await page.wait_for_timeout(300)
        scroll_pos = await page.evaluate("() => window.scrollY")
        record("SCROLL-03", "Scroll to top", "PASS" if scroll_pos == 0 else "FAIL")


# ===== CODE VIEWER SCROLL TESTS =====

async def test_code_scroll(page, slug):
    """Test code viewer scrolling."""
    await page.goto(f"{BASE_URL}/{slug}")
    await page.wait_for_load_state("networkidle")

    # Click on large code file
    code_file = page.locator("text=large_code.py").first
    if await code_file.is_visible():
        await code_file.click()
        await page.wait_for_timeout(500)

        # SCROLL-CODE-01: Code viewer is scrollable
        code_viewer = page.locator(".code-viewer, pre, .shiki, code").first
        if code_viewer and await code_viewer.is_visible():
            scroll_info = await code_viewer.evaluate("""
                el => ({
                    scrollHeight: el.scrollHeight,
                    clientHeight: el.clientHeight,
                    scrollWidth: el.scrollWidth,
                    clientWidth: el.clientWidth,
                    overflowY: getComputedStyle(el).overflowY,
                    overflowX: getComputedStyle(el).overflowX
                })
            """)
            is_v_scrollable = scroll_info['scrollHeight'] > scroll_info['clientHeight']
            record("SCROLL-CODE-01", "Code viewer vertical scroll",
                   "PASS" if is_v_scrollable else "FAIL",
                   f"overflowY: {scroll_info['overflowY']}")

            # SCROLL-CODE-02: Code viewer horizontal scroll for long lines
            is_h_scrollable = scroll_info['scrollWidth'] > scroll_info['clientWidth']
            record("SCROLL-CODE-02", "Code viewer horizontal scroll",
                   "PASS" if is_h_scrollable or scroll_info['overflowX'] in ['auto', 'scroll'] else "FAIL",
                   f"overflowX: {scroll_info['overflowX']}")

        # SCROLL-CODE-03: Line numbers stay fixed during scroll
        line_nums = page.locator(".line-numbers, .line-number").first
        if line_nums and await line_nums.is_visible():
            position = await line_nums.evaluate("el => getComputedStyle(el).position")
            record("SCROLL-CODE-03", "Line numbers fixed during scroll",
                   "PASS" if position in ['sticky', 'fixed'] else "FAIL", f"position: {position}")


# ===== FILE TREE SCROLL TESTS =====

async def test_file_tree_scroll(page, slug):
    """Test file tree scrolling."""
    await page.goto(f"{BASE_URL}/{slug}")
    await page.wait_for_load_state("networkidle")

    tree = page.locator(".file-tree, [data-testid='file-tree']").first
    if await tree.is_visible():
        # SCROLL-TREE-01: File tree is independently scrollable
        scroll_info = await tree.evaluate("""
            el => ({
                scrollHeight: el.scrollHeight,
                clientHeight: el.clientHeight,
                overflow: getComputedStyle(el).overflowY
            })
        """)
        is_scrollable = scroll_info['scrollHeight'] > scroll_info['clientHeight']
        record("SCROLL-TREE-01", "File tree independent scroll",
               "PASS" if is_scrollable or scroll_info['overflow'] in ['auto', 'scroll'] else "FAIL",
               f"overflow: {scroll_info['overflow']}")

        # SCROLL-TREE-02: Scroll preserves selection
        file_item = tree.locator("[role='treeitem']").first
        if await file_item.is_visible():
            await file_item.click()
            await page.wait_for_timeout(200)

            # Scroll tree
            await tree.evaluate("el => el.scrollTop = 50")
            await page.wait_for_timeout(200)

            # Check selection preserved
            selected = await tree.locator("[aria-current='true'], .active, .selected").count()
            record("SCROLL-TREE-02", "Scroll preserves file selection",
                   "PASS" if selected > 0 else "FAIL", f"{selected} selected after scroll")


# ===== MARKDOWN SCROLL TESTS =====

async def test_markdown_scroll(page, slug):
    """Test markdown content scrolling."""
    await page.goto(f"{BASE_URL}/{slug}")
    await page.wait_for_load_state("networkidle")

    # Click on large markdown
    md_file = page.locator("text=large_doc.md").first
    if await md_file.is_visible():
        await md_file.click()
        await page.wait_for_timeout(500)

        # SCROLL-MD-01: Markdown content is scrollable
        content = page.locator(".markdown-body, .markdown-viewer, article").first
        if content and await content.is_visible():
            scroll_info = await content.evaluate("""
                el => ({
                    scrollHeight: el.scrollHeight,
                    clientHeight: el.clientHeight,
                    overflow: getComputedStyle(el).overflowY
                })
            """)
            is_scrollable = scroll_info['scrollHeight'] > scroll_info['clientHeight']
            record("SCROLL-MD-01", "Markdown content scrollable",
                   "PASS" if is_scrollable else "FAIL",
                   f"{scroll_info['scrollHeight']}px content")

        # SCROLL-MD-02: TOC navigation scrolls to section
        toc = page.locator(".toc a, .toc-sidebar a, [href^='#']").first
        if toc and await toc.is_visible():
            initial_scroll = await page.evaluate("() => window.scrollY")
            await toc.click()
            await page.wait_for_timeout(500)
            new_scroll = await page.evaluate("() => window.scrollY")
            record("SCROLL-MD-02", "TOC click scrolls to section",
                   "PASS" if new_scroll != initial_scroll else "FAIL",
                   f"scroll: {initial_scroll} -> {new_scroll}")


# ===== MOBILE SCROLL TESTS =====

async def test_mobile_scroll(browser, slug):
    """Test scrolling on mobile viewport."""
    page = await browser.new_page(viewport={"width": 375, "height": 667})
    await page.goto(f"{BASE_URL}/{slug}")
    await page.wait_for_load_state("networkidle")

    # SCROLL-MOBILE-01: Page scrolls on mobile
    scroll_height = await page.evaluate("() => document.documentElement.scrollHeight")
    client_height = await page.evaluate("() => document.documentElement.clientHeight")
    is_scrollable = scroll_height > client_height
    record("SCROLL-MOBILE-01", "Mobile page scrollable",
           "PASS" if is_scrollable else "FAIL",
           f"{scroll_height}px > {client_height}px")

    # SCROLL-MOBILE-02: Bottom bar stays fixed during scroll
    bottom_bar = page.locator(".mobile-bottom-bar").first
    if await bottom_bar.is_visible():
        await page.evaluate("() => window.scrollTo(0, 200)")
        await page.wait_for_timeout(300)

        bar_visible = await bottom_bar.is_visible()
        bar_pos = await bottom_bar.evaluate("el => el.getBoundingClientRect().top")
        record("SCROLL-MOBILE-02", "Bottom bar fixed during scroll",
               "PASS" if bar_visible and bar_pos > 500 else "FAIL",
               f"visible: {bar_visible}, position: {bar_pos}")

    # SCROLL-MOBILE-03: Touch scroll works
    await page.evaluate("() => window.scrollTo(0, 0)")
    await page.wait_for_timeout(200)

    # Simulate touch scroll via JS
    await page.evaluate("() => window.scrollTo({top: 300, behavior: 'smooth'})")
    await page.wait_for_timeout(500)
    scroll_pos = await page.evaluate("() => window.scrollY")
    record("SCROLL-MOBILE-03", "Touch/smooth scroll works",
           "PASS" if scroll_pos > 0 else "FAIL", f"scrollY: {scroll_pos}")

    await page.close()


# ===== SCROLL PERFORMANCE TESTS =====

async def test_scroll_performance(page, slug):
    """Test scroll performance."""
    await page.goto(f"{BASE_URL}/{slug}")
    await page.wait_for_load_state("networkidle")

    # SCROLL-PERF-01: Scroll is smooth (no jank)
    await page.evaluate("""
        () => {
            window.scrollPerf = [];
            const start = performance.now();
            window.addEventListener('scroll', () => {
                window.scrollPerf.push(performance.now());
            }, {passive: true});
        }
    """)

    # Perform scroll
    for i in range(5):
        await page.evaluate(f"() => window.scrollTo(0, {i * 200})")
        await page.wait_for_timeout(100)

    events = await page.evaluate("() => window.scrollPerf.length")
    record("SCROLL-PERF-01", "Scroll event frequency",
           "PASS" if events >= 3 else "FAIL", f"{events} scroll events")


# ===== MAIN =====

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.connect_over_cdp(CDP_URL)
        slug = await create_large_entry()

        if not slug:
            print("Failed to create entry")
            return

        try:
            page = await browser.new_page(viewport={"width": 1920, "height": 1080})

            print("\n📜 PAGE SCROLL TESTS")
            await test_page_scroll(page, slug)

            print("\n💻 CODE VIEWER SCROLL TESTS")
            await test_code_scroll(page, slug)

            print("\n🌲 FILE TREE SCROLL TESTS")
            await test_file_tree_scroll(page, slug)

            print("\n📝 MARKDOWN SCROLL TESTS")
            await test_markdown_scroll(page, slug)

            print("\n⚡ SCROLL PERFORMANCE")
            await test_scroll_performance(page, slug)

            await page.close()

            print("\n📱 MOBILE SCROLL TESTS")
            await test_mobile_scroll(browser, slug)

        finally:
            await delete_entry(slug)
            await browser.close()

        print(f"\n📊 RESULTS: {results['passed']}/{results['passed'] + results['failed']} passed")

        # Save
        out = "/home/kity/lab/projects/peekview/tests/e2e/results"
        os.makedirs(out, exist_ok=True)
        with open(f"{out}/p0_scroll_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json", "w") as f:
            json.dump(results, f, indent=2)


if __name__ == "__main__":
    asyncio.run(main())
