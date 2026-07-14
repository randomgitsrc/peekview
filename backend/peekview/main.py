"""FastAPI application factory and main entry point."""

import asyncio
import logging
import os
import shutil
import time
from contextlib import asynccontextmanager, suppress
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded
from sqlalchemy import text

from peekview import __version__
from peekview.api.rate_limit import limiter
from peekview.config import PeekConfig
from peekview.database import init_db
from peekview.exceptions import PeekError

logger = logging.getLogger(__name__)

FRONTEND_ROUTES = frozenset({"", "explore", "settings/apikeys", "login"})


def _prefers_json(accept_header: str | None) -> bool:
    if not accept_header:
        return False
    html_acceptable = False
    json_acceptable = False
    for item in accept_header.split(","):
        item = item.strip()
        if not item:
            continue
        media = item.split(";")[0].strip()
        q = 1.0
        for param in item.split(";")[1:]:
            param = param.strip()
            if param.startswith("q="):
                try:
                    q = float(param[2:])
                except ValueError:
                    q = 1.0
        if media in ("text/html", "application/xhtml+xml") and q > 0:
            html_acceptable = True
        elif media == "application/json" and q > 0:
            json_acceptable = True
    return json_acceptable and not html_acceptable


def _is_frontend_route(path: str) -> bool:
    if path in FRONTEND_ROUTES:
        return True
    return path.startswith("users/")


def _slug_exists(request: Request, slug: str) -> bool:
    from sqlmodel import Session, select

    from peekview.models import Entry, EntryStatus

    engine = request.app.state.engine
    with Session(engine) as session:
        entry = session.exec(
            select(Entry).where(
                Entry.slug == slug,
                Entry.status != EntryStatus.ARCHIVED,
            )
        ).first()
        return entry is not None


