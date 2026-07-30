"""TDD tests for CJK search and tag filtering fix (T083).

These tests are written BEFORE implementation (TDD red light).
They must fail because:
- BDD-1~6: list_entries uses LIKE for tag filtering (json_each not implemented)
- BDD-7~17: peekview.text_utils module doesn't exist yet (import failure)
"""

import time

import pytest
from sqlalchemy import text
from sqlmodel import Session

from peekview.config import PeekConfig, PeekLimits, PeekServer, PeekStorage
from peekview.database import init_db, backfill_fts_content, search_entries
from peekview.models import Entry
from peekview.services.entry_service import EntryService
from peekview.storage import StorageManager


@pytest.fixture
def cjk_entry_service(tmp_path):
    """EntryService with init_db (FTS5 triggers active) and temp storage."""
    db_path = tmp_path / "test.db"
    data_dir = tmp_path / "data"
    data_dir.mkdir()
    engine = init_db(db_path)

    config = PeekConfig(
        storage=PeekStorage(data_dir=data_dir),
        limits=PeekLimits(
            max_file_size=1024 * 1024,
            max_entry_files=50,
            max_entry_size=10 * 1024 * 1024,
        ),
        server=PeekServer(base_url="http://localhost:8080"),
    )
    storage = StorageManager(config=config)
    return EntryService(engine=engine, storage=storage, config=config)


# ============================================================
# BDD-1: Chinese tag filter returns correct results
# ============================================================


class TestBDD1ChineseTagFilter:
    def test_bdd_1_chinese_tag_filter(self, cjk_entry_service):
        entry = cjk_entry_service.create_entry(
            summary="Test CJK tag",
            slug="cjk-tag-1",
            tags=["前端", "Vue"],
        )
        result = cjk_entry_service.list_entries(tags=["前端"])
        slugs = [item.slug for item in result.items]
        assert "cjk-tag-1" in slugs


# ============================================================
# BDD-2: Japanese tag filter returns correct results
# ============================================================


class TestBDD2JapaneseTagFilter:
    def test_bdd_2_japanese_tag_filter(self, cjk_entry_service):
        cjk_entry_service.create_entry(
            summary="Test Japanese tag",
            slug="jp-tag-1",
            tags=["テスト"],
        )
        result = cjk_entry_service.list_entries(tags=["テスト"])
        slugs = [item.slug for item in result.items]
        assert "jp-tag-1" in slugs


# ============================================================
# BDD-3: English tag filter zero regression
# ============================================================


class TestBDD3EnglishTagRegression:
    def test_bdd_3_english_tag_filter_regression(self, cjk_entry_service):
        from peekview.text_utils import tokenize_for_fts  # noqa: F401

        cjk_entry_service.create_entry(
            summary="Test English tag",
            slug="en-tag-1",
            tags=["python", "auth"],
        )
        result = cjk_entry_service.list_entries(tags=["python"])
        slugs = [item.slug for item in result.items]
        assert "en-tag-1" in slugs


# ============================================================
# BDD-4: Tag exact match, no substring false positive
# ============================================================


class TestBDD4TagExactMatch:
    def test_bdd_4_tag_exact_match_no_substring(self, cjk_entry_service):
        from peekview.text_utils import tokenize_for_fts  # noqa: F401

        cjk_entry_service.create_entry(
            summary="Python entry",
            slug="python-entry",
            tags=["python"],
        )
        cjk_entry_service.create_entry(
            summary="Pythonic entry",
            slug="pythonic-entry",
            tags=["pythonic"],
        )
        result = cjk_entry_service.list_entries(tags=["python"])
        slugs = [item.slug for item in result.items]
        assert "python-entry" in slugs
        assert "pythonic-entry" not in slugs


# ============================================================
# BDD-5: Multi-tag filter (AND semantics)
# ============================================================


