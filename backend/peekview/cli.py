"""CLI commands for PeekView.

Provides command-line interface for:
- Starting the server (`peekview serve`)
- Creating entries (`peekview create`)
- Getting entries (`peekview get`)
- Listing entries (`peekview list`)
- Deleting entries (`peekview delete`)
- Managing service (`peekview service`)
"""

import json
import os
import platform
import re
import subprocess
import sys
from pathlib import Path
from typing import Any

import click
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from peekview import __version__
from peekview.client import PeekClient
from peekview.config import PeekConfig
from peekview.database import check_schema, init_db
from peekview.exceptions import NotFoundError
from peekview.models import (
    AdminCleanupResponse,
    AdminStatsResponse,
    RestorePreview,
    User,
)
from peekview.services.admin_service import AdminService
from peekview.services.apikey_service import ApiKeyService
from peekview.services.entry_service import EntryService
from peekview.storage import StorageManager


def _get_backend(
    config: PeekConfig,
    cli_remote_url: str | None = None,
) -> EntryService | PeekClient:
    """Get backend for CLI operations.

    Returns PeekClient for remote mode, EntryService for local mode.

    Priority:
    1. CLI --remote-url argument (empty string = explicit local mode)
    2. Environment variable PEEKVIEW_REMOTE__URL
    3. Config file remote.url
    4. Local mode (default)
    """
    # Priority 1: CLI argument
    if cli_remote_url is not None:
        remote_url = cli_remote_url
    # Priority 2: Environment variable (empty string = explicit local mode)
    elif "PEEKVIEW_REMOTE__URL" in os.environ:
        remote_url = os.environ["PEEKVIEW_REMOTE__URL"]
    # Priority 3: Config file
    else:
        remote_url = config.remote.url

    # Empty string = explicit disable
    if remote_url:
        return PeekClient(
            base_url=remote_url,
            api_key=config.remote.api_key,
            token=config.remote.token,
            timeout=config.remote.timeout,
            verify_ssl=config.remote.verify_ssl,
        )

    # Local mode
    engine = init_db(config.db_path)
    check_schema(engine)
    storage = StorageManager(config=config)
    return EntryService(engine=engine, storage=storage, config=config)


def _is_remote_mode(backend: EntryService | PeekClient) -> bool:
    """Check if backend is remote PeekClient."""
    return isinstance(backend, PeekClient)


def _scan_directory_local(base_path: Path, ignored_dirs: set[str]) -> list[dict[str, Any]]:
    """Recursively scan directory and return files_data for remote upload.

    Skips binary files and ignored directories.
    """
    files_data = []

    for root, dirs, filenames in os.walk(base_path):
        # Skip ignored directories
        dirs[:] = [d for d in dirs if d not in ignored_dirs]

        for name in filenames:
            file_path = Path(root) / name
            try:
                # Try to read as text
                content = file_path.read_text(encoding="utf-8", errors="strict")
                rel_path = file_path.relative_to(base_path)
                files_data.append({
                    "path": str(rel_path),
                    "filename": name,
                    "content": content,
                })
            except UnicodeDecodeError:
                # Binary file - skip with warning
                rel_path = file_path.relative_to(base_path)
                click.echo(f"⚠ Warning: Skipping binary file: {rel_path}", err=True)

    return files_data


@click.group(
    name="peekview",
    context_settings={"help_option_names": ["-h", "--help"]}
)
@click.version_option(__version__, "-v", "--version", prog_name="peekview")
def cli() -> None:
    """PeekView - A lightweight code & document formatting display service."""
    pass


SERVE_EXAMPLES = """
\b
Examples:

    peekview serve                              # Start with default config

    peekview serve -p 3000                      # Start on port 3000

    peekview serve --reload                     # Development mode

    peekview serve --base-url https://example.com
"""


@cli.command(epilog=SERVE_EXAMPLES)
@click.option("--host", "-h", default=None, help="Server bind address (default: 127.0.0.1, use 0.0.0.0 for all interfaces)")
@click.option("--port", "-p", default=None, type=int, help="Server port (default: 8080)")
@click.option("--base-url", "-b", default=None, help="External base URL (e.g., https://example.com)")
@click.option("--reload", is_flag=True, help="Enable auto-reload (development)")
@click.option("--workers", "-w", default=1, type=int, help="Number of worker processes")
@click.pass_context
def serve(ctx: click.Context, host: str | None, port: int | None, base_url: str | None, reload: bool, workers: int) -> None:
    """Start the PeekView server."""
    import uvicorn

    config = PeekConfig()

    # Override with CLI args
    bind_host = host or config.server.host
    bind_port = port or config.server.port

    # Set base_url from CLI if provided (takes precedence over env var)
    if base_url:
        config.server.base_url = base_url

    # Ensure data directory exists
    config.ensure_directories()

    # Initialize database
    init_db(config.db_path, run_migrations=True)

    click.echo(f"Starting Peek server on http://{bind_host}:{bind_port}")
    click.echo(f"Data directory: {config.data_dir}")
    click.echo(f"Database: {config.db_path}")
    if config.server.base_url:
        click.echo(f"Base URL: {config.server.base_url}")

    uvicorn.run(
        "peekview.main:get_app",
        host=bind_host,
        port=bind_port,
        reload=reload,
        workers=1 if reload else workers,
        factory=True,
    )


CREATE_EXAMPLES = """
\b
Examples:

    peekview create file.txt -s "My code"

    peekview create src/*.py -s "Project" -t python

    peekview create -s "From stdin" --from-stdin < code.py

    echo "content" | peekview create -s "From pipe" --from-stdin

    peekview create file.txt -s "Remote" --remote-url https://example.com
"""


@cli.command(epilog=CREATE_EXAMPLES)
@click.argument("paths", nargs=-1, required=False)
@click.option("--summary", "-s", required=True, help="Entry summary/description")
@click.option("--slug", help="Custom URL slug (auto-generated if not provided)")
@click.option("--tag", "-t", multiple=True, help="Tags (can be specified multiple times)")
@click.option("--expires-in", help="Expiration duration (e.g., '7d', '1h', '30m'). Default: configured via limits.default_expires_in. Use '0' for no expiration.")
@click.option("--from-stdin", is_flag=True, help="Read file content from stdin")
@click.option("--base-url", "-b", default=None, help="External base URL for generated links")
@click.option("--remote-url", "-r", default=None, help="Remote server URL")
@click.option("--visibility", "-v", type=click.Choice(["public", "private"]), default="public", help="Entry visibility")
@click.option("--json-output", "-j", is_flag=True, help="Output as JSON")
def create(
    paths: tuple[str, ...],
    summary: str,
    slug: str | None,
    tag: tuple[str, ...],
    expires_in: str | None,
    from_stdin: bool,
    base_url: str | None,
    remote_url: str | None,
    visibility: str,
    json_output: bool,
) -> None:
    """Create a new entry."""
    config = PeekConfig()

    # Get backend (local EntryService or remote PeekClient)
    backend = _get_backend(config, cli_remote_url=remote_url)
    is_remote = _is_remote_mode(backend)

    # Show remote mode indicator (only in non-JSON mode)
    if is_remote and not json_output:
        click.echo(f"→ Remote mode: {remote_url or config.remote.url}")

    # Set base_url from CLI if provided (for local mode URL generation)
    if base_url and not is_remote:
        config.server.base_url = base_url

    if not is_remote:
        # Local mode: ensure directories and init DB
        config.ensure_directories()

    # Collect files
    files_data: list[dict[str, Any]] = []
    dirs_data: list[dict[str, str]] = []

    if from_stdin:
        # Read from stdin
        content = sys.stdin.read()
        filename = "stdin.txt"
        files_data.append({
            "path": filename,
            "filename": filename,
            "content": content,
        })
    elif paths:
        # Process each path
        for path_str in paths:
            path = Path(path_str)

            if not path.exists():
                click.echo(f"Error: Path not found: {path_str}", err=True)
                sys.exit(1)

            if path.is_dir():
                if is_remote:
                    # Remote mode: scan directory locally and add files
                    scanned_files = _scan_directory_local(path, config.ignored_dirs)
                    files_data.extend(scanned_files)
                else:
                    # Local mode: pass directory to service
                    dirs_data.append({"path": str(path.resolve())})
            elif path.is_file():
                # Read file content
                try:
                    content = path.read_text(encoding="utf-8", errors="replace")
                    files_data.append({
                        "path": path.name,
                        "filename": path.name,
                        "content": content,
                    })
                except Exception as e:
                    click.echo(f"Error reading {path_str}: {e}", err=True)
                    sys.exit(1)
    else:
        # No paths provided - create empty entry
        pass

    is_public = visibility == "public"

    try:
        create_result = backend.create_entry(
            summary=summary,
            slug=slug,
            tags=list(tag),
            files_data=files_data if files_data else None,
            dirs_data=dirs_data if dirs_data else None,
            expires_in=expires_in,
            is_public=is_public,
        )
        result = create_result if _is_remote_mode(backend) else create_result[0]

        if json_output:
            click.echo(json.dumps({
                "id": result.id,
                "slug": result.slug,
                "url": result.url,
                "created_at": result.created_at.isoformat() if result.created_at else None,
                "file_count": len(result.files),
            }, indent=2))
        else:
            click.echo(f"✓ Created entry: {result.slug}")
            click.echo(f"  URL: {result.url}")
            click.echo(f"  Files: {len(result.files)}")
            if result.files:
                for f in result.files:
                    click.echo(f"    - {f.path or f.filename}")

    except Exception as e:
        click.echo(f"Error: {e}", err=True)
        sys.exit(1)


