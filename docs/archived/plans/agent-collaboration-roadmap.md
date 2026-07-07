# PeekView Agent 协作能力路线图

> ⚠️ **此文档已失效**
> 取代文档：`docs/plans/cli-api-completeness-v2.md`（2026-06-15）
> 原因：经评审发现多处设计矛盾和缺口，重新整理方案
> 本文档保留作为历史参考，不再更新

> 创建：2026-06-15
> 取代：`docs/plans/cli-api-completeness.md`（已标注过时，见该文件头部）
> 核心视角：**以 Agent 协作场景为驱动，而非 API 完整性对称**

---

## 一、核心定位重申

PeekView 的角色是 **Agent Output Layer**——内容中转站：

```
Agent A 产出内容 → publish → PeekView → Agent B 消费内容
                                      ↓
                              人类在浏览器里查看
```

功能优先级判断标准（按权重）：
1. **直接服务 Agent 协作链路**（发布 / 消费 / 发现内容）
2. **运维 Agent 环境**（给 Agent 配 key、配路径、验证连通）
3. **人类管理 PeekView 服务**（用户管理、系统维护）

---

## 二、现状摸底（基于代码实际调查）

### 已有能力（不需要做）

**Agent 发布端**：
- MCP `publish_files` ✅、`create_entry` ✅
- CLI `peekview create` ✅（local + remote 双模式）
- API `POST /entries` ✅

**Agent 消费端**：
- T007：`GET /api/v1/entries/{slug}/raw` ✅（公开 entry 无需认证）
- T009：`/{slug}` 302 重定向到 `/raw`（短链直达）✅
- MCP `get_entry` ✅、`list_entries` ✅

**用户/认证基础**：
- `peekview user create/list/promote/demote` ✅（local 直连 DB）
- `peekview login/logout` ✅（remote 模式）
- `peekview admin stats/cleanup` ✅（local + remote）
- `peekview apikey create/list/revoke/cleanup` ✅（remote 模式）

**MCP 配置**：
- T001（v0.9.0）：path_namespaces 支持 ✅（手改 YAML 可用）

### 真实缺口分析

#### 缺口1：apikey CLI 强制 remote-only（高优）

`peekview apikey create/list/revoke` 目前强制 remote 模式，本地运行直接报错：
```
Error: API key management requires remote mode.
```

**实际场景**：headless 服务器（无浏览器）部署 PeekView，需要给 MCP Agent 生成 `pv_` key，目前只能开浏览器或者写 curl 脚本。这是真实的运维痛点。

**修复**：去掉 remote-only 限制，local 模式下直连 DB 生成 key，和 remote 模式行为一致。

#### 缺口2：改密码 + 删用户完全缺失（高优，真实痛点）

**真实场景（已确认在用）**：已有多个 Agent，每个对应一个用户账号（Web UI 注册）。
创建用户 ✅、创建/revoke API key ✅（Web UI 已有）。
但**改密码、删用户在 Web UI 和 CLI 都没有**——一个 Agent 不用了，账号/key/entry 全留着变垃圾，无渠道清理。

聚焦真实缺的两个操作（不做全套 user CRUD）：
- **删用户**：清理不用的 Agent 账号（最急）
- **改密码**：admin 重置 / 用户自助改

**权限模型——区分「管理员操作他人」和「用户自助」**：

| 操作 | 谁能做 | 对象 | 认证 |
|------|--------|------|------|
| 管理员删用户 | admin | 任何人，**除自己** | require_admin |
| 自助注销 | 任何登录用户 | 只能自己 | require_auth |
| 管理员重置密码 | admin | 任何人 | require_admin |
| 自助改密码 | 任何登录用户 | 只能自己 | require_auth |

- admin 不能删自己（防止系统失去最后管理员）。唯一 admin 注销自己 → 允许但二次确认（用户有权解散自己的实例）
- 注销 = 删除自己（级联：entries + files + api keys + 账号）

**需要新增的后端 API**：共 5 个端点，详见第三节 T011 设计。

#### 缺口3：MCP path_namespace 无 CLI 管理（中优）

v0.9.0 新增的 path_namespaces 功能，只能手改 `~/.peekview/mcp-config.yaml`。没有：
- 命令行添加/删除/列出映射
- 格式校验（写错了没有提示）
- 测试路径翻译是否符合预期

