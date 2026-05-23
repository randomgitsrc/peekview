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
import urllib.request
from pathlib import Path
from typing import Any

import click
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session

from peekview import __version__
from peekview.client import PeekClient
from peekview.config import PeekConfig
from peekview.database import init_db
from peekview.main import create_app
from peekview.models import CreateEntryRequest, EntryCreate, User
from peekview.services.entry_service import EntryService
from peekview.services.file_service import scan_directory
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
@click.option("--host", "-h", default=None, help="Server bind address (default: 0.0.0.0, use 127.0.0.1 for local only)")
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
    init_db(config.db_path)

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
@click.option("--expires-in", help="Expiration duration (e.g., '7d', '1h', '30m')")
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
        result = backend.create_entry(
            summary=summary,
            slug=slug,
            tags=list(tag),
            files_data=files_data if files_data else None,
            dirs_data=dirs_data if dirs_data else None,
            expires_in=expires_in,
            is_public=is_public,
        )

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
        peekview config set base_url https://example.com
        peekview config get base_url
        peekview config list
    """
    pass


CONFIG_KEYS_HELP = """
\b
Supported keys:
server.host, server.port, server.base_url,
storage.data_dir, storage.db_path,
auth.secret_key, auth.token_expire_days, auth.allow_registration,
remote.url, remote.api_key, remote.timeout, remote.verify_ssl,
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
    from peekview.config import load_config_file, save_config_file, CONFIG_FILE

    config = load_config_file()

    # Validate key
    supported_keys = [
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
        # Limits
        "limits.max_file_size", "limits.max_entry_files", "limits.max_entry_size",
        "limits.max_slug_length", "limits.max_summary_length", "limits.max_per_page",
        # Cleanup
        "cleanup.check_on_start", "cleanup.interval_seconds",
        # Logging
        "logging.level", "logging.log_file",
        # Remote
        "remote.url", "remote.api_key", "remote.timeout", "remote.verify_ssl",
    ]
    if key not in supported_keys:
        click.echo(f"Error: Unknown config key '{key}'", err=True)
        click.echo(f"Supported keys: {', '.join(supported_keys)}", err=True)
        sys.exit(1)

    # Handle nested keys with type conversion
    section, key_name = key.split(".", 1) if "." in key else ("server", key)

    if section not in config:
        config[section] = {}

    # Type conversion based on key patterns
    if key_name in ("port", "token_expire_days", "timeout", "health_disk_warning_mb",
                    "max_file_size", "max_entry_files", "max_entry_size",
                    "max_slug_length", "max_summary_length", "max_per_page",
                    "interval_seconds"):
        try:
            value = int(value)
        except ValueError:
            click.echo(f"Error: {key} must be an integer", err=True)
            sys.exit(1)
    elif key_name in ("allow_registration", "allow_anonymous_create",
                      "rate_limit_enabled", "check_on_start", "verify_ssl"):
        value = value.lower() in ("true", "1", "yes", "on")
    elif key_name == "cors_origins":
        value = [v.strip() for v in value.split(",")]
    elif key_name == "allowed_paths":
        value = [v.strip() for v in value.split(",")]
    elif key_name in ("data_dir", "db_path", "log_file"):
        # Path expansion handled by config validator
        pass

    config[section][key_name] = value

    save_config_file(config)
    click.echo(f"✓ Set {key} = {value}")
    click.echo(f"  Config file: {CONFIG_FILE}")


@config_cmd.command(name="get", epilog=CONFIG_KEYS_HELP)
@click.argument("key")
def config_get(key: str) -> None:
    """Get a configuration value.

    Example: peekview config get server.port
    """
    from peekview.config import load_config_file, PeekConfig

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
    from peekview.config import load_config_file, CONFIG_FILE

    config = load_config_file()

    if not config:
        click.echo(f"No configuration set. Config file: {CONFIG_FILE}")
        return

    click.echo(f"Configuration ({CONFIG_FILE}):")
    _print_config(config)


def _print_config(config: dict, prefix: str = "") -> None:
    """Helper to print nested config."""
    for key, value in config.items():
        if isinstance(value, dict):
            click.echo(f"{prefix}{key}:")
            _print_config(value, prefix + "  ")
        else:
            click.echo(f"  {prefix}{key}: {value}")