@cli.command()
@click.argument("slug")
@click.option("--remote-url", "-r", default=None, help="Remote server URL (e.g., https://example.com)")
@click.option("--json-output", "-j", is_flag=True, help="Output as JSON")
def get(slug: str, remote_url: str | None, json_output: bool) -> None:
    """Get entry details by slug.

    Examples:
        peekview get my-entry
        peekview get my-entry --json
        peekview get my-entry --remote-url https://example.com
    """
    config = PeekConfig()

    # Get backend (local EntryService or remote PeekClient)
    backend = _get_backend(config, cli_remote_url=remote_url)
    is_remote = _is_remote_mode(backend)

    # Show remote mode indicator (only in non-JSON mode)
    if is_remote and not json_output:
        click.echo(f"→ Remote mode: {remote_url or config.remote.url}")

    try:
        entry = backend.get_entry(slug)

        if json_output:
            click.echo(json.dumps({
                "id": entry.id,
                "slug": entry.slug,
                "summary": entry.summary,
                "status": entry.status,
                "tags": entry.tags,
                "files": [
                    {
                        "id": f.id,
                        "path": f.path,
                        "filename": f.filename,
                        "language": f.language,
                        "size": f.size,
                    }
                    for f in entry.files
                ],
                "created_at": entry.created_at.isoformat() if entry.created_at else None,
                "updated_at": entry.updated_at.isoformat() if entry.updated_at else None,
            }, indent=2))
        else:
            click.echo(f"Entry: {entry.slug}")
            click.echo(f"Summary: {entry.summary}")
            click.echo(f"Status: {entry.status}")
            if entry.tags:
                click.echo(f"Tags: {', '.join(entry.tags)}")
            click.echo(f"Files: {len(entry.files)}")
            for f in entry.files:
                lang_info = f" ({f.language})" if f.language else ""
                click.echo(f"  - {f.path or f.filename}{lang_info} - {f.size} bytes")

    except Exception as e:
        click.echo(f"Error: {e}", err=True)
        sys.exit(1)


@cli.command(name="list")
@click.option("--query", "-q", help="Search query (FTS5 search)")
@click.option("--tag", "-t", multiple=True, help="Filter by tag")
@click.option("--status", "-s", help="Filter by status")
@click.option("--page", "-p", default=1, type=int, help="Page number")
@click.option("--per-page", default=20, type=int, help="Items per page")
@click.option("--remote-url", "-r", default=None, help="Remote server URL (e.g., https://example.com)")
@click.option("--json-output", "-j", is_flag=True, help="Output as JSON")
def list_entries(
    query: str | None,
    tag: tuple[str, ...],
    status: str | None,
    page: int,
    per_page: int,
    remote_url: str | None,
    json_output: bool,
) -> None:
    """List entries with optional filters.

    Examples:
        peekview list
        peekview list -q "python"
        peekview list -t cli -t python
        peekview list --status active
        peekview list --remote-url https://example.com
    """
    config = PeekConfig()

    # Get backend (local EntryService or remote PeekClient)
    backend = _get_backend(config, cli_remote_url=remote_url)
    is_remote = _is_remote_mode(backend)

    # Show remote mode indicator (only in non-JSON mode)
    if is_remote and not json_output:
        click.echo(f"→ Remote mode: {remote_url or config.remote.url}")

    try:
        tag_list = list(tag) if tag else None
        result = backend.list_entries(
            q=query,
            tags=tag_list,
            status=status,
            page=page,
            per_page=per_page,
        )

        # Handle both local (EntryListResponse) and remote (dict) results
        if is_remote:
            items = result.get("items", [])
            total = result.get("total", 0)
            page_num = result.get("page", page)
            per_page_num = result.get("per_page", per_page)
        else:
            items = result.items
            total = result.total
            page_num = result.page
            per_page_num = result.per_page

        if json_output:
            click.echo(json.dumps({
                "items": [
                    {
                        "id": item.get("id") if isinstance(item, dict) else item.id,
                        "slug": item.get("slug") if isinstance(item, dict) else item.slug,
                        "summary": item.get("summary") if isinstance(item, dict) else item.summary,
                        "tags": item.get("tags") if isinstance(item, dict) else item.tags,
                        "status": item.get("status") if isinstance(item, dict) else item.status,
                        "file_count": item.get("file_count") if isinstance(item, dict) else item.file_count,
                        "created_at": (item.get("created_at") if isinstance(item, dict)
                                       else item.created_at.isoformat() if item.created_at else None),
                        "updated_at": (item.get("updated_at") if isinstance(item, dict)
                                       else item.updated_at.isoformat() if item.updated_at else None),
                    }
                    for item in items
                ],
                "total": total,
                "page": page_num,
                "per_page": per_page_num,
            }, indent=2))
        else:
            click.echo(f"Entries ({total} total, page {page_num}):")
            click.echo()
            for item in items:
                item_slug = item.get("slug") if isinstance(item, dict) else item.slug
                item_summary = item.get("summary") if isinstance(item, dict) else item.summary
                item_tags = item.get("tags") if isinstance(item, dict) else item.tags
                item_file_count = item.get("file_count") if isinstance(item, dict) else item.file_count
                item_status = item.get("status") if isinstance(item, dict) else item.status

                tags_str = f" [{', '.join(item_tags)}]" if item_tags else ""
                click.echo(f"  {item_slug}{tags_str}")
                click.echo(f"    {item_summary[:60]}{'...' if len(item_summary) > 60 else ''}")
                click.echo(f"    {item_file_count} files | {item_status}")
                click.echo()

    except Exception as e:
        click.echo(f"Error: {e}", err=True)
        sys.exit(1)


@cli.command()
@click.argument("slug")
@click.option("--remote-url", "-r", default=None, help="Remote server URL (e.g., https://example.com)")
@click.confirmation_option(prompt="Are you sure you want to delete this entry?")
def delete(slug: str, remote_url: str | None) -> None:
    """Delete an entry by slug.

    Examples:
        peekview delete my-entry
        peekview delete my-entry --yes  # Skip confirmation
        peekview delete my-entry --remote-url https://example.com
    """
    config = PeekConfig()

    # Get backend (local EntryService or remote PeekClient)
    backend = _get_backend(config, cli_remote_url=remote_url)
    is_remote = _is_remote_mode(backend)

    # Show remote mode indicator
    if is_remote:
        click.echo(f"→ Remote mode: {config.remote.url or remote_url}")

    try:
        if is_remote:
            backend.delete_entry(slug)
        else:
            # Local mode: CLI operates as admin, bypass auth checks
            backend.delete_entry(slug, current_user_id=None, is_api_key_auth=True, allow_local=True)
        click.echo(f"✓ Deleted entry: {slug}")
    except Exception as e:
        click.echo(f"Error: {e}", err=True)
        sys.exit(1)


@cli.group(name="config")
def config_cmd():
    """Manage PeekView configuration.

    Examples:
        peekview config set server.port 13001
        peekview config get server.port
        peekview config list

    Run 'peekview config list' to see all available configuration keys.
    Run 'peekview config set --help' for the key list.
    """
    pass


SUPPORTED_CONFIG_KEYS = (
    "base_url",
    # Server
    "server.host", "server.port", "server.base_url", "server.api_key",
    "server.cors_origins", "server.rate_limit_enabled",
    "server.rate_limit_per_minute", "server.rate_limit_login_per_minute",
    # Storage
    "storage.data_dir", "storage.db_path", "storage.allowed_paths",
    "storage.health_disk_warning_mb",
    # Auth
    "auth.secret_key", "auth.token_expire_days", "auth.allow_registration",
    "auth.allow_anonymous_create",
    "auth.captcha_enabled", "auth.captcha_site_key",
    # Limits
    "limits.max_file_size", "limits.max_entry_files", "limits.max_entry_size",
    "limits.max_slug_length", "limits.max_summary_length", "limits.max_per_page",
    "limits.default_expires_in",
    # Cleanup
    "cleanup.check_on_start", "cleanup.interval_seconds",
    # Logging
    "logging.level", "logging.log_file",
    # Remote
    "remote.url", "remote.api_key", "remote.timeout", "remote.verify_ssl",
    # Diagram
    "diagram.sanitize_enabled",
)

CONFIG_KEYS_HELP = """
\b
Supported keys:
server.host, server.port, server.base_url, server.api_key, server.cors_origins,
server.rate_limit_enabled, server.rate_limit_per_minute, server.rate_limit_login_per_minute,
storage.data_dir, storage.db_path, storage.allowed_paths, storage.health_disk_warning_mb,
auth.secret_key, auth.token_expire_days, auth.allow_registration, auth.allow_anonymous_create,
auth.captcha_enabled, auth.captcha_site_key,
limits.max_file_size, limits.max_entry_files, limits.max_entry_size, limits.max_slug_length,
limits.max_summary_length, limits.max_per_page, limits.default_expires_in,
cleanup.check_on_start, cleanup.interval_seconds,
logging.level, logging.log_file,
remote.url, remote.api_key, remote.timeout, remote.verify_ssl,
diagram.sanitize_enabled,
base_url (alias for server.base_url)
"""


@config_cmd.command(name="set", epilog=CONFIG_KEYS_HELP)
@click.argument("key")
@click.argument("value")
def config_set(key: str, value: str) -> None:
    """Set a configuration value.\n
    Examples:\n
        peekview config set server.port 3000\n
        peekview config set server.base_url https://example.com\n
        peekview config set storage.data_dir /var/peekview
    """
    from peekview.config import CONFIG_FILE, load_config_file, save_config_file

    config = load_config_file()

    # Validate key
    if key not in SUPPORTED_CONFIG_KEYS:
        click.echo(f"Error: Unknown config key '{key}'", err=True)
        click.echo(f"Supported keys: {', '.join(SUPPORTED_CONFIG_KEYS)}", err=True)
        sys.exit(1)

    # Handle nested keys with type conversion
    section, key_name = key.split(".", 1) if "." in key else ("server", key)

    if section not in config:
        config[section] = {}

    # Type conversion based on key patterns
    if key_name in ("port", "token_expire_days", "timeout", "health_disk_warning_mb",
                    "max_file_size", "max_entry_files", "max_entry_size",
                    "max_slug_length", "max_summary_length", "max_per_page",
                    "interval_seconds",
                    "captcha_builtin_difficulty", "captcha_builtin_challenge_count",
                    "captcha_builtin_challenge_size", "captcha_builtin_challenge_ttl_ms",
                    "captcha_builtin_token_ttl_ms", "rate_limit_per_minute",
                    "rate_limit_login_per_minute"):
        try:
            value = int(value)
        except ValueError:
            click.echo(f"Error: {key} must be an integer", err=True)
            sys.exit(1)
    elif key_name in ("allow_registration", "allow_anonymous_create",
                      "rate_limit_enabled", "check_on_start", "verify_ssl",
                      "captcha_enabled", "captcha_exempt_first_user",
                      "sanitize_enabled"):
        if value.lower() not in ("true", "1", "yes", "on", "false", "0", "no", "off"):
            click.echo(f"Error: {key} must be a boolean (true/false, 1/0, yes/no, on/off)", err=True)
            sys.exit(1)
        value = value.lower() in ("true", "1", "yes", "on")
    elif key_name == "cors_origins" or key_name == "allowed_paths":
        value = [v.strip() for v in value.split(",")]
    elif key_name in ("data_dir", "db_path", "log_file"):
        # Path expansion handled by config validator
        pass

    config[section][key_name] = value

    save_config_file(config)
    click.echo(f"✓ Set {key} = {value}")
    click.echo(f"  Config file: {CONFIG_FILE}")
    click.echo("  ⚠  Restart service to apply: peekview service restart")


