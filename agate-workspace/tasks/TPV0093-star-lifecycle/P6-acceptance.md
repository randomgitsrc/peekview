---
phase: P6
task_id: TPV0093-star-lifecycle
type: acceptance
parent: P5-test-results
trace_id: TPV0093-P6-20260816
status: draft
created: 2026-08-16
agent: verifier
# ── v2.0 机器汇总 ──
pass: 28
fail: 0
ui_affected: true
---

# P6 验收报告 — TPV0093 star-lifecycle

> 验收方式：P6 卡片「verifier 设计验证方案 → 主 Agent 执行脚本落盘证据」。
> backend 验证脚本 `P6-evidence/scripts/verify-backend.sh`（17 BDD）+ UI 验证脚本 `P6-evidence/scripts/verify-ui.ts`（11 BDD，Playwright CDP）。
> 环境：debug backend :8888（隔离）/ Chrome CDP :18800；用户 alice/bob/carol（testpass123）；`[PROD_NOT_TOUCHED]`。

## 1. 星标操作与计数

- PASS BDD-1: 登录用户星标公开内容计数+1（star_count 0→1, is_starred=True）(backend/BDD-1.json, backend/backend-results.log)
- PASS BDD-2: 同一用户重复星标不重复计数（star_count 保持 1, already_starred=True）(backend/BDD-2.json)
- PASS BDD-3: 取消星标计数-1（star_count 1→0, is_starred=False）(backend/BDD-3.json)
- PASS BDD-4: 匿名用户不能星标（anonymous POST→401）(backend/BDD-4.json)
- PASS BDD-5: 多用户星标各计一次（alice+bob → star_count=2）(backend/BDD-5.json)
- PASS BDD-6: 前端乐观更新失败回滚（请求失败后 count 1→1, aria-pressed true→true）(screenshots/bdd-06-rollback-1786888317208.png, backend/ui-results.json) (vision: P6-evidence/vision-reports/bdd-06-rollback.yaml)

## 2. 豁免删除（倒计时暂停/恢复）

- PASS BDD-7: 归档期星标→倒计时暂停，清理不删（pytest test_star_lifecycle -k bdd_7 exit=0, freezegun）(backend/BDD-7.json, backend/pytest-lifecycle.log)
- PASS BDD-8: 有效期内星标→归档后倒计时同样暂停（pytest -k bdd_8 exit=0）(backend/BDD-8.json, backend/pytest-lifecycle.log)
- PASS BDD-9: 取消星标恢复剩余倒计时（缓冲期内不删）（pytest -k bdd_9 exit=0）(backend/BDD-9.json, backend/pytest-lifecycle.log)
- PASS BDD-10: 最后一个星标取消且剩余≤0→下个清理周期物理删除（pytest -k bdd_10 exit=0）(backend/BDD-10.json, backend/pytest-lifecycle.log)

## 3. 作者删除优先 + 墓碑

- PASS BDD-11: 作者删除强制覆盖星标豁免（author delete→200, detail/raw 均 404）(backend/BDD-11.json)
- PASS BDD-12: 作者删除有星标→生成墓碑且星标用户可见（tombstone rows=1 reason=author_deleted; bob /stars 含墓碑）(backend/BDD-12.json)
- PASS BDD-13: 墓碑保留至最后引用移除（tombstone 1→1→0, 批量端点移除）(backend/BDD-13.json)
- PASS BDD-14: 墓碑卡片展示失效原因且可移除（reason-detail=true, remove=true, 无正文入口=true）(screenshots/bdd-14-tombstone-card-1786888317208.png, backend/ui-results.json) (vision: P6-evidence/vision-reports/bdd-14-tombstone-card.yaml)

## 4. 权限（决策 A：星标用户读 archived）

- PASS BDD-15: 星标用户可读 archived 全文（detail/raw/file/download 200 + 短链 302）(backend/BDD-15.json)
- PASS BDD-16: 非星标用户对 archived 404（detail/raw/file/download 均 404, 防 slug 枚举）(backend/BDD-16.json)
- PASS BDD-17: owner/admin 读 archived 恒 200（owner(alice) detail=200）(backend/BDD-17.json)
- PASS BDD-28: archived 私有 entry 持有效 share 仍可读（share 独立授权通道, detail=200 raw=200）(backend/BDD-28.json)

## 5. Explore Starred tab（决策 C）

- PASS BDD-18: 登录用户 Explore 出现 Starred tab 并显示我的星标（owner-tab count=4, 星标列表卡片=18）(screenshots/bdd-18-starred-tab-1786888317208.png, backend/ui-results.json) (vision: P6-evidence/vision-reports/bdd-18-starred-tab.yaml)
- PASS BDD-19: 匿名用户不显示 Starred tab（匿名 tab-starred count=0）(screenshots/bdd-19-anon-no-tab-1786888317208.png, backend/ui-results.json) (vision: P6-evidence/vision-reports/bdd-19-anon-no-tab.yaml)

