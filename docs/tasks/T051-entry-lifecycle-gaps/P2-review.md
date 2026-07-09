---
phase: P2
task_id: T051
task_name: T048 生命周期遗留缺口修复 + 头部信息布局
type: review
agent: reviewer
parent: P2-design.md
trace_id: T051-P2-review-20260709
status: approved
created: 2026-07-09
---

# T051 P2 设计评审

## 评审结论

**status: conditional** — 方案整体可行，可带条件推进 P3。

## 1. BDD 覆盖度检查

| BDD | 方案覆盖 | 备注 |
|-----|---------|------|
| A-AC1 | ✅ A1 | lifespan 启动 task + check_on_start 逻辑完整 |
| A-AC2 | ✅ A1 | interval=0 不创建 task + 日志 |
| A-AC3 | ✅ A1 | cancel() + wait_for(timeout=30) + 日志 |
| A-AC4 | ✅ A1 | 日志输出 archived/deleted/freed |
| B-AC1 | ✅ B1 | 三元 tab All/Mine/Archived |
| B-AC2 | ✅ B1 | URL push + status 参数 + restoreFromURL 解析 |
| B-AC3 | ⚠️ B1 | 点击 @username 跳转 /users/{username} 已覆盖，但"筛选栏显示 @username chip"的交互细节不够——从 /explore 页面点击卡片中的 @username 是跳转路由还是显示 chip？设计说"跳转 /users/{username}（复用现有路由），或如果已在 /explore 则显示 @username chip"，这个"或"需要明确 |
| B-AC4 | ✅ B1 | 统一 @ 格式 + 可点击 |
| B-AC5 | ✅ B1 | 匿名 entry 无 username → 不显示 |
| B-AC6 | ✅ B1 | Archived 空状态提示 |
| C-AC1 | ✅ C1 | 过期警告 banner + 重新设置按钮 |
| C-AC2 | ✅ C1 | 黄色 vs 灰色视觉区分 |
| C-AC3 | ✅ C1 | expired badge（琥珀色） |
| C-AC4 | ✅ C1 | cleanup 后 status 变 archived → banner 自然切换 |
| D-AC1 | ✅ D1 | 相对时间 + hover/title 绝对时间 |
| D-AC2 | ✅ D1 | 双行布局，信息按层级排列 |
| D-AC3 | ✅ D1 | 移动端 bar 含 owner + 过期状态 |
| D-AC4 | ✅ D1 | 列表页时间格式统一 |

**覆盖度：18/18 覆盖，1 个需澄清（B-AC3 的 @username 交互分支）**

## 2. 候选方案权衡评审

### 缺口 A：design_trivial 合理

asyncio.Task + lifespan 是标准模式，唯一方案合理。代码示例质量高，关键决策点（run_in_executor、cancel+wait_for、interval=0 守卫、独立 try/except）均已覆盖。

**发现**：代码示例中 `asyncio.get_event_loop()` 在 Python 3.10+ 中已被标记为 deprecated（推荐 `asyncio.get_running_loop 或 asyncio.get_running_loop()）。虽然功能等价，但 P3 实现时应使用 `asyncio.get_running_loop()` 或直接 `await asyncio.to_thread(admin_service.cleanup_expired)`。

### 缺口 B：B1 vs B2 权衡充分

B1（互斥 tab）vs B2（双维度）的取舍分析到位。选择 B1 的理由成立：P1 BDD 未要求组合查询，B1 改动最小。

**遗漏**：B1 方案中"Mine tab 激活时显示当前用户名（如 Mine (peek)）"——这个细节在 P0-brief 中提到但 P1 BDD 未定义，需确认是否纳入 P3 scope。若纳入，需考虑未登录用户看到什么（Mine tab 应隐藏还是 disabled）。

### 缺口 C：C1 vs C2 权衡充分

C1（独立 banner）vs C2（header 内嵌）的取舍清晰。选择 C1 的理由充分，特别是移动端 header 信息被 `desktop-only` 隐藏这一关键事实。

### 缺口 D：D1 vs D2 vs D3 权衡充分

三个方案各有明确优劣：

| 方案 | 优势 | 劣势 | 适合场景 |
|------|------|------|---------|
| D1 双行 | 层级清晰，满足 D-AC2满足 | header 增高~16px | 信息密度要求高 |
| D2 单行 | 高度不变 | 单行挤AC2不满足 | 空间极度受限 |
| D3 折叠 | 默认最紧凑 | 关键信息隐藏与C冲突 | 信息优先级低 |

选择 D1 的理由站得住脚：D-AC2 明确要求"非全部挤在一行"，D3 与缺口 C 冲突。

**发现**：D1 方案中移动端 bar 高度从 56px 调整为 48px——减少 8px 的理由未说明。当前 `--header-height: 56px` 是全局变量，改 bar 高度需确认是否影响其他引用此变量的布局计算。

## 3. 选择理由评审

| 缺口 | 选择 | 理由是否站得住脚 |
|------|------|----------------|
| A | A1（唯一） | ✅ 标准模式，无替代 |
| B | B1 | ✅ BDD 未要求组合，最小改动 |
| C | C1 | ✅ BDD 明确要求 banner，C2 不满足 |
| D | D1 | ✅ D-AC2 排除 D2，C 需求排除 D3 |

## 4. gate_commands 评审

```yaml
gate_commands:
  P5: "cd backend && .venv/bin/python -m pytest tests/ -q --tb=no"
  P5_frontend: "cd frontend-v3 && ./node_modules/.bin/vitest run"
  P5_typecheck: "cd frontend-v3 && npx vue-tsc --noEmit"
  P5_e2e: "make debug-test"
