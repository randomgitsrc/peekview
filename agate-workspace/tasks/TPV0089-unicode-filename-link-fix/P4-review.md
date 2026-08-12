---
phase: P4
task_id: TPV0089-unicode-filename-link-fix
type: review
parent: P4-implementation.md
trace_id: TPV0089-P4-review-20260811
status: approved
created: 2026-08-11
agent: design-review
---

# P4 实现评审 — TPV0089 非 ASCII 文件名本地资源链接解析修复

## 结论

**status: approved**

实现与 P2 方案 A 伪代码契约**逐行一致**，`normalizeRef`/`buildPathMap` 零改动（红线保护），6 条 P3 红灯转绿、既有用例不回归（51/51 与 P4-implementation.md §3 自查记录一致），改动面仅 `path-map.ts` 单文件（+23/-4），无 [DESIGN_GAP]，无范围外改动。无可议 BLOCKER。

## 1. 实现 vs P2 方案 A 一致性（评审重点 1）

`frontend-v3/src/utils/path-map.ts` 的 `resolvePath`（L88-108）逐行对照 P2-design.md §2 伪代码（L50-69）：

| P2 伪代码步骤 | 实现位置 | 一致 |
|---|---|---|
| `normalized = normalizeRef(ref)`; 空则 null | L89-90 | ✓ |
| `hit = matchRef(normalized, pathMap)` raw 优先 | L92 | ✓ |
| `if (hit !== null) return hit` | L93 | ✓ |
| `try { decoded = decodeURIComponent(normalized) } catch { return null }` | L96-99 | ✓ |
| `if (decoded === normalized) return null` 无 `%` 短路 | L102 | ✓ |
| `reNormalized = normalizeRef(decoded)` 守卫重跑 | L104 | ✓ |
| `if (!reNormalized) return null` | L105 | ✓ |
| `return matchRef(reNormalized, pathMap)` | L107 | ✓ |

`matchRef`（L77-86）对照 P2 伪代码（L64-69）：`pathMap.has` 精确命中 → basename 提取（`!== normalized` 判空保留原逻辑）→ null，逐行一致。`decodeURIComponent` 仅一次调用（L97），`decoded` 未再进 decode（decode-once 语义成立）。

## 2. 红线保护（评审重点 2）

- `normalizeRef()`（L10-23）零改动 ✓
- `buildPathMap()`（L25-75）零改动 ✓
- `git diff frontend-v3/src/utils/path-map.ts` 仅新增 `matchRef` + 重写 `resolvePath`，未触碰构建侧 → BDD-7「key 与 DB 原始文件名一致性」保护成立（decode 未进 key 构建链）

## 3. BDD 覆盖（评审重点 3）

### P3 红灯 6 条转绿（代码路径核验，非仅信自查记录）

| 用例 | BDD | 实现路径 | 结果 |
|---|---|---|---|
| TC-UNI-01 | BDD-1 中文 path | raw miss → decode → `images/中文图片.png` → L107 命中 fileId 100 | ✓ |
| TC-UNI-02 | BDD-2 中文 basename | decode → `中文图片.png` → 命中 101 | ✓ |
| TC-UNI-03 | BDD-3 日文 | decode → `images/概要図.png` → 命中 102 | ✓ |
| TC-UNI-04 | BDD-4 重音 | decode → `images/café.png` → 命中 103 | ✓ |
| TC-UNI-05 | BDD-5 空格 | decode → `images/report final.png` → 命中 104 | ✓ |
| TC-UNI-08 | BDD-7 字面 `%` decode-once | `a%2520b.png` decode 一次 → `a%20b.png` → 命中 106，不再二次 decode | ✓ |

### 既有绿灯 45 条不回归（关键路径核验）