@config_cmd.command(name="get", epilog=CONFIG_KEYS_HELP)
@click.argument("key")
def config_get(key: str) -> None:
    """Get a configuration value.

    Example: peekview config get server.port
    """
    from peekview.config import PeekConfig, load_config_file

    config = load_config_file()
    defaults = PeekConfig()

    # Helper to get default value
    def get_default(section: str, k: str):
        if section == "server":
            return getattr(defaults.server, k, "")
        elif section == "storage":
            return getattr(defaults.storage, k, "")
        elif section == "auth":
            return getattr(defaults.auth, k, "")
        elif section == "limits":
            return getattr(defaults.limits, k, "")
        elif section == "cleanup":
            return getattr(defaults.cleanup, k, "")
        elif section == "logging":
            return getattr(defaults.logging, k, "")
        elif section == "remote":
            return getattr(defaults.remote, k, "")
        elif section == "diagram":
            return getattr(defaults.diagram, k, "")
        return ""

    # Handle all keys with defaults
    if key == "base_url":
        value = config.get("server", {}).get("base_url", "")
        default = defaults.server.base_url
        click.echo(value if value else f"(not set, default: {default})")
    elif "." in key:
        section, key_name = key.split(".", 1)
        value = config.get(section, {}).get(key_name, "")
        default = get_default(section, key_name)
        if value != "":
            click.echo(value)
        elif default != "":
            click.echo(f"(not set, default: {default})")
        else:
            click.echo("(not set)")
    else:
        click.echo(f"Error: Unknown config key '{key}'", err=True)
        sys.exit(1)


@config_cmd.command(name="list")
def config_list() -> None:
    """List all configuration values."""
    from peekview.config import CONFIG_FILE, PeekConfig, load_config_file

    config = load_config_file()
    defaults = PeekConfig()

    def _get_default(section: str, k: str):
        """Get default value from PeekConfig."""
        try:
            if section == "server":
                return getattr(defaults.server, k)
            elif section == "storage":
                return getattr(defaults.storage, k)
            elif section == "auth":
                return getattr(defaults.auth, k)
            elif section == "limits":
                return getattr(defaults.limits, k)
            elif section == "cleanup":
                return getattr(defaults.cleanup, k)
            elif section == "logging":
                return getattr(defaults.logging, k)
            elif section == "remote":
                return getattr(defaults.remote, k)
            elif section == "diagram":
                return getattr(defaults.diagram, k)
        except AttributeError:
            pass
        return ""

    # Build display list: (section, key, file_value, default_value) with dedup
    seen = set()
    items = []
    for raw_key in SUPPORTED_CONFIG_KEYS:
        if "." in raw_key:
            section, key_name = raw_key.split(".", 1)
        else:
            section, key_name = "server", raw_key
        dedup_key = (section, key_name)
        if dedup_key in seen:
            continue
        seen.add(dedup_key)
        file_val = config.get(section, {}).get(key_name, "")
        default_val = _get_default(section, key_name)
        items.append((section, key_name, file_val, default_val))

    # Descriptions (hardcoded, keyed by (section, key_name))
    _DESC: dict[tuple[str, str], str] = {  # noqa: N806
        ("server", "host"): "# 绑定地址 (127.0.0.1 仅本地，0.0.0.0 所有接口)",
        ("server", "port"): "# 服务端口",
        ("server", "base_url"): "# 公开访问地址（为空时自动检测）",
        ("server", "api_key"): "# 全局 API Key（为空时不验证）",
        ("server", "cors_origins"): "# CORS 允许的来源",
        ("server", "rate_limit_enabled"): "# 是否启用速率限制",
        ("server", "rate_limit_per_minute"): "# 通用限速（次/分钟/IP）",
        ("server", "rate_limit_login_per_minute"): "# 登录限速（次/分钟/IP）",
        ("storage", "data_dir"): "# 文件存储目录",
        ("storage", "db_path"): "# 数据库路径",
        ("storage", "allowed_paths"): "# local_path 白名单",
        ("storage", "health_disk_warning_mb"): "# 磁盘告警阈值 (MB)",
        ("auth", "secret_key"): "# JWT 签名密钥（为空时自动生成）",
        ("auth", "token_expire_days"): "# JWT 过期天数",
        ("auth", "allow_registration"): "# 允许新用户注册",
        ("auth", "allow_anonymous_create"): "# 允许匿名创建条目",
        ("auth", "captcha_enabled"): "# 验证码开关（开启后登录/注册需验证）",
        ("auth", "captcha_site_key"): "# 验证码 Site Key（内置模式可留空）",
        ("limits", "max_file_size"): "# 单文件最大字节数",
        ("limits", "max_entry_files"): "# 单条目最大文件数",
        ("limits", "max_entry_size"): "# 单条目最大总字节数",
        ("limits", "max_slug_length"): "# slug 最大长度",
        ("limits", "max_summary_length"): "# summary 最大长度",
        ("limits", "max_per_page"): "# 分页每页最大条数",
        ("limits", "default_expires_in"): "# 默认过期时长（如 15d、7d、1h，'0' 为永不过期）",
        ("cleanup", "check_on_start"): "# 启动时检查过期条目",
        ("cleanup", "interval_seconds"): "# 清理间隔秒数 (0=禁用)",
        ("logging", "level"): "# 日志级别 (debug/info/warn/error)",
        ("logging", "log_file"): "# 日志文件路径（为空时只输出 stderr）",
        ("remote", "url"): "# 远程服务器地址",
        ("remote", "api_key"): "# 远程 API Key",
        ("remote", "timeout"): "# 远程请求超时秒数",
        ("remote", "verify_ssl"): "# 验证 SSL 证书",
        ("diagram", "sanitize_enabled"): "# 图表源码自动清洗开关（mermaid/plantuml/svg 渲染前预处理）",
    }

    # Section order
    _SECTION_ORDER = ["server", "storage", "auth", "limits", "cleanup", "logging", "remote", "diagram"]  # noqa: N806

    click.echo("Configuration:")
    click.echo("")
    for section in _SECTION_ORDER:
        section_items = [(k, fv, dv) for s, k, fv, dv in items if s == section]
        if not section_items:
            continue
        click.echo(f"{section}:")
        for key_name, file_val, default_val in section_items:
            if file_val != "":
                val = file_val
            elif default_val != "":
                val = default_val
            else:
                val = "(not set)"
            if isinstance(val, list):
                val = ", ".join(str(v) for v in val)
            elif isinstance(val, bool):
                val = "True" if val else "False"
            desc = _DESC.get((section, key_name), "")
            click.echo(f"  {key_name}: {val}  {desc}")
        click.echo("")

    click.echo("Available config keys:")
    for section in _SECTION_ORDER:
        keys = [k for s, k, _, _ in items if s == section]
        if keys:
            click.echo(f"  {section}.{', '.join(keys)}")
    click.echo("")
    click.echo(f"Config file: {CONFIG_FILE}")


SERVICE_EXAMPLES = """
\b
Examples:

    peekview service install              # Install as user service (auto-detected)

    peekview service install --system     # Install as system service (requires sudo)

    peekview service status               # Check service status (auto-detected)

    peekview service start                # Start the service (auto-detected)

    peekview service stop                 # Stop the service (auto-detected)

    peekview service restart              # Restart the service (auto-detected)

    peekview service uninstall            # Remove the service (auto-detected)

Service mode (auto-detected):
    By default, commands auto-detect which service exists (user or system).
    If both exist, user service is preferred.

    --user    Force user service mode
    --system  Force system service mode (requires sudo)
"""


def _detect_service_mode(prefer_system: bool = False) -> tuple[bool, list[str]]:
    """Detect which service mode to use. Priority: user service > system service.

    Returns:
        Tuple of (is_user_mode, warnings)
    """
    warnings: list[str] = []
    system = platform.system()

    if system == "Linux":
        user_path = Path.home() / ".config" / "systemd" / "user" / "peekview.service"
        system_path = Path("/etc/systemd/system") / "peekview.service"
    elif system == "Darwin":
        user_path = Path.home() / "Library" / "LaunchAgents" / "com.peekview.plist"
        system_path = Path("/Library") / "LaunchDaemons" / "com.peekview.plist"
    else:
        # Unsupported system, default to user mode
        return True, []

    has_user = user_path.exists()
    has_system = system_path.exists()

    if prefer_system:
        if has_system:
            return False, warnings
        warnings.append("System service not found, falling back to user service")
        return True, warnings

    # Default: prefer user service
    if has_user and has_system:
        warnings.append("Both user and system services exist. Using user service (recommended).")
        warnings.append("To use system service, add --system flag")
        return True, warnings

    if has_user:
        return True, warnings

    if has_system:
        return False, warnings

    # Neither exists, default to user mode for install
    return True, warnings


@cli.group(name="service", epilog=SERVICE_EXAMPLES)
def service_cmd():
    """Manage PeekView as a system service (systemd/launchd)."""
    pass


