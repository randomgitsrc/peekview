# P2 Progress — T070

## Input File Read Log

### 1. P2-dispatch-context-architect.md
- Key: CWD guard bug follows_existing_pattern, allowed_paths容错 design_trivial, 诊断增强需设计但1候选即可
- Key: 改动范围仅 packages/mcp-server/ + 根README.md + backend/README.md

### 2. P0-brief.md
- 11项问题清单，9项调整后保留
- env_constraints: debug_env="make debug; MCP单测: cd packages/mcp-server && npm run test:unit"
- 不改后端/前端代码

### 3. P1-requirements.md
- 24条BDD验收条件
- 9项调整后问题清单
- domains: [mcp, docs, security], risk_level: medium

### 4. publishFiles.ts (L338-346)
- CWD guard: `if (path.resolve(cwd) === path.parse(cwd).root)` 无条件拒绝
- 不检查 allowedPaths 或 trustAllPaths
- 错误信息: "未配置 allowed_paths" — 误导，实际是 cwd=/ guard 触发

### 5. merge.ts (L78-83)
- allowed_paths 解析: L82 `fileConfig.server.allowed_paths.map(expandHome)` 假设数组
- YAML字符串输入 → .map() 崩溃
- 修复位置明确: mergeConfig 函数中加类型检查

### 6. server.ts (L231-266)
- /health 已存在，返回 status/version/peekview/config
- config 含 source/path/peekview_url/public_url/api_key_configured
- 缺 cwd/mode/allowed_paths 字段

### 7. cli/config.ts
- configListAction() L141-193: 只读文件配置，不调 mergeConfig
- verifyAction() L425-498: 只验证连通性+认证，不测 allowed_paths 可读性
- config set L83-84: allowed_paths 用冒号分隔解析为数组（CLI路径OK）

### 8. config/file.ts
- loadConfigFromFile: YAML.parse → 直接返回，无类型校验
- ConfigFileData: allowed_paths?: string[] — 类型声明为数组但YAML解析可能返回字符串

### 9. mcp-server/README.md
- L96-100: "容器路径自动翻译为主机路径" — 错误语义
- L169: "冒号分隔" 未区分YAML数组 vs env冒号分隔
- L425-441: Docker Compose 用 peekview:latest / peekview/mcp-server:latest — 不存在
- L353-372: path_namespaces 示例暗示路径映射

### 10. README.md (根)
- L40-55: MCP接入只有Claude Code示例，缺OpenCode/Cursor
- 无Docker场景指引

### 11. backend/README.md
- 无Docker场景指引
- 无MCP接入说明

### 12. 现有测试
- publishFiles.test.ts: 有cwd=/测试(L326-339)，mock process.cwd
- config-merge.test.ts: 有allowed_paths测试，但无字符串容错测试
- health.test.ts: describe.skip（需RUN_REAL_MCP_HEALTH=1）
- cli-config.test.ts: 存在，需确认覆盖范围

## Design Decisions

### CWD guard 修复
- 当前: cwd=/ → 无条件拒绝
- 修复: cwd=/ + (allowedPaths.length > 0 || trustAllPaths) → 放行
- 修复: cwd=/ + !allowedPaths.length + !trustAllPaths → 拒绝（保护语义不变）
- 错误信息: 区分"cwd=/ guard触发"和"未配allowed_paths"

### allowed_paths 容错
- merge.ts L82: 加 typeof 检查，字符串 → split(':')
- 空数组视为未配置（BDD-9）

### config list 增强
- 调 mergeConfig 获取最终生效值
- 追加 cwd/mode/resolved allowed_paths 字段

### config verify 增强
- 追加 allowed_paths 文件可读性测试 (fs.access R_OK)

### /health 增强
- config 对象追加 cwd/mode/allowed_paths
- remote模式: allowed_paths 不适用

### 文档修正
- namespace语义: "Agent侧短路径别名" + "volume mount必须同路径"
- allowed_paths格式: 区分YAML数组 vs env冒号分隔
- Docker示例: node:20-alpine + npm install -g
- 三份README均加Docker场景指引
- 根README加OpenCode/Cursor示例

[PROD_NOT_TOUCHED]