SERVICE_EXAMPLES = """
\b
Examples:

    peekview service install              # Install as system service

    peekview service install --user       # Install as user service

    peekview service status               # Check service status

    peekview service start                # Start the service

    peekview service stop                 # Stop the service

    peekview service uninstall            # Remove the service
"""


@cli.group(name="service", epilog=SERVICE_EXAMPLES)
def service_cmd():
    """Manage PeekView as a system service (systemd/launchd)."""
    pass


@service_cmd.command(name="install")
@click.option("--user", "user_mode", is_flag=True, help="Install as user service (no sudo needed)")
@click.option("--force", is_flag=True, help="Overwrite existing service")
def install_service(user_mode: bool, force: bool) -> None:
    """Install PeekView as a system service.

    Configuration is read from ~/.peekview/config.yaml at runtime.
    Use `peekview config` command to manage settings.
    """
    system = platform.system()

    if system == "Linux":
        _install_systemd_service(user_mode, force)
    elif system == "Darwin":
        _install_launchd_service(user_mode, force)
    else:
        click.echo(f"Service installation not supported on {system}", err=True)
        sys.exit(1)


def _install_systemd_service(user_mode: bool, force: bool) -> None:
    """Install systemd service on Linux."""
    import getpass

    config = PeekConfig()
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
def uninstall_service(user_mode: bool) -> None:
    """Uninstall the PeekView service."""
    system = platform.system()

    if system == "Linux":
        _uninstall_systemd_service(user_mode)
    elif system == "Darwin":
        _uninstall_launchd_service(user_mode)
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

        click.echo(f"✓ Service uninstalled")
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

        click.echo(f"✓ Service uninstalled")
    except subprocess.CalledProcessError as e:
        click.echo(f"Error uninstalling service: {e}", err=True)
        sys.exit(1)


@service_cmd.command(name="status")
@click.option("--user", "user_mode", is_flag=True, help="Check user service status")
def service_status(user_mode: bool) -> None:
    """Check the service status."""
    system = platform.system()

    if system == "Linux":
        try:
            if user_mode:
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
        except subprocess.CalledProcessError as e:
            click.echo("Service not found or not running")
    else:
        click.echo(f"Service status check not supported on {system}")


@service_cmd.command(name="start")
@click.option("--user", "user_mode", is_flag=True, help="Start user service")
def start_service(user_mode: bool) -> None:
    """Start the service."""
    system = platform.system()

    if system == "Linux":
        try:
            if user_mode:
                subprocess.run(["systemctl", "--user", "start", "peekview"], check=True)
            else:
                subprocess.run(["sudo", "systemctl", "start", "peekview"], check=True)
            click.echo("✓ Service started")
        except subprocess.CalledProcessError as e:
            click.echo(f"Error starting service: {e}", err=True)
            sys.exit(1)
    elif system == "Darwin":
        plist_path = Path.home() / "Library" / "LaunchAgents" / "com.peekview.plist"
        if not user_mode:
            plist_path = Path("/Library/LaunchDaemons") / "com.peekview.plist"
        try:
            if user_mode:
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
def stop_service(user_mode: bool) -> None:
    """Stop the service."""
    system = platform.system()

    if system == "Linux":
        try:
            if user_mode:
                subprocess.run(["systemctl", "--user", "stop", "peekview"], check=True)
            else:
                subprocess.run(["sudo", "systemctl", "stop", "peekview"], check=True)
            click.echo("✓ Service stopped")
        except subprocess.CalledProcessError as e:
            click.echo(f"Error stopping service: {e}", err=True)
            sys.exit(1)
    elif system == "Darwin":
        try:
            if user_mode:
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
def restart_service(user_mode: bool) -> None:
    """Restart the service."""
    system = platform.system()

    if system == "Linux":
        try:
            if user_mode:
                subprocess.run(["systemctl", "--user", "restart", "peekview"], check=True)
            else:
                subprocess.run(["sudo", "systemctl", "restart", "peekview"], check=True)
            click.echo("✓ Service restarted")
        except subprocess.CalledProcessError as e:
            click.echo(f"Error restarting service: {e}", err=True)
            sys.exit(1)
    elif system == "Darwin":
        plist_path = Path.home() / "Library" / "LaunchAgents" / "com.peekview.plist"
        if not user_mode:
            plist_path = Path("/Library/LaunchDaemons") / "com.peekview.plist"
        try:
            # Darwin doesn't have restart, use stop then start
            if user_mode:
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
        click.echo(f"Error: Username must be 3-32 characters", err=True)
        sys.exit(1)
    if not re.match(r"^[a-zA-Z0-9_-]+$", username):
        click.echo(f"Error: Username must contain only letters, digits, underscores, and hyphens", err=True)
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
        click.echo(f"  Token saved to config")
        click.echo(f"  Tip: Use 'peekview apikey create <name>' to create an API key")
    except Exception as e:
        click.echo(f"Error: Login failed - {e}", err=True)
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
    """Manage API keys (remote mode only)."""
    pass


