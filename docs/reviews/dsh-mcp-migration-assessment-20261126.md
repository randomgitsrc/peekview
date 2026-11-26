# DSH 0.2.3-alpha.2 MCP 插件迁移评估

> 日期：2026-11-26
> 触发：用户指出「dsh 新版变化——`mcp-manager` 和 `mcp-account` 是 alpha.2 新挂载的（dump 第 552、556 行），而 3 个 MCP 走的是旧的 `mcp-client` 直连方式，没有注册到 mcp-manager」并要求核实是否需要适配
> 结论：**不需要迁移**。当前配置在新版下完全合法，且是官方文档明确建议保留的场景

---

## 一、核实结果

| 项 | 事实 | 证据 |
|---|---|---|
| DSH 版本 | `0.2.3-alpha.2` | `packages/../package.json` |
| `mcp-client` 是否废弃 | **否**，同版本 `0.2.3-alpha.2` 正式包 | `packages/mcp/mcp-client/package.json` |
| `mcp-manager` / `mcp-account` 由谁挂载 | **web-app bundle 自带**，非用户 profile | `packages/bundle/web-app/cordis.patch.yml:159-166` |
| 用户 profile 是否缺 manager 行 | **不缺**——本就不该有 | `~/.dsh/profiles/web/cordis.patch.yml` 无 mcp-manager |
| 3 个 MCP 运行状态 | **全部正常** | 本会话 `mcp__peekview__*` / `mcp__pwtest__*` / `mcp__pwuser__*` 工具可用 |

### 1.1 web-app bundle 的实际挂载

```yaml
# packages/bundle/web-app/cordis.patch.yml:159-166
- id: mcp-manager
  name: '@deepseek-ai/dsh-mcp-manager'
  inject: [credentials]

- id: mcp-account
  name: '@deepseek-ai/dsh-mcp-account'
```

注意：**manager 没有 `config.servers`**——它的默认是 `z.dict(ServerEntrySchema).default({})`（`mcp-manager/src/index.ts:144`），即空 fleet。

---

## 二、核心结论：两种方式是官方并存的合法选择

`mcp-manager` README 第 32 行原文：

> Choose the manager when the server set changes at runtime: a settings edit or a management surface adds, reconfigures, disables, or deletes configured servers, or an installed plugin brings its own server.
> **Keep plain `dsh-mcp-client` rows instead when a deployment pins its servers in the composition**, or when a server belongs to one agent preset rather than the whole Host; **the manager governs the global plane only**.

用户的 3 个 MCP 正属第一类豁免：**服务集在 composition 中固定**。

### 2.1 用户的配置形态

| server | transport | 特征 |
|---|---|---|
| `mcp-peekview` | streamable-http | 固定 `127.0.0.1:13003/mcp`，key 从 `~/.peekview/mcp-config.yaml` 运行时读取 |
| `mcp-pwtest` | stdio | 固定 `npx -y @playwright/mcp@0.0.80`（自启动干净浏览器） |
| `mcp-pwuser` | stdio | 同上 + `--cdp-endpoint 127.0.0.1:18800`（attach 真 Chrome） |

三者都**不需要运行时增删改**，无 OAuth。

---

## 三、manager 路线为何不划算

### 3.1 收益几乎为零

| 能力 | 现状（mcp-client 直连） | 迁到 manager | 对本场景价值 |
|---|---|---|---|
| 运行时增删改 | 改 YAML + 重载 | Settings 点击 | 3 个固定 server，**不常改** |
| 状态查看 / 重连 / restart | 无界面 | `ctx.mcpManager.list()` / `status` / `restart` | 当前 3 个都稳定运行 |
| OAuth 授权 | 不支持 | 支持 | **本场景无 OAuth** |
| probe 探测 | 无 | `probe(name)` | 非必需 |

### 3.2 迁移成本：不止是格式转换

**障碍 A：`headers` 只接受 `${credential:REF}`，不接受任意 JS**

现状 `mcp-peekview` 的 Authorization 用了内联 JS：

```yaml
Authorization: !!js '`Bearer ${process.getBuiltinModule("node:fs").readFileSync("/home/kity/.peekview/mcp-config.yaml","utf8").split(/\r?\n/).find((l) => l.trim().startsWith("api_key"))...}`'
```

而 manager 的 schema 是：

```ts
// packages/mcp/mcp-manager/src/index.ts:103
headers: z.dict(String).default({}),
```

`!!js` 的标签在 YAML 层被保留为原始字符串（`packages/boot/plugin-manager/src/patch.ts:35`：`customTags: [{ tag: 'tag:yaml.org,2002:js', resolve: (value: string) => value }]`），由 loader 在挂载前求值——**但求值时机在 schema 验证之后**。所以把这段 JS 塞进 `servers.<name>.headers` 会先撞 `z.dict(String)` 的类型校验。

