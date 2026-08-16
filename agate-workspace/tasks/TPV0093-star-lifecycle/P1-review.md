---
phase: P1
task_id: TPV0093-star-lifecycle
type: review
parent: P1-requirements.md
trace_id: TPV0093-P1-20260816-r2
status: approved
created: 2026-08-16
agent: requirements-review
---

# P1 需求基线评审（r2 复核轮）— TPV0093 star-lifecycle

## 评审结论

**status: approved**

REV-1..4 已全部闭合。修订后的 P1-requirements.md（28 BDD）未引入新矛盾、无新 NEED_CONFIRM、BDD 编号 1-28 连续。本轮为增量复核，REV 闭合均以修订文本 + 代码证据双重确认。

---

## 1. REV-1..4 闭合确认（逐项）

### REV-1【share 独立授权通道】✓ 已闭合

- **声明位置**：§2.3 M1 补充（P1-requirements.md §2.3，line 62）显式声明 share token 为**独立授权通道**、与星标正交，授权判定仅基于「token 有效 + 未过期 + entry 非公开」，不随 archived/星标状态变化，且明确"archived 后既有 share 仍可读取（保留今日行为，无回归）"。表述清晰无歧义。
- **BDD-28**（line 186-189）：`Given E 已归档（无论是否被星标）+ E 存在有效 share token → When 持 share 读取 E → Then 200 且正文可读`——可二值判定 ✓。其 Given 语义隐含"share 创建于归档前"（`create_share` 拒绝 archived，`share_service.py:57-58`），与现有行为一致，可实测。
- **与 SUGGEST 6 自洽**：SUGGEST 6（line 256）末尾已加限定句"该判定仅约束登录用户通道；share 通道为独立授权通道，不受此判定影响（见 §2.3 M1 补充 / BDD-28）"——登录通道与 share 通道边界声明完整，无歧义。
- **代码证据复核**（独立视角再确认）：`get_entry_with_share`（`services/entry_service.py:1021-1058`）只校验 `is_public` / `expires_at` / share token，**不查 status**——BDD-28 场景（归档前建 share、归档后仍可读）在现有代码路径上成立，且 P1 声明为保留今日行为（无回归）。✓

### REV-2【reason=expired 保留型枚举】✓ 已闭合

- E7（line 74）已修订为：`reason=expired` 为**保留型枚举**（schema 保留供未来扩展），**当前逻辑不产出**；"最后星标取消且剩余≤0"过渡路径在删除时星标数已归零 → 按 SUGGEST 1 走纯物理删除、不建墓碑 → `reason=expired` 运行路径不可达；并明确"BDD 不验收 reason=expired 的实际产出，P2 不得依赖该枚举值"。
- **BDD-10 无需调整**：BDD-10（line 138-141）Then 只声明"进入待删除状态、下个清理周期物理删除"，**不涉及墓碑创建**，与 E7/SUGGEST 1 完全一致，语义不受影响。✓
- 原矛盾（SUGGEST 1「仅 ≥1 星标才建墓碑」vs E7 声称 expired 可达）已消除。

### REV-3【作者账号删除路径 + deleted_by 引用安全】✓ 已闭合

- **D8**（line 48）：`deleted_by` 不能为强 FK 指向 User 行，处理策略三选一（username 快照 / 非 FK / ON DELETE SET NULL），保证账号删除后墓碑仍可渲染作者名，且明确"具体存储方式交由 P2 落实、schema 字段不变"。
- **E10**（line 77）：显式覆盖 **两条路径**——`AdminService.delete_user` 与 `delete_self` 均逐个调 `delete_entry`，有星标时同样生成墓碑（reason=author_deleted）、星标用户可读可移除；`deleted_by` 按 D8 策略落实，禁止 FK 悬挂。
- **代码证据复核**：`delete_user`（`services/admin_service.py:450-473`）遍历 owner 的 entry slugs 逐个调 `delete_entry(is_api_key_auth=True)` 后删除 User 行；`delete_self`（`api/auth.py:251`）→ `admin_service.delete_user(current_user.id, ...)`——两条路径同构，且 User 行在墓碑创建后删除，强 FK 悬挂风险真实存在，D8/E10 声明正确覆盖。✓

