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
import subprocess
import sys
from pathlib import Path
from typing import Any

import click
from sqlalchemy import select
from sqlmodel import Session

from peekview.config import PeekConfig
from peekview.database import init_db
from peekview.main import create_app
from peekview.models import CreateEntryRequest, EntryCreate
from peekview.services.entry_service import EntryService
from peekview.services.file_service import scan_directory
from peekview.storage import StorageManager


@click.group()
@click.version_option(version="0.1.6", prog_name="peekview")
def cli() -> None:
    """PeekView - A lightweight code & document formatting display service."""
    pass


@cli.command()
@click.option("--host", "-h", default=None, help="Server bind address (default: 127.0.0.1)")
@click.option("--port", "-p", default=None, type=int, help="Server port (default: 8080)")
@click.option("--base-url", "-b", default=None, help="External base URL (e.g., https://example.com)")
@click.option("--reload", is_flag=True, help="Enable auto-reload (development)")
@click.option("--workers", "-w", default=1, type=int, help="Number of worker processes")
@click.pass_context
def serve(ctx: click.Context, host: str | None, port: int | None, base_url: str | None, reload: bool, workers: int) -> None:
    """Start the PeekView server.

    Examples:
        peekview serve                    # Start with default config
        peekview serve -p 3000           # Start on port 3000
        peekview serve --reload          # Development mode with auto-reload
        peekview serve --base-url https://example.com  # Use custom domain
    """
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


