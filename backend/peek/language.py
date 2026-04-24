"""Language detection for file types.

Maps file extensions and special filenames to Shiki-compatible language identifiers.
"""

from pathlib import Path

# Extension → language mapping
EXTENSION_MAP: dict[str, str] = {
    ".py": "python",
    ".js": "javascript",
    ".mjs": "javascript",
    ".ts": "typescript",
    ".tsx": "tsx",
    ".java": "java",
    ".kt": "kotlin",
    ".kts": "kotlin",
    ".cpp": "cpp",
    ".cc": "cpp",
    ".cxx": "cpp",
    ".h": "c",
    ".hpp": "cpp",
    ".c": "c",
    ".cs": "csharp",
    ".go": "go",
    ".rs": "rust",
    ".rb": "ruby",
    ".php": "php",
    ".swift": "swift",
    ".scala": "scala",
    ".r": "r",
    ".rmd": "markdown",
    ".html": "html",
    ".htm": "html",
    ".xhtml": "html",
    ".css": "css",
    ".scss": "scss",
    ".sass": "sass",
    ".less": "less",
    ".styl": "stylus",
    ".xml": "xml",
    ".svg": "xml",
    ".yaml": "yaml",
    ".yml": "yaml",
    ".json": "json",
    ".toml": "toml",
    ".ini": "ini",
    ".cfg": "ini",
    ".conf": "ini",
    ".md": "markdown",
    ".mdx": "markdown",
    ".rst": "rst",
    ".sh": "bash",
    ".bash": "bash",
    ".zsh": "zsh",
    ".fish": "fish",
    ".ps1": "powershell",
    ".psm1": "powershell",
    ".bat": "batch",
    ".cmd": "batch",
    ".sql": "sql",
    ".dockerfile": "dockerfile",
    ".dockerignore": "ignore",
    ".makefile": "makefile",
    ".mk": "makefile",
    ".txt": "text",
    ".log": "log",
    ".csv": "csv",
    ".tsv": "csv",
    ".graphql": "graphql",
    ".gql": "graphql",
    ".graphqls": "graphql",
    ".vue": "vue",
    ".svelte": "svelte",
    ".astro": "astro",
    ".lua": "lua",
    ".vim": "viml",
    ".elm": "elm",
    ".clojure": "clojure",
    ".clj": "clojure",
    ".cljs": "clojure",
    ".cljc": "clojure",
    ".dart": "dart",
    ".groovy": "groovy",
    ".gradle": "groovy",
    ".kt": "kotlin",
    ".kts": "kotlin",
    ".m": "objective-c",
    ".mm": "objective-cpp",
    ".plist": "xml",
    ".nim": "nim",
    ".v": "v",
    ".zig": "zig",
    ".ex": "elixir",
    ".exs": "elixir",
    ".erl": "erlang",
    ".hrl": "erlang",
    ".ml": "ocaml",
    ".mli": "ocaml",
    ".fs": "fsharp",
    ".fsx": "fsharp",
    ".fsi": "fsharp",
    ".purs": "purescript",
    ".elm": "elm",
    ".hx": "haxe",
    ".hxml": "haxe",
    ".pas": "pascal",
    ".pp": "pascal",
    ".dpr": "pascal",
    ".cr": "crystal",
    ".nim": "nim",
    ".odin": "odin",
    ".janet": "janet",
    ".lisp": "lisp",
    ".lsp": "lisp",
    ".scm": "scheme",
    ".ss": "scheme",
    ".rkt": "racket",
    ".jl": "julia",
    ".matlab": "matlab",
    ".m": "matlab",  # Note: conflicts with Objective-C, ambiguous
    ".nb": "mathematica",
    ".wl": "mathematica",
    ".wls": "mathematica",
    ".prolog": "prolog",
    ".pl": "prolog",  # Note: conflicts with Perl
    ".perl": "perl",
    ".pm": "perl",
    ".t": "perl",
    ".awk": "awk",
    ".sed": "sed",
    ".diff": "diff",
    ".patch": "diff",
    ".reg": "registry",
    ".vbs": "vbscript",
    ".vba": "vba",
    ".ahk": "autohotkey",
}

