---
phase: P1
task_id: T053
type: review
parent: P1-requirements.md
trace_id: T053-P1-review-20260712-r2
status: approved
created: 2026-07-12
agent: requirements-review
---

# T053 P1 需求基线评审（第二轮）

## 修订验证

### M1: P7 恢复 — ✅ 到位

- phases 列表含 P7: `[P1, P2, P3, P4, P5, P6, P7]`（P1-requirements.md:293）
- P7 理由已修正为安全相关依据: "Content Negotiation 复用 /raw 认证/可见性逻辑（I2），属于安全相关改动，WORKFLOW.md 风险矩阵要求安全相关改动不可跳过一致性检查"（P1-requirements.md:302）
- 旧理由（"改动集中在后端 main.py，无跨包影响"）已删除

### M2: B7b 新增 — ✅ 到位

- B7b 存在（P1-requirements.md:165）: "Content Negotiation — admin 访问私有 entry 返回 JSON"
- Given: 私有 entry + admin（非 owner）
- When: Accept: application/json + admin 认证 cookie
- Then: Content-Type application/json + 结构化 JSON（与 /raw admin 行为一致）
- 可二值判定 ✓，与 B7 对称覆盖 owner + admin 两种认证角色

### M3: B13b 新增 — ✅ 到位

- B13b 存在（P1-requirements.md:233）: "HTTP Link header — 私有 entry 也添加"
- Given: 私有 entry
- When: Accept: text/html
- Then: Link header 指向 /raw
- 与 B10b（<link> HTML 注入）对称 ✓，补齐了 Link header 层面的覆盖缺口

### R1: I1 实现建议清理 — ✅ 采纳

- 旧文本"维护前端路由排除列表 + DB 查询确认 slug 存在性"已删除
- 替换为"具体实现方式由 P2 设计决定"（P1-requirements.md:30），P1 纯净性恢复

### R2: I3 性能评估清理 — ✅ 采纳

- "SQLite 单条查询 <1ms，可接受"已删除
- 替换为需求声明"SPA catchall 增加 DB 查询不应显著影响响应延迟。具体性能特征由 P2 设计验证"（P1-requirements.md:46）

### R3: B9 Then 子句 — ✅ 采纳

- "前端 JS 处理 404 显示"→"响应体为 SPA index.html"（P1-requirements.md:189），消除实现细节

### R4: NC1 部署协调风险 — ✅ 采纳

- NC1 新增"部署协调风险"段落（P1-requirements.md:281），记录 GitHub llms.txt 与后端部署不同步风险

### R5: I9 短链接不变量 — ✅ 采纳

- I9 新增（P1-requirements.md:86-88）: "/{slug}/raw 短链接不受影响"，声明路由注册顺序不变量

### R6: I10 畸形 Accept — ✅ 采纳

- I10 新增（P1-requirements.md:90-92）: "畸形 Accept header 行为"，声明视同 `*/*` 返回 HTML

### R7: B12 Given 条件 — ✅ 采纳

- Given 从空改为"/explore、/settings/apikeys、/users/:username 是前端路由（非有效 slug）"（P1-requirements.md:220），可判定性增强

### R8: slug 枚举风险 — ✅ 采纳

- I11 新增（P1-requirements.md:94-98）: "<link> 存在性泄露 slug 有效性"，评估为可接受并记录分析

## BDD 评审（20 条）

### B1: Content Negotiation — JSON 优先
- **判定**: PASS/FAIL 可二值判定 ✓
- **覆盖维度**: 数据✓ 前端✗ 多端✓ 边界✗ 兼容✓
- **备注**: "与 /raw 返回内容一致"可判定。边界维度（零文件/纯二进制 entry）由 P3 测试覆盖，P1 声明不变量即可。

### B2: Content Negotiation — HTML 优先
- **判定**: PASS/FAIL 可二值判定 ✓
- **覆盖维度**: 数据✓ 前端✓ 多端✓ 边界✗ 兼容✓

### B3: Content Negotiation — 通配符不触发 JSON
- **判定**: PASS/FAIL 可二值判定 ✓
- **覆盖维度**: 数据✓ 前端✗ 多端✓ 边界✓ 兼容✓

### B4: Content Negotiation — 浏览器 Accept 返回 HTML
- **判定**: PASS/FAIL 可二值判定 ✓
- **覆盖维度**: 数据✓ 前端✓ 多端✓ 边界✓ 兼容✓

### B5: Content Negotiation — JSON 优先级高于 HTML（q 值）
- **判定**: PASS/FAIL 可二值判定 ✓
- **覆盖维度**: 数据✓ 前端✗ 多端✓ 边界✓ 兼容✗

### B6: Content Negotiation — 私有 entry 未认证返回 404
- **判定**: PASS/FAIL 可二值判定 ✓
- **覆盖维度**: 数据✓ 前端✗ 多端✓ 边界✓ 兼容✓

### B7: Content Negotiation — 私有 entry 已认证返回 JSON
- **判定**: PASS/FAIL 可二值判定 ✓
- **覆盖维度**: 数据✓ 前端✗ 多端✓ 边界✗ 兼容✓

### B7b: Content Negotiation — admin 访问私有 entry 返回 JSON
- **判定**: PASS/FAIL 可二值判定 ✓
- **覆盖维度**: 数据✓ 前端✗ 多端✓ 边界✓ 兼容✓
- **与 B7 对称**: owner + admin 两种角色覆盖完整

### B8: Content Negotiation — 不存在的 slug 返回 404 JSON
- **判定**: PASS/FAIL 可二值判定 ✓
- **覆盖维度**: 数据✓ 前端✗ 多端✓ 边界✓ 兼容✓

