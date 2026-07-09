import asyncio
import logging
from unittest.mock import MagicMock, patch

import pytest

from peekview.config import PeekCleanup, PeekConfig
from peekview.main import create_app, lifespan
from peekview.models import AdminCleanupResponse


@pytest.fixture
def mock_cleanup_response():
    return AdminCleanupResponse(
        archived_count=2,
        archived_slugs=["a", "b"],
        deleted_count=1,
        deleted_slugs=["c"],
        freed_mb=3.14,
    )


def _make_config(tmp_path, interval_seconds=3600, check_on_start=True):
    cleanup = PeekCleanup(
        interval_seconds=interval_seconds,
        check_on_start=check_on_start,
    )
    return PeekConfig(
        data_dir=tmp_path / "data",
        db_path=tmp_path / "test.db",
        host="127.0.0.1",
        port=8080,
        log_level="DEBUG",
        cleanup=cleanup,
    )


_original_sleep = asyncio.sleep


@pytest.mark.asyncio
async def test_interval_gt_zero_creates_task(tmp_path, mock_cleanup_response):
    config = _make_config(tmp_path, interval_seconds=3600, check_on_start=False)
    with patch(
        "peekview.services.admin_service.AdminService.cleanup_expired",
        return_value=mock_cleanup_response,
    ), patch("asyncio.sleep", side_effect=asyncio.CancelledError):
        app = create_app(config=config)
        async with lifespan(app):
            pass


@pytest.mark.asyncio
async def test_interval_gt_zero_task_calls_cleanup(tmp_path, mock_cleanup_response):
    config = _make_config(tmp_path, interval_seconds=60, check_on_start=False)
    mock_cleanup = MagicMock(return_value=mock_cleanup_response)
    sleep_count = 0

    async def fake_sleep(seconds):
        nonlocal sleep_count
        sleep_count += 1
        if sleep_count >= 2:
            raise asyncio.CancelledError()
        await _original_sleep(0)

    with patch(
        "peekview.services.admin_service.AdminService.cleanup_expired",
        mock_cleanup,
    ), patch("asyncio.sleep", side_effect=fake_sleep):
        app = create_app(config=config)
        async with lifespan(app):
            await _original_sleep(0.2)

    assert mock_cleanup.call_count >= 1


@pytest.mark.asyncio
async def test_check_on_start_true_runs_immediately(tmp_path, mock_cleanup_response):
    config = _make_config(tmp_path, interval_seconds=3600, check_on_start=True)
    mock_cleanup = MagicMock(return_value=mock_cleanup_response)

    with patch(
        "peekview.services.admin_service.AdminService.cleanup_expired",
        mock_cleanup,
    ), patch("asyncio.sleep", side_effect=asyncio.CancelledError):
        app = create_app(config=config)
        async with lifespan(app):
            await _original_sleep(0.1)

    assert mock_cleanup.call_count >= 1


@pytest.mark.asyncio
async def test_check_on_start_false_no_immediate_call(tmp_path, mock_cleanup_response):
    config = _make_config(tmp_path, interval_seconds=3600, check_on_start=False)
    mock_cleanup = MagicMock(return_value=mock_cleanup_response)

    with patch(
        "peekview.services.admin_service.AdminService.cleanup_expired",
        mock_cleanup,
    ), patch("asyncio.sleep", side_effect=asyncio.CancelledError):
        app = create_app(config=config)
        async with lifespan(app):
            await _original_sleep(0.1)

    assert mock_cleanup.call_count == 0


@pytest.mark.asyncio
async def test_interval_zero_no_task(tmp_path, caplog):
    config = _make_config(tmp_path, interval_seconds=0, check_on_start=True)
    app = create_app(config=config)

    with caplog.at_level(logging.INFO):
        async with lifespan(app):
            pass

    assert "Cleanup background task disabled (interval=0)" in caplog.text


