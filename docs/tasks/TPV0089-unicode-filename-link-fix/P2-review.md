---
phase: P2
task_id: TPV0089-unicode-filename-link-fix
type: review
parent: P2-design.md
trace_id: TPV0089-P2-review-rev3-20260811
status: approved
created: 2026-08-11
agent: plan-design-review
---

# P2 设计评审（修订后复核 2）— TPV0089 非 ASCII 文件名本地资源链接解析修复

## 总体结论

**Status: approved**

上轮唯一剩余项 **R1 已正确落地**：伪代码补回 `hit = matchRef(normalized, pathMap)` 赋值行，`hit` 先赋值后使用，不再悬空；raw 优先分支完整恢复。resolvePath 四步流程（raw 优先 → decode-once try/catch → 守卫重跑 → matchRef）完整自洽。未引入其他改动，R2/R3/frontmatter/选型方案 A 均保持。

## 修订核对清单（逐项）

| # | 修订项 | 状态 | 依据锚点 |
|---|--------|------|----------|
| R1 | 伪代码补回 `hit = matchRef(...)` 赋值行，两行完整形态，`hit` 不再悬空 | ✅ 已落地 | P2-design.md:52-53 |
| 2 | resolvePath 四步流程完整：raw 优先 → decode-once(try/catch) → 守卫重跑(normalizeRef(decoded)) → matchRef | ✅ 完整 | P2-design.md:52-53, 54-57, 59-60, 61 |
| 3 | 未引入其他改动：R2(13 条) / R3(make test-frontend) / frontmatter / 方案 A 均保持 | ✅ 保持 | P2-design.md:107, 123, 130, 11-14, 106 |

### R1 核对（已落地）

修订后伪代码（P2-design.md:49-61）：

```
resolvePath(ref, pathMap):
  normalized = normalizeRef(ref)            // 守卫+trim+./剥离（现状，不改）
  if (!normalized) return null
  hit = matchRef(normalized, pathMap)   // raw 优先：ASCII恒等/字面%/raw HTML
  if (hit !== null) return hit          // 显式 null 判断防 fileId=0 误判
  try:
    decoded = decodeURIComponent(normalized) // decode 恰好一次
  catch:
    return null                             // BDD-6 畸形转义兜底
  if (decoded === normalized) return null   // 无 % 可解，raw 已 miss，直接 null
  reNormalized = normalizeRef(decoded)      // 守卫再跑一遍：外部/锚点/协议前缀仍返回 null
  if (!reNormalized) return null
  return matchRef(reNormalized, pathMap)    // 解码后 exact/basename 查找
```

- P2-design.md:52 补回 `hit = matchRef(normalized, pathMap)`——`hit` 先赋值后使用，悬空引用消除。
- P2-design.md:53 保留 `if (hit !== null) return hit`——显式 null 判断。`matchRef` 声明返回 `number | null`（:63），`fileId=0` 时 `0 !== null` 为真正常返回，误判防御成立。
- 两行形态与上轮 R1 要求逐字一致（raw 优先注释、防 fileId=0 注释均在）。
- `matchRef` 定义完整（:63-69）：exact → basename 两段查找，末行 `return null` 兜底，与 `hit !== null` 判断类型匹配。
- 上轮严重性分析（`hit` 未声明 → ReferenceError / `undefined !== null` 恒真 → BDD-1~9 全挂）的前提已消除。

### 四步流程核对（完整）

1. **raw 优先**：:52-53 —— ASCII 恒等 / 字面 `%` / raw HTML 未编码引用先走 `matchRef(normalized, pathMap)`，命中即返回，不触发 decode。与 BDD-8/9、raw HTML 不破坏要求一致。
2. **decode-once（try/catch）**：:54-57 —— 仅在 raw miss 后执行 `decodeURIComponent` 恰好一次；`catch` 返回 null 兜底（BDD-6 畸形 `%` 防御）。:58 的 `decoded === normalized` 早退分支保证无 `%` 字符串不空跑二次匹配。
3. **守卫重跑**：:59-60 —— decode 结果重新过 `normalizeRef`，编码形式的外部引用/锚点（`%23anchor`/`https%3A%2F%2F`/`data%3A`）仍被守卫正则拦回 null（P1 隐含需求，minimal_validation 已实测 guard=true）。
4. **matchRef**：:61 —— 解码后 exact/basename 查找，与 :63-69 定义闭合。

### 未引入其他改动核对

- **R2（13 条 BDD）**：:107「满足全部 13 条 BDD 与 P1 边界约束」；:124 末行标签「BDD-10/11/12/13 E2E」；§3 映射表（:115-124）逐条覆盖 BDD-1~13，计数与标签自洽。
- **R3（P5 → make test-frontend）**：:132 `P5: "make test-frontend"`，:138 说明保留（Makefile:173，非 watch 模式），符合 AGENTS.md「gate_commands 引用 Makefile target」约定。
- **frontmatter**：candidate_count: 2 / packages: [peekview] / domains: [frontend] / ui_affected: true 完整（:11-14）。
- **选型方案 A**：:106「选择方案 A」不变，方案 B 排除理由完整保留（:98-102）。

## 各维度评分

| 维度 | 分 | 说明 |
|------|----|----|
| 交互状态覆盖率 | 9/10 | BDD-6/7/8 覆盖完整，风险表逐条对应，伪代码分支与 BDD 一一映射（维持） |
| AI Slop 风险 | 9/10 | R1 落地后伪代码四步流程精确无歧义，P4 implementer 可逐行照抄；较上轮 6 分回升（raw 分支落点恢复） |
| 移动端考虑 | N/A | 纯 href/src 改写，不在范围内（上轮已确认） |
| 可访问性 | N/A | 链接/图片语义不变（上轮已确认） |
| 组件完整性 | 9/10 | 4 调用点、normalizeRef/buildPathMap 零改动定位核实一致（维持） |
| 可验证性 | 10/10 | minimal_validation 实证扎实，本轮未受影响（维持） |

## 复核依据

- 上轮评审意见：P2-review.md（rev2，needs-revision）唯一剩余项 R1——「补回 raw 优先分支的 matchRef 调用，伪代码改为两行」，本次逐行对照 P2-design.md:52-53 确认逐字落地。
- 修订前后差异仅限伪代码区（:52-53 两行），无其他区域被改动；R2/R3/frontmatter/方案 A 均在位。

## 结论

- 无 CRITICAL/BLOCKER 级问题，无新增缺陷，无剩余修订项。
- P2-design.md 可放行进入 P3。

---
[PROD_NOT_TOUCHED] 纯文档评审，未启动服务，未触碰生产/调试数据。
