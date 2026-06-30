"""Tests for language detection."""


from peekview.language import (
    PLAIN_TEXT_LANGS,
    detect_language,
    get_language_list,
    guess_language_from_content,
    is_binary_content,
)


class TestDetectLanguage:
    """Test language detection from filenames."""

    def test_python_file(self):
        """Detect Python files."""
        assert detect_language("script.py") == "python"
        assert detect_language("main.py") == "python"

    def test_javascript_file(self):
        """Detect JavaScript files."""
        assert detect_language("script.js") == "javascript"
        assert detect_language("main.mjs") == "javascript"

    def test_typescript_file(self):
        """Detect TypeScript files."""
        assert detect_language("script.ts") == "typescript"
        assert detect_language("component.tsx") == "tsx"

    def test_html_file(self):
        """Detect HTML files."""
        assert detect_language("index.html") == "html"
        assert detect_language("page.htm") == "html"

    def test_markdown_file(self):
        """Detect Markdown files."""
        assert detect_language("README.md") == "markdown"
        assert detect_language("notes.mdx") == "markdown"

    def test_json_file(self):
        """Detect JSON files."""
        assert detect_language("config.json") == "json"

    def test_yaml_file(self):
        """Detect YAML files."""
        assert detect_language("config.yaml") == "yaml"
        assert detect_language("config.yml") == "yaml"

    def test_dockerfile(self):
        """Detect Dockerfile."""
        assert detect_language("Dockerfile") == "dockerfile"

    def test_makefile(self):
        """Detect Makefile."""
        assert detect_language("Makefile") == "makefile"
        assert detect_language("makefile") == "makefile"

    def test_gitignore(self):
        """Detect .gitignore."""
        assert detect_language(".gitignore") == "ignore"

    def test_cargo_toml(self):
        """Detect Cargo.toml."""
        assert detect_language("Cargo.toml") == "toml"

    def test_pyproject_toml(self):
        """Detect pyproject.toml."""
        assert detect_language("pyproject.toml") == "toml"

    def test_go_mod(self):
        """Detect go.mod."""
        assert detect_language("go.mod") == "go"

    def test_vite_config(self):
        """Detect vite config files."""
        assert detect_language("vite.config.ts") == "typescript"
        assert detect_language("vite.config.js") == "javascript"

    def test_case_insensitive_extension(self):
        """Extensions are case insensitive."""
        assert detect_language("script.PY") == "python"
        assert detect_language("script.JS") == "javascript"

    def test_unknown_extension(self):
        """Unknown extensions return None."""
        assert detect_language("file.unknown") is None
        assert detect_language("file.xyz") is None

    def test_empty_filename(self):
        """Empty filename returns None."""
        assert detect_language("") is None

    def test_no_extension(self):
        """File without extension."""
        assert detect_language("Makefile") == "makefile"
        assert detect_language("README") == "text"


class TestIsBinaryContent:
    """Test binary content detection."""

    def test_text_content(self):
        """Plain text is not binary."""
        assert not is_binary_content(b"Hello, World!")
        assert not is_binary_content(b"print('hello')\n")

    def test_utf8_content(self):
        """UTF-8 text is not binary."""
        assert not is_binary_content("Hello 世界".encode())

    def test_empty_content(self):
        """Empty content is not binary."""
        assert not is_binary_content(b"")

    def test_binary_with_null(self):
        """Content with null bytes is binary."""
        assert is_binary_content(b"\x00\x01\x02\x03")
        assert is_binary_content(b"Hello\x00World")

    def test_binary_bytes(self):
        """Binary data is detected."""
        assert is_binary_content(bytes(range(256)))


class TestGetLanguageList:
    """Test language list retrieval."""

    def test_returns_list(self):
        """Returns a list."""
        langs = get_language_list()
        assert isinstance(langs, list)

    def test_contains_common_languages(self):
        """Contains common languages."""
        langs = get_language_list()
        assert "python" in langs
        assert "javascript" in langs
        assert "typescript" in langs

    def test_sorted(self):
        """List is sorted."""
        langs = get_language_list()
        assert langs == sorted(langs)

    def test_no_duplicates(self):
        """No duplicate entries."""
        langs = get_language_list()
        assert len(langs) == len(set(langs))


