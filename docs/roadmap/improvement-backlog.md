# PeekView 改进事项目标文档

> 创建：2026-06-09
> 用途：汇总评审发现的待改进事项，按优先级跟踪
> 当前版本：Backend v0.9.0 / MCP Server v0.9.2

---

## 优先级总览

| # | 事项 | 类别 | 优先级 | 状态 |
|---|------|------|--------|------|
| 1 | UI 重构验收必须包含视觉级验证（Playwright 截图） | 流程/质量 | 🔴 立即 | ✅ 已实践(T028) |
| 2 | 冷打开链接体验打磨（加载速度/移动端/元信息一眼清） | 产品/体验 | 🔴 立即 | 🔄 T031 |
| 3 | entry 读取路径埋点（谁在读、读频率、是否非创建者） | 产品/探针 | 🔴 立即 | ✅ v0.4.0(T032) |
| 4 | `verify_share_token` 的 `compare_digest` 永真，误导维护者 | 安全意图噪音 | 🟡 中期 | ✅ v0.4.0(T033) |
| 5 | `max_views` 语义模糊（"最多发 N 个" vs "最多看 N 次"） | 产品语义 | 🟡 中期 | ✅ v0.4.0(T033) |
| 6 | 发布通道统一到 CI（本地 publish 降级为验证） | 流程/CI | 🟡 中期 | 🔄 T035 |
| 7 | `MAX_SHARES` 查询用 `text()` SQL 与同文件 ORM 风格不一致 + `entry.id` type safety | 代码风格 | 🔵 长期 | ✅ v0.6.3(T054) |
| 8 | `entry_shares` 表无独立 migration，靠 `create_all()` | 运维 | 🔵 长期 | ✅ v0.6.3(T054) |
| 9 | share cookie 用 `entry_id` 命名，外部可枚举推断 entry 总量 | 信息泄露（低危） | 🔵 长期 | ✅ v0.4.0(T033) |
| 10 | SQLite 并发写边界文档化（含 share `view_count` 串行化瓶颈） | 架构/文档 | 🔵 长期 | 待办 |
| 10b | entry 生命周期管理：过期→归档+可续命+可配置保留期 | 产品/架构 | 🟠 近期 | ✅ v0.5.4(T048) |
| 15b | 图表源码自动清洗 + 移动端 header 滚动收缩 | 体验 | 🟠 近期 | ✅ v0.5.5(T049) |
| 21 | Agent /raw 端点自动发现（Content Negotiation + HTML 自描述） | 产品/Agent | 🔴 立即 | ✅ T053 |
| 22 | 后端 API 安全加固（默认 host + 限流 + passlib）+ 幂等 key + 代码风格 | 安全/产品 | 🔴 立即 | ✅ v0.6.3(T054) |
| 23 | Admin backup/export 命令 | 运维 | 🟠 近期 | ✅ v0.7.0(T055) |
| 24 | Prometheus /metrics 端点 | 可观测性 | 🟡 中期 | ✅ v0.8.0(T056) |
| 25 | UI/UX 重构（OverflowMenu + SharePanel） | 体验 | 🟠 近期 | ✅ v0.9.0(T058) |
| 11 | 嵌入式 iframe 分享 (`/embed/{slug}`) | 产品 | 🔵 长期 | ⏸️ 数据触发 |
| 12 | 版本化 / 时间契约 | 产品 | 🔵 长期 | ⏸️ 数据触发 |
| 13 | OG 预览卡片 | 产品 | 🔵 长期 | ⏸️ 数据触发 |
| 14 | StorageBackend 接口抽象 | 架构 | 🔵 长期 | 待办 |
| 15 | publish_files 大目录扫描进度反馈 | 体验 | 🔵 长期 | 待办 |
| 16 | SCOPE+ 影响范围决策矩阵 | 流程 | 🔵 长期 | 待实战验证 |
| 17 | BDD 验收条件可量化门槛 | 流程 | 🔵 长期 | 待实战验证 |
| 18 | P7 一致性检查覆盖度门槛 | 流程 | 🔵 长期 | 待实战验证 |
| 19 | 链式上溯拦截规则 | 流程 | 🔵 长期 | 待实战验证 |
| 20 | Live 更新 / 实时推送 | 产品 | ❌ 不做 | — |