@service_cmd.command(name="install")
@click.option("--user", "user_mode", is_flag=True, help="Install as user service (no sudo needed) [default if neither exists]")
@click.option("--system", "system_mode", is_flag=True, help="Install as system service (requires sudo)")
@click.option("--force", is_flag=True, help="Overwrite existing service")
def install_service(user_mode: bool, system_mode: bool, force: bool) -> None:
    """Install PeekView as a system service.

    Configuration is read from ~/.peekview/config.yaml at runtime.
    Use `peekview config` command to manage settings.
    """
    if user_mode and system_mode:
        click.echo("Error: Cannot use both --user and --system", err=True)
        sys.exit(1)

    # Determine mode
    if system_mode:
        is_user = False
        warnings: list[str] = []
    elif user_mode:
        is_user = True
        warnings = []
    else:
        is_user, warnings = _detect_service_mode(False)

    # Show warnings
    for warning in warnings:
        click.echo(f"⚠ {warning}")
    if warnings:
        click.echo("")

    system = platform.system()

    if system == "Linux":
        _install_systemd_service(is_user, force)
    elif system == "Darwin":
        _install_launchd_service(is_user, force)
    else:
        click.echo(f"Service installation not supported on {system}", err=True)
        sys.exit(1)


def _install_systemd_service(user_mode: bool, force: bool) -> None:
    """Install systemd service on Linux."""
    import getpass

    PeekConfig()
    peekview_path = subprocess.run(["which", "peekview"], capture_output=True, text=True).stdout.strip()

    if not peekview_path:
        click.echo("Error: peekview not found in PATH", err=True)
        sys.exit(1)

    # Build service name and path
    service_name = "peekview.service"
    if user_mode:
        service_path = Path.home() / ".config" / "systemd" / "user" / service_name
        service_path.parent.mkdir(parents=True, exist_ok=True)
    else:
        service_path = Path("/etc/systemd/system") / service_name

    # Check if service exists
    if service_path.exists() and not force:
        click.echo(f"Service already exists: {service_path}", err=True)
        click.echo("Use --force to overwrite")
        sys.exit(1)

    # Get current user for service file
    current_user = getpass.getuser()

    # Create service file - NO environment variables, config is read from file at runtime
    service_content = f"""[Unit]
Description=PeekView - Code & Document Formatting Service
After=network.target

[Service]
Type=simple
User={current_user}
ExecStart={peekview_path} serve
Restart=always
RestartSec=5

[Install]
WantedBy=default.target
"""

    try:
        if user_mode:
            service_path.write_text(service_content)
            subprocess.run(["systemctl", "--user", "daemon-reload"], check=True)
            subprocess.run(["systemctl", "--user", "enable", "peekview"], check=True)
            subprocess.run(["systemctl", "--user", "start", "peekview"], check=True)
            click.echo(f"✓ User service installed: {service_path}")
            click.echo("  Use 'peekview service status' to check status")
            click.echo("  Use 'systemctl --user stop peekview' to stop")
        else:
            # Write to temp file and use sudo
            temp_path = Path("/tmp/peekview.service")
            temp_path.write_text(service_content)
            subprocess.run(["sudo", "cp", str(temp_path), str(service_path)], check=True)
            subprocess.run(["sudo", "systemctl", "daemon-reload"], check=True)
            subprocess.run(["sudo", "systemctl", "enable", "peekview"], check=True)
            subprocess.run(["sudo", "systemctl", "start", "peekview"], check=True)
            click.echo(f"✓ System service installed: {service_path}")
            click.echo("  Use 'peekview service status' to check status")
            click.echo("  Use 'sudo systemctl stop peekview' to stop")
    except subprocess.CalledProcessError as e:
        click.echo(f"Error installing service: {e}", err=True)
        sys.exit(1)


def _install_launchd_service(user_mode: bool, force: bool) -> None:
    """Install launchd service on macOS."""
    import shutil

    plist_name = "com.peekview.plist"

    if user_mode:
        plist_path = Path.home() / "Library" / "LaunchAgents" / plist_name
    else:
        plist_path = Path("/Library/LaunchDaemons") / plist_name

    plist_path.parent.mkdir(parents=True, exist_ok=True)

    # Check if service exists
    if plist_path.exists() and not force:
        click.echo(f"Service already exists: {plist_path}", err=True)
        click.echo("Use --force to overwrite")
        sys.exit(1)

    # Find peekview executable
    peekview_path = shutil.which("peekview")
    if not peekview_path:
        click.echo("Error: peekview not found in PATH", err=True)
        sys.exit(1)

    # Create plist content - NO environment variables, config is read from file at runtime
    plist_content = f"""<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.peekview</string>
    <key>ProgramArguments</key>
    <array>
        <string>{peekview_path}</string>
        <string>serve</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/var/log/peekview.log</string>
    <key>StandardErrorPath</key>
    <string>/var/log/peekview.error.log</string>
</dict>
</plist>
"""

    try:
        plist_path.write_text(plist_content)
        if user_mode:
            subprocess.run(["launchctl", "load", str(plist_path)], check=True)
            click.echo(f"✓ User service installed: {plist_path}")
        else:
            subprocess.run(["sudo", "launchctl", "load", str(plist_path)], check=True)
            click.echo(f"✓ System service installed: {plist_path}")
        click.echo("  Use 'peekview service status' to check status")
    except subprocess.CalledProcessError as e:
        click.echo(f"Error installing service: {e}", err=True)
        sys.exit(1)


@service_cmd.command(name="uninstall")
@click.option("--user", "user_mode", is_flag=True, help="Uninstall user service")
@click.option("--system", "system_mode", is_flag=True, help="Uninstall system service")
def uninstall_service(user_mode: bool, system_mode: bool) -> None:
    """Uninstall the PeekView service."""
    if user_mode and system_mode:
        click.echo("Error: Cannot use both --user and --system", err=True)
        sys.exit(1)

    # Determine mode
    if system_mode:
        is_user = False
        warnings: list[str] = []
    elif user_mode:
        is_user = True
        warnings = []
    else:
        is_user, warnings = _detect_service_mode(False)

    for warning in warnings:
        click.echo(f"⚠ {warning}")

    system = platform.system()

    if system == "Linux":
        _uninstall_systemd_service(is_user)
    elif system == "Darwin":
        _uninstall_launchd_service(is_user)
    else:
        click.echo(f"Service uninstallation not supported on {system}", err=True)
        sys.exit(1)


def _uninstall_systemd_service(user_mode: bool) -> None:
    """Uninstall systemd service."""
    service_name = "peekview"

    try:
        if user_mode:
            service_path = Path.home() / ".config" / "systemd" / "user" / f"{service_name}.service"
            subprocess.run(["systemctl", "--user", "stop", service_name], capture_output=True)
            subprocess.run(["systemctl", "--user", "disable", service_name], capture_output=True)
            if service_path.exists():
                service_path.unlink()
            subprocess.run(["systemctl", "--user", "daemon-reload"], check=True)
        else:
            service_path = Path("/etc/systemd/system") / f"{service_name}.service"
            subprocess.run(["sudo", "systemctl", "stop", service_name], capture_output=True)
            subprocess.run(["sudo", "systemctl", "disable", service_name], capture_output=True)
            if service_path.exists():
                subprocess.run(["sudo", "rm", str(service_path)], check=True)
            subprocess.run(["sudo", "systemctl", "daemon-reload"], check=True)

        click.echo("✓ Service uninstalled")
    except subprocess.CalledProcessError as e:
        click.echo(f"Error uninstalling service: {e}", err=True)
        sys.exit(1)


def _uninstall_launchd_service(user_mode: bool) -> None:
    """Uninstall launchd service."""
    plist_name = "com.peekview.plist"

    if user_mode:
        plist_path = Path.home() / "Library" / "LaunchAgents" / plist_name
    else:
        plist_path = Path("/Library/LaunchDaemons") / plist_name

    try:
        if user_mode:
            subprocess.run(["launchctl", "unload", str(plist_path)], capture_output=True)
        else:
            subprocess.run(["sudo", "launchctl", "unload", str(plist_path)], capture_output=True)

        if plist_path.exists():
            if user_mode:
                plist_path.unlink()
            else:
                subprocess.run(["sudo", "rm", str(plist_path)], check=True)

        click.echo("✓ Service uninstalled")
    except subprocess.CalledProcessError as e:
        click.echo(f"Error uninstalling service: {e}", err=True)
        sys.exit(1)


@service_cmd.command(name="status")
@click.option("--user", "user_mode", is_flag=True, help="Check user service status")
@click.option("--system", "system_mode", is_flag=True, help="Check system service status")
def service_status(user_mode: bool, system_mode: bool) -> None:
    """Check the service status."""
    if user_mode and system_mode:
        click.echo("Error: Cannot use both --user and --system", err=True)
        sys.exit(1)

    # Determine mode
    if system_mode:
        is_user = False
        warnings: list[str] = []
    elif user_mode:
        is_user = True
        warnings = []
    else:
        is_user, warnings = _detect_service_mode(False)

    for warning in warnings:
        click.echo(f"⚠ {warning}")
    if warnings:
        click.echo("")

    system = platform.system()

    if system == "Linux":
        try:
            if is_user:
                result = subprocess.run(
                    ["systemctl", "--user", "status", "peekview"],
                    capture_output=True, text=True
                )
            else:
                result = subprocess.run(
                    ["systemctl", "status", "peekview"],
                    capture_output=True, text=True
                )
            click.echo(result.stdout if result.stdout else result.stderr)
        except subprocess.CalledProcessError as e:
            click.echo(e.output if e.output else "Service not found or not running")
    elif system == "Darwin":
        try:
            result = subprocess.run(
                ["launchctl", "list", "com.peekview"],
                capture_output=True, text=True
            )
            click.echo(result.stdout if result.stdout else "Service not loaded")
        except subprocess.CalledProcessError:
            click.echo("Service not found or not running")
    else:
        click.echo(f"Service status check not supported on {system}")


@service_cmd.command(name="start")
@click.option("--user", "user_mode", is_flag=True, help="Start user service")
@click.option("--system", "system_mode", is_flag=True, help="Start system service")
def start_service(user_mode: bool, system_mode: bool) -> None:
    """Start the service."""
    if user_mode and system_mode:
        click.echo("Error: Cannot use both --user and --system", err=True)
        sys.exit(1)

    # Determine mode
    if system_mode:
        is_user = False
        warnings: list[str] = []
    elif user_mode:
        is_user = True
        warnings = []
    else:
        is_user, warnings = _detect_service_mode(False)

    for warning in warnings:
        click.echo(f"⚠ {warning}")

    system = platform.system()

    if system == "Linux":
        try:
            if is_user:
                subprocess.run(["systemctl", "--user", "start", "peekview"], check=True)
            else:
                subprocess.run(["sudo", "systemctl", "start", "peekview"], check=True)
            click.echo("✓ Service started")
        except subprocess.CalledProcessError as e:
            click.echo(f"Error starting service: {e}", err=True)
            sys.exit(1)
    elif system == "Darwin":
        plist_path = Path.home() / "Library" / "LaunchAgents" / "com.peekview.plist"
        if not is_user:
            plist_path = Path("/Library/LaunchDaemons") / "com.peekview.plist"
        try:
            if is_user:
                subprocess.run(["launchctl", "load", str(plist_path)], check=True)
            else:
                subprocess.run(["sudo", "launchctl", "load", str(plist_path)], check=True)
            click.echo("✓ Service started")
        except subprocess.CalledProcessError as e:
            click.echo(f"Error starting service: {e}", err=True)
            sys.exit(1)
    else:
        click.echo(f"Service start not supported on {system}", err=True)
        sys.exit(1)


