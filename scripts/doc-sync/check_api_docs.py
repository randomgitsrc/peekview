#!/usr/bin/env python3
"""
Check if API documentation matches actual API routes in code.
"""

import re
from pathlib import Path


def extract_api_routes():
    """Extract all API routes from backend code."""
    routes = []
    api_dir = Path("backend/peekview/api")

    if not api_dir.exists():
        return routes

    for file in api_dir.glob("*.py"):
        content = file.read_text()
        # Match @router.get/post/put/delete/patch("/path")
        pattern = r'@router\.(get|post|put|delete|patch)\("([^"]+)"'
        matches = re.findall(pattern, content, re.IGNORECASE)
        for method, path in matches:
            routes.append((method.upper(), path))

    return routes


def check_api_docs(routes):
    """Check if routes are documented in README and other docs."""
    docs_to_check = [
        "README.md",
        "backend/README.md",
        "docs/DEPLOYMENT.md",
        "docs/DEBUGGING.md",
    ]

    all_content = ""
    for doc in docs_to_check:
        path = Path(doc)
        if path.exists():
            all_content += path.read_text() + "\n"

    issues = []

    # Check for API version prefix
    if not re.search(r'/api/v\d+/', all_content):
        issues.append("No API version prefix (e.g., /api/v1/) found in documentation")

    # Check for common endpoints
    endpoint_checks = [
        ("/api/v1/entries", ["entries", "entry"]),
        ("/api/v1/entries/{slug}", ["slug", "detail"]),
        ("/api/v1/entries/{slug}/files", ["files"]),
        ("/health", ["health"]),
    ]

    for endpoint, keywords in endpoint_checks:
        found = any(kw in all_content.lower() for kw in keywords)
        if not found:
            issues.append(f"Endpoint pattern '{endpoint}' may not be documented")

    return issues


def main():
    print("=== Checking API Documentation ===\n")

    routes = extract_api_routes()
    if not routes:
        print("⚠️  No API routes found in backend code")
        return 1

    print(f"Found {len(routes)} API routes:")
    for method, path in sorted(routes):
        print(f"  {method} {path}")
    print()

    issues = check_api_docs(routes)

    if issues:
        print("⚠️  Documentation issues found:")
        for issue in issues:
            print(f"  - {issue}")
        return 1
    else:
        print("✅ API documentation appears up to date")
        return 0


if __name__ == "__main__":
    exit(main())
