---
phase: P3
task_id: TPV0089-unicode-filename-link-fix
type: test-cases
parent: P2-design.md
trace_id: TPV0089-P3-20260811
status: draft
created: 2026-08-11
agent: test-designer
---

# P3 测试用例 — TPV0089 非 ASCII 文件名本地资源链接解析修复

test_code_dir: frontend-v3/src/utils/path-map.test.ts + frontend-v3/e2e/unicode-filename-link.spec.ts

## 0. 测试策略总览

| 层 | 文件 | BDD 覆盖 | 运行时机 |
|----|------|---------|---------|
| 单元（追加） | `frontend-v3/src/utils/path-map.test.ts` | BDD-1~9 | P3 红灯 / P5 全绿 |
| E2E（新增） | `frontend-v3/e2e/unicode-filename-link.spec.ts` | BDD-10~13 | P6 `E2E_SPEC=e2e/unicode-filename-link.spec.ts make debug-test` |
| fixture | `scripts/seed-data/unicode-filenames/` | P6 E2E 素材 | `make debug-seed` 自动加载 |

既有用例（TC-RP-01~10 / TC-NR-01~18 / TC-BPM-01~10）保持不变，新增用例只追加在文件末尾。

## 1. 单元测试用例（BDD-1~9，追加到 path-map.test.ts）

测试命名规范：`TC-UNI-NN (BDD-M): <场景>`. 共用 `unicodeMap`（见下文代码），全部通过 `resolvePath(ref, unicodeMap)` 断言。

### BDD-1 → TC-UNI-01：中文文件名 path 引用解析成功
- Given pathMap 含 key `images/中文图片.png` → fileId 100
- When `resolvePath('images/%E4%B8%AD%E6%96%87%E5%9B%BE%E7%89%87.png', unicodeMap)`
- Then 返回 `100`
- 当前状态：**红灯**（实现无 decode，raw miss → null）

### BDD-2 → TC-UNI-02：中文文件名 basename 引用解析成功
- Given pathMap 含 key `中文图片.png` → fileId 101
- When `resolvePath('%E4%B8%AD%E6%96%87%E5%9B%BE%E7%89%87.png', unicodeMap)`
- Then 返回 `101`
- 当前状态：**红灯**

### BDD-3 → TC-UNI-03：日文文件名 path 引用解析成功
- Given pathMap 含 key `images/概要図.png` → fileId 102
- When `resolvePath('images/%E6%A6%82%E8%A6%81%E5%9B%B3.png', unicodeMap)`
- Then 返回 `102`
- 当前状态：**红灯**

### BDD-4 → TC-UNI-04：带重音拉丁字符文件名解析成功
- Given pathMap 含 key `images/café.png` → fileId 103
- When `resolvePath('images/caf%C3%A9.png', unicodeMap)`
- Then 返回 `103`
- 当前状态：**红灯**

### BDD-5 → TC-UNI-05：含空格文件名解析成功
- Given pathMap 含 key `images/report final.png` → fileId 104
- When `resolvePath('images/report%20final.png', unicodeMap)`
- Then 返回 `104`
- 当前状态：**红灯**

### BDD-6 → TC-UNI-06/07：畸形转义序列防御（孤立 `%` 不崩溃）
- TC-UNI-06：pathMap 含原始字符串 key `images/100%done.png` → fileId 105；`resolvePath('images/100%done.png')` 不抛异常且返回 105（raw 优先命中，decode 未触发）
- TC-UNI-07：pathMap 不含该 key（空 map）；`resolvePath('images/100%done.png')` 不抛异常且返回 null（decode 抛 URIError → catch → null 兜底）
- 当前状态：TC-UNI-06 **绿灯**（raw 命中，属既有行为保护）、TC-UNI-07 **绿灯**（当前无 decode 自然不抛异常）——两者皆为回归保护用例，P4 实现后必须保持绿

