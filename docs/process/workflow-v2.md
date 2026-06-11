# PeekView 开发流程规范 v2.0（专业版）

> ⚠️ **v3 已发布**：`docs/process/workflow-v3/`。v3 补齐了 v2 缺失的可执行派发协议、
> 状态机落盘、双层角色体系，解决了"主 Agent 不派发子 Agent 导致上下文爆炸"的问题。
> 新任务建议用 v3；进行中的任务（T001/T002）可继续用 v2 完成。

> 本文档定义 PeekView 项目的标准开发流程。
> **核心目标**：从需求到发布顺滑完成，每一步可追溯，Agent 无法偷跑。

---

## 一、核心原则

| 原则 | 说明 |
|------|------|
| **门禁驱动** | 每个阶段有明确门槛，不通过无法进入下一阶段 |
| **文件即证据** | 口头承诺无效，必须有文件输出 |
| **强制追溯** | 每个文件必须声明 parent/child，形成双向追溯链 |
| **子 Agent 编排** | 主 Agent 负责任务分派，子 Agent 执行具体阶段 |
| **验收对照** | 最终交付必须逐项对照原始需求 |

---

## 二、阶段定义

### 阶段编号

不一定是 P0-P5，根据任务复杂度灵活调整：

```
P1: 问题定义           （必须）
P2: 方案设计+评审      （必须，门槛）
P3: 测试设计（TDD）    （必须）
P4: 代码实现           （必须）
P5: 逐项验证           （必须）
P6: 一致性检查         （必须）
P7: 发布               （必须）

简单任务：P1 → P2 → P3 → P6 → P7
复杂任务：P1 → P2 → P3 → P4 → P5 → P6 → P7
```

**门槛阶段**：
- **P2**（方案评审）：不通过 → 禁止进入 P3
- **P5**（验证）：有失败 → 禁止进入 P6，必须先修复

---

## 三、目录结构

### 任务目录

```
docs/
├── process/
│   └── workflow.md            # 原始流程（保留兼容）
│   └── workflow-v2.md         # 本流程规范
│
├── tasks/                     # 每个任务一个目录
│   ├── T001-mcp-namespace-map/
│   │   ├── P1-problems.md
│   │   ├── P1-test-strategy.md
│   │   ├── P2-design.md
│   │   ├── P2-review.md
│   │   ├── P3-test-cases.md
│   │   ├── P3-test-code/
│   │   │   ├── test_publish.ts
│   │   │   └── test_config.py
│   │   ├── P4-implementation/
│   │   │   ├── publishFiles.ts
│   │   │   └── config.ts
│   │   ├── P5-test-results/
│   │   │   ├── unit.md
│   │   │   ├── manual.md
│   │   │   └── evidences/
│   │   │       ├── issue1.png
│   │   │       └── issue2.png
│   │   ├── P6-consistency.md
│   │   ├── P7-release.md
│   │   └── TRACEBILITY.md    # 追溯总览（自动生成）
│   │
│   ├── T002-another-task/
│   │   └── ...
│   │
│   └── active-tasks.md        # 活跃任务看板
│
└── reviews/                   # 独立评审记录
    ├── expert-review-xxx.md
    └── ...
```

### 文件命名规范

| 阶段 | 文件命名 | 例子 |
|------|----------|------|
| P1 | `P1-{type}.md` | `P1-problems.md`, `P1-test-strategy.md` |
| P2 | `P2-{type}.md` | `P2-design.md`, `P2-review.md` |
| P3 | `P3-{type}.md` + 测试代码目录 | `P3-test-cases.md`, `P3-test-code/` |
| P4 | 实现代码目录 | `P4-implementation/` |
| P5 | `P5-test-results/` 目录 | `P5-test-results/unit.md` |
| P6 | `P6-consistency.md` | `P6-consistency.md` |
| P7 | `P7-release.md` | `P7-release.md` |

---

## 四、文件 Header 规范（强制）

**每个文件必须有这些字段**：

```yaml
---
phase: P2                           # 阶段：P1/P2/P3/P4/P5/P6/P7
task_id: T001                       # 任务序号
task_name: mcp-ns-map              # 任务名称（简短，英文+横线）
type: design                        # 文件类型
parent: T001/P1-problems.md         # 父文件（必须有）
child: T001/P4-implementation/publishFiles.ts  # 子文件（可选）
trace_id: T001-P2-20250611          # 唯一追踪ID：{task_id}-{phase}-{date}
created: 2026-06-11                 # 创建日期
status: draft|review|approved|rejected  # 状态
---

# 方案设计

...
```

