---
phase: P1
task_id: TPV0089-unicode-filename-link-fix
type: problems
parent: P0-brief.md
trace_id: TPV0089-P1-20260811
status: draft
created: 2026-08-11
agent: analyst
# ── v2.0 机器字段 ──
P1_simplified: true
risk_level: medium
phases: [P1, P2, P3, P4, P5, P6, P8]
packages: [peekview]
domains: [frontend]
follows_existing_pattern: [frontend-v3/src/utils/path-map.ts]
coupling_checklist: [path-map-key-semantics: checked, useMarkdown-call-sites: checked, markdown-it-encode: checked]
requires_minimal_validation: true
capability_requirements:
  - need: browser-e2e
    why: P6 验收需要浏览器实跑，验证图片实际渲染、链接实际可点击（BDD-10/11/12/13）
    available:
      - "playwright-cdp skill（CDP 连接 Windows Chrome :18800，已确认可用）"
      - "make debug-test（项目既有 Playwright E2E 框架）"
    status: available

  - need: browser-vision
    why: P6 截图后需确认图片真实渲染无裂图
    available:
      - "vision-engine skill（已确认可用）"
    status: available
# ── v2.0 SCOPE+ 解决状态 ──
scope_resolved:
  - "BDD-7 前提勘误 + 新增 BDD-8（字面 % 文件名 raw 直接命中）——SCOPE+ from P2 已回写 P1 基线，13 BDD"
---

# P1 需求基线 — TPV0089 非 ASCII 文件名本地资源链接解析修复

## 1. 需求复述（P1_simplified）

修复 markdown 正文中通过相对路径引用的本地资源（图片/附件），当文件名含非 ASCII 字符（中文/日文/韩文/带重音拉丁字符）时，链接点击与图片渲染失败（404/裂图）的问题。英文文件名行为不得回归。

## 2. 隐含需求识别（逐维度）

### 数据

- 无 schema / 存储迁移。后端按整数 `file_id` 路由文件内容，文件名原样落盘（UTF-8 无 sanitize），本任务只改前端渲染层，存量 entry 数据天然兼容。
- **seed-data 现无任何非 ASCII 文件名**（已 grep 证实 22 个 entry 目录，image-gallery 甚至无真实图片文件）→ 隐含：P3/P6 需要新增含非 ASCII 文件名的测试素材。[SUGGEST: 新增 `scripts/seed-data/` 下独立子目录 fixture（如 `unicode-filenames/`，含中文/日文/重音/空格文件名图片 + 引用它们的 markdown）而非仅运行时 curl 创建，理由：可复现、可进 CI、P6 每次实跑都能用同一素材]

### 前端

- 修复会改变"已发布且含非 ASCII 文件名资源"的 entry 的浏览器表现（裂图/死链 → 正常渲染），这是期望中的行为变化。
- `resolvePath` 在 `useMarkdown.ts` 有 4 处调用（image renderer rule L299、link_open rule L317、rewriteHtmlRefs L117/L126），单点修复自动覆盖全部调用链；raw HTML 引用（不经 markdown-it encode，当前已能匹配）在无 `%` 转义序列时 decode 为恒等变换，不得被破坏；含畸形 `%` 序列时 decode 抛异常，需走回退兜底（与 BDD-6 一致）。
- **外部引用过滤语义不变**：decode 后的引用若是外部 URL/锚点/协议前缀（含被 percent-encode 的形式，如 `%23anchor`、`https%3A%2F%2F...`），必须仍返回 null 不 rewrite——不能因 decode 把原本被拦的编码形式放行进 pathMap 查找链（尽管查找大概率 miss，但守卫语义不能退化）。

### 多端

- backend/API/MCP 无改动（根因在前端渲染层，已由 P0 确认）；MCP `fileNaming` 无关。无需跨端同步 → P7 一致性检查可裁。

### 边界

