---
phase: P0
task_id: T071
task_name: mcp-official-docker-image
type: brief
trace_id: T071-P0-20260724
created: 2026-07-24
status: draft
parent: T070 衍生 + 网友B 部署痛点
---

## 任务简述

为 @peekview/mcp-server 发布官方 Docker 镜像，取代当前用户自建 `node:20-alpine + npm install` 的方式。解决每次容器重启 40-60 秒 npm install、依赖网络、版本不可控、离线环境不可用的问题。

## 背景痛点

网友B 当前部署方式：
```bash
docker run ... node:20-alpine \
  sh -c "npm install -g @peekview/mcp-server && peekview-mcp serve ..."
```

问题：
1. 每次重启 40-60s 等 npm install（151 个依赖包）
2. 依赖 npm registry 可用，离线环境不行
3. 版本不可控（每次装最新，可能意外升级）
4. 无 HEALTHCHECK 指令可用
5. 镜像层不可缓存，每次全量安装

## 任务范围

1. **Dockerfile**：基于 `node:20-alpine`，预装 `@peekview/mcp-server`，设 `WORKDIR /tmp`（规避 T070 之前的 CWD guard bug），设 `HOME=/root`
2. **镜像发布**：GitHub Container Registry（ghcr.io）或 Docker Hub，标签 `peekview/mcp-server:版本` + `latest`
3. **CI/CD**：GitHub Actions 自动构建 + 推送（tag 触发）
4. **Makefile target**：`build-docker-mcp`、`publish-docker-mcp`
5. **版本同步**：VERSIONS.json 加 docker 镜像 tag，bump-mcp-version 同步
6. **文档更新**：mcp-server/README.md 用官方镜像替换 npm install 方式，保留 npm install 作为 fallback

## 环境约束

- 基础镜像：`node:20-alpine`（和现有部署方式一致）
- 镜像仓库：ghcr.io（GitHub 原生，无额外账号）或 Docker Hub
- 多架构：优先 amd64，arm64 按需
- 配置文件仍通过 volume mount 挂载（`-v ~/.peekview:/root/.peekview`）
- WORKDIR 设为 `/tmp`（兼容 T070 修复前的 CWD guard）

## 已知风险

- ghcr.io 镜像可见性（public/private）需配置
- GitHub Actions 构建时间（首次构建层缓存空）
- 镜像大小控制（node:20-alpine + npm 包约 200MB）
- 版本同步逻辑需和现有 bump-mcp-version 协调

## 裁剪倾向

- risk=low：Dockerfile + CI/CD，不改 MCP Server 代码
- P1 不可裁（评审）
- P2 可简化（follows_existing_pattern，Dockerfile 是标准模式）
- P3 可跳（无业务逻辑可测，Docker 构建本身是 CI 验证）
- P5 验证：镜像构建成功 + 容器启动 + publish_files 正常
- P6 验收：用官方镜像跑通网友B 的场景
- P7 一致性：Dockerfile + CI + Makefile + README + VERSIONS.json
- P8 发布：bump mcp version + 推镜像

## 依赖

- T070 完成后更佳（CWD guard 修复后 WORKDIR 可不设 /tmp），但非硬依赖。可并行，T070 完成后调整 Dockerfile。

## 验证标准

- `docker pull ghcr.io/randomgitsrc/peekview-mcp:0.9.x` 成功
- 容器启动 < 3 秒（无 npm install）
- `publish_files` 正常工作
- `docker run` 命令不再需要 `sh -c "npm install ..."`
- mcp-server/README.md 有官方镜像使用方式
