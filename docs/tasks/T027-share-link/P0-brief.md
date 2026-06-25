---
phase: P0
task_id: T027
task_name: share-link
trace_id: T027-P0-20260625
created: 2026-06-25
---

# P0 任务简报 — T027 share-link

## task

**一句话（工程视角）**：为 private entry 实现"临时分享链接"功能（路径 C，非密码）—— 后端 `entry_shares` 表 + 3 端点（生成/列表/批量撤销）+ private→public 自动撤销；前端 EntryDetailView owner 视角加分享管理面板（生成对话框 + 列表 + 勾选批量撤销）；访问 `?share={token}` 凭 16 字符密码学 token 即可（无需登录）。

**详细**：

为 private entry 实现"临时分享链接"功能（GitHub gist / GitLab snippet 模式），让 owner 可以：

1. 生成一个临时链接（`/{slug}?share={token}`）
2. 选择有效期（1h / 24h / 7d / 30d / 永久）
3. 选择 view 次数限制（不限 / N 次）
4. 分享链接发给特定人（IM/邮件）
5. 凭链接可访问（**无需登录**，无需密码）
6. Owner 可撤销单个 / 批量
7. 详情页显示"由 @username 分享"水印
8. Owner 看到 view_count 统计

**关键路径选择**：已与用户确认走 **C 路径（临时链接）** 而非 A 路径（密码）。理由：
- 一步分享（链接即凭证）vs 两步（链接+码）
- 16 字符 token 密码学强度，不可暴力破解
- 撤销能力更强（删 token = 链接全死）
- 与 PeekView 现有"URL 即凭证"模型一致

## user_decisions

1. **路径 C**（临时链接，非密码）— 用户明确同意
2. **有效期选项**：1h / 24h / 7d / 30d / 永久，**默认 7d**
3. **view 次数限制**：不限 / N 次，**默认不限**
4. **批量撤销**：支持（前端"分享管理"面板，勾选 + 一键撤销）
5. **嵌入详情页**：不新开 `/settings/shares` 独立页（轻量原则）
6. **owner 水印**：分享出去的页面显示"由 @username 分享"
7. **view_count 显示**：owner 在分享管理面板看到"已被查看 N 次"
8. **private → public 自动撤销**：所有该 entry 的 active shares 在同一事务内撤销，响应加 `revoked_shares: N`
9. **public → private 保留**：已发出的链接继续有效（朋友不能突然看不到）
10. **删除 entry 级联删 share**：FK 即可
11. **不做**：密码访问、邮箱白名单、单次查看强制、阅后即焚、设备限制

## known_risks

### 安全

- **token 密码学随机**：用 `secrets.token_urlsafe(12)`（12 字节 = 16 base64 字符 = 96 bits 强度），**不可暴力**
- **不需要 bcrypt**（不像 A 路径需要 6 位提取码限速）
- **不需要暴力破解限速**（token 空间太大）
- **token 不存明文**：存 SHA256 hash（即使数据库泄露，token 也不可还原）
- **不查询时序攻击**：用 `hmac.compare_digest` 比对 hash
- **session/cookie 隔离**：share 访问的临时 cookie 与登录 cookie 独立命名空间（避免与登录用户冲突）
- **share 访问不下发完整用户态**：只设一个标记 cookie 表示"此设备已通过 share 验证"

### 数据一致性

- **private → public 自动撤销**：在 `entry_service.update_entry` 事务内，检测 `is_public` 从 `false→true`，撤销该 entry 所有 active shares
- **响应加 `revoked_shares: N`**：前端 toast 提示
- **删除 entry 级联删 shares**：SQLAlchemy `cascade="all, delete-orphan"`
- **share 撤销不物理删除**：加 `revoked_at` 字段（NULL = active），保留审计
- **share 撤销后 view_count 不再 +1**：但保留历史 view_count

### 业务逻辑