**强制规则**：
- `parent` 字段必须有，否则视为"石头里蹦出来的"，验收不通过
- `trace_id` 必须全局唯一
- `phase` 必须与实际阶段一致

---

## 五、子 Agent 任务分派与上下文传递

### 架构

```
主 Agent（编排者）
    │
    ├── P1 子 Agent: 问题定义
    │       输入: 原始需求 / Bug 报告
    │       输出: P1-problems.md, P1-test-strategy.md
    │
    ├── P2 子 Agent: 方案设计
    │       输入: P1 输出文件
    │       输出: P2-design.md
    │               ↓
    │       专家评审 → P2-review.md
    │               ↓
    │       质量评估 → 通过/继续/打回
    │
    ├── P3-P5 子 Agent: 实现+验证
    │       输入: P2 评审通过方案
    │       输出: P3-test-cases.md → P4代码 → P5-test-results/
    │
    └── P6-P7 子 Agent: 收尾+发布
            输入: P5 验证通过报告
            输出: P6-consistency.md, P7-release.md
```

### 上下文传递原则

**唯一介质：文件**

```
主 Agent                          子 Agent
    │                                  │
    │  创建任务目录 + 写入输入文件       │
    ├────────────────────────────────► │
    │                                  │ 读取文件、执行
    │                                  │ 输出到文件
    │  读取输出文件                      │
    ├◄────────────────────────────────  │
    │                                  │
    ↓                                  ↓
验证 → 创建下一阶段输入文件          结束
```

**子 Agent 必须收到的上下文**：

| 子 Agent | 必须读取的文件 |
|----------|---------------|
| P1 子 Agent | 原始需求 / Bug 报告（外部输入）|
| P2 子 Agent | `Txxx/P1-problems.md`, `Txxx/P1-test-strategy.md` |
| P3-P5 子 Agent | `Txxx/P2-design.md`, `Txxx/P2-review.md`（评审通过版）|
| P6-P7 子 Agent | `Txxx/P5-test-results/`（验证通过版）|

---

## 六、追溯链条

### 正向追踪（Requirement → Delivery）

```
P1 原始需求
    ↓
P2 方案设计
    ↓
P3 测试用例
    ↓
P4 ���码实现
    ↓
P5 验证结果
    ↓
P6 一致性检查
    ↓
P7 发布
```

### 逆向追踪（从任意点回溯到源头）

```
P5 测试失败
    ↓ 逆向
对应测试用例 ← P3-test-cases.md
    ↓ 逆向
对应代码 ← P4-implementation/
    ↓ 逆向
对应设计方案 ← P2-design.md
    ↓ 逆向
原始需求 ← P1-problems.md
```

### 追溯总览文件（TRACEBILITY.md）

每个任务目录必须有追溯总览：

```markdown
# 追溯总览: T001-mcp-namespace-map

## 正向链

| 阶段 | 文件 | 状态 |
|------|------|------|
| P1 | P1-problems.md | ✅ |
| P1 | P1-test-strategy.md | ✅ |
| P2 | P2-design.md | ✅ |
| P2 | P2-review.md | ✅ 通过 |
| P3 | P3-test-cases.md | ✅ |
| P4 | P4-implementation/publishFiles.ts | ✅ |
| P5 | P5-test-results/unit.md | ✅ |
| P5 | P5-test-results/manual.md | ✅ |
| P6 | P6-consistency.md | ✅ |
| P7 | P7-release.md | ⏳ |

## 逆向链示例

- test_publish.ts 失败 → P3-test-cases.md#case-5 → P2-design.md#§4 → P1-problems.md#issue-3

## 需求对照

| P1 原始问题 | P2 设计 | P4 代码 | P5 测试 | 结果 |
|------------|---------|---------|---------|------|
| issue-1    | §2      | abc     | pass    | ✅   |
| issue-2    | §3      | def     | pass    | ✅   |
| issue-3    | §4      | ghi     | fail    | ❌   |
```

---

## 七、强制文件依赖检查

### 每个阶段必需文件

```python
FILE_REQUIREMENTS = {
    "P1": {
        "problems": {"pattern": "**/P1-problems.md", "required": True},
        "test_strategy": {"pattern": "**/P1-test-strategy.md", "required": True}
    },
    "P2": {
        "design": {"pattern": "**/P2-design.md", "required": True},
        "review": {"pattern": "**/P2-review.md", "required": True}
    },
    "P3": {
        "test_cases": {"pattern": "**/P3-test-cases.md", "required": True},
        "test_code": {"pattern": "**/P3-test-code/**/*", "required": False, "min_count": 1}
    },
    "P4": {
        "implementation": {"pattern": "**/P4-implementation/**/*", "required": True, "min_count": 1}
    },
    "P5": {
        "test_results": {"pattern": "**/P5-test-results/**/*", "required": True},
        "unit": {"pattern": "**/P5-test-results/unit.md", "required": True},
        "manual": {"pattern": "**/P5-test-results/manual.md", "required": True}
    },
    "P6": {
        "consistency": {"pattern": "**/P6-consistency.md", "required": True}
    },
    "P7": {
        "release": {"pattern": "**/P7-release.md", "required": True}
    }
}
```

