---
phase: P0
task_id: TPV0071
task_name: docker-deploy
type: brief
trace_id: TPV0071-P0-20260728
created: 2026-07-24
updated: 2026-07-28
status: draft
parent: T070 衍生 + 网友B 部署痛点 + 多部署形式需求
---

## 任务简述

为 PeekView 全栈提供官方 Docker 部署支持：PeekView 后端镜像 + MCP Server 镜像 + docker-compose 一键部署模板。合并原 T071（MCP 镜像）和 T072（PeekView 镜像），因为两者共用 CI workflow、ghcr.io 发布通道、VERSIONS.json 同步逻辑，且 compose 模板跨依赖。

## 背景痛点

**MCP Server（网友B 场景）**：
```bash
docker run ... node:20-alpine \
  sh -c "npm install -g @peekview/mcp-server && peekview-mcp serve ..."
```
- 每次重启 40-60s 等 npm install（151 个依赖包）
- 依赖 npm registry 可用，离线环境不行
- 版本不可控（每次装最新，可能意外升级）
- 无 HEALTHCHECK 指令可用

**PeekView 后端**：
- 只能 `pipx install peekview`，无法 Docker 一键部署
- 用户（NAS 环境）不想在宿主机装 Python 包
- mcp-server/README 的 Docker Compose 示例用了不存在的镜像名 `peekview:latest`

## 任务范围

### A. MCP Server 镜像

1. **Dockerfile**：基于 `node:20-alpine`，预装 `@peekview/mcp-server`，设 `WORKDIR /tmp`，设 `HOME=/root`
2. **镜像发布**：ghcr.io，标签 `ghcr.io/randomgitsrc/peekview-mcp:版本` + `latest`
3. **HEALTHCHECK**：用 MCP Server `/health` 端点

### B. PeekView 后端镜像

4. **Dockerfile**：基于 `python:3.12-slim`，multi-stage build（第一阶段 npm build 前端，第二阶段 pip install peekview + COPY 前端产物），暴露 :8080
5. **数据卷**：`/data` 挂载 PeekView 数据目录，配置通过 `PEEKVIEW_*` 环境变量
6. **镜像发布**：ghcr.io，标签 `ghcr.io/randomgitsrc/peekview:版本` + `latest`

### C. 共用基础设施

7. **CI/CD**：GitHub Actions workflow，tag 触发自动构建+推送两个镜像（amd64 优先，arm64 按需）
8. **Makefile target**：`build-docker`（本地构建两个镜像）、`publish-docker`（CI 触发）
9. **VERSIONS.json**：加 docker 镜像 tag 字段，bump-version / bump-mcp-version 同步
10. **docker-compose 模板**：PeekView + MCP Server 一键部署（两个服务 + 数据卷 + 网络）

### D. 文档

11. **根 README**：新增 Docker 部署章节（单镜像 + compose）
12. **backend/README**：新增 Docker 部署章节
13. **mcp-server/README**：用官方镜像替换 npm install 方式，保留 npm install 作为 fallback
14. **MCP 部署场景矩阵**（roadmap #37 补充）：覆盖单机/Docker/远程等场景

## 环境约束

- MCP 镜像基础：`node:20-alpine`
- PeekView 镜像基础：`python:3.12-slim`
- 镜像仓库：ghcr.io（GitHub 原生，无额外账号）
- 多架构：优先 amd64，arm64 按需
- MCP 配置文件通过 volume mount 挂载（`-v ~/.peekview:/root/.peekview`）
- PeekView 数据持久化：`-v peekview-data:/data`，`PEEKVIEW_STORAGE__DATA_DIR=/data`
- PeekView 配置全部通过环境变量，不依赖配置文件
- PeekView 端口：8080
- MCP WORKDIR 设为 `/tmp`（兼容 T070 修复前的 CWD guard）

## 已知风险

- ghcr.io 镜像可见性（public/private）需配置
- GitHub Actions 构建时间（首次构建层缓存空，两个镜像 multi-arch 可能 >10min）
- PeekView 镜像大小：Python + 前端构建产物可能 >300MB，需优化层缓存
- 前端构建产物嵌入：pip 包已含 `peekview/static/`，Docker 镜像 multi-stage build 需确保用最新前端
- SQLite WAL 在 Docker volume 上的兼容性（应该没问题，但需验证）

## 依赖

- T070 已完成（CWD guard 修复，MCP 镜像 WORKDIR 可不设 /tmp 的前提已满足）

## 验证标准

- `docker pull ghcr.io/randomgitsrc/peekview:0.11.x` 成功
- `docker pull ghcr.io/randomgitsrc/peekview-mcp:0.10.x` 成功
- PeekView 容器启动后浏览器访问 :8080 正常
- MCP 容器启动 < 3 秒（无 npm install）
- 创建 entry + 上传文件 + 查看详情 全流程正常
- 重启容器后数据仍在（volume 持久化）
- `docker-compose up` 一键启动 PeekView + MCP Server
- 根 README + backend/README + mcp-server/README 有 Docker 部署章节
