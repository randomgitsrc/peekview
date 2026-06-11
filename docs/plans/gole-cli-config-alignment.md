# /gole — CLI 配置体验对齐 + Captcha 配置支持

## peekview backend

- [ ] **1. config.py** — 合并重复 `captcha_secret_key`（删第270-273行，保留第283行）
  - 验证：`grep captcha_secret_key` 只有一行

- [ ] **2. cli.py** — `supported_keys` 提取为模块级 `tuple`，补充 `auth.captcha_enabled`、`auth.captcha_site_key`，保留 `base_url` 向后兼容
  - 验证：`peekview config set auth.captcha_enabled true` 不报 unknown key

- [ ] **3. cli.py** — `config set` 类型转换补 captcha 键（bool 列表加 `captcha_enabled`，int 列表加 `captcha_builtin_*`）
  - 验证：`config set auth.captcha_enabled true` → config.yaml 写入 `true`（布尔值非字符串）

- [ ] **4. cli.py** — `config set` 成功后加 "⚠ 需要重启服务才能生效" 提示
  - 验证：任意 config set 后输出包含 `peekview service restart`

- [ ] **5. cli.py** — 重写 `config list`
  - 按 section 分组展示所有 SUPPORTED_CONFIG_KEYS
  - 文件有值→显示值，无值→显示 PeekConfig 默认值
  - `(section, key_name)` 去重（base_url 不重复展示）
  - list 类型用逗号分隔
  - 空文件继续展示
  - 底部 "Available config keys" 分组列表
  - 验证：`peekview config list` 输出含 captcha 配置 + 所有其他默认值

- [ ] **6. cli.py** — `config get` 修复 `base_url` 无点号崩溃（`"." in key` 保护）
  - 验证：`peekview config get base_url` 不崩溃，显示值或默认值

- [ ] **7. cli.py** — `config --help` 补充可用 key 分组说明
  - 验证：`peekview config --help` 输出含 key 列表

- [ ] **8. 构建前端 + 重启调试服务**
  - `make debug-build && make debug-start`

- [ ] **9. 验证清单**
  - `peekview config list` 展示全量配置
  - `peekview config set auth.captcha_enabled true` + 重启提示
  - `peekview config get auth.captcha_enabled` → 显示值
  - `peekview config get base_url` → 不崩溃
  - `curl /api/v1/config/captcha` → `enabled: true`
  - 前端登录页 → captcha widget 可见
  - 后端全量测试通过

## peekview-mcp

- [ ] **10. config.ts** — 提取 `DEFAULT_CONFIG` 模块常量
  - 验证：`grep -n DEFAULT_CONFIG` 在 list 和 get 里引用同一常量

- [ ] **11. config.ts** — `config get` 默认值回退
  - 验证：`peekview-mcp config get server.port` → `33333 (default)` 而非 `(not set)`

- [ ] **12. config.ts** — `config get` 无配置文件不报错
  - 验证：临时移走 `mcp-config.yaml` → `config get` 不报错，显示默认值

- [ ] **13. config.ts** — `config set` 成功后加重启提示 + 文件路径
  - 验证：`config set server.port 13003` → 输出含 `peekview-mcp service restart` + `mcp-config.yaml`

- [ ] **14. 构建 + MCP 单元测试**

- [ ] **15. 后端全量测试 + E2E**

- [ ] **16. 提交 + push**
