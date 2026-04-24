"""CLI commands for PeekView.

Provides command-line interface for:
- Starting the server (`peekview serve`)
- Creating entries (`peekview create`)
- Getting entries (`peekview get`)
- Listing entries (`peekview list`)
- Deleting entries (`peekview delete`)
"""

import json
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
@click.version_option(version="0.1.3", prog_name="peekview")
def cli() -> None:
    """PeekView - A lightweight code & document formatting display service."""
    pass


@cli.command()
@click.option("--host", "-h", default=None, help="Server bind address (default: 127.0.0.1)")
@click.option("--port", "-p", default=None, type=int, help="Server port (default: 8080)")
@click.option("--reload", is_flag=True, help="Enable auto-reload (development)")
@click.option("--workers", "-w", default=1, type=int, help="Number of worker processes")
@click.pass_context
def serve(ctx: click.Context, host: str | None, port: int | None, reload: bool, workers: int) -> None:
    """Start the PeekView server.

    Examples:
        peekview serve                    # Start with default config
        peekview serve -p 3000           # Start on port 3000
        peekview serve --reload          # Development mode with auto-reload
    """
    import uvicorn

    config = PeekConfig()

    # Override with CLI args
    bind_host = host or config.server.host
    bind_port = port or config.server.port

    # Ensure data directory exists
    config.ensure_directories()

    # Initialize database
    init_db(config.db_path)

    click.echo(f"Starting Peek server on http://{bind_host}:{bind_port}")
    click.echo(f"Data directory: {config.data_dir}")
    click.echo(f"Database: {config.db_path}")

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
@click.option("--json-output", "-j", is_flag=True, help="Output as JSON")
def create(
    paths: tuple[str, ...],
    summary: str,
    slug: str | None,
    tag: tuple[str, ...],
    expires_in: str | None,
    from_stdin: bool,
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


if __name__ == "__main__":
    cli()