---

## 详细说明

### 🔴 1. UI 重构验收必须包含视觉级验证（Playwright 截图）

**来源**：多次 UI 改动在 CI 类型检查通过但视觉回归未被发现

**问题**：CSS/布局改动无法被 vue-tsc 或 vitest 覆盖。纯代码级验证对 UI 改动有盲区，导致上线后才发现样式问题。

**方案**：任何涉及视图组件改动的任务，P6 验收必须包含 Playwright 截图对比。CI 流水线可选集成。

---

### 🔴 2. 冷打开链接体验打磨

**来源**：2026-06-29 定位评审（docs/reviews/review-position-02-20260629.md §6 地板层）

**问题**：冷打开一个 PeekView 链接是用户接触产品的第一路径，也是最高频路径。"这是什么 / 谁发的 / 什么时候"应该一眼清楚。当前体验未打磨：加载速度、移动端适配、元信息呈现都有提升空间。

**方案**：作为地板层持续打磨。具体包括：entry 详情页元信息优化、移动端响应式、首屏加载性能。

---

### 🔴 3. entry 读取路径埋点 ✅

**来源**：2026-06-29 定位评审（docs/reviews/review-position-02-20260629.md §6 探针层）

**问题**：MCP `getEntry` / `listEntries` 路径技术上已存在，但没有任何读取埋点。T027 的 `view_count` 只服务分享链接，不区分人/agent，也不在 MCP/API 读取路径上。所以无法知道"有没有 agent 真的去读另一个 agent 的产出"——这是判断多 Agent 总线愿景是否成立的唯一信号源。

**方案**：给 entry 的读取路径（API `GET /entries/{slug}` + MCP `getEntry`/`listEntries`）加最小探针——记录读取者身份（是否非创建者 / 是否不同 API key）、读取频率、读取方式（API vs MCP vs share）。数据用于驱动方向 1（多 Agent 总线）的优先级决策：半年零信号 → 总线降级；出现信号 → 按真实形状加强。

**完成**：v0.4.0 T032 — `entry_reads` 表 + 1 分钟窗口聚合 + `read_stats` 字段 + MCP `X-PeekView-Source` header。

---

### 🟡 4. `verify_share_token` 的 `compare_digest` 永真 ✅

**来源**：2026-06-29 专家评审（docs/reviews/review-peekview-expert-2026-06-29.md §1.3 #1）

**问题**：`share_service.py:207` 的 `hmac.compare_digest(computed_hash, share.token_hash)` 永远为真——share 是用 `WHERE token_hash = computed_hash` 从 DB 查出的，两个 hash 都由自己计算，不存在 timing attack 面。保留会误导后续维护者以为这里有安全考量。

**方案**：删除该比对，或加注释说明保留意图。

**完成**：v0.4.0 T033 — 已删除 `compare_digest`，测试重写为验证语义而非特定函数调用。

---

### 🟡 5. `max_views` 语义模糊 ✅

**来源**：2026-06-29 专家评审（docs/reviews/review-peekview-expert-2026-06-29.md §1.3 #2）

**问题**：`verify_share_cookie` 不递增 `view_count`，只有 `verify_share_token` 递增。导致 `max_views` 实际语义是"最多发给 N 个人"（最多 N 个 token 被使用），但 UI 的 `views` 标签暗示"最多被看 N 次"。

**方案**：在 P1 需求文档明确边界。若需求是"最多看 N 次"则 cookie 路径也递增 view_count；若是"最多发 N 个"则 UI 文案对齐。

**完成**：v0.4.0 T033 — UI 文案改为 `Max uses` / `N/M uses`，语义统一为"最多验证 N 次 token"。

---

### 🟡 6. 发布通道统一到 CI

**来源**：2026-06-26 发布流程复盘

**问题**：peekview 和 peekview-mcp 均存在"本地 `make publish` + push tag 触发 CI publish"的双通道发布。两者都会上传到 PyPI/npm，第二个到的会因版本号冲突而失败。本地 token（`~/.bash_env`）的安全性也不如 CI 的 OIDC Trusted Publishing。

