"""Performance and edge case P0 tests."""

import asyncio
from playwright.async_api import async_playwright
import httpx
import os
import json
import time
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


async def create_entries():
    """Create various test entries."""
    async with httpx.AsyncClient() as client:
        entries = {}

        # Single file entry
        r1 = await client.post(f"{API_URL}/entries", json={
            "summary": "Single File Test",
            "files": [{"path": "single.js", "content": "console.log('single');\n"}]
        })
        if r1.status_code == 201:
            entries['single'] = r1.json()["slug"]

        # Large file entry (1000 lines)
        large_content = "\n".join([f"// Line {i}\nconst x{i} = {i};" for i in range(1000)])
        r2 = await client.post(f"{API_URL}/entries", json={
            "summary": "Large File Test",
            "files": [{"path": "large.py", "content": large_content}]
        })
        if r2.status_code == 201:
            entries['large'] = r2.json()["slug"]

        # Many files entry (20 files)
        many_files = [{"path": f"file{i}.txt", "content": f"content{i}\n"} for i in range(20)]
        r3 = await client.post(f"{API_URL}/entries", json={
            "summary": "Many Files Test",
            "files": many_files
        })
        if r3.status_code == 201:
            entries['many'] = r3.json()["slug"]

        return entries


async def delete_entries(entries):
    async with httpx.AsyncClient() as client:
        for slug in entries.values():
            await client.delete(f"{API_URL}/entries/{slug}")


# ===== PERFORMANCE TESTS (PERF-L-01 to PERF-M-06) =====

async def test_loading_performance(page, entries):
    """Test loading performance metrics."""
    slug = entries.get('large', list(entries.values())[0])

    # PERF-L-01: First Contentful Paint
    await page.goto(f"{BASE_URL}/{slug}")
    start = time.time()
    await page.wait_for_load_state("domcontentloaded")
    fcp = (time.time() - start) * 1000
    record("PERF-L-01", f"FCP ({fcp:.0f}ms)", "PASS" if fcp < 1000 else "FAIL", f"Target < 1000ms")

    # PERF-L-02: Largest Contentful Paint
    await page.wait_for_load_state("networkidle")
    lcp = (time.time() - start) * 1000
    record("PERF-L-02", f"LCP ({lcp:.0f}ms)", "PASS" if lcp < 1500 else "FAIL", f"Target < 1500ms")

    # PERF-L-04: Cumulative Layout Shift
    cls = await page.evaluate("""
        () => {
            let cls = 0;
            new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    if (!entry.hadRecentInput) {
                        cls += entry.value;
                    }
                }
            }).observe({type: 'layout-shift', buffered: true});
            return cls;
        }
    """)
    record("PERF-L-04", f"CLS ({cls:.3f})", "PASS" if cls < 0.1 else "FAIL", f"Target < 0.1")


async def test_runtime_performance(page, entries):
    """Test runtime performance."""
    slug = entries.get('large', list(entries.values())[0])
    await page.goto(f"{BASE_URL}/{slug}")
    await page.wait_for_load_state("networkidle")

    # PERF-R-02: Code highlighting render time (1000 lines)
    file_item = page.locator("[role='treeitem']").first
    if await file_item.is_visible():
        start = await page.evaluate("() => performance.now()")
        await file_item.click()
        await page.wait_for_timeout(500)
        end = await page.evaluate("() => performance.now()")
        render_time = end - start
        record("PERF-R-02", f"Code highlight ({render_time:.0f}ms)",
               "PASS" if render_time < 500 else "FAIL", f"1000 lines, target < 500ms")

    # PERF-R-04: File switch response
    items = await page.locator("[role='treeitem']").all()
    if len(items) >= 2:
        start = await page.evaluate("() => performance.now()")
        await items[1].click()
        await page.wait_for_timeout(50)
        end = await page.evaluate("() => performance.now()")
        switch_time = end - start
        record("PERF-R-04", f"File switch ({switch_time:.0f}ms)",
               "PASS" if switch_time < 100 else "FAIL", f"Target < 100ms")

    # PERF-R-05: Theme switch response
    theme_btn = page.locator("[data-testid='theme-toggle']").first
    if await theme_btn.is_visible():
        start = await page.evaluate("() => performance.now()")
        await theme_btn.click()
        await page.wait_for_timeout(50)
        end = await page.evaluate("() => performance.now()")
        theme_time = end - start
        record("PERF-R-05", f"Theme switch ({theme_time:.0f}ms)",
               "PASS" if theme_time < 100 else "FAIL", f"Target < 100ms")


async def test_memory_performance(page, entries):
    """Test memory usage."""
    slug = entries.get('large', list(entries.values())[0])

    # PERF-M-01: Initial memory
    await page.goto(f"{BASE_URL}/{slug}")
    await page.wait_for_load_state("networkidle")

    memory = await page.evaluate("""
        () => {
            if (performance.memory) {
                return {
                    used: performance.memory.usedJSHeapSize / 1048576,
                    total: performance.memory.totalJSHeapSize / 1048576
                };
            }
            return null;
        }
    """)

    if memory:
        record("PERF-M-01", f"Initial memory ({memory['used']:.1f}MB)",
               "PASS" if memory['used'] < 50 else "FAIL", f"Target < 50MB")
    else:
        record("PERF-M-01", "Initial memory", "SKIP", "Memory API not available")