- **token 唯一性**：DB 唯一索引（哈希后唯一）
- **view_count 原子增加**：用 SQL `UPDATE ... SET view_count = view_count + 1`，避免并发问题
- **max_views 边界检查**：每次访问前查 `view_count < max_views`
- **expires_at 边界检查**：每次访问前查 `expires_at > now`
- **private entry 永久有效 vs share 过期**：如果 entry 还在 + share 未过期 + share 未撤销 → 可访问
- **public entry 的 share 行为**：T024 决定 private→public 自动撤销，撤销后 share 不能用
- **已撤销的 share token 重用**：理论上同一 entry 撤销后再生新 share 用新 token（无冲突）

### 前端

- **分享管理面板位置**：EntryDetailView 的 owner 视角，在现有 `entry-actions` 区域新增
- **生成对话框**：模态浮层（`<Teleport to="body">`，参考 LoginDialog）
- **链接显示与复制**：生成后显示完整 URL + "Copy" 按钮
- **批量撤销 UX**：列表 + 复选框 + 批量按钮（参考 macOS Finder 多选）
- **详情页 share 访问 UX**：`?share={token}` 访问时显示水印，不显示 owner 专属操作按钮
- **未登录 share 访问**：直接显示内容，不要求登录
- **已登录 share 访问**：仍显示水印（"通过临时链接分享"）
- **owner 自己 share 访问**：不显示水印（owner 永远有完整访问权）
- **share cookie 命名**：`peekview_share_{entry_id}_{token_prefix}` 或类似（不与登录 cookie 冲突）
- **share cookie 过期**：与 share 过期时间一致
- **share cookie 撤销**：owner 撤销时，后端清掉所有匹配 cookie（无法精准清，但下次该 token 验证失败就进不去）

### 与现有功能冲突

- **CSP 兼容**：分享管理面板不引入内联事件
- **T021 zen-mode**：T021 改 EntryDetailView 头部/侧栏，**T027 也改 EntryDetailView**（加分享面板）。**T027 必须在 T021 完成 P4 后再启动**
- **T020 XSS 净化**：分享出去的详情页仍要走 T020 净化（svg DOMPurify），**不能丢**
- **T022 重构**：T022 重构 MarkdownViewer 等，**T027 与 T022 互不干扰**（T027 不动 MarkdownViewer）

## executor_env

- platform: opencode
- has_task_tool: true
- has_local_runtime: true
- network: full

## env_constraints

- debug_env:
  - 后端测试：`cd backend && .venv/bin/python -m pytest tests/`
  - 前端测试：`cd frontend-v3 && ./node_modules/.bin/vitest run`
  - 前端构建：`cd frontend-v3 && npm run build`
  - 前端类型检查：`cd frontend-v3 && npx vue-tsc --noEmit`（CI 强制）
  - Playwright E2E：`make debug-test`（需 debug backend 运行）
  - **严禁** pip3 install --break-system-packages -e .（AGENTS.md 铁律 5）
  - **严禁** 用 CLI 创建测试 entry
  - **严禁** 直接 sqlite3 操作生产数据库

## pruning_tendency

**保守** — T027 是大块头：后端新表 + 3 端点 + 安全 token + private→public hook，前端分享管理面板 + 多处 UX 决策。涉及**安全敏感**（token 生成/存储/验证）和**多 agent 协调**（T021 改 EntryDetailView）。T020 P6 PAUSED 教训：subagent 自我报告不可信，主 Agent 必须亲自 gate。P3-P8 不裁剪。

## phase_hint

[P1, P2, P3, P4, P5, P6, P7, P8]（**所有阶段不裁剪**）

**理由**：
- 涉及后端新表 + 端到端 + 安全
- T020 P6 PAUSED 教训：subagent 自我报告不可信，主 Agent 必须亲自 gate
- 行为保真硬约束：分享出去的页面行为必须与 owner 视角一致（除 owner 专属按钮外）
- 端到端场景多：创建 share / 输链接 / 看 / 撤销 / 失效 / view_count / private→public 自动撤销

## 范围声明

### 后端

