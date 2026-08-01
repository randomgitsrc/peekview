"""PeekView Entry Service — 核心业务逻辑。"""

from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from sqlmodel import Session, select
from sqlalchemy import text

from peekview.models import Entry, File, EntryCreate, EntryResponse
from peekview.language import detect_language, is_binary_content
from peekview.storage import StorageBackend
from peekview.config import get_settings


class EntryService:
    """管理 entry 生命周期：创建、读取、搜索、删除。"""

    def __init__(self, session: Session, storage: StorageBackend) -> None:
        self.session = session
        self.storage = storage
        self.settings = get_settings()

    def create_entry(
        self,
        summary: str,
        slug: str,
        files: list[dict[str, Any]],
        tags: list[str] | None = None,
        is_public: bool = True,
        user_id: int | None = None,
        idempotency_key: str | None = None,
    ) -> Entry:
        """创建新 entry，支持幂等性。"""
        if idempotency_key:
            existing = self.session.exec(
                select(Entry).where(Entry.idempotency_key == idempotency_key)
            ).first()
            if existing:
                return existing

        entry = Entry(
            summary=summary,
            slug=slug,
            tags=tags or [],
            is_public=is_public,
            user_id=user_id,
            idempotency_key=idempotency_key,
            status="active",
        )
        self.session.add(entry)
        self.session.flush()  # 获取 entry.id

        for file_data in files:
            filename = file_data["filename"]
            content = file_data.get("content", "")
            if "content_base64" in file_data:
                import base64
                content = base64.b64decode(file_data["content_base64"]).decode(
                    "utf-8", errors="replace"
                )

            language = detect_language(filename)
            is_binary = is_binary_content(
                content.encode() if isinstance(content, str) else content
            )

            file = File(
                entry_id=entry.id,
                filename=filename,
                content=content if not is_binary else None,
                language=language,
                is_binary=is_binary,
                size=len(content.encode() if isinstance(content, str) else content),
            )
            self.session.add(file)

        # 更新 FTS5 索引
        self._update_fts_index(entry)

        self.session.commit()
        return entry

    def get_entry(self, slug: str) -> Entry | None:
        """根据 slug 获取 entry，含文件列表。"""
        stmt = select(Entry).where(Entry.slug == slug, Entry.status != "deleted")
        return self.session.exec(stmt).first()

    def list_entries(
        self,
        *,
        tags: list[str] | None = None,
        search: str | None = None,
        is_public: bool | None = None,
        user_id: int | None = None,
        offset: int = 0,
        limit: int = 20,
    ) -> tuple[list[Entry], int]:
        """列出 entry，支持标签过滤、全文搜索、分页。"""
        stmt = select(Entry).where(Entry.status == "active")

        if is_public is not None:
            stmt = stmt.where(Entry.is_public == is_public)
        if user_id is not None:
            stmt = stmt.where(Entry.user_id == user_id)

        if tags:
            # JSON 数组精确匹配（不使用 LIKE）
            for tag in tags:
                stmt = stmt.where(
                    text(
                        "EXISTS(SELECT 1 FROM json_each(entries.tags) "
                        "WHERE json_each.value = :tag)"
                    ).bindparams(tag=tag)
                )

        if search:
            # FTS5 全文搜索
            stmt = stmt.join(
                text("entries_fts ON entries_fts.rowid = entries.id")
            ).where(text("entries_fts MATCH :query").bindparams(query=search))

        # 总数
        count_stmt = select(Entry).where(Entry.status == "active")
        total = len(list(self.session.exec(count_stmt).all()))

        # 分页
        stmt = stmt.offset(offset).limit(limit).order_by(Entry.created_at.desc())
        entries = list(self.session.exec(stmt).all())
        return entries, total

    def delete_entry(self, slug: str) -> bool:
        """软删除 entry（标记为 deleted）。"""
        entry = self.get_entry(slug)
        if not entry:
            return False
        entry.status = "deleted"
        self.session.add(entry)
        self.session.commit()
        return True

    def archive_entry(self, slug: str) -> bool:
        """归档 entry。"""
        entry = self.get_entry(slug)
        if not entry:
            return False
        entry.status = "archived"
        self.session.add(entry)
        self.session.commit()
        return True

    def _update_fts_index(self, entry: Entry) -> None:
        """更新 FTS5 全文索引。"""
        search_text = f"{entry.summary} {' '.join(entry.tags or [])}"
        search_text = search_text.replace('"', '""')
        self.session.execute(
            text(
                "INSERT OR REPLACE INTO entries_fts(rowid, content) "
                "VALUES (:id, :content)"
            ).bindparams(id=entry.id, content=search_text)
        )

    def get_raw_content(self, slug: str, filename: str) -> dict | None:
        """获取文件的原始内容（Agent 读路径）。"""
        entry = self.get_entry(slug)
        if not entry:
            return None
        for f in entry.files:
            if f.filename == filename:
                return {
                    "filename": f.filename,
                    "language": f.language,
                    "content": f.content if not f.is_binary else None,
                    "file_url": f"/api/v1/files/{f.id}" if f.is_binary else None,
                    "size": f.size,
                }
        return None


# 使用示例
if __name__ == "__main__":
    from peekview.database import get_session
    from peekview.storage import LocalStorage

    session = next(get_session())
    storage = LocalStorage(Path("./data"))
    service = EntryService(session, storage)

    entry = service.create_entry(
        summary="示例 entry",
        slug="example-001",
        files=[{"filename": "main.py", "content": "print('hello')"}],
        tags=["python", "示例"],
        is_public=True,
    )
    print(f"Created entry: {entry.slug} (id={entry.id})")

    found = service.get_entry("example-001")
    print(f"Found: {found.summary}, files: {len(found.files)}")

    entries, total = service.list_entries(search="示例")
    print(f"Search results: {total} entries")