# Special filenames → language mapping
FILENAME_MAP: dict[str, str] = {
    "Makefile": "makefile",
    "makefile": "makefile",
    "GNUmakefile": "makefile",
    "Dockerfile": "dockerfile",
    "Dockerfile.*": "dockerfile",
    "docker-compose.yml": "yaml",
    "docker-compose.yaml": "yaml",
    ".gitignore": "ignore",
    ".dockerignore": "ignore",
    ".npmignore": "ignore",
    ".prettierignore": "ignore",
    ".eslintignore": "ignore",
    ".gitattributes": "git_attributes",
    ".gitmodules": "git_config",
    ".editorconfig": "editorconfig",
    ".env": "dotenv",
    ".env.*": "dotenv",
    "CMakeLists.txt": "cmake",
    "requirements.txt": "pip-requirements",
    "package.json": "json",
    "tsconfig.json": "jsonc",
    "jsconfig.json": "jsonc",
    ".babelrc": "json",
    ".babelrc.json": "json",
    ".eslintrc": "json",
    ".eslintrc.json": "json",
    ".prettierrc": "json",
    ".prettierrc.json": "json",
    "Vagrantfile": "ruby",
    "Rakefile": "ruby",
    "Gemfile": "ruby",
    "Capfile": "ruby",
    "Guardfile": "ruby",
    "Podfile": "ruby",
    "Berksfile": "ruby",
    "Thorfile": "ruby",
    "config.ru": "ruby",
    "composer.json": "json",
    "composer.lock": "json",
    "pyproject.toml": "toml",
    "setup.py": "python",
    "setup.cfg": "ini",
    "tox.ini": "ini",
    ".flake8": "ini",
    ".pylintrc": "ini",
    "Pipfile": "toml",
    "Pipfile.lock": "json",
    "poetry.lock": "toml",
    "Cargo.toml": "toml",
    "Cargo.lock": "toml",
    "go.mod": "go",
    "go.sum": "go",
    ".golangci.yml": "yaml",
    ".golangci.yaml": "yaml",
    "package-lock.json": "json",
    "yarn.lock": "yaml",
    "pnpm-lock.yaml": "yaml",
    "deno.lock": "json",
    "vite.config.ts": "typescript",
    "vite.config.js": "javascript",
    "vitest.config.ts": "typescript",
    "vitest.config.js": "javascript",
    "jest.config.js": "javascript",
    "jest.config.ts": "typescript",
    "webpack.config.js": "javascript",
    "webpack.config.ts": "typescript",
    "rollup.config.js": "javascript",
    "rollup.config.ts": "typescript",
    "esbuild.config.js": "javascript",
    "esbuild.config.ts": "typescript",
    "tailwind.config.js": "javascript",
    "tailwind.config.ts": "typescript",
    "postcss.config.js": "javascript",
    ".babelrc": "json",
    "tslint.json": "json",
    ".eslintrc.js": "javascript",
    ".eslintrc.cjs": "javascript",
    ".eslintrc.yaml": "yaml",
    ".eslintrc.yml": "yaml",
    ".prettierrc.js": "javascript",
    ".prettierrc.cjs": "javascript",
    ".prettierrc.yaml": "yaml",
    ".prettierrc.yml": "yaml",
    ".prettierrc.toml": "toml",
    "tailwind.config.cjs": "javascript",
    "tailwind.config.mjs": "javascript",
    "astro.config.mjs": "javascript",
    "astro.config.ts": "typescript",
    "svelte.config.js": "javascript",
    "svelte.config.ts": "typescript",
    "vue.config.js": "javascript",
    "vue.config.ts": "typescript",
    "nuxt.config.ts": "typescript",
    "nuxt.config.js": "javascript",
    "next.config.js": "javascript",
    "next.config.ts": "typescript",
    "gatsby-config.js": "javascript",
    "gatsby-config.ts": "typescript",
    "remix.config.js": "javascript",
    ".htaccess": "apache",
    "nginx.conf": "nginx",
    "robots.txt": "text",
    " humans.txt": "text",
    "LICENSE": "text",
    "LICENSE.txt": "text",
    "LICENSE.md": "markdown",
    "CHANGELOG": "text",
    "CHANGELOG.md": "markdown",
    "CHANGELOG.rst": "rst",
    "CONTRIBUTING": "text",
    "CONTRIBUTING.md": "markdown",
    "README": "text",
    "README.txt": "text",
    "README.md": "markdown",
    "README.rst": "rst",
}

