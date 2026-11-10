---
phase: P0
task_id: TPV0102
task_name: explore-card-list-ux
trace_id: TPV0102
created: 2026-11-10
status: pending
parent: 无
---

# P0-brief — TPV0102 Explore 列表体验修正（时间显示 / 文件数 / 可见性下拉 / 空态）

## task

Explore 页卡片模式与列表模式的四项用户体验缺陷修正，四项均为**用户可见改动**：

1. **时间显示改为绝对时间 + 时区标识**：现状显示相对时间（`3h ago`），悬停才是绝对时间且**不带时区**（`toLocaleString()` 用浏览器 locale，看不出是哪个时区的时间）。改为：主显绝对时间、悬停同时给「相对 + 绝对」，且绝对时间**必须带时区名**
2. **文件数按语义显隐**：现状 `fileCount` 非 0 就显示 `N file(s)`，导致 `1 file` 这种零信息量占位满屏。改为：`0` 与 `1` 不显示，仅 `2+` 显示
3. **可见性单按钮改为下拉菜单**：现状 `Make Public` / `Make Private` 单按钮**无法表达团队可见性**（团队内容时按钮被替换成空占位、列表模式连占位都没有、详情页只有只读标签）。改为下拉菜单，直接并列 `Public` / `Private` / `Team ▸ 子菜单`，并抽取共享组件三处复用
4. **0 文件 entry 的详情页空态**：后端允许无文件 entry（`CreateEntryRequest.files` 默认空数组、下载逻辑注释明写 "empty zip when the entry has no files"），但前端无任何提示，用户会疑惑"到底有没有文件"

## 需求来源

2026-11-10 用户逐项提出并已确认的四点，外加两项相关但**不在本任务范围**（见「明确排除」）。

## 已确认的设计决策

### 决策 1：时间显示 + 序列化契约（已实测定案）

#### 1.1 问题定性（实测，非推断）

| 事实 | 实测证据 |
|---|---|
| DB 存 naive UTC | 25 个列均 `Column(DateTime(timezone=False))`（TPV0101 刻意为之） |
| **SQLite 下 `timezone=True/False` 行为完全一致** | 两者都读出 naive、库里都存 `2026-11-10 09:43:00.000000`（SQLite 无原生时区类型）→ **改列定义无效** |
| 写入侧统一 UTC | 全仓 34 处 `datetime.now(timezone.utc)` + 全部列 `default_factory=now_utc`；**无 `datetime.now()` 裸调用** |
| **库里 naive 值精确等于 UTC** | 写入 aware UTC → 读回 naive → 补 `tzinfo=utc` 后与写入前**差值 0.000000 秒**；误当本地时间则差 8 小时 |
| Pydantic 序列化差异 | naive → `"2026-11-10T09:43:00"`（无 Z）；aware → `"2026-11-10T09:43:00Z"` |

**结论**：数据本身正确（是 UTC），**缺陷仅在表示层未声明时区**。前端 `new Date("2026-11-10T09:43:00")` 会按本地时间解析 → 中国用户看到的时间早 8 小时。现状因显示相对时间（`3h ago`）而未暴露，**改成绝对时间会立刻暴露**。

#### 1.2 方案：响应层补时区标记（不做 DB 迁移）

**已排除**：

| 方案 | 排除理由（实测/结构） |
|---|---|
| 改 DB 列为 `DateTime(timezone=True)` | ① SQLite 下与 `False` **行为完全一致**，无效 ② 会推翻 TPV0101（25 列 + 依赖守卫 + 静态守卫测试） ③ SQLite 无时区类型，改了对存量数据无实际效果 |
| 仅前端补 `Z` | 每个消费方（前端 / MCP / CLI / 第三方）都得各自记得，且 MCP 的 `new Date(entry.created_at)` 现状就是错的 |
| 引入服务端时区配置 | 用户已明确选择"靠浏览器时区"，不需要 |

**采纳：在叶响应模型加 `field_serializer`**（已实测不污染表模型）：

```python
@field_serializer('created_at', 'updated_at', 'expires_at', 'archived_at', 'archive_delete_at')
def _ser_utc(self, v: datetime | None) -> str | None:
    if v is None: return None
    return (v.replace(tzinfo=timezone.utc) if v.tzinfo is None else v).isoformat().replace('+00:00', 'Z')
```

**关键陷阱（已验证）**：
- `Entry` 继承 `EntryBase`，而 `EntryBase` 含 3 个 datetime 字段 → **不能改 `EntryBase`**，否则污染表模型
- 必须加在**叶响应模型**：`EntryResponse` / `EntryListItem` / `EntryRawResponse` / `CreateEntryResponse` / `UserResponse` / `ApiKeyResponse` / `ApiKeyCreateResponse` / `ShareResponse` / `StarResponse` / `StarItem` / `TombstoneResponse` / `ReadStatsResponse` / `ReadEventResponse` / `CountdownInfo` / `EntryStats`（共 15 个，约 30 个字段）
- 实测：叶模型加 serializer 后，表模型 `model_dump` 仍输出无 Z、列类型仍 `timezone=False` ✅