@apikey_cmd.command(name="create")
@click.argument("name")
@click.option("--expires", "-e", default=None, help="Expiration (e.g., '7d', '30d', '90d')")
@click.option("--remote-url", "-r", default=None, help="Remote server URL")
def apikey_create(name: str, expires: str | None, remote_url: str | None) -> None:
    """Create a new API key.

    The full key is shown only once — save it securely.
    """
    config = PeekConfig()
    backend = _get_backend(config, cli_remote_url=remote_url)

    if not _is_remote_mode(backend):
        click.echo("Error: API key management requires remote mode. Use --remote-url or configure remote.url", err=True)
        sys.exit(1)

    click.echo(f"→ Remote mode: {remote_url or config.remote.url}")

    try:
        result = backend.create_api_key(name=name, expires_in=expires)
        click.echo(f"✓ Created API key: {name}")
        click.echo(f"  Key: {result['key']}")
        click.echo(f"  Prefix: {result['key_prefix']}")
        if result.get("expires_at"):
            click.echo(f"  Expires: {result['expires_at']}")
        else:
            click.echo(f"  Expires: Never")
        click.echo()
        click.echo("  ⚠ Save this key now — it won't be shown again!")
    except Exception as e:
        click.echo(f"Error: {e}", err=True)
        sys.exit(1)


@apikey_cmd.command(name="list")
@click.option("--remote-url", "-r", default=None, help="Remote server URL")
def apikey_list(remote_url: str | None) -> None:
    """List your API keys."""
    config = PeekConfig()
    backend = _get_backend(config, cli_remote_url=remote_url)

    if not _is_remote_mode(backend):
        click.echo("Error: API key management requires remote mode. Use --remote-url or configure remote.url", err=True)
        sys.exit(1)

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


@apikey_cmd.command(name="revoke")
@click.argument("key_id", type=int)
@click.option("--remote-url", "-r", default=None, help="Remote server URL")
@click.confirmation_option(prompt="Are you sure you want to revoke this API key?")
def apikey_revoke(key_id: int, remote_url: str | None) -> None:
    """Revoke an API key by ID."""
    config = PeekConfig()
    backend = _get_backend(config, cli_remote_url=remote_url)

    if not _is_remote_mode(backend):
        click.echo("Error: API key management requires remote mode. Use --remote-url or configure remote.url", err=True)
        sys.exit(1)

    click.echo(f"→ Remote mode: {remote_url or config.remote.url}")

    try:
        backend.revoke_api_key(key_id)
        click.echo(f"✓ Revoked API key: {key_id}")
    except Exception as e:
        click.echo(f"Error: {e}", err=True)
        sys.exit(1)


@apikey_cmd.command(name="cleanup")
@click.option("--remote-url", "-r", default=None, help="Remote server URL")
def apikey_cleanup(remote_url: str | None) -> None:
    """Delete all expired API keys."""
    config = PeekConfig()
    backend = _get_backend(config, cli_remote_url=remote_url)

    if not _is_remote_mode(backend):
        click.echo("Error: API key management requires remote mode. Use --remote-url or configure remote.url", err=True)
        sys.exit(1)

    click.echo(f"→ Remote mode: {remote_url or config.remote.url}")

    try:
        result = backend.cleanup_expired_keys()
        click.echo(f"✓ Cleaned up {result['deleted']} expired key(s)")
    except Exception as e:
        click.echo(f"Error: {e}", err=True)
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
    if not yes:
        if not click.confirm("Proceed with uninstall?"):
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
