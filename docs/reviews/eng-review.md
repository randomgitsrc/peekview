# Peek MVP — Adversarial Engineering Review

> Reviewer: Engineering Architect  
> Date: 2026-04-18  
> Documents reviewed: Implementation plan (`impl-plan.md`, 4570 lines, 20 tasks), design spec (`spec-design.md`), test plan (`spec-test-plan.md`)  
> Prior review consulted: CEO strategic review (`peek-mvp-strategic-review.md`)  
> Scope: Architecture, database, API design, service layer, testing, performance, security (engineering depth only)

---

## 1. Symlink Validation Is Broken — Checks Wrong Path Object

**Severity: CRITICAL**

The `validate_local_path` implementation (design doc §4.3, plan Task 8) does:

```python
resolved = Path(local_path).resolve()
if resolved.is_symlink():  # ← WRONG
    raise ForbiddenPathError(...)
```

`Path.resolve()` follows symlinks — after resolution, `resolved` points to the **target**, not the symlink. `resolved.is_symlink()` will **always return False** for a resolved path. The check must happen **before** resolving:

```python
original = Path(local_path)
if original.is_symlink():
    raise ForbiddenPathError(f"Symlinks not allowed: {local_path}")
resolved = original.resolve()
```

**Additional problem:** Even this fix is insufficient. A symlink in a non-forbidden path pointing to a forbidden path (e.g., `/tmp/link → ~/.ssh/id_rsa`) would pass the symlink check because `/tmp/link` is not in the forbidden list. The check needs to verify that `resolved` doesn't fall within any forbidden path, which the blacklist check does, but only for the **first level** of indirection. Hardlinks are not checked at all.

**Fix:** Check `original.is_symlink()` before resolve. Also check `resolved` against forbidden paths after resolve (which the existing code does). Add hardlink detection via `os.stat(original).st_nlink > 1`.

---

## 2. Path Traversal Test Will Fail Against Default Config

**Severity: HIGH**

The test `test_path_traversal_relative` (Task 11) expects:

```python
validate_local_path("../../etc/passwd", forbidden_paths=[], forbidden_patterns=[])
# → raises ForbiddenPathError
```

After `resolve()`, `../../etc/passwd` becomes `/etc/passwd`. The code then checks against `forbidden_paths=[]` (empty in this test) and `forbidden_patterns=[]` (empty). **Neither check catches it** — `/etc/passwd` is only in the default `_DEFAULT_FORBIDDEN_PATHS` list as `/etc/passwd`, but this test explicitly overrides with empty lists.

The test passes `forbidden_paths=[]` and `forbidden_patterns=[]` as arguments, but the `validate_local_path` function signature in the design doc is `validate_local_path(local_path: str)` — it doesn't accept these parameters. This is a **signature mismatch** between the test code and the design.

The real question: what should happen with `../../etc/passwd`? After `resolve()`, it becomes an absolute path `/etc/passwd`. The traversal itself is not the vulnerability — the resolved path ending up in a forbidden location is. The test name implies traversal is blocked, but the actual mechanism is the blacklist check on the resolved path.

**Fix:** Clarify the `validate_local_path` function signature. Decide whether path traversal (i.e., `..` in the original path) should be independently rejected regardless of the resolved destination. The design spec says "resolve() paths, reject paths containing `..`" — this means checking the **original** path string for `..` components before resolve, which is the correct approach.

---

## 3. `files.path` Field Allows Path Traversal to Escape Entry Directory

**Severity: CRITICAL**

The `get_disk_path` function (design doc §4.2):

```python
def get_disk_path(entry_id: int, file_path: str | None, filename: str) -> Path:
    base = config.data_dir / "default" / str(entry_id)
    if file_path:
        return base / file_path  # ← NO VALIDATION
    return base / filename
```