@service_cmd.command(name="stop")
@click.option("--user", "user_mode", is_flag=True, help="Stop user service")
@click.option("--system", "system_mode", is_flag=True, help="Stop system service")
def stop_service(user_mode: bool, system_mode: bool) -> None:
    """Stop the service."""
    if user_mode and system_mode:
        click.echo("Error: Cannot use both --user and --system", err=True)
        sys.exit(1)

    # Determine mode
    if system_mode:
        is_user = False
        warnings: list[str] = []
    elif user_mode:
        is_user = True
        warnings = []
    else:
        is_user, warnings = _detect_service_mode(False)

    for warning in warnings:
        click.echo(f"⚠ {warning}")

    system = platform.system()

    if system == "Linux":
        try:
            if is_user:
                subprocess.run(["systemctl", "--user", "stop", "peekview"], check=True)
            else:
                subprocess.run(["sudo", "systemctl", "stop", "peekview"], check=True)
            click.echo("✓ Service stopped")
        except subprocess.CalledProcessError as e:
            click.echo(f"Error stopping service: {e}", err=True)
            sys.exit(1)
    elif system == "Darwin":
        try:
            if is_user:
                subprocess.run(["launchctl", "unload", "com.peekview"], check=True)
            else:
                subprocess.run(["sudo", "launchctl", "unload", "com.peekview"], check=True)
            click.echo("✓ Service stopped")
        except subprocess.CalledProcessError as e:
            click.echo(f"Error stopping service: {e}", err=True)
            sys.exit(1)
    else:
        click.echo(f"Service stop not supported on {system}", err=True)
        sys.exit(1)


@service_cmd.command(name="restart")
@click.option("--user", "user_mode", is_flag=True, help="Restart user service")
@click.option("--system", "system_mode", is_flag=True, help="Restart system service")
def restart_service(user_mode: bool, system_mode: bool) -> None:
    """Restart the service."""
    if user_mode and system_mode:
        click.echo("Error: Cannot use both --user and --system", err=True)
        sys.exit(1)

    # Determine mode
    if system_mode:
        is_user = False
        warnings: list[str] = []
    elif user_mode:
        is_user = True
        warnings = []
    else:
        is_user, warnings = _detect_service_mode(False)

    for warning in warnings:
        click.echo(f"⚠ {warning}")

    system = platform.system()

    if system == "Linux":
        try:
            if is_user:
                subprocess.run(["systemctl", "--user", "restart", "peekview"], check=True)
            else:
                subprocess.run(["sudo", "systemctl", "restart", "peekview"], check=True)
            click.echo("✓ Service restarted")
        except subprocess.CalledProcessError as e:
            click.echo(f"Error restarting service: {e}", err=True)
            sys.exit(1)
    elif system == "Darwin":
        plist_path = Path.home() / "Library" / "LaunchAgents" / "com.peekview.plist"
        if not is_user:
            plist_path = Path("/Library/LaunchDaemons") / "com.peekview.plist"
        try:
            # Darwin doesn't have restart, use stop then start
            if is_user:
                subprocess.run(["launchctl", "unload", str(plist_path)], check=True)
                subprocess.run(["launchctl", "load", str(plist_path)], check=True)
            else:
                subprocess.run(["sudo", "launchctl", "unload", str(plist_path)], check=True)
                subprocess.run(["sudo", "launchctl", "load", str(plist_path)], check=True)
            click.echo("✓ Service restarted")
        except subprocess.CalledProcessError as e:
            click.echo(f"Error restarting service: {e}", err=True)
            sys.exit(1)
    else:
        click.echo(f"Service restart not supported on {system}", err=True)
        sys.exit(1)


@cli.group(name="user")
def user_cmd():
    """Manage PeekView users.

    Examples:
        peekview user create alice       # Create user (interactive password)
        peekview user create bob -p pass # Create user with password
        peekview user list               # List users
    """
    pass


@user_cmd.command(name="create")
@click.argument("username")
@click.option("--password", "-p", default=None, help="User password (interactive if not provided)")
@click.option("--admin", is_flag=True, default=False, help="Create as admin user")
def user_create(username: str, password: str | None, admin: bool) -> None:
    """Create a new user (local database only).

    First user is always allowed. Creates user directly in local database.
    """
    from peekview.auth import hash_password
    from peekview.models import RESERVED_USERNAMES

    # Validate username
    if username.lower() in RESERVED_USERNAMES:
        click.echo(f"Error: Username '{username}' is reserved", err=True)
        sys.exit(1)
    if len(username) < 3 or len(username) > 32:
        click.echo("Error: Username must be 3-32 characters", err=True)
        sys.exit(1)
    if not re.match(r"^[a-zA-Z0-9_-]+$", username):
        click.echo("Error: Username must contain only letters, digits, underscores, and hyphens", err=True)
        sys.exit(1)

    # Get password
    if password is None:
        password = click.prompt("Password", hide_input=True)
        confirm = click.prompt("Confirm password", hide_input=True)
        if password != confirm:
            click.echo("Error: Passwords do not match", err=True)
            sys.exit(1)

    if len(password) < 8:
        click.echo("Error: Password must be at least 8 characters", err=True)
        sys.exit(1)

    config = PeekConfig()
    config.ensure_directories()
    engine = init_db(config.db_path)
    check_schema(engine)

    password_hash = hash_password(password)
    # First user is automatically admin
    with Session(engine) as session:
        is_first = session.exec(select(User)).first() is None
    is_admin = admin or is_first

    user = User(username=username, password_hash=password_hash, is_admin=is_admin)

    try:
        with Session(engine) as session:
            session.add(user)
            session.commit()
            session.refresh(user)
        admin_label = " [admin]" if is_admin else ""
        click.echo(f"✓ Created user: {username} (id={user.id}){admin_label}")
    except IntegrityError:
        click.echo(f"Error: Username '{username}' already exists", err=True)
        sys.exit(1)


@user_cmd.command(name="list")
def user_list() -> None:
    """List all users (local database only)."""
    config = PeekConfig()
    engine = init_db(config.db_path)
    check_schema(engine)

    with Session(engine) as session:
        users = session.exec(select(User)).all()

    if not users:
        click.echo("No users found")
        return

    click.echo(f"Users ({len(users)}):")
    for u in users:
        flags = []
        if u.is_admin:
            flags.append("admin")
        if not u.is_active:
            flags.append("disabled")
        status = ", ".join(flags) if flags else "active"
        click.echo(f"  {u.username} (id={u.id}) [{status}]")


@user_cmd.command(name="promote")
@click.argument("username")
def user_promote(username: str) -> None:
    """Promote user to admin."""
    config = PeekConfig()
    engine = init_db(config.db_path)
    check_schema(engine)

    with Session(engine) as session:
        user = session.exec(select(User).where(User.username == username)).first()
        if not user:
            click.echo(f"Error: User '{username}' not found", err=True)
            sys.exit(1)
        if user.is_admin:
            click.echo(f"User '{username}' is already admin")
            return
        user.is_admin = True
        session.add(user)
        session.commit()
    click.echo(f"✓ Promoted {username} to admin")


@user_cmd.command(name="demote")
@click.argument("username")
def user_demote(username: str) -> None:
    """Demote user from admin."""
    config = PeekConfig()
    engine = init_db(config.db_path)
    check_schema(engine)

    with Session(engine) as session:
        user = session.exec(select(User).where(User.username == username)).first()
        if not user:
            click.echo(f"Error: User '{username}' not found", err=True)
            sys.exit(1)
        if not user.is_admin:
            click.echo(f"User '{username}' is not admin")
            return
        user.is_admin = False
        session.add(user)
        session.commit()
    click.echo(f"✓ Demoted {username} from admin")


@user_cmd.command(name="delete")
@click.argument("username")
@click.option("--remote-url", "-r", default=None, help="Remote server URL")
@click.confirmation_option(prompt="Are you sure you want to delete this user?")
def user_delete(username: str, remote_url: str | None) -> None:
    """Delete a user and all their data."""
    config = PeekConfig()
    backend = _get_backend(config, cli_remote_url=remote_url)
    is_remote = _is_remote_mode(backend)

    if is_remote:
        click.echo(f"→ Remote mode: {remote_url or config.remote.url}")
        try:
            users = backend.list_users(username=username)
            if not users:
                click.echo(f"Error: User '{username}' not found", err=True)
                sys.exit(1)
            user_id = users[0]["id"]
            backend.delete_user(user_id)
            click.echo(f"✓ Deleted user: {username}")
        except Exception as e:
            click.echo(f"Error: {e}", err=True)
            sys.exit(1)
    else:
        config.ensure_directories()
        engine = init_db(config.db_path)
        check_schema(engine)
        storage = StorageManager(config=config)
        admin_svc = AdminService(engine=engine, storage=storage, config=config)

        with Session(engine) as session:
            user = session.exec(select(User).where(User.username == username)).first()
            if not user:
                click.echo(f"Error: User '{username}' not found", err=True)
                sys.exit(1)
            user_id = user.id

        try:
            admin_svc.delete_user(user_id=user_id, current_user_id=-1)
            click.echo(f"✓ Deleted user: {username}")
        except ValueError as e:
            click.echo(f"Error: {e}", err=True)
            sys.exit(1)


