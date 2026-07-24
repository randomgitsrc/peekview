# P1 Progress — T070

## Session: 2026-07-25


### Read: P0-brief.md
- 11 项问题清单：3 代码 bug + 2 功能缺失 + 5 文档错误 + 1 工具描述不足
- 改动范围：packages/mcp-server/ + 根 README.md + backend/README.md
- 裁剪倾向：P1/P3/P6/P7/P8 必走，P2 可简化

### Read: publishFiles.ts L338-346
- CWD guard bug 确认：L339 `path.resolve(cwd) === path.parse(cwd).root` 时直接返回错误
- 错误信息说"未配置 allowed_paths"，但实际不检查 config.allowedPaths 是否已配置
- L355-356: allowedPaths 配置后本应走 allowed_paths 分支，但 guard 在此之前拦截

### Read: server.ts L231-266
- /health 端点已存在！返回 status/version/peekview/config 信息
- Dockerfile L21-22 已使用 wget http://localhost:33333/health
- **P0-brief 问题 5 应降级或移除**——/health 已存在且 Dockerfile 已使用

### Read: cli/config.ts L140-205
- config list 已存在，显示文件配置
- 但不显示运行时 cwd、不显示 env 覆盖后的最终生效值
- config verify 也已存在（L423-510），验证连通性+认证，但不测试 allowed_paths 文件可读性

### Read: merge.ts L78-83
- allowed_paths 解析：env 用冒号 split，file 用 .map（假设数组）
- YAML 文件手写冒号分隔字符串 → .map is not a function
- 根因：fileConfig.server.allowed_paths 期望数组，YAML 字符串无 .map 方法

### Read: cli/config.ts L415-510 (config verify)
- config verify 已存在：验证配置文件存在 + peekview.url 格式 + 连通性 + api_key 认证
- 不验证 allowed_paths 文件可读性
- 不显示运行时 cwd/mode/allowed_paths 最终生效值

### Read: mcp-server/README.md (full)
- L96-100: "容器路径自动翻译为主机路径" — 错误！namespace 是 Agent 侧短路径别名
- L169: "冒号分隔" 未区分 YAML 数组 vs 环境变量
- L353-372: Docker 示例暗示 path_namespaces 做路径翻译，实际 volume mount 必须同路径
- L425-441: Docker Compose 用不存在的镜像名 `peekview:latest` 和 `peekview/mcp-server:latest`
- 无 `-w /tmp` 规避说明、无 `--network host` 说明
- L96: "Docker 容器内的 Agent 需声明 namespace" — 误导

### Read: Dockerfile
- 已有 HEALTHCHECK 使用 wget http://localhost:33333/health
- WORKDIR /app（不是 /），所以 Dockerfile 本身不会触发 CWD guard bug
- 但用户 docker run 不设 -w 时默认 WORKDIR=/ 会触发

### Read: README.md (root)
- 只有 pipx 安装，无 Docker 场景指引
- L47-55: MCP 接入只有 Claude Code + 通用 JSON，缺 OpenCode/Cursor 具体示例
- 无 Docker 场景说明

### Read: backend/README.md
- 只有 pip install，无 Docker 场景指引
- 无 MCP Server Docker 部署说明

### Read: config/file.ts
- ConfigFileData 接口定义 allowed_paths 为 string[]（L34）
- YAML.parse 返回的值：如果 YAML 写 `allowed_paths: /a:/b`，解析为字符串而非数组
- merge.ts L82 调用 .map() → 字符串无 .map → 崩溃
- 根因确认：YAML 文件格式问题，不是 CLI config set 的问题（CLI set 写入 YAML 数组格式）

### Key findings summary:
1. P0-brief 问题 5（无健康检查端点）**已过时** — /health 已存在，Dockerfile 已使用
2. P0-brief 问题 4（无诊断命令）需重新定义 — config list/verify 已存在，但缺少运行时 cwd 和 allowed_paths 文件可读性验证
3. allowed_paths 容错根因：YAML 文件手写冒号分隔字符串 → .map is not a function
4. namespace 语义错误确认：README L96-100 描述为"路径翻译"，实际是 Agent 侧短路径别名
5. Docker Compose 用不存在的镜像名
6. 三份 README 均缺 Docker 场景指引
7. 根 README 缺 OpenCode/Cursor 具体接入示例

### Read: publishFiles.ts L280-329 (tool description)
- 工具描述缺：Docker 场景提示（cwd=/ 问题）、错误恢复指引、namespace 使用指引、诊断命令提示
- L296: "Default allowed bases: process.cwd() and os.tmpdir() only" — 但 cwd=/ 时 guard 直接拒绝

### Read: cli/config.ts L60-102 (config set)
- config set 对 allowed_paths 用冒号分隔 split（L83-84），写入 YAML 时为数组格式
- 所以 CLI config set 不会产生冒号分隔字符串问题
- 问题只出在用户手写 YAML 文件时写 `allowed_paths: /a:/b`（字符串而非数组）

### All input files read. Starting requirements analysis.

### P1-requirements.md written
- 21 BDD conditions (BDD-1 through BDD-21)
- 10 implicit requirements identified
- P0-brief question 5 downgraded (health endpoint already exists)
- P0-brief question 4 redefined (enhance existing commands, not new ones)
- [NO_NEED_CONFIRM] declared
- risk_level: medium
- phases: [P1,P2,P3,P4,P5,P6,P7,P8]
- domains: mcp, docs, security
- packages: packages/mcp-server/, README.md, backend/README.md
- capability_requirements: docker-runtime(available), unit-test-runner(available), browser-vision(supplementable)
- No status: GAP entries
- PROD_NOT_TOUCHED
