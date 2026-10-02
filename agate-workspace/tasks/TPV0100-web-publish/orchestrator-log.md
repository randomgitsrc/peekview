# TPV0100 orchestrator-log

> 主 Agent 防无响应锚点。派发前写 NEXT，gate 失败写 GATE FAIL + DIAGNOSIS，subagent 失败写 SUBAGENT FAIL，流程决策写 DECISION。

- DECISION（立项，2026-10-01）：任务 = 网页发布入口（人类上传通道）——登录用户在 `/publish` 上传文件/多文件并发布 entry，对标 MCP `publish_files`。需求来源事先以 spec V1.1（`docs/specs/peekview-web-publish-20261001.md`）写定并 3 轮独立评审 approved。
- DECISION（2026-10-01）：发布链路采用**方案 A**——前端内联 JSON（文本→`content`，二进制→`content_base64`）一次 `POST /api/v1/entries`，**后端零改动**。否决方案 B/C。
- DECISION（2026-10-01）：`isBinaryContent` **对齐后端** `language.py:is_binary_content`（0 字节→文本、含 NUL→二进制、否则严格 UTF-8 失败→二进制），**不**对齐 MCP `looksBinary`（后者只看前 8000 字节）。`content_base64` 后端无条件标 `is_binary:true`/`language:null` → 前端必须自判。
- DECISION（2026-10-01）：结果态 = 页面内状态机（不新增路由）；幂等键绑载荷指纹；`fileErrors` 用稳定 `fileId`（非 index）；错误提取区分形状（400→`error.message`；422→`detail[].msg`，禁 `[object Object]`）；结果态链接用 `window.location.origin`（非 `response.url`）。
- DECISION（2026-10-01）：入口两处 = UserMenu 下拉 + Explore 页顶部主按钮；**他人主页 `/users/:username` 不出现**（gate 在 `!props.owner`）。
- GATE PASS（2026-10-01）：P1 完成（`P1-requirements.md` 30 BDD + `P1-review.md` approved，2 轮闭合）。check-gate P1 exit 2。[详见 .state.yaml history]
- GATE PASS（2026-10-01）：P2 完成（`P2-design.md` + `P2-review.md` approved，2 轮：72→91/100）。C8 映射 domains=[frontend] → plan-design-review。主 Agent 评审后修 `gate_commands.P3`→`make test-frontend` + `P3_formatter`→`vitest-vite.sh`，消除 check-gate 假阳性 WARNING。check-gate P2 exit 2。
- DECISION（2026-10-01）：P3 阶段发现内置 `vitest.sh` 两处 gate 基础设施缺陷（1.5MB 输出 env 传参超限 + 不识别 Vite `Failed to resolve import`）→ 改用**任务本地** `.agate/formatters/vitest-vite.sh`（临时文件传输出 + Vite 形态识别 + `@/`→`src/` alias 归一化）。check-tdd-red.py exit 0（B 类真红灯）。
- DECISION（2026-10-01，**DESIGN_GAP 裁决 ①**）：**BDD-22 E2E 测试选错端点**。原用例断言 `GET /entries/{slug}/raw` 的 `body.owner_id`，但 `EntryRawResponse`（`models.py:776-785`）不含该字段 → 任何正确实现下必失败（P3 测试缺陷）。裁决：**授权修测试**——BDD-22 端点改为 `GET /api/v1/entries/{slug}`（`EntryResponse` 含 `owner_id`），业务意图不变。理由：属测试缺陷、非实现缺陷；改前端或扩 raw schema 均错误（前者违反后端零改动，后者超范围）。
- DECISION（2026-10-01，**DESIGN_GAP 裁决 ②**）：**UserMenu 旧单测硬断言 3 项**。原实现用取巧类名 `.dropdown-item-publish` 绕过 `UserMenu.spec.ts` 的 `.dropdown-item` 计数断言。裁决：**授权修测试 + 实现回归正常类名**——Publish 项复用 `.dropdown-item`（附 `.dropdown-item-publish` 语义类做加粗），下拉 3→4 项；同步更新 3 个既有单测文件（`UserMenu.spec.ts` 4 处、`T079-entry-detail-header.spec.ts` 2 处）的计数与索引。理由：取巧类名会让"菜单一致性"断言失去守护意义、且样式靠复制粘贴易漂移；测试应反映新规格。
- 执行（2026-10-01）：主 Agent 亲自落地两处裁决修订——`UserMenu.vue` 类名回归 + `UserMenu.spec.ts`/`T079-entry-detail-header.spec.ts`/`tpv0100-publish.spec.ts` 断言更新。复跑 `make test-frontend` = **1364 passed**（无回归）、`make typecheck` passed、`make build-frontend` passed、E2E = **40/40 passed**（chromium + Mobile Chrome）。
- DECISION（2026-10-01）：C8 映射 domains=[frontend] → P4 派 **design-review**（单评审角色，直接写 `P4-review.md`，无需组长汇总）。
- NEXT：等 P4 design-review subagent（bg session `ses_f04e38e...`）返回 `P4-review.md` → 跑 check-gate P4（确认暂存区含非 md/yaml 代码文件）→ git add 全部 + `.state.yaml`（phase 保持 P4）→ commit `wf(TPV0100-P4)` → 进 P5（读 phase-cards/P5-verification.md）。
- GATE PASS（2026-10-02）：P8 发布完成——`make bump-version NEW_VERSION=0.26.0` → commit `035feccd` + tag `v0.26.0`。版本三处一致（VERSIONS.json / frontend-v3/package.json / backend/pyproject.toml = 0.26.0；mcp_server 保持 0.12.0）。**提交前暂存面审查**（DEBT0017/RM-AG0077⑤）：bump commit 共 13 文件，无临时/敏感路径（`.agate-tmp/` 已被 .gitignore 覆盖）。CHANGELOG `[0.26.0]` 有实质条目（非空段）。check-gate P8 exit 2。
- DECISION（2026-10-02）：P5 验证走 **reuse_allowed**（`check-p6-provenance.py --audit7-only` → reuse_allowed，P5→P8 间无非产出文件改动）→ 按 P8 卡"条件化表述"复用 P5-test-results/，不重跑全量。主 Agent 仍亲自跑 `make lint` + `make typecheck` 各 exit 0。
- GATE PASS（2026-10-02）：READY 收尾——`make debug-stop`（:8888 端口释放、无 uvicorn 8888 进程）；`/tmp/peekview-debug/`、`.pid`、`/tmp/e2e-results/` 已清；`.agate-tmp/` 已清空（含 pv-cookies.txt 明文凭证）。`[PROD_NOT_TOUCHED]`（:8080 全程不可达、~/.peekview/ 只读）。commit `9bcbf0f9`。
- 复盘（2026-10-02）：`retrospective.md` — 4 条机制缺口（P6.5 judge 证据路径基准、P6-evidence/ 外证据形态、行首预判扫描未排除代码块、P3 无后端 schema 核对）+ 5 条 agate 反馈。登记 **DEBT0018**（P6.5 judge 证据路径/预判扫描鲁棒性，protocol，medium，agate-debt-check exit 0）。
- 终态（2026-10-02）：phase=DONE，commit `bd0592e0` + `d69c38f4`（状态列对齐）。git 工作区干净。
- BLOCKED（2026-10-02，环境限制）：`git push` 失败（`gnutls_handshake() failed: TLS connection non-properly terminated`）——沙箱无外网（与 :8080 不可达同因）。**待人工/联网环境**：`git push && git push origin v0.26.0`；`make publish`（PyPI，不可逆）；生产升级 `pipx upgrade peekview && sudo systemctl restart peekview`（AGENTS.md 铁律要求人工）。
