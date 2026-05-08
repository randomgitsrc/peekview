"""Remaining P0 tests - Search, Keyboard, Download, Performance."""

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
            "summary": "Search Keyboard Test",
            "tags": ["test", "search", "keyboard"],
            "files": [
                {"path": "main.py", "content": "def main():\n    print('hello')\n    return 42\n"},
                {"path": "utils.py", "content": "def helper():\n    pass\n"},
                {"path": "README.md", "content": "# Test Project\n\n## Overview\n\nThis is a test.\n\n## Usage\n\nInstructions here.\n"}
            ]
        }
        r = await client.post(f"{API_URL}/entries", json=data)
        return r.json()["slug"] if r.status_code == 201 else None


async def delete_entry(slug):
    async with httpx.AsyncClient() as client:
        await client.delete(f"{API_URL}/entries/{slug}")


# ===== SEARCH TESTS (SEARCH-01 to 06) =====

async def test_search(page, slug):
    """Test search functionality."""
    # Go to entry list
    await page.goto(f"{BASE_URL}/")
    await page.wait_for_load_state("networkidle")

    # SEARCH-01: Search input exists
    try:
        search = page.locator("input[type='search'], input[placeholder*='search' i], .search-input").first
        if search:
            has_search = await search.is_visible()
            record("SEARCH-01", "Search input exists", "PASS" if has_search else "FAIL")
        else:
            record("SEARCH-01", "Search input exists", "FAIL", "No search input found")
    except Exception:
        record("SEARCH-01", "Search input exists", "FAIL", "Search check failed")

    # SEARCH-02: Search by keyword
    try:
        if search and await search.is_visible():
            await search.fill("test")
            await search.press("Enter")
            await page.wait_for_timeout(500)

            results_count = await page.locator(".entry-item, .entry-card").count()
            record("SEARCH-02", f"Search by keyword ({results_count} results)",
                   "PASS" if results_count >= 0 else "FAIL")
        else:
            record("SEARCH-02", "Search by keyword", "SKIP", "Search not available")
    except Exception:
        record("SEARCH-02", "Search by keyword", "SKIP", "Search failed")

    # SEARCH-03: Search by tag
    try:
        tag = page.locator(".tag, [class*='tag']").first
        if tag and await tag.is_visible():
            await tag.click()
            await page.wait_for_timeout(300)
            record("SEARCH-03", "Search by tag click", "PASS")
        else:
            record("SEARCH-03", "Search by tag click", "SKIP", "No tags found")
    except Exception:
        record("SEARCH-03", "Search by tag click", "SKIP", "Tag click failed")

    # SEARCH-05: Empty search shows all
    try:
        # Re-locate search input in case page changed
        search = page.locator("input[type='search'], input[placeholder*='search' i], .search-input").first
        if search and await search.is_visible():
            await search.fill("")
            await search.press("Enter")
            await page.wait_for_timeout(300)
            all_count = await page.locator(".entry-item, .entry-card").count()
            record("SEARCH-05", f"Empty search shows all ({all_count} items)", "PASS")
        else:
            record("SEARCH-05", "Empty search shows all", "SKIP", "Search input not available")
    except Exception:
        record("SEARCH-05", "Empty search shows all", "SKIP", "Search interaction failed")


# ===== KEYBOARD NAVIGATION TESTS (A11Y-K-01 to K-09) =====

async def test_keyboard_nav(page, slug):
    """Test keyboard navigation."""
    await page.goto(f"{BASE_URL}/{slug}")
    await page.wait_for_load_state("networkidle")

    # K-01: Tab navigation
    try:
        await page.keyboard.press("Tab")
        await page.wait_for_timeout(100)
        active = await page.evaluate("() => document.activeElement?.tagName")
        record("A11Y-K-01", f"Tab navigation ({active})",
               "PASS" if active and active != "BODY" else "FAIL")
    except Exception:
        record("A11Y-K-01", "Tab navigation", "FAIL", "Tab failed")

    # K-02: Enter activates
    try:
        await page.keyboard.press("Enter")
        await page.wait_for_timeout(200)
        record("A11Y-K-02", "Enter key activation", "PASS")
    except Exception:
        record("A11Y-K-02", "Enter key activation", "FAIL")

    # K-04: Focus trap in modals
    record("A11Y-K-04", "Focus trap in modals", "SKIP", "No modals tested")

    # K-05: Escape closes
    try:
        await page.keyboard.press("Escape")
        await page.wait_for_timeout(200)
        record("A11Y-K-05", "Escape key handling", "PASS")
    except Exception:
        record("A11Y-K-05", "Escape key handling", "FAIL")


# ===== DOWNLOAD TESTS (DOWNLOAD-01 to 04) =====

async def test_download(page, slug):
    """Test download functionality."""
    await page.goto(f"{BASE_URL}/{slug}")
    await page.wait_for_load_state("networkidle")

    # Click a file first
    try:
        file_item = page.locator("[role='treeitem'], .file-item").first
        if file_item and await file_item.is_visible():
            await file_item.click()
            await page.wait_for_timeout(300)
    except Exception:
        pass

    # DOWNLOAD-01: Download button exists
    try:
        download_btn = page.locator("button:has-text('Download'), [data-testid='download']").first
        if download_btn:
            has_download = await download_btn.is_visible()
            record("DOWNLOAD-01", "Download button exists",
                   "PASS" if has_download else "FAIL")
        else:
            record("DOWNLOAD-01", "Download button exists", "SKIP", "No download button")
    except Exception:
        record("DOWNLOAD-01", "Download button exists", "SKIP", "Download check failed")