@pytest.mark.asyncio
async def test_interval_zero_disabled_log(tmp_path, caplog):
    config = _make_config(tmp_path, interval_seconds=0)
    app = create_app(config=config)

    with caplog.at_level(logging.INFO):
        async with lifespan(app):
            pass

    assert "Cleanup background task disabled (interval=0)" in caplog.text


@pytest.mark.asyncio
async def test_shutdown_cancels_task(tmp_path, mock_cleanup_response, caplog):
    config = _make_config(tmp_path, interval_seconds=3600, check_on_start=False)
    mock_cleanup = MagicMock(return_value=mock_cleanup_response)

    with patch(
        "peekview.services.admin_service.AdminService.cleanup_expired",
        mock_cleanup,
    ), patch("asyncio.sleep", side_effect=asyncio.CancelledError):
        app = create_app(config=config)

        with caplog.at_level(logging.INFO):
            async with lifespan(app):
                pass

    assert "Cleanup background task cancelled" in caplog.text


@pytest.mark.asyncio
async def test_shutdown_cancel_log(tmp_path, mock_cleanup_response, caplog):
    config = _make_config(tmp_path, interval_seconds=3600, check_on_start=False)
    mock_cleanup = MagicMock(return_value=mock_cleanup_response)

    with patch(
        "peekview.services.admin_service.AdminService.cleanup_expired",
        mock_cleanup,
    ), patch("asyncio.sleep", side_effect=asyncio.CancelledError):
        app = create_app(config=config)

        with caplog.at_level(logging.INFO):
            async with lifespan(app):
                pass

    assert "Cleanup background task cancelled" in caplog.text


@pytest.mark.asyncio
async def test_cleanup_logs_archived_deleted_freed(tmp_path, mock_cleanup_response, caplog):
    config = _make_config(tmp_path, interval_seconds=3600, check_on_start=True)
    mock_cleanup = MagicMock(return_value=mock_cleanup_response)

    with patch(
        "peekview.services.admin_service.AdminService.cleanup_expired",
        mock_cleanup,
    ), patch("asyncio.sleep", side_effect=asyncio.CancelledError):
        app = create_app(config=config)

        with caplog.at_level(logging.INFO):
            async with lifespan(app):
                await _original_sleep(0.1)

    assert "archived=2" in caplog.text
    assert "deleted=1" in caplog.text
    assert "freed=3.14MB" in caplog.text


@pytest.mark.asyncio
async def test_cleanup_exception_continues_loop(tmp_path, caplog):
    config = _make_config(tmp_path, interval_seconds=60, check_on_start=True)
    call_count = 0

    def cleanup_side_effect():
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            raise RuntimeError("cleanup failed")
        return AdminCleanupResponse(archived_count=1, deleted_count=0, freed_mb=0.0)

    sleep_count = 0

    async def fake_sleep(seconds):
        nonlocal sleep_count
        sleep_count += 1
        if sleep_count >= 2:
            raise asyncio.CancelledError()
        await _original_sleep(0)

    with patch(
        "peekview.services.admin_service.AdminService.cleanup_expired",
        side_effect=cleanup_side_effect,
    ), patch("asyncio.sleep", side_effect=fake_sleep):
        app = create_app(config=config)

        with caplog.at_level(logging.INFO):
            async with lifespan(app):
                await _original_sleep(0.2)

    assert call_count >= 2
    assert "Cleanup: initial check failed" in caplog.text


@pytest.mark.asyncio
async def test_check_on_start_initial_log(tmp_path, mock_cleanup_response, caplog):
    config = _make_config(tmp_path, interval_seconds=3600, check_on_start=True)
    mock_cleanup = MagicMock(return_value=mock_cleanup_response)

    with patch(
        "peekview.services.admin_service.AdminService.cleanup_expired",
        mock_cleanup,
    ), patch("asyncio.sleep", side_effect=asyncio.CancelledError):
        app = create_app(config=config)

        with caplog.at_level(logging.INFO):
            async with lifespan(app):
                await _original_sleep(0.1)

    assert "Cleanup: running initial check (check_on_start=True)" in caplog.text
