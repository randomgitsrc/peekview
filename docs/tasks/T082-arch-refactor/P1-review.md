---
phase: P1
task_id: T082-arch-refactor
type: review
parent: P1-requirements.md
trace_id: T082-P1-20260730
status: approved
created: 2026-07-30
agent: requirements-review
---

# P1 需求基线评审（第二轮）— T082 架构重构

## 评审结论

**approved** — 第一轮评审的 7 项 BLOCKER 全部修复，3 项建议修改项全部处理。BDD 从 31 条增至 41 条（BDD-1 到 BDD-41，连续无跳号），每条 BDD 只有一条 Given-When-Then，所有 Then 子句可二值判定。隐含需求覆盖完整（数据/前端/多端/边界/兼容逐项覆盖），裁剪合理（无裁剪，P1-P8 全走），P1 纯净性通过（无解决方案设计混入）。

## 第一轮 BLOCKER 修复确认（逐项）

### BLOCKER 1: BDD-5 拆分 — ✅ FIXED

原 BDD-5 包含 2 个 GWT（ReadTrackingService + ShareService）。修订后拆为：
- **BDD-5**: EntryService 不再直接实例化 ReadTrackingService（单 GWT）
- **BDD-6**: EntryService 不再直接实例化 ShareService（单 GWT）

### BLOCKER 2: BDD-22~28 拆分 — ✅ FIXED

原 BDD-22~28 各含 2 个 When-Then 对。修订后全部拆为独立编号：
- BDD-25: zen mode 进入 | BDD-26: zen mode 退出
- BDD-27: file tree 自动打开 | BDD-28: file tree 手动切换
- BDD-29: TOC 自动打开 | BDD-30: TOC 手动切换
- BDD-31: share dialog 打开 | BDD-32: share link 创建
- BDD-33: delete confirm dialog 显示 | BDD-34: delete 确认跳转
- BDD-35: mobile 布局 | BDD-36: desktop 布局
- BDD-37: meta-tags-bar 向下滚动隐藏 | BDD-38: meta-tags-bar 回顶恢复

### BLOCKER 3: BDD-29 拆分或合并 — ✅ FIXED

原 BDD-29 含 3 个 GWT（ExpiresInDialog + ProfileTab + SecurityTab）。修订后合并为单条 **BDD-39**："Given 后端错误格式统一化后，When 3 个组件中任一发生错误，Then 错误消息从 `response.data.error.message` 读取且非 undefined"。单 GWT，可二值判定。

### BLOCKER 4: BDD-7 状态码改为 422 — ✅ FIXED

原 BDD-7 声明 HTTP 400，与当前代码 422 不一致。修订后 **BDD-8**（renumbered）明确声明 "HTTP 状态码 422"，保留原行为，仅改格式。

### BLOCKER 5: BDD-7 移除 VALIDATION_ERROR — ✅ FIXED

原 BDD-7 Then 子句指定 `"VALIDATION_ERROR"` 具体 error code。修订后 **BDD-7** 和 **BDD-8** 均使用 `"<ERROR_CODE>"` 占位符，未绑定具体 code 名称。

### BLOCKER 6: BDD-18 Then 子句可二值判定 — ✅ FIXED

原 BDD-18 "竞态防护逻辑仍然生效"不可直接二值判定。修订后拆为两条：
- **BDD-19**（结构验证）: "Then loadSeq 序号检查逻辑存在于该 store 中（grep `loadSeq` 在 entryList.ts 中存在）" — 可二值判定
- **BDD-20**（行为验证）: "Then 两次调用都完成后，最终显示的是第二次调用的结果（非第一次的过期数据）" — 可二值判定

### BLOCKER 7: BDD-19 Then 子句可二值判定 — ✅ FIXED

原 BDD-19 "行为不变"不可直接二值判定。修订后拆为两条：
- **BDD-21**: "Then searchUrl.logic.ts 相关单测全部通过（0 失败）" — 可二值判定
- **BDD-22**: "Then 各参数被正确解析并应用到 store 状态中（每个参数可通过 Playwright 验证：URL 含 `?q=foo` → 搜索框值为 foo）" — 可二值判定

## 建议修改项确认（非 BLOCKER）

### 建议 8: BDD-28 Then 移除 .hidden class — ✅ FIXED

修订后 BDD-37/38（renumbered）使用 "meta-tags-bar 不可见" / "meta-tags-bar 恢复可见"，未绑定 CSS 类名。

