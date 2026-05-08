#!/usr/bin/env python3
"""
Check if README.md features section matches actual code implementation.
Scans source code to detect implemented features and verifies they are documented.
"""

import re
from pathlib import Path
from typing import Set, List, Tuple


def scan_frontend_features() -> Set[str]:
    """Scan frontend code for implemented features."""
    features = set()
    src_dir = Path("frontend-v3/src")

    if not src_dir.exists():
        return features

    # Check for Mermaid support
    mermaid_files = list(src_dir.rglob("*mermaid*"))
    if mermaid_files:
        features.add("mermaid")

    # Check for mobile UI
    mobile_files = list(src_dir.rglob("*Mobile*"))
    if mobile_files:
        features.add("mobile-ui")

    # Check for theme toggle
    theme_files = list(src_dir.rglob("*Theme*"))
    if theme_files:
        features.add("theme-toggle")

    # Check for file tree
    tree_files = list(src_dir.rglob("*FileTree*"))
    if tree_files:
        features.add("file-tree")

    # Check for code highlighting
    shiki_files = list(src_dir.rglob("*shiki*"))
    if shiki_files:
        features.add("code-highlighting")

    # Check for markdown rendering
    md_files = list(src_dir.rglob("*Markdown*"))
    if md_files:
        features.add("markdown-rendering")

    # Check for copy/download
    if any("copy" in f.read_text().lower() for f in src_dir.rglob("*.vue") if f.exists()):
        features.add("copy-download")

    return features


def scan_backend_features() -> Set[str]:
    """Scan backend code for implemented features."""
    features = set()
    backend_dir = Path("backend/peekview")

    if not backend_dir.exists():
        return features

    # Check for API endpoints
    api_dir = backend_dir / "api"
    if api_dir.exists():
        features.add("rest-api")

    # Check for CLI
    cli_file = backend_dir / "cli.py"
    if cli_file.exists():
        features.add("cli")

    # Check for FTS search
    if any("fts" in f.read_text().lower() for f in backend_dir.rglob("*.py")):
        features.add("full-text-search")

    # Check for file upload
    if any("upload" in f.read_text().lower() for f in backend_dir.rglob("*.py")):
        features.add("file-upload")

    return features


def check_readme_features(implemented: Set[str]) -> Tuple[bool, List[str]]:
    """Check if all implemented features are documented in README."""
    readme = Path("README.md")
    if not readme.exists():
        return False, ["README.md not found"]

    content = readme.read_text().lower()
    missing = []

    feature_keywords = {
        "mermaid": ["mermaid", "diagram", "图表"],
        "mobile-ui": ["mobile", "responsive", "移动端"],
        "theme-toggle": ["theme", "dark", "light", "主题"],
        "file-tree": ["file tree", "目录树", "文件树"],
        "code-highlighting": ["highlight", "shiki", "语法高亮"],
        "markdown-rendering": ["markdown", "渲染"],
        "copy-download": ["copy", "download", "复制", "下载"],
        "cli": ["cli", "command line", "命令行"],
        "full-text-search": ["search", "fts", "全文搜索"],
        "file-upload": ["upload", "上传"],
    }

    for feature in implemented:
        keywords = feature_keywords.get(feature, [feature])
        if not any(kw in content for kw in keywords):
            missing.append(feature)

    return len(missing) == 0, missing


def main():
    print("=== Checking Feature Documentation Sync ===\n")

    frontend_features = scan_frontend_features()
    backend_features = scan_backend_features()
    all_features = frontend_features | backend_features

    print(f"Detected frontend features: {', '.join(sorted(frontend_features))}")
    print(f"Detected backend features: {', '.join(sorted(backend_features))}")
    print(f"Total implemented: {len(all_features)}\n")

    is_synced, missing = check_readme_features(all_features)

    if is_synced:
        print("✅ All implemented features are documented in README.md")
        return 0
    else:
        print(f"⚠️  {len(missing)} features implemented but NOT documented:")
        for feat in sorted(missing):
            print(f"   - {feat}")
        print("\nPlease update README.md to include these features.")
        return 1


if __name__ == "__main__":
    exit(main())
