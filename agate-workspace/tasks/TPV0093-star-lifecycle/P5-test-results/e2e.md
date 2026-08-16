# P5 E2E 测试结果 — star.spec.ts（verifier-frontend + 主 Agent 复跑）

- task_id: TPV0093-star-lifecycle
- phase: P5
- 命令: `E2E_SPEC=e2e/star.spec.ts make debug-test`
- 执行时间: 2026-08-16 19:4x（北京时间，主 Agent 亲自执行）
- GATE_EXIT: 0

## 输出签名

```
passed: 10
failed: 0
flaky: 0
```

```
[chromium] / [Mobile Chrome] × 5 tests each
  10 passed (8.5s)
=== ✓ 所有 E2E 测试通过 ===
GATE_EXIT: 0
```

- **10 passed / 0 failed / 0 flaky**（chromium 5 + Mobile Chrome 5）
- BDD-18/19 登录后 Starred tab 可见/匿名不可见 ✓
- BDD-1/6 详情页星标计数 +1（桌面 star-toggle）✓
- BDD-18 点击 Starred tab 后列表仅含星标条目 ✓
- BDD-20/21/22 管理页分类 tab + 批量移除按钮 ✓
- BDD-24/25 作者 Archived 列表豁免标签 + 强制删除按钮 ✓

## 修复记录（本轮 E2E 曾失败，已修复）

### 根因 1：login() helper 竞态（E2E spec 测试代码缺陷）

- `EntryListView.vue:9` AuthButton 仅 `authState === 'anonymous'` 时渲染；login() 在 authState=loading 时 count()=0 → 跳过登录
- 初修（implementer）加了 waitFor 但 `.catch(() => {})` 吞掉超时 → Mobile Chrome 下仍 flaky
- **终修（主 Agent，授权范围）**：`frontend-v3/e2e/star.spec.ts` login()——
  - 等待登录按钮出现且**不吞错误**（登录失败 → 测试失败，不静默跳过）
  - 登录后**确认 Sign in 消失**（UserMenu 接管）——确保登录真的成功

### 根因 2：run-e2e-tests.sh 无 timeout（基础设施缺陷）

- `npx playwright test` 直接跑，CDP 挂起则无限等待（两次 subagent 卡死根因）
- **修复（主 Agent，用户授权基础设施）**：`scripts/run-e2e-tests.sh` 加 `timeout "$E2E_TIMEOUT"`（默认 600s，E2E_TIMEOUT 可覆盖）；超时退出码 124 → 明确报错终止

## 环境隔离

- [PROD_NOT_TOUCHED] 未触碰生产 :8080 / ~/.peekview/；debug :8888 隔离实例
- CDP Chrome :18800 连接正常

## 预存失败

无。
