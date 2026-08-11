---
phase: P2
task_id: TPV0089-unicode-filename-link-fix
type: design
parent: P1-requirements.md
trace_id: TPV0089-P2-20260811
status: draft
created: 2026-08-11
agent: architect
# ── v2.0 机器字段 ──
candidate_count: 2
packages: [peekview]
domains: [frontend]
ui_affected: true
---

# P2 方案设计 — TPV0089 非 ASCII 文件名本地资源链接解析修复

## 1. 影响域分析

### 改什么

- `frontend-v3/src/utils/path-map.ts`：`resolvePath()` 增加 **raw 优先匹配 + decode-once 兜底**逻辑；抽一个私有 `matchRef()` 复用 exact/basename 两段查找。`normalizeRef()`、`buildPathMap()` 不动。
- `frontend-v3/src/utils/path-map.test.ts`：新增 BDD-1~9 单元用例（P3 做）。
- `scripts/seed-data/unicode-filenames/`：新增含非 ASCII 文件名图片的 fixture 子目录（P3/P6 做，P1 隐含需求 [SUGGEST]）。

### 不改什么

- `normalizeRef()`：**零改动**。它同时被 `buildPathMap()` 复用（构建 key），decode 若落在这里会连 key 一起 decode，改写字面 `%` key 语义（BDD-7 红线）。
- `buildPathMap()`：**零改动**。key 保持 DB 原始文件名（未编码 Unicode），与 P1「key 与 DB 原始文件名一致性」约束一致。
- `useMarkdown.ts` 4 处调用点：签名不变，单点修复自动覆盖（image rule L299 / link_open rule L317 / rewriteHtmlRefs L117/L126）。
- 后端 / API / MCP：零改动（P0 已确认根因在前端渲染层）。

### 风险在哪

| 风险 | 应对 |
|------|------|
| decode 后改写 key 语义（字面 `%` 文件名） | decode 仅限 `resolvePath` 兜底分支，绝不进 `normalizeRef`/`buildPathMap`（BDD-7 双保险） |
| `decodeURIComponent` 对孤立 `%` 抛异常 | try/catch，异常时返回 null（BDD-6）；raw 优先命中时根本不触发 decode |
| 外部引用过滤语义退化（编码形式 `%23anchor`/`https%3A%2F%2F` 被放行） | decode 后**重新执行 `normalizeRef`**（守卫正则再跑一遍），外部/锚点返回 null（P1 隐含需求） |
| raw HTML 未编码引用被破坏 | raw 优先匹配先命中；decode 对无 `%` 字符串是恒等变换，不改变结果 |
| 字面 `%` 文件名 vs 空格文件名歧义（源码 `a%20b.png`） | raw 优先命中字面 `%` 文件——markdown-it 保留合法转义，这是最精确解读；空格文件需在源码写 `a b.png` 由 markdown-it 编码匹配（已实测） |

## 2. 候选方案

### 候选方案 A：消费侧 decode（`resolvePath` 内 raw 优先 + decode-once 兜底）

```ts
// 伪代码
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

matchRef(normalized, pathMap) -> number | null:      // 抽出的公共查找（exact → basename），返回 fileId 或 null
  if (pathMap.has(normalized)) return pathMap.get(normalized).fileId
  basename = normalized.split('/').pop()
  if (basename && basename !== normalized && pathMap.has(basename))
    return pathMap.get(basename).fileId
  return null
```

**优点**：
- 改动最局部，只动 `resolvePath` 一个函数；`normalizeRef`/`buildPathMap` 零改动 → key 语义天然不被改写（BDD-7）
- raw 优先保证所有已工作用例零回归（ASCII 恒等、字面 `%`、raw HTML 未编码引用）
- decode 恰好一次且被 try/catch 包裹，畸形 `%` 安全（BDD-6）
- decode 结果重新过守卫正则 → 编码形式的外部引用/锚点仍被拦（P1 隐含需求）
- 无需依赖任何新库

**缺点/风险**：
- `resolvePath` 多一次 decode 尝试（仅在 raw miss 时），性能影响可忽略（O(1) 查找 + 一次 decodeURIComponent）
- 字面 `%` 文件名与空格文件名在源码写 `a%20b.png` 时存在歧义（见 §1 风险表最后一行）——这是 markdown-it 行为决定的既有歧义，非本修复引入，raw 优先给出最精确解读

### 候选方案 B：构建侧 encode（`buildPathMap` 存 encode 后 key）

```ts
// 伪代码
buildPathMap(files):
  for file in files:
    key = mdurlEncode(normalizeRef(file.path))   // key 变成 %E4%B8%AD... 形式
    ...
resolvePath(ref, pathMap):
  return matchRef(ref, pathMap)                  // 直接匹配已编码 key
```

**优点**：
- 理论上 resolvePath 不用 decode，消费侧更"干净"