**建议抽公共 Mixin**（如 `UtcSerializeMixin`）避免 15 处重复；P2 定具体形态。

#### 1.3 前端显示（用户选定"靠浏览器时区"）

- 主显**绝对时间**，悬停显示 `相对时间 · 绝对时间`
- 格式：`toLocaleString(undefined, { timeZoneName: 'shortOffset' })`
- **为什么用 `shortOffset` 而不是 `short`**（实测）：`short` 在不同时区输出形态不一致——`Asia/Shanghai` → `GMT+8`、`America/New_York` → `EST`、`UTC` → `UTC`、`Europe/London` → `GMT`；其中 **`EST`/`CST` 一类缩写有歧义**（EST 也可能是澳大利亚东部时间）。`shortOffset` 始终输出 `GMT±N` 形态，无歧义
- 预期输出：`2026/11/10 17:43:00 GMT+8`

#### 1.4 消费方影响（已盘点）

| 消费方 | 现状 | 补 Z 后 |
|---|---|---|
| 前端 | `new Date()` 按本地解析（错 8h） | 正确 ✅ |
| MCP | `new Date(entry.created_at)` 同错 | 变正确 ✅ |
| CLI | `.isoformat()` 输出无 Z | 变为 `+00:00`（注意：Python `isoformat()` 不用 `Z`）→ 若要与 API 一致需 `.replace('+00:00','Z')` |

**P1 需确认**：CLI 输出形态变化是否属可接受的可见变更（影响 `--json` 消费方）。

### 决策 2：文件数显隐

```
fileCount === 0 → 不显示（详情页另有空态，见决策 4）
fileCount === 1 → 不显示
fileCount >= 2  → 显示 "N files"
```

理由：`1 file` 几乎对所有 entry 成立，不构成区分信号；`2+` 才有"这个内容比别的内容多"的信息量。

### 决策 3：可见性下拉（用户选定"直接并列 + Team 子菜单"）

**选项构造**（当前项不出现，而非置灰）：

| 当前状态 | 菜单项 |
|---|---|
| `is_public=true, team=null` | `Private` / `Team ▸` |
| `is_public=false, team=null` | `Public` / `Team ▸` |
| `is_public=false, team=A` | `Public` / `Private` / `Team ▸`（子菜单中不含 A） |

**Team 一律用子菜单**（用户决定：不管团队几个都这样，避免"≤8 平铺"的魔法阈值）。

**无团队时**：`teamStore.allTeams.length === 0` → 整个 Team 项不渲染。

**语义是「切换」不是「移动」**（已查证后端）：

| 操作 | 后端调用 | 说明 |
|---|---|---|
| Public → Private | `PATCH { is_public: false }` | 原地切换 |
| Private → Team A | `PATCH { team_id: "A" }` | 后端强制 `is_public=false` |
| Team A → Team B | `PATCH { team_id: "B" }` | 直接改归属，无清理动作 |
| Team A → Private | `PATCH { team_id: null }` | **只清团队，不改 is_public**（保持 private） |
| Team A → Public | `PATCH { team_id: null, is_public: true }` | **必须两字段同传**，否则停在 private |

> 后端依据：`entry_service.py:809-818`（`team_id_set` 区分"不传"与"传 null"）、`entry_service.py:89-102`（`can_read_entry`）、`entry_service.py:1263-1279`（`_resolve_team_for_user` 权限校验）。前端 `api/client.ts:203` 的 `updateEntry` 已支持这两个字段，**API 无需改动**。

**交互细节**：
- **升为 Public 需二次确认**（用户选定）——唯一不可逆的信息暴露方向
- 降级可见性（Public → Private/Team）不确认
- 请求期间菜单项禁用（防连点），失败保持原状态并 toast
- 成功后 toast：`Made public` / `Now private` / `Shared with Team A`

### 决策 4：0 文件空态

详情页正文区显示空态提示（"此 entry 无文件"一类文案）。列表/卡片不显示文件数即可（决策 2），**不需要**额外占位。

## 实现要点（P1/P2 输入）

