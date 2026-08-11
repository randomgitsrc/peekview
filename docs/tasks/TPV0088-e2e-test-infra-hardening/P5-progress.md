# TPV0088 P5 技术验证进度

开始：2026-08-12
环境：debug backend :8888 已就绪（health 200，seed 21 entries）；:8080 未在线（不触碰）

[PROD_NOT_TOUCHED] 未触碰生产服务/库

## 步骤 0：环境确认
- debug backend :8888: 200 OK ✓
- CDP Chrome :18800: 待确认
- git HEAD: 8faa147a (wf TPV0088-P4)

## 步骤 1：P3 自检（e2e-safety-check.sh --test-mtime）
- 执行：bash scripts/e2e-safety-check.sh --test-mtime
- 结果：✓ 静态产物新鲜 (src 未比 static/index.html 新)，EXIT_CODE: 0
- 判定：Check 6 新鲜态放行 ✓（过期态拦截由 P3 红灯确认 + 本步骤仅跑新鲜态）

## 步骤 2：P5 后端全量（make test-quick）
- 开始

### make test-quick 结果（多轮）
- 轮1：7 failed + 3 errors（test_cli_remote.py + test_admin_backup.py）
- 轮2：3 failed + 3 errors（test_cli_remote.py）
- 轮3（无 xdist 全量）：全绿 exit 0
- 轮4：全绿 exit 0
- 轮5：4 failed + 3 errors（test_cli_remote.py）
- 单文件隔离跑 test_cli_remote.py：17/17 绿
- 判定：`-n auto`（16 workers xdist）下模块级 fixture 子进程 server 未及时就绪（Connection refused :18888）
  → **预存失败**，与 TPV0089 已登记的 known-failure 完全一致（本任务零后端改动，backend/ diff 为空）
- 轮6（串行无 xdist 全量）：1068 passed, 3 skipped, exit 0 —— 全绿
- 结论：make test-quick 的失败 = xdist `-n auto` 并发下 test_cli_remote 模块级 fixture 竞态，预存失败（TPV0089 已登记）

## 步骤 3：P5_typecheck（make typecheck）
- 开始
### make typecheck 结果
- 输出：✓ type check passed
- EXIT_CODE: 0 ✓

## 步骤 4：P5_e2e（E2E_SPEC=e2e/viewer.spec.ts make debug-test）—— 核心验证
- 开始

### E2E 结果（E2E_SPEC=e2e/viewer.spec.ts make debug-test）
- BASE_URL=127.0.0.1:8888（run-e2e-tests.sh 硬编码，非生产），CDP :18800 ✓，Check 6 新鲜放行 ✓
- 结果：**18 failed + 1 flaky**（38 次运行 = 19 用例 × 2 项目）→ **BDD-1 19/19 未达成，P5_e2e 门禁失败**
- 真失败（非环境问题）：backend up / CDP up / seed 齐 / static 新鲜 —— 全部是 viewer.spec.ts 测试代码 bug

## 逐用例根因分析（chromium / Mobile Chrome）
| 用例 | chrom | mob | 根因 |
|------|-------|-----|------|
| TC-005 | F | F | `.file-item .file-name` 匹配 2 元素（python-entry-service 有 entry_service.py+requirements.txt）→ strict mode 违规 |
| TC-010 | F | F | markdown-test 默认 activeFile=files[0]=architecture.svg（非 markdown）→ `.markdown-body` 永不出现 |
| TC-011 | F | F | 同上：`.toc-nav` 永不出现 |
| TC-012 | F | F | 同上：`.toc-nav` 永不出现 |
| TC-020 | F | F | 同上：`.toc-sidebar` 永不出现（默认文件是 svg） |
| TC-022 | F | F | `.drawer-overlay` 中心点击被 `.drawer-left` 内 `.file-tree` 拦截 pointer events |
| TC-023 | F | F | 默认文件 svg → `isMarkdown` false → `mobile-bar-toc-btn` 不渲染 |
| TC-030 | P | F | Mobile 无 `.detail-header`（v-if=isDesktop），mobile-sticky-header 无 theme-toggle |
| TC-040 | P | F | Mobile 文件树在 drawer 内默认关闭，`.file-item` 不在 DOM |
| TC-050 | F | F | `.entry-card` 是 div，点击中心落在非链接区域 → 未导航（navigateToEntry 只在 `.card-title` anchor） |
| TC-002 | flaky | P | waitForShiki 首轮超时（retry 通过）→ 标 flaky |
| 其余 8 例 | P | P | TC-001/003/004/013/021/031/041/042 双项目全过 |

→ 结论：P5_e2e 门禁 **FAIL**，需回 P4 修复 spec

## 步骤 5：lint（AGENTS.md 铁律 10，ruff 用系统 python3）
- `python3 -m ruff check peekview/ tests/` → All checks passed, EXIT_CODE: 0 ✓

## 环境隔离终验
- debug db /tmp/peekview-debug/peekview.db: entries=24, integrity_check=ok（E2E 新增 e2e-test-code，属 debug 隔离库）
- 生产 pipx 服务 :13001 未触碰，~/.peekview/ 未查询/未修改
- [PROD_NOT_TOUCHED]

## P5 结论
- P5（make test-quick）：串行全绿 1068 passed；`-n auto` 下 test_cli_remote 预存 flaky（与 TPV0089 同源）→ 预存失败登记
- P5_typecheck（make typecheck）：PASS exit 0
- **P5_e2e：FAIL**（18 failed + 1 flaky，BDD-1 19/19 未达成）→ 真失败，需回 P4 修复 viewer.spec.ts
- P5 gate 判定：**不通过**（核心 E2E 门禁失败）

## 附注
- `git status` 显示 backend/zip-*.zip 被修改：`make test-quick` 中 pytest 测试写入 cwd 的测试副产物（非生产数据，无 PROD_TOUCHED）

## 产出
- P5-test-results/{unit,fail-list,e2e,typecheck}.md + known-failures.md 已落盘
- e2e.md 含 19 用例逐条结果（chromium + Mobile Chrome 双列）
