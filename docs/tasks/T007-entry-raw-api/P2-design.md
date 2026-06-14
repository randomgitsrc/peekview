---
phase: P2
task_id: T007
parent: P1-requirements.md
trace_id: T007-P2-20260614
---

# P2 方案设计 — T007 Entry Raw API

## 声明字段

```yaml
packages: [peekview]
domains: [backend, frontend]
ui_affected: true
gate_commands:
  P5: "pytest backend/tests/ -q --tb=short"
  P5_e2e: "npx playwright test --reporter=list"
  P6: "pytest backend/tests/test_raw_api.py -q"
env_constraints:
  debug_env: "make debug（:8888，/tmp/peekview-debug/）"
```

---

## 一、后端：新增 `/api/v1/entries/{slug}/raw` 路由

### 1.1 实现位置

在 `backend/peekview/api/files.py` 新增路由（复用现有 router prefix `/api/v1/entries`），不新建文件。

### 1.2 Response Model（新增，不污染现有 EntryResponse）

```python
# 在 backend/peekview/models.py 新增

class RawFileItem(SQLModel):
    """单个文件的原始内容，用于 /raw 接口。"""
    id: int
    filename: str
    path: str | None
    language: str | None
    is_binary: bool
    size: int
    content: str | None          # 文本文件：UTF-8 字符串；二进制：None
    content_encoding: str | None # 文本文件："utf-8"；二进制：None
    file_url: str | None         # 二进制文件：指向 /files/{id}/content；文本：None

class EntryRawResponse(SQLModel):
    """GET /api/v1/entries/{slug}/raw 的响应体。"""
    slug: str
    summary: str
    tags: list[str]
    created_at: datetime
    files: list[RawFileItem]     # 统一用 files 数组，单文件也是长度为 1
    raw_url: str                 # 本接口自身的 URL（方便 Agent 缓存/引用）
```

**设计决策**：
- 不区分 `content_type: single/multi`，统一用 `files` 数组，Agent 处理逻辑统一
- `content_encoding` 明确声明编码，避免 Agent 猜测
- `raw_url` 自引用，方便 Agent 不用自己拼 URL

### 1.3 认证逻辑

完全复用 `files.py` 现有的 `_resolve_entry()` 函数——已处理：
- 公开 entry：无需认证
- 私有 entry：需要 API Key（Bearer token 或 httpOnly Cookie）
- 不存在 / 无权限：统一返回 404（防止 slug 枚举攻击）

```python
@router.get("/{slug}/raw", response_model=EntryRawResponse)
async def get_entry_raw(
    slug: str,
    request: Request,
    current_user: User | None = Depends(get_current_user),
):
    entry_id = _resolve_entry(request, slug, current_user)  # 复用，已有认证+404逻辑
    # ... 读取文件内容，组装 EntryRawResponse
```

### 1.4 文件内容读取与安全处理

**文本文件**：

```python
raw_bytes = storage.read_file(entry_id, file_record.filename, file_record.path)
content_str = raw_bytes.decode("utf-8", errors="replace")
# errors="replace" 而非 "strict"：保证接口不会因为边缘编码问题崩溃
```

**JSON 序列化安全**：Python 的 `json.dumps()`（FastAPI/Pydantic 底层）默认处理：
- `\n \t \r` → 自动转义为 `\n \t \r`（JSON 字符串内合法）
- `"` → `\"`
- `\` → `\\`
- Unicode 控制字符 → `\uXXXX`

**唯一需要额外处理的**：`</script>` 序列。虽然本接口返回的是 `application/json` 而非 HTML，但如果未来响应被嵌入 HTML 上下文（比如内联到页面），`</script>` 可能提前关闭 script 标签导致 XSS。

处理方式：在 FastAPI 的 JSONResponse 里用 `json.dumps(..., ensure_ascii=False)` 并对结果做一次替换：

```python
import json
from fastapi.responses import JSONResponse

