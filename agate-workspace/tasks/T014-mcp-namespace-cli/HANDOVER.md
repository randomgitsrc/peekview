# T014 HANDOVER — MCP path_namespace CLI

状态：P0-P2 完成，P3-P8 交接 OpenCode

## 待执行

```bash
# P3 先写红灯测试
# packages/mcp-server/tests/ 新增 namespace 命令测试
# 9个用例覆盖 AC1-AC9（先跑 npm test 确认全红）

# P4 实现
# 1. src/config/file.ts: ConfigFileData.server 加 path_namespaces 字段
# 2. src/cli/config.ts: 新增 namespace 子命令组（add/remove/list）
# 3. src/cli/config.ts: config list 补 path_namespaces 输出

# P5 gate
cd packages/mcp-server && npm test

# P8
make bump-mcp-version NEW_MCP_VERSION=0.9.1
# 填写 CHANGELOG
cd packages/mcp-server && npm publish
```

## 关键注意

1. 不做 namespace test 子命令（v3 plan 明确决策）
2. saveConfigToFile 不保留 YAML 注释（和现有行为一致）
3. remove 整个 ns 用 --yes flag 确认，不用 readline 交互
4. BDD 验收条件：P1-requirements.md（9条 AC）
