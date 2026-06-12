# 开发流程章程 (Development Workflow)

> ⚠️ **已退役**：v3 已发布（`docs/process/workflow-v3/`），本文件（v1, P0-P4）保留仅供历史参考。新任务用 v3。

> 本文档定义本项目的标准开发流程。所有工作必须按检查点逐项执行，每项检查点必须有文件输出作为证据。

## 核心原则

1. **检查点驱动** - 工作被划分为强制性检查点，必须逐项通过
2. **TDD原则** - 测试设计先于代码，先看到测试失败，再修复代码
3. **文件即证据** - 每项检查点的完成必须有对应的文件/截图/记录
4. **禁止批量** - 每个问题独立检查点，禁止"改完一起测"
5. **人工验证** - UI/UX问题必须有手工验证，自动化测试不足够

---

## 阶段与检查点

### P0: 问题确认与验收标准

**准入条件**: 收到需求或Bug报告  
**输出目录**: `docs/process/checkpoints/P0-{task-id}/`

| 检查点 | 内容 | 输出文件 | 完成标准 |
|--------|------|----------|----------|
| P0.1 | 问题清单 | `problems.md` | 每项问题: 现象、期望行为、验收标准 |
| P0.2 | 测试策略 | `test-strategy.md` | 每项问题标注: 单元/集成/E2E/手工 |
| P0.3 | 文档更新 | `active-tasks.md` | 问题已移入活跃看板，标记状态 |

**P0.3 检查清单**:
```markdown
- [ ] problems.md 已创建，每项问题有明确验收标准
- [ ] test-strategy.md 已创建，UI问题标注"需手工验证"
- [ ] active-tasks.md 已更新
```

---

### P1: 测试用例设计（先于代码！）

**准入条件**: P0 全部通过  
**输出目录**: `docs/process/checkpoints/P1-{task-id}/`

| 检查点 | 内容 | 输出文件 | 完成标准 |
|--------|------|----------|----------|
| P1.1 | 测试用例文档 | `test-cases.md` | 每项问题对应测试用例，含预期结果 |
| P1.2 | 单元测试代码 | `*.spec.ts` / `test_*.py` | 测试代码已提交，且**当前失败** |
| P1.3 | 手工验证清单 | `manual-checklist.md` | UI问题：验证步骤、预期截图、通过标准 |

**test-cases.md 格式**:
```markdown
| 问题ID | 测试描述 | 预期结果 | 测试类型 | 测试文件 |
|--------|----------|----------|----------|----------|
| P2 | 页面可垂直滚动 | 桌面端可滚动到页底 | 手工验证 | manual-checklist.md |
| P3 | 代码高亮背景正确 | 深色主题bg=#1e1e1e | 截图对比 | manual-checklist.md |
| P4 | Wrap按钮存在且可点击 | header显示Wrap按钮，点击切换 | 单元+手工 | EntryDetailView.spec.ts |
```

**manual-checklist.md 格式**（UI问题强制）:
```markdown
## 问题2: 页面可滚动验证
- [ ] 步骤1: 桌面端浏览器打开详情页
- [ ] 步骤2: 内容超出视口时，可垂直滚动
- [ ] 证据: 截图/录屏保存到 `evidences/P2-scroll.png`

## 问题3: 代码高亮样式验证
- [ ] 步骤1: 切换到深色主题
- [ ] 步骤2: 查看代码块，背景色应为深色
- [ ] 证据: 截图保存到 `evidences/P3-dark-theme.png`
- [ ] 步骤3: 切换到浅色主题
- [ ] 步骤4: 查看代码块，背景色应为浅色
- [ ] 证据: 截图保存到 `evidences/P3-light-theme.png`
```

**P1.3 检查清单**:
```markdown
- [ ] test-cases.md 已创建，每项问题有对应测试
- [ ] 单元测试代码已提交，能复现问题（失败状态）
- [ ] UI问题有 manual-checklist.md，含验证步骤和截图要求
```

---

### P2: 代码实现

**准入条件**: P1 全部通过  
**执行规则**:
1. **禁止批量修改** - 每个问题独立分支/提交
2. **最小化修改** - 只改解决问题所必需的代码
3. **代码即注释** - 复杂逻辑必须有行内注释

**输出**:
- 代码文件修改
- Git commit（按规则4）

---

### P3: 逐项验证（最关键！）

**准入条件**: P2 代码实现完成  
**输出目录**: `docs/process/checkpoints/P3-{task-id}/`

| 检查点 | 内容 | 输出文件 | 完成标准 |
|--------|------|----------|----------|
| P3.1 | 单元测试执行 | `test-results/unit.md` | 测试通过，或明确说明为何不适用 |
| P3.2 | 集成测试执行 | `test-results/integration.md` | API/模块交互正常 |
| P3.3 | 手工验证 | `test-results/manual.md` + 截图 | **UI问题必须有截图证据** |
| P3.4 | 回归测试 | `test-results/regression.md` | 未修改功能仍正常 |

