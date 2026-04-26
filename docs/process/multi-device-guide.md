# 多设备开发指南

> 如何在不同电脑上连接 GitHub 仓库进行开发，遵循检查点驱动流程。

## 环境准备

### 1. 克隆仓库

```bash
# 使用 SSH（推荐，需配置 SSH key）
git clone git@github.com:randomgitsrc/peekview.git
cd peekview

# 或使用 HTTPS
git clone https://github.com/randomgitsrc/peekview.git
cd peekview
```

### 2. 验证远程配置

```bash
git remote -v
# 应显示:
# origin  git@github.com:randomgitsrc/peekview.git (fetch)
# origin  git@github.com:randomgitsrc/peekview.git (push)
```

### 3. 安装依赖

**后端（Python 3.12+）:**
```bash
cd backend
pip install -e ".[test]"
# 验证
make test  # 应显示 292 passed
```

**前端（Node.js 18+）:**
```bash
cd frontend
npm install
# 验证
npm run test  # 应显示 100 passed
```

---

## 开发前必读（每次开工）

### 第一步：同步代码

```bash
git pull origin main
```

### 第二步：读取当前任务

按顺序读取以下文件，了解当前状态：

```bash
# 1. 项目上下文
cat CLAUDE.md

# 2. 流程章程（最新版）
cat docs/process/workflow.md

# 3. 活跃任务看板
cat docs/process/active-tasks.md

# 4. 实现计划（如有待规划任务）
cat docs/plans/impl-plan.md
```

### 第三步：确认检查点状态

```bash
# 查看是否有未完成的检查点目录
ls -la docs/process/checkpoints/

# 例如看到 P1-T19/，说明 Task 19 在 P1 阶段
```

---

## 开发流程（按章程执行）

### 阶段 P0: 问题定义

**如果是新任务：**

```bash
# 1. 创建检查点目录
mkdir -p docs/process/checkpoints/P0-T{task-id}

# 2. 编写问题清单
cat > docs/process/checkpoints/P0-T{task-id}/problems.md << 'EOF'
## Task X: 任务标题

### 问题1: xxx
- **现象**: 
- **期望行为**: 
- **验收标准**: 

### 问题2: xxx
...
EOF

# 3. 编写测试策略
cat > docs/process/checkpoints/P0-T{task-id}/test-strategy.md << 'EOF'
| 问题ID | 测试类型 | 说明 |
|--------|----------|------|
| P1 | 单元测试 | ... |
| P2 | 手工验证 | UI问题，需截图 |
EOF

# 4. 提交
git add docs/process/checkpoints/P0-T{task-id}/
git commit -m "[Task X][P0] 问题定义与测试策略

- problems.md: 3项问题清单
- test-strategy.md: 测试类型标注

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
git push origin main
```

### 阶段 P1: 测试设计（先于代码！）

```bash
# 1. 创建检查点目录
mkdir -p docs/process/checkpoints/P1-T{task-id}

# 2. 编写测试用例
cat > docs/process/checkpoints/P1-T{task-id}/test-cases.md << 'EOF'
| 问题ID | 测试描述 | 预期结果 | 测试类型 | 测试文件 |
|--------|----------|----------|----------|----------|
| P1 | ... | ... | 单元测试 | test_xxx.py |
| P2 | ... | ... | 手工验证 | manual-checklist.md |
EOF

# 3. UI问题：编写手工验证清单
cat > docs/process/checkpoints/P1-T{task-id}/manual-checklist.md << 'EOF'
## 问题2: xxx
- [ ] 步骤1: 
- [ ] 步骤2: 
- [ ] 证据: 截图保存到 evidences/P2-xxx.png
EOF

# 4. 实现单元测试（先提交，此时应失败）
# 编辑 frontend-v3/src/__tests__/Xxx.spec.ts 或 backend/tests/test_xxx.py

# 5. 提交测试代码（失败状态是正常的！）
git add docs/process/checkpoints/P1-T{task-id}/
git add frontend-v3/src/__tests__/Xxx.spec.ts  # 或后端测试
git commit -m "[Task X][P1] 测试用例设计

- test-cases.md: 5项测试用例
- manual-checklist.md: UI验证步骤
- Xxx.spec.ts: 单元测试代码（当前失败，预期）

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
git push origin main
```

### 阶段 P2: 代码实现

```bash
# 1. 逐个问题修复（禁止批量！）
# 编辑代码...

# 2. 每个问题独立提交
# 问题1修复:
git add frontend-v3/src/components/Xxx.vue
git commit -m "[Task X][P2] 修复问题1: xxx

- 修改文件: Xxx.vue:123
- 原因: ...

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"

# 问题2修复:
git add frontend-v3/src/components/Yyy.vue
git commit -m "[Task X][P2] 修复问题2: yyy

- 修改文件: Yyy.vue:456
- 原因: ...

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"

git push origin main
```

### 阶段 P3: 逐项验证（关键！）