### 检查规则

| 检查项 | 不通过后果 |
|--------|-----------|
| 缺少必需阶段文件 | ❌ 无法进入下一阶段 |
| 缺少 parent 声明 | ❌ 视为无效文件，验收不通过 |
| P2 评审 status=rejected | ❌ 禁止进入 P3 |
| P5 测试有失败项 | ❌ 禁止进入 P6，必须先修复回归 |
| P1 问题未在 P5 中验证 | ❌ 验收不通过 |

---

## 八、完整流程示例

```
任务: T001-MCP-Namespace-Mapping

P1: 问题定义
    主 Agent 创建 docs/tasks/T001-mcp-namespace-map/
    子 Agent 1 执行 → 输出 P1-problems.md, P1-test-strategy.md
    ✅ 验证通过

P2: 方案设计+评审
    主 Agent 写入 P1 输出到子 Agent 2 上下文
    子 Agent 2 执行 → 输出 P2-design.md
    专家评审 → P2-review.md (status: approved)
    ✅ 验证通过，进入 P3

P3-P5: 实现+验证
    主 Agent 写入 P2 评审通过方案
    子 Agent 3 执行:
      - P3: test-cases.md + 测试代码（先失败）
      - P4: 代码实现
      - P5: test-results/
    ⚠️ P5 发现测试失败 → 回归修复 → 重新验证
    ✅ 验证通过

P6-P7: 收尾+发布
    主 Agent 写入 P5 验证报告
    子 Agent 4 执行 → P6-consistency.md, P7-release.md
    
最终验收:
    - 读取 P1-problems.md（原始需求）
    - 读取 P5-test-results/（验证结果）
    - 逐项对照 → 全部满足？ → ✅ 发布
```

---

## 九、验收判定

### 最终验收模板

```markdown
# 最终验收报告: T001-xxx

## 需求追溯

| P1 原始问题 | P2 设计 | P4 代码 | P5 测试 | 结论 |
|------------|---------|---------|---------|------|
| issue-1    | §2      | commit1 | pass    | ✅   |
| issue-2    | §3      | commit2 | pass    | ✅   |
| issue-3    | §4      | commit3 | fail    | ❌   |

## 验收结论

- 总需求数：3
- 已满足：2
- 未满足：1 (issue-3)

## 未满足项
- issue-3: [原因] → [下一步]
```

---

## 十、检查点速查

| 阶段 | 必需文件 | 门槛 |
|------|----------|------|
| P1 | P1-problems.md, P1-test-strategy.md | 无 |
| P2 | P2-design.md, P2-review.md | review.status=approved |
| P3 | P3-test-cases.md, P3-test-code/ | 单元测试当前失败（TDD）|
| P4 | P4-implementation/ | 无 |
| P5 | P5-test-results/unit.md, manual.md | 所有测试通过 |
| P6 | P6-consistency.md | 无 |
| P7 | P7-release.md | 无 |

---

## 十一、任务管理看板

### 11.1 任务创建流程（Agent 自动执行）

当 Agent 收到需求时，必须按以下顺序执行：

```
1. 读取任务看板 → 确定下一个任务编号
2. 创建任务目录
3. 创建 P1-problems.md（包含 task_id, task_name）
4. 更新任务看板 → 添加新任务
```

### 11.2 任务编号规则

```
T{序号}-{task-name}

示例：
T001-mcp-namespace-map
T002-fix-login-bug
T003-add-dark-theme
```

- **序号**：从任务看板当前最大序号 +1 开始
- **task-name**：用英文+横线，简洁概括任务内容

### 11.3 任务看板文件

文件位置：`docs/tasks/active-tasks.md`

