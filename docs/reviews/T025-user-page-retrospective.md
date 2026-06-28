# T025 user-page — 过程复盘

> 日期：2026-06-28
> 复盘人：主 Agent
> 触发：用户在 T025 执行过程中两次因 Agent 无响应而手动中止

---

## 1. 任务概况

| 维度 | 内容 |
|------|------|
| 功能 | `/users/:username` 用户公开页 |
| 阶段 | P0→P1→P2(R1→R2)→P3→P4→P5→P6(R1→R2)→P7→READY |
| 产出 | 18 BDD 条件，entry_service 三阶段管线，EntryListView 三态逻辑，BannerBar/FilterChip 组件 |
| 改动量 | 13 files, +817 / -30 |
| 验证 | BE 586/586 + FE 429/429, BDD 18/18 PASS |
| 耗时 | 11 次 subagent 派发 + 2 次手动中止 |

## 2. 打断事件

| # | 阶段 | 症状 | 实际卡在哪 | 根因 |
|---|------|------|----------|------|
| 1 | P6→P7 | 长时间无响应 | `make debug-stop` 命令 hang | 工具层阻塞，非思考层 |
| 2 | P7 gate | 同上 | `grep BLOCKER` 命令 hang | 同上 |

用户感知「长时间没动静」的核心原因**不是命令 hang**，而是**命令发出之前已有很长的无声思考**。命令 hang 只是最后一根稻草。

## 3. 根因分析

### 3.1 思考膨胀（核心）

每个阶段的内部循环：

```
收到 subagent 返回
  → 读产出文件全文（协议只要求 Header + 判定字段）
  → 逐节分析内容质量
  → 逐条对照 gate 规则（6 个阶段 × 4-6 条件 = 30+ 次判定）
  → 扫描所有协议标记 ([SCOPE+]/[NEED_CONFIRM]/[PROD_TOUCHED]/[CAPABILITY_GAP]/[UPGRADE])
  → 推演状态转移路径
  → 更新 .state.yaml + active-tasks.md
  → 构造 80 行 dispatch prompt（9 个必填段）
  → 终于发出 tool call
```

每个阶段的 invisible latency 达数分钟。用户只能看到屏幕不动。

### 3.2 具体膨胀点

| 时机 | 做了什么 | 可优化 |
|------|---------|--------|
| P1 gate | 读 353 行 P1-requirements.md 全文 | ❌ 只需要 Header + BDD 计数 + grep 标记 |
| P3 红灯 | 分析 `AttributeError` 是"真红灯"还是"collection error" | ❌ `9 failed, 0 errors` 一句话就够了 |
| P2 评审 | 两轮 × 3 次 subagent(2评审+1组长) = 6 次派发 | ⚠️ 对低风险方案可跳过评审 |
| dispatch prompt | 每次 80 行，大多数段落不变 | ❌ 常量段可提取为系统级模板 |
| P5 E2E | verifier写→主Agent跑→16失败→诊断 | ⚠️ verifier 自己跑可省往返 |
| 每阶段结尾 | commit + 读 full diff + check 隔离 + cleanup 全做 | ⚠️ 部分可"懒验证" |

### 3.3 上下文累积

7 个阶段跑完后，上下文里残留：
- 3000 行协议文件
- 500 行项目约定
- 8 个阶段产出文件的全文阅读痕迹
- 11 次 subagent 返回摘要
- .state.yaml 每次变更记录

虽符合"只传路径不传内容"，但"读过"的痕迹仍然膨胀上下文。

## 4. agate 协议层面的问题

### 4.1 dispatch prompt 模板冗余

模板 9 个段，其中 6 个段对任意阶段几乎不变（环境隔离、分阶段落盘、输出格式、返回格式）。每次 80 行 prompt × 11 次派发 = 880 行重复组织成本。

**建议**：固定段提取为系统级 `dispatch-base.md`，每阶段只写「任务 + 导航」两段。

### 4.2 评审机制串行成本高

P2 两轮评审：`并行派发2个 → 组长汇总 → rejected → 回流 → 再并行派发 → 再组长` = 6 次 subagent 调用。

收益实在（发现 BLK-1/BLK-2），但「domains 机械映射评审」对低风险方案（如本任务的后端只是 SQL 查询加字段）产生过度评审开销。

**建议**：允许主 Agent 在 P0 声明跳过某些评审角色（如 `skip_reviews: [plan-eng-review]`），不机械映射。

### 4.3 写跑分离增加往返

P5 E2E：verifier 写脚本 → 主 Agent 跑 → 16 失败 → 诊断。如果 verifier 自己跑，一轮就够了。

**建议**：允许 verifier 在独立上下文里自己跑 Playwright（它已有完整环境），只把最终结果返回给主 Agent。

## 5. 改进清单

### 主 Agent 行为

| # | 当前 | 改为 |
|---|------|------|
| A1 | gate 前全量读文件 | 只读 Header + `grep` 标记 + BDD 计数 |
| A2 | 简单命令前推演 gate 规则 | 直接跑命令，exit code 判定 |
| A3 | 每次重写完整 dispatch prompt | 固化常量段，只写「任务+导航」|
| A4 | 保留所有阶段文件阅读痕迹 | 每阶段结束主动"忘掉"全文，只记摘要 |

### agate 协议

| # | 当前 | 建议 |
|---|------|------|
| B1 | dispatch prompt 9 段必填 | 提取固定段为 `dispatch-base.md` 引用 |
| B2 | 评审角色机械映射 | P0 允许声明 `skip_reviews` |
| B3 | 写跑分离（verifier 写 → 主 Agent 跑）| verifier 自己跑可选的 E2E，主 Agent 只验结果 |
| B4 | 每阶段覆盖全量回归测试 | 懒验证：只跑改动相关测试，全量回归间隔跑 |

## 6. 经验教训

**对 T025 工程质量**：agate 的 gate 链条虽然增加了思考开销，但实际上发现了：
- P2 BLK-1：FTS early return 丢失 owner_found（评审发现，避免了线上 bug）
- P6 FE-1/2/7：EntryListView onMounted 不调用 loadEntries（验收发现，避免了空白页面）

这些 gate 有实际价值，关键在于**降低 gate 判定的认知开销**，不是放弃 gate。

**对 Agent 自身**：「协议正确性焦虑」驱动的过度验证 ≠ 更好的质量。exit code = 0 → 过，不要二次分析。
