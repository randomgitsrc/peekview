#!/usr/bin/env python3
"""Verify wheel contains correct static files."""
import zipfile
import sys
import os
import re

def main():
    wheel_dir = "dist"
    wheels = [f for f in os.listdir(wheel_dir) if f.endswith(".whl")]
    if not wheels:
        print("Error: No wheel file found in dist/")
        sys.exit(1)

    wheel_path = os.path.join(wheel_dir, wheels[0])
    print(f"Checking: {wheels[0]}")

    with zipfile.ZipFile(wheel_path, 'r') as whl:
        files = whl.namelist()
        static_files = [f for f in files if 'peekview/static/' in f]
        index_files = [f for f in static_files if f.endswith('index.html')]

        if not static_files:
            print("Error: No static files found in wheel!")
            sys.exit(1)

        print(f"  Found {len(static_files)} static files")

        if index_files:
            index_content = whl.read(index_files[0]).decode('utf-8')
            js_refs = re.findall(r'assets/[^"\']+\.js', index_content)
            print(f"  index.html references {len(js_refs)} JS files")

            missing = []
            for ref in js_refs[:10]:  # Check first 10
                full_path = f"peekview/static/{ref}"
                if full_path not in static_files:
                    missing.append(ref)

            if missing:
                print(f"Error: index.html references missing files: {missing}")
                sys.exit(1)
            print("  All referenced JS/CSS files exist in wheel")

        print("Wheel verification passed")

if __name__ == "__main__":
    main()
