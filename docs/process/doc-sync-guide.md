# 文档同步指南 (Documentation Sync Guide)

> 代码变更后如何确保所有相关文档同步更新

## 核心原则

**代码即文档的源头** - 当代码中的配置、接口、行为发生变化时，文档必须同步更新。

## 代码-文档影响映射表

### 配置系统 (`backend/peekview/config.py`)

| 代码变更 | 影响文档 | 检查点 |
|----------|----------|--------|
| 新增/修改环境变量 | README.md, CLAUDE.md, backend/README.md, DEPLOYMENT.md, DEBUGGING.md | 变量名、默认值、说明一致 |
| 嵌套配置结构变化 | 所有含 env var 的文档 | `__` 分隔符正确使用 |
| 配置优先级调整 | README.md, DEPLOYMENT.md | 优先级说明正确 |
| 默认值变更 | 所有配置表 | 默认值列更新 |

### API 接口 (`backend/peekview/api/`)

| 代码变更 | 影响文档 | 检查点 |
|----------|----------|--------|
| 路径变更 | DEBUGGING.md, DEPLOYMENT.md, 所有 curl 示例 | 路径一致性 |
| 请求/响应格式变化 | backend/README.md, DEBUGGING.md | JSON 示例正确 |
| 新增端点 | backend/README.md, DEPLOYMENT.md | 完整文档化 |
| 删除端点 | 所有相关文档 | 移除过时内容 |

### CLI 命令 (`backend/peekview/cli.py`)

| 代码变更 | 影响文档 | 检查点 |
|----------|----------|--------|
| 新增/修改子命令 | README.md, CLAUDE.md | 命令示例正确 |
| 参数变化 | README.md, DEPLOYMENT.md | 参数说明更新 |
| 服务安装配置 | DEPLOYMENT.md, cli.py 中的 service 配置 | env var 名正确 |

### 前端行为 (`frontend-v3/src/`)

| 代码变更 | 影响文档 | 检查点 |
|----------|----------|--------|
| URL 路由变化 | 所有含链接的文档 | 链接正确 |
| 新增功能 | CHANGELOG.md, README.md | 功能描述 |
| UI 变化 | workflow.md (manual checklist) | 截图更新需求 |

### Makefile/脚本 (`Makefile`, `scripts/`)

| 代码变更 | 影响文档 | 检查点 |
|----------|----------|--------|
| 新增 target | CLAUDE.md, release.md, debug-workflow.md | 命令文档化 |
| 命令行为变化 | 所有引用该命令的文档 | 同步更新 |

## 文档同步检查流程 (P4 阶段扩展)

在 P4 (一致性检查) 阶段，增加文档同步检查：

### P4.0 代码-文档影响分析

**输出**: `docs/process/checkpoints/P4-{task}/doc-impact.md`

```markdown
## Task XX 文档影响分析

### 代码变更
- 文件: `backend/peekview/config.py`
- 变更: 添加 `cleanup.interval_seconds` 配置项

### 影响文档
| 文档 | 位置 | 更新内容 | 状态 |
|------|------|----------|------|
| README.md | ## Configuration | 新增 PEEKVIEW_CLEANUP__INTERVAL_SECONDS | ⬜ |
| CLAUDE.md | ## Configuration | 新增配置行 | ⬜ |
| DEPLOYMENT.md | ### 环境变量 | 新增表格行 | ⬜ |
| DEBUGGING.md | #### 环境变量配置 | 新增 export 示例 | ⬜ |

### 检查脚本
```bash
# 验证配置项在所有文档中一致
./scripts/check_doc_consistency.py --config cleanup.interval_seconds
```
```

### P4.1 文档一致性验证

**自动化检查脚本**: `scripts/check_doc_consistency.py`

```bash
#!/bin/bash
# 检查文档与代码的一致性

echo "=== 检查环境变量文档一致性 ==="

# 从代码中提取实际的环境变量名
cd backend/peekview
grep -E "PEEKVIEW_[A-Z_]+" config.py | grep -v "^#" | sort -u > /tmp/code_env_vars.txt

# 从文档中提取记录的环境变量名
cd ../../
grep -hE "PEEKVIEW_[A-Z_]+" README.md CLAUDE.md docs/DEPLOYMENT.md docs/DEBUGGING.md 2>/dev/null | \
  grep -E "^\| \`PEEKVIEW" | awk -F'\`' '{print $2}' | sort -u > /tmp/doc_env_vars.txt

# 对比差异
echo "只在代码中存在的变量:"
diff /tmp/code_env_vars.txt /tmp/doc_env_vars.txt | grep "^<" | sed 's/< /  - /'

echo "只在文档中存在的变量:"
diff /tmp/code_env_vars.txt /tmp/doc_env_vars.txt | grep "^>" | sed 's/> /  - /'
```