### BDD-7 → TC-UNI-08：字面 `%` 文件名 decode 恰好一次
- Given pathMap 含 key `a%20b.png`（文件名含字面 `%`）→ fileId 106
- When `resolvePath('a%2520b.png', unicodeMap)`（模拟双重编码引用）
- Then 返回 `106`（decode **恰好一次**还原为 `a%20b.png`，不得二次 decode）
- 当前状态：**红灯**
- 备注（P2 minimal_validation 前提勘误）：真实 markdown-it 对源码 `a%20b.png` 原样保留（keepEscaped），本条仅验证 decode-once 语义；真实链路由 BDD-8 覆盖

### BDD-8 → TC-UNI-09：字面 `%` 文件名 raw 直接命中
- Given pathMap 含 key `a%20b.png` → fileId 106
- When `resolvePath('a%20b.png', unicodeMap)`（真实 markdown-it 输出）
- Then 返回 `106`（raw 优先命中，不经 decode）
- 当前状态：**绿灯**（raw 命中属既有行为保护，P4 不得回归）

### BDD-9 → TC-UNI-10：英文文件名不回归
- Given pathMap 含 key `images/arch.png` → fileId 3
- When `resolvePath('images/arch.png', unicodeMap)`
- Then 返回 `3`（与修复前行为一致）
- 当前状态：**绿灯**（回归保护）

### P1 隐含需求补充用例（decode 后守卫重跑，外部引用过滤语义不退化）

| 用例 | Given | When | Then | 状态 |
|------|-------|------|------|------|
| TC-UNI-11 | 空 map | `resolvePath('%23intro')`（锚点编码形式） | null | 红灯前即绿（守卫保护） |
| TC-UNI-12 | 空 map | `resolvePath('https%3A%2F%2Fcdn.example.com%2Fx.png')` | null | 同上 |
| TC-UNI-13 | 空 map | `resolvePath('data%3Aimage%2Fpng%3Bbase64%2CAAA')` | null | 同上 |

> 说明：这三条在 P4 实现后若 decode 结果未重跑 `normalizeRef` 守卫，会因「编码形式外部引用被放行进查找链」而变红灯，用于钉死 P2 方案 A 的守卫重跑语义。

## 2. E2E 测试用例（BDD-10~13，frontend-v3/e2e/unicode-filename-link.spec.ts）

前置：`make debug-quick` 启动 debug backend（:8888）+ `make debug-seed` 灌入 fixture（slug=unicode-filenames）。运行：`E2E_SPEC=e2e/unicode-filename-link.spec.ts make debug-test`（CDP Chrome :18800）。

### BDD-10 → test_bdd_10_chinese_image_renders（桌面 + 移动）
- Given debug 环境 entry `unicode-filenames` 含中文文件名图片 `中文图片.png`，README.md 以相对路径 `![中文图片](images/中文图片.png)` 引用
- When 打开 `/{slug}` 并等待渲染完成
- Then 页面存在可见 `img`，`src` 匹配 `/api/v1/entries/unicode-filenames/files/\d+/content`（非原始相对路径、不含 `%E4%B8%AD` 编码），`naturalWidth > 0`（真实渲染无裂图）
- 截图：`evidences/bdd10_desktop_1280x800.png`、`evidences/bdd10_mobile_390x844.png`

### BDD-11 → test_bdd_11_chinese_link_click_opens_attachment（桌面 + 移动）
- Given 同上 entry，markdown 含指向中文附件 `报告附件.txt` 的链接
- When 断言 `a[data-peekview-file-id]` 存在且 `href === /{slug}?file={id}`，点击链接
- Then URL 跳转 `/{slug}?file=\d+`，文件内容区域可见（预览成功，非 404）
- 截图：`evidences/bdd11_desktop_1280x800.png`、`evidences/bdd11_mobile_390x844.png`

### BDD-12 → test_bdd_12_other_unicode_images_render（桌面）
- Given 同上 entry，含日文 `概要図.png` / 重音 `café.png` / 空格 `report final.png` 图片
- When 打开页面
- Then `.markdown-body img` 共 5 张全部 `src` 匹配 `/files/\d+/content` 且 `naturalWidth > 0`
- 截图：`evidences/bdd12_desktop_1280x800.png`

