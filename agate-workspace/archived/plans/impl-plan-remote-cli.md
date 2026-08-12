# PeekView 远程 CLI 实现计划

> 版本: 1.0
> 日期: 2026-05-16
> 关联设计文档: `docs/specs/spec-remote-cli.md`

---

## 目标

实现场景2：机器 B/C/D 作为远程客户端，通过 HTTP API 调用机器 A 的 PeekView 服务端。

```
机器 A (pipx install peekview)
└── peekview serve --base-url domain_a.com    # 仅服务端

机器 B (pipx install peekview)
└── peekview create file.txt -s "My code"      # 客户端 → HTTP POST 到机器 A
```

---

## 任务清单

### T1: 配置层扩展 (`config.py`)

**目标**: 新增 `PeekRemote` 配置组，支持远程服务端配置。

**文件**: `backend/peekview/config.py`

**实现步骤**:
- [ ] 1.1 创建 `PeekRemote` 类（`url`, `api_key`, `timeout`, `verify_ssl`）
- [ ] 1.2 在 `PeekConfig` 中添加 `remote: PeekRemote` 字段
- [ ] 1.3 添加配置验证：URL 格式校验（可选）

**验收标准**:
```python
config = PeekConfig()
assert config.remote.url == ""
assert config.remote.timeout == 30
assert config.remote.verify_ssl == True
```

---

### T2: HTTP 客户端实现 (`client.py`)

**目标**: 新建 `PeekClient` 类，封装 HTTP API 调用。

**文件**: `backend/peekview/client.py`（新建）

**实现步骤**:
- [ ] 2.1 定义 `RemoteEntry` 和 `RemoteFile` namedtuple
- [ ] 2.2 实现 `PeekClient.__init__()`（接收 base_url, api_key, timeout, verify_ssl）
- [ ] 2.3 实现 `_parse_entry()` 方法（JSON → RemoteEntry）
- [ ] 2.4 实现 `create_entry()` → POST /api/v1/entries
- [ ] 2.5 实现 `list_entries()` → GET /api/v1/entries
- [ ] 2.6 实现 `get_entry()` → GET /api/v1/entries/{slug}
- [ ] 2.7 实现 `delete_entry()` → DELETE /api/v1/entries/{slug}
- [ ] 2.8 所有请求添加 `verify=self.verify` 参数
- [ ] 2.9 添加错误处理：HTTP 状态码映射为友好错误消息

**验收标准**:
```python
client = PeekClient("https://example.com", api_key="sk-xxx")
entry = client.create_entry(summary="Test", files_data=[...])
assert entry.url == "https://example.com/xxx"
assert entry.slug is not None
```

---

### T3: CLI 层改造 (`cli.py`)

**目标**: 统一本地/远程模式入口，支持 `--remote-url` 参数。

**文件**: `backend/peekview/cli.py`

**实现步骤**:
- [ ] 3.1 新增 `_get_backend(config, cli_remote_url)` 函数
  - 优先级：CLI 参数 > 环境变量 > 配置文件
  - 空字符串视为禁用远程
- [ ] 3.2 修改 `create` 命令：
  - [ ] 添加 `--remote-url` 选项
  - [ ] 使用 `_get_backend()` 获取 backend
  - [ ] 远程模式：目录扫描在 CLI 层完成（调用 `scan_directory_local`）
  - [ ] 远程模式：禁用 `local_path`，报错提示
  - [ ] 远程模式：二进制文件检测，报错退出
  - [ ] 远程模式提示：`→ Remote mode: {url}`
- [ ] 3.3 修改 `list` 命令：
  - [ ] 添加 `--remote-url` 选项
  - [ ] 使用 `_get_backend()` 获取 backend
  - [ ] 处理 `EntryListResponse` 结构（含分页信息）
- [ ] 3.4 修改 `get` 命令：
  - [ ] 添加 `--remote-url` 选项
  - [ ] 使用 `_get_backend()` 获取 backend
- [ ] 3.5 修改 `delete` 命令：
  - [ ] 添加 `--remote-url` 选项
  - [ ] 使用 `_get_backend()` 获取 backend
- [ ] 3.6 扩展 `config` 命令支持 remote 配置：
  - [ ] `config set remote.url {url}`
  - [ ] `config set remote.api_key {key}`
  - [ ] `config set remote.timeout {seconds}`
  - [ ] `config get remote.url`

**验收标准**:
```bash
# 测试本地模式（无变化）
peekview create file.txt -s "Local test"

# 测试远程模式（CLI 参数）
peekview create file.txt -s "Remote test" --remote-url https://example.com

# 测试远程模式（配置）
peekview config set remote.url https://example.com
peekview create file.txt -s "Remote via config"

# 测试目录扫描远程模式
peekview create src/ -s "Project" --remote-url https://example.com
```

---

### T4: 目录扫描工具函数