**test-results/manual.md 格式**（强制）:
```markdown
## 手工验证结果

### 问题2: 页面可滚动
- [x] 验证通过
- 证据: ![滚动截图](evidences/P2-scroll.png)
- 环境: Chrome 120, 1920x1080
- 备注: 可正常滚动到页底

### 问题3: 代码高亮样式
- [ ] 验证失败 ❌
- 证据: ![样式错误](evidences/P3-fail.png)
- 问题: 背景色仍为白色，未使用CSS变量
- 下一步: 修复 CodeViewer.vue 第214行
```

**关键规则**:
- **单元测试通过 ≠ 问题修复** - 单元测试只验证"组件不崩溃"
- **UI问题必须有手工验证截图** - 无截图视为未验证
- **验证失败必须回滚到P1** - 修改测试或修改代码，重新开始P2

**P3.4 检查清单**:
```markdown
- [ ] test-results/unit.md 已创建（或明确标注N/A）
- [ ] test-results/manual.md 已创建
- [ ] 每项UI问题有截图证据，存于 evidences/ 目录
- [ ] 如有验证失败，已记录原因和下一步
```

---

### P4: 文档一致性检查

**准入条件**: P3 全部通过  
**输出目录**: `docs/process/checkpoints/P4-{task-id}/`

| 检查点 | 内容 | 输出文件 | 完成标准 |
|--------|------|----------|----------|
| P4.1 | 代码-测试-文档一致性 | `consistency-check.md` | 三方核对，无矛盾 |
| P4.2 | 版本号检查 | `version-check.md` | 版本号已更新 |
| P4.3 | CHANGELOG更新 | `CHANGELOG.md` | 变更描述准确 |

**consistency-check.md 格式**:
```markdown
## 一致性核对

| 问题 | 代码修改 | 测试覆盖 | 文档描述 | 一致? |
|------|----------|----------|----------|-------|
| P2 滚动修复 | App.vue:13 min-height | manual.md 截图 | CHANGELOG 已记 | ✅ |
| P3 高亮样式 | CodeViewer.vue:214 | manual.md 截图 | CHANGELOG 已记 | ✅ |
| P4 Wrap按钮 | EntryDetailView.vue | .spec.ts + manual | CHANGELOG 已记 | ✅ |
```

---

### P5: 发布

**准入条件**: P4 全部通过

| 检查点 | 内容 | 输出文件 | 完成标准 |
|--------|------|----------|----------|
| P5.0 | **调试环境隔离验证** | `debug-isolation-check.md` | 确认调试服务使用独立数据库，未污染生产数据 |
| P5.1 | 构建验证 | `build-log.md` | 前端构建成功，静态文件已复制 |
| P5.2 | 端到端验证 | `e2e-verification.md` | `make debug` 启动后访问正常 |
| P5.3 | GitHub Push | git log | 代码+tag已推送 |
| P5.4 | PyPI发布 | `pypi-release.md` | 包已上传，可安装 |

**P5.0 调试环境隔离验证**（v0.1.22 教训，强制）:
```bash
# 启动调试服务（会自动使用 /tmp/peekview-debug/）
make debug-start

# 验证1: 确认调试环境数据独立
curl -s http://127.0.0.1:8888/api/v1/entries | jq '.total'
# 期望: 0 或只有测试数据（生产数据不应出现）

# 验证2: 确认生产环境数据完整
curl -s http://127.0.0.1:8080/api/v1/entries | jq '.total'
# 期望: 生产数据条目数，与调试环境不同

# 验证3: 确认数据库文件位置
lsof -p $(pgrep -f "uvicorn.*8888") | grep peekview.db
# 期望: /tmp/peekview-debug/peekview.db （不是 ~/.peekview/）
```

**P5.2 端到端验证**（强制）:
```bash
# 使用 make debug 而非直接 peekview serve
make debug
# 浏览器访问 http://127.0.0.1:8888
# 验证: 截图保存到 test-results/e2e-homepage.png
```

---

## 我的执行规则（更新版）

### 规则 1: 检查点强制

**我必须按顺序通过每个检查点，禁止跳过。**

错误示例:
```
❌ "我改了代码，测试100 passed，应该没问题了"
```

正确示例:
```
✅ "P1完成: test-cases.md 已创建，单元测试当前失败（证明问题存在）
    P2完成: 代码已修改，提交 hash abc123
    P3.3完成: manual.md 已创建，截图 evidences/P2-scroll.png 证明滚动正常
    请确认 P3 通过，进入 P4"
```

### 规则 2: 无文件 = 未完成

**口头报告测试通过是无效的。每项检查点必须有文件输出。**