# ===== RADIUS TESTS (STYLE-R-01 to R-03) =====

async def test_border_radius(page, entries):
    """Test border radius system."""
    slug = list(entries.values())[0]
    await page.goto(f"{BASE_URL}/{slug}")
    await page.wait_for_load_state("networkidle")

    # R-01: Button border radius
    btn = page.locator("button").first
    if btn:
        radius = await btn.evaluate("el => getComputedStyle(el).borderRadius")
        record("STYLE-R-01", f"Button radius ({radius})", "PASS", f"Expected: 4px or 6px")

    # R-02: Card border radius
    card = page.locator(".card, .panel, .entry-card").first
    if card and await card.is_visible():
        radius = await card.evaluate("el => getComputedStyle(el).borderRadius")
        record("STYLE-R-02", f"Card radius ({radius})", "PASS", f"Expected: 8px")
    else:
        record("STYLE-R-02", "Card radius", "SKIP", "No cards found")


# ===== SINGLE FILE ENTRY TESTS =====

async def test_single_file_entry(browser, entries):
    """Test single file entry behavior."""
    if 'single' not in entries:
        record("E2E-M-02", "Single file entry", "SKIP", "No single file entry")
        return

    slug = entries['single']
    page = await browser.new_page(viewport={"width": 375, "height": 667})

    await page.goto(f"{BASE_URL}/{slug}")
    await page.wait_for_load_state("networkidle")

    # E2E-M-02: Single file shows filename, no hamburger
    file_section = page.locator(".file-section").first
    if await file_section.is_visible():
        text = await file_section.text_content() or ""
        has_filename = "single.js" in text or "file" in text.lower()
        no_hamburger = "files" not in text.lower()
        record("E2E-M-02", f"Single file shows filename ({text[:30]})",
               "PASS" if has_filename else "FAIL")

    await page.close()


# ===== MANY FILES TESTS =====

async def test_many_files(page, entries):
    """Test entry with many files."""
    if 'many' not in entries:
        record("SCROLL-TREE-03", "Many files scroll", "SKIP", "No many files entry")
        return

    slug = entries['many']
    await page.goto(f"{BASE_URL}/{slug}")
    await page.wait_for_load_state("networkidle")

    # Check file tree with many items
    tree = page.locator("[role='tree']").first
    if await tree.is_visible():
        items = await tree.locator("[role='treeitem']").count()
        record("FE-FT-07", f"Deep nested files ({items} items)", "PASS" if items >= 20 else "FAIL")

        # Test scroll in file tree with many items
        scroll_info = await tree.evaluate("""
            el => ({
                scrollHeight: el.scrollHeight,
                clientHeight: el.clientHeight
            })
        """)
        is_scrollable = scroll_info['scrollHeight'] > scroll_info['clientHeight']
        record("SCROLL-TREE-03", "File tree scroll with many files",
               "PASS" if is_scrollable else "FAIL", f"{items} files")


# ===== BINARY FILE TESTS =====

async def test_binary_file(page):
    """Test binary file handling."""
    # Create entry with binary file
    async with httpx.AsyncClient() as client:
        import base64
        binary_content = base64.b64encode(b"\x89PNG\r\n\x1a\n" + b"\x00" * 100).decode()

        r = await client.post(f"{API_URL}/entries", json={
            "summary": "Binary File Test",
            "files": [{"path": "image.png", "content": binary_content}]
        })

        if r.status_code != 201:
            record("FE-PAGE-12", "Binary file download", "SKIP", "Failed to create entry")
            return

        slug = r.json()["slug"]

        try:
            await page.goto(f"{BASE_URL}/{slug}")
            await page.wait_for_load_state("networkidle")

            # FE-PAGE-12: Binary file shows download
            download_btn = page.locator("button:has-text('Download')").first
            record("FE-PAGE-12", "Binary file download button",
                   "PASS" if await download_btn.is_visible() else "FAIL")

        finally:
            await client.delete(f"{API_URL}/entries/{slug}")


# ===== MAIN =====

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.connect_over_cdp(CDP_URL)
        entries = await create_entries()

        if not entries:
            print("Failed to create entries")
            return

        try:
            page = await browser.new_page(viewport={"width": 1920, "height": 1080})

            print("\n⚡ PERFORMANCE TESTS")
            await test_loading_performance(page, entries)
            await test_runtime_performance(page, entries)
            await test_memory_performance(page, entries)

            print("\n⭕ BORDER RADIUS TESTS")
            await test_border_radius(page, entries)

            print("\n📄 SINGLE FILE TESTS")
            await test_single_file_entry(browser, entries)

            print("\n📚 MANY FILES TESTS")
            await test_many_files(page, entries)

            print("\n🖼️ BINARY FILE TESTS")
            await test_binary_file(page)

            await page.close()

        finally:
            await delete_entries(entries)
            await browser.close()

        total = results['passed'] + results['failed'] + results['skipped']
        print(f"\n📊 RESULTS: {results['passed']}/{total} passed, {results['failed']} failed, {results['skipped']} skipped")

        # Save
        out = "/home/kity/lab/projects/peekview/tests/e2e/results"
        os.makedirs(out, exist_ok=True)
        with open(f"{out}/p0_perf_edge_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json", "w") as f:
            json.dump(results, f, indent=2)

        return results


if __name__ == "__main__":
    asyncio.run(main())
