# T015 HANDOVER — MCP config verify + unset

状态：P0-P2 完成，P3-P8 交接 OpenCode

## 待执行

```bash
# P3：先写红灯测试
# packages/mcp-server/tests/cli/ 下新增 verify-unset.test.ts
# 9个用例覆盖 AC1-AC9（先跑 npm test 确认全红）
# verify 需要 mock fetch 或 nock 模拟 HTTP 响应

# P4：实现
# 只改 packages/mcp-server/src/cli/config.ts
# 新增 verify 命令（async action）和 unset 命令

# P5 gate
cd packages/mcp-server && npm test

# P8
make bump-mcp-version NEW_MCP_VERSION=0.9.2
# 填写 CHANGELOG
cd packages/mcp-server && npm publish
```

## 实现注意

1. Step 5 认证判断：`res.status === 200 || res.status === 403` 视为有效，`res.status === 401` 视为失败
2. `AbortSignal.timeout(5000)` — 确认 Node.js 版本 ≥ 18
3. verify 是 async，需确认 Commander.js 入口用 `program.parseAsync()`（查 src/index.ts）
4. unset 删除后 section 变空 → 删整个 section（避免 YAML 里留 `peekview: {}`）

## 关键参考

- validators.ts：`packages/mcp-server/src/config/validators.ts`（接线 validateUrl）
- /health 端点：`packages/mcp-server/src/server.ts` 第 226 行
- 认证端点：`GET /api/v1/entries?per_page=1`（返回 200 = key 有效，401 = key 无效）
- BDD 验收条件：P1-requirements.md（9条 AC）
