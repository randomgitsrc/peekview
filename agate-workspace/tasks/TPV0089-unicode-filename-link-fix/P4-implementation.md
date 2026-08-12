---
phase: P4
task_id: TPV0089-unicode-filename-link-fix
type: implementation
parent: P2-design.md
trace_id: TPV0089-P4-20260811
status: draft
created: 2026-08-11
agent: implementer
---

# P4 实现记录 — TPV0089 非 ASCII 文件名本地资源链接解析修复

implementation_dir: frontend-v3/src/utils/

## 1. 改动范围

单文件改动：`frontend-v3/src/utils/path-map.ts`（+23 / -4）。

- 抽出私有 `matchRef(normalized, pathMap)`：复用原有 exact → basename 两段查找，返回 `number | null`
- `resolvePath()` 改为：normalizeRef → **raw 优先** matchRef → try/catch `decodeURIComponent` **恰好一次** → `decoded === normalized` 判无 `%` 可解返回 null → decode 结果**重跑 normalizeRef 守卫** → 再次 matchRef
- `normalizeRef()` / `buildPathMap()` **零改动**（decode 未进入构建侧，BDD-7 红线满足）
- 函数签名 `(ref: string, pathMap: PathMap) => number | null` 不变，useMarkdown.ts 4 处调用点（L117/L126/L299/L317）零改动
- 未加注释（AGENTS.md 铁律 9）

## 2. 实现对照 P2 方案 A 契约

| 契约点 | 实现 |
|--------|------|
| raw 优先命中（ASCII/字面 `%`/raw HTML） | `const raw = matchRef(normalized, pathMap)`，`raw !== null` 直接返回（显式 null 判断防 fileId=0） |
| decode 恰好一次 | 仅一次 `decodeURIComponent(normalized)`，结果不二次 decode |
| 畸形 `%` 不崩溃 | `try/catch`，URIError → 返回 null（BDD-6） |
| 无 `%` 可解 | `decoded === normalized` → 返回 null（raw 已 miss） |
| decode 后守卫重跑 | `normalizeRef(decoded)` 再跑一遍，外部/锚点/协议前缀 → null（P1 隐含需求，TC-UNI-11/12/13） |
| matchRef 抽公共查找 | exact → basename，保持原 basename `!== normalized` 判空逻辑 |

## 3. 自查结果

命令：`cd frontend-v3 && npx vitest run src/utils/path-map.test.ts`

```
Test Files  1 passed (1)
      Tests  51 passed (51)
```

- P3 红灯 6 条（TC-UNI-01/02/03/04/05/08 = BDD-1~5 + BDD-7）全部变绿
- 既有 38 条（TC-RP/TC-NR/TC-BPM）+ 新增绿灯 7 条（TC-UNI-06/07/09/10/11/12/13）全部保持绿
- 测试代码未修改

## 4. 环境隔离

本任务纯前端单文件逻辑改动，未启动任何服务、未触碰 :8080 与 ~/.peekview/。

[PROD_NOT_TOUCHED]

## 5. 自主决策声明

无。实现严格按 P2 方案 A 伪代码契约，无歧义点需要自主取舍。