- ① 新表 `entry_shares`（SQLModel + Pydantic schemas）
  ```
  id, slug (FK entries.slug), token_hash (SHA256, UNIQUE), 
  expires_at (nullable for permanent), max_views (nullable for unlimited), 
  view_count (default 0), revoked_at (nullable), 
  created_by_user_id (FK users.id), created_at
  ```
- ② 数据库迁移：`database.py` 加 `entry_shares` 表 + 索引
- ③ `peekview/services/share_service.py`（新文件）：
  - `create_share(slug, user_id, expires_in, max_views) -> ShareResponse`
  - `list_shares(slug, user_id) -> List[ShareResponse]`
  - `revoke_shares(slug, user_id, share_ids: List[int]) -> int` (返回撤销数量)
  - `verify_share_token(slug, token) -> bool`（内部用：检查过期、撤销、max_views）
  - `increment_view_count(share_id)`（原子 +1）
  - `revoke_all_shares_for_entry(slug)`（private→public 时调用）
- ④ `peekview/api/shares.py`（新文件，路由）：
  - `POST /api/v1/entries/{slug}/shares` — owner 创建
  - `GET /api/v1/entries/{slug}/shares` — owner 列表
  - `POST /api/v1/entries/{slug}/shares/revoke` — owner 批量撤销（body: `{share_ids: [...]}`）
- ⑤ `peekview/services/entry_service.py`：在 `update_entry` 内
  - 检测 `is_public: false→true`
  - 调用 `revoke_all_shares_for_entry(slug)` 撤销该 entry 所有 active shares
  - 响应加 `revoked_shares: N` 字段
- ⑥ `peekview/api/entries.py`：在 `get_entry`（detail）路由内
  - 检测 `?share={token}` query param
  - 调用 `verify_share_token` 验证
  - 验证通过：允许访问（private entry 通过 share token 也可看）
  - 验证失败：401 / 404
- ⑦ Token 生成：`secrets.token_urlsafe(12)`（12 字节随机，16 字符 base64）
- ⑧ Token 存储：DB 存 `hashlib.sha256(token.encode()).hexdigest()`（不存明文）
- ⑨ Share cookie：detail 路由验证通过后 set cookie（`peekview_share_{entry_id}`，值是 token 前 8 字符，HTTPOnly，SameSite=Lax）
- ⑩ 后端单测：15-20 个测试覆盖
  - 创建 share 权限（owner only）
  - token 验证正确/错误/过期/撤销/超 max_views
  - 批量撤销
  - private→public 自动撤销
  - public→private 保留
  - 删除 entry 级联
  - view_count 原子增加
  - 未登录 share 访问
  - 已登录 share 访问

### 前端

- ⑪ `api/client.ts` 新增 `shareApi` 模块
- ⑫ `stores/share.ts`（新文件）— Pinia store 管理 share 状态
- ⑬ `components/ShareDialog.vue`（新文件）— 生成对话框
  - 有效期选择（1h/24h/7d/30d/永久）
  - view 限制选择（不限/N次）
  - 生成按钮
  - 生成后显示完整 URL + Copy 按钮
- ⑭ `components/ShareManagementPanel.vue`（新文件）— 分享管理面板
  - 列表（token 创建时间、过期时间、view_count、状态）
  - 复选框（多选）
  - 单个撤销按钮
  - 批量撤销按钮
  - "Active N / Revoked M / Expired K" 统计
- ⑮ `views/EntryDetailView.vue` 改造：
  - owner 视角：detail-header 加 "Share" 按钮（在 existing actions 区）
  - 点击 → 打开 ShareDialog
  - detail-content 下方加 ShareManagementPanel（owner only）
  - 详情页底部加"由 @username 分享"水印（**仅 share 访问时显示**）
  - share 访问时隐藏 owner 专属操作按钮（避免混淆）
- ⑯ `router.ts` 不变（share 走 `?share={token}` query，不新路由）
- ⑰ 验证：`vue-tsc` + `npm run build` + Playwright E2E 全场景

