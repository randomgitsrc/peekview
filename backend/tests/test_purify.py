"""TDD tests for backend purify_content (peekview.services.purify).

P3 red-light: peekview.services.purify does not exist yet (P4 adds it).
Shared samples are the cross-端 contract anchor (DEBT0004 closure_criteria):
the same sample strings appear verbatim in packages/mcp-server/tests/purify.test.ts.
"""

from __future__ import annotations

import re

from peekview.services.purify import purify_content

# ── 净化共用样例（与 MCP purify.test.ts 逐字一致，DEBT0004 契约锚点）──
MD_WITH_ALT = "![alt text](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAE=)"
IMG_NO_ALT = '<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAE=">'
IMG_WITH_ALT = '<img alt="icon" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAE=">'
UPPERCASE = "![logo](Data:IMAGE/jpeg;base64,QUJDREVGRw==)"
WS_VARIANT = "data: image/png;base64,QUJDREVGRw=="
PLAIN_TEXT = "plain text with no data:image inside"

PLACEHOLDER_RE = re.compile(r"\[image:\s*[^\]]*\(\d+(\.\d+)? KB, base64\)\]")


class TestPurifyContent:
    async def test_bdd_12_markdown_base64_replaced_keeps_alt(self):
        result = purify_content(MD_WITH_ALT)

        assert re.search(r"\[image:\s*alt text\s*\(\d+(\.\d+)? KB, base64\)\]", result)
        assert "iVBORw0KGgoAAAANSUhEUgAAAAE=" not in result

    async def test_bdd_12_html_img_no_alt_replaced(self):
        result = purify_content(IMG_NO_ALT)

        assert PLACEHOLDER_RE.search(result)
        assert "iVBORw0KGgoAAAANSUhEUgAAAAE=" not in result

    async def test_bdd_12_html_img_with_alt_keeps_alt(self):
        result = purify_content(IMG_WITH_ALT)

        assert re.search(r"\[image:\s*icon\s*\(\d+(\.\d+)? KB, base64\)\]", result)
        assert "iVBORw0KGgoAAAANSUhEUgAAAAE=" not in result

    async def test_bdd_12_uppercase_data_uri_replaced(self):
        result = purify_content(UPPERCASE)

        assert re.search(r"\[image:\s*logo\s*\(\d+(\.\d+)? KB, base64\)\]", result)
        assert "QUJDREVGRw==" not in result

    async def test_bdd_12_whitespace_data_uri_replaced(self):
        result = purify_content(WS_VARIANT)

        assert PLACEHOLDER_RE.search(result)
        assert "QUJDREVGRw==" not in result

    async def test_bdd_14_plain_text_unchanged(self):
        result = purify_content(PLAIN_TEXT)

        assert result == PLAIN_TEXT
