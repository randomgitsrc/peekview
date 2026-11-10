# P7 一致性审查 — progress

## 步骤 1：解析协议根 + 读角色定义 + dispatch-context
- `agate-resolve.py` → `AGATE_ROOT=/home/kity/.agate/v0.83.2/agate`（v0.83.2，全局 current）
- 角色定义实际路径：`{agate_root}/assets/execution-roles/consistency-reviewer.md`
  （派发单写的是 `assets/review-roles/consistency-reviewer.md`，该目录下**无**此文件——见 findings F5）
- 已读 dispatch-context 全文 + AGATE_CARD（P7 阶段卡片）

## 步骤 2：DESIGN_GAP 实际条数核实（关键纠偏）
- 派发单称 18 条；**实测 13 条**。
- `grep -c "\[DESIGN_GAP"` = 18 是**宽松匹配**，含 4 处二级节标题
  `### 实现中自主决策（[DESIGN_GAP] 候选…）`（行 119/178/223/297）+ 1 处表格单元引用（行 326）。
- gate 权威口径 `agate_common.count_design_gap(..., allow_blockquote=False)` = **13**，与
  `grep -cE '^\s*-?\s*\[DESIGN_GAP:'` = 13 一致。
- 行号分布：121/122/123/124（frontend-shared 4）、180/182/184（mount-explore 3）、
  225/227/229（mount-detail 3）、299/301（docs 2）、330（rev1-fix 1） = **13**。
- 结论：`design_gap_count` 必须写 13（= P4 实际），写 18 会让 gate 的
  `p4_prose > len(rev_gaps)` 反向失配（18 > 13 通过但 id 集合校验会挂）。

## 步骤 3：P7 走的是 structured（成对声明）gate 路径
- `agate_common.task_level(task_dir)` = **2**（非 None）→ `gate_p7` 直接走 `_gate_p7_structured`。
- 该路径**不读** `design_gap_count`/`design_gap_reviewed_count` frontmatter 汇总值，
  而是跨声明文件聚合 `design_gaps`(id 集合) / `design_gap_reviews`(gap 集合)，要求**集合相等**。
- 同时硬校验：`scope_plus` id ⊆ `scope_resolved` id；`code_map` 文件集合 == `code_map_reviewed`；
  `need_confirm` 无 open；`findings` 标 resolved 须带 resolution+evidence。
- verdict 取值域：**accepted | rejected | followup**（派发单写的 `needs-fix` **不在枚举内**！）
- basis 取值域：**in_bdd | out_of_scope | followup:DEBT<n>**（派发单写的
  `implementation_detail` / `not_in_scope` **不在枚举内**！）
- 当前 P1~P6 **无任何** design_gaps/scope_plus 声明；两处 [SCOPE+] 只存在于 P4 正文散文里。

## 步骤 4：P7-consistency.md 产出 + gate 实跑
- 13 条 DESIGN_GAP 逐条转抄 + `[DESIGN_GAP_REVIEWED]` 配对（行首标记计数 13 == 13）
- frontmatter 计数：design_gap_count=13 / design_gap_reviewed_count=13 / blocker_count=0 /
  deviation_count=2 / deviation_critical_count=0
- 正文 `[BLOCKER]` 行首 = 0、`[DEVIATION-CRITICAL]` 行首 = 0
- 跨文件引用关键词命中 20 行（P1§BDD / P2§packages / P4§implementation 等）
- **check-gate.py P7 → exit 0**（`GATE P7: 成对声明聚合判据通过`）
- check-frontmatter.py P7-consistency.md / P1-requirements.md → 均 exit 0

## 步骤 5：SCOPE+ 闭环（唯一允许的写操作）
- P1-requirements.md `append scope_resolved` ×2（SP1 / SP2），工具原子写
- `git diff` 核对：仅 +9 行（scope_resolved 两元素），P1 其余内容零改动
- P1 gate 复跑 → exit 2（通过），scope_resolved 未破坏 P1 判据

## 步骤 6：收尾核验
- `git status --porcelain`：M P1-requirements.md（仅 scope_resolved）/ ?? P7-consistency.md
  / ?? P7-progress.md / ?? P7-dispatch-context（主 Agent 所写）/ .agate-tmp 已被 .gitignore 忽略
- 未触碰 :8080、未读写 ~/.peekview/ → [PROD_NOT_TOUCHED]