### 建议 9: §8 标题 — ✅ FIXED

修订后 §8 标题为 "实施顺序约束（P0 约束复述，非方案设计）"。

### 建议 10: packages 声明移除候选名 — ✅ FIXED

修订后 packages 声明为 "(新建) 去重函数共享模块"，无候选文件名。

## BDD 评审

### 后端 DI 统一

- **BDD-1**: PASS — 可二值判定（grep `StorageManager(config=config)` 在 files.py 路由函数体内是否存在）。覆盖维度：数据✓ 前端✗ 多端✗ 边界✓ 兼容✓
- **BDD-2**: PASS — 可二值判定（grep `Session(engine)` 在 files.py 路由函数体内是否存在）。覆盖维度：数据✓ 前端✗ 多端✗ 边界✓ 兼容✓
- **BDD-3**: PASS — 可二值判定（grep `EntryService(engine=` 在 admin_service.py 中是否存在）。覆盖维度：数据✓ 前端✗ 多端✗ 边界✓ 兼容✓
- **BDD-4**: PASS — 可二值判定（grep `ApiKeyService(engine=` 在 auth.py 中是否存在）。覆盖维度：数据✓ 前端✗ 多端✗ 边界✓ 兼容✓
- **BDD-5**: PASS — 单 GWT，可二值判定（grep `ReadTrackingService(engine=self.engine)` 在 entry_service.py 中是否存在）。覆盖维度：数据✓ 前端✗ 多端✗ 边界✓ 兼容✓
- **BDD-6**: PASS — 单 GWT，可二值判定（grep `ShareService(engine=self.engine` 在 entry_service.py 中是否存在）。覆盖维度：数据✓ 前端✗ 多端✗ 边界✓ 兼容✓

### 后端错误格式统一

- **BDD-7**: PASS — 单 GWT，可二值判定（grep `{"detail"` 或 `raise HTTPException` 在 api/ 路由层是否存在）。使用 `<ERROR_CODE>` 占位符，无设计混入。覆盖维度：数据✓ 前端✓ 多端✓ 边界✓ 兼容✓
- **BDD-8**: PASS — 单 GWT，可二值判定（HTTP 状态码 422 + PeekError 格式）。状态码保留 422，与当前代码一致。覆盖维度：数据✓ 前端✓ 多端✓ 边界✓ 兼容✓
- **BDD-9**: PASS — 单 GWT，可二值判定（grep `raise HTTPException` 在 auth.py 中是否存在）。覆盖维度：数据✓ 前端✓ 多端✓ 边界✓ 兼容✓
- **BDD-10**: PASS — 单 GWT，可二值判定（grep `raise HTTPException` 在 admin.py 中是否存在）。覆盖维度：数据✓ 前端✓ 多端✓ 边界✓ 兼容✓

### 后端重复代码去重

- **BDD-11**: PASS — 单 GWT，可二值判定（grep `def _looks_like_jwt` 全库计数 = 1）。覆盖维度：数据✓ 前端✗ 多端✗ 边界✗ 兼容✓
- **BDD-12**: PASS — 单 GWT，可二值判定（grep `def _is_global_api_key_auth` 全库计数 = 1）。覆盖维度：数据✓ 前端✗ 多端✗ 边界✗ 兼容✓
- **BDD-13**: PASS — 单 GWT，可二值判定（grep `def _record_read_async` 全库计数 = 1）。覆盖维度：数据✓ 前端✗ 多端✗ 边界✗ 兼容✓

### 后端 create_entry 事务修复

- **BDD-14**: PASS — 单 GWT，可二值判定（mock 文件写入异常 → 查 DB entry row 不存在 + 磁盘文件已清理 + 无脏 entry）。覆盖维度：数据✓ 前端✗ 多端✗ 边界✓（并发/回滚）兼容✓
- **BDD-15**: PASS — 单 GWT，可二值判定（正常 create_entry 流程测试通过 = PASS）。覆盖维度：数据✓ 前端✗ 多端✗ 边界✓ 兼容✓

### 后端测试零回归

- **BDD-16**: PASS — 单 GWT，可二值判定（`make test-quick` exit code = 0，976 条全通过）。覆盖维度：数据✓ 前端✗ 多端✗ 边界✓ 兼容✓

### 前端 store 拆分

