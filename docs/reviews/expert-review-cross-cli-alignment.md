# 跨 CLI 一致性 + 实现风险评审：peekview & peekview-mcp CLI 对齐 (v4)

## 评审提示词

```
角色：Staff Engineer，评审 peekview 和 peekview-mcp 两套 CLI 配置系统的对齐方案。

特别关注：
  1. 对齐后两套 CLI 的行为是否真正一致
  2. 改动是否引入回归风险
  3. 类型自动检测是否安全（是否会误判合法值）
  4. 默认值硬编码在两个地方是否脆弱
  5. 实现复杂度是否合理
```

---

## 发现

### R1: 类型自动检测的误判风险 (peekview)

方案把 `config set` 的类型转换从硬编码键名改为通用检测：

```python
if value.lower() in ("true", "false"):
    value = value.lower() == "true"
elif value.isdigit():
    value = int(value)
```

**问题场景 A**：`logging.level` 的值是 `"info"`, `"debug"`, `"warn"` 等。`warn` 和 `info` 不会触发误判。`"false"` 不是合法的日志级别，但也不会有人设。✅ 安全。

**问题场景 B**：`server.host` 被设为 `"127.0.0.1"`。这个值包含点号，`isdigit()` 返回 False。但 `"8080"` 作为 host 会触发 `isdigit()` → 被转成 int `8080`。逻辑上讲，host 确实不该是纯数字，但 **如果用户设 `server.host 8080` 想表达 host: 8080（写错了，应该是 port）**，原本会被当作字符串存入 YAML，现在会被转成 int。这改变了行为。

**问题场景 C**：`remote.api_key` 如果恰好全是数字（如 `"1234567890abcdef"`），`isdigit()` 返回 False（有字母）。如果全是数字（如 `"1234567890123456"`），会被转成 int。API key 是字符串，转成 int 丢失前导零。

**结论**：纯自动检测有风险。**MCP 的做法也有这个问题**（MCP 也是 auto-detect），说明这是已知的可接受风险。但 MCP 的配置值类型更简单（基本都是 string + port 是 int）。peekview 有更多混合类型字段。

**修正**：保持混合策略——对已知的 int/bool 键继续硬编码检测，未知键 fallback 到 auto-detect。或者：只对已知键做类型转换，未知键保持字符串。

---

### R2: `base_url` 在 supported_keys 里重复出现导致 `config list` 重复展示

```python
SUPPORTED_CONFIG_KEYS = (
    "base_url",        # 展示时 section="server", key="base_url"
    ...
    "server.base_url", # 展示时 section="server", key="base_url"
    ...
)
```

两个 key 映射到同一个 YAML 路径。`config list` 遍历时会显示两行 `server.base_url`。

**修正**：`config list` 在构建展示列表时去重（按 `(section, key_name)` 去重，保留第一个）。

---

### R3: MCP `config get` 默认值硬编码脆弱

方案让 MCP 的 `config get` 支持默认值回退：

```typescript
const defaults: Record<string, Record<string, unknown>> = {
    server: { port: 33333, host: '0.0.0.0', ... },
    logging: { level: 'info' },
};
```

但这个 `defaults` 对象**已经存在**于 `config list` 的输出逻辑中（第 131-146 行，内联的默认值）。现在需要在 `config get` 中再写一份。

**修正**：提取为模块级常量 `DEFAULT_CONFIG`，`config list` 和 `config get` 共用。避免两份硬编码不同步。

---

### R4: MCP `config get` 无配置文件时显示默认值 — 缺失引导

当前 MCP `config get` 输出：
```
(not set)
```

改为输出默认值后：
```
33333 (default)
```

但如果用户需要知道**如何设置**这个值，当前没有任何引导。peekview 的做法也一样——只显示值。

**讨论**：这不算问题。`config` 命令的 `--help` 已经列出了所有 key 和说明。`config list` 展示了全局视图。用户不需要每个 `config get` 都重复引导。

**结论**：不改。

---

### R5: `config set` 后两边都加了重启提示 — 但提示文案不完全一致

peekview 用中文：
```
⚠ 需要重启服务才能生效：peekview service restart
```

MCP 用英文：
```
⚠ Restart service to apply: peekview-mcp service restart
```

**讨论**：这是合理的差异——peekview 面向中文用户，MCP 面向通用用户。提示信息的作用相同。

**结论**：不改。

---

### R6 (额外): MCP `config set` 没有验证 key 合法性

MCP 的 `config set` 接受任意 `section.key`，不检查 key 是否合法。如果用户输入 `config set server.xyz abc`，会成功写入 config 文件但并不生效（服务忽略未知 key）。peekview 通过 `supported_keys` 做了输入验证。

**讨论**：这是 MCP 的一个 UX 缺陷，应该在本次对齐中修复。但 `supported_keys` 在 MCP 中应该是类似 `config --help` 中列出的 key 列表。

**修正（可选）**：MCP `config set` 中增加 key 合法性检查。如果方案范围太大，可以标记为后续改进。

---

### R7: `config list` 展示 30+ 项时的性能 / 简洁性

peekview 展示 30+ 个配置项，加上注释会很长。MCP 只有 8 个，体验很好。30 个项目多但 manageable——每个 section 3-8 个 key。

**结论**：不改。分组展示已解决问题。

---

### R8: `config set server.allowed_paths` 的输入格式

当前 peekview 用逗号分隔（`config set storage.allowed_paths /a,/b`），MCP 用冒号分隔（`config set server.allowed_paths /a:/b`）。

**修正**：两边统一。peekview 已经用逗号，MCP 已经用冒号。各自保持现有的分隔符即可——用户已经习惯各自的格式。`config list` 展示时用同样的分隔符。

**结论**：不改。

---

## 评审总结

| # | 问题 | 级别 | 处理 |
|---|------|------|------|
| R1 | 类型自动检测可能误判纯数字 host / api_key | 🟡 | 改：混合策略（已知键硬编码 + 未知键 string） |
| R2 | base_url 在 supported_keys 里重复 → config list 展示两次 | 🟡 | 改：去重 |
| R3 | MCP 默认值硬编码在 list 和 get 里两份 | 🟡 | 改：提取为模块常量 |
| R4 | config get 缺引导 | 🟢 | 不改 |
| R5 | 重启提示中英不一致 | 🟢 | 不改 |
| R6 | MCP config set 不验证 key | 🟢 | 后续改进 |
| R7 | 30 项过多 | 🟢 | 不改 |
| R8 | 分隔符不统一 | 🟢 | 不改 |