#### 缺口4：MCP 配置校验缺失（中优）

`peekview-mcp config verify` 不存在。配置好 URL 和 key 后，不知道连不连得上、key 对不对，只能真的跑一次 MCP 调用才知道。validators.ts 已写了验证逻辑但没有接线到 CLI。

#### 缺口5：MCP `list_entries` 无过滤参数 —— 评估后判定为伪需求，不做

最初设想「Agent B 想发现 Agent A 发布的内容需要过滤」。但实际协作模式是
**Agent A 把 URL 直接传给 Agent B**，Agent B 不需要「发现」，URL 已经给它了。
「Agent 浏览 PeekView 找内容」的场景在当前工作流不存在。**不做。**

#### 缺口6：peekview raw CLI —— 无痛点，移入 backlog

`peekview raw <slug>` 主要是本地运维便利。对 Agent 协作无额外价值（web_fetch + /raw 已够）。
无真实触发，移入 backlog（见第六节），需要时再捞。

---

## 三、功能设计

### T010：apikey local 模式解锁
- `backend/peekview/cli.py` 去掉 `if not _is_remote_mode` 的 remote-only 判断
- local 模式直连 DB 生成 `pv_` key，行为与 remote 一致
- 改动极小（约 20 行），风险低

### T011：用户管理 API（删用户 + 改密码）

API 端点（区分 admin 操作他人 / 用户自助）：
```
# 管理员（require_admin）
DELETE /api/v1/admin/users/{id}                # 删用户，不能删自己（400）
POST   /api/v1/admin/users/{id}/reset-password # 重置他人密码
GET    /api/v1/admin/users                     # 列出用户（CLI remote 需要）

# 自助（require_auth）
DELETE /api/v1/auth/me                         # 注销自己（级联）
POST   /api/v1/auth/change-password            # 改自己密码
```

级联删除：entries + 磁盘文件 + api keys + 账号。
边界：admin 不能删自己（400）；唯一 admin 注销自己 → 允许但二次确认。
认证：复用 `require_admin` / `require_auth`，不引入新环境变量。

### T012：peekview user CLI（delete + password）

```
peekview user delete <username>           # local: 直连DB级联 | remote: DELETE /admin/users/{id}
peekview user reset-password <username>   # admin 重置他人密码（local: 直连DB | remote: reset-password API）
peekview user change-password             # 自助改自己密码（交互式输入旧密码+新密码，remote only）
```
- 接入现有 `_get_backend()` 机制，local/remote 自动切换
- `delete` 危险操作：二次确认 + 展示将删除的 entries/keys 数量
- `reset-password` 是 admin 操作，local 直连 DB，remote 调 reset-password API
- `change-password` 是自助操作，只有 remote 模式有意义（本地直接用 reset-password）
- local 模式无需认证（能执行命令即有权限，与现有 create/promote 一致）
- remote 模式用 `config.remote.api_key`（管理员 key 自然有权限）
- **不做 user list remote 化**：无痛点，local 直连 DB 已足够（见第六节边界声明）

### T013：Web UI 用户管理（第二期）
- admin：用户管理页（列表 + 删除 + 重置密码）
- 自助：设置页加「修改密码」「注销账号」
- 依赖 T011 的 API

### T014：MCP path_namespace CLI
- `peekview-mcp config namespace add <ns> <container> <host>`
- `peekview-mcp config namespace remove <ns> [<container>]`
- `peekview-mcp config namespace list [<ns>]`
- `peekview-mcp config namespace test <ns> <path>`（测试翻译结果）

### T015：MCP config verify + unset
- `peekview-mcp config verify`：读配置 → HTTP 健康检查 → 认证验证 → 输出每项状态
- `peekview-mcp config unset <key>`：删除配置项
- 接线已有 validators.ts 的校验逻辑

---

## 四、任务拆分

按「最小可独立交付」原则拆分，每个任务独立走 v4 流程：

### 第一期：CLI + API（Agent 运维痛点，先做）