@user_cmd.command(name="reset-password")
@click.argument("username")
@click.option("--remote-url", "-r", default=None, help="Remote server URL")
def user_reset_password(username: str, remote_url: str | None) -> None:
    """Reset a user's password."""
    config = PeekConfig()
    backend = _get_backend(config, cli_remote_url=remote_url)
    is_remote = _is_remote_mode(backend)

    if is_remote:
        click.echo(f"→ Remote mode: {remote_url or config.remote.url}")
        try:
            users = backend.list_users(username=username)
            if not users:
                click.echo(f"Error: User '{username}' not found", err=True)
                sys.exit(1)
            user_id = users[0]["id"]
            new_password = click.prompt("New password", hide_input=True)
            confirm = click.prompt("Confirm new password", hide_input=True)
            if new_password != confirm:
                click.echo("Error: Passwords do not match", err=True)
                sys.exit(1)
            if len(new_password) < 8:
                click.echo("Error: Password must be at least 8 characters", err=True)
                sys.exit(1)
            result = backend.reset_user_password(user_id, new_password)
            click.echo(f"✓ Password reset for {username}")
            if "new_password" in result:
                click.echo(f"  New password: {result['new_password']}")
        except Exception as e:
            click.echo(f"Error: {e}", err=True)
            sys.exit(1)
    else:
        config.ensure_directories()
        engine = init_db(config.db_path)
        check_schema(engine)
        storage = StorageManager(config=config)
        admin_svc = AdminService(engine=engine, storage=storage, config=config)

        with Session(engine) as session:
            user = session.exec(select(User).where(User.username == username)).first()
            if not user:
                click.echo(f"Error: User '{username}' not found", err=True)
                sys.exit(1)
            user_id = user.id

        new_password = click.prompt("New password", hide_input=True)
        confirm = click.prompt("Confirm new password", hide_input=True)
        if new_password != confirm:
            click.echo("Error: Passwords do not match", err=True)
            sys.exit(1)
        if len(new_password) < 8:
            click.echo("Error: Password must be at least 8 characters", err=True)
            sys.exit(1)
        admin_svc.reset_password(user_id=user_id, new_password=new_password)
        click.echo(f"✓ Password reset for {username}")


@user_cmd.command(name="change-password")
@click.option("--remote-url", "-r", default=None, help="Remote server URL (required)")
def user_change_password(remote_url: str | None) -> None:
    """Change your own password (remote mode only)."""
    config = PeekConfig()
    backend = _get_backend(config, cli_remote_url=remote_url)
    is_remote = _is_remote_mode(backend)

    if not is_remote:
        click.echo("Error: change-password only supports remote mode", err=True)
        sys.exit(1)

    click.echo(f"→ Remote mode: {remote_url or config.remote.url}")

    old_password = click.prompt("Old password", hide_input=True)
    new_password = click.prompt("New password", hide_input=True)
    confirm = click.prompt("Confirm new password", hide_input=True)
    if new_password != confirm:
        click.echo("Error: Passwords do not match", err=True)
        sys.exit(1)
    if len(new_password) < 8:
        click.echo("Error: Password must be at least 8 characters", err=True)
        sys.exit(1)

    try:
        backend.change_password(old_password=old_password, new_password=new_password)
        click.echo("✓ Password changed")
    except Exception as e:
        click.echo(f"Error: {e}", err=True)
        sys.exit(1)


@cli.command()
@click.option("--remote-url", "-r", required=True, help="Remote server URL")
@click.option("--username", "-u", default=None, help="Username (prompted if not provided)")
@click.option("--password", "-p", default=None, help="Password (prompted if not provided)")
def login(remote_url: str, username: str | None, password: str | None) -> None:
    """Login to a remote PeekView server.

    Stores JWT token in config file for subsequent remote CLI operations.
    """
    from peekview.config import load_config_file, save_config_file

    if username is None:
        username = click.prompt("Username")
    if password is None:
        password = click.prompt("Password", hide_input=True)

    client = PeekClient(base_url=remote_url)

    try:
        result = client.login(username, password)
        token = result["access_token"]

        # Save token to config
        config_data = load_config_file()
        if "remote" not in config_data:
            config_data["remote"] = {}
        config_data["remote"]["url"] = remote_url
        config_data["remote"]["token"] = token
        save_config_file(config_data)

        user_info = result["user"]
        click.echo(f"✓ Logged in as: {user_info['username']}")
        click.echo("  Token saved to config")
        click.echo("  Tip: Use 'peekview apikey create <name>' to create an API key")
    except Exception as e:
        click.echo(f"Error: Login failed - {e}", err=True)
        sys.exit(1)


@cli.command()
@click.option("--remote-url", "-r", default=None, help="Remote server URL")
def whoami(remote_url: str | None) -> None:
    """Show current user info (remote mode only)."""
    config = PeekConfig()
    backend = _get_backend(config, cli_remote_url=remote_url)

    if not _is_remote_mode(backend):
        click.echo("Error: whoami only supports remote mode", err=True)
        sys.exit(1)

    click.echo(f"→ Remote mode: {remote_url or config.remote.url}")

    try:
        info = backend.whoami()
        click.echo(f"Username:  {info.get('username', 'N/A')}")
        click.echo(f"Admin:     {'Yes' if info.get('is_admin') else 'No'}")
        click.echo(f"Created:   {info.get('created_at', 'N/A')}")
    except Exception as e:
        click.echo(f"Error: {e}", err=True)
        sys.exit(1)


APIKEY_EXAMPLES = """
\b
Examples:

    peekview apikey create "CI Bot"

    peekview apikey create "Temp" --expires 30d

    peekview apikey list

    peekview apikey revoke 3

    peekview apikey cleanup
"""


@cli.group(name="apikey", epilog=APIKEY_EXAMPLES)
def apikey_cmd():
    """Manage API keys."""
    pass


@apikey_cmd.command(name="create")
@click.argument("name")
@click.option("--expires", "-e", default=None, help="Expiration (e.g., '7d', '30d', '90d')")
@click.option("--remote-url", "-r", default=None, help="Remote server URL")
@click.option("--user", "-u", default=None, help="Username (required in local mode)")
def apikey_create(name: str, expires: str | None, remote_url: str | None, user: str | None) -> None:
    """Create a new API key.

    The full key is shown only once — save it securely.
    """
    config = PeekConfig()
    backend = _get_backend(config, cli_remote_url=remote_url)

    if _is_remote_mode(backend):
        click.echo(f"→ Remote mode: {remote_url or config.remote.url}")
        try:
            result = backend.create_api_key(name=name, expires_in=expires)
            click.echo(f"✓ Created API key: {name}")
            click.echo(f"  Key: {result['key']}")
            click.echo(f"  Prefix: {result['key_prefix']}")
            click.echo(f"  Expires: {result['expires_at'] or 'Never'}")
            click.echo()
            click.echo("  ⚠ Save this key now — it won't be shown again!")
        except Exception as e:
            click.echo(f"Error: {e}", err=True)
            sys.exit(1)
    else:
        if not user:
            click.echo("Error: --user <username> is required in local mode", err=True)
            sys.exit(1)
        db_user = _resolve_user_local(config, user)
        svc = _get_apikey_service_local(config)
        try:
            result = svc.create_api_key(user_id=db_user.id, name=name, expires_in=expires)
            click.echo(f"✓ Created API key: {name}")
            click.echo(f"  Key: {result.key}")
            click.echo(f"  Prefix: {result.key_prefix}")
            click.echo(f"  Expires: {result.expires_at or 'Never'}")
            click.echo()
            click.echo("  ⚠ Save this key now — it won't be shown again!")
        except Exception as e:
            click.echo(f"Error: {e}", err=True)
            sys.exit(1)


@apikey_cmd.command(name="list")
@click.option("--remote-url", "-r", default=None, help="Remote server URL")
@click.option("--user", "-u", default=None, help="Username (required in local mode)")
def apikey_list(remote_url: str | None, user: str | None) -> None:
    """List API keys."""
    config = PeekConfig()
    backend = _get_backend(config, cli_remote_url=remote_url)

    if _is_remote_mode(backend):
        click.echo(f"→ Remote mode: {remote_url or config.remote.url}")
        try:
            result = backend.list_api_keys()
            items = result.get("items", [])
            if not items:
                click.echo("No API keys found")
                return
            click.echo(f"API Keys ({len(items)}):")
            click.echo()
            for k in items:
                expires = k.get("expires_at", "Never") or "Never"
                last_used = k.get("last_used_at", "Never") or "Never"
                click.echo(f"  [{k['id']}] {k['name']}")
                click.echo(f"      Prefix: {k['key_prefix']}")
                click.echo(f"      Expires: {expires}")
                click.echo(f"      Last used: {last_used}")
                click.echo(f"      Created: {k['created_at']}")
                click.echo()
        except Exception as e:
            click.echo(f"Error: {e}", err=True)
            sys.exit(1)
    else:
        if not user:
            click.echo("Error: --user <username> is required in local mode", err=True)
            sys.exit(1)
        db_user = _resolve_user_local(config, user)
        svc = _get_apikey_service_local(config)
        try:
            items = svc.list_api_keys(user_id=db_user.id)
            if not items:
                click.echo("No API keys found")
                return
            click.echo(f"API Keys ({len(items)}):")
            click.echo()
            for k in items:
                click.echo(f"  [{k.id}] {k.name}")
                click.echo(f"      Prefix: {k.key_prefix}")
                click.echo(f"      Expires: {k.expires_at or 'Never'}")
                click.echo(f"      Created: {k.created_at}")
                click.echo()
        except Exception as e:
            click.echo(f"Error: {e}", err=True)
            sys.exit(1)


@apikey_cmd.command(name="revoke")
@click.argument("key_id", type=int)
@click.option("--remote-url", "-r", default=None, help="Remote server URL")
@click.option("--user", "-u", default=None, help="Username (required in local mode)")
@click.confirmation_option(prompt="Are you sure you want to revoke this API key?")
def apikey_revoke(key_id: int, remote_url: str | None, user: str | None) -> None:
    """Revoke an API key by ID."""
    config = PeekConfig()
    backend = _get_backend(config, cli_remote_url=remote_url)

    if _is_remote_mode(backend):
        click.echo(f"→ Remote mode: {remote_url or config.remote.url}")
        try:
            backend.revoke_api_key(key_id)
            click.echo(f"✓ Revoked API key: {key_id}")
        except Exception as e:
            click.echo(f"Error: {e}", err=True)
            sys.exit(1)
    else:
        if not user:
            click.echo("Error: --user <username> is required in local mode", err=True)
            sys.exit(1)
        db_user = _resolve_user_local(config, user)
        svc = _get_apikey_service_local(config)
        try:
            svc.revoke_api_key(key_id=key_id, user_id=db_user.id)
            click.echo(f"✓ Revoked API key: {key_id}")
        except Exception as e:
            click.echo(f"Error: {e}", err=True)
            sys.exit(1)