If `file_path` is `../../../etc/shadow`, the result is `base / "../../../etc/shadow"` which resolves to `/etc/shadow` — escaping the entry directory entirely. The `path` field in the `files` table is user-controlled (it comes from the API request body's `files[].path`).

An attacker can:
1. Create an entry with `files: [{"path": "../../../etc/shadow", "content": "overwritten"}]` — this would **write** to `/etc/shadow` via the atomic write + rename pattern
2. Read any file on the system by creating an entry with a crafted `path` that points outside the data directory

**Fix:** After computing the disk path, verify it resolves within the entry's base directory:

```python
resolved = (base / file_path).resolve()
if not str(resolved).startswith(str(base.resolve())):
    raise ForbiddenPathError(f"Path escapes entry directory: {file_path}")
```

---

## 4. Shiki Creates New Highlighter Instance Per File — Performance Killer

**Severity: HIGH**

`CodeViewer.vue` (Task 16, Step 2) calls `createHighlighter()` inside `onMounted()`:

```typescript
onMounted(async () => {
  const highlighter = await createHighlighter({
    themes: ['github-dark', 'github-light'],
    langs: [props.language || 'text'],
  })
  highlighted.value = highlighter.codeToHtml(props.content, { ... })
})
```

Every time a user clicks a different file in the FileTree, a new `CodeViewer` is mounted, creating a **new highlighter instance**. Each `createHighlighter()` call:
- Loads the Shiki WASM module (~200KB)
- Loads the theme JSON files
- Loads the language grammar
- Initializes the Oniguruma regex engine

For a directory with 20 files, switching between them triggers 20 WASM initializations. On a typical machine, each takes 50-200ms, making the UI feel sluggish.

**Fix:** Create a singleton highlighter at the app level (in a composable or provide/inject) that pre-loads common languages and lazily loads others:

```typescript
// composables/useHighlighter.ts
let highlighter: ShikiHighlighter | null = null
export async function getHighlighter() {
  if (!highlighter) {
    highlighter = await createHighlighter({
      themes: ['github-dark', 'github-light'],
      langs: ['python', 'javascript', 'typescript', 'markdown', 'bash', 'json'],
    })
  }
  return highlighter
}
```

---

## 5. Shiki Dual-Theme Output Doesn't Match CSS Theme Switching

**Severity: HIGH**

The `CodeViewer.vue` uses Shiki's dual-theme rendering:

```typescript
highlighter.codeToHtml(props.content, {
  lang: props.language || 'text',
  themes: { dark: 'github-dark', light: 'github-light' },
})
```

Shiki's dual-theme output uses CSS custom properties like `--shiki-dark` and `--shiki-light` with a `color-scheme` media query or `data-theme` attribute switching mechanism. But Peek's theme system uses `[data-theme="dark"]` / `[data-theme="light"]` CSS selectors on the document root.

**These two systems are incompatible.** Shiki's output will render with one theme (the default) and won't switch when the user toggles Peek's theme toggle. The code will appear to ignore theme changes.

Shiki dual-theme output looks like:
```html
<span style="--shiki-dark:#e6edf3;--shiki-light:#1f2328">code</span>
```

This requires CSS like:
```css
.shiki { color: var(--shiki-light); background-color: var(--shiki-light-bg); }
[data-theme="dark"] .shiki { color: var(--shiki-dark); background-color: var(--shiki-dark-bg); }
```

**Fix:** Add CSS rules that bridge Peek's `[data-theme]` selector to Shiki's `--shiki-dark`/`--shiki-light` custom properties. This is not shown anywhere in the plan.

---

## 6. No Transaction Wrapping for Entry Creation — Partial Writes on Failure

**Severity: HIGH**

The `create_entry` method (Task 9) follows this sequence:
1. Create entry record in DB
2. Process each file (validate, copy/write, compute sha256)
3. Create file records in DB
4. Commit

If step 2 fails for file 3 of 5, the entry and files 1-2 are already in the database (if auto-commit is on), or the session is left in a dirty state. The design doc §4.4 specifies "atomic operation: temp dir → rename → update DB (transaction)" and "failure: rollback DB + cleanup temp files," but the implementation doesn't do this.

More critically: `StorageManager.write_file()` is called **before** `session.add(file_record)`, meaning file I/O happens outside the transaction. If the DB commit fails after files are written, orphan files remain on disk with no corresponding DB records.

**Fix:** Wrap the entire create_entry in a try/except with explicit rollback:

```python
def create_entry(self, ...):
    written_files = []
    try:
        with Session(self.engine) as session:
            entry = Entry(...)
            session.add(entry)
            session.flush()  # Get entry.id without committing
            
            for fi in files:
                content = ...
                path = self.storage.write_file(entry.id, fi.filename, content, fi.path)
                written_files.append(path)
                file_record = File(entry_id=entry.id, ...)
                session.add(file_record)
            
            session.commit()
    except Exception:
        # Cleanup written files
        for path in written_files:
            path.unlink(missing_ok=True)
        raise
```

---

## 7. `get_engine()` Is Undefined — API Routes Will Fail at Runtime

**Severity: CRITICAL**

Task 10's `entries.py` imports and calls `get_engine()` from `peek.database`:

```python
from peek.database import get_engine
# ...
def get_entry_service() -> EntryService:
    engine = get_engine()  # ← What does this return?
```

But `database.py` (Task 6) only defines `init_db(db_path: Path)`, which creates and returns an engine. There is **no `get_engine()` function** defined anywhere in the plan. This means:

- `entries.py` will fail at import time with `ImportError: cannot import name 'get_engine'`
- Even if `get_engine` existed, it would need to return the **same** engine instance that `init_db()` created, but there's no module-level storage for the engine

Similarly, `files.py` imports `get_engine` and calls it, creating yet another independent connection.

**Fix:** Create a proper engine singleton in `database.py`:

```python
_engine: Engine | None = None

def init_db(db_path: Path) -> Engine:
    global _engine
    _engine = create_engine(f"sqlite:///{db_path}")
    # ... PRAGMAs ...
    SQLModel.metadata.create_all(_engine)
    return _engine

def get_engine() -> Engine:
    if _engine is None:
        raise RuntimeError("Database not initialized. Call init_db() first.")
    return _engine
```

---

## 8. `EntryCreate` / `EntryUpdate` Pydantic Models Never Defined

**Severity: HIGH**

The API routes use Pydantic request models:

```python
async def create_entry(data: EntryCreate, ...):
async def update_entry(slug: str, data: EntryUpdate, ...):
```

These are imported from `peek.models` (`from peek.models import EntryCreate, EntryUpdate`), but the models.py file (Task 4) only defines SQLModel table models (`Entry`, `File`). The Pydantic request/response schemas are never defined in any task.

Without these models, FastAPI cannot:
- Validate request body structure
- Generate OpenAPI documentation
- Deserialize JSON into typed objects

The `EntryCreate` model needs validation for: summary (non-empty, max length), slug (regex pattern), files (each must have `content` or `local_path` but not both), `expires_in` (duration format), tags (list of strings). None of this validation exists.

**Fix:** Add a Task (or extend Task 4) to define Pydantic request/response schemas:

```python
class FileInput(BaseModel):
    path: str | None = None
    content: str | None = None
    local_path: str | None = None
    
    @model_validator(mode='after')
    def validate_content_source(self):
        if self.content and self.local_path:
            raise ValueError('Cannot specify both content and local_path')
        return self

class EntryCreate(BaseModel):
    summary: str = Field(..., min_length=1, max_length=500)
    slug: str | None = Field(None, pattern=r'^[a-z0-9_-]+$')
    tags: list[str] = []
    files: list[FileInput] = []
    dirs: list[DirInput] = []
    expires_in: str | None = None
```

---

## 9. SQLModel Entry Creation Will Fail — Missing Required Fields

**Severity: HIGH**

The SQLModel `Entry` table has:

```sql
created_at DATETIME NOT NULL,
updated_at DATETIME NOT NULL
```

But the test code (Task 9, Task 18) creates entries like:

```python
Entry(slug="test", summary="Test entry")
Entry(slug="active", summary="Active entry")
```

Without `created_at` and `updated_at`, this will raise `IntegrityError: NOT NULL constraint failed`. The plan's implementation must set defaults, either via:
- SQLModel field defaults: `created_at: datetime = Field(default_factory=datetime.now)`
- Database triggers
- Service layer pre-processing

None of these are shown in the plan. The `Entry` model definition (Task 4) doesn't include Python-side defaults for these fields.

**Fix:** Add default factories to the SQLModel:

```python
class Entry(SQLModel, table=True):
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
```

---

## 10. `line_count` in FileResponse — Phantom Field

**Severity: MEDIUM**

The TypeScript `FileResponse` type (Task 15) includes:

```typescript
line_count: number | null
```

The API response for entry details (design doc §5.8) includes `"line_count": 12`. But the `files` database table has no `line_count` column. The `File` SQLModel doesn't have this field. There's no code to compute it.

This means the API will either:
- Return `null` for `line_count` always (if the response model doesn't include it)
- Fail serialization (if the response model expects it)
- Return 0 or an incorrect value

**Fix:** Either add `line_count` to the `File` model and compute it during file ingestion, or compute it dynamically in the response builder:

```python
def _build_response(self, entry, files):
    return {
        ...
        "files": [{
            ...
            "line_count": content.count('\n') + 1 if not f.is_binary else None
        } for f in files]
    }
```

Note: Computing dynamically requires reading file content, which is expensive. Better to compute and store during ingestion.

---

## 11. `update_entry` Deletes DB Records But Not Filesystem Files

**Severity: HIGH**

Task 19's `update_entry` implementation:

```python
for file_id in data.get("remove_file_ids", []):
    file_record = session.get(File, file_id)
    if file_record and file_record.entry_id == entry.id:
        session.delete(file_record)
```

This deletes the `File` DB record but never calls `storage.delete_file()` or removes the physical file from `data/{user_id}/{entry_id}/`. Over time, disk usage grows unbounded with orphan files that have no DB records.

The cleanup service (Task 18) only handles expired entries, not orphan files within active entries.

**Fix:** After deleting the DB record, delete the physical file:

```python
for file_id in data.get("remove_file_ids", []):
    file_record = session.get(File, file_id)
    if file_record and file_record.entry_id == entry.id:
        storage.delete_file(entry.id, file_record.filename, file_record.path)
        session.delete(file_record)
```

Also add `StorageManager.delete_file()` method — it doesn't exist in the current design (only `delete_entry_files()` which removes the entire entry directory).

---

## 12. Slug Conflict Race Condition — TOCTOU Between Check and Insert

**Severity: MEDIUM**

The `create_entry` method checks for slug existence and then appends a suffix:

```python
existing = session.exec(select(Entry).where(Entry.slug == slug)).first()
if existing:
    slug = f"{original_slug}-{counter}"
```

Between the `select` and the subsequent `session.add(entry)`, another concurrent request could create an entry with the same slug. The `UNIQUE` constraint on `slug` would catch this, but the error handling for `IntegrityError` isn't shown.

If two requests simultaneously try to create `"my-doc"`, both pass the existence check (neither exists yet), both try to insert with `"my-doc"`, and one gets an `IntegrityError`. The code needs to catch this and retry with a suffixed slug.

**Fix:** Wrap the insert in a try/except for `IntegrityError` and retry with an incremented suffix:

```python
from sqlalchemy.exc import IntegrityError

max_retries = 5
for attempt in range(max_retries):
    try:
        entry = Entry(slug=slug, ...)
        session.add(entry)
        session.commit()
        break
    except IntegrityError:
        session.rollback()
        counter += 1
        slug = f"{original_slug}-{counter}"
```

---

## 13. FTS5 Tags Column Contains JSON Syntax — Tokenization Noise

**Severity: MEDIUM**

The FTS5 index includes the `tags` column from `entries`, which is stored as a JSON string:

```python
tags: str = Field(default="[]")  # Stored as '["python", "auth"]'
```

The FTS5 trigger inserts `new.tags` into the index. FTS5 will tokenize `["python", "auth"]` into tokens including `[`, `"`, `python`, `"`, `,`, `"`, `auth`, `"`, `]`. Searching for `"python"` works, but searching for `python AND auth` might behave unexpectedly because of JSON syntax tokens.

More importantly, the `summary` FTS column is untokenized CJK text. FTS5's default tokenizer (Unicode61) handles ASCII word boundaries but has poor CJK support — Chinese characters are each treated as individual tokens, so searching for "认证模块" would match any entry containing any of those four characters individually, not the phrase.

**Fix:** For tags, use a space-separated format for FTS indexing:

```sql
-- In the trigger, strip JSON syntax:
INSERT INTO entries_fts(rowid, summary, tags) 
VALUES (new.rowid, new.summary, replace(replace(replace(new.tags, '[', ''), ']', ''), '"', ''));
```

For CJK search, consider using the `simple` tokenizer or adding ICU tokenizer support.

---

## 14. `is_binary_content` Null-Byte Heuristic Is Wrong for UTF-16

**Severity: LOW**

The `is_binary_content` function (Task 5) checks for null bytes in the first 8192 bytes:

```python
def is_binary_content(data: bytes, sample_size: int = 8192) -> bool:
    sample = data[:sample_size]
    return b'\x00' in sample
```

This produces **false positives** for:
- UTF-16 encoded text files (common on Windows) — every other byte is `\x00` for ASCII text
- UTF-32 encoded text files — three out of four bytes are `\x00`

And **false negatives** for:
- Small binary files without null bytes (e.g., some image headers)
- Binary files where the first 8KB happens to be text-like (e.g., SVG, some XML)

**Fix:** Add a BOM check before the null-byte test:

```python
def is_binary_content(data: bytes, sample_size: int = 8192) -> bool:
    if data[:2] in (b'\xff\xfe', b'\xfe\xff'):  # UTF-16 BOM
        return False
    if data[:3] == b'\xef\xbb\xbf':  # UTF-8 BOM
        return False
    sample = data[:sample_size]
    return b'\x00' in sample
```

---

## 15. `scan_directory` Skips Security Validation on Individual Files

**Severity: HIGH**

When an agent passes `dirs` parameter, `scan_directory()` recursively scans the directory and returns `FileInfo` objects with `local_path` set. But `scan_directory` only checks for:
- Ignored directory names (`.git`, `node_modules`, etc.)
- Hidden files (starting with `.`)

It does **not** check individual files against:
- `forbidden_paths` (a directory might contain a symlink to a forbidden path)
- `forbidden_patterns` (`.env` files in the scanned directory would be included)
- Maximum file count limits (a directory with 10,000 files would be scanned entirely before the limit check)

This means `peek create "test" --dir /home/user/project` would include `.env` files, SSH key copies, and any other sensitive files in the project directory.

**Fix:** Apply `validate_local_path()` to each file found by `scan_directory()`, and enforce file count limits during scanning (not after).

---

## 16. EntryView `fetchFileContent()` Uses Download Endpoint — Won't Get Text Content

**Severity: CRITICAL** (Adding engineering detail to CEO finding #4)

The `EntryView.vue` (Task 16) fetches file content via:

```typescript
async function fetchFileContent() {
  const resp = await fetch(downloadUrl.value)
  fileContent.value = await resp.text()
}
```

Where `downloadUrl` points to `GET /api/v1/entries/{slug}/files/{file_id}`.

The `files.py` handler returns:

```python
return Response(
    content=content,
    media_type="application/octet-stream",
    headers={"Content-Disposition": f'attachment; filename="{file_record.filename}"'},
)
```

Two problems:
1. **`Content-Disposition: attachment`** — browsers may handle this differently in `fetch()` context, but more importantly, this is semantically wrong. The frontend needs the file **inline**, not as a download.
2. **`media_type="application/octet-stream"`** — For a `.py` file, this should be `text/x-python`. For `.md`, it should be `text/markdown`. The wrong media type means the browser may apply incorrect encoding detection, especially for non-ASCII content (Chinese characters in code comments, for example).

The `resp.text()` call will work technically (it reads the response body as text regardless of Content-Type), but character encoding detection depends on the Content-Type header.

**Fix:** Add an `?inline=true` query parameter to the download endpoint, or add a separate content endpoint:

```python
@router.get("/{slug}/files/{file_id}")
async def get_file(slug: str, file_id: int, inline: bool = Query(False)):
    ...
    if inline:
        media_type = guess_text_type(file_record) or "text/plain"
        return Response(content=content, media_type=media_type)
    return Response(
        content=content,
        media_type="application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{file_record.filename}"'},
    )
```

---

## 17. Content-Disposition Header Injection

**Severity: MEDIUM**

The download endpoint (Task 10, `files.py`) constructs:

```python
headers={"Content-Disposition": f'attachment; filename="{file_record.filename}"'}
```

If `file_record.filename` contains a `"` character, the header is broken:

```
Content-Disposition: attachment; filename="file"with"quotes"
```

If it contains `\r\n`, it enables HTTP response splitting:

```
Content-Disposition: attachment; filename="file\r\nX-Injected: true"
```

**Fix:** Sanitize the filename or use RFC 5987 encoding:

```python
from urllib.parse import quote
safe_filename = quote(file_record.filename, safe='')
headers={"Content-Disposition": f"attachment; filename*=UTF-8''{safe_filename}"}
```

---

## 18. Module-Level `app = create_app()` Breaks Test Isolation

**Severity: HIGH** (Adding engineering detail to CEO finding #9)

The bottom of `main.py` (Task 10):

```python
app = create_app()
```

This runs on **import**, causing:
- `ensure_data_dirs(config)` — creates `~/.peek/data/` on disk
- `init_db(config.db_path)` — creates `~/.peek/peek.db` on disk
- Any test that imports `peek.main` (even transitively) triggers this

The CLI's `serve` command (Task 12) does `uvicorn.run("peek.main:app", ...)`, which imports the module and uses the module-level `app`. But tests use `create_app(data_dir=tmp, db_path=tmp)` to create isolated instances. If `peek.main` is imported before the test runs (e.g., by pytest discovery or any transitive import), the production database is created first.

The security test (Task 11) imports `from peek.main import create_app` — this import also executes `app = create_app()`, creating a production database.

**Fix:** Remove the module-level `app = create_app()`. Instead, create the app in the CLI:

```python
# cli.py
def serve(host, port):
    from peek.main import create_app
    app = create_app()
    uvicorn.run(app, host=h, port=p)  # Pass app object, not string
```

Use a factory pattern for production too:

```python
# peek/main.py
def create_app(...) -> FastAPI:
    ...
    return app

# Do NOT create app at module level
```

---

## 19. `validate_local_path` Is a Module-Level Function — Can't Be Configured Per-Request

**Severity: MEDIUM**

The `validate_local_path` function in the design doc is a standalone function that reads from module-level constants (`FORBIDDEN_PATHS`, `FORBIDDEN_PATTERNS`). But the plan also shows it accepting `forbidden_paths` and `forbidden_patterns` as arguments (Task 8 tests).

This creates an inconsistency: 
- If it's a standalone function, it can't use per-app configuration (e.g., custom forbidden paths from config.yaml)
- If it accepts parameters, every caller must pass the config values explicitly
- The `FileService` class should encapsulate this, but the plan puts `validate_local_path` as a module-level function

**Fix:** Make `validate_local_path` a method on `FileService` that uses `self.config.forbidden_paths` and `self.config.forbidden_patterns`:

```python
class FileService:
    def __init__(self, config: PeekConfig, storage: StorageManager):
        self.config = config
        self.storage = storage
    
    def validate_local_path(self, local_path: str) -> Path:
        resolved = Path(local_path).resolve()
        for forbidden in self.config.forbidden_paths:
            if str(resolved).startswith(str(forbidden)):
                raise ForbiddenPathError(...)
        ...
```

---

## 20. SQLite Connection Handling — No Session Lifecycle Management

**Severity: MEDIUM**

The plan uses `with Session(engine) as session:` everywhere, which creates a new connection for each session. For SQLite with WAL mode, this is mostly fine, but there are issues:

1. **No connection pool configuration** — The default `create_engine()` uses `StaticPool` for SQLite, which means a **single shared connection**. This means all sessions share one connection, and concurrent requests will block each other. If one session is in a transaction, another session will wait for the `busy_timeout` (5 seconds).

2. **PRAGMA statements are connection-level** — The `PRAGMA journal_mode=WAL` and `PRAGMA foreign_keys=ON` are set once during `init_db()`, but with `StaticPool`, they persist. If the engine is recreated (e.g., in tests), the PRAGMAs must be re-applied.

3. **No explicit connection pool for async compatibility** — The plan uses `AsyncClient` for API tests but the database operations are synchronous (`Session` from SQLModel). This works because FastAPI runs sync endpoints in a thread pool, but it means the `busy_timeout` is the only guard against concurrent write contention.

**Fix:** Use `connect_args` to set PRAGMAs permanently:

```python
engine = create_engine(
    f"sqlite:///{db_path}",
    connect_args={"check_same_thread": False},
    pool_pre_ping=True,
)

@event.listens_for(engine, "connect")
def set_sqlite_pragmas(dbapi_conn, connection_record):
    cursor = dbapi_conn.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA busy_timeout=5000")
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()
```

---

## 21. Conftest.py Ordering Breaks Test Execution (Detail on CEO Finding #7)

**Severity: HIGH**

The CEO flagged that conftest.py is Task 13 but needed from Task 2. Here's the specific impact:

- **Tasks 2-12** each define their own local fixtures (e.g., `test_api.py` defines its own `client` fixture, `test_security.py` defines another `client` fixture, `test_integration.py` defines yet another)
- This means **3 separate `async client` fixtures** with slightly different configurations, defined in 3 different test files
- When conftest.py is finally created in Task 13, it provides `temp_data_dir` and `sample_files` but NOT the `client` fixture — meaning the duplication persists even after Task 13

The conftest.py in Task 13 is nearly useless — it only provides:
1. `temp_data_dir` — a `TemporaryDirectory` wrapper
2. `sample_files` — creates 4 files in `temp_data_dir`

Neither of these is used by any test in the plan. The API tests, security tests, and integration tests all define their own `client` fixture with `create_app(data_dir=tmp_path / "data", db_path=tmp_path / "test.db")`.

**Fix:** Move the `async client` fixture to conftest.py and make it the single source of truth:

```python
# conftest.py
@pytest.fixture
async def client(tmp_path):
    data_dir = tmp_path / "data"
    data_dir.mkdir()
    db_path = tmp_path / "test.db"
    app = create_app(data_dir=data_dir, db_path=db_path)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
```

Create this in Task 2 (or a new Task 0) before any other tests.

---

## 22. `cleanup_expired` Commits Per-Entry Instead of Batch

**Severity: LOW**

The `cleanup_expired` function (Task 18):

```python
for entry in expired:
    try:
        session.delete(entry)
        session.commit()  # ← Per-entry commit
    except Exception as e:
        session.rollback()
        continue
```

This commits after each entry deletion. If there are 100 expired entries, this performs 100 separate transactions. For SQLite with WAL mode, each commit requires a WAL checkpoint, which is a disk I/O operation.

**Fix:** Batch the deletions in a single transaction, with per-entry error handling:

```python
cleaned = 0
with Session(engine) as session:
    expired = session.exec(select(Entry).where(...)).all()
    for entry in expired:
        try:
            session.delete(entry)
            cleaned += 1
        except Exception:
            session.rollback()
            continue
    try:
        session.commit()
    except Exception:
        session.rollback()
        return 0
    
# After successful commit, delete files
for entry_id in deleted_ids:
    try:
        storage.delete_entry_files(entry_id)
    except Exception:
        logger.error(...)
```

---

## 23. No Database Migration Strategy

**Severity: MEDIUM**

The `init_db()` function uses `SQLModel.metadata.create_all(engine)`, which creates tables if they don't exist but **never alters existing tables**. When v0.2 adds new columns (e.g., `Entry.view_count`, `File.encoding`), the production database won't be updated.

The plan has no migration tool (Alembic, etc.) and no schema versioning. The first schema change will require either:
- Manual `ALTER TABLE` SQL
- Dropping and recreating the database (data loss)
- Adding Alembic retroactively (complex)

**Fix:** Add `alembic` as a dependency now, even if there's only one migration. The cost is minimal and the payoff is significant when v0.2 development begins.

---

## 24. `tags` Field JSON Serialization Inconsistency

**Severity: MEDIUM**

The `Entry` SQLModel stores `tags` as `TEXT DEFAULT '[]'` (a JSON string). The plan's code uses `json.dumps(data["tags"])` to serialize and presumably `json.loads(entry.tags)` to deserialize. But:

1. **FTS5 trigger** inserts `new.tags` (the raw JSON string) into the FTS index, tokenizing the brackets and quotes
2. **API response** must return `tags` as a JSON array, not a string — the response builder must call `json.loads()`
3. **SQLModel** might auto-serialize `list[str]` fields, but the plan defines `tags` as `str` type, not `list[str]`

If `tags` is defined as `str` in the model, the API will return `"tags": "[\"python\", \"auth\"]"` (a string containing JSON), instead of `"tags": ["python", "auth"]` (a JSON array).

**Fix:** Define tags properly in the SQLModel and use a custom validator:

```python
class Entry(SQLModel, table=True):
    tags: str = Field(default="[]")  # DB storage as JSON string
    
    @property
    def tag_list(self) -> list[str]:
        return json.loads(self.tags) if self.tags else []
```

Or use SQLModel's JSON column type:

```python
from sqlmodel import Column, JSON

class Entry(SQLModel, table=True):
    tags: list[str] = Field(default=[], sa_column=Column(JSON))
```

---

## 25. Frontend Build Artifact Not Served in Production

**Severity: HIGH**

The design doc (§14.2) says: "Frontend builds, then FastAPI serves static files." But `main.py` (Task 10) has **no static file serving code**. The `create_app()` function only mounts API routes and the health check.

Task 17's title mentions "Modify: `backend/peek/main.py` (add static file serving for built frontend)" but the actual task content only creates an integration test — it never adds the static file serving code.

Without this, running `peek serve` in production (after `npm run build`) serves only the API. Visiting `http://localhost:8080/` returns 404. The SPA is unreachable.

**Fix:** Add static file serving to `create_app()`:

```python
from fastapi.staticfiles import StaticFiles

def create_app(...) -> FastAPI:
    ...
    # Mount frontend static files (production)
    static_dir = Path(__file__).parent.parent / "static"
    if static_dir.exists():
        app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")
```

**Important:** The static file mount must come **after** API routes, or it will intercept API requests. Use `app.mount("/", ...)` only after all API routers are included.

---

## 26. `scan_directory` Rejects All Hidden Files — Overly Aggressive

**Severity: LOW**

The `scan_directory` function (design doc §4.5):

```python
if any(part.startswith(".") for part in path.parts):
    continue
```

This rejects ALL files with any path component starting with `.`, including:
- `.github/workflows/ci.yml` — useful for showing CI configuration
- `.vscode/settings.json` — useful for showing editor config
- `.eslintrc.js`, `.prettierrc` — useful for showing project tooling

The hidden file check should only apply to the **directory name** being traversed, not the full path. And some dotfiles are legitimately useful to share.

**Fix:** Only skip hidden **directories** (already covered by `IGNORED_DIRS` for specific ones), and allow hidden files to be included with an opt-in flag, or at minimum only skip files whose **immediate parent** is a hidden directory:

```python
# Skip only if the directory component is hidden AND not the root being scanned
for part in path.relative_to(root).parent.parts:
    if part.startswith(".") and part not in {".github", ".vscode"}:
        continue  # skip this file
```

---

## 27. Frontend API Client Doesn't Handle Non-JSON Error Responses

**Severity: MEDIUM**

The `client.ts` (Task 15):

```typescript
if (!resp.ok) {
  const err: PeekError = await resp.json()  // ← Crashes if response is not JSON
  throw new Error(err.error?.message || `HTTP ${resp.status}`)
}
```

If the server returns a non-JSON error (e.g., 502 from a reverse proxy, or a 422 from FastAPI's built-in validation that doesn't go through the PeekError handler), `resp.json()` will throw a `SyntaxError`. This is unhandled and will surface as an uncaught promise rejection.

FastAPI's default 422 validation errors return a different JSON structure (`{"detail": [...]}`) that doesn't match `PeekError`. These would be silently misinterpreted.

**Fix:**

```typescript
if (!resp.ok) {
  let message = `HTTP ${resp.status}`
  try {
    const data = await resp.json()
    if (data.error?.message) message = data.error.message
    else if (data.detail) message = data.detail.map(d => d.msg).join(', ')
  } catch {}
  throw new Error(message)
}
```

---

## 28. CORS Middleware Added Unconditionally — Blocks Production

**Severity: MEDIUM**

The `create_app()` function (Task 10) always adds CORS middleware:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    ...
)
```

In production, the frontend is served from the same origin (FastAPI static files), so CORS is unnecessary. But more importantly, the hardcoded `http://localhost:5173` origin means:

1. **Development from non-localhost** (e.g., `http://192.168.1.100:5173`) is blocked
2. **Production with a reverse proxy** at a different origin is blocked
3. The CORS headers are sent even for production API responses (waste of bytes, potential security concern)

**Fix:** Make CORS conditional:

```python
if config.server_host == "127.0.0.1":  # Dev mode
    app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173"], ...)
```

Or better, make allowed origins configurable:

```python
if config.cors_origins:
    app.add_middleware(CORSMiddleware, allow_origins=config.cors_origins, ...)
```

---

## 29. `expires_in` Parsing — No Validation of Unreasonable Values

**Severity: LOW**

The `parse_expires_in` function (mentioned in Task 8) parses duration strings like `"7d"`, `"1h"`. But there's no validation for:

- **Zero or negative durations** — `"0d"` would set `expires_at` to the current time, immediately expiring the entry
- **Absurdly large durations** — `"999999d"` would set `expires_at` far in the future, potentially causing datetime overflow
- **Mixed format** — `"1d12h"` is ambiguous — is it 1.5 days or an error?

**Fix:** Add bounds checking:

```python
def parse_expires_in(expires_in: str) -> datetime:
    delta = _parse_duration(expires_in)
    if delta.total_seconds() < 60:
        raise ValidationError("Minimum expiry is 1 minute")
    if delta.days > 365:
        raise ValidationError("Maximum expiry is 365 days")
    return datetime.now(timezone.utc) + delta
```

---

## 30. CLI `create` Command Checks `resp.status_code == 200` Instead of 201

**Severity: LOW**

The CLI's `create` command (Task 12):

```python
if resp.status_code == 200:
    click.echo(f"✅ Created: {data['url']}")
```

But the API route for `POST /entries` should return **201 Created**, not 200 OK. The plan's API test (Task 10) checks for 200. This is a REST semantics issue — POST creating a resource should return 201.

**Fix:** Change the API route to return 201:

```python
@router.post("", status_code=201)
async def create_entry(...):
    ...
```

And update the CLI to check for `resp.status_code in (200, 201)`.

---

## Summary Scorecard

| # | Finding | Severity | Category |
|---|---------|----------|----------|
| 1 | Symlink validation checks resolved path, not original | CRITICAL | Security |
| 2 | Path traversal test incompatible with function signature | HIGH | Security/Testing |
| 3 | `files.path` allows traversal escaping entry directory | CRITICAL | Security |
| 4 | Shiki highlighter created per-file (WASM re-loaded each time) | HIGH | Performance |
| 5 | Shiki dual-theme output doesn't match CSS theme switching | HIGH | Frontend |
| 6 | No transaction wrapping for entry creation | HIGH | Database |
| 7 | `get_engine()` undefined — routes will fail at import | CRITICAL | Architecture |
| 8 | `EntryCreate`/`EntryUpdate` Pydantic models never defined | HIGH | API |
| 9 | Entry creation fails — missing required `created_at`/`updated_at` | HIGH | Database |
| 10 | `line_count` field in response but not in DB model | MEDIUM | API |
| 11 | `update_entry` deletes DB records but not filesystem files | HIGH | Architecture |
| 12 | Slug conflict TOCTOU race condition | MEDIUM | Concurrency |
| 13 | FTS5 tags column contains JSON syntax noise | MEDIUM | Database |
| 14 | `is_binary_content` false positives for UTF-16 | LOW | Logic |
| 15 | `scan_directory` skips security validation on individual files | HIGH | Security |
| 16 | File content endpoint returns attachment, frontend needs inline | CRITICAL | API/Frontend |
| 17 | Content-Disposition header injection via filename | MEDIUM | Security |
| 18 | Module-level `app = create_app()` breaks test isolation | HIGH | Architecture |
| 19 | `validate_local_path` can't use per-app configuration | MEDIUM | Architecture |
| 20 | SQLite connection handling — no event-based PRAGMA setup | MEDIUM | Database |
| 21 | Conftest.py useless — duplicated client fixture in 3 test files | HIGH | Testing |
| 22 | `cleanup_expired` commits per-entry instead of batch | LOW | Performance |
| 23 | No database migration strategy | MEDIUM | Architecture |
| 24 | Tags JSON serialization inconsistency between DB and API | MEDIUM | API |
| 25 | No static file serving in production — SPA unreachable | HIGH | Architecture |
| 26 | `scan_directory` rejects all hidden files overly aggressively | LOW | Logic |
| 27 | Frontend API client crashes on non-JSON error responses | MEDIUM | Frontend |
| 28 | CORS hardcoded to localhost:5173, blocks production | MEDIUM | Configuration |
| 29 | `expires_in` parsing has no bounds checking | LOW | Validation |
| 30 | API returns 200 instead of 201 for resource creation | LOW | API |

**Counts by severity:** CRITICAL: 4 | HIGH: 11 | MEDIUM: 11 | LOW: 4

---

## Top 10 Priority Fixes (Engineering-Critical, Before Task 7)

These must be fixed in the plan before implementation begins, as they affect the foundational architecture:

1. **#7: Define `get_engine()` in `database.py`** — Without this, no API route works
2. **#8: Define `EntryCreate`/`EntryUpdate` Pydantic models** — Without this, no API endpoint can validate input
3. **#3: Validate `files.path` against directory traversal** — Critical security hole that allows writing to arbitrary filesystem paths
4. **#16: Add inline file content endpoint** — Without this, the frontend literally cannot render file content
5. **#6: Wrap entry creation in proper transaction with rollback** — Prevents partial writes and orphan files
6. **#18: Remove module-level `app = create_app()`** — Breaks testing and creates production database on import
7. **#1: Fix symlink validation to check original path** — Current code never catches symlinks
8. **#9: Add default factories for `created_at`/`updated_at`** — Entry creation will fail without this
9. **#25: Add static file serving for production** — SPA is unreachable without it
10. **#5: Bridge Shiki dual-theme CSS with Peek's theme system** — Code blocks won't switch themes without this
