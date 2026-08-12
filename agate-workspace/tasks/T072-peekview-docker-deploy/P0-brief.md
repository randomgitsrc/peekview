---
phase: P0
task_id: T072
task_name: peekview-docker-deploy
type: brief
trace_id: T072-P0-20260724
created: 2026-07-24
status: draft
parent: 多部署形式设计分析
---

## 任务简述

为 PeekView（后端 Python 包）提供官方 Docker 部署支持。目前 PeekView 只能通过 `pipx install peekview` 安装，用户无法用 Docker 一键部署整个 PeekView 服务。本任务制作 PeekView 官方镜像 + docker-compose 模板，覆盖单机 Docker 部署场景。

## 背景痛点

PeekView 目前的安装方式只有 pipx：
```bash
pipx install peekview
peekview serve
```

问题：
1. 用户（如网友B 的 NAS 环境）可能不想在宿主机装 Python 包
2. 无法用 Docker 一键部署 PeekView + 数据持久化
3. 根 README 和 backend/README 都没有 Docker 部署指引
4. mcp-server/README 的 Docker Compose 示例用了不存在的镜像名 `peekview:latest`

## 任务范围

1. **Dockerfile**：基于 Python 3.12 slim，安装 peekview（pip），内置前端构建产物，暴露 :8080
2. **数据卷**：`/data` 挂载 PeekView 数据目录（DB + 文件存储），配置通过环境变量
3. **镜像发布**：ghcr.io 或 Docker Hub，标签 `peekview/peekview:版本` + `latest`
4. **CI/CD**：GitHub Actions 自动构建 + 推送（tag 触发），和 T071 共用 workflow 或独立
5. **docker-compose 模板**：PeekView + MCP Server 一键部署（两个服务）
6. **Makefile target**：`build-docker-peekview`、`publish-docker-peekview`
7. **版本同步**：VERSIONS.json 加 peekview docker 镜像 tag
8. **文档更新**：根 README + backend/README 加 Docker 部署章节

## 环境约束

- 基础镜像：`python:3.12-slim`
- 前端构建产物：在 Dockerfile 里 multi-stage build（第一阶段 npm build，第二阶段 COPY dist/）
- 数据持久化：`-v peekview-data:/data`，环境变量 `PEEKVIEW_STORAGE__DATA_DIR=/data`
- 配置：全部通过环境变量（`PEEKVIEW_*`），不依赖配置文件
- 端口：8080
- 不打包 MCP Server（独立镜像，见 T071）

## 已知风险

- 镜像大小：Python + 前端构建产物可能较大（>300MB），需优化层缓存
- 前端构建产物嵌入方式：peekview pip 包已含 `peekview/static/`，Docker 镜像是否需要重新构建前端？需确认 pip 包里的 static 是否是最新
- SQLite WAL 在 Docker volume 上的兼容性（应该没问题，但需验证）
- 配置复杂度：33 个配置项，Docker 环境变量命名需明确

## 裁剪倾向

- risk=medium：涉及前端构建 + 后端打包 + 数据持久化
- P1 不可裁（评审）
- P2 必须走（数据卷 + 配置 + 前端嵌入需设计）
- P3 可跳（Docker 构建本身是 CI 验证，无业务逻辑单测）
- P5 验证：镜像构建 + 容器启动 + 创建 entry + 访问前端页面
- P6 验收：Docker 部署后浏览器访问正常 + 数据持久化验证
- P7 一致性：Dockerfile + docker-compose + Makefile + README×2 + VERSIONS.json
- P8 发布：bump peekview version + 推镜像

## 依赖

- 无硬依赖。和 T071（MCP Docker 镜像）可并行，docker-compose 模板引用两个镜像。

## 验证标准

- `docker pull ghcr.io/randomgitsrc/peekview:0.11.x` 成功
- `docker run -p 8080:8080 -v peekview-data:/data peekview/peekview` 启动后浏览器访问 :8080 正常
- 创建 entry + 上传文件 + 查看详情 全流程正常
- 重启容器后数据仍在（volume 持久化）
- docker-compose up 一键启动 PeekView + MCP Server
- 根 README + backend/README 有 Docker 部署章节