## 6. 星标管理页

- PASS BDD-20: 星标管理页分类筛选（all/active/expiring/expired tab 均 present）(screenshots/bdd-20-filter-1786888317208.png, backend/ui-results.json) (vision: P6-evidence/vision-reports/bdd-20-filter.yaml)
- PASS BDD-21: 即将失效条目显示红色倒计时标签（"剩余 3 天· 豁免中", color=rgb(207,34,46) 红系）(screenshots/bdd-21-red-countdown-1786888317208.png, backend/ui-results.json) (vision: P6-evidence/vision-reports/bdd-21-red-countdown.yaml)
- PASS BDD-22: 批量取消星标/批量移除墓碑（勾选全部→ConfirmDialog 确认→移除后墓碑=0）(screenshots/bdd-22-batch-remove-1786888317208.png, backend/ui-results.json) (vision: P6-evidence/vision-reports/bdd-22-batch-remove.yaml)
- PASS BDD-23: 归档期星标即时 Toast 提示（"该内容已归档，星标后可长期保存"）(screenshots/bdd-23-archive-toast-1786888317208.png, backend/ui-results.json) (vision: P6-evidence/vision-reports/bdd-23-archive-toast.yaml)

## 7. 作者后台豁免提示 + 强制删除

- PASS BDD-24: 作者 Archived 列表显示星标豁免标签（"因被 1 位用户星标，已暂停自动删除"）(screenshots/bdd-24-exempt-label-1786888317208.png, backend/ui-results.json) (vision: P6-evidence/vision-reports/bdd-24-exempt-label.yaml)
- PASS BDD-25: 作者强制删除需二次确认（confirm 明示"已被 1 位用户星标…", 确认前 entry 仍存在=true）(screenshots/bdd-25-force-confirm-1786888317208.png, backend/ui-results.json) (vision: P6-evidence/vision-reports/bdd-25-force-confirm.yaml)
- PASS BDD-26: 强制删除后星标用户看到"作者已删除"墓碑（entry 404, bob 墓碑=2, watermark="作者已删除"）(screenshots/bdd-26-force-tombstone-1786888317208.png, backend/ui-results.json) (vision: P6-evidence/vision-reports/bdd-26-force-tombstone.yaml)

## 8. 存量数据迁移（决策 D）

- PASS BDD-27: 存量 archived 从上线日起算倒计时（pytest exit=0; col=1 orphan_archived=0 user_version=2 幂等）(backend/BDD-27.json, backend/pytest-migration.log)

**Summary**: 28/28 PASS, 0 FAIL

## verification_env

- 验收环境：debug backend :8888（P4 代码，make debug-quick 重启）+ Chrome CDP :18800 + seed 用户 alice/bob/carol
- 与生产差异：生产 :8080 有存量数据；本验收用隔离 debug 库（/tmp/peekview-debug/）验证迁移/backfill/权限/墓碑全链路
- `[PROD_NOT_TOUCHED]`

## 验收过程记录（P6 曾回退 P4 修复）

P6 首轮验证发现 2 个实现 bug，按 agate 回 P4 修复后重验全绿：

1. **BUG-1 [backend, CRITICAL]** list_entries 单列 select 解包崩溃（`for (rid,) in starred_rows` 对 ScalarResult 解包 int）→ 所有列表 API 500 → BDD-18/24 前端空列表。修复 `starred_ids = set(starred_rows)` + 补列表请求测试（P4-retreat-fix-r2.md）。
2. **BUG-2 [frontend, MEDIUM]** remaining_days 浮点数未取整显示（"剩余 2.9998... 天"）→ 修复 Math.ceil 取整（"剩余 3 天"）。

另修复 P6 验证脚本逻辑（非实现）：BDD-28 share 须归档前创建（create_share 拒绝 archived 新建）、BDD-13 墓碑移除走批量端点（slug 路由对已删 entry 404 为既有行为）、BDD-22 勾选全部墓碑、BDD-25 owner token 检查（匿名对 archived 404 是决策 A 正确行为）、verify-ui login 前 clearCookies（CDP cookie 残留）。

## 证据完整性

- backend 证据：`P6-evidence/backend/BDD-NN.json`（17 个）+ backend-results.log + pytest-lifecycle.log + pytest-migration.log
- UI 证据：`P6-evidence/screenshots/*.png`（11 张，最新轮 1786888317208）+ ui-results.json
- vision 证据：`P6-evidence/vision-reports/*.yaml`（11 个，blocker_count=0）
- 脚本：`P6-evidence/scripts/verify-backend.sh` + verify-ui.ts（可重跑）
