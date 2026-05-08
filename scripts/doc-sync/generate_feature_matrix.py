#!/usr/bin/env python3
"""
Generate feature matrix from code and update documentation.
Creates/updates a FEATURES.md file with auto-detected capabilities.
"""

import re
import json
from pathlib import Path
from datetime import datetime


def scan_features():
    """Scan codebase for implemented features."""
    features = {
        "frontend": {},
        "backend": {},
        "cli": {},
    }

    # Frontend features
    src_dir = Path("frontend-v3/src")
    if src_dir.exists():
        # Check views
        views = list((src_dir / "views").glob("*.vue")) if (src_dir / "views").exists() else []
        features["frontend"]["views"] = [v.stem for v in views]

        # Check components
        components = list((src_dir / "components").glob("*.vue"))
        features["frontend"]["components"] = [c.stem for c in components]

        # Detect specific features
        all_files = list(src_dir.rglob("*.ts")) + list(src_dir.rglob("*.vue"))
        all_content = ""
        for f in all_files:
            try:
                all_content += f.read_text()
            except:
                pass

        features["frontend"]["has_mermaid"] = "mermaid" in all_content.lower()
        features["frontend"]["has_theme"] = "theme" in all_content.lower()
        features["frontend"]["has_mobile"] = "mobile" in all_content.lower()
        features["frontend"]["has_markdown"] = "markdown" in all_content.lower()
        features["frontend"]["has_shiki"] = "shiki" in all_content.lower()

    # Backend features
    backend_dir = Path("backend/peekview")
    if backend_dir.exists():
        api_files = list((backend_dir / "api").glob("*.py")) if (backend_dir / "api").exists() else []
        features["backend"]["api_modules"] = [f.stem for f in api_files]

        # Check for specific features
        cli_content = (backend_dir / "cli.py").read_text() if (backend_dir / "cli.py").exists() else ""
        features["cli"]["commands"] = re.findall(r'@cli\.command\(["\'](\w+)["\']\)', cli_content)

        # Database features
        models_content = (backend_dir / "models.py").read_text() if (backend_dir / "models.py").exists() else ""
        features["backend"]["has_fts"] = "fts" in models_content.lower()

    return features


def generate_feature_matrix(features):
    """Generate markdown feature matrix."""
    lines = [
        "# Feature Matrix",
        "",
        f"*Auto-generated on {datetime.now().strftime('%Y-%m-%d')}*",
        "",
        "## Frontend",
        "",
        "### Views",
    ]

    for view in features["frontend"].get("views", []):
        lines.append(f"- ✅ {view}")

    lines.extend(["", "### Components"])
    for comp in sorted(features["frontend"].get("components", [])[:10]):  # Limit to 10
        lines.append(f"- ✅ {comp}")

    lines.extend(["", "### Capabilities"])
    caps = [
        ("Mermaid Diagrams", features["frontend"].get("has_mermaid", False)),
        ("Theme Support", features["frontend"].get("has_theme", False)),
        ("Mobile UI", features["frontend"].get("has_mobile", False)),
        ("Markdown Rendering", features["frontend"].get("has_markdown", False)),
        ("Code Highlighting (Shiki)", features["frontend"].get("has_shiki", False)),
    ]
    for name, enabled in caps:
        status = "✅" if enabled else "❌"
        lines.append(f"- {status} {name}")

    lines.extend(["", "## Backend", ""])
    lines.append("### API Modules")
    for mod in features["backend"].get("api_modules", []):
        lines.append(f"- ✅ {mod}")

    lines.extend(["", "### Database Features"])
    lines.append(f"- {'✅' if features['backend'].get('has_fts') else '❌'} Full-Text Search (FTS5)")

    lines.extend(["", "## CLI Commands", ""])
    for cmd in features["cli"].get("commands", []):
        lines.append(f"- ✅ peekview {cmd}")

    lines.append("")
    return "\n".join(lines)


def main():
    print("=== Generating Feature Matrix ===\n")

    features = scan_features()

    # Save raw data
    features_json = Path("FEATURES.json")
    with open(features_json, "w") as f:
        json.dump(features, f, indent=2)
    print(f"Saved raw features to {features_json}")

    # Generate markdown
    matrix = generate_feature_matrix(features)
    matrix_file = Path("FEATURES.md")
    matrix_file.write_text(matrix)
    print(f"Generated {matrix_file}")

    print("\nFeatures detected:")
    print(f"  Frontend views: {len(features['frontend'].get('views', []))}")
    print(f"  Frontend components: {len(features['frontend'].get('components', []))}")
    print(f"  Backend API modules: {len(features['backend'].get('api_modules', []))}")
    print(f"  CLI commands: {len(features['cli'].get('commands', []))}")

    return 0


if __name__ == "__main__":
    exit(main())