class TestBDD5MultiTagFilter:
    def test_bdd_5_multi_tag_filter(self, cjk_entry_service):
        cjk_entry_service.create_entry(
            summary="Multi tag entry",
            slug="multi-tag-1",
            tags=["前端", "Vue", "组件库"],
        )
        cjk_entry_service.create_entry(
            summary="Only one tag",
            slug="single-tag-1",
            tags=["前端"],
        )
        result = cjk_entry_service.list_entries(tags=["前端", "Vue"])
        slugs = [item.slug for item in result.items]
        assert "multi-tag-1" in slugs
        assert "single-tag-1" not in slugs


# ============================================================
# BDD-6: Nonexistent tag returns empty results
# ============================================================


class TestBDD6NonexistentTag:
    def test_bdd_6_nonexistent_tag_empty(self, cjk_entry_service):
        from peekview.text_utils import tokenize_for_fts  # noqa: F401

        cjk_entry_service.create_entry(
            summary="Has tag",
            slug="has-tag-1",
            tags=["前端"],
        )
        result = cjk_entry_service.list_entries(tags=["不存在"])
        assert len(result.items) == 0


# ============================================================
# BDD-7: Chinese subword search hits
# ============================================================


class TestBDD7ChineseSubwordSearch:
    def test_bdd_7_chinese_subword_search(self, cjk_entry_service):
        from peekview.text_utils import tokenize_for_fts  # noqa: F401

        cjk_entry_service.create_entry(
            summary="前端组件库设计",
            slug="cjk-search-1",
            tags=["组件库"],
        )
        result = cjk_entry_service.list_entries(q="组件")
        slugs = [item.slug for item in result.items]
        assert "cjk-search-1" in slugs


# ============================================================
# BDD-8: Chinese whole word search hits
# ============================================================


class TestBDD8ChineseWholeWordSearch:
    def test_bdd_8_chinese_whole_word_search(self, cjk_entry_service):
        from peekview.text_utils import tokenize_for_fts  # noqa: F401

        cjk_entry_service.create_entry(
            summary="前端组件库",
            slug="cjk-search-2",
        )
        result = cjk_entry_service.list_entries(q="组件库")
        slugs = [item.slug for item in result.items]
        assert "cjk-search-2" in slugs


# ============================================================
# BDD-9: English search zero regression
# ============================================================


class TestBDD9EnglishSearchRegression:
    def test_bdd_9_english_search_regression(self, cjk_entry_service):
        from peekview.text_utils import tokenize_for_fts  # noqa: F401

        cjk_entry_service.create_entry(
            summary="FastAPI tutorial",
            slug="en-search-1",
        )
        result = cjk_entry_service.list_entries(q="FastAPI")
        slugs = [item.slug for item in result.items]
        assert "en-search-1" in slugs


# ============================================================
# BDD-10: Mixed CJK + ASCII search hits
# ============================================================


class TestBDD10MixedSearch:
    def test_bdd_10_mixed_cjk_ascii_search(self, cjk_entry_service):
        from peekview.text_utils import tokenize_for_fts  # noqa: F401

        cjk_entry_service.create_entry(
            summary="Mixed content",
            slug="mixed-1",
            tags=["前端", "Vue", "组件库"],
        )
        result = cjk_entry_service.list_entries(q="Vue")
        slugs = [item.slug for item in result.items]
        assert "mixed-1" in slugs


# ============================================================
# BDD-11: No-match Chinese search returns empty
# ============================================================


class TestBDD11NoMatchChineseSearch:
    def test_bdd_11_no_match_chinese_search(self, cjk_entry_service):
        from peekview.text_utils import tokenize_for_fts  # noqa: F401

        cjk_entry_service.create_entry(
            summary="前端组件库",
            slug="cjk-search-3",
        )
        result = cjk_entry_service.list_entries(q="数据库")
        assert len(result.items) == 0


# ============================================================
# BDD-12: Hyphenated tag subword search hits
# ============================================================