**方案**：
- 本地 `make publish` 改为纯验证（lint + test + typecheck + build，不上传）
- 本地 `make publish-npm` 同理
- 发布流程标准化为：`bump-version → 填 CHANGELOG → commit → push tag → 等 CI 绿`
- PyPI 用 OIDC Trusted Publishing（CI 已配置），npm 用 `secrets.NPM_TOKEN`（CI 已配置）

---

### 🔵 7. `MAX_SHARES` 查询风格不一致 + `entry.id` type safety

**来源**：2026-06-29 专家评审（docs/reviews/review-peekview-expert-2026-06-29.md §1.3 #4）

**问题**：`MAX_SHARES_PER_ENTRY` 检查用原始 `text()` SQL（`SELECT COUNT(*) FROM entry_shares WHERE ...`），与同文件其他 `select(EntryShare)` 风格不一致。`entry.id` 类型为 `int | None` 直传 SQL 参数有 type safety 缝隙（实际路径不可能为 None）。

**方案**：统一为 ORM 查询，或对 `entry.id` 做 None guard。

---

### 🔵 8. `entry_shares` 表无独立 migration

**来源**：2026-06-29 专家评审（docs/reviews/review-peekview-expert-2026-06-29.md §1.3 #3）

**问题**：`entry_shares` 表完全依赖 `SQLModel.metadata.create_all()`，无显式 migration。对已运行进程需重启才建表。

**方案**：升级文档注明"新表在下次启动时创建"。长期考虑引入 Alembic 管理迁移。

---

### 🔵 9. share cookie 用 `entry_id` 命名可枚举 ✅

**来源**：2026-06-29 专家评审（docs/reviews/review-peekview-expert-2026-06-29.md §1.4）

**问题**：`peekview_share_{entry_id}` 中的 entry_id 是自增整数，外部可枚举 cookie 名推断系统 entry 总量和 ID 范围。低危但可改进。

**方案**：改用 `peekview_share_{slug}`。注意 trade-off：slug 若支持 rename 则 cookie 会失效。需评估是否值得改。

**完成**：v0.4.0 T033 — cookie 改名为 `peekview_share_{slug}`。

---

### 🔵 10. SQLite 并发写边界文档化

**问题**：SQLite 并发写串行，多账号/多 Agent 并发 publish 会写争用。`view_count + 1` 在 SQLite 单写者模型下原子安全，但未来多 worker 部署时 WAL 单写者锁会让并发分享访问串行化。这是"SQLite 适用边界"的具体实例。

**方案**：README 明确"单机低并发"适用边界 + 未来 PostgreSQL 迁移路径。

---

### 🔵 11. 嵌入式 iframe 分享 (`/embed/{slug}`)

**问题**：`<iframe src=".../embed/{slug}">` 让内容内联进宿主页面。

**决策**：⏸️ **数据触发，不主动推进**。底层问题未定——agent 产出是"瞥一眼就丢"还是"沉淀进知识库"。用 `view_count` 观察：若访问曲线为创建后几次访问归零 → 永久搁置；若出现持续回访 → 等宿主场景自己浮现再做。

**方案**：加 `/embed/{slug}` 路由（去掉顶部导航）。仅在数据信号出现后启动。

---

### 🔵 12. 版本化 / 时间契约

**来源**：2026-06-29 定位评审（docs/reviews/review-position-02-20260629.md §4.1）

**问题**：`update_entry` 覆盖式更新不留版本，URL 语义不明确——改了旧内容就没了。理论上存在"分享出去后内容若被改，对方看到的和我不一样"的一致性问题，但当前实践中几乎没有更新。

**决策**：⏸️ **数据触发**。前序评审曾建议"补版本化 + 时间契约"，用"行为是否存在"的尺子衡量后降级——内容不被改写则引用稳定性问题不发生，多 Agent 引用是设想需求。唯一勉强成立的角落：分享后内容被改的一致性问题，但更新本就罕见，低风险。

**触发条件**：出现"内容被改写"或"多 agent 引用"的真实行为。

---

### 🔵 13. OG 预览卡片

**来源**：2026-06-29 两轮评审