- **BDD-17**: PASS — 单 GWT，可二值判定（stores/ 目录下存在分离的 store 文件）。覆盖维度：数据✗ 前端✓ 多端✗ 边界✗ 兼容✓
- **BDD-18**: PASS — 单 GWT，可二值判定（`wc -l` 每个 store 文件 < 150 行）。覆盖维度：数据✗ 前端✓ 多端✗ 边界✗ 兼容✓
- **BDD-19**: PASS — 单 GWT，可二值判定（grep `loadSeq` 在 entryList.ts 中存在）。覆盖维度：数据✗ 前端✓ 多端✗ 边界✓（并发）兼容✓
- **BDD-20**: PASS — 单 GWT，可二值判定（快速连续调用 loadEntries 两次，最终显示第二次结果）。覆盖维度：数据✗ 前端✓ 多端✗ 边界✓（并发）兼容✓
- **BDD-21**: PASS — 单 GWT，可二值判定（searchUrl.logic.ts 相关单测 0 失败）。覆盖维度：数据✗ 前端✓ 多端✗ 边界✗ 兼容✓
- **BDD-22**: PASS — 单 GWT，可二值判定（Playwright 验证 URL 参数解析到 store 状态）。覆盖维度：数据✗ 前端✓ 多端✗ 边界✗ 兼容✓

### 前端 EntryDetailView 拆分

- **BDD-23**: PASS — 单 GWT，可二值判定（`wc -l` 主文件 < 300 行）。覆盖维度：数据✗ 前端✓ 多端✗ 边界✗ 兼容✓
- **BDD-24**: PASS — 单 GWT，可二值判定（每个子组件文件 `wc -l` < 200 行）。覆盖维度：数据✗ 前端✓ 多端✗ 边界✗ 兼容✓
- **BDD-25**: PASS — 单 GWT，可二值判定（按 'f' 键 → zen mode 进入，header/sidebar/bottom bar 隐藏）。覆盖维度：数据✗ 前端✓ 多端✗ 边界✗ 兼容✓
- **BDD-26**: PASS — 单 GWT，可二值判定（按 'f' 或 'Escape' → zen mode 退出）。覆盖维度：数据✗ 前端✓ 多端✗ 边界✗ 兼容✓
- **BDD-27**: PASS — 单 GWT，可二值判定（页面加载 → file tree 自动打开 if isMultiFile）。覆盖维度：数据✗ 前端✓ 多端✗ 边界✗ 兼容✓
- **BDD-28**: PASS — 单 GWT，可二值判定（点击 toggle → file tree 切换开/关）。覆盖维度：数据✗ 前端✓ 多端✗ 边界✗ 兼容✓
- **BDD-29**: PASS — 单 GWT，可二值判定（页面加载 → TOC sidebar 自动打开 if isMarkdown 且有标题）。覆盖维度：数据✗ 前端✓ 多端✗ 边界✗ 兼容✓
- **BDD-30**: PASS — 单 GWT，可二值判定（点击 TOC toggle → TOC sidebar 切换开/关）。覆盖维度：数据✗ 前端✓ 多端✗ 边界✗ 兼容✓
- **BDD-31**: PASS — 单 GWT，可二值判定（点击 share 按钮 → share dialog 打开）。覆盖维度：数据✗ 前端✓ 多端✗ 边界✗ 兼容✓
- **BDD-32**: PASS — 单 GWT，可二值判定（创建 share link → share badge 显示活跃数量）。覆盖维度：数据✗ 前端✓ 多端✗ 边界✗ 兼容✓
- **BDD-33**: PASS — 单 GWT，可二值判定（overflow menu delete → confirm dialog 显示）。覆盖维度：数据✗ 前端✓ 多端✗ 边界✗ 兼容✓
- **BDD-34**: PASS — 单 GWT，可二值判定（确认删除 → entry 删除 + 跳转 /explore）。覆盖维度：数据✗ 前端✓ 多端✗ 边界✗ 兼容✓
- **BDD-35**: PASS — 单 GWT，可二值判定（视口 ≤640 → mobile 布局显示）。覆盖维度：数据✗ 前端✓ 多端✗ 边界✗ 兼容✓
- **BDD-36**: PASS — 单 GWT，可二值判定（视口 >640 → desktop 布局显示）。覆盖维度：数据✗ 前端✓ 多端✗ 边界✗ 兼容✓
- **BDD-37**: PASS — 单 GWT，可二值判定（向下滚动 → meta-tags-bar 不可见）。未绑定 CSS 类名。覆盖维度：数据✗ 前端✓ 多端✗ 边界✗ 兼容✓
- **BDD-38**: PASS — 单 GWT，可二值判定（回顶 → meta-tags-bar 恢复可见）。未绑定 CSS 类名。覆盖维度：数据✗ 前端✓ 多端✗ 边界✗ 兼容✓