- **畸形转义防御**：`decodeURIComponent` 对孤立 `%`（如 `100%done`）抛异常，必须 try/catch 兜底；单条引用解析失败不得导致整个 markdown 渲染崩溃。
- **decode 回退**：decode 抛异常或解码后不匹配时，需回退到原始字符串匹配，保证已工作的用例（raw HTML 未编码引用、文件名含字面 `%` 的存量文件）不被破坏。
- **key 语义不被改写**：`normalizeRef` 同时被 `buildPathMap` 复用（构建 key）。若 decode 逻辑落在 `normalizeRef` 内，会连 key 一起 decode，可能改写含字面 `%`（如 `a%20b.png`）的 key 语义——修复方案的 decode 位置不得改变 pathMap key 与 DB 原始文件名的一致性（P2 选型时需显式排除此风险）。

### 兼容

- 英文/ASCII 文件名：percent-encode 为恒等变换，当前已工作，行为必须完全不变（单元 + E2E 双覆盖）。
- 相对路径（含子目录）与 basename 两种引用形态都要覆盖。

## 3. BDD 验收条件

### 非 ASCII 文件名解析（单元级，P3 TDD 红灯覆盖 `path-map.test.ts`）

#### BDD-1: 中文文件名 path 引用解析成功
- Given pathMap 含 key `images/中文图片.png`（未编码 Unicode）
- When resolvePath 传入 markdown-it 已 percent-encode 的引用 `images/%E4%B8%AD%E6%96%87%E5%9B%BE%E7%89%87.png`
- Then 返回对应 fileId（非 null，命中该文件）

#### BDD-2: 中文文件名 basename 引用解析成功
- Given pathMap 含 key `中文图片.png`
- When resolvePath 传入已编码的 basename `%E4%B8%AD%E6%96%87%E5%9B%BE%E7%89%87.png`
- Then 返回对应 fileId（非 null）

#### BDD-3: 日文文件名解析成功（证明修复非中文专属）
- Given pathMap 含 key `images/概要図.png`
- When resolvePath 传入 `images/%E6%A6%82%E8%A6%81%E5%9B%B3.png`
- Then 返回对应 fileId（非 null）

#### BDD-4: 带重音拉丁字符文件名解析成功
- Given pathMap 含 key `images/café.png`
- When resolvePath 传入 `images/caf%C3%A9.png`
- Then 返回对应 fileId（非 null）

#### BDD-5: 含空格文件名解析成功
- Given pathMap 含 key `images/report final.png`
- When resolvePath 传入 `images/report%20final.png`
- Then 返回对应 fileId（非 null）

#### BDD-6: 畸形转义序列防御（孤立 `%` 不崩溃）
- Given 传入含孤立 `%` 的引用 `images/100%done.png`，pathMap 含原始字符串 key `images/100%done.png`
- When 调用 resolvePath
- Then 不抛异常，且结果与"原始字符串直接匹配"一致（命中返回 fileId；不命中返回 null）

#### BDD-7: 字面 `%` 文件名 decode 链路正确（decode 恰好一次）
- Given pathMap 含 key `a%20b.png`（文件名含字面 `%`，非空格编码）
- When resolvePath 传入 `a%2520b.png`（模拟"已被双重编码"的引用；单测场景，验证 decode 恰好一次语义）
- Then 返回 `a%20b.png` 对应的 fileId（解码恰好一次还原，不得二次 decode 改写 key 语义）
- [SCOPE+ from P2] 前提勘误：真实 markdown-it（mdurl keepEscaped=true）对源码 `a%20b.png` **原样保留合法转义**，不编成 `a%2520b.png`；本条保留为单元测试验证「decode 恰好一次」语义，真实链路由 BDD-8 覆盖

#### BDD-8: 字面 `%` 文件名 raw 直接命中（[SCOPE+ from P2]）
- Given pathMap 含 key `a%20b.png`（文件名含字面 `%`）
- When resolvePath 传入 `a%20b.png`（真实 markdown-it 输出，原样保留合法转义）
- Then 直接命中返回 `a%20b.png` 对应的 fileId（raw 优先匹配，不经 decode）

