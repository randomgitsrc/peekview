# P2-progress — T087 architect

## 输入读取

- P2-dispatch-context-architect.md：follows_existing_pattern（参照 useShiki.ts）→ 单候选方案；minimal_validation=confirmed（P1 已实测 Shiki 行为）
- architect.md：P2 产出四字段 + files_to_read + env_constraints + minimal_validation + 候选方案
- P0-brief.md：环境约束（make debug-quick :8888 隔离；typecheck CI 强制）
- P1-requirements.md：10 BDD + DESIGN_CONSTRAINT（行号数==.line数==逻辑行数三联对齐）；packages=frontend-v3；risk=low-medium；不裁剪
- useShiki.ts：renderLineNumbers(150-154) + highlight(177-192) + highlightCode(194-209)；两函数都把同一 code 传给 codeToHtml 和 renderLineNumbers
- CodeViewer.vue：doHighlight() 对空 content 短路（line 88-91）；syncLineHeights 按 .line-number[index] ↔ .line[index] 配对
- useMarkdown.ts：fence content = token.content（markdown-it 已 trim 末尾换行）；highlightCode 调用点 line 363-367/378

## E2E spec 确认

- 不存在 code-viewer.spec.ts
- viewer.spec.ts 已覆盖 .code-body .line count + wrap 模式，是 P5_e2e 回归 spec
- Makefile debug-test 支持 E2E_SPEC 环境变量（scripts/run-e2e-tests.sh line 78）

## 设计决策

- trim 点：共享 trim（highlight/highlightCode 内部先 trim code 再分别传给 codeToHtml 和 renderLineNumbers），保证两列输入一致
- gate_commands.P5_e2e 用 viewer.spec.ts（现有 spec 跑回归）

## 产出完成

- P2-design.md 已写入
- 四字段齐全：packages=[frontend-v3] / domains=[frontend] / ui_affected=true / gate_commands（P3 vitest + P5 vitest+typecheck + P5_e2e viewer.spec.ts）
- files_to_read：useShiki.ts:150-209 + CodeViewer.vue:87-106 + useMarkdown.ts:261-273,376-384 + useShiki.spec.ts + viewer.spec.ts
- env_constraints：继承 P0（make debug-quick :8888 隔离，严禁 :8080/~/.peekview/）
- minimal_validation：confirmed（引用 P1 实测）
- 单候选方案：调用方共享 trim（highlight/highlightCode 内 code.replace(/\n$/,'')，同时喂给 codeToHtml 和 renderLineNumbers），renderLineNumbers 函数体不改
- 否决方向：renderLineNumbers 内 trim（会引入错位）/ trimEnd（误伤空格）/ Shiki transformer（YAGNI）

## 自检

- [x] 四字段齐全
- [x] files_to_read 含路径 + why + 行号范围
- [x] env_constraints 继承 P0 不弱化
- [x] minimal_validation=confirmed 引用 P1 实测
- [x] follows_existing_pattern 单候选 + 参照路径 + 理由
- [x] gate_commands.P5_e2e 已声明（viewer.spec.ts 现有 spec 回归）
- [x] 不碰后端/MCP/CLI/路由/权限
