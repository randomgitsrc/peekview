"""Text utilities for FTS5 tokenization using jieba.

Provides jieba-based word segmentation for Chinese text and hyphen-to-space
replacement for compound tags, ensuring subword search works correctly.
"""

from __future__ import annotations

import logging

import jieba

logger = logging.getLogger(__name__)

_jieba_loaded = False


def preload_jieba() -> None:
    """Preload jieba dictionary to avoid first-request latency.

    Idempotent: safe to call multiple times.
    """
    global _jieba_loaded
    if _jieba_loaded:
        return
    jieba.initialize()
    _jieba_loaded = True
    logger.info("jieba dictionary preloaded")


def tokenize_for_fts(text: str | None) -> str:
    """Tokenize text for FTS5 index writing.

    Uses jieba cut (precise mode) + hyphen-to-space replacement.
    Returns space-joined tokens, empty string for None/empty input.
    """
    if not text:
        return ""
    tokens = jieba.cut(text)
    result = []
    for token in tokens:
        cleaned = token.replace("-", " ").strip()
        if cleaned:
            result.append(cleaned)
    return " ".join(result)


def tokenize_query(query: str) -> str:
    """Tokenize search query for FTS5 MATCH.

    Same logic as tokenize_for_fts but semantically separate for query path.
    Returns space-joined tokens, empty string for None/empty/whitespace input.
    """
    if not query or not query.strip():
        return ""
    tokens = jieba.cut(query.strip())
    result = []
    for token in tokens:
        cleaned = token.replace("-", " ").strip()
        if cleaned:
            result.append(cleaned)
    return " ".join(result)