**本任务不做**：
- 密码访问（明确走 C 路径）
- 邮箱白名单
- 单次查看强制
- 阅后即焚
- 设备限制
- 独立 `/settings/shares` 页面（嵌详情页）
- share 链接统计图表（仅基础 view_count）
- share 链接的 QR 码生成
- 分享到社交媒体按钮

## coordination

- **T021 必须完成 P4 后启 T027**：T021 改 EntryDetailView 头部侧栏，T027 也改 EntryDetailView（加 share 面板）
- **T024-T026 必须完成**：T027 在 EntryDetailView 加 share 面板，不依赖 T024-T026 直接，但依赖 T024 把 EntryListView 移到 `/explore`（T024 后 EntryListView 路径稳定，T025/T026 改造）
- **T022 重构 P4**：T022 重构 MarkdownViewer，T027 不动 MarkdownViewer，**互不干扰**
- **T020 XSS 净化保留**：详情页分享出去仍走 T020 DOMPurify（svg 等），P6 必出 XSS 验证
- **T020 复盘教训应用**：
  - **P3 subagent 空返回**：测试拆分——后端单测纯函数优先，前端组件测试拆分小用例
  - **P6 PAUSED 重验**：主 Agent 亲自 Playwright 跑全场景，不收 subagent 报告

## 验收量化条件

### 后端

- ✅ `entry_shares` 表存在，所有字段有
- ✅ 创建 share 返回 16 字符 token（URL-safe base64）
- ✅ DB 存的是 token 的 SHA256 hash，不是明文
- ✅ owner 创建 share：已登录 user 是 entry owner
- ✅ 非 owner 创建 share：403
- ✅ list_shares：owner only，返该 entry 所有 share（含 revoked/expired）
- ✅ revoke_shares：owner only，body share_ids 列表，返撤销数量
- ✅ verify_share_token：检查 expires_at / revoked_at / max_views
- ✅ private→public 自动撤销：update_entry 响应包含 `revoked_shares: N`
- ✅ public→private 保留：update_entry 不动 share
- ✅ 删除 entry 级联：FK 级联删 share
- ✅ view_count 原子 +1：并发安全
- ✅ 已有 577 测试仍全绿

### 前端

- ✅ EntryDetailView owner 看到 "Share" 按钮（在 existing actions）
- ✅ 点击 → 打开 ShareDialog（模态浮层）
- ✅ 选择有效期 + view 限制 + 生成
- ✅ 生成后显示完整 URL（`/{slug}?share={token}`）+ Copy 按钮
- ✅ Copy 后 toast 反馈
- ✅ ShareManagementPanel 显示所有 share（active/expired/revoked 分组）
- ✅ 单个撤销按钮工作
- ✅ 多选 + 批量撤销工作
- ✅ share 访问详情页显示"由 @username 分享"水印
- ✅ share 访问时 owner 专属按钮隐藏
- ✅ 未登录 share 访问：看到内容
- ✅ 已登录 share 访问：看到内容 + 水印
- ✅ owner 自己 share 访问：看到内容（**无**水印）
- ✅ T020 XSS 净化保留（share 出去的页面 svg 仍被净化）
- ✅ T020 行为保真（86+16 现有测试仍全绿）
- ✅ `npx vue-tsc --noEmit` 0 错误
- ✅ `npm run build` 成功

## 预期成果

| 指标 | 当前 | 目标 |
|------|------|------|
| private entry 分享能力 | 仅 owner 可看 | 临时链接可分享 |
| 后端 share 表 | 无 | 新增 `entry_shares` |
| 后端 share 端点 | 0 | 3 个 |
| 前端 share 组件 | 0 | 2 个 (Dialog + Panel) |
| 后端测试 | 577 | +15-20 |
| 前端测试 | 86 | +5-8 |
| Playwright 场景 | 16 | +3-5（share 相关） |
| 信息架构 | private 完全独占 | private 可临时分享 |
| 用户体验 | "私有不方便" | "安全可控的分享" |