#### BDD-9: 英文文件名不回归
- Given pathMap 含 key `images/arch.png` 且映射到 fileId=3
- When resolvePath 传入 `images/arch.png`
- Then 返回 3（与修复前行为一致）

### 端到端真实页面（P6 Playwright CDP 实跑，debug :8888）

#### BDD-10: 中文文件名图片实际渲染
- Given debug 环境有 entry，含中文文件名图片资源，markdown 正文以相对路径引用
- When 打开该 entry 页面并等待渲染完成
- Then 图片在页面中实际可见（截图确认无裂图），资源请求成功（非 404），src 指向后端文件内容端点而非原始相对路径

#### BDD-11: 中文文件名链接实际可点击打开
- Given 同上 entry，markdown 正文含指向中文文件名附件的链接
- When 点击该链接
- Then 成功打开附件（跳转 `/{slug}?file={id}` 预览/下载成功），不出现 404

#### BDD-12: 非中文非 ASCII 文件名图片实际渲染（端到端佐证非中文专属）
- Given debug 环境有含日文（或带重音/空格）文件名图片的 entry
- When 打开该 entry 页面
- Then 图片实际渲染可见，资源请求成功（非 404）

#### BDD-13: 英文文件名页面不回归（E2E 冒烟）
- Given debug 环境有含英文文件名图片与链接的 entry
- When 打开页面并点击链接
- Then 图片渲染、链接点击行为与修复前一致（无回归）

## 4. 待确认清单

[NO_NEED_CONFIRM]

根因、改动范围、验收方式均由 P0/dispatch 确定且无歧义，无需要人拍板的方向性决策。

## 5. 裁剪说明

- **P1_simplified: true**：明确 bug 修复（`problems` 类型），需求复述一句话即可；隐含需求 + BDD 已完整保留。
- **P2 不可裁**：存在两个候选修复位置（消费侧 decode vs 构建侧 encode），P0 要求 P2 明确选型理由并排除另一个（尤其构建侧 encode 会改写 key 语义）。
- **P3 不可裁**：`path-map.test.ts` 与后端测试均无任何非 ASCII 用例，不满足"现成覆盖"裁剪条件，必须走真红灯。
- **P5 保留**：前端 `vue-tsc --noEmit` + 单测全绿。
- **P6 不可裁**：行为修复，BDD-10/11/12/13 需浏览器实跑 + 截图（`capability_requirements` 已确认能力可用）。
- **P7 裁剪**：单源文件改动（逻辑改动仅 `frontend-v3/src/utils/path-map.ts`；`path-map.test.ts` 与新增 seed-data fixture 是单点修复的推论产物，P6 实跑 fixture 时天然校验一致性），无跨端/跨包/跨文件一致性需求（domains 仅 frontend，packages 仅 peekview）。
- **跳过风险:**（P7）已检查耦合点——pathMap key 语义（decode 不得改写 key 与 DB 文件名一致性）、useMarkdown 4 处调用点（单点修复自动覆盖）、markdown-it encode 行为（mdurl.encode → decodeURIComponent 单次还原成立）；三者均已通过 P1 隐含需求分析与 BDD-7 钉死，P2/P4 若触碰任一点将被 P3 红灯或 P6 实跑捕获。剩余风险低，可裁。
- **P8 保留**：用户可见 bug 修复，随 peekview 发布；需按 AGENTS.md 铁律 8 及时更新 CHANGELOG。

## 6. 能力需求声明

见 frontmatter `capability_requirements`：browser-e2e 与 browser-vision 均 `status: available`（playwright-cdp skill、vision-engine skill、make debug-test 均可用），无 `[CAPABILITY_GAP]`。

`requires_minimal_validation: true`：修复的正确性依赖"markdown-it `mdurl.encode` 的输出可被 `decodeURIComponent` 单次解码还原，且对中文/日文/重音/空格均成立"这一假设（P0 已从代码路径确认 encode 行为存在，但未逐字符类实证）——P2 需产出 `minimal_validation` 块实证该假设后再进入实现。