| 任务 | 内容 | 包 | 优先级 | 依赖 |
|------|------|-----|--------|------|
| T010 | apikey local 模式解锁 | backend | P0 | 无 |
| T011 | 用户管理 API（删用户 + 改密码，admin + self 两套端点 + 级联 + 测试）| backend | P0 | 无 |
| T012 | peekview user CLI（delete + password，local+remote，PeekClient+CLI+测试）| backend | P0 | T011 |
| T014 | MCP path_namespace CLI | mcp-server | P0 | 无（已设计）|
| T015 | MCP config verify + unset | mcp-server | P1 | 无（已设计）|

### 第二期：Web UI（人类用户自助，可缓）

| 任务 | 内容 | 包 | 优先级 | 依赖 |
|------|------|-----|--------|------|
| T013 | Web UI 用户管理页 + 设置页改密码/注销 | frontend | P2 | T011 |

**并行说明**：
- T010/T011/T014 可并行（互不依赖）
- T012 依赖 T011（API 稳定后再做 CLI）
- T015 独立
- T013（Web UI）依赖 T011，第二期再做

**任务粒度说明**：
- T011：高风险（级联删除 + 磁盘文件清理 + admin/self 双权限），独立验收，gate = pytest 全绿
- T012：CLI delete + password，含 local 直连和 remote 调 API 两条路径
- T010/T014/T015：小任务，改动集中，风险低

**范围聚焦**：本路线图只补「改密码 + 删用户」两个真实缺口，不做全套 user CRUD。
promote/demote/disable/enable/list 的 remote 化属于「顺带补全」，无痛点，不做（见第六节）。

---

## 五、peekview user 命令组认证设计

**local 模式**：直连 DB，无需认证。
能在机器上执行命令本身就代表有权限（和现有 create/promote/demote 行为一致，不破坏现有习惯）。
边注：多人共用机器的场景在 PeekView 的个人/小团队定位下极少见，不为此场景增加复杂度。

**remote 模式**：复用现有认证机制，不引入新环境变量。
```
认证优先级（从高到低）：
1. --remote-url 参数（同时触发 remote 模式）
2. 环境变量 PEEKVIEW_REMOTE__URL（已有）
3. config 文件 remote.url（已有）
```

remote 模式下 `config.remote.api_key` 就是管理员 key——管理员用户生成的 `pv_` key 自然有 admin 权限，API 返回 403 时 CLI 提示「需要管理员账号生成的 API Key」。

**peekview admin 命令组**：保持现有职责（stats/cleanup），不涉及用户 CRUD。

---

## 六、明确不做的事（边界声明）

以下功能**有意不做**，避免 Agent 或维护者看到缺口就去填：

| 功能 | 不做的理由 |
|------|-----------|
| MCP `list_entries` 过滤参数 | 伪需求——Agent 协作是 URL 直传，不需要「发现」内容 |
| `peekview register` CLI | 低频，Web UI 可注册 |
| `peekview download` CLI | Agent 不需要（web_fetch 够用），人类用 Web UI |
| `peekview whoami` CLI | `peekview admin stats` 已含用户信息 |
| user promote/demote/disable/enable 的 remote 化 | 无痛点，「顺带补全」不做；真有需求时 local 直连 DB 可解决 |

**移入 backlog（无痛点，需要时再捞）**：
- `peekview raw <slug>` CLI（本地运维便利，web_fetch+/raw 已覆盖核心场景）
- `peekview entry update` CLI（低频，Agent 直接调 API 更自然）

---

## 七、与 cli-api-completeness.md 的关系

`docs/plans/cli-api-completeness.md` 已标注过时（见该文件头部）。

**继承的内容**：
- 现状分析表格（Entry/User/Auth/ApiKey/Admin 资源矩阵）
- T014/T015 编号继承（MCP 任务，在本 plan 保持原编号和含义）
- 开放问题的答案（级联删除、Admin API 路径、username vs id）

**重大调整**（经多轮评审收敛）：
- 优先级逻辑从「API 完整性对称」改为「真实痛点驱动」
- 范围聚焦：只补「删用户 + 改密码」两个真实缺口，不做全套 user CRUD
- 权限模型区分「admin 操作他人」和「用户自助注销/改密码」
- 分两期：第一期 CLI+API（Agent 运维），第二期 Web UI（人类自助）
- 砍掉 list_entries 过滤（伪需求）、raw CLI / entry update（移 backlog）
- 新增 T010（apikey local 解锁，最小代价最大收益）
