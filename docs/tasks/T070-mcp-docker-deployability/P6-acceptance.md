---
phase: P6
task_id: T070
type: acceptance
parent: P5-test-results
trace_id: T070-P6-20260725
status: draft
created: 2026-07-25
agent: verifier
---

## BDD 验收结果

### CWD Guard 修复

- PASS BDD-1: 已配 allowed_paths 且 cwd=/ 时 publish_files 正常工作 (P6-evidence/test-output.log)
- PASS BDD-2: 未配 allowed_paths 且 cwd=/ 时 publish_files 被拒绝 (P6-evidence/test-output.log)
- PASS BDD-3: 已配 allowed_paths 且 cwd 非根目录时行为不变 (P6-evidence/test-output.log)
- PASS BDD-4: 未配 allowed_paths 且 cwd 非根目录时行为不变 (P6-evidence/test-output.log)
- PASS BDD-5: trust_all_paths=true 且 cwd=/ 时 publish_files 正常工作 (P6-evidence/test-output.log)

### 错误信息区分

- PASS BDD-6: cwd=/ 且未配 allowed_paths 时错误信息包含两个原因 (P6-evidence/test-output.log)

### allowed_paths 容错

- PASS BDD-7: YAML 文件中 allowed_paths 写为冒号分隔字符串时自动解析为数组 (P6-evidence/test-output.log)
- PASS BDD-8: YAML 文件中 allowed_paths 写为数组时正常工作 (P6-evidence/test-output.log)
- PASS BDD-9: 空 allowed_paths 数组等同于未配置 (P6-evidence/test-output.log)

### 诊断增强

- PASS BDD-10: config list 显示运行时 cwd (P6-evidence/test-output.log)
- PASS BDD-11: config list 显示 env 覆盖后的最终生效值 (P6-evidence/test-output.log)
- PASS BDD-12: config list 新增字段不改变现有输出格式 (P6-evidence/test-output.log)
- PASS BDD-13: config verify 测试 allowed_paths 文件可读性 (P6-evidence/test-output.log)
- PASS BDD-14: config verify 报告不可读的 allowed_paths (P6-evidence/test-output.log)

### /health 端点增强

- PASS BDD-15: /health 返回 cwd 和 mode 信息（local 模式） (P6-evidence/test-output.log)
- PASS BDD-16: /health 返回 allowed_paths 信息（local 模式） (P6-evidence/test-output.log)
- PASS BDD-17: /health 在 remote 模式下 cwd/allowed_paths 语义正确 (P6-evidence/test-output.log)

### 文档修正

- PASS BDD-18: mcp-server/README.md namespace 语义描述正确，无"自动翻译"/"映射到主机"错误表述，包含"volume mount 必须同路径"说明 (P6-evidence/doc-check.log)
- PASS BDD-19: mcp-server/README.md allowed_paths 格式区分配置文件（YAML 数组格式 `- /path1`）和环境变量（冒号分隔 `MCP_ALLOWED_PATHS=/path1:/path2`） (P6-evidence/doc-check.log)
- PASS BDD-20: mcp-server/README.md Docker 示例不使用不存在的镜像名，image 字段使用 python:3.12-slim 和 node:20-alpine (P6-evidence/doc-check.log)
- PASS BDD-21: 三份 README 均有 Docker 场景指引和 allowed_paths 配置说明 (P6-evidence/doc-check.log)
- PASS BDD-22: 根 README.md 包含 OpenCode 和 Cursor 接入示例及配置 (P6-evidence/doc-check.log)

### 工具描述增强

- PASS BDD-23: publish_files 工具描述包含 Docker 场景提示（"Docker/container: if cwd=/, configure server.allowed_paths or set trust_all_paths=true"） (P6-evidence/tool-desc-check.log)
- PASS BDD-24: publish_files 工具描述包含诊断命令提示（"Troubleshooting: run 'peekview-mcp config verify' to check config and file access"） (P6-evidence/tool-desc-check.log)

## 汇总

PASS: 24 / FAIL: 0 / NEED_CONFIRM: 0

[NO_NEED_CONFIRM]

[PROD_NOT_TOUCHED]