### 前端错误格式兼容

- **BDD-39**: PASS — 单 GWT（合并 3 组件为"任一"），可二值判定（错误消息从 `response.data.error.message` 读取且非 undefined）。覆盖维度：数据✗ 前端✓ 多端✓（前后端契约）边界✗ 兼容✓

### 前端测试零回归

- **BDD-40**: PASS — 单 GWT，可二值判定（`make test-frontend` exit code = 0）。覆盖维度：数据✗ 前端✓ 多端✗ 边界✓ 兼容✓
- **BDD-41**: PASS — 单 GWT，可二值判定（`make typecheck` 无类型错误）。覆盖维度：数据✗ 前端✓ 多端✗ 边界✓ 兼容✓

## BDD 评审汇总

| 类别 | BDD 编号 | 数量 | 判定 |
|------|----------|------|------|
| PASS（单 GWT，可二值判定，结构合规） | BDD-1~41 | 41 | 全部通过 |
| FAIL（结构违规） | — | 0 | — |
| FAIL（Then 不可二值判定） | — | 0 | — |
| FAIL（状态码不一致/设计混入） | — | 0 | — |
| **合计** | | **41** | **全部 PASS** |

## 隐含需求覆盖

### 数据维度：覆盖✓
- 无 schema 变更已声明（§2.1）
- 事务回滚覆盖（BDD-14/15）
- 脏数据防护覆盖（BDD-14 Then: "不残留无文件的脏 entry"）
- **无遗漏**

### 前端维度：覆盖✓
- 错误格式兼容（BDD-39，3 处 .detail 读取更新）
- store 拆分影响（BDD-17/18/19/20/21/22）
- component 拆分影响（BDD-23~38）
- LoginDialog e.detail 不受影响已声明（§2.2）——DOM CustomEvent，非 HTTP 错误格式
- **无遗漏**

### 多端维度：覆盖✓
- MCP 不改已声明（§2.3）
- CLI 不改已声明（§2.3）
- API 契约不变（错误格式统一化是修 bug）已声明
- 前后端契约一致（BDD-39 前端读取与 BDD-7/8/9/10 后端格式对齐）
- **无遗漏**

### 边界维度：覆盖✓
- 并发：loadSeq 竞态（BDD-19/20）
- 回滚：事务失败清理（BDD-14）
- 空值：BDD-15 正常流程 + BDD-14 异常流程
- session 生命周期（§2.4 已识别 files.py Session 泄漏风险）
- **无遗漏**

### 兼容维度：覆盖✓
- 错误格式变更影响前端 3 处（BDD-39）
- 旧测试全绿作为安全网（BDD-16/40/41）
- **无遗漏**

## 裁剪评审

- **无裁剪**：P1-P8 全走
- **理由充分**：risk_level=high，涉及 6 项跨层改动 + 安全相关（DI 影响认证链路）+ 数据一致性（事务修复）+ 多端影响（错误格式）+ 机制交叉（≥2 子系统交互）。符合 AGENTS.md "机制交叉必须走完整 agate" 约束。
- **risk_level=high 合理**：5 条理由均有代码事实支撑
- **capability_requirements 三态判断正确**：
  - pytest/vitest/typecheck/lint = available（Makefile target 存在）
  - playwright = supplementable（CDP Chrome :18800 + 降级 make debug-test）——P2 需产出 minimal_validation 块

## P1 纯净性检查

### §8 实施顺序约束
- **判定**：PASS。§8 标题已改为"实施顺序约束（P0 约束复述，非方案设计）"，内容是复述 P0-brief 的顺序约束，未设计具体方案。无越界。

### BDD-7/8 中的 `<ERROR_CODE>` 占位符
- **判定**：PASS。使用 `<ERROR_CODE>` 占位符，未绑定具体 error code 名称。无设计混入。

### packages 声明
- **判定**：PASS。"(新建) 去重函数共享模块"无候选文件名，仅声明受影响范围。无设计混入。

### BDD 反模式自检（§7）
- **判定**：PASS。7 项自检全部勾选，且经本轮评审逐条验证属实。

## 环境隔离声明

[PROD_NOT_TOUCHED] 本评审为纯文档审查，未执行任何代码、未接触任何数据库、未启动任何服务。