### BDD-13 → test_bdd_13_english_no_regression（桌面）
- Given 同上 entry，含英文文件名图片 `arch.png` 与链接 `English attachment`
- When 打开页面并检查链接
- Then 图片渲染、`a[data-peekview-file-id]`（English）存在且可交互——行为与修复前一致
- 截图：`evidences/bdd13_desktop_1280x800.png`

## 3. Fixture 说明：scripts/seed-data/unicode-filenames/

P1 隐含需求 [SUGGEST] 落地。目录结构（一个 entry，slug = 目录名 `unicode-filenames`）：

```
scripts/seed-data/unicode-filenames/
├── meta.json               # summary/tags/is_public/owner（alice）
├── README.md               # 主 markdown，相对路径引用下方图片与附件（成为 entry.files[0] 默认渲染文件）
├── 中文图片.png            # 中文文件名图片（BDD-10）
├── 概要図.png              # 日文文件名图片（BDD-12）
├── café.png                # 带重音拉丁字符（BDD-12）
├── report final.png        # 含空格文件名，markdown 用 <...> 尖括号包裹（BDD-12）
├── arch.png                # 英文文件名回归对照（BDD-13）
├── 报告附件.txt            # 中文文件名附件，链接目标（BDD-11）
└── english-notes.txt       # 英文附件，回归对照（BDD-13）
```

### 用途
- **P6 E2E 素材**：`make debug-seed` 自动加载该子目录（每子目录一个 entry），P6 实跑 BDD-10~13 时图片渲染、链接点击、英文不回归均在此 entry 上验证。
- **可复现/可进 CI**：真实文件（PNG 为 32×32 纯色实 PNG，`file` 命令校验通过）而非运行时 curl 拼装，P6 每次实跑用同一素材。
- **markdown 引用写法**（P2 minimal_validation 已实测）：
  - 空格文件名必须尖括号包裹：`![report final](<images/report final.png>)`
  - 中文/日文/重音文件名直接相对路径：`![中文图片](images/中文图片.png)`
  - 附件链接：`[中文附件下载](images/报告附件.txt)`

### seed 支持改动（必要）
`scripts/seed-debug.py` 的 `BINARY_OVERRIDES` 新增 `unicode-filenames` 条目（5 个 PNG 的 base64）。
必要性：seed-debug.py 默认对非 meta.json 文件 `read_text(utf-8)` 上传，二进制 PNG 会解码崩溃；BINARY_OVERRIDES 是既有机制（product-screenshots 同款），让 PNG 以二进制上传。这是让 fixture 可被 `make debug-seed` 加载的支持改动，非 TPV0089 实现改动。

## 4. 当前红灯确认（P3 自跑记录）

命令：`cd frontend-v3 && npx vitest run src/utils/path-map.test.ts`

```
Test Files  1 failed (1)
      Tests  6 failed | 45 passed (51)
```

失败 6 条 = TC-UNI-01/02/03/04/05/08（BDD-1~5 + BDD-7），失败断言均为 `expected null to be <fileId>`——被测模块未实现 decode，raw miss 后直接返回 null。失败原因符合「被测模块未实现」的 B 类红灯（断言与数据不矛盾，fixture key/编码串均按 P1 逐字核对）。

绿灯 45 条 = 既有 38 条（TC-RP/TC-NR/TC-BPM）+ 新增 BDD-6/8/9（TC-UNI-06/07/09/10）+ 守卫用例（TC-UNI-11/12/13）。这些是 raw 命中 / 守卫行为，属既有行为保护，P4 实现后必须保持绿。

## 5. 遗留（P6 注意）

- BDD-10~13 E2E 当前未实跑（需 debug backend + fixture seed），P6 按 §2 运行并产出截图到 `docs/tasks/TPV0089-unicode-filename-link-fix/evidences/`。
- E2E 用例多 viewport（desktop 1280×800 / mobile 390×844），截图文件名与 role 文件 B3 规范一致。