```markdown
# 任务看板 (Task Board)

> 最后更新：2026-06-11

## 任务列表

| 序号 | 任务名称 | 状态 | 阶段 | 优先级 | 创建日期 | 更新日期 |
|------|----------|------|------|--------|----------|----------|
| T001 | mcp-namespace-map | 🔄 进行中 | P2 | P1 | 2026-06-10 | 2026-06-11 |
| T002 | fix-login-bug | ⬜ 待开始 | P1 | P0 | 2026-06-11 | 2026-06-11 |

## 状态说明

| 状态 | 含义 |
|------|------|
| ⬜ 待开始 | 任务已创建，P1 尚未开始 |
| 🔄 进行中 | 正在执行某个阶段 |
| ⏸️ 暂停 | 被阻塞，等待外部条件 |
| ✅ 待验证 | 阶段完成，等待评审/验证 |
| ❌ 失败 | 评审不通过或验证失败 |
| ✅✅ 已完成 | P7 发布完成 |

## 阶段说明

| 阶段 | 含义 |
|------|------|
| P1 | 问题定义 |
| P2 | 方案设计+评审 |
| P3 | 测试设计（TDD）|
| P4 | 代码实现 |
| P5 | 逐项验证 |
| P6 | 一致性检查 |
| P7 | 发布 |
```

### 11.4 任务状态更新规则

| 触发事件 | 状态变化 | 看板更新 |
|----------|----------|----------|
| 任务创建 | ⬜ 待开始 | 添加新任务行 |
| P1 开始 | 🔄 进行中 | 阶段列��新为 P1 |
| P1 完成，进入 P2 | 🔄 进行中 | 阶段列更新为 P2 |
| P2 评审通过 | ✅ 待验证 | 状态列更新 |
| P2 评审不通过 | ❌ 失败 | 状态列更新，标注原因 |
| P5 验证全部通过 | ✅ 待验证 | 状态列更新 |
| P7 发布完成 | ✅✅ 已完成 | 状态列更新，添加完成日期 |

### 11.5 Agent 操作示例

```bash
# Agent 收到需求："实现 MCP Path Namespace 映射功能"

# 1. 读取任务看板，确定下一个编号
cat docs/tasks/active-tasks.md
# 当前最大序号：T001
# 下一个编号：T002

# 2. 创建任务目录
mkdir -p docs/tasks/T002-mcp-namespace-map

# 3. 创建 P1-problems.md（Header 必须包含 task_id）
cat > docs/tasks/T002-mcp-namespace-map/P1-problems.md << 'EOF'
---
phase: P1
task_id: T002
task_name: mcp-namespace-map
type: problems
trace_id: T002-P1-20250611
created: 2026-06-11
status: draft
parent: (外部需求)
---

# 问题定义

## 原始需求
...
EOF

# 4. 更新任务看板
# 在任务列表末尾添加一行：
| T002 | mcp-namespace-map | 🔄 进行中 | P1 | P1 | 2026-06-11 | 2026-06-11 |
```

### 11.6 关键阶段必须更新看板

| 阶段 | 必须更新看板 |
|------|-------------|
| P1 完成 | ✅ 更新阶段为 P2 |
| P2 评审完成 | ✅ 更新状态（通过/失败）+ 记录评审结果文件 |
| P3 完成后 | ✅ 更新阶段为 P4 |
| P4 完成后 | ✅ 更新阶段为 P5 |
| P5 验证完成 | ✅ 更新阶段为 P6 |
| P6 完成 | ✅ 更新阶段为 P7 |
| P7 发布完成 | ✅ 更新状态为已完成 |

---

## 十二、子 Agent 任务分派（补充）

### 12.1 主 Agent 职责

主 Agent 收到需求后的完整流程：

```
1. 读取 workflow-v2.md（掌握流程规范）
2. 读取 active-tasks.md（确定任务编号）
3. 创建任务目录 + 初始化 P1 文件
4. 更新 active-tasks.md（添加新任务）
5. 分派给子 Agent 执行各阶段
6. 监控各阶段完成状态
7. 阶段门槛检查（不通过则回滚）
8. 任务完成后更新看板
```

### 12.2 子 Agent 接收的上下文

每个子 Agent 启动时，必须收到：

```
子 Agent X (执行 P{n} 阶段)
├── 输入文件
│   ├── docs/tasks/T{xxx}/
│   │   ├── P{n-1}-*.md        # 上一阶段输出
│   │   └── P{n-2}-*.md        # 更早阶段（必要时）
│   └── docs/process/workflow-v2.md  # 流程规范
│
├── 任务信息
│   ├── task_id: Txxx
│   ├── task_name: xxx
│   └── current_phase: P{n}
│
└── 输出要求
    ├── 必须生成的文件列表
    ├── Header 规范（必须包含 parent）
    └── 门禁条件（什么是"通过"）
```

### 12.3 子 Agent 输出规范

每个子 Agent 完成后，必须：

1. **生成指定文件**到任务目录
2. **每个文件必须包含 Header**（phase, task_id, parent, trace_id）
3. **返回执行结果**给主 Agent

---

**版本**: v2.0  
**创建日期**: 2026-06-11  
**状态**: 草稿，待实践验证后迭代