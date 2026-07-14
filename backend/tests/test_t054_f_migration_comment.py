"""T054-F: Migration comment documentation.

BDD: F1
Tests should FAIL (red) until P4 implementation.
"""
from __future__ import annotations

import inspect

import pytest

from peekview.database import _run_migrations


class TestBDDF1MigrationCommentKeywords:
    """BDD-F1: Given _run_migrations() function top,
    When checking the first 10 lines of comments,
    Then keywords 'create_all' and 'ALTER TABLE' are present.
    """

    def test_docstring_contains_create_all(self):
        doc = _run_migrations.__doc__
        assert doc is not None, "_run_migrations should have a docstring"
        assert "create_all" in doc, (
            "_run_migrations docstring should mention 'create_all' "
            "to explain that create_all() handles CREATE TABLE"
        )

    def test_docstring_contains_alter_table(self):
        doc = _run_migrations.__doc__
        assert doc is not None, "_run_migrations should have a docstring"
        assert "ALTER TABLE" in doc, (
            "_run_migrations docstring should mention 'ALTER TABLE' "
            "to explain that this function only handles ALTER TABLE migrations"
        )
