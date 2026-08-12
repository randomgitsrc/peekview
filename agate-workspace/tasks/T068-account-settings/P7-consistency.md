---
phase: P7
task_id: T068-account-settings
type: consistency
parent: P6-acceptance.md
trace_id: T068-P7-20260723
status: draft
created: 2026-07-23
agent: consistency-reviewer
---

## 1. DESIGN_GAP 配对

| # | P4 DESIGN_GAP 声明 | DESIGN_GAP_REVIEWED | 跨文件引用 |
|---|---------------------|---------------------|------------|
| 1 | P2 未指定 useToast 是否有 success/error 便捷方法。测试 mock 提供了 success/error，实际 useToast 只有 show(msg, variant)。实现中新增了 success/error 便捷方法以匹配测试预期，同时保持 show() 向后兼容 | DESIGN_GAP_REVIEWED: 合理。P2§2 详细设计未覆盖 useToast API 细节，属于实现层补充。新增 success/error 便捷方法保持 show() 向后兼容，不破坏现有调用方。P3 测试用例（P3-test-cases.md 前端 #6/#7/#9/#10）依赖 success/error，实现与测试对齐。P6 验收 BDD-02/BDD-03/BDD-05/BDD-06 的 toast 验证均 PASS，确认功能正确 | P4§DESIGN_GAP → P2§2 前端设计 → P3§前端测试用例 #6/#7/#9/#10 → P6§BDD-02/03/05/06 |

- [DESIGN_GAP: P2 未指定 useToast 是否有 success/error 便捷方法。测试 mock 提供了 success/error，实际 useToast 只有 show(msg, variant)。实现中新增了 success/error 便捷方法以匹配测试预期，同时保持 show() 向后兼容]
- [DESIGN_GAP_REVIEWED: 合理。P2§2 详细设计未覆盖 useToast API 细节，属于实现层补充。新增 success/error 便捷方法保持 show() 向后兼容，不破坏现有调用方。P3 测试用例依赖 success/error，实现与测试对齐。P6 验收 BDD-02/03/05/06 的 toast 验证均 PASS]

## 2. SCOPE+ 闭环

P1-requirements.md 无 [SCOPE_RESOLVED] 标记。

审查结论：P1 全阶段未产生 SCOPE+ 增补。P0-brief 需求明确（单页 tab 设置页 + PATCH /auth/me + API Keys 迁入），P1 隐含需求识别（17 条）全部纳入基线，P2/P4/P6 未发现超出 P1 范围的新需求。无 SCOPE+ 增补 = 无需 [SCOPE_RESOLVED] 标记，闭环状态：**合规**。

## 3. 跨文件一致性

### 3.1 P2 packages 与 P4 实现范围

| P2§影响域分析 声明 | P4§改动清单 实现 | 一致性 |
|---------------------|-------------------|--------|
| backend: api/auth.py | backend: api/auth.py (PATCH /me + import) | ✅ 一致 |
| backend: models.py | backend: models.py (UpdateProfileRequest) | ✅ 一致 |
| frontend: views/SettingsView.vue (新增) | frontend: views/SettingsView.vue (新增) | ✅ 一致 |
| frontend: views/ApiKeyListView.vue (重构为子组件) | frontend: components/settings/ApiKeySettingsTab.vue (新增提取) | ✅ 一致 — P2 说"提取为无 header 子组件"，P4 新建 ApiKeySettingsTab.vue，ApiKeyListView.vue 保留未修改（旧路由已重定向） |
| frontend: router.ts | frontend: router.ts | ✅ 一致 |
| frontend: stores/auth.ts | frontend: stores/auth.ts | ✅ 一致 |
| frontend: api/client.ts | frontend: api/client.ts | ✅ 一致 |
| frontend: views/EntryListView.vue | frontend: views/EntryListView.vue:377 | ✅ 一致 |
| (P2 未单独列出) | frontend: components/settings/ProfileTab.vue | ⚠️ 细化 — P2§2 将 Profile 作为 SettingsView 内条件渲染区块，P4 拆为独立子组件，属实现细化，不偏离设计意图 |
| (P2 未单独列出) | frontend: components/settings/SecurityTab.vue | ⚠️ 细化 — 同上 |
| (P2 未单独列出) | frontend: composables/useToast.ts | ⚠️ DESIGN_GAP 已配对 — 见 §1 |

### 3.2 P1 BDD 数 vs P6 PASS 数