# Languages that don't need highlighting (plain text)
PLAIN_TEXT_LANGS = {"text", "log", "csv", "ignore", "git_attributes"}

# Binary file detection helpers
TEXT_CHARS = bytes(range(32, 127)) + b"\n\r\t\f\b"


def detect_language(filename: str) -> str | None:
    """Detect the programming language from a filename.

    Args:
        filename: The filename to analyze

    Returns:
        Shiki language identifier, or None if not recognized
    """
    if not filename:
        return None

    # Check special filenames first
    if filename in FILENAME_MAP:
        return FILENAME_MAP[filename]

    # Check patterns like Dockerfile.*, .env.*
    for pattern, lang in FILENAME_MAP.items():
        if "*" in pattern:
            prefix = pattern.replace(".*", "")
            if filename.startswith(prefix) or filename.startswith("." + prefix[1:]):
                return lang

    # Check extension
    ext = Path(filename).suffix.lower()
    if ext in EXTENSION_MAP:
        return EXTENSION_MAP[ext]

    # Handle special cases
    if filename == "Cargo.toml":
        return "toml"
    if filename == "Cargo.lock":
        return "toml"

    return None


def is_binary_content(content: bytes) -> bool:
    """Detect if file content is binary.

    Uses a simple heuristic: if the content contains null bytes or
    a significant portion of non-text bytes, it's likely binary.

    Args:
        content: Raw file content as bytes

    Returns:
        True if content appears to be binary
    """
    if not content:
        return False

    # Check for null bytes (common in binary files)
    if b"\x00" in content:
        return True

    # Check if content is valid UTF-8
    try:
        content.decode("utf-8")
        return False
    except UnicodeDecodeError:
        # Not valid UTF-8, likely binary
        return True


def get_language_list() -> list[str]:
    """Get a sorted list of all supported languages.

    Returns:
        Sorted list of unique language identifiers
    """
    langs = set(EXTENSION_MAP.values())
    langs.update(FILENAME_MAP.values())
    return sorted(langs)


def guess_language_from_content(content: str) -> str | None:
    """Attempt to guess language from file content.

    This is a simple heuristic that looks at common patterns.
    For production use, consider a more sophisticated approach.

    Args:
        content: File content as string

    Returns:
        Guessed language or None
    """
    if not content:
        return None

    lines = content.strip().split("\n", 5)  # Check first 5 lines

    # Python shebang or encoding
    if lines[0].startswith("#!/usr/bin/env python"):
        return "python"
    if lines[0].startswith("#!/usr/bin/python"):
        return "python"
    if "coding: utf-8" in lines[0]:
        return "python"

    # Bash/sh shebang
    if lines[0].startswith("#!/bin/bash"):
        return "bash"
    if lines[0].startswith("#!/bin/sh"):
        return "bash"

    # Node.js shebang
    if lines[0].startswith("#!/usr/bin/env node"):
        return "javascript"

    # Ruby shebang
    if lines[0].startswith("#!/usr/bin/env ruby"):
        return "ruby"

    # Perl shebang
    if lines[0].startswith("#!/usr/bin/perl"):
        return "perl"

    # PHP
    if "<?php" in lines[0] or "<?=" in lines[0]:
        return "php"

    # HTML
    if "<!doctype html>" in lines[0].lower() or "<html" in lines[0].lower():
        return "html"

    # XML
    if lines[0].startswith("<?xml"):
        return "xml"

    # JSON
    if content.strip().startswith("{") or content.strip().startswith("["):
        try:
            import json

            json.loads(content)
            return "json"
        except (json.JSONDecodeError, ValueError):
            pass

    return None