### P4.2 手动验证清单

```markdown
## 文档同步验证清单

### 配置变更
- [ ] README.md 配置表已更新
- [ ] CLAUDE.md 配置表已更新
- [ ] backend/README.md 配置表已更新
- [ ] DEPLOYMENT.md 配置表已更新
- [ ] DEBUGGING.md 示例已更新
- [ ] 所有文档使用正确的 `__` 分隔符

### API 变更
- [ ] backend/README.md API 示例已更新
- [ ] DEBUGGING.md curl 示例已更新
- [ ] DEPLOYMENT.md 使用教程已更新

### CLI 变更
- [ ] README.md 命令示例已更新
- [ ] CLAUDE.md 命令速查已更新
- [ ] DEPLOYMENT.md 服务安装配置已更新

### 验证方法
```bash
# 1. 检查 env var 一致性
make check-docs

# 2. 检查链接有效性
make check-links

# 3. 人工抽查
# 随机选择 2-3 个文档，验证示例命令可执行
```
```

## Makefile 集成

### 新增 target

```makefile
# =============================================================================
# Documentation Consistency Checks
# =============================================================================

## Check documentation consistency with code
check-docs:
	@echo "=== 检查文档一致性 ==="
	@echo "→ 检查环境变量..."
	@bash scripts/check_doc_consistency.sh
	@echo "→ 检查 API 路径..."
	@python3 scripts/check_api_consistency.py
	@echo "✓ 文档一致性检查完成"

## Check for broken links
check-links:
	@echo "=== 检查文档链接 ==="
	@find docs -name "*.md" -exec grep -l "](" {} \; | \
	  xargs -I {} bash -c 'echo "Checking {}"; grep -oE "\]\([^)]+\)" {} | \
	  sed "s/\](//;s/)//" | while read link; do \
	    if [[ "$link" =~ ^http ]]; then \
	      curl -s --max-time 5 "$link" > /dev/null || echo "  Broken: $link"; \
	    elif [[ ! -e "$link" && ! -e "docs/$link" && ! -e "$(dirname {})$link" ]]; then \
	      echo "  Missing: $link"; \
	    fi; \
	  done'
	@echo "✓ 链接检查完成"

## Full documentation audit
doc-audit: check-docs check-links
	@echo "=== 文档审计完成 ==="
	@echo "请检查上述输出，修复不一致的文档"
```

## 文档同步脚本

### `scripts/check_doc_consistency.sh`

```bash
#!/bin/bash
# 检查文档与代码配置的一致性

set -e

echo "→ 提取代码中的配置..."

# 从 config.py 提取配置结构
cd backend/peekview

# 提取类名和字段名 (简化版)
echo "发现以下配置类:"
grep "^class.*BaseSettings" config.py | sed 's/class //;s/:.*//'

# 检查 env var 使用一致性
echo ""
echo "→ 检查环境变量命名规范..."

# 检查是否使用了错误的单下划线
grep -n "PEEKVIEW_[A-Z]\+_[A-Z]\+[^_]" config.py | grep -v "__" | grep -v "^#" | head -5 || echo "  ✓ 未发现不规范的 env var 命名"

# 检查文档中是否还有旧的命名
cd ../../
echo ""
echo "→ 检查文档中是否存在旧格式环境变量..."

OLD_VARS=$(grep -hE "PEEKVIEW_(DATA_DIR|DB_PATH|HOST|PORT|API_KEY|CORS_ORIGINS|ALLOWED_PATHS)" \
  README.md CLAUDE.md backend/README.md docs/DEPLOYMENT.md docs/DEBUGGING.md docs/process/*.md 2>/dev/null | \
  grep -v "STORAGE__\|SERVER__\|CLEANUP__\|LIMITS__\|LOGGING__" | \
  grep -v "^#" | head -10)

if [ -n "$OLD_VARS" ]; then
  echo "  ⚠ 发现旧格式环境变量（应使用 __ 分隔符）:"
  echo "$OLD_VARS" | sed 's/^/    /'
else
  echo "  ✓ 所有环境变量使用正确的命名格式"
fi
```

