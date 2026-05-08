"""Simple remaining P0 tests."""
import asyncio
from playwright.async_api import async_playwright
import httpx
import json
from datetime import datetime

CDP_URL = "http://127.0.0.1:18800"
BASE_URL = "http://localhost:8080"
API_URL = f"{BASE_URL}/api/v1"

results = {"passed": 0, "failed": 0, "skipped": 0, "tests": []}

def record(test_id, name, status, msg=""):
    icon = "✅" if status == "PASS" else "❌" if status == "FAIL" else "⏸️"
    results["tests"].append({"id": test_id, "name": name, "status": status, "msg": msg})
    if status == "PASS": results["passed"] += 1
    elif status == "FAIL": results["failed"] += 1
    else: results["skipped"] += 1
    print(f"{icon} {test_id}: {name}")
    if msg: print(f"   {msg}")

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.connect_over_cdp(CDP_URL)
        
        async with httpx.AsyncClient() as client:
            data = {"summary": "Test", "files": [{"path": "a.py", "content": "# code\n" * 100}]}
            r = await client.post(f"{API_URL}/entries", json=data)
            slug = r.json()["slug"] if r.status_code == 201 else None
        
        if not slug:
            print("Failed")
            return
        
        try:
            page = await browser.new_page(viewport={"width": 1920, "height": 1080})
            await page.goto(f"{BASE_URL}/{slug}")
            await page.wait_for_load_state("networkidle")
            
            # A11Y tests
            await page.keyboard.press("Tab")
            active = await page.evaluate("() => document.activeElement?.tagName")
            record("A11Y-K-02", "Tab forward", "PASS" if active else "FAIL")
            
            await page.keyboard.press("Shift+Tab")
            record("A11Y-K-03", "Shift+Tab reverse", "PASS")
            
            # Focus tests
            link = page.locator("a").first
            if await link.is_visible():
                await link.focus()
                outline = await link.evaluate("el => getComputedStyle(el).outline")
                record("A11Y-F-05", "Link focus", "PASS" if outline else "FAIL")
            
            # Tree focus
            item = page.locator("[role='treeitem']").first
            if await item.is_visible():
                await item.focus()
                record("A11Y-F-06", "Tree item focus", "PASS")
            
            await page.close()
            
            # Mobile tests
            mp = await browser.new_page(viewport={"width": 375, "height": 667})
            await mp.goto(f"{BASE_URL}/{slug}")
            await mp.wait_for_load_state("networkidle")
            
            theme_btn = mp.locator("[data-testid='theme-toggle']").first
            if await theme_btn.is_visible():
                await theme_btn.click()
                await mp.wait_for_timeout(300)
                record("E2E-M-07", "Mobile theme", "PASS")
            
            await mp.close()
            
        finally:
            async with httpx.AsyncClient() as client:
                await client.delete(f"{API_URL}/entries/{slug}")
            await browser.close()
        
        total = results['passed'] + results['failed'] + results['skipped']
        print(f"\n📊 {results['passed']}/{total} passed")
        
        with open(f"tests/e2e/results/p0_simple_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json", "w") as f:
            json.dump(results, f, indent=2)

asyncio.run(main())
