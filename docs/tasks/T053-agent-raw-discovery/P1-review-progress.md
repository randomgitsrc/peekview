# P1 Review Progress (Round 2)

## M1: P7 恢复 — ✅ 到位
- phases 列表: `[P1, P2, P3, P4, P5, P6, P7]` (line 293)
- P7 理由已修正: "Content Negotiation 复用 /raw 认证/可见性逻辑（I2），属于安全相关改动，WORKFLOW.md 风险矩阵要求安全相关改动不可跳过一致性检查" (line 302)
- 旧理由（"改动集中在后端 main.py，无跨包影响"）已删除

## M2: B7b 新增 — ✅ 到位
- B7b 存在 (line 165): "admin 访问私有 entry 返回 JSON"
- Given: 私有 entry + admin（非 owner）
- When: Accept: application/json + admin 认证 cookie
- Then: Content-Type application/json + 结构化 JSON（与 /raw admin 行为一致）
- 可二值判定 ✓

## M3: B13b 新增 — ✅ 到位
- B13b 存在 (line 233): "HTTP Link header — 私有 entry 也添加"
- Given: 私有 entry
- When: Accept: text/html
- Then: Link header 指向 /raw
- 与 B10b 对称 ✓

## R1: I1 实现建议清理 — ✅ 采纳
- 旧文本 "实现方式（P2 设计）：维护前端路由排除列表 + DB 查询确认 slug 存在性，或仅对 DB 中存在的 slug 注入" 已删除
- 新文本: "具体实现方式由 P2 设计决定" (line 30)

## R2: I3 性能评估清理 — ✅ 采纳
- "SQLite 单条查询 <1ms，可接受" 已删除
- 新文本: "SPA catchall 增加 DB 查询不应显著影响响应延迟。具体性能特征由 P2 设计验证" (line 46)

## R3: B9 Then 子句 — ✅ 采纳
- 旧: "前端 JS 处理 404 显示" → 新: "响应体为 SPA index.html" (line 189)

## R4: NC1 部署协调风险 — ✅ 采纳
- NC1 新增: "部署协调风险：后端代码部署与 GitHub llms.txt 文件更新是两个独立动作，需确保同步。P6 验收时需注意测试环境与生产环境的 llms.txt 内容可能不同" (line 281)

## R5: I9 短链接不变量 — ✅ 采纳
- I9 新增 (line 86-88): "/{slug}/raw 短链接不受影响"

## R6: I10 畸形 Accept — ✅ 采纳
- I10 新增 (line 90-92): "畸形 Accept header 行为"

## R7: B12 Given 条件 — ✅ 采纳
- Given 从空改为: "/explore、/settings/apikeys、/users/:username 是前端路由（非有效 slug）" (line 220)

## R8: slug 枚举风险 — ✅ 采纳
- I11 新增 (line 94-98): "<link> 存在性泄露 slug 有效性"
- 评估为可接受，已记录分析

## BDD 总数
- 20 条（原 18 + B7b + B13b）✓

## 新问题检查
- 无新问题引入
- I1/I3 纯净性已修复
- B7b/B13b 与现有安全边界一致
- NC1 部署协调风险已记录