- **抽取 `VisibilityMenu` 组件**，三处复用：`EntryCard.vue`、`EntryListRow.vue`、`EntryDetailHeader.vue`（详情页现只有只读标签 `EntryDetailHeader.vue:68-69`）
- **团队列表只拉一次**：`teamStore.allTeams` 由列表页父级加载后经 prop 下发，避免每张卡片各拉一次
- **消除现有重复**：`EntryCard.vue` 与 `EntryListRow.vue` 的 script 段几乎逐字相同（`TAG_LIMIT=3`、`isExempt`、`isExpiredButActive`、`navigateToEntry/User/Tag`），抽组件时顺带评估是否一并提取
- **卡片/列表的团队可见性不一致需修复**：卡片在团队内容时渲染空 `team-hint` span（`EntryCard.vue:18-24`），列表模式无任何对应元素 → 统一到 `VisibilityMenu` 后自然消除

## 明确排除（不在本任务范围）

| 项 | 去向 |
|---|---|
| 主文件语义（README 优先 / `is_primary` 字段 / MCP `primary_path`） | roadmap #57 |
| `/{slug}/f` 多文件无法指定展示文件（`/f?firstFileId=` + 清 query 坑） | roadmap #58 |

理由：前者动 schema 与 MCP 契约，后者动**已发布的公开 URL 契约**（`/{slug}/f` 自 v0.25.0 上线），均需独立评估兼容性。

## 关键约束

- 四项均为用户可见改动 → CHANGELOG `[Unreleased]` + P8 bump
- 时间显示项**必须先验证 API 时间字符串形态**（见决策 1 前置验证），否则会引入时区偏移
- 可见性下拉涉及**权限边界**：菜单只对 owner 显示（现状即如此），且团队项由后端 `_resolve_team_for_user` 兜底（非成员返回 422 统一报错，不做存在性泄露）
- 三处复用同一组件 → P7 一致性检查不可裁

## 验收基线（BDD 倾向，P1 细化）

1. Given 任意 entry When 看卡片/列表的时间 Then 显示绝对时间且**含 `GMT±N` 形态时区标识**，悬停同时出现相对时间
1b. Given 任意 API 返回的时间字段（`created_at`/`updated_at`/`expires_at` 等）When 检查响应 JSON Then 值**以 `Z` 结尾**（naive UTC 被显式标注）
1c. Given 一个已知 UTC 时刻的 entry When 在 `Asia/Shanghai` 设备查看 Then 显示为该时刻 +8 小时（**非**原值），验证无 8 小时偏移
1d. Given 表模型 `Entry` When `model_dump()` Then 时间**不带 `Z`**（表模型不被响应层 serializer 污染）
2. Given 一个含 1 个文件的 entry When 看卡片/列表 Then **不显示** `1 file`
3. Given 一个含 3 个文件的 entry When 看卡片/列表 Then 显示 `3 files`
4. Given 一个 0 文件 entry When 打开详情页 Then 正文区显示空态提示
5. Given 本人 entry 且当前为 Public When 打开可见性菜单 Then 有 `Private` 与 `Team ▸`，**无** `Public`
6. Given 用户无任何团队 When 打开可见性菜单 Then **无** Team 项
7. Given 当前为 Team A When 打开 Team 子菜单 Then **不含** Team A，含其他团队
8. Given 当前为 Team A When 选 Public Then 弹二次确认；确认后 entry 变 public 且 team 清空
9. Given 当前为 Team A When 选 Private Then 直接生效（无确认），entry 变 private 且 team 清空
10. Given 非 owner 用户 When 看卡片/列表 Then 无可见性菜单（现状保持）
11. Given 详情页 When 本人查看 Then 也有可见性菜单（现为只读标签，本次新增入口）
12. Given 可见性切换失败 When 请求返回错误 Then 状态不变且提示失败

## 已知风险

- ~~时区解析坑~~ **已实测排除**：库里 naive 值经验证精确等于 UTC（差值 0.000000s），响应层补 `Z` 语义正确
- **改错层的风险**：`EntryBase` 被表模型 `Entry` 继承，serializer 必须加在**叶响应模型**（15 个），加错会污染表模型
- **CLI 输出形态变化**：`.isoformat()` 补时区后变为 `+00:00`（Python 不用 `Z`），可能影响 `--json` 消费方，P1 需确认
- **三处复用**：详情页此前无编辑入口，新增菜单会改变详情页交互密度，需视觉确认
- **`EntryCard`/`EntryListRow` 重复逻辑**若一并重构，改动面会扩大（可拆到 P7 或独立任务）
- 团队子菜单在团队很多时的可用性（用户已接受"一律子菜单"，但 >15 个团队时体验需实测）

## 裁剪倾向

- P1：不可裁（含 12 条 BDD 与权限边界，需评审）
- P2：不可裁（三处复用的组件契约是设计核心）；frontend 域 → plan-design-review
- P3：保留（时间格式化、文件数显隐、菜单选项构造均有可单测行为）
- P6：不可裁——12 条 BDD 逐条实跑 + 双 project E2E + 截图（UI 改动）
- P7：保留（多文件 + 三处复用）
- P8：bump-version，CHANGELOG `[Unreleased]`
