"""FastAPI application factory and main entry point."""

import logging
import time
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from peekview.config import PeekConfig
from peekview.database import init_db
from peekview.exceptions import PeekError

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager.

    Handles startup and shutdown events.
    """
    # Startup
    config: PeekConfig = app.state.config
    logger.info(f"Starting Peek server v{app.version}")
    logger.info(f"Data directory: {config.data_dir}")
    logger.info(f"Database: {config.db_path}")

    # Initialize database
    init_db(config.db_path)

    yield

    # Shutdown
    logger.info("Shutting down Peek server")


def create_app(
    data_dir: Path | None = None,
    db_path: Path | None = None,
) -> FastAPI:
    """Create and configure the FastAPI application.

    This factory function creates a new app instance with all
    configurations, middleware, and routes. Use this in tests
    with custom data_dir/db_path.

    Args:
        data_dir: Optional data directory override
        db_path: Optional database path override

    Returns:
        Configured FastAPI application
    """
    app = FastAPI(
        title="Peek",
        description="A lightweight code & document formatting display service",
        version="0.1.0",
        lifespan=lifespan,
    )

    # Load configuration
    config = PeekConfig()
    if data_dir:
        config.storage.data_dir = data_dir
    if db_path:
        config.storage.db_path = db_path
    app.state.config = config

    # Ensure directories exist
    config.data_dir.mkdir(parents=True, exist_ok=True)

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

            auth_header = request.headers.get("Authorization", "")
            if auth_header.startswith("Bearer "):
                token = auth_header[7:]
                if token == api_key:
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

    # Register API routes
    from peekview.api.entries import router as entries_router
    from peekview.api.files import router as files_router
    app.include_router(entries_router)
    app.include_router(files_router)

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

    # Static file serving for production SPA build
    _setup_static_files(app)

    # Health check
    @app.get("/health")
    async def health_check():
        return {"status": "ok", "version": app.version}

    return app


def _setup_static_files(app: FastAPI) -> None:
    """Mount static file serving for production SPA build if the dist directory exists."""
    try:
        from fastapi.staticfiles import StaticFiles

        # Look for frontend build in standard locations (in order of preference)
        possible_paths = [
            # Development: frontend/dist
            Path(__file__).parent.parent.parent / "frontend" / "dist",
            # Installed package: peek/static
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
            async def serve_spa_catchall(path: str):
                """Catch-all for SPA routing — serve index.html for unknown paths."""
                from fastapi.responses import FileResponse
                # First try to serve the actual file
                file_path = frontend_dist / path
                if file_path.exists() and file_path.is_file():
                    return FileResponse(file_path)
                # Otherwise serve index.html for SPA routing
                return FileResponse(frontend_dist / "index.html")

            logger.info("Serving frontend SPA from %s", frontend_dist)
    except Exception:
        # Frontend not built yet, that's ok
        pass


def get_app() -> FastAPI:
    """Lazy app factory for uvicorn.

    Use this with uvicorn's factory mode to avoid import-time side effects:
        uvicorn peek.main:get_app --factory

    Returns:
        FastAPI application instance
    """
    return create_app()
