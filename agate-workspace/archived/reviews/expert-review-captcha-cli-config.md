# Expert Review: CLI 配置发现能力 + Captcha 配置支持

## 评审提示词

```
角色：Staff Engineer，评审 PeekView CLI 配置系统改进方案。
关注点：
  1. 方案是否完整覆盖了"用户运行 cli help 就知道怎么做"
  2. 是否存在遗漏的边界情况
  3. 是否存在实现层面的风险（类型转换、值展示、向后兼容）
  4. 与 MCP config list 的对齐是否到位
  5. captcha 的"开了就要能用"是否得到保证
```

---

## 发现的问题

### R1: `config set` 类型转换列表缺失 captcha 键

cli.py 第 585-603 行的类型转换是硬编码的键名检测。如果 `captcha_enabled` 被加到 `supported_keys` 但**没有**加到 bool 转换列表（第 594 行），用户执行 `config set auth.captcha_enabled true` 会存入字符串 `"true"`，而 `load_config_file()` 的 YAML 解析可能不会正确解析。

**修正**：在 bool 转换列表添加 `captcha_enabled`, `captcha_exempt_first_user`。在 int 转换列表添加 6 个 `captcha_builtin_*` 键。

---

### R2: `config list` 空文件场景锁死

当前代码（cli.py 第 669-671 行）：
```python
config = load_config_file()
if not config:
    click.echo(f"No configuration set. Config file: {CONFIG_FILE}")
    return
```
如果 config.yaml 不存在或为空，直接返回。但用户刚装完服务，config.yaml 可能只有几行甚至不存在。此时 `config list` 不能展示任何配置——这恰恰是需要引导的时候。

**修正**：`config list` 不依赖 config 文件非空。文件为空时，所有项显示默认值。

---

### R3: `config get` 不使用 `supported_keys`，验证不一致

`config set` 用 `supported_keys` 验证输入 key。`config get` 不走 `supported_keys`，而是用 `get_default()` 的 section 分派。这意味着：
- `config set auth.captcha_enabled true` → 加完 key 后可用
- `config get auth.captcha_enabled` → **已经可用**（不依赖 supported_keys！）

等一下——如果我之前测试 `config get` 还没加 captcha key，能读到吗？

验证：
```python
# config_get 的逻辑
section, key_name = key.split(".", 1)   # ("auth", "captcha_enabled")
value = config.get("auth", {}).get("captcha_enabled", "")  # 文件里没有 → ""
default = get_default("auth", "captcha_enabled")  # PeekConfig() 默认值
```

`get_default("auth", "captcha_enabled")` 走的是 `getattr(defaults.auth, "captcha_enabled")`（cli.py 第 631 行）。但 PeekConfig 的 `auth` 是 PeekAuth 实例。而 `captcha_enabled` 是 PeekAuth 的 Field。`getattr()` 可以读到——它读的是实例属性值（`False`）。

所以 `config get auth.captcha_enabled` **已经能用**！只是 `config set` 被 `supported_keys` 挡了。

**结论**：这不是 bug，但 `config get` 和 `config set` 的验证机制不一致很混乱。建议统一：两个都用 `supported_keys`，或都不用。

---

### R4: `base_url` 特殊处理不一致

`supported_keys` 列表第 552 行有 `"base_url"`（非嵌套格式），但所有其他 key 都是 `section.key` 格式。`config_set` 的逻辑：
```python
section, key_name = key.split(".", 1) if "." in key else ("server", key)
```
`base_url` 没有点号，所以映射到 `section="server", key_name="base_url"`。

但在新 `config list` 中按 section 分组展示时，`base_url` 应该出现在 server 段里，而 supported_keys 里它写的是 `"base_url"` 不是 `"server.base_url"`。

**修正**：`supported_keys` 中的 `"base_url"` 改为 `"server.base_url"`。`config_set` 中 `"." in key` 的分支自然处理。向后兼容：`config file` 中 base_url 已经是 `server.base_url`，读旧文件不受影响。

---

### R5: `supported_keys` 提取为模块级后面临修改风险

从函数内部提取到模块级后，`supported_keys` 变为可变全局状态（list）。虽然没有代码会修改它，但这是一个潜在风险——如果有代码 `supported_keys.append(...)`，所有后续调用都受影响。

**修正**：使用 `tuple` 而非 `list`（不可变）。

---

### R6: config list 展示 List 类型值的格式

`cors_origins` 和 `allowed_paths` 是 list 类型。在 config.yaml 中：
```yaml
cors_origins:
  - http://localhost:5173
  - https://peek.example.com
```

当 PyYAML 读回时，它们是 Python list。`click.echo(f"  cors_origins: {value}")` 会输出 `cors_origins: ['http://localhost:5173', 'https://peek.example.com']`。

MCP 的 `allowed_paths` 显示为 `/tmp:/home/kity`（冒号分隔）。peekview 是 list，用 Python 默认的 `repr(list)` 不好看。

**修正**：list 类型值用逗号分隔展示。对齐 MCP 风格。

---

### R7: captcha "开了就要能用" 验证不充分

方案验证场景缺少关键一步：**开启 captcha 后，前端 login 页确实显示 captcha 组件**。当前只验证了 API 端点。

**补充验证**：
```bash
peekview config set auth.captcha_enabled true
peekview service restart
curl http://127.0.0.1:13001/api/v1/config/captcha  # → enabled: true
curl http://127.0.0.1:13001/                        # 检查前端页面
# 浏览器打开登录弹窗 → captcha widget 可见
curl -X POST http://127.0.0.1:13001/api/v1/captcha/challenge  # → 验证码服务正常
```

---

### R8: 默认值展示的"假值"问题

PeekConfig 中 `captcha_enabled` 默认 `False`，显示为 `(not set, default: false)`。

但 `rate_limit_enabled` 默认 `True`，显示为 `(not set, default: true)`。

如果用户从未修改过任何配置，`config list` 会显示 30+ 个 `(not set, default: xxx)`。这是对的——这些值反映的就是当前运行态。但 MCP 的做法更好：直接显示 `value`（不管是默认值还是文件值），不标注"未设置"。因为对用户来说，**默认值就是当前值**。

**讨论**：两者都合理。(not set) 标注的好处是用户知道哪些值可以删掉恢复默认。直接显示值的好处是更简洁。建议保留 MCP 风格（直接显示值），简化输出。

---

## 评审总结

| 序号 | 问题 | 严重级别 | 方案是否覆盖 |
|------|------|---------|------------|
| R1 | captcha 键的类型转换缺失 | 🔴 | ❌ 需补充 |
| R2 | config list 空文件锁死 | 🟡 | ❌ 需补充 |
| R3 | config get/set 验证不一致 | 🟡 | ✅ 已知，不修 |
| R4 | base_url 格式不一致 | 🟡 | ❌ 需补充 |
| R5 | supported_keys 可变风险 | 🟢 | ❌ 需补充（tuple） |
| R6 | list 类型值展示格式 | 🟢 | ❌ 需补充 |
| R7 | captcha 验证不充分 | 🟡 | ❌ 需补充 |
| R8 | 默认值标注风格 | 🟢 | 建议改为 MCP 风格 |
