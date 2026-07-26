---
phase: P2
task_id: T073
type: review
parent: P2-design.md
trace_id: T073-P2-review-20260726
status: approved
created: 2026-07-26
agent: plan-eng-review
---

## 评审结论：approved

0 个阻塞级问题，2 个非阻塞建议。

## 逐项审查

### 数据流

设计的数据流清晰：ruff `--fix --unsafe-fixes` 误改 → 19 处 SQLAlchemy Column 比较语义破坏 → 修复为 `.is_()`/`.isnot()`/`~`/`.is_(True)` → pyproject.toml ignore E711/E712 防回归。

异常路径已覆盖：
- Python 对象上下文 vs SQLAlchemy 查询上下文的区分（§"不改什么"明确列出）
- `apikey_service.py:127` 已是正确语法，无需修改（已验证代码：`ApiKey.expires_at.is_(None)`）

**验证**：逐行对照源码确认 19 处修复映射全部准确，行号与实际代码一致。

### 状态机

不涉及状态机。修复是静态代码替换，无状态转换。

### 接口契约

- 修复不改变 API 接口，只恢复被破坏的 SQL 查询语义
- `pyproject.toml` 的 ruff ignore 是项目内部配置，无外部契约影响
- 裸 `Entry.is_public` → `Entry.is_public.is_(True)` 是语义等价但更明确的写法，不改变 SQL 输出

### 错误边界

- **Python 上下文 vs SQLAlchemy 上下文**：设计明确标注了边界（§"不改什么"），且通过实际代码验证确认所有 Python 上下文的 `is None`/`is not None`/`not` 未被误列入修复范围
- **ruff ignore 副作用**：设计已分析（§1 方案A 风险），结论合理——Python 代码中 `== None`/`== True` 本就不符合 PEP 8，ignore 不会漏掉真正问题
- **admin_service.py:130 `case((Entry.is_public, 1))`**：裸 Column 在 `case()` 中是合法 SQLAlchemy（生成 `CASE WHEN entry.is_public THEN 1`），设计未将其列入修复，正确

### 测试策略

- gate_commands 声明 `P5: cd backend && .venv/bin/python -m pytest tests/ -q --tb=no`，与 Makefile `test-quick` 目标一致
- BDD 覆盖映射（§3）逐条对应 P1 的 13 条 BDD，无遗漏
- `test_read_tracking.py:365` 的修复确保测试本身不再有误报风险
- P6 gate_commands 与 P5 相同，适合纯后端修复

### 多方案探索

3 个候选方案（A 全局 ignore / B per-file-ignores / C noqa），权衡表覆盖防护强度、维护成本、精确性、实际副作用四个维度。

选择理由自洽：
1. 方案 C 已被证明无效（noqa 会被 `--unsafe-fixes` 删除）——这是关键事实锚点
2. 方案 B 维护成本高且易遗漏——6 个文件已需 ignore，未来可能更多
3. 方案 A 副作用极小——Python 代码不会写 `== None`

### 实现就绪度

- **files_to_read** 精确到行号范围，覆盖实现所需全部上下文
- 修复映射表（§2）按 4 种模式分类，每处标注文件:行 + 误改 + 修复，implementer 无需额外推断
- pyproject.toml 修改给出了完整 toml 片段，可直接应用
- 完成标准（§4）5 条可机械验证

### minimal_validation

`result: not_needed`，理由：纯代码逻辑修复，SQLAlchemy `.is_()`/`.isnot()` /`~` 语法是文档化 API。合理。

## 架构问题（阻塞级）

无。

## 架构问题（非阻塞）

1. **[NB-1] entry_service.py:448/451 OR 表达式修复后可简化**：当前 `(Entry.is_public) | (Entry.owner_id == current_user_id)` 修复为 `Entry.is_public.is_(True) | (Entry.owner_id == current_user_id)`，功能正确但 `is_(True)` 在 OR 表达式中略显冗余（裸 `Entry.is_public` 在 OR 中 SQLAlchemy 也能正确处理）。不阻塞——更明确的写法反而更好，且与 ruff ignore 策略一致（避免裸 Column 引发任何歧义）。记录为 TD-NB1。

2. **[NB-2] gate_commands 未使用 Makefile target**：设计写 `cd backend && .venv/bin/python -m pytest tests/ -q --tb=no`，而 Makefile 有 `make test-quick`。AGENTS.md 约定"gate_commands 建议使用 Makefile target"。不阻塞——命令语义等价，且 `make test-quick` 用 `-v --tb=short` 输出更详细，P5 阶段可考虑改用 `make test-quick`。记录为 TD-NB2。

## 测试缺口

无。P1 的 13 条 BDD 全部有修复映射，P3 TDD 阶段将补充回归测试。

## 锁定决策

1. 方案 A（全局 ignore E711/E712）为最终方案
2. 19 处修复映射经代码验证全部准确
3. Python 上下文 vs SQLAlchemy 上下文边界已锁定

## 环境隔离

[PROD_NOT_TOUCHED]