**目标**: 实现本地目录扫描，供远程模式使用。

**文件**: `backend/peekview/cli.py`（或新建 `utils.py`）

**实现步骤**:
- [ ] 4.1 实现 `scan_directory_local(base_path, ignored_dirs) -> list[dict]`
  - 递归遍历目录
  - 跳过 `ignored_dirs`
  - 读取文件内容为文本
  - 二进制文件跳过并警告
  - 返回 `files_data` 格式列表

**验收标准**:
```python
files = scan_directory_local(Path("src/"), {".git", "__pycache__"})
assert all("path" in f and "content" in f for f in files)
```

---

### T5: 单元测试 (`test_client.py`)

**目标**: 测试 `PeekClient` 的各个方法。

**文件**: `backend/tests/test_client.py`（新建）

**实现步骤**:
- [ ] 5.1 使用 `responses` 或 `unittest.mock` mock HTTP 请求
- [ ] 5.2 测试 `create_entry` 成功/失败场景
- [ ] 5.3 测试 `list_entries` 返回分页结构
- [ ] 5.4 测试 `get_entry` 404 处理
- [ ] 5.5 测试 `delete_entry` 成功场景
- [ ] 5.6 测试 API Key 认证头正确发送
- [ ] 5.7 测试 `_parse_entry` 字段解析正确

**验收标准**:
```bash
cd backend && python -m pytest tests/test_client.py -v
# 所有测试通过
```

---

### T6: CLI 远程模式集成测试 (`test_cli_remote.py`)

**目标**: 测试 CLI 远程模式完整流程。

**文件**: `backend/tests/test_cli_remote.py`（新建）

**实现步骤**:
- [ ] 6.1 启动本地测试服务端（`make debug-start` 或 fixture）
- [ ] 6.2 测试 `create` 远程模式成功创建条目
- [ ] 6.3 测试 `list` 远程模式列出入库
- [ ] 6.4 测试 `get` 远程模式获取详情
- [ ] 6.5 测试 `delete` 远程模式删除条目
- [ ] 6.6 测试目录扫描远程上传
- [ ] 6.7 测试二进制文件报错退出
- [ ] 6.8 测试 `local_path` 远程模式报错
- [ ] 6.9 测试 401 认证失败提示
- [ ] 6.10 测试连接失败提示

**验收标准**:
```bash
cd backend && python -m pytest tests/test_cli_remote.py -v
# 所有测试通过
```

---

### T7: 文档更新 (`README.md`)

**目标**: 更新用户文档，说明远程 CLI 使用方法。

**文件**: `README.md`

**实现步骤**:
- [ ] 7.1 在"CLI 用法"章节添加远程模式说明
- [ ] 7.2 添加配置示例：
  ```yaml
  remote:
    url: https://domain_a.com
    api_key: sk-xxx
  ```
- [ ] 7.3 添加使用示例：
  ```bash
  # 配置远程服务端
  peekview config set remote.url https://domain_a.com
  
  # 创建条目（自动使用远程模式）
  peekview create file.txt -s "My code"
  
  # 临时指定远程服务端
  peekview create file.txt -s "My code" --remote-url https://other.com
  ```
- [ ] 7.4 添加限制说明：
  - 远程模式仅支持文本文件
  - 远程模式不支持 `local_path`
  - 目录扫描在本地完成

**验收标准**:
- README 包含远程 CLI 完整使用说明
- 示例命令可直接复制运行

---

## 依赖关系

```
T1 (config)
  ↓
T2 (client) ← T4 (scan_local)
  ↓
T3 (cli)
  ↓
T5 (test_client) ← T2
T6 (test_cli_remote) ← T3, T5
  ↓
T7 (README)
```

---

## 实现顺序建议

1. **T1** → **T4** → **T2** → **T3**（核心功能）
2. **T5** → **T6**（测试）
3. **T7**（文档）

---

## 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 目录扫描大目录慢 | 用户体验差 | 添加进度条或 `--verbose` 选项 |
| 大文件内存占用高 | OOM | 添加文件大小预检查，拒绝 >10MB 文件 |
| API 兼容性变化 | 客户端失效 | 版本协商或严格错误处理 |
| SSL 证书问题 | 连接失败 | 清晰的错误提示和 `--verify-ssl=false` 选项 |

---

## 验收清单（整体）

- [ ] 机器 B 配置 `remote.url` 后，`create` 自动使用远程模式
- [ ] 机器 B `create file.txt` 成功，URL 显示为 `domain_a.com/xxx`
- [ ] 机器 A 浏览器访问该 URL，内容正确显示
- [ ] 机器 B `list` 显示机器 A 上的所有条目
- [ ] 机器 B `delete` 可删除机器 A 上的条目
- [ ] 本地模式行为无变化（向后兼容）
- [ ] 所有单元测试通过
- [ ] 所有集成测试通过