- **TC-UNI-06（BDD-6 孤立 `%` 命中）**：raw 优先在 L92 命中 `images/100%done.png` → L93 直接返回 105，decode 未触发（L95-100 不可达）✓
- **TC-UNI-07（BDD-6 孤立 `%` 兜底）**：raw miss → L97 `decodeURIComponent` 抛 URIError → L99 返回 null，不崩 ✓
- **TC-UNI-09（BDD-8 字面 `%` raw 命中）**：L92 命中 `a%20b.png` → 106 ✓
- **TC-UNI-10（BDD-9 英文）**：L92 命中 → 3 ✓
- **TC-UNI-11/12/13（守卫重跑）**：`%23intro`→`#intro`、`https%3A%2F%2F…`→`https://…`、`data%3A…`→`data:…` 经 L104 守卫正则 → null ✓（编码形式外部引用未被放行）
- **既有 TC-RP-01~10 / TC-NR-01~18 / TC-BPM-01~10**：路径均落入 raw 优先分支（ASCII 恒等），行为与修复前一致 ✓

测试总数核验：TC-BPM 10 + TC-NR 18 + TC-RP 10 + TC-UNI 13 = **51**，与 P4-implementation.md §3 一致。

## 4. fileId=0 真值陷阱（评审重点 4）

- L93 `if (raw !== null) return raw` 显式 null 判断 ✓（P2 评审 R1 教训落实）
- `matchRef` 内部用 `pathMap.has()`（L78/L81）+ 非空断言 `.get()!.fileId` 取值返回，fileId=0 时 `0 !== null` 成立 → 正常返回 0 ✓
- 消费侧 `useMarkdown.ts` 4 处调用点（L117/L126/L299/L317）均用 `if (fileId !== null)` 判空，0 不会被吞 ✓

## 5. 范围控制（评审重点 5）

`git status`：仅 `frontend-v3/src/utils/path-map.ts` 为代码改动（numstat +23/-4，与 P4-implementation.md §1「+23 / -4」精确一致）；`path-map.test.ts` 未改动（P3 提交 f4fd6cb0 已含，本轮工作区无此文件 diff）；`useMarkdown.ts` 4 调用点未改。无范围外文件。

## 6. DESIGN_GAP（评审重点 6）

P4-implementation.md §5「自主决策声明」明确「无。实现严格按 P2 方案 A 伪代码契约，无歧义点需要自主取舍」，未声明 [DESIGN_GAP]。经核验实现确与 P2 伪代码完全一致，无设计缺口浮现 → 无需 DESIGN_GAP，合规。

## 7. 非阻断观察（建议，不要求修复）

1. **decode 后空格 vs 字面 `%` 歧义仍存**（P2 §1 风险表已文档化）：源码写 `images/a b.png`（未编码空格）遇 key 为 `a%20b.png` 时，decode 恒等 → L102 短路 null，无法命中。属 P2 已记录的 markdown-it 既有歧义，非本次引入，raw 优先语义已给最精确解读。
2. **`decoded` 含 `%2F` 路径分隔符边界**：若文件名合法含编码 `/`（`%2F`），decode 后 basename 切分语义变化。BDD 未覆盖、P2 未承诺，且 raw 优先使已工作场景不受影响——不构成回归，记录备查即可。
3. P4-implementation.md §2 契约表「decode 后守卫重跑」行引用 TC-UNI-11/12/13，与 P3-test-cases.md §1 表格一致，无文档漂移。

## 8. 环境隔离

评审为纯读操作，未启动服务、未触碰 :8080 与 ~/.peekview/。

[PROD_NOT_TOUCHED]

## 9. 评审依据锚点

- 代码：`frontend-v3/src/utils/path-map.ts` L77-108（matchRef + resolvePath），L10-75（normalizeRef/buildPathMap 未动）
- 契约：P2-design.md §2 伪代码 L48-70
- 测试契约：P3-test-cases.md §1（TC-UNI-01~13）
- BDD：P1-requirements.md §3（BDD-1~9 单元层）
- 范围核验：`git status` + `git diff --numstat`（+23/-4）
