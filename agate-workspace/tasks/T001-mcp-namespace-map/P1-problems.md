---
phase: P1
task_id: T001
task_name: mcp-namespace-map
type: problems
trace_id: T001-P1-20250610
created: 2026-06-10
status: approved
parent: docs/plans/mcp-path-namespace-mapping.md
---

# 问题定义：MCP Path Namespace 映射方案

## 原始需求

解决 Docker 容器内 Agent 与主机上 MCP Server（local 模式）之间的路径空间错位问题。

### 场景描述

Agent 运行在 Docker 容器中，通过网络连接主机上的 MCP Server。容器内的数据卷映射到主机目录：

```
docker run -v ~/docker-data1:/opt/data ...

容器内 agent 看到：     /opt/data/report.md
主机上 MCP Server 看到：~/docker-data1/report.md（同一文件）
```

Agent 调用 `publish_files({ paths: ["/opt/data/report.md"] })`，MCP Server 在主机上找 `/opt/data/report.md`——不存在。

### 多容器冲突

多个容器可能都用相同的容器内路径：

```
容器 A：/opt/data → 主机 ~/docker-data1
容器 B：/opt/data → 主机 ~/docker-data2

两个 agent 都发 /opt/data/report.md，字面相同，实际是不同主机目录
```

## 期望行为

1. Agent 通过 header 声明自己属于哪个命名空间
2. MCP Server 根据命名空间将容器内路径翻译为主机真实路径
3. 翻译后的路径仍然走完整的安全链（realpath → denylist → allowlist）

## 验收标准

- [x] 方案设计完成（P2-design.md）
- [x] 专家评审通过（P2-review.md）
- [ ] P3 测试用例设计完成
- [ ] P4 代码实现完成
- [ ] P5 验证通过
- [ ] P6 一致性检查通过
- [ ] P7 发布完成

---

## 问题列表

| ID | 问题描述 | 优先级 | 阶段 |
|----|----------|--------|------|
| issue-1 | Docker 容器内路径与主机路径不一致 | P1 | P2 已解决 |
| issue-2 | 多容器可能使用相同路径导致冲突 | P1 | P2 已解决 |
| issue-3 | namespace 配置不在 config 中 | P1 | P2 已解决 |
| issue-4 | ~ 展开功能缺失 | P1 | P2 已解决 |

---

## 关联文档

- 方案设计：`docs/plans/mcp-path-namespace-mapping.md`
- 专家评审：`docs/reviews/expert-review-mcp-path-namespace-mapping.md`