class TestBDD12HyphenTagSubwordSearch:
    def test_bdd_12_hyphen_tag_subword_search(self, cjk_entry_service):
        from peekview.text_utils import tokenize_for_fts  # noqa: F401

        cjk_entry_service.create_entry(
            summary="Google AI tool",
            slug="hyphen-1",
            tags=["google-gemini"],
        )
        result = cjk_entry_service.list_entries(q="gemini")
        slugs = [item.slug for item in result.items]
        assert "hyphen-1" in slugs


# ============================================================
# BDD-13: Hyphenated tag whole word search hits
# ============================================================


class TestBDD13HyphenTagWholeWordSearch:
    def test_bdd_13_hyphen_tag_whole_word_search(self, cjk_entry_service):
        from peekview.text_utils import tokenize_for_fts  # noqa: F401

        cjk_entry_service.create_entry(
            summary="Google AI tool",
            slug="hyphen-2",
            tags=["google-gemini"],
        )
        result = cjk_entry_service.list_entries(q="google")
        slugs = [item.slug for item in result.items]
        assert "hyphen-2" in slugs


# ============================================================
# BDD-14: Backfill rebuilds FTS for existing entries
# ============================================================


class TestBDD14BackfillRebuildsFTS:
    def test_bdd_14_backfill_rebuilds_fts_for_existing(self, tmp_path):
        from peekview.text_utils import tokenize_for_fts  # noqa: F401

        db_path = tmp_path / "test.db"
        data_dir = tmp_path / "data"
        data_dir.mkdir()
        engine = init_db(db_path)

        config = PeekConfig(
            storage=PeekStorage(data_dir=data_dir),
            limits=PeekLimits(
                max_file_size=1024 * 1024,
                max_entry_files=50,
                max_entry_size=10 * 1024 * 1024,
            ),
            server=PeekServer(base_url="http://localhost:8080"),
        )
        storage = StorageManager(config=config)

        with Session(engine) as session:
            entry = Entry(
                slug="backfill-test",
                summary="前端组件库设计",
                tags=["组件库"],
            )
            session.add(entry)
            session.commit()

            session.exec(text("DELETE FROM entries_fts"))
            session.exec(
                text(
                    "INSERT INTO entries_fts(rowid, summary, tags, content) "
                    "VALUES (:id, :summary, :tags, :content)"
                ).bindparams(
                    id=entry.id,
                    summary="前端组件库设计",
                    tags="组件库",
                    content="",
                )
            )
            session.commit()

        backfill_fts_content(engine, storage)

        with Session(engine) as session:
            ids = search_entries(session, "组件")
            assert entry.id in ids

        engine.dispose()


# ============================================================
# BDD-15: New entry FTS index correctly tokenized
# ============================================================


class TestBDD15NewEntryFTSTokenized:
    def test_bdd_15_new_entry_fts_tokenized(self, cjk_entry_service):
        from peekview.text_utils import tokenize_for_fts  # noqa: F401

        cjk_entry_service.create_entry(
            summary="前端组件",
            slug="new-fts-1",
            tags=["组件库"],
        )
        result = cjk_entry_service.list_entries(q="组件")
        slugs = [item.slug for item in result.items]
        assert "new-fts-1" in slugs


# ============================================================
# BDD-16: Existing tests all pass
# (Not in this file — verified by P5 gate: make test-quick)
# ============================================================


# ============================================================
# BDD-17: jieba preload doesn't block first request
# ============================================================


class TestBDD17JiebaPreload:
    def test_bdd_17_jieba_preload_no_first_request_delay(self):
        from peekview.text_utils import preload_jieba, tokenize_for_fts

        preload_jieba()

        start = time.time()
        result = tokenize_for_fts("前端组件库设计")
        elapsed = time.time() - start

        assert elapsed < 1.0, f"First tokenize_for_fts took {elapsed:.3f}s, expected <1s"
        assert "组件" in result