serialized = json.dumps(response_data, ensure_ascii=False, default=str)
serialized = serialized.replace("</", "<\\/")  # 防御性处理
return Response(content=serialized, media_type="application/json; charset=utf-8")
```

**二进制文件**：

```python
if file_record.is_binary:
    file_url = f"{base_url}/api/v1/entries/{slug}/files/{file_record.id}/content"
    return RawFileItem(
        ...,
        content=None,
        content_encoding=None,
        file_url=file_url,
    )
```

### 1.5 大文件处理

不截断内容，与现有 download 接口一致。超大响应由调用方（Agent）自行处理。未来若有需要可加 `?max_size=N` 参数，本期不做。

---

## 二、前端：ActionBar 加 Raw 按钮

### 2.1 改动位置

`frontend-v3/src/views/EntryDetailView.vue`

desktop 按钮区（约第 60 行的 `.actions.desktop-only` 区块）和 mobile 菜单区各加一个 `<a>` 标签：

```html
<a
  v-if="entryStore.currentEntry"
  class="btn btn-sm"
  :href="`/api/v1/entries/${entryStore.currentEntry.slug}/raw`"
  target="_blank"
  rel="noopener noreferrer"
  title="Raw content — for Agent/API access"
>
  Raw
</a>
```

**设计决策**：
- 用 `<a>` 不用 `<button>`：语义正确（导航到新 URL），且 href 直接在 HTML 里，WebFetch 转 Markdown 后会保留为 `[Raw](url)` 链接
- `target="_blank"` + `rel="noopener noreferrer"`：安全标准做法
- 不加特殊样式，与其他 btn-sm 保持一致

### 2.2 `<link rel="alternate">` 注入（锦上添花）

在 `EntryDetailView.vue` 的 `onMounted` 或 watch entry 时动态插入：

```javascript
watch(() => entryStore.currentEntry, (entry) => {
  // 清理旧的
  document.querySelectorAll('link[data-peekview-raw]').forEach(el => el.remove())
  if (entry) {
    const link = document.createElement('link')
    link.rel = 'alternate'
    link.type = 'application/json'
    link.href = `/api/v1/entries/${entry.slug}/raw`
    link.setAttribute('data-peekview-raw', '1')
    document.head.appendChild(link)
  }
}, { immediate: true })
```

这对 WebFetch 无效（不读 `<head>`），但对支持 content negotiation 的工具有帮助，成本几乎为零。

---

## 三、影响域确认

| 文件 | 改动类型 | 说明 |
|------|---------|------|
| `backend/peekview/models.py` | 新增 | `RawFileItem`、`EntryRawResponse` 两个 model |
| `backend/peekview/api/files.py` | 新增路由 | `GET /{slug}/raw` |
| `frontend-v3/src/views/EntryDetailView.vue` | 修改 | desktop + mobile 各加 Raw 按钮，加 `<link>` 注入 |
| `backend/tests/test_raw_api.py` | 新增 | P3 TDD 测试文件 |

**不改动**：
- `entry_service.py`：认证逻辑复用 `_resolve_entry()`，不需要改 service
- `storage.py`：`read_file()` 接口已满足需求
- MCP server：本期不新增 MCP 工具
- 现有 API 路由：零破坏性改动

---

## 四、安全设计汇总

| 风险 | 处理方式 |
|------|---------|
| 私有 entry 未授权访问 | 复用 `_resolve_entry()`，统一返回 404 |
| JSON 字符串内 `</script>` 注入 | `serialized.replace("</", "<\\/")` |
| UTF-8 解码失败（非法字节序列）| `errors="replace"` 替换非法字节为 U+FFFD |
| 超大响应耗尽内存 | 本期不截断，与 download 接口一致；streaming 留待未来 |
| slug 枚举攻击 | 不存在/无权限统一 404（现有逻辑） |
| XSS（`<a>` href 注入）| href 是服务端拼接的固定路径，不含用户输入 |