class TestGuessLanguageFromContent:
    """Test language guessing from content."""

    def test_python_shebang(self):
        """Detect Python from shebang."""
        content = "#!/usr/bin/env python3\nprint('hello')"
        assert guess_language_from_content(content) == "python"

    def test_bash_shebang(self):
        """Detect Bash from shebang."""
        content = "#!/bin/bash\necho hello"
        assert guess_language_from_content(content) == "bash"

    def test_node_shebang(self):
        """Detect Node.js from shebang."""
        content = "#!/usr/bin/env node\nconsole.log('hello')"
        assert guess_language_from_content(content) == "javascript"

    def test_php_content(self):
        """Detect PHP from tags."""
        content = "<?php\necho 'hello';"
        assert guess_language_from_content(content) == "php"

    def test_html_content(self):
        """Detect HTML from doctype."""
        content = "<!DOCTYPE html>\n<html>"
        assert guess_language_from_content(content) == "html"

    def test_xml_content(self):
        """Detect XML from declaration."""
        content = '<?xml version="1.0"?>\n<root>'
        assert guess_language_from_content(content) == "xml"

    def test_json_content(self):
        """Detect JSON from content."""
        content = '{"key": "value"}'
        assert guess_language_from_content(content) == "json"

    def test_json_array(self):
        """Detect JSON array."""
        content = '[1, 2, 3]'
        assert guess_language_from_content(content) == "json"

    def test_no_guess(self):
        """Return None if cannot guess."""
        content = "some random text"
        assert guess_language_from_content(content) is None

    def test_empty_content(self):
        """Empty content returns None."""
        assert guess_language_from_content("") is None


class TestPlainTextLanguages:
    """Test plain text language set."""

    def test_contains_text(self):
        """Contains 'text'."""
        assert "text" in PLAIN_TEXT_LANGS

    def test_contains_log(self):
        """Contains 'log'."""
        assert "log" in PLAIN_TEXT_LANGS

    def test_contains_csv(self):
        """Contains 'csv'."""
        assert "csv" in PLAIN_TEXT_LANGS

    def test_contains_all_no_grammar_langs(self):
        """All languages without Shiki grammar are in PLAIN_TEXT_LANGS."""
        no_grammar_langs = {
            "autohotkey", "editorconfig", "git_attributes", "git_config",
            "ignore", "janet", "odin", "pip-requirements", "sed", "vba",
            "vbscript",
        }
        for lang in no_grammar_langs:
            assert lang in PLAIN_TEXT_LANGS, f"Missing no-grammar language: {lang}"

    def test_plain_text_langs_count(self):
        """PLAIN_TEXT_LANGS has expected size (5 original + 9 new = 14)."""
        assert len(PLAIN_TEXT_LANGS) == 14


class TestShikiLanguageIdAlignment:
    """Test that backend language IDs align with Shiki BundledLanguage IDs."""

    def test_wl_maps_to_wolfram(self):
        assert detect_language("script.wl") == "wolfram"

    def test_wls_maps_to_wolfram(self):
        assert detect_language("script.wls") == "wolfram"

    def test_nb_maps_to_wolfram(self):
        assert detect_language("notebook.nb") == "wolfram"

    def test_reg_maps_to_reg(self):
        assert detect_language("fix.reg") == "reg"

    def test_no_mathematica_in_extension_map(self):
        from peekview.language import EXTENSION_MAP
        assert "mathematica" not in EXTENSION_MAP.values()

    def test_no_registry_in_extension_map(self):
        from peekview.language import EXTENSION_MAP
        assert "registry" not in EXTENSION_MAP.values()

    def test_no_mathematica_in_filename_map(self):
        from peekview.language import FILENAME_MAP
        assert "mathematica" not in FILENAME_MAP.values()

    def test_no_registry_in_filename_map(self):
        from peekview.language import FILENAME_MAP
        assert "registry" not in FILENAME_MAP.values()

    def test_wolfram_in_language_list(self):
        assert "wolfram" in get_language_list()

    def test_reg_in_language_list(self):
        assert "reg" in get_language_list()

    def test_mathematica_not_in_language_list(self):
        assert "mathematica" not in get_language_list()

    def test_registry_not_in_language_list(self):
        assert "registry" not in get_language_list()


class TestExtensionMapCompleteness:
    """Test that extension map is comprehensive."""

    def test_common_extensions_present(self):
        """Common extensions are present."""
        from peekview.language import EXTENSION_MAP

        common = [".py", ".js", ".ts", ".html", ".css", ".json", ".md", ".sh"]
        for ext in common:
            assert ext in EXTENSION_MAP, f"Missing extension: {ext}"

    def test_no_empty_values(self):
        """No extension maps to empty string."""
        from peekview.language import EXTENSION_MAP

        for ext, lang in EXTENSION_MAP.items():
            assert lang, f"Empty language for extension: {ext}"
