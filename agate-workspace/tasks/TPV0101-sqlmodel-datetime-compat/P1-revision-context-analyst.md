# P1 修订派发指引（retry #1）— analyst — TPV0101

---
phase: P1
task_id: TPV0101
role: analyst
round: 1 (revision)
generated_by: 主 Agent
---

> ⚠️ 以下派发指引是本次修订的强制指令。执行优先级：本修订指引 > 原 P1 派发指引 > 客观查证 > 阶段卡片

## 你的任务

修订 `agate-workspace/tasks/TPV0101-sqlmodel-datetime-compat/P1-requirements.md`，闭合 requirements-review 的 **4 条阻塞（M1–M4）+ 2 条建议（M5/M6）**。

## 先读

1. **评审产出**：`agate-workspace/tasks/TPV0101-sqlmodel-datetime-compat/P1-review.md`（完整评审，含证据）
2. 现有：`agate-workspace/tasks/TPV0101-sqlmodel-datetime-compat/P1-requirements.md`
3. 原派发指引：`agate-workspace/tasks/TPV0101-sqlmodel-datetime-compat/P1-dispatch-context-analyst.md`（背景事实）

## 必须闭合的修改点

### M1（阻塞）— §2.1 判定依据 + §4.1 同类扫描补 aware 写入面

**主 Agent 已独立 grep 核实的 aware 写入点清单**（供你补扫，请自行复核并补全）：

```
entry_service.py:817, 828, 833, 857, 1058      (Entry.updated_at / expires_at / EntryTombstone.deleted_at)
share_service.py:89, 182, 277                   (EntryShare.expires_at / revoked_at)
share_service.py:60, 172, 209, 239, 269, 296    (aware 比较/读路径)
team_service.py:127, 157                        (Team.updated_at / TeamMember.joined_at)
star_service.py:144                             (EntryStar.created_at)
apikey_service.py:66                            (ApiKey.expires_at)
read_tracking_service.py:47, 60, 74, 114, 115, 261   (EntryRead.read_at / updated_at / EntryReadStats)
entry_service.py:1360                           (aware 比较)
auth.py:112                                     (JWT exp，非 DB 列，判定不处理)
admin_service.py:225 / 555 / 604                (日期字符串 / strftime，非列绑定，判定不处理)
```

**要求**：
- §2.1「判定依据」列**逐字段修正**：区分「写入值本身是 naive」「写入值是 aware `datetime.now(timezone.utc)` 但经 ORM 落库被去时区为 naive」「由 SQL 侧 `CURRENT_TIMESTAMP` 生成」。评审 §三 表格已列出所有写反的字段，照其修正。
- §4.1 增列 **aware 写入点清单**，逐条判「本次处理 / 不处理 + 理由」。判定要点：在「裸列 → 显式 `DateTime(timezone=False)` 列」修法下，**aware 值绑定同样经过 `process_bind_param`**（被去时区而非抛错，0.0.38/0.0.47 均如此）——是**独立测试覆盖点**，不能漏。
- 修正「面状缺陷不能只扫一半」——P0 已强调；把两条扫描（naive + aware）合并为一张完整命中表。

### M2（阻塞）— BDD-15 改为可二值判定

现 BDD-15 是「上游发布同类变更**时**存在拦截手段」——未来条件承诺，P6 无法构造实跑。**改为当前可执行断言**：
- Given 当前仓库状态 → When 运行依赖校验（读取 `pyproject.toml` 的 sqlmodel 版本上限，或运行 CI 依赖一致性检查脚本）→ Then 断言**存在**该防护且可执行
- 并加一条：人为注入一次漂移（如临时改版本上限/依赖）→ 该检查**变红**（实测，不推理）
- 「未来防护」意图保留为设计注记（非 BDD Then）

### M3（阻塞）— BDD-17 改为可判定

`domains: [backend]`，本任务不跑前端。将「前端展示不回归」：
- 降为 **API 序列化形态契约不变**（引用 BDD-7/8 的可观测断言）
- 显式声明「前端展示为间接依赖、测试范围外」
- MCP：补一条可观测断言（如 MCP 消费的 API 响应时间字段形态不变），或显式声明范围外 + 理由

### M4（阻塞）— BDD-1 / BDD-9 Given 纳入 aware 场景

- BDD-1：Given 增加「按 aware `datetime.now(timezone.utc)` 值写入 naive 列」路径
- BDD-9：把「`default_factory=now_utc`（aware）绑定 naive 列」推广到**全部 aware 赋值路径**（即 M1 清单里的字段）

### M5（建议）— BDD-16 扫描范围

标题/Then 的扫描范围从「新增/修改的时间列」改为「**全部表模型 datetime 列**」。**口径须准确**：用 ORM 枚举（`table=True` 表的字段），主 Agent 实测有 11 张 `table=True` 表；评审给出口径为 25 个 datetime 字段——**请你自行用准确方法复核字段总数**（不要直接抄 25，也不要抄 grep 的 56，后者含响应模型/非字段行）。

### M6（建议）— capability_requirements

`no-external-network` 的 `available: []` 语义混乱 → 改为 `verification_env` 声明，或注明 `/tmp/ci-repro-venv` 按 P0 重建步骤可得（属环境准备，非固定 available）。

## 约束

- **保留** 已正确的部分（根因、naive 存储结论、跨版本修法方向、§4.3/§4.4、frontmatter 大部分）
- 更新 frontmatter `status: draft` 保持；`trace_id` 可用 `TPV0101-P1-20261002`（不变）
- 正文加「修订历史」行注明 round 1
- 只读源码核验；shell 显式超时；勿碰生产 `:8080` / `~/.peekview/`

## 返回给我（重要）

只返回两行：
1. `P1-requirements.md` 路径 + BDD 条数 + 已闭合的修改点编号
2. 一句话摘要（≤40 字）

绝对不要返回文件全文。