**缺点/风险**（致命）：
- **必然破坏 raw HTML 路径**：`rewriteHtmlRefs`（L117/L126）接收的是 DOMPurify 后的**未编码** src/href（如 `images/中文图片.png`），而 key 已变成 `images/%E4%B8%AD...` → 永远 miss。P1 明确要求「raw HTML 引用 decode 恒等，不得破坏」→ **方案 B 直接违反 BDD**
- 需精确复刻 markdown-it 的 mdurl.encode（keepEscaped 语义、defaultChars、代理对处理），一旦 mdurl 版本行为变化即静默失配——把自己绑死在第三方库内部实现上
- key 不再是 DB 原始文件名，违反 P1「key 与 DB 原始文件名一致性」约束；其他潜在消费者（如未来调试、日志）会看到编码 key
- 若想同时兼容 raw HTML，还得在 resolvePath 里再引入 decode——退化成方案 A + 更复杂，属于稻草人增负

### 选型结论

**选择方案 A**。理由：
1. 方案 B 有硬性缺陷——构建侧 encode 后 raw HTML 未编码引用（P1 明确要求保持工作的用例）必然 miss，除非叠加 decode 逻辑，那等于 A 的超集还更复杂。
2. 方案 A 满足全部 13 条 BDD 与 P1 边界约束（key 语义、畸形转义、守卫语义、ASCII 不回归），且改动面最小（单函数）。
3. `follows_existing_pattern: [path-map.ts]` 成立（修现有逻辑，非新功能），但 P0 要求对比选型，故保留 2 候选并给出排除理由。

## 3. BDD 覆盖映射（方案 A 逐条）

| BDD | 场景 | 方案 A 行为 |
|-----|------|-------------|
| BDD-1 中文 path | key `images/中文图片.png`，入参 `images/%E4%B8%AD...png` | raw miss → decode → `images/中文图片.png` → 命中 ✓ |
| BDD-2 中文 basename | key `中文图片.png`，入参 `%E4%B8%AD...png` | raw miss → decode → basename 命中 ✓ |
| BDD-3 日文 | key `images/概要図.png` | decode 还原 → 命中 ✓ |
| BDD-4 重音 | `images/caf%C3%A9.png` → `images/café.png` | decode 还原 → 命中 ✓ |
| BDD-5 空格 | `images/report%20final.png` → `images/report final.png` | decode 还原 → 命中 ✓ |
| BDD-6 畸形 `%` | `images/100%done.png`（key 存在） | raw 优先命中，decode 未触发 ✓；key 不存在时 decode 抛 URIError → catch → null ✓ |
| BDD-7 字面 `%` decode 恰好一次 | key `a%20b.png`，入参 `a%2520b.png` | raw miss → decode **一次** → `a%20b.png` 命中 ✓（decode 结果不再进第二次 decode；`buildPathMap` 未参与 decode） |
| BDD-8 字面 `%` raw 直接命中 | key `a%20b.png`，入参 `a%20b.png`（markdown-it 原样保留合法转义） | raw 优先命中，不经 decode ✓ |
| BDD-9 英文不回归 | `images/arch.png` → fileId 3 | raw 优先命中，行为与修复前一致 ✓ |
| BDD-10/11/12/13 E2E | 图片渲染 + 链接点击 | src/href 被改写为 `/api/v1/entries/{slug}/files/{id}/content` 与 `/{slug}?file={id}`，P6 实跑 ✓ |

## 4. gate_commands

```yaml
gate_commands:
  P3: "cd frontend-v3 && npx vitest run src/utils/path-map.test.ts"
  P5: "make test-frontend"
  P5_typecheck: "make typecheck"
  P5_e2e: "make debug-test"
  project_module: "frontend-v3/src/"
```

说明：
- P3 为纯单元层（BDD-1~9 全落在 `path-map.test.ts`），单文件 vitest 无对应 Makefile target，故保留手写命令；P5 改用 `make test-frontend`（Makefile:173，非 watch 模式，AGENTS.md「gate_commands 引用 Makefile target」约定），无需 P3_e2e（P1 裁剪说明：新增测试主要落在单测层）。
- P5_e2e 声明 `make debug-test`（ui_affected: true，必填）。注意该 E2E 覆盖 BDD-10~13 需先存在 `scripts/seed-data/unicode-filenames/` fixture——fixture 在 P3 阶段一并提交（P1 隐含需求），P5 运行时 debug backend 会自动 seed。
- P5_typecheck 补 `make typecheck`（CI 强制 `vue-tsc --noEmit`，P1 §5 保留项）。

## 5. files_to_read（P4 implementer 上下文地图）

```yaml
files_to_read:
  - path: frontend-v3/src/utils/path-map.ts
    why: 唯一改动文件。理解 normalizeRef/buildPathMap/resolvePath 现状，在 resolvePath 内实现 raw 优先 + decode 兜底
  - path: frontend-v3/src/utils/path-map.test.ts
    why: 现有 TC-RP/TC-NR/TC-BPM 用例基线，P4 需保证这些用例不回归（P3 已新增 BDD-1~9）
  - path: frontend-v3/src/composables/useMarkdown.ts:111-134,293-327
    why: 4 处 resolvePath 调用点（rewriteHtmlRefs L117/L126 + image/link renderer L299/L317），确认签名不变即可，无需改动
  - path: scripts/seed-data/unicode-filenames/
    why: P3/P6 新增 fixture（meta.json + 中文/日文/重音/空格文件名图片 + 引用它们的 markdown），P4 不涉但需知道其作为 P5_e2e 素材
```