**问题**：链接被传播到任何聊天/邮件时，渲染成标题+摘要+来源的预览卡片。对分享场景（T027）有用——但 T027 让分享变得**可能**，不等于分享正在**发生**。

**决策**：⏸️ **数据触发**。先看分享链接的 view_count 和 referrer 数据，确认链接是否在"被传出去"。是则做（对所有送达渠道都有用，不绑定任何厂商）；否则等。

---

### 🔵 14. StorageBackend 接口抽象

**问题**：`~/.peekview/data/{entry_id}/` 路径耦合在 storage.py、entry_service.py、CLI 多处。未来支持 S3/对象存储改动面广。

**方案**：抽 `StorageBackend` 接口，现实现为 `LocalStorageBackend`。

---

### 🔵 15. publish_files 大目录扫描进度反馈

**问题**：扫描大目录静默无反馈。MCP 协议支持 progress notification 未用。

**方案**：扫描时推送 progress notification。

---

### 🔵 16. SCOPE+ 影响范围决策矩阵

**来源**：workflow-v4 评审 Fix-8

**问题**：SCOPE+ 定向回补的核心步骤"主 Agent 判断哪些阶段需要跟着改"缺少判断规则。但当前无实战数据证明这条规则是必要的。

**方案**：待 5-10 个真实 SCOPE+ 场景积累后，分析是否存在"回补不足"或"回补过度"的实际失败，再决定是否矩阵化。

---

### 🔵 17. BDD 验收条件可量化门槛

**来源**：workflow-v4 评审 Fix-9

**问题**：P1 分析师可能写出"伪 BDD"（Then 子句含模糊词如"体验良好""正常工作"），全流程无质检。

**方案**：待 5-10 个真实任务执行后，统计 P6 验收失败中因 BDD 模糊导致的比例，再决定是否加门槛。

---

### 🔵 18. P7 一致性检查覆盖度门槛

**来源**：workflow-v4 评审 Fix-10

**问题**：P7 gate 只检查"有无 BLOCKER"，空壳 P7-consistency.md（无 BLOCKER 但也没做检查）可过 gate。

**方案**：待 5-10 个真实任务执行后，检查 P7 产出质量是否与 P5 回归测试结果关联，再决定是否加门槛。

---

### 🔵 19. 链式上溯拦截规则

**来源**：workflow-v4 评审 Fix-12

**问题**：L2 上溯每次只跳一个阶段，但多次上溯可能链式组合（如 P5→P4→P2），等效跨多阶段回退。

**方案**：待真实链式上溯场景出现后，基于实际数据设计拦截条件，而非预设规则。

---

### ❌ 20. Live 更新 / 实时推送

**来源**：2026-06-29 定位评审

**决策**：❌ **不做**。Artifact 是"活进程的窗口"，PeekView 是"发布记录"。追"活"是去 Artifact 主场正面打，没胜算。

---

## 已完成归档

以下事项已完成，详情见 git history：

| # | 事项 | 完成版本 |
|---|------|----------|
| A1 | SSE → Streamable HTTP 迁移 | MCP v0.9.2 |
| A2 | rate limiting 配置化真正落地 | v0.1.45 |
| A3 | MCP/CLI 定位写进用户文档 | v0.1.46 |
| A4 | JWT → httpOnly Cookie | v0.1.45 |
| A5 | 前端页面 CSP | v0.1.45 |
| A6 | publish_files 二进制文件 base64 支持 | v0.1.44 |
| A7 | package-lock.json 版本元数据同步 | v0.1.44 |
| A8 | 登录/注册 Cap captcha 集成 | v0.1.49 |
| A9 | health check 503 vs 200 决策复审 | 决策完成（保持 200） |
| A10 | `revoke_all_for_entry` session 泄漏 | 656ca5a8 |
| A11 | #3 entry 读取路径埋点 | v0.4.0(T032) |
| A12 | #4 `compare_digest` 永真删除 | v0.4.0(T033) |
| A13 | #5 `max_views` → `Max uses` 文案对齐 | v0.4.0(T033) |
| A14 | #9 share cookie `entry_id` → `slug` | v0.4.0(T033) |

---

*维护：随评审持续更新*