```

**问题**：

1. **缺少 ruff lint**：AGENTS.md 铁律 13 要求完成后跑 `python3 -m ruff check`，gate_commands 应包含
2. **P5_e2e 过于笼统**：`make debug-test` 跑完整 E2E suite，AGENTS.md 明确警告"完整 E2E suite 在 CDP 模式下可能超时（>5min）"。应改为指定 spec 或自定义 Playwright 脚本逐项验证
3. **缺少 P5_e2e 的具体验证项**：应列出 P6 验收需截图验证的 7 个 UI 交互点对应的 E2E 步骤

## 5. files_to_read 评审

共 20 个文件引用，覆盖了所有改动位置。

**合理**：行号范围精确，why 说明清晰。

**建议补充**：
- `frontend-v3/src/components/ExpiresInDialog.vue` — C1 方案复用 showExpiresInDialog，需了解对话框接口
- `frontend-v3/src/stores/auth.ts` — B1 方案需判断登录状态（Mine tab 可见性、@username chip 显示逻辑）

**建议移除**：无，所有引用均与改动直接相关。

## 6. 20 个文件数量合理。

## 6. 缺口 D 三方案优劣评审

### D1 双行 Header

**优势**：
- 信息层级最清晰，满足 D-AC2
- 移动端 bar 设计最完整
- 与 C1 banner 方案兼容（banner 在 header 下方，双行 header 不冲突）

**劣势**：
- header 增高 ~16px，内容区减少
- 移动端 bar 48px 需重新验证触控热区（Apple HIG 建议 44pt 最小触控目标）

**遗漏风险**：双行布局在窄屏（768-1024px）可能溢出——tags 行 + expires 行 + 操作按钮在中等宽度下可能换行混乱，需 CSS 响应式断点测试。

### D2 单行紧凑

**优势**：高度不变，内容区最大化

**劣势**：D-AC2 明确排除，不应作为候选（但作为对比方案保留有价值）

### D3 折叠式

**优势**：默认最紧凑

**劣势**：与 C1 banner 需求直接冲突——过期状态默认隐藏，违反"过期警告需显眼"原则。此方案应被排除。

**评审意见**：D3 不应作为正式候选方案，因为它与已选定的 C1 方案存在根本冲突。保留它作为对比参考可以，但选择理由中"与缺口 C 冲突"这一点应在方案提出时就标注为 hard-blocker，而非作为权衡项。

## 7. 其他发现

### 7.1 CSS 变量定义有语法错误

P2-design.md 第 308 行：
```css
--c-warning-surface: rgba(254,188,46,.1);     1);  /* dark */
```
`1);` 是多余的，应为：
```css
--c-warning-surface: rgba(254,188,46,.1);  /* dark */
```

### 7.2 --c-error-surface 确认缺失

代码搜索确认：`--c-error-surface` 在 `EntryDetailView.vue:903`、`EntryCard.vue:140`、`ExpiresInDialog.vue:110` 中被使用，但 `variables.css` 中未定义。这是既有 bug，P4 实现时必须补全。

### 7.3 cleanup_expired() 的 Session 生命周期问题

`admin_service.py:119-135` 中 `with Session(self.engine) as session:` 在 commit 后（line 135），代码继续在 session 外执行 `to_delete` 循环（line 159-165），但 `to_delete` 列表是在 session 内构建的。当前代码在 session 关闭后访问 `entry_service.delete_entry_by_api_key(slug)` 是安全的（只用了 slug 字符串），但 `self.storage.get_entry_size(e.id)` 在 line 152 也在 session 内，这是正确的。设计未提及此潜在风险，但当前代码无问题，仅标注。

### 7.4 B1 方案 @username 交互分支需明确

设计原文："点击用户名 → 跳转 /users/{username}（复用现有路由），或如果已在 /explore 则显示 @username chip + owner=username"

这个"或"需要 P3 实现前明确：
- **建议**：统一行为——无论在 /explore 还是 /users/:username，点击 @username 都跳转到 /users/{username}。chip 只在 /users/:username 页面显示（由路由参数驱动，非手动添加）。这样交互一致且实现简单。

## 8. 推进条件

以下条件需在 P3 开始前确认或解决：

1. **[必须]** B-AC3 交互分支明确：@username 点击行为统一为跳转 /users/{username}，chip 由路由参数驱动
2. **[必须]** gate_commands 补充 ruff lint + E2E 验证项具体化
3. **[建议]** A1 代码示例中 `asyncio.get_event_loop()` 改为 `asyncio.get_running_loop()` 或 `asyncio.to_thread()`
4. **[建议]** D1 移动端 bar 48px 高度需验证触控热区，或保持 56px
5. **[建议]** D1 方案补充 768-1024px 中等宽度响应式断点处理
6. **[低优]** CSS 变量定义语法修正（7.1）