```bash
# 1. 创建检查点目录和证据目录
mkdir -p docs/process/checkpoints/P3-T{task-id}/test-results
mkdir -p docs/process/checkpoints/P3-T{task-id}/evidences

# 2. 运行单元测试
cd backend && make test > ../docs/process/checkpoints/P3-T{task-id}/test-results/unit.md 2>&1
cd ../frontend && npm run test > ../docs/process/checkpoints/P3-T{task-id}/test-results/unit-frontend.md 2>&1

# 3. UI问题：手工验证并截图
# - 启动 dev server: npm run dev
# - 浏览器访问，截图保存到 evidences/
# - 例如: evidences/P2-scroll-fixed.png

# 4. 编写验证报告
cat > docs/process/checkpoints/P3-T{task-id}/test-results/manual.md << 'EOF'
## 手工验证结果

### 问题2: 页面可滚动
- [x] 验证通过
- 证据: ![滚动截图](evidences/P2-scroll.png)
- 环境: Chrome 120, 1920x1080
EOF

# 5. 提交验证证据
git add docs/process/checkpoints/P3-T{task-id}/
git commit -m "[Task X][P3] 验证完成

- test-results/unit.md: 单元测试通过
- test-results/manual.md: 手工验证通过
- evidences/: 3张截图证据

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
git push origin main
```

### 阶段 P4: 一致性检查

```bash
# 1. 创建检查点目录
mkdir -p docs/process/checkpoints/P4-T{task-id}

# 2. 编写一致性检查文档
cat > docs/process/checkpoints/P4-T{task-id}/consistency-check.md << 'EOF'
## 一致性核对

| 问题 | 代码修改 | 测试覆盖 | 文档描述 | 一致? |
|------|----------|----------|----------|-------|
| P1 | Xxx.vue:123 | unit.md | CHANGELOG | ✅ |
| P2 | Yyy.vue:456 | manual.md | CHANGELOG | ✅ |
EOF

# 3. 更新 CHANGELOG.md
# 编辑 CHANGELOG.md，添加 [Unreleased] 或新版本

# 4. 检查版本号
# 编辑 backend/pyproject.toml, backend/peekview/cli.py, frontend-v3/package.json

# 5. 提交
git add docs/process/checkpoints/P4-T{task-id}/
git add CHANGELOG.md
# 如更新版本号: git add backend/pyproject.toml backend/peekview/cli.py frontend-v3/package.json
git commit -m "[Task X][P4] 一致性检查与文档更新

- consistency-check.md: 三方核对通过
- CHANGELOG.md: 变更记录已更新

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
git push origin main
```

### 阶段 P5: 发布

```bash
# 1. 创建检查点目录
mkdir -p docs/process/checkpoints/P5-T{task-id}

# 2. 构建验证
cd frontend
npm run build > ../docs/process/checkpoints/P5-T{task-id}/build-log.md 2>&1

# 3. 端到端验证（实际启动服务）
cd ../backend
make dev &
# 浏览器访问 http://localhost:8080
# 截图保存到 docs/process/checkpoints/P5-T{task-id}/e2e-homepage.png

# 4. 编写 E2E 验证报告
cat > docs/process/checkpoints/P5-T{task-id}/e2e-verification.md << 'EOF'
## E2E 验证

- [x] peekview serve 启动成功
- [x] 首页访问正常: ![首页](e2e-homepage.png)
- [x] 详情页访问正常
EOF

# 5. PyPI 发布（如需要）
cd backend
python3 -m build
git tag -a v0.1.X -m "Release v0.1.X"
# python3 -m twine upload dist/* -u __token__ -p $PYPI_API_TOKEN

# 6. 提交并推送
git add docs/process/checkpoints/P5-T{task-id}/
git commit -m "[Task X][P5] 发布完成

- build-log.md: 构建成功
- e2e-verification.md: 端到端验证通过
- PyPI: v0.1.X 已上传

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
git push origin main
git push origin v0.1.X  # 推送 tag
```

---

## 多设备同步要点

### 切换设备前必做

```bash
# 1. 确保所有检查点已提交
git status  # 应为 clean

# 2. 推送所有提交
git push origin main

# 3. 如有 tag，推送 tag
git push origin --tags
```

### 新设备上恢复工作

```bash
# 1. 克隆仓库
git clone git@github.com:randomgitsrc/peekview.git
cd peekview

# 2. 检出最新代码
git pull origin main

# 3. 查看当前检查点状态
ls docs/process/checkpoints/
# 例如看到 P3-T19/，说明 Task 19 在 P3 阶段，需继续验证

# 4. 读取该阶段文档
cat docs/process/checkpoints/P3-T19/test-results/manual.md
```

---

## 常见问题

### Q: 两台电脑同时修改冲突了怎么办？

```bash
# 先拉取远程更新
git pull --rebase origin main

# 如有冲突，解决后
git add .
git rebase --continue

# 然后推送
git push origin main
```

### Q: 检查点目录可以删除吗？

**不可以。** 检查点目录是工作状态的证据，必须保留在 Git 中。

### Q: 如何在另一台电脑继续中断的工作？

```bash
# 查看活跃任务
cat docs/process/active-tasks.md

# 查看检查点状态
ls docs/process/checkpoints/

# 进入对应目录读取文档，继续该阶段
```

### Q: 提交信息格式必须严格遵守吗？

是的。格式要求：
```
[Task X][P{阶段}] 简要描述

- 变更点1
- 变更点2

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```

---

## 速查表

| 阶段 | 关键文件 | 提交信息前缀 |
|------|----------|--------------|
| P0 | `problems.md`, `test-strategy.md` | `[Task X][P0]` |
| P1 | `test-cases.md`, `manual-checklist.md` | `[Task X][P1]` |
| P2 | 代码文件 | `[Task X][P2]` |
| P3 | `test-results/`, `evidences/` | `[Task X][P3]` |
| P4 | `consistency-check.md` | `[Task X][P4]` |
| P5 | `build-log.md`, `e2e-verification.md` | `[Task X][P5]` |

---

最后更新: 2026-04-24
