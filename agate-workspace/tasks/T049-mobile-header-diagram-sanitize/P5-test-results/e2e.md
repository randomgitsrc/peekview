# P5 技术验证 — E2E 测试

## Playwright E2E
- **命令**: `cd frontend-v3 && npx playwright test --reporter=line e2e/t049-mobile-header-diagram-sanitize.spec.ts`
- **测试文件**: `frontend-v3/e2e/t049-mobile-header-diagram-sanitize.spec.ts`（13 条用例）
- **要求**: debug server (:8888) + CDP Chrome (:18800)
- **状态**: ⏸️ 需要在调试环境中手动执行

## P5_e2e 验证清单
- [ ] A-BDD-1~2: 移动端标签截断 + +N 指示器
- [ ] A-BDD-3~4: 滚动收缩/恢复动画
- [ ] A-BDD-5: 桌面端不受影响
- [ ] A-BDD-6: 正文标签不受影响
- [ ] C-BDD-1: Mermaid 错误后无错误 SVG 残留
- [ ] C-BDD-3~6: 统一错误 UI（引擎名+可折叠详情+查看源码）