@cli.command()
@click.argument("paths", nargs=-1, required=False)
@click.option("--summary", "-s", required=True, help="Entry summary/description")
@click.option("--slug", help="Custom URL slug (auto-generated if not provided)")
@click.option("--tag", "-t", multiple=True, help="Tags (can be specified multiple times)")
@click.option("--expires-in", help="Expiration duration (e.g., '7d', '1h', '30m')")
@click.option("--from-stdin", is_flag=True, help="Read file content from stdin")
@click.option("--base-url", "-b", default=None, help="External base URL for generated links (e.g., https://example.com)")
@click.option("--json-output", "-j", is_flag=True, help="Output as JSON")
def create(
    paths: tuple[str, ...],
    summary: str,
    slug: str | None,
    tag: tuple[str, ...],
    expires_in: str | None,
    from_stdin: bool,
    base_url: str | None,
    json_output: bool,
) -> None:
    """Create a new entry.

    Examples:
        peekview create file.txt -s "My code"
        peekview create src/*.py -s "Python project" -t python -t cli
        peekview create -s "From stdin" --from-stdin < code.py
        echo "content" | peekview create -s "From pipe" --from-stdin
    """
    config = PeekConfig()
    config.ensure_directories()

    # Set base_url from CLI if provided
    if base_url:
        config.server.base_url = base_url

    engine = init_db(config.db_path)
    storage = StorageManager(config=config)
    service = EntryService(engine=engine, storage=storage, config=config)

    # Collect files
    files_data = []
    dirs_data = []

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
                # Add as directory
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

    try:
        result = service.create_entry(
            summary=summary,
            slug=slug,
            tags=list(tag),
            files_data=files_data if files_data else None,
            dirs_data=dirs_data if dirs_data else None,
            expires_in=expires_in,
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
@click.option("--json-output", "-j", is_flag=True, help="Output as JSON")
def get(slug: str, json_output: bool) -> None:
    """Get entry details by slug.

    Examples:
        peekview get my-entry
        peekview get my-entry --json
    """
    config = PeekConfig()
    engine = init_db(config.db_path)
    storage = StorageManager(config=config)
    service = EntryService(engine=engine, storage=storage, config=config)

    try:
        entry = service.get_entry(slug)

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
@click.option("--json-output", "-j", is_flag=True, help="Output as JSON")
def list_entries(
    query: str | None,
    tag: tuple[str, ...],
    status: str | None,
    page: int,
    per_page: int,
    json_output: bool,
) -> None:
    """List entries with optional filters.

    Examples:
        peekview list
        peekview list -q "python"
        peekview list -t cli -t python
        peekview list --status active
    """
    config = PeekConfig()
    engine = init_db(config.db_path)
    storage = StorageManager(config=config)
    service = EntryService(engine=engine, storage=storage, config=config)

    try:
        tag_list = list(tag) if tag else None
        result = service.list_entries(
            q=query,
            tags=tag_list,
            status=status,
            page=page,
            per_page=per_page,
        )

        if json_output:
            click.echo(json.dumps({
                "items": [
                    {
                        "id": item.id,
                        "slug": item.slug,
                        "summary": item.summary,
                        "tags": item.tags,
                        "status": item.status,
                        "file_count": item.file_count,
                        "created_at": item.created_at.isoformat() if item.created_at else None,
                        "updated_at": item.updated_at.isoformat() if item.updated_at else None,
                    }
                    for item in result.items
                ],
                "total": result.total,
                "page": result.page,
                "per_page": result.per_page,
            }, indent=2))
        else:
            click.echo(f"Entries ({result.total} total, page {result.page}):")
            click.echo()
            for item in result.items:
                tags_str = f" [{', '.join(item.tags)}]" if item.tags else ""
                click.echo(f"  {item.slug}{tags_str}")
                click.echo(f"    {item.summary[:60]}{'...' if len(item.summary) > 60 else ''}")
                click.echo(f"    {item.file_count} files | {item.status}")
                click.echo()

    except Exception as e:
        click.echo(f"Error: {e}", err=True)
        sys.exit(1)


@cli.command()
@click.argument("slug")
@click.confirmation_option(prompt="Are you sure you want to delete this entry?")
def delete(slug: str) -> None:
    """Delete an entry by slug.

    Examples:
        peekview delete my-entry
        peekview delete my-entry --yes  # Skip confirmation
    """
    config = PeekConfig()
    engine = init_db(config.db_path)
    storage = StorageManager(config=config)
    service = EntryService(engine=engine, storage=storage, config=config)

    try:
        service.delete_entry(slug)
        click.echo(f"✓ Deleted entry: {slug}")
    except Exception as e:
        click.echo(f"Error: {e}", err=True)
        sys.exit(1)


@cli.group(name="service")
def service_cmd():
    """Manage PeekView as a system service (systemd/launchd).

    Examples:
        peekview service install         # Install as system service
        peekview service install --user  # Install as user service
        peekview service status          # Check service status
        peekview service start           # Start the service
        peekview service stop            # Stop the service
        peekview service uninstall       # Remove the service
    """
    pass


@service_cmd.command(name="install")
@click.option("--user", "user_mode", is_flag=True, help="Install as user service (no sudo needed)")
@click.option("--host", "-h", default=None, help="Server bind address")
@click.option("--port", "-p", default=None, type=int, help="Server port")
@click.option("--base-url", "-b", default=None, help="External base URL")
@click.option("--data-dir", default=None, help="Data directory path")
@click.option("--force", is_flag=True, help="Overwrite existing service")
def install_service(user_mode: bool, host: str | None, port: int | None, base_url: str | None, data_dir: str | None, force: bool) -> None:
    """Install PeekView as a system service."""
    system = platform.system()

    if system == "Linux":
        _install_systemd_service(user_mode, host, port, base_url, data_dir, force)
    elif system == "Darwin":
        _install_launchd_service(user_mode, host, port, base_url, data_dir, force)
    else:
        click.echo(f"Service installation not supported on {system}", err=True)
        sys.exit(1)


def _install_systemd_service(user_mode: bool, host: str | None, port: int | None,
                              base_url: str | None, data_dir: str | None, force: bool) -> None:
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

    # Build environment variables
    env_vars = []
    if base_url:
        env_vars.append(f"Environment=PEEKVIEW_SERVER__BASE_URL={base_url}")
    if host:
        env_vars.append(f"Environment=PEEKVIEW_HOST={host}")
    if port:
        env_vars.append(f"Environment=PEEKVIEW_PORT={port}")
    if data_dir:
        env_vars.append(f"Environment=PEEKVIEW_DATA_DIR={data_dir}")

    # Get current user for service file
    current_user = getpass.getuser()

    # Create service file
    service_content = f"""[Unit]
Description=PeekView - Code & Document Formatting Service
After=network.target

[Service]
Type=simple
User={current_user}
ExecStart={peekview_path} serve
Restart=always
RestartSec=5
{chr(10).join(env_vars)}

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


def _install_launchd_service(user_mode: bool, host: str | None, port: int | None,
                              base_url: str | None, data_dir: str | None, force: bool) -> None:
    """Install launchd service on macOS."""
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

    # Build environment variables
    env_vars = {}
    if base_url:
        env_vars["PEEKVIEW_SERVER__BASE_URL"] = base_url
    if host:
        env_vars["PEEKVIEW_HOST"] = host
    if port:
        env_vars["PEEKVIEW_PORT"] = str(port)
    if data_dir:
        env_vars["PEEKVIEW_DATA_DIR"] = data_dir

    # Create plist content
    env_xml = ""
    if env_vars:
        env_entries = "\n".join([f"        <key>{k}</key>\n        <string>{v}</string>" for k, v in env_vars.items()])
        env_xml = f"""    <key>EnvironmentVariables</key>
    <dict>
{env_entries}
    </dict>"""

    plist_content = f"""<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.peekview</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/peekview</string>
        <string>serve</string>
    </array>
{env_xml}
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


if __name__ == "__main__":
    cli()