## 6. env_constraints

```yaml
env_constraints:
  debug_env: "make debug-quick（:8888，/tmp/peekview-debug/ 隔离）；fixture 由 scripts/seed-data/ 加载"
  isolation_check: "P5_e2e 走 make debug-test（debug backend 隔离数据），严禁指向 :8080 生产；fixture 只经 make debug-seed 写入 /tmp/peekview-debug/"
  lint: "cd frontend-v3 && npx vue-tsc --noEmit（CI 强制）"
  prod_isolation: "严禁触碰 :8080 生产服务与 ~/.peekview/（P0-brief 继承）"
```

## 7. minimal_validation

```yaml
minimal_validation:
  assumption: "markdown-it mdurl.encode 的输出可被 decodeURIComponent 单次解码还原，对中文/日文/重音/空格均成立"
  method: "Node 脚本（/tmp/mv-tpv0089.mjs + mv2 + mv3）调用真实 mdurl v2.0.0 与 markdown-it v14.1.0 实证"
  result: "confirmed（含一处关键前提勘误，见 note）"
  note: |
    - 中文 `images/中文图片.png`→`%E4%B8%AD%E6%96%87%E5%9B%BE%E7%89%87.png`、日文 `概要図`→`%E6%A6%82%E8%A6%81%E5%9B%B3`、重音 `café`→`caf%C3%A9`、空格 `report final`→`report%20final`、韩文 `이미지`→`%EC%9D%B4%EB%AF%B8%EC%A7%80`：decodeURIComponent 单次全部还原 ✓
    - 【前提勘误】mdurl.encode 默认 keepEscaped=true，**不会**把 `a%20b.png` 编成 `a%2520b.png`（合法转义保留），markdown-it 输出为 `a%20b.png` 原样；真正编码空格的是 `a b.png → a%20b.png`。BDD-7 的 When（入参 `a%2520b.png`）在单测中仍成立（验证 decode 恰好一次语义），但与真实 markdown-it 输出不符——P3 保留测试、理由文本按实际行为修正，并**额外补一条**「字面 `%` 文件名 `a%20b.png` raw 直接命中」用例
    - 畸形转义 `100%done` → decodeURIComponent 抛 URIError（已实测）→ 方案 A 的 try/catch 必要性实证
    - 外部引用编码形式 `%23anchor`/`https%3A%2F%2Fcdn`/`data%3A...`/`mailto%3A...` → decode 后全部命中守卫正则（已实测 guard=true）→ 方案 A 的「decode 后重跑 normalizeRef」守卫语义正确性实证
    - BDD-5 空格注意：markdown 内联语法里空格需尖括号包裹 `![x](<images/report final.png>)`（实测确认），fixture markdown 必须按此写
```

## 8. UI 测试稳定标识（P3/P6 E2E 选择器）

- 图片：断言 `img` 的 `src` 以 `/api/v1/entries/{slug}/files/{id}/content` 结尾（改写成功标志），而非原始相对路径
- 链接：断言 `a[data-peekview-file-id]` 存在且 `href` 为 `/{slug}?file={id}`（`data-peekview-file-id` 是既有稳定属性，不依赖 class 命名）
- 无需新增 data-testid；以上为行为级稳定标识，重构 class 不影响

## 9. 实现完成标志

- `resolvePath` 含 raw 优先 + try/catch decode-once 兜底 + decode 后重跑 normalizeRef 守卫；`normalizeRef`/`buildPathMap` 无改动
- `path-map.test.ts` 全绿：既有 TC-RP/TC-NR/TC-BPM 全部不回归 + BDD-1~9 新增用例（含字面 `%` raw 命中补测）
- `npx vue-tsc --noEmit` 通过；`npx vitest run`（全前端单测）通过
- seed-data fixture（unicode-filenames/）存在，P6 E2E 实跑 BDD-10~13 时图片渲染、链接可点、英文页不回归

## 10. [SCOPE+] 发现（供主 Agent 增补 P1 基线）

[SCOPE+] 发现：BDD-7 的 When 前提「markdown-it 将字面 `%` 编为 `%25`」与真实行为不符（mdurl keepEscaped=true 保留合法转义），且缺失「字面 `%` 文件名 raw 直接命中」的回归保护用例。
必须做的理由：若不修正理由文本，P3 测试设计会按错误前提理解，且「字面 `%` 文件 + 源码含 `%20` 序列」的既有可用场景（raw 命中）缺少显式 BDD 保护。
影响：建议增补 BDD-7'（字面 `%` 文件名 raw 命中：Given key `a%20b.png`、When 传入 `a%20b.png`、Then 返回对应 fileId）；packages: [peekview]。