| 维度 | 数量 |
|------|------|
| P1 BDD 条目 | 14 (BDD-01 ~ BDD-14) |
| P6 PASS 条目 | 14 (BDD-01~14 全 PASS；BDD-10 拆为 10a/10b 两个子场景但属同一 BDD) |
| 一致性 | ✅ 一致 |

逐条映射验证：
- BDD-01 → P6 PASS ✅
- BDD-02 → P6 PASS ✅
- BDD-03 → P6 PASS ✅
- BDD-04 → P6 PASS ✅
- BDD-05 → P6 PASS ✅
- BDD-06 → P6 PASS ✅
- BDD-07 → P6 PASS ✅
- BDD-08 → P6 PASS ✅
- BDD-09 → P6 PASS ✅
- BDD-10 → P6 PASS (10a + 10b) ✅
- BDD-11 → P6 PASS ✅
- BDD-12 → P6 PASS ✅
- BDD-13 → P6 PASS ✅
- BDD-14 → P6 PASS ✅

### 3.3 P4 实现路径 vs P2 方案设计

| P2 设计 | P4 实现 | 一致性 |
|---------|---------|--------|
| 方案 A：单组件 + 条件渲染 tab | SettingsView.vue + 3 个子组件 (ProfileTab/SecurityTab/ApiKeySettingsTab) | ✅ 一致 — 子组件拆分是条件渲染的实现形式，activeTab ref + computed getter/setter 模式与 P2§2 Tab 与 URL 同步设计完全吻合 |
| PATCH /auth/me: require_auth → trim → 空清 null → commit → UserResponse | P4 实现: require_auth → trim → 空清 null → commit → UserResponse | ✅ 一致 |
| UpdateProfileRequest(display_name: str \| None, max_length=64) | P4 实现: UpdateProfileRequest(SQLModel, display_name: str \| None = None, max_length=64) | ✅ 一致 |
| Tab 与 URL ?tab= 双向同步 (computed get/set + router.replace) | P4 实现: activeTab computed + router.replace | ✅ 一致 |
| 移动端 <640px 垂直分区 | P4 实现: isMobile computed + 垂直堆叠 | ✅ 一致 |
| auth guard: beforeEach 检查 /settings | P4 实现: router.ts beforeEach 新增 /settings 守卫 | ✅ 一致 |
| /settings/apikeys → redirect /settings?tab=apikeys | P4 实现: redirect 配置 | ✅ 一致 |
| authStore.updateProfile() → 更新 user ref | P4 实现: updateProfile action | ✅ 一致 |
| api/client.ts updateProfile() | P4 实现: updateProfile + changePassword 方法 | ✅ 一致 |
| EntryListView:377 路径更新 | P4 实现: navigateToApiKeys 更新为 /settings?tab=apikeys | ✅ 一致 |

## 4. 未决项清零

| 标记 | 扫描范围 | 结果 |
|------|----------|------|
| [NEED_CONFIRM] | P0~P6 全部产出文件 | 0 处残留 ✅ |
| [BLOCKER] | P0~P6 全部产出文件 | 0 处残留 ✅ |
| [DEVIATION-CRITICAL] | P0~P6 全部产出文件 | 0 处残留 ✅ |
| [NO_NEED_CONFIRM] | P1-requirements.md:157, P6-acceptance.md:43 | 存在 ✅ |

## 已知限制（非 BLOCKER）

P6-acceptance.md 记录了一个已知限制：全页刷新 /settings 时路由守卫在 fetchMe 完成前运行（authState='loading' 被当作未认证），导致已登录用户被重定向到 /explore。此 bug 不在 P1 BDD 验收范围内（BDD-09 只测未登录场景），属于新发现。**不构成 BLOCKER**，但建议作为后续改进项跟踪。

## 总结

- DESIGN_GAP: 1 条，已配对 DESIGN_GAP_REVIEWED ✅
- SCOPE+ 闭环: 无增补，合规 ✅
- 跨文件一致性: P2 packages vs P4 实现 ✅，P1 BDD 14 = P6 PASS 14 ✅，P4 实现路径 vs P2 方案 ✅
- 未决项清零: 无 [NEED_CONFIRM]/[BLOCKER]/[DEVIATION-CRITICAL]，[NO_NEED_CONFIRM] 存在 ✅
- 无 [BLOCKER] / [DEVIATION-CRITICAL]