**官方支持的替代是 `${credential:REF}`**，需要：① 把 API key 从 `~/.peekview/mcp-config.yaml` 搬进 `~/.dsh/.credentials.yaml` ② 改成 `Authorization: 'Bearer ${credential:PEEKVIEW_MCP_KEY}'`。

⇒ **这是一次凭据搬迁**，不只是格式调整。

**障碍 B：两个 Playwright MCP 的 stdio 配置**

这部分格式可直接平移（`command` / `args` / `cwd` / `env` 字段名一致），成本低。

### 3.3 manager 自身的已知限制

README「Known Limitations」原文：

> **Global plane only** — instances mounted by agent presets or static `cordis.yml` rows are **neither listed nor governed**; a static instance shows up only as a `serverName` collision when a managed entry tries to reuse its name.

即：**保留直连的 server 不会出现在 manager 的列表里**。这解释了用户观察到的「没注册到 mcp-manager」——但这是设计使然，不是故障。

> **A rebuild has a tool gap** — a changed entry is disposed and remounted, so its tools disappear from the model's set until the new instance finishes its initial sync.

---

## 四、真实存在的认知负担（值得记录，但不是缺陷）

manager 已由 web-app 挂载但 fleet 为空，导致：

1. **Settings → MCP 页面是空的**（`servers` 默认 `{}`）
2. **改动那 3 个直连 server 不会反映在任何 GUI 里**
3. **若将来从 Settings 添加新 MCP，它会走 manager** → 与新加的 manager 管理的 server 并存**两套平面**：
   - 直连 plane：看得到工具、看不到状态
   - managed plane：看得到状态、可在 GUI 改

**这不是不兼容**，是「同一个 GUI 里 MCP 有两类来源」的认知成本。对 3 个固定 server 而言，这个成本低于迁移收益。

---

## 五、建议

### 结论：不迁移

理由：
1. 3 个固定 server，无 OAuth，不常改 → manager 收益近零
2. 迁移需搬 API key 到 credentials provider（**凭据搬迁**），引入新依赖
3. 官方文档明确支持「composition 固定 → 保留 mcp-client」

### 若将来要统一，前置条件

| 步骤 | 说明 |
|---|---|
| 1 | 把 `~/.peekview/mcp-config.yaml` 的 API key 迁入 `~/.dsh/.credentials.yaml`（**需用户明确授权**） |
| 2 | 在 profile 给 `id: mcp-manager` 加 `config.servers`，3 段重写为 `servers.<name>` 格式 |
| 3 | 删除原 3 段 `- insert:` 的 `mcp-client` 行 |
| 4 | 验证：`mcp__peekview__*` 等工具仍可用 + Settings MCP 页能看到状态 |

### 何时该迁

- 需要在 GUI 里查看/重启 MCP 状态
- 需要运行时增删 MCP server
- 需要 OAuth（但注意：README 说 OAuth 登录只对**插件注册**的 server 有效，`mcp-account` 只显示 Plugins 页账号）
- 直连 server 数量增长到「改 YAML 变得难以维护」

---

## 六、验证边界

| 项 | 状态 |
|---|---|
| DSH 版本、包版本 | 源码直读 |
| web-app 挂载位置 | 源码直读（`cordis.patch.yml:159-166`） |
| manager schema 的 `headers` 类型 | 源码直读（`index.ts:103`） |
| `!!js` 的求值机制 | 源码直读（`patch.ts:35` 的 customTags resolve） |
| 3 个 MCP 工具可用 | **本会话实测**（工具前缀存在且可调用） |
| Settings MCP 页面为空 | **源码确认**：`servers: z.dict(...).default({})`（`mcp-manager/src/index.ts:144`）——无配置时 fleet 为空。GUI 未打开验证（本机 pwtest/pwuser 访问均 401），但默认值语义确定 |
| `!!js` 在 `servers.headers` 下是否失败 | **未实测**（基于 `headers: z.dict(String)` + `!!js` 求值时机的推断；未构造失败用例。**若将来迁移必须先测这一条**） |

---

## 附：相关源码位置

| 内容 | 路径 |
|---|---|
| web-app 的 manager / account 挂载 | `packages/bundle/web-app/cordis.patch.yml:159-166` |
| manager 的 servers schema | `packages/mcp/mcp-manager/src/index.ts:95-107, 144` |
| manager README（选型与限制） | `packages/mcp/mcp-manager/README.md:32, 34-75, Known Limitations` |
| `!!js` customTag 定义 | `packages/boot/plugin-manager/src/patch.ts:35` |
| 用户 profile 的 3 个 MCP 定义 | `~/.dsh/profiles/web/cordis.patch.yml`（`mcp-peekview` / `mcp-pwtest` / `mcp-pwuser`） |