### `scripts/check_api_consistency.py`

```python
#!/usr/bin/env python3
"""Check API documentation consistency with code."""

import re
from pathlib import Path

def extract_api_routes():
    """Extract API routes from backend code."""
    routes = []
    api_dir = Path("backend/peekview/api")

    for file in api_dir.glob("*.py"):
        content = file.read_text()
        # Match @router.get("/path") etc.
        matches = re.findall(r'@router\.(get|post|put|delete|patch)\("([^"]+)"', content)
        for method, path in matches:
            routes.append((method.upper(), path))

    return routes

def check_doc_consistency():
    """Check if all API routes are documented."""
    routes = extract_api_routes()

    print(f"→ 发现 {len(routes)} 个 API 路由:")
    for method, path in sorted(routes):
        print(f"  {method} {path}")

    # Check README files for API examples
    readme_files = [
        "backend/README.md",
        "docs/DEBUGGING.md",
        "docs/DEPLOYMENT.md",
    ]

    print("\n→ 检查文档中的 API 示例...")
    for readme in readme_files:
        if Path(readme).exists():
            content = Path(readme).read_text()
            api_mentions = len(re.findall(r'/api/v\d+/', content))
            print(f"  {readme}: {api_mentions} 处 API 引用")

if __name__ == "__main__":
    check_doc_consistency()
```

## CI 集成建议

### GitHub Actions Workflow

```yaml
# .github/workflows/doc-check.yml
name: Documentation Consistency

on:
  push:
    paths:
      - 'backend/peekview/config.py'
      - 'backend/peekview/api/**'
      - 'backend/peekview/cli.py'
      - '**.md'
  pull_request:
    paths:
      - 'backend/peekview/config.py'
      - 'backend/peekview/api/**'
      - 'backend/peekview/cli.py'
      - '**.md'

jobs:
  doc-consistency:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Check documentation consistency
        run: |
          make check-docs

      - name: Check for broken links
        run: |
          make check-links
```

## 快速参考：常见变更的文档更新清单

### 场景 1: 修改环境变量名

```markdown
## 修改前
PEEKVIEW_DATA_DIR=/tmp/data

## 修改后
PEEKVIEW_STORAGE__DATA_DIR=/tmp/data

### 需要更新的文档
- [ ] README.md - Configuration 章节
- [ ] CLAUDE.md - Configuration 章节
- [ ] backend/README.md - 配置表
- [ ] docs/DEPLOYMENT.md - 环境变量表 + systemd 配置
- [ ] docs/DEBUGGING.md - 环境变量示例
- [ ] docs/process/debug-lessons.md - 相关教训
- [ ] docs/process/debug-workflow.md - 调试流程
- [ ] scripts/dev-server.sh - 启动脚本
- [ ] backend/peekview/cli.py - service install 命令

### 验证
```bash
grep -r "PEEKVIEW_DATA_DIR" . --include="*.md" --include="*.py" --include="*.sh"
# 应只出现在说明 __ 分隔符的文档中，不应出现在实际配置示例中
```
```

### 场景 2: 新增 API 端点

```markdown
## 新增
POST /api/v1/entries/{slug}/share

### 需要更新的文档
- [ ] backend/README.md - API 文档
- [ ] docs/DEBUGGING.md - curl 示例
- [ ] docs/DEPLOYMENT.md - 使用教程（如适用）
- [ ] CHANGELOG.md - 新功能说明

### 验证
```bash
curl -X POST http://localhost:8080/api/v1/entries/test/share
# 应返回预期响应
```
```

### 场景 3: 修改 Makefile target

```markdown
## 修改前
make dev

## 修改后
make debug-start

### 需要更新的文档
- [ ] CLAUDE.md - 常用命令
- [ ] docs/process/debug-workflow.md - 调试流程
- [ ] docs/process/release.md - 发布流程
- [ ] README.md - 开发章节（如适用）

### 验证
```bash
grep -r "make dev" docs/ --include="*.md"
# 应无结果或指向正确的新命令
```
```

## 总结

1. **变更前先分析**: 使用代码-文档映射表确定影响范围
2. **批量更新**: 一次变更所有相关文档，避免遗漏
3. **自动化检查**: 使用 `make check-docs` 验证一致性
4. **纳入检查点**: 将文档同步纳入 P4 一致性检查阶段

**记住**: 文档是代码的契约，两者必须保持一致。