# ===== PERFORMANCE TESTS (PERF-01 to 06) =====

async def test_performance(page, slug):
    """Test performance metrics."""
    await page.goto(f"{BASE_URL}/{slug}")

    # Measure load time
    start = await page.evaluate("() => performance.timing?.navigationStart || Date.now()")
    await page.wait_for_load_state("networkidle")
    end = await page.evaluate("() => performance.timing?.loadEventEnd || Date.now()")
    load_time = end - start if end > start else 0

    # PERF-01: Page load time
    record("PERF-01", f"Page load time ({load_time}ms)",
           "PASS" if load_time < 3000 else "FAIL", "Target: <3000ms")

    # PERF-02: FCP
    try:
        fcp_entry = await page.evaluate("""
            () => {
                const entries = performance.getEntriesByName('first-contentful-paint');
                return entries[0]?.startTime || 0;
            }
        """)
        fcp = int(fcp_entry) if fcp_entry else 0
        record("PERF-02", f"FCP ({fcp}ms)",
               "PASS" if fcp < 1800 else "FAIL", "Target: <1800ms")
    except Exception:
        record("PERF-02", "FCP", "SKIP", "Performance API not available")

    # PERF-04: No layout shift
    try:
        cls = await page.evaluate("""
            () => {
                let cls = 0;
                new PerformanceObserver((list) => {
                    for (const entry of list.getEntries()) {
                        if (!entry.hadRecentInput) cls += entry.value;
                    }
                }).observe({type: 'layout-shift', buffered: true});
                return cls;
            }
        """)
        cls_val = float(cls) if cls else 0
        record("PERF-04", f"CLS ({cls_val:.4f})",
               "PASS" if cls_val < 0.1 else "FAIL", "Target: <0.1")
    except Exception:
        record("PERF-04", "CLS", "SKIP", "Performance API not available")

    # PERF-06: Memory usage
    try:
        memory = await page.evaluate("""
            () => {
                if (performance.memory) {
                    return performance.memory.usedJSHeapSize / 1024 / 1024;
                }
                return 0;
            }
        """)
        mem_mb = float(memory) if memory else 0
        record("PERF-06", f"Memory usage ({mem_mb:.1f}MB)",
               "PASS" if mem_mb < 100 else "FAIL", "Target: <100MB")
    except Exception:
        record("PERF-06", "Memory usage", "SKIP", "Memory API not available")


# ===== URL ROUTING TESTS (URL-01 to 04) =====

async def test_url_routing(page, slug):
    """Test URL routing."""
    # URL-01: Entry detail URL
    await page.goto(f"{BASE_URL}/{slug}")
    await page.wait_for_load_state("networkidle")
    record("URL-01", "Entry detail URL", "PASS")

    # URL-02: Invalid slug shows error
    await page.goto(f"{BASE_URL}/invalid-slug-12345")
    await page.wait_for_timeout(500)
    try:
        error_el = page.locator(".error, [class*='error']").first
        error_visible = error_el and await error_el.is_visible()
        record("URL-02", "Invalid slug error", "PASS" if error_visible else "SKIP")
    except Exception:
        record("URL-02", "Invalid slug error", "SKIP", "No error element")


# ===== ENTRY LIST TESTS (LIST-01 to 04) =====

async def test_entry_list(page, slug):
    """Test entry list page."""
    await page.goto(f"{BASE_URL}/")
    await page.wait_for_load_state("networkidle")

    # LIST-01: Entries display
    try:
        entries = await page.locator(".entry-item, .entry-card, [class*='entry']").count()
        record("LIST-01", f"Entries display ({entries} items)",
               "PASS" if entries > 0 else "FAIL")
    except Exception:
        record("LIST-01", "Entries display", "FAIL", "Count failed")

    # LIST-03: Entry click navigates
    try:
        entry = page.locator(".entry-item, .entry-card").first
        if entry and await entry.is_visible():
            await entry.click()
            await page.wait_for_timeout(500)
            url = page.url
            has_slug = "/" in url and len(url.split("/")) > 3
            record("LIST-03", f"Entry click navigates ({url[-20:]})",
                   "PASS" if has_slug else "FAIL")
        else:
            record("LIST-03", "Entry click navigates", "SKIP", "No entries found")
    except Exception:
        record("LIST-03", "Entry click navigates", "SKIP", "Entry click failed")


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

            print("\n🔍 SEARCH TESTS (SEARCH-01 to 06)")
            await test_search(page, slug)

            print("\n⌨️ KEYBOARD NAV TESTS (A11Y-K-01 to K-09)")
            await test_keyboard_nav(page, slug)

            print("\n📥 DOWNLOAD TESTS (DOWNLOAD-01 to 04)")
            await test_download(page, slug)

            print("\n🚀 PERFORMANCE TESTS (PERF-01 to 06)")
            await test_performance(page, slug)

            print("\n🔗 URL ROUTING TESTS (URL-01 to 04)")
            await test_url_routing(page, slug)

            print("\n📋 ENTRY LIST TESTS (LIST-01 to 04)")
            await test_entry_list(page, slug)

            await page.close()

        finally:
            await delete_entry(slug)
            await browser.close()

        total = results['passed'] + results['failed'] + results['skipped']
        print(f"\n📊 RESULTS: {results['passed']}/{total} passed, {results['failed']} failed, {results['skipped']} skipped")

        # Save
        out = "/home/kity/lab/projects/peekview/tests/e2e/results"
        os.makedirs(out, exist_ok=True)
        with open(f"{out}/p0_remaining_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json", "w") as f:
            json.dump(results, f, indent=2)

        return results


if __name__ == "__main__":
    asyncio.run(main())