### B9: Content Negotiation — 不存在的 slug HTML 模式返回 SPA 页面
- **判定**: PASS/FAIL 可二值判定 ✓
- **覆盖维度**: 数据✓ 前端✓ 多端✓ 边界✗ 兼容✓
- **修订确认**: Then 子句已改为"响应体为 SPA index.html"，纯净 ✓

### B10: HTML <link> 注入 — 有效 slug
- **判定**: PASS/FAIL 可二值判定 ✓
- **覆盖维度**: 数据✓ 前端✓ 多端✓ 边界✗ 兼容✓

### B10b: HTML <link> 注入 — 私有 entry 也注入
- **判定**: PASS/FAIL 可二值判定 ✓
- **覆盖维度**: 数据✓ 前端✓ 多端✓ 边界✓ 兼容✓
- **安全一致性**: <link> 是发现层（不泄露内容），/raw 是数据层（需认证），两层分离正确

### B11: HTML <link> 注入 — 不存在的 slug 不注入
- **判定**: PASS/FAIL 可二值判定 ✓
- **覆盖维度**: 数据✓ 前端✓ 多端✓ 边界✓ 兼容✓

### B12: HTML <link> 注入 — 前端路由不注入
- **判定**: PASS/FAIL 可二值判定 ✓
- **覆盖维度**: 数据✓ 前端✓ 多端✓ 边界✓ 兼容✓
- **修订确认**: Given 条件已补充完整 ✓

### B13: HTTP Link header — 有效 slug
- **判定**: PASS/FAIL 可二值判定 ✓
- **覆盖维度**: 数据✓ 前端✗ 多端✓ 边界✗ 兼容✓

### B13b: HTTP Link header — 私有 entry 也添加
- **判定**: PASS/FAIL 可二值判定 ✓
- **覆盖维度**: 数据✓ 前端✗ 多端✓ 边界✓ 兼容✓
- **与 B10b 对称**: Link header 层面覆盖完整 ✓

### B14: HTTP Link header — 不存在的 slug 不添加
- **判定**: PASS/FAIL 可二值判定 ✓
- **覆盖维度**: 数据✓ 前端✗ 多端✓ 边界✓ 兼容✓

### B15: llms.txt — 包含 /raw 和 Content Negotiation 描述
- **判定**: PASS/FAIL 可二值判定 ✓
- **覆盖维度**: 数据✓ 前端✗ 多端✓ 边界✗ 兼容✓
- **风险已记录**: NC1 部署协调风险 ✓

### B16: 端到端 — Agent 通过 Accept 直接获取 JSON
- **判定**: PASS/FAIL 可二值判定 ✓
- **覆盖维度**: 数据✓ 前端✗ 多端✓ 边界✗ 兼容✓

### B17: 端到端 — Agent 通过 <link> 发现 /raw
- **判定**: PASS/FAIL 可二值判定 ✓
- **覆盖维度**: 数据✓ 前端✗ 多端✓ 边界✗ 兼容✓

## 隐含需求覆盖

### 数据维度
- **覆盖**: I1（slug 存在性判断）、I6（不存在 slug 行为）、I10（畸形 Accept）
- **可接受遗漏**: URL 编码 slug 边界——当前 slug 生成规则保证 ASCII-only，P2 设计可显式声明此假设

### 前端维度
- **覆盖**: I8（无前端改动声明）
- **可接受遗漏**: SPA JS 路由不受影响——I8 已声明"Content Negotiation 只影响直接 HTTP 请求，不影响前端 JS 路由"，B4 隐含覆盖浏览器场景

### 多端维度
- **覆盖**: I2（认证感知 Content Negotiation）、I3（SPA catchall 需访问 DB）、I9（短链接不变量）
- **完整**: I9 补齐了 /{slug}/raw 短链接向后兼容声明

### 边界维度
- **覆盖**: I4（前端路由排除）、I7（静态文件优先级）、I10（畸形 Accept header）
- **完整**: I10 补齐了畸形 Accept 行为声明

### 兼容维度
- **覆盖**: I5（llms.txt 行为变更）、NC1 部署协调风险
- **完整**: NC1 部署协调风险已记录

## 裁剪评审

### P7 恢复 — 合理 ✓
- 理由: 安全相关改动（Content Negotiation 复用认证逻辑），与 WORKFLOW.md 风险矩阵一致
- 需验证: Content Negotiation 实现与 /raw 认证逻辑一致

### P8 裁剪 — 合理 ✓
- 理由: 无 schema 变更、无新 package、无版本号变更

### risk_level: medium — 合理 ✓

## P1 纯净性评审

- I1: 实现建议已清理，保留"具体实现方式由 P2 设计决定" ✓
- I3: 性能评估已清理，改为需求声明 ✓
- I5: NEED_CONFIRM 路径分析可接受 ✓
- I7: 正确性约束可接受 ✓
- **总体判定**: 纯净 ✓

## 新问题检查

- 修订未引入新问题
- B7b/B13b 与现有安全边界一致（发现层 vs 数据层分离）
- I9/I10/I11 新增隐含需求均为声明性，无实现渗入
- NC1 部署协调风险已记录

## 评审结论

**status: approved**

M1-M3 三项必须修订全部到位，R1-R8 八项建议修订全部采纳。BDD 总数 20 条（原 18 + B7b + B13b），覆盖维度完整，隐含需求识别充分，裁剪合理，P1 纯净性恢复。可进入 P2 方案设计。
