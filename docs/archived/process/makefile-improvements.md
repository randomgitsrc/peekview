# PeekView 改进的 Makefile 发布流程
# 关键改进：
# 1. bump-version 后自动构建并提交静态文件
# 2. 添加 pre-commit 语法验证
# 3. publish 前自动检查未提交的静态文件
# 4. 修复 MCP Server 版本隔离

# =============================================================================
# 改进 1: 完整的 bump-version 流程（包含静态文件）
# =============================================================================

bump-version: NEW_VERSION ?= $(error NEW_VERSION is required)
bump-version:
	@if [ -z "$(NEW_VERSION)" ]; then \
		echo "Usage: make bump-version NEW_VERSION=x.y.z"; \
		exit 1; \
	fi
	@echo "→ Step 1/5: 更新版本号..."
	@# 更新所有版本文件
	sed -i 's/__version__ = "[0-9]\+\.[0-9]\+\.[0-9]\+"/__version__ = "$(NEW_VERSION)"/' backend/peekview/__init__.py
	sed -i 's/^version = "[0-9]\+\.[0-9]\+\.[0-9]\+"/version = "$(NEW_VERSION)"/' backend/pyproject.toml
	sed -i 's/"version": "[0-9]\+\.[0-9]\+\.[0-9]\+"/"version": "$(NEW_VERSION)"/' frontend-v3/package.json
	@# ⚠️ 注意：MCP Server 版本独立，不在这里更新
	@echo "→ Step 2/5: 构建前端..."
	@make build-frontend-fast > /dev/null 2>&1
	@echo "→ Step 3/5: 验证版本一致性..."
	@cd backend && python3 -c "from peekview import __version__; assert __version__ == '$(NEW_VERSION)', f'Version mismatch: {__version__}'"
	@echo "→ Step 4/5: 提交版本和静态文件..."
	@git add -A
	@git commit -m "chore(release): bump to v$(NEW_VERSION)" || true
	@echo "→ Step 5/5: 创建 tag..."
	@git tag "v$(NEW_VERSION)"
	@echo ""
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@echo "✅ bump-version 完成: v$(NEW_VERSION)"
	@echo ""
	@echo "还需手动完成："
	@echo "  1. 编辑 CHANGELOG.md，填写 [$(NEW_VERSION)] 具体变更内容"
	@echo "  2. git add CHANGELOG.md && git commit --amend --no-edit"
	@echo "  3. make publish       # 发布到 PyPI"
	@echo "  4. git push && git push origin v$(NEW_VERSION)"
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# =============================================================================
# 改进 2: 预提交验证
# =============================================================================

check-before-release:
	@echo "→ 检查 Python 语法..."
	@cd backend && python3 -m py_compile peekview/*.py
	@echo "→ 检查 Makefile 语法..."
	@make -n build > /dev/null 2>&1 || (echo "✗ Makefile 语法错误"; exit 1)
	@echo "→ 检查版本一致性..."
	@cd backend && python3 scripts/check_version.py
	@echo "✓ 预提交检查通过"

# =============================================================================
# 改进 3: publish 前检查未提交的静态文件
# =============================================================================

publish: check-before-release
	@echo "→ 检查是否有未提交的静态文件..."
	@if [ -n "$$(git status --porcelain backend/peekview/static/)" ]; then \
		echo "✗ 发现未提交的静态文件，请先运行: make commit-static"; \
		exit 1; \
	fi
	@# 原有 publish 逻辑...

commit-static:
	@echo "→ 提交静态文件..."
	@git add backend/peekview/static/
	@git commit -m "chore(static): update assets for v$$(cd backend && python3 -c 'from peekview import __version__; print(__version__)')" || echo "无变更可提交"

# =============================================================================
# 改进 4: 一键发布（包含完整流程）
# =============================================================================

release: NEW_VERSION ?= $(error NEW_VERSION is required)
release:
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@echo "🚀 开始一键发布流程: v$(NEW_VERSION)"
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@echo ""
	@echo "Step 1: 更新版本并构建..."
	@make bump-version NEW_VERSION=$(NEW_VERSION)
	@echo ""
	@echo "Step 2: 运行测试..."
	@make test-quick
	@echo ""
	@echo "Step 3: 更新 CHANGELOG..."
	@echo "⚠️  请手动编辑 CHANGELOG.md，然后继续"
	@read -p "按 Enter 继续 (或 Ctrl+C 中断)..."
	@git add CHANGELOG.md && git commit --amend --no-edit
	@echo ""
	@echo "Step 4: 发布到 PyPI..."
	@make publish
	@echo ""
	@echo "Step 5: 推送到 GitHub..."
	@git push && git push origin "v$(NEW_VERSION)"
	@echo ""
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@echo "✅ 发布完成: v$(NEW_VERSION)"
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