### REV-4【download/render/短链同源继承】✓ 已闭合

- §3.4 同源继承说明（line 167）：download（`/{slug}/download`、`/{slug}/files/{id}`）、render（`/{slug}/files/{id}/render`）、短链（`/{slug}/raw`→302）均经 `get_entry()` / `_resolve_entry()` 集中权限继承，判定与 BDD-15/16 一致；P6 除实跑 BDD-15/16 外**抽查其一**。
- BDD-15（line 173）/ BDD-16（line 179）均补注"download/render/短链路径同源继承，P6 抽查其一"。✓

---

## 2. 快速复查（BDD 编号 + 跨条一致性）

### 2.1 BDD 编号连续性

- 共 **28 条**，格式全部为 `#### BDD-NN:` 标准格式 ✓
- 编号集合 **{1..28} 完整连续**，无跳号、无重复、无缺失 ✓
- **非阻断建议**：BDD-28 物理位置位于 §3.4（BDD-17 与 BDD-18 之间，line 186），文档序呈现 17→28→18，编号次序不单调（非跳号）。不影响 gate（gate 检查锚点存在 + status），也不影响 P6 逐条对照。建议 analyst 顺手将 BDD-28 重排至 §3.5 之后并重编号（或移到 §3.4 末尾），改善可读性——非本轮阻塞项。

### 2.2 修订是否引入新问题

| 检查项 | 结论 |
|--------|------|
| 新矛盾 | 无。BDD-28（share→200）与 BDD-16（非星标登录用户→404）分属正交授权通道，§2.3 M1 补充已显式声明边界；BDD-12/13/14 墓碑链与 E7/SUGGEST 1 一致 |
| 新 NEED_CONFIRM | 无。全文仅 2 处 `[NO_NEED_CONFIRM]`，7 项 SUGGEST 均为带倾向确认，无阻塞项 |
| BDD 可二值判定 | 全部 28 条 Given/When/Then 均可判定 PASS/FAIL，无中间态；每条单一 G-W-T ✓ |
| frontmatter 一致性 | trace_id 已同步为 `TPV0093-P1-20260816-r2`；risk_level=high / phases=P1-P8 / packages / domains 未变，与 P0 一致 ✓ |

### 2.3 BDD 锚点 + 覆盖维度（快速复查版）

| BDD | 判定 | 覆盖维度 |
|-----|------|---------|
| BDD-1..6 | ✓ 可二值判定 | 数据✓ 前端✓ 安全✓ 边界✓ |
| BDD-7..10 | ✓（freezegun/倒计时状态可控） | 数据✓ 边界✓ 生命周期✓ |
| BDD-11..14 | ✓（墓碑链自洽） | 数据✓ 前端✓ 安全✓ |
| BDD-15..17 | ✓（+28 同源继承抽查注记） | 安全✓ 多端✓ 兼容✓ |
| BDD-18..19 | ✓ | 前端✓ |
| BDD-20..23 | ✓ | 前端✓ 数据✓ |
| BDD-24..26 | ✓ | 前端✓ 安全✓ |
| BDD-27 | ✓（迁移机制 `_run_migrations`/backfill 同模式） | 数据✓ 兼容✓ |
| BDD-28 | ✓（share 独立通道，可实测） | 安全✓ 多端✓ 兼容✓ |

---

## 3. 结论与回派建议

- **REV-1..4 全部闭合**，修订无引入新问题，BDD 1-28 连续，可推进 P2。
- **非阻断建议**（可选，不阻塞 gate）：BDD-28 文档序位置重排/重编号。
- 上轮其余评审结论（M2/M3 无代码改动声明、7 项 SUGGEST、risk/phases/packages/domains/capability 声明）在本轮修订中未被触及，维持原判定，无需复评。
