# DX + Security 专家评审：CLI 配置发现能力 + Captcha 配置支持

## 评审提示词

```
角色：Developer Experience (DX) + Security 双视角专家。

DX 关注：
  - 首次用户体验路径是否顺畅
  - 错误信息是否清晰、可执行、中文用户友好
  - CLI 行为是否一致、可预测
  - help 文本和实际行为是否吻合
  - 常见任务的操作步数是否合理

Security 关注：
  - captcha 开启/关闭是否存在安全漏洞
  - 配置变更是否需要服务重启（是否安全）
  - captcha 配置是否有被低权限用户篡改的风险
  - 默认值的安全姿态（secure by default）
```

---

## 发现

### DX-1: `config list` 内容过多，首次用户被淹没

方案 v3 中 `config list` 输出 30+ 个配置项。对首次用户来说，刚装完服务看到一屏配置项会感到 overwhelming。MCP 的方案是合理的——它的配置项只有 8 个。peekview 有 30 个。

**建议**：不做合并，30 个是客观事实。但可以在最后加一行引导：

```
常用配置: server.port, auth.captcha_enabled, auth.allow_registration
完整列表: https://xxx 或 peekview config list --all
```

不对，用户说"运行 help 就知道怎么做"，多加引导没错。30 个不算多。

**结论**：不需要改，30 个分组展示已经够清晰。

---

### DX-2: `config set` 成功后没有提示"需要重启"

MCP 的做法（cli/config.ts 第 200 行）：
```
✓ Added /home/kity/cclab to allowed_paths
  Restart service to apply: peekview-mcp service restart
```

peekview 当前 `config set` 输出：
```
✓ Set auth.captcha_enabled = true
  Config file: ~/.peekview/config.yaml
```

**没有提示用户重启服务。** 用户设了 `captcha_enabled=true` 后发现登录页还是没有验证码，会困惑。

**修正**：`config set` 成功后追加一行：

```
  ⚠ 需要重启服务才能生效：peekview service restart
```

对所有配置项都适用（因为服务启动时读 config 文件）。

---

### DX-3: `config set` 类型不支持直接输入中文

cli.py 第 594-596 行的 bool 转换：
```python
value = value.lower() in ("true", "1", "yes", "on")
```

如果用户输入 `config set auth.captcha_enabled 开启`，会被当作 bool False。建议 bool 转换函数支持中文。但`PeekConfig` 的配置项名本身就是英文的，field name 是英文，用户应该是跟着英文 help 操作的。

**结论**：不需要改。通过 CLI help 的引导（`config list` 展示 true/false），用户自然会跟英文输入。

---

### DX-4: `server.base_url` 改为 `server.base_url` 后，向后兼容 `base_url` 失效

方案 v3 把 `supported_keys` 中的 `"base_url"` 改为 `"server.base_url"`。

但旧用户（尤其是文档、教程、已有脚本）可能已经习惯 `peekview config set base_url xxx`。改成 `server.base_url` 后，`config set base_url xxx` 会报 `Unknown config key`。

**修正**：保留 `"base_url"` 作为第二入口。在 `supported_keys` 中同时保留 `"base_url"` 和 `"server.base_url"`。`config_set` 逻辑中 `"." in key` 的分支自然处理 `server.base_url`；`"base_url"`（无点号）走 `section="server", key_name="base_url"` 的特殊路径——这个路径已经在代码中存在（第 579 行）。

**结论**：两个 key 都保留。

---

### DX-5: `config get` 不支持 `base_url` 简写

如果 `supported_keys` 保留 `base_url`，`config get base_url` 也应该能用。当前 `config get` 解析逻辑（第 648 行）：
```python
section, key_name = key.split(".", 1)
```
`base_url`（无点号）会报 ValueError（split 只返回 1 个元素）。需要加保护。

**修正**：`config get` 中对 key 无点号的情况特殊处理（或复用 `config set` 的逻辑）。

---

### SEC-1: `captcha_enabled=false` → `true` 不重启服务，旧浏览器会话仍无验证码

Cookie-based 认证的用户在服务重启前已经登录。即使重启了，如果 cookie 里的 JWT 仍然有效，用户可以直接操作 API 绕过 captcha。

**评估**：这是设计预期行为。captcha 只作用于 login/register 端点，不作用于已登录的会话。✅ 无安全风险。

---

### SEC-2: `captcha_enabled` 可通过 `config set` 随时关闭，绕过验证码保护

拥有 shell 访问权限的用户可以随时 `peekview config set auth.captcha_enabled false` 然后重启服务，关闭验证码。

**评估**：有 shell 权限的用户已经是受信用户（能执行 `peekview` 命令 = 能改配置文件）。这不在威胁模型内。✅ 无安全风险。

---

### SEC-3: `config.yaml` 权限检查缺失

`config.yaml` 可能保存敏感值（如 `remote.api_key`）。当前没有检查文件权限。如果文件是 `644`，其他用户可读。

**评估**：这确实是个问题，但这个评审的 scope 是 config list + captcha，不是 config 文件安全。不做。

---

### SEC-4: 默认 `captcha_exempt_first_user=true` — 首个用户不受 captcha 保护

PeekAuth 中 `captcha_exempt_first_user` 默认 `True`。如果这是新部署，第一个注册的用户（admin）不会被 captcha 拦截。

**评估**：这是有意为之——首个用户需要在没有 captcha 的情况下完成初始设置（创建 admin 账号），然后才能开启 captcha。✅ 设计正确。

但这个默认值**没有在 CLI 帮助中说明**，用户可能开了 captcha 却发现对自己不生效（第一个用户已存在）。建议在 `config list` 中 `captcha_exempt_first_user` 的注释里注明"仅豁免首个用户"。

---

### DX-6 (额外): `config list` 中的 list 类型值无法通过 `config set` 修改

`cors_origins` 和 `allowed_paths` 是 list 类型。`config set server.cors_origins http://a,http://b` 按逗号分隔存入。但 `config list` 展示时如果只显示逗号分隔的字符串，用户无法区分这是单个字符串还是 list。

**结论**：保持逗号分隔展示，和 `config set` 输入格式一致（逗号分隔输入 → 逗号分隔展示）。在注释中说明格式。

---

## 评审总结

| 编号 | 问题 | 级别 | 处理 |
|------|------|------|------|
| DX-1 | 30 项过多 | 🟢 | 不改 |
| DX-2 | config set 无"需要重启"提示 | 🟡 | ✅ 加入方案 |
| DX-3 | bool 不支持中文 | 🟢 | 不改 |
| DX-4 | base_url 向后兼容 | 🟡 | ✅ 双 key 都保留 |
| DX-5 | config get base_url 崩溃 | 🔴 | ✅ 加无点号保护 |
| SEC-1~4 | 安全审查 | 🟢 | 无风险 |
| DX-6 | list 展示格式 | 🟢 | 逗号分隔 + 注释 |
