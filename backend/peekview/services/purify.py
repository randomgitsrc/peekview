"""Content purification for the raw endpoint.

Replaces embedded base64 images with compact placeholders so large data URIs
do not pollute agent context. The equivalent TS implementation lives in
packages/mcp-server/src/lib/purify.ts (DEBT0004: keep the regexes in sync).
"""

from __future__ import annotations

import re

_DATA_IMAGE_RE = re.compile(
    r"data:\s*image/[a-z0-9.+-]+;base64,[a-z0-9+/=]+",
    re.IGNORECASE,
)

_MD_IMAGE_RE = re.compile(
    r"!\[([^\]]*)\]\(\s*(data:\s*image/[^)\s]+;base64,[a-z0-9+/=]+)\s*\)",
    re.IGNORECASE,
)

_IMG_TAG_RE = re.compile(r"<img\b[^>]*>", re.IGNORECASE)


def _placeholder(alt: str, uri: str) -> str:
    kb = len(uri) * 3 / 4 / 1024
    kb_text = f"{kb:.0f}" if kb >= 10 else f"{kb:.2f}"
    return f"[image: {alt} ({kb_text} KB, base64)]"


def _replace_img_tag(tag: str) -> str:
    src = re.search(
        r'\bsrc\s*=\s*"?(data:\s*image/[^"\s>]+;base64,[a-z0-9+/=]+)"?',
        tag,
        re.IGNORECASE,
    )
    if not src:
        return tag
    alt = re.search(r'\balt\s*=\s*"([^"]*)"', tag, re.IGNORECASE)
    return _placeholder(alt.group(1) if alt else "", src.group(1))


def purify_content(content: str) -> str:
    """Replace base64 images in text with [image: alt (N KB, base64)] placeholders.

    Covers markdown ![alt](data:...) and <img src="data:..."> forms (including
    case-insensitive Data:IMAGE and whitespace variants). Plain text without a
    data:image URI is returned unchanged.
    """
    out = _MD_IMAGE_RE.sub(
        lambda m: _placeholder(m.group(1), m.group(2)),
        content,
    )
    out = _IMG_TAG_RE.sub(lambda m: _replace_img_tag(m.group(0)), out)
    return _DATA_IMAGE_RE.sub(lambda m: _placeholder("", m.group(0)), out)