@apikey_cmd.command(name="cleanup")
@click.option("--remote-url", "-r", default=None, help="Remote server URL")
@click.option("--user", "-u", default=None, help="Username (required in local mode)")
def apikey_cleanup(remote_url: str | None, user: str | None) -> None:
    """Delete all expired API keys."""
    config = PeekConfig()
    backend = _get_backend(config, cli_remote_url=remote_url)

    if _is_remote_mode(backend):
        click.echo(f"→ Remote mode: {remote_url or config.remote.url}")
        try:
            result = backend.cleanup_expired_keys()
            click.echo(f"✓ Cleaned up {result['deleted']} expired key(s)")
        except Exception as e:
            click.echo(f"Error: {e}", err=True)
            sys.exit(1)
    else:
        if not user:
            click.echo("Error: --user <username> is required in local mode", err=True)
            sys.exit(1)
        db_user = _resolve_user_local(config, user)
        svc = _get_apikey_service_local(config)
        try:
            deleted = svc.cleanup_expired_keys(user_id=db_user.id)
            click.echo(f"✓ Cleaned up {deleted} expired key(s)")
        except Exception as e:
            click.echo(f"Error: {e}", err=True)
            sys.exit(1)



def _resolve_user_local(config: PeekConfig, username: str) -> "User":
    """Local mode: resolve username → User. Exits with error if not found."""
    engine = init_db(config.db_path)
    check_schema(engine)
    with Session(engine) as session:
        user = session.exec(select(User).where(User.username == username)).first()
        if not user:
            click.echo(f"Error: User '{username}' not found", err=True)
            sys.exit(1)
        return user


def _get_apikey_service_local(config: PeekConfig) -> ApiKeyService:
    """Local mode: return ApiKeyService instance."""
    engine = init_db(config.db_path)
    check_schema(engine)
    return ApiKeyService(engine=engine)

def _get_admin_service(
    config: PeekConfig, cli_remote_url: str | None = None
) -> AdminService | PeekClient:
    if cli_remote_url is not None:
        remote_url = cli_remote_url
    elif "PEEKVIEW_REMOTE__URL" in os.environ:
        remote_url = os.environ["PEEKVIEW_REMOTE__URL"]
    else:
        remote_url = config.remote.url

    if remote_url:
        return PeekClient(
            base_url=remote_url,
            api_key=config.remote.api_key,
            token=config.remote.token,
            timeout=config.remote.timeout,
            verify_ssl=config.remote.verify_ssl,
        )

    engine = init_db(config.db_path)
    check_schema(engine)
    storage = StorageManager(config=config)
    return AdminService(engine=engine, storage=storage, config=config)


@cli.group(name="admin")
def admin_cmd():
    """Admin operations (requires admin privileges)."""
    pass


@admin_cmd.command(name="stats")
@click.option("--remote-url", "-r", default=None, help="Remote server URL")
@click.option("--json-output", "-j", is_flag=True, help="Output as JSON")
def admin_stats(remote_url: str | None, json_output: bool) -> None:
    """Show system statistics."""
    config = PeekConfig()
    backend = _get_admin_service(config, cli_remote_url=remote_url)
    is_remote = isinstance(backend, PeekClient)

    if is_remote and not json_output:
        click.echo(f"→ Remote mode: {remote_url or config.remote.url}")

    try:
        result = backend.admin_stats() if is_remote else backend.get_stats()

        if json_output:
            if isinstance(result, AdminStatsResponse):
                data = {
                    "users": result.users,
                    "entries": {
                        "total": result.entries.total,
                        "public": result.entries.public,
                        "private": result.entries.private,
                        "expired": result.entries.expired,
                        "active": result.entries.active,
                        "latest_created_at": result.entries.latest_created_at.isoformat() if result.entries.latest_created_at else None,
                    },
                    "api_keys": {
                        "total": result.api_keys.total,
                        "expired": result.api_keys.expired,
                    },
                    "storage": {
                        "data_dir_mb": result.storage.data_dir_mb,
                        "db_mb": result.storage.db_mb,
                    },
                }
            else:
                data = result
            click.echo(json.dumps(data, indent=2, default=str))
        else:
            if isinstance(result, AdminStatsResponse):
                entries = result.entries
                api_keys = result.api_keys
                storage = result.storage
                click.echo("PeekView Admin Stats")
                click.echo("─" * 30)
                click.echo(f"Users:        {result.users}")
                click.echo("Entries:")
                click.echo(f"  Total:      {entries.total}")
                click.echo(f"  Public:     {entries.public}")
                click.echo(f"  Private:    {entries.private}")
                click.echo(f"  Expired:    {entries.expired}")
                click.echo(f"  Active:     {entries.active}")
                if entries.latest_created_at:
                    click.echo(f"  Latest:     {entries.latest_created_at.isoformat()}")
                click.echo("API Keys:")
                click.echo(f"  Total:      {api_keys.total}")
                click.echo(f"  Expired:    {api_keys.expired}")
                click.echo("Storage:")
                click.echo(f"  Data Dir:   {storage.data_dir_mb} MB")
                click.echo(f"  Database:   {storage.db_mb} MB")
            else:
                entries = result.get("entries", {})
                api_keys = result.get("api_keys", {})
                storage = result.get("storage", {})
                click.echo("PeekView Admin Stats")
                click.echo("─" * 30)
                click.echo(f"Users:        {result.get('users', 0)}")
                click.echo("Entries:")
                click.echo(f"  Total:      {entries.get('total', 0)}")
                click.echo(f"  Public:     {entries.get('public', 0)}")
                click.echo(f"  Private:    {entries.get('private', 0)}")
                click.echo(f"  Expired:    {entries.get('expired', 0)}")
                click.echo(f"  Active:     {entries.get('active', 0)}")
                click.echo("API Keys:")
                click.echo(f"  Total:      {api_keys.get('total', 0)}")
                click.echo(f"  Expired:    {api_keys.get('expired', 0)}")
                click.echo("Storage:")
                click.echo(f"  Data Dir:   {storage.get('data_dir_mb', 0)} MB")
                click.echo(f"  Database:   {storage.get('db_mb', 0)} MB")

    except Exception as e:
        click.echo(f"Error: {e}", err=True)
        sys.exit(1)


@admin_cmd.command(name="cleanup")
@click.option("--remote-url", "-r", default=None, help="Remote server URL")
@click.option("--json-output", "-j", is_flag=True, help="Output as JSON")
def admin_cleanup(remote_url: str | None, json_output: bool) -> None:
    """Cleanup expired entries."""
    config = PeekConfig()
    backend = _get_admin_service(config, cli_remote_url=remote_url)
    is_remote = isinstance(backend, PeekClient)

    if is_remote and not json_output:
        click.echo(f"→ Remote mode: {remote_url or config.remote.url}")

    try:
        result = backend.admin_cleanup() if is_remote else backend.cleanup_expired()

        if json_output:
            if isinstance(result, AdminCleanupResponse):
                data = {
                    "archived_count": result.archived_count,
                    "archived_slugs": result.archived_slugs,
                    "deleted_count": result.deleted_count,
                    "deleted_slugs": result.deleted_slugs,
                    "freed_mb": result.freed_mb,
                }
            else:
                data = result
            click.echo(json.dumps(data, indent=2))
        else:
            if isinstance(result, AdminCleanupResponse):
                if result.archived_count:
                    click.echo(f"  Archived: {result.archived_count} entry(ies)")
                    if result.archived_slugs:
                        click.echo(f"  Archived: {', '.join(result.archived_slugs)}")
                if result.deleted_count:
                    click.echo(f"  Deleted: {result.deleted_count} entry(ies), freed {result.freed_mb} MB")
                    if result.deleted_slugs:
                        click.echo(f"  Deleted: {', '.join(result.deleted_slugs)}")
                if not result.archived_count and not result.deleted_count:
                    click.echo("No expired entries found")
            else:
                count = result.get("deleted_count", 0)
                freed = result.get("freed_mb", 0)
                slugs = result.get("deleted_slugs", [])
                click.echo(f"Cleaned up {count} expired entry(ies), freed {freed} MB")
                if slugs:
                    click.echo(f"  Deleted: {', '.join(slugs)}")

    except Exception as e:
        click.echo(f"Error: {e}", err=True)
        sys.exit(1)


@admin_cmd.command(name="backup")
@click.option("--output", "-o", default=None, help="Output path for backup tar.gz (default: peekview-backup-YYYYMMDD-HHMMSS.tar.gz in CWD)")
def admin_backup(output: str | None) -> None:
    """Create a full backup of PeekView data (DB + files + config + secrets)."""
    config = PeekConfig()
    backend = _get_admin_service(config)

    if isinstance(backend, PeekClient):
        click.echo("Error: backup does not support remote mode", err=True)
        sys.exit(1)

    try:
        output_path = Path(output) if output else None
        if output_path and not output_path.parent.exists():
            click.echo(f"Error: Output directory not found: {output_path.parent}", err=True)
            sys.exit(1)
        result_path = backend.backup(output_path=output_path)
        click.echo(str(result_path))
    except FileNotFoundError as e:
        click.echo(f"Error: Path not found: {e}", err=True)
        sys.exit(1)
    except OSError as e:
        click.echo(f"Error: {e}", err=True)
        sys.exit(1)
    except Exception as e:
        click.echo(f"Error: {e}", err=True)
        sys.exit(1)