| 无效报告 | 有效证据 |
|----------|----------|
"前端测试100 passed" | `test-results/unit.md` 含测试命令输出截图
| "页面可以滚动了" | `evidences/P2-scroll.png` 截图证明
| "样式修复了" | 深色/浅色主题对比截图

### 规则 3: UI问题手工验证强制

**所有UI/UX问题必须有 `manual-checklist.md` 和截图证据。**

自动测试不足以验证:
- 布局正确性
- 样式渲染
- 滚动行为
- 主题切换
- 响应式适配

### 规则 4: 禁止批量修改

**每个问题独立处理:**
```
问题2 (滚动) → P1 → P2 → P3 → 提交 → 下一步
问题3 (样式) → P1 → P2 → P3 → 提交 → 下一步
```

禁止:
```
问题2+3+4 → 一起改 → 一起测 → 提交
```

### 规则 5: 失败即停

任何检查点失败:
1. 记录失败原因到该检查点的输出文件
2. **停止前进**，不得进入下一阶段
3. 选择:
   - 修复当前问题，重新验证该检查点
   - 或回滚到上一检查点，重新设计

### 规则 6: 提交规则

**提交时机**:
- 每个 P2（代码实现）完成后必须提交
- 每个 P3（验证完成）通过后必须提交
- 每天工作结束前（无论是否完成）

**提交信息**:
```
[Task X][P{阶段}] 描述

检查点:
- P0.1: problems.md 已创建
- P1.1: test-cases.md 已创建
- P1.2: 单元测试失败（预期）
- P2: 修复完成
- P3.3: manual.md 已创建，验证通过

证据:
- 截图: docs/process/checkpoints/P3-{task}/evidences/*.png

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```

---

## 我的限制（必须承认）

### 我无法做到：
1. ❌ 跨会话记住检查点进度（必须靠文件）
2. ❌ 执行真正的浏览器截图（需要你提供或确认）
3. ❌ 访问外部系统（PyPI上传除外）
4. ❌ 长时间保持运行（>30分钟）

### 你必须提供的：
1. ✅ 对于UI问题：实际浏览器截图，或确认"已验证"
2. ✅ 明确的"检查点通过"指令
3. ✅ PyPI token 等发布凭证

---

## 检查点速查表

```
P0: 问题定义
   ├─ problems.md (问题清单+验收标准)
   ├─ test-strategy.md (测试类型标注)
   └─ active-tasks.md (看板更新)

P1: 测试设计（先于代码！）
   ├─ test-cases.md (每项问题的测试用例)
   ├─ 单元测试代码 (先提交，当前应失败)
   └─ manual-checklist.md (UI问题验证步骤+截图要求)

P2: 代码实现
   └─ 独立提交，禁止批量

P3: 逐项验证（必须有证据！）
   ├─ test-results/unit.md
   ├─ test-results/manual.md + evidences/*.png (UI强制)
   └─ test-results/regression.md

P4: 一致性检查
   ├─ consistency-check.md (代码-测试-文档核对)
   └─ CHANGELOG.md + 版本号更新

P5: 发布
   ├─ P5.0 debug-isolation-check.md (数据隔离验证)
   ├─ build-log.md
   ├─ e2e-verification.md (实际访问截图)
   ├─ GitHub push + tag
   └─ PyPI release
```

---

## 示例：Task 18 的正确执行方式

```
P0:
  └─ docs/process/checkpoints/P0-T18/
      ├─ problems.md (6项问题清单)
      └─ test-strategy.md (P2/P3/P5需手工验证)

P1:
  └─ docs/process/checkpoints/P1-T18/
      ├─ test-cases.md
      │   问题2: 页面滚动 → 手工验证 → 截图要求
      │   问题3: 代码高亮 → 手工验证 → 截图对比
      │   问题4: Wrap按钮 → 单元测试 + 手工验证
      ├─ EntryDetailView.spec.ts (新增测试，当前失败)
      └─ manual-checklist.md (验证步骤+截图要求)

P2:
  ├─ 问题2修复: App.vue → 提交 hash abc
  ├─ 问题3修复: CodeViewer.vue → 提交 hash def
  └─ 问题4修复: EntryDetailView.vue → 提交 hash ghi

P3:
  └─ docs/process/checkpoints/P3-T18/
      ├─ test-results/unit.md
      ├─ test-results/manual.md
      └─ evidences/
          ├─ P2-scroll.png (用户提供/确认)
          ├─ P3-dark-theme.png
          ├─ P3-light-theme.png
          └─ P4-wrap-button.png

[等待用户确认: "P3 截图证据已提供，检查点通过"]

P4:
  └─ consistency-check.md
  └─ CHANGELOG.md 更新

P5:
  └─ e2e-verification.md (peekview serve + 访问截图)
  └─ PyPI发布
```

---

最后更新: 2026-04-24  
版本: v2.0 (检查点驱动)