def _inject_link(html: bytes, slug: str) -> bytes:
    link_tag = f'<link rel="alternate" type="application/json" href="/api/v1/entries/{slug}/raw" />'
    return html.replace(b"</head>", f"{link_tag}\n</head>".encode())


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager.

    Handles startup and shutdown events.
    """
    config: PeekConfig = app.state.config
    logger.info(f"Starting PeekView server v{app.version}")
    logger.info(f"Data directory: {config.data_dir}")
    logger.info(f"Database: {config.db_path}")

    init_db(config.db_path)

    cleanup_task: asyncio.Task | None = None
    interval = config.cleanup.interval_seconds

    if interval > 0:
        admin_service = app.state.admin_service
        check_on_start = config.cleanup.check_on_start

        async def cleanup_loop():
            if check_on_start:
                logger.info("Cleanup: running initial check (check_on_start=True)")
                try:
                    loop = asyncio.get_running_loop()
                    result = await loop.run_in_executor(
                        None, admin_service.cleanup_expired
                    )
                    logger.info(
                        "Cleanup: archived=%d, deleted=%d, freed=%.2fMB",
                        result.archived_count,
                        result.deleted_count,
                        result.freed_mb,
                    )
                except Exception:
                    logger.exception("Cleanup: initial check failed")

            while True:
                await asyncio.sleep(interval)
                try:
                    loop = asyncio.get_running_loop()
                    result = await loop.run_in_executor(
                        None, admin_service.cleanup_expired
                    )
                    logger.info(
                        "Cleanup: archived=%d, deleted=%d, freed=%.2fMB",
                        result.archived_count,
                        result.deleted_count,
                        result.freed_mb,
                    )
                except Exception:
                    logger.exception("Cleanup: periodic check failed")

        cleanup_task = asyncio.create_task(cleanup_loop())
        logger.info("Cleanup background task started (interval=%ds)", interval)
    else:
        logger.info("Cleanup background task disabled (interval=0)")

    yield

    if cleanup_task and not cleanup_task.done():
        cleanup_task.cancel()
        with suppress(asyncio.CancelledError, asyncio.TimeoutError):
            await asyncio.wait_for(cleanup_task, timeout=30)
        logger.info("Cleanup background task cancelled")

    logger.info("Shutting down PeekView server")


def create_app(
    data_dir: Path | None = None,
    db_path: Path | None = None,
    base_url: str | None = None,
    rate_limit_enabled: bool | None = None,
    rate_limit_login_per_minute: int | None = None,
    rate_limit_per_minute: int | None = None,
    config: PeekConfig | None = None,
) -> FastAPI:
    """Create and configure the FastAPI application.

    This factory function creates a new app instance with all
    configurations, middleware, and routes. Use this in tests
    with custom data_dir/db_path.

    Args:
        data_dir: Optional data directory override
        db_path: Optional database path override
        base_url: Optional external base URL override
        rate_limit_enabled: Optional rate limit override
        config: Optional pre-built PeekConfig (skips file/env loading)

    Returns:
        Configured FastAPI application
    """
    app = FastAPI(
        title="PeekView",
        description="A lightweight code & document formatting display service",
        version=__version__,
        lifespan=lifespan,
    )

    # Load configuration
    loaded_config = config if config is not None else PeekConfig()
    if data_dir:
        loaded_config.storage.data_dir = data_dir
    if db_path:
        loaded_config.storage.db_path = db_path
    if base_url:
        loaded_config.server.base_url = base_url
    if rate_limit_enabled is not None:
        loaded_config.server.rate_limit_enabled = rate_limit_enabled
    if rate_limit_login_per_minute is not None:
        loaded_config.server.rate_limit_login_per_minute = rate_limit_login_per_minute
    if rate_limit_per_minute is not None:
        loaded_config.server.rate_limit_per_minute = rate_limit_per_minute
    app.state.config = loaded_config

    # Maintain backward-compatible local variable
    config = loaded_config

    # Ensure directories exist
    config.data_dir.mkdir(parents=True, exist_ok=True)

    # Initialize database and services
    engine = init_db(config.db_path, run_migrations=True)
    app.state.engine = engine

    from peekview.services.admin_service import AdminService
    from peekview.services.apikey_service import ApiKeyService
    from peekview.services.entry_service import EntryService
    from peekview.services.read_tracking_service import ReadTrackingService
    from peekview.services.share_service import ShareService
    from peekview.storage import StorageManager
    storage = StorageManager(config=config)

    from peekview.database import backfill_fts_content
    backfill_fts_content(engine, storage)

    entry_service = EntryService(engine=engine, storage=storage, config=config)
    apikey_service = ApiKeyService(engine=engine)
    admin_service = AdminService(engine=engine, storage=storage, config=config)
    share_service = ShareService(engine=engine, config=config)
    read_tracking_service = ReadTrackingService(engine=engine)
    app.state.entry_service = entry_service
    app.state.apikey_service = apikey_service
    app.state.admin_service = admin_service
    app.state.share_service = share_service
    app.state.read_tracking_service = read_tracking_service

    # Setup CORS - use config or default
    cors_origins = getattr(config, 'cors_origins', ["http://localhost:5173"])
    if isinstance(cors_origins, str):
        cors_origins = cors_origins.split(",")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins or ["http://localhost:5173"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Security headers middleware
    @app.middleware("http")
    async def add_security_headers(request: Request, call_next):
        response = await call_next(request)
        path = request.url.path
        is_render_route = path.endswith("/render") and "/files/" in path
        has_share_param = "share=" in request.url.query
        if path.startswith("/api") or path == "/health":
            response.headers["X-Content-Type-Options"] = "nosniff"
            response.headers["Cache-Control"] = "no-store"
            if has_share_param:
                response.headers["Referrer-Policy"] = "no-referrer"
            else:
                response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
            if is_render_route:
                # render route sets its own CSP and intentionally omits X-Frame-Options
                pass
            else:
                response.headers["X-Frame-Options"] = "DENY"
                response.headers["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'"
        elif path == "/" or path.startswith("/assets") or (not path.startswith("/api") and not path.startswith("/health")):
            response.headers["X-Content-Type-Options"] = "nosniff"
            response.headers["X-Frame-Options"] = "DENY"
            if has_share_param:
                response.headers["Referrer-Policy"] = "no-referrer"
            else:
                response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
            response.headers["Content-Security-Policy"] = (
                "default-src 'self'; "
                "script-src 'self' 'unsafe-eval'; "
                "style-src 'self' 'unsafe-inline'; "
                "img-src 'self' blob: data:; "
                "media-src 'self' blob: data:; "
                "font-src 'self'; "
                "connect-src 'self'; "
                "frame-src 'self' blob:; "
                "worker-src blob:; "
                "frame-ancestors 'none'; "
                "form-action 'none'; "
                "base-uri 'self'"
            )
        return response

    # API key auth middleware (if configured)
    api_key = getattr(config.server, 'api_key', '') or getattr(config, 'api_key', '')
    if api_key:
        @app.middleware("http")
        async def api_key_auth(request: Request, call_next):
            # Skip auth for health check
            if request.url.path == "/health":
                return await call_next(request)

            # Skip auth for static files
            if request.url.path.startswith("/assets") or request.url.path == "/":
                return await call_next(request)

            # Skip auth for auth endpoints (JWT handles these)
            if request.url.path.startswith("/api/v1/auth"):
                return await call_next(request)

            # Skip auth for raw shortlink redirect (target route handles auth)
            path = request.url.path
            if not path.startswith("/") or path.startswith("/api") or path.startswith("/assets") or path.startswith("/health"):
                pass
            elif path.endswith("/raw") and "/" not in path[1:-4]:
                return await call_next(request)

            # Skip auth for API key management endpoints (require JWT)
            if request.url.path.startswith("/api/v1/apikeys"):
                return await call_next(request)

            # Pass through user-level API keys (pv_ prefix) — handled by get_current_user
            x_api_key = request.headers.get("X-API-Key", "")
            if x_api_key.startswith("pv_"):
                return await call_next(request)

            auth_header = request.headers.get("Authorization", "")
            if auth_header.startswith("Bearer "):
                token = auth_header[7:]
                if token.startswith("pv_"):
                    return await call_next(request)

            # Check X-API-Key header (global master key)
            if x_api_key == api_key:
                return await call_next(request)

            # Check Authorization: Bearer (backward compat, only for non-JWT tokens)
            auth_header = request.headers.get("Authorization", "")
            if auth_header.startswith("Bearer "):
                token = auth_header[7:]
                # If token looks like JWT (3 segments), skip — it's user auth
                if len(token.split(".")) != 3 and token == api_key:
                    return await call_next(request)

            return JSONResponse(
                status_code=401,
                content={"error": {"code": "UNAUTHORIZED", "message": "Invalid or missing API key", "details": None}},
            )

    # Request logging middleware
    @app.middleware("http")
    async def log_requests(request: Request, call_next):
        start = time.time()
        response = await call_next(request)
        duration = (time.time() - start) * 1000
        logger.info(
            "%s %s → %d (%.1fms)",
            request.method, request.url.path, response.status_code, duration,
        )
        return response

    # Configure rate limiter
    app.state.limiter = limiter
    limiter.enabled = config.server.rate_limit_enabled

    # Rate limit exception handler
    @app.exception_handler(RateLimitExceeded)
    async def rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded):
        return JSONResponse(
            status_code=429,
            content={"error": {"code": "RATE_LIMITED", "message": str(exc.detail), "details": None}},
        )

    # Add SlowAPIMiddleware for rate limiting
    from slowapi.middleware import SlowAPIMiddleware
    app.add_middleware(SlowAPIMiddleware)

    # Register API routes
    from peekview.api.admin import router as admin_router
    from peekview.api.apikeys import router as apikeys_router
    from peekview.api.auth import router as auth_router
    from peekview.api.captcha_router import router as captcha_router
    from peekview.api.config_router import router as config_router
    from peekview.api.entries import router as entries_router
    from peekview.api.files import router as files_router
    from peekview.api.shares import router as shares_router
    app.include_router(auth_router)
    app.include_router(apikeys_router)
    app.include_router(entries_router)
    app.include_router(files_router)
    app.include_router(config_router)
    app.include_router(captcha_router)
    app.include_router(admin_router)
    app.include_router(shares_router)

    # --- Rate limit binding (dynamic, respects config values) ---
    from peekview.api.rate_limit import (
        set_captcha_rate_limit,
        set_entries_rate_limit,
        set_login_rate_limit,
    )

    login_limit = f"{config.server.rate_limit_login_per_minute}/minute"
    set_login_rate_limit(login_limit)

    captcha_limit = f"{config.server.rate_limit_per_minute}/minute"
    set_captcha_rate_limit(captcha_limit)

    entries_limit = f"{config.server.rate_limit_per_minute}/minute"
    set_entries_rate_limit(entries_limit)

    # Global default limit for other API endpoints
    limiter.default_limits = [captcha_limit]

    # Health check (must be before static files to avoid catch-all route)
    @app.get("/health")
    async def health_check(request: Request):
        config = request.app.state.config
        engine = request.app.state.engine
        checks = {}
        warnings = []

        # Database connectivity
        try:
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            checks["database"] = "ok"
        except Exception as e:
            checks["database"] = f"error: {e}"
            warnings.append("database_error")

        # Storage directory accessibility
        data_dir = config.storage.data_dir
        if data_dir.exists() and os.access(data_dir, os.W_OK):
            checks["storage"] = "ok"
        else:
            checks["storage"] = "error: data_dir not accessible"
            warnings.append("storage_error")

        # Disk space
        try:
            usage = shutil.disk_usage(data_dir)
            free_mb = usage.free // (1024 * 1024)
            checks["disk_space_mb"] = free_mb
            if free_mb < config.storage.health_disk_warning_mb:
                warnings.append("disk_space_low")
        except Exception:
            checks["disk_space_mb"] = "unknown"

        status = "ok" if not warnings else "degraded"
        result = {"status": status, "version": app.version, "checks": checks}
        if warnings:
            result["warnings"] = warnings
        return result

    # Add global exception handler for PeekError
    @app.exception_handler(PeekError)
    async def peek_error_handler(request: Request, exc: PeekError):
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "error": {
                    "code": exc.error_code,
                    "message": str(exc),
                    "details": None,
                }
            },
        )

    # Add generic exception handler
    @app.exception_handler(Exception)
    async def generic_exception_handler(request: Request, exc: Exception):
        logger.exception("Unhandled exception")
        return JSONResponse(
            status_code=500,
            content={
                "error": {
                    "code": "INTERNAL_ERROR",
                    "message": "An unexpected error occurred",
                    "details": None,
                }
            },
        )

    # Raw shortlink redirect: /{slug}/raw → /api/v1/entries/{slug}/raw
    # Must be registered before _setup_static_files to avoid SPA catch-all
    from fastapi.responses import RedirectResponse

    @app.get("/{slug}/raw")
    async def raw_shortlink(slug: str):
        return RedirectResponse(url=f"/api/v1/entries/{slug}/raw", status_code=302)

    # llms.txt redirect to GitHub raw (for remote Agent discovery)
    @app.get("/llms.txt")
    async def llms_txt():
        return RedirectResponse(
            url="https://github.com/randomgitsrc/peekview/blob/main/llms.txt?raw=true",
            status_code=302,
        )

    # Static file serving for production SPA build
    _setup_static_files(app)

    return app


def _setup_static_files(app: FastAPI) -> None:
    """Mount static file serving for production SPA build if the dist directory exists."""
    try:
        from fastapi.staticfiles import StaticFiles

        # Look for frontend build in standard locations (in order of preference)
        possible_paths = [
            # Development: frontend-v3/dist (current frontend)
            Path(__file__).parent.parent.parent / "frontend-v3" / "dist",
            # Installed package: peekview/static (package directory)
            Path(__file__).parent / "static",
        ]

        frontend_dist = None
        for path in possible_paths:
            if path.exists() and path.is_dir() and (path / "index.html").exists():
                frontend_dist = path
                break

        if frontend_dist:
            assets_dir = frontend_dist / "assets"
            if assets_dir.exists():
                app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

            @app.get("/")
            async def serve_spa():
                from fastapi.responses import FileResponse
                return FileResponse(frontend_dist / "index.html")

            @app.get("/{path:path}")
            async def serve_spa_catchall(request: Request, path: str):
                from fastapi.responses import FileResponse, HTMLResponse

                if path.startswith("api/") or path.startswith("health"):
                    from fastapi import HTTPException
                    raise HTTPException(status_code=404, detail="Not found")

                file_path = frontend_dist / path
                if file_path.exists() and file_path.is_file():
                    return FileResponse(file_path)

                if not _is_frontend_route(path) and _prefers_json(request.headers.get("accept")):
                    from peekview.api.files import resolve_entry_raw
                    return await resolve_entry_raw(request, path)

                index_path = frontend_dist / "index.html"
                html = index_path.read_bytes()

                if not _is_frontend_route(path) and _slug_exists(request, path):
                    html = _inject_link(html, path)
                    link_value = (
                        f'</api/v1/entries/{path}/raw>; rel="alternate";'
                        ' type="application/json"'
                    )
                    return HTMLResponse(
                        content=html,
                        headers={"Link": link_value},
                    )

                return HTMLResponse(content=html)

            logger.info("Serving frontend SPA from %s", frontend_dist)
    except Exception:
        # Frontend not built yet, that's ok
        pass


def get_app() -> FastAPI:
    """Lazy app factory for uvicorn.

    Use this with uvicorn's factory mode to avoid import-time side effects:
        uvicorn peekview.main:get_app --factory

    Returns:
        FastAPI application instance
    """
    return create_app()