@admin_cmd.command(name="export")
@click.option("--slug", "-s", required=True, help="Entry slug to export")
@click.option("--format", "-f", "fmt", type=click.Choice(["json", "zip"]), default="json", help="Export format (default: json)")
@click.option("--output", "-o", default=None, help="Output path (for zip format; default: {slug}.zip in CWD)")
def admin_export(slug: str, fmt: str, output: str | None) -> None:
    """Export a single entry to JSON or ZIP format."""
    config = PeekConfig()
    backend = _get_admin_service(config)

    if isinstance(backend, PeekClient):
        click.echo("Error: export does not support remote mode", err=True)
        sys.exit(1)

    try:
        output_path = Path(output) if output else None
        result = backend.export_entry(slug=slug, fmt=fmt, output_path=output_path)
        if isinstance(result, Path):
            click.echo(str(result))
        else:
            click.echo(result)
    except NotFoundError as e:
        click.echo(f"Error: {e}", err=True)
        sys.exit(1)
    except Exception as e:
        click.echo(f"Error: {e}", err=True)
        sys.exit(1)


@admin_cmd.command(name="restore")
@click.argument("backup_file")
@click.option("--dry-run", is_flag=True, help="Preview restore without modifying data")
@click.option("--replace", is_flag=True, help="Replace all target data with backup (destructive)")
@click.option("--yes", "-y", is_flag=True, help="Skip confirmation prompt for replace mode")
def admin_restore(backup_file: str, dry_run: bool, replace: bool, yes: bool) -> None:
    """Restore PeekView data from a backup tar.gz file."""
    config = PeekConfig()
    backend = _get_admin_service(config)

    if isinstance(backend, PeekClient):
        click.echo("Error: restore does not support remote mode", err=True)
        sys.exit(1)

    backup_path = Path(backup_file)
    if not backup_path.exists():
        click.echo(f"Error: Backup file not found: {backup_file}", err=True)
        sys.exit(1)

    if replace and not yes:
        click.echo("WARNING: Replace mode will DELETE ALL existing data and replace with backup contents.")
        confirm = input("Type 'yes' to confirm: ")
        if confirm.strip().lower() != "yes":
            click.echo("Restore cancelled.")
            return

    try:
        result = backend.restore(
            backup_path=backup_path,
            dry_run=dry_run,
            replace=replace,
            yes=yes,
        )

        if isinstance(result, RestorePreview):
            click.echo("Dry-run preview:")
            click.echo(f"  entry_count:  {result.entry_count}")
            click.echo(f"  user_count:   {result.user_count}")
            click.echo(f"  api_key_count: {result.api_key_count}")
            click.echo(f"  share_count:  {result.share_count}")
            click.echo(f"  read_count:   {result.read_count}")
            if result.conflicts:
                click.echo(f"  conflicts:    {len(result.conflicts)}")
                for c in result.conflicts:
                    click.echo(f"    - {c.type}: {c.value}")
            else:
                click.echo("  conflicts:    none")
            click.echo(f"  version_check: {result.version_check}")
        else:
            if result.version_check == "downgrade_warning":
                click.echo("Warning: Backup is from a lower version. Some features may not work as expected.")
            if result.entries_imported > 0 or result.users_imported > 0:
                click.echo("Restore completed:")
                click.echo(f"  Users imported:     {result.users_imported}")
                click.echo(f"  Entries imported:   {result.entries_imported}")
                click.echo(f"  Files imported:     {result.files_imported}")
                click.echo(f"  API keys imported:  {result.api_keys_imported}")
                click.echo(f"  Shares imported:    {result.shares_imported}")
                click.echo(f"  Reads imported:     {result.reads_imported}")
                click.echo(f"  Conflicts resolved: {result.conflicts_resolved}")
                click.echo(f"  FTS rebuilt:        {result.fts_rebuilt}")
            else:
                click.echo("Restore completed: no new data imported")

    except ValueError as e:
        error_msg = str(e).lower()
        if "version" in error_msg or "incompat" in error_msg:
            click.echo(f"Error: {e}", err=True)
            click.echo("No changes were made to the database (rollback/transaction intact).", err=True)
        elif "checksum" in error_msg or "integrity" in error_msg or "corrupt" in error_msg:
            click.echo(f"Error: {e}", err=True)
        else:
            click.echo(f"Error: {e}", err=True)
        sys.exit(1)
    except Exception as e:
        click.echo(f"Error: {e}", err=True)
        click.echo("No changes were made to the database (rollback/transaction intact).", err=True)
        sys.exit(1)


@cli.group(name="api")
def api_cmd():
    """Show API documentation and endpoints.

    Examples:
        peekview api              # Show API overview
        peekview api --endpoints  # List all API endpoints
        peekview api --openapi    # Show OpenAPI schema URL
    """
    pass


@api_cmd.command(name="endpoints")
@click.option("--base-url", "-b", default=None, help="Base URL (e.g., http://localhost:8080)")
def api_endpoints(base_url: str | None) -> None:
    """List all REST API endpoints."""
    config = PeekConfig()
    url = base_url or config.server.base_url or f"http://{config.server.host}:{config.server.port}"

    click.echo(f"API Base URL: {url}")
    click.echo("")
    click.echo("Health Check:")
    click.echo(f"  GET    {url}/health")
    click.echo("")
    click.echo("Entries API:")
    click.echo(f"  POST   {url}/api/v1/entries        - Create new entry")
    click.echo(f"  GET    {url}/api/v1/entries        - List entries (with search/filter)")
    click.echo(f"  GET    {url}/api/v1/entries/<slug> - Get entry details")
    click.echo(f"  PATCH  {url}/api/v1/entries/<slug> - Update entry")
    click.echo(f"  DELETE {url}/api/v1/entries/<slug> - Delete entry")
    click.echo("")
    click.echo("Files API:")
    click.echo(f"  GET    {url}/api/v1/entries/<slug>/files/<file_id> - Download file")
    click.echo(f"  GET    {url}/api/v1/entries/<slug>/files/<file_id>/content - Get file content")
    click.echo(f"  GET    {url}/api/v1/entries/<slug>/download - Download entry as ZIP pack")
    click.echo("")
    click.echo("Query Parameters:")
    click.echo("  /api/v1/entries?q=keyword          - Full-text search")
    click.echo("  /api/v1/entries?tags=python,cli    - Filter by tags")
    click.echo("  /api/v1/entries?page=1&per_page=20 - Pagination")


@api_cmd.command(name="openapi")
@click.option("--base-url", "-b", default=None, help="Base URL (e.g., http://localhost:8080)")
def api_openapi(base_url: str | None) -> None:
    """Show OpenAPI/Swagger UI URLs."""
    config = PeekConfig()
    url = base_url or config.server.base_url or f"http://{config.server.host}:{config.server.port}"

    click.echo("OpenAPI Documentation:")
    click.echo(f"  Swagger UI:    {url}/docs")
    click.echo(f"  ReDoc:         {url}/redoc")
    click.echo(f"  OpenAPI JSON:  {url}/openapi.json")


@cli.command(name="uninstall")
@click.option("--yes", "-y", is_flag=True, help="Skip confirmation prompt")
@click.option("--keep-data", is_flag=True, help="Keep data directory (~/.peekview/)")
def uninstall_cmd(yes: bool, keep_data: bool) -> None:
    """Uninstall PeekView and optionally remove data.

    Examples:
        peekview uninstall              # Interactive uninstall
        peekview uninstall -y           # Skip confirmation
        peekview uninstall -y --keep-data # Uninstall but keep data
    """
    import shutil

    click.echo("=== PeekView Uninstall ===")
    click.echo("")

    # Check if installed via pipx
    pipx_installed = shutil.which("pipx") is not None
    pip_installed = False
    try:
        import subprocess
        result = subprocess.run(
            [sys.executable, "-m", "pip", "show", "peekview"],
            capture_output=True,
            text=True,
            check=False
        )
        pip_installed = result.returncode == 0
    except Exception:
        pass

    # Show what will be removed
    click.echo("The following will be removed:")
    if pipx_installed:
        click.echo("  - pipx package: peekview")
    elif pip_installed:
        click.echo("  - pip package: peekview")
    else:
        click.echo("  - Installation method unknown (pipx/pip not found)")

    if not keep_data:
        data_dir = Path.home() / ".peekview"
        click.echo(f"  - Data directory: {data_dir}")
    else:
        click.echo("  - Data directory: will be preserved (--keep-data)")

    click.echo("")

    # Confirm
    if not yes and not click.confirm("Proceed with uninstall?"):
        click.echo("Cancelled.")
        return

    # Stop services first
    click.echo("→ Stopping services...")
    try:
        subprocess.run(
            ["systemctl", "stop", "peekview"],
            capture_output=True,
            check=False
        )
        subprocess.run(
            ["systemctl", "disable", "peekview"],
            capture_output=True,
            check=False
        )
    except Exception:
        pass

    # Uninstall
    click.echo("→ Uninstalling PeekView...")
    try:
        if pipx_installed:
            # pipx uninstall doesn't support -y flag
            result = subprocess.run(
                ["pipx", "uninstall", "peekview"],
                capture_output=True,
                text=True,
                check=False
            )
            if result.returncode == 0:
                click.echo("✓ PeekView uninstalled via pipx")
            else:
                click.echo(f"⚠ pipx uninstall output: {result.stderr}", err=True)
        elif pip_installed:
            result = subprocess.run(
                [sys.executable, "-m", "pip", "uninstall", "-y", "peekview"],
                capture_output=True,
                text=True,
                check=False
            )
            if result.returncode == 0:
                click.echo("✓ PeekView uninstalled via pip")
            else:
                click.echo(f"⚠ pip uninstall output: {result.stderr}", err=True)
    except Exception as e:
        click.echo(f"✗ Error uninstalling: {e}", err=True)
        click.echo("You may need to manually uninstall with:")
        click.echo("  pipx uninstall peekview")
        click.echo("  # or")
        click.echo("  pip uninstall peekview")

    # Remove data
    if not keep_data:
        data_dir = Path.home() / ".peekview"
        if data_dir.exists():
            click.echo(f"→ Removing data directory: {data_dir}")
            try:
                shutil.rmtree(data_dir)
                click.echo("✓ Data directory removed")
            except Exception as e:
                click.echo(f"⚠ Could not remove data directory: {e}", err=True)
                click.echo(f"   You may need to manually remove: rm -rf {data_dir}")

    click.echo("")
    click.echo("=== Uninstall Complete ===")
    if keep_data:
        click.echo(f"Data preserved at: {Path.home() / '.peekview'}")
        click.echo("To remove data: rm -rf ~/.peekview")


if __name__ == "__main__":
    cli()
