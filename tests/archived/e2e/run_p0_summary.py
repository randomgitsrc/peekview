#!/usr/bin/env python3
"""Aggregate all P0 test results."""

import json
import os
from pathlib import Path

def main():
    results_dir = Path("/home/kity/lab/projects/peekview/tests/e2e/results")

    total_passed = 0
    total_failed = 0
    total_skipped = 0
    all_tests = []

    # Collect all JSON result files
    for f in results_dir.glob("p0_*.json"):
        try:
            with open(f) as fp:
                data = json.load(fp)
                total_passed += data.get("passed", 0)
                total_failed += data.get("failed", 0)
                total_skipped += data.get("skipped", 0)
                all_tests.extend(data.get("tests", []))
        except Exception as e:
            print(f"Error reading {f}: {e}")

    total = total_passed + total_failed + total_skipped
    unique_tests = {t["id"]: t for t in all_tests}
    unique_count = len(unique_tests)

    # P0 target
    p0_target = 161
    coverage = (unique_count / p0_target) * 100 if p0_target > 0 else 0
    pass_rate = (total_passed / total) * 100 if total > 0 else 0

    print("=" * 60)
    print("📊 P0 TEST SUMMARY")
    print("=" * 60)
    print(f"\n📈 Progress:")
    print(f"   Unique P0 tests executed: {unique_count}/{p0_target} ({coverage:.1f}%)")
    print(f"   Total test runs: {total}")
    print(f"   ✅ Passed: {total_passed}")
    print(f"   ❌ Failed: {total_failed}")
    print(f"   ⏸️  Skipped: {total_skipped}")
    print(f"   Pass rate: {pass_rate:.1f}%")

    # Remaining tests
    remaining = p0_target - unique_count
    print(f"\n🎯 Remaining: {remaining} P0 tests to execute")

    # List failed tests
    failed_tests = [t for t in unique_tests.values() if t["status"] == "FAIL"]
    if failed_tests:
        print(f"\n❌ Failed Tests ({len(failed_tests)}):")
        for t in failed_tests[:20]:
            print(f"   - {t['id']}: {t['name']}")
        if len(failed_tests) > 20:
            print(f"   ... and {len(failed_tests) - 20} more")

    # Save aggregate
    summary = {
        "unique_executed": unique_count,
        "p0_target": p0_target,
        "coverage_pct": round(coverage, 1),
        "passed": total_passed,
        "failed": total_failed,
        "skipped": total_skipped,
        "pass_rate_pct": round(pass_rate, 1),
        "remaining": remaining,
        "tests": list(unique_tests.values())
    }

    with open(results_dir / "p0_aggregate_summary.json", "w") as f:
        json.dump(summary, f, indent=2)

    print(f"\n💾 Summary saved to: {results_dir / 'p0_aggregate_summary.json'}")

if __name__ == "__main__":
    main()
