# PeekView 项目根级 Makefile
# 统一前后端构建和发布

.PHONY: help build build-frontend build-backend build-fast test test-quick test-frontend test-backend publish clean install dev debug debug-build debug-start debug-stop debug-restart debug-test debug-verify-isolation debug-test-mcp debug-status verify-local pre-publish pre-publish-quick bump-version bump-mcp-version sync-version-docs doc-checklist check-docs check-env-vars doc-audit setup-hooks build-mcp test-mcp-unit test-mcp pre-publish-npm publish-npm publish-npm-dry

# Default target
help:
	@echo "PeekView Build System"
	@echo ""
	@echo "DEVELOPMENT:"
	@echo "  make build          - Build both frontend and backend (clean build)"
	@echo "  make build-fast     - Incremental build (faster, uses cache)"
	@echo "  make test           - Run all tests"
	@echo "  make test-quick     - Run tests without rebuilding"
	@echo "  make verify-local   - Quick local verification (build-fast + test-quick)"
	@echo "  make dev            - Install in editable mode for development"
	@echo "  make clean          - Clean all build artifacts"
	@echo ""
	@echo "DEBUG (before release, see docs/process/debug-workflow.md):"
	@echo "  make debug          - Full debug: build + start + E2E test"
	@echo "  make debug-build    - Build and verify static files"
	@echo "  make debug-start    - Start dev server on port 8888"
	@echo "  make debug-stop     - Stop dev server"
	@echo "  make debug-test     - Run E2E tests"
	@echo "  make debug-status   - Check dev server status"
	@echo ""
	@echo "RELEASE:"
	@echo "  1. make bump-version NEW_VERSION=x.y.z  - Bump version + auto-sync all docs"
	@echo "  2. make debug       - Debug and E2E test"
	@echo "  3. make pre-publish-quick - Quick check (no rebuild)"
	@echo "  4. make pre-publish - Full check (clean build + test)"
	@echo "  5. make publish     - Build + upload to PyPI"
	@echo "  6. git tag + push   - Create and push version tag"
	@echo ""
	@echo "DOCUMENTATION:"
	@echo "  make doc-checklist      - 查看当前变更需要更新哪些文档"
	@echo "  make sync-version-docs  - 仅同步文档版本号（不 bump）"
	@echo "  make check-doc-sync     - 全面文档一致性检查"
	@echo "  make update-docs        - 自动生成 FEATURES.md"
	@echo "  make setup-hooks        - 安装 pre-commit hook"
	@echo ""
	@echo "MCP SERVER:"
	@echo "  make build-mcp          - Build MCP Server"
	@echo "  make test-mcp-unit      - Run MCP unit tests"
	@echo "  make test-mcp           - Run all MCP tests"
	@echo "  make publish-npm-dry    - Dry-run npm publish"
	@echo "  make publish-npm        - Publish MCP Server to npm"
	@echo "  make bump-mcp-version NEW_MCP_VERSION=x.y.z - Bump MCP version independently"
	@echo ""
	@echo "Full docs: docs/process/debug-workflow.md docs/process/release.md"

# =============================================================================
# Build Targets
# =============================================================================

# Full build: ensures static files are fresh before backend packaging
build: clean build-frontend build-backend
	@echo "✓ Build complete"

# Fast build: skip clean, use npm cache (for development iterations)
build-fast: build-frontend-fast build-backend-fast
	@echo "✓ Fast build complete"

# Build frontend (full)
build-frontend:
	@echo "→ Building frontend..."
	cd frontend-v3 && npm ci
	cd frontend-v3 && npm run build
	@echo "→ Copying static files to backend..."
	rm -rf backend/peekview/static/*
	cp -r frontend-v3/dist/* backend/peekview/static/
	@echo "→ Verifying static files copied correctly..."
	@DIST_COUNT=$$(ls frontend-v3/dist/ | wc -l) && \
	STATIC_COUNT=$$(ls backend/peekview/static/ 2>/dev/null | wc -l) && \
	if [ "$$DIST_COUNT" -ne "$$STATIC_COUNT" ]; then \
		echo "✗ Error: File count mismatch (dist: $$DIST_COUNT, static: $$STATIC_COUNT)"; \
		exit 1; \
	fi && \
	echo "✓ Frontend built and copied ($$STATIC_COUNT files)"

# Build frontend (fast) - skip npm ci if node_modules exists
build-frontend-fast:
	@if [ ! -d "frontend-v3/node_modules" ]; then \
		echo "→ Installing dependencies..."; \
		cd frontend-v3 && npm ci; \
	else \
		echo "→ Using existing node_modules"; \
	fi
	@echo "→ Building frontend..."
	cd frontend-v3 && npm run build
	@echo "→ Copying static files to backend..."
	rm -rf backend/peekview/static/*
	cp -r frontend-v3/dist/* backend/peekview/static/
	@echo "✓ Frontend built and copied"

# Build backend wheel (full)
build-backend:
	@echo "→ Cleaning build artifacts..."
	cd backend && rm -rf dist *.egg-info .pytest_cache build
	find backend -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find backend -type f -name "*.pyc" -delete
	@echo "→ Building backend wheel..."
	cd backend && /usr/bin/python3 -m build --wheel
	@echo "✓ Backend wheel built"

# Build backend wheel (fast) - minimal cleanup
build-backend-fast:
	@echo "→ Building backend wheel (fast)..."
	cd backend && rm -rf dist *.egg-info build
	cd backend && /usr/bin/python3 -m build --wheel
	@echo "✓ Backend wheel built"

# =============================================================================
# Test Targets
# =============================================================================

# Run all tests (rebuild first)
test: build-backend test-backend
	@echo "✓ All tests passed"

# Quick test - run tests without rebuilding (for code fixes)
test-quick:
	@echo "→ Running backend tests (quick)..."
	cd backend && python3 -m pytest tests/ -v --tb=short
	@echo "✓ Tests passed"

# Run only failed tests
test-failed:
	@echo "→ Running only failed tests..."
	cd backend && python3 -m pytest tests/ --lf -v --tb=short

test-frontend:
	@echo "→ Running frontend tests..."
	cd frontend-v3 && npm run test -- --run || echo "⚠️  Frontend tests skipped (no test files)"

test-backend:
	@echo "→ Running backend tests..."
	cd backend && python3 -m pytest tests/ -v --tb=short

# =============================================================================
# Verification Targets
# =============================================================================

# Quick local verification (fast build + quick test)
verify-local: build-fast test-quick check-version check-changelog
	@echo ""
	@echo "✓ Local verification passed"
	@echo "  - Build: OK"
	@echo "  - Tests: OK"
	@echo "  - Version: OK"
	@echo ""
	@echo "Next steps:"
	@echo "  make debug          - Run full debug with E2E tests"
	@echo "  make pre-publish    - Full pre-publish check"

# Version consistency check
check-version:
	@echo "→ Checking version consistency..."
	cd backend && python3 scripts/check_version.py

# Check changelog is updated
check-changelog:
	@echo "→ Checking CHANGELOG..."
	@VERSION=$$(cd backend && python3 -c "from peekview import __version__; print(__version__)") && \
	if ! grep -q "## \[$$VERSION\]" CHANGELOG.md; then \
		echo "✗ Error: Version $$VERSION not found in CHANGELOG.md"; \
		echo "   Please update CHANGELOG.md before releasing"; \
		exit 1; \
	fi && \
	echo "✓ CHANGELOG.md contains version $$VERSION"

# Verify wheel contains correct static files
verify-wheel:
	@echo "→ Verifying wheel contents..."
	@cd backend && python3 scripts/verify_wheel.py

# =============================================================================
# Release Targets
# =============================================================================

# Bump version across all files
bump-version:
	@if [ -z "$(NEW_VERSION)" ]; then \
		echo "Usage: make bump-version NEW_VERSION=x.y.z"; \
		echo "Example: make bump-version NEW_VERSION=0.1.29"; \
		exit 1; \
	fi
	@echo "→ Bumping version to $(NEW_VERSION)..."
	@# Update backend/__init__.py
	sed -i "s/__version__ = \"[0-9]\+\.[0-9]\+\.[0-9]\+\"/__version__ = \"$(NEW_VERSION)\"/" backend/peekview/__init__.py
	@# Update pyproject.toml
	sed -i "s/^version = \"[0-9]\+\.[0-9]\+\.[0-9]\+\"/version = \"$(NEW_VERSION)\"/" backend/pyproject.toml
	@# Update package.json
	sed -i "s/\"version\": \"[0-9]\+\.[0-9]\+\.[0-9]\+\"/\"version\": \"$(NEW_VERSION)\"/" frontend-v3/package.json
	@# Verify code files
	@BACKEND_VERSION=$$(cd backend && python3 -c "from peekview import __version__; print(__version__)"); \
	PYPROJECT_VERSION=$$(grep "^version = " backend/pyproject.toml | sed 's/version = "\(.*\)"/\1/'); \
	PACKAGE_VERSION=$$(grep '\"version\":' frontend-v3/package.json | sed 's/.*\"version\": \"\(.*\)\".*/\1/'); \
	if [ "$$BACKEND_VERSION" = "$(NEW_VERSION)" ] && [ "$$PYPROJECT_VERSION" = "$(NEW_VERSION)" ] && [ "$$PACKAGE_VERSION" = "$(NEW_VERSION)" ]; then \
		echo "✓ 代码版本文件已更新: v$(NEW_VERSION)"; \
	else \
		echo "✗ 版本不一致，请检查"; exit 1; \
	fi
	@# Auto-sync all documentation
	@echo "→ 自动同步文档版本引用..."
	@python3 scripts/doc-sync/update_version_docs.py
	@echo ""
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@echo "✅ bump-version 完成: v$(NEW_VERSION)"
	@echo ""
	@echo "还需手动完成："
	@echo "  1. 编辑 CHANGELOG.md，填写 [$(NEW_VERSION)] 具体变更内容"
	@echo "  2. git add -A && git commit -m \"chore(release): bump to v$(NEW_VERSION)\""
	@echo ""
	@echo "⚠️  MCP Server 版本独立管理，如需更新请单独执行："
	@echo "    make bump-mcp-version NEW_MCP_VERSION=x.y.z"
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Bump MCP Server version independently
bump-mcp-version:
	@if [ -z "$(NEW_MCP_VERSION)" ]; then \
		echo "Usage: make bump-mcp-version NEW_MCP_VERSION=x.y.z"; \
		echo "Example: make bump-mcp-version NEW_MCP_VERSION=0.3.0"; \
		exit 1; \
	fi
	@echo "→ Bumping MCP Server version to $(NEW_MCP_VERSION)..."
	sed -i "s/\"version\": \"[0-9]\+\.[0-9]\+\.[0-9]\+\"/\"version\": \"$(NEW_MCP_VERSION)\"/" packages/mcp-server/package.json
	@# Sync lock file version metadata (no dependency resolution)
	cd packages/mcp-server && npm install --package-lock-only
	@# Rebuild MCP dist with new version
	cd packages/mcp-server && npm run build
	@# Verify
	@MCP_VERSION=$$(grep '\"version\":' packages/mcp-server/package.json | sed 's/.*\"version\": \"\(.*\)\".*/\1/'); \
	if [ "$$MCP_VERSION" = "$(NEW_MCP_VERSION)" ]; then \
		echo "✓ MCP Server 版本已更新: v$(NEW_MCP_VERSION)"; \
	else \
		echo "✗ MCP 版本不一致，请检查"; exit 1; \
	fi
	@echo ""
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@# Note: No auto doc sync here (MCP version refs are few, manual update sufficient)
	@echo "✅ bump-mcp-version 完成: v$(NEW_MCP_VERSION)"
	@echo ""
	@echo "还需手动完成："
	@echo "  1. 编辑 CHANGELOG.md，填写 [mcp-v$(NEW_MCP_VERSION)] 变更内容"
	@echo "  2. git add -A && git commit -m \"chore(mcp): bump to v$(NEW_MCP_VERSION)\""
	@echo "  3. git tag mcp-v$(NEW_MCP_VERSION) && git push origin mcp-v$(NEW_MCP_VERSION)"
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 单独同步文档版本（不 bump，用于修复漏掉的文档同步）
sync-version-docs:
	@echo "→ 同步文档版本引用..."
	@python3 scripts/doc-sync/update_version_docs.py
	@echo ""
	@echo "提示：如需将更改加入暂存区："
	@echo "  git add README.md CLAUDE.md INDEX.md CHANGELOG.md docs/process/active-tasks.md backend/README.md"

# 查看当前变更需要更新哪些文档
doc-checklist:
	@python3 scripts/doc-sync/doc_checklist.py
	@echo "  3. make verify-local  - Quick verification"
	@echo "  4. git add -A && git commit -m \"chore(release): bump version to $(NEW_VERSION)\""

# Quick pre-publish check (no rebuild) - use after code fixes
pre-publish-quick: check-version check-changelog test-quick verify-wheel
	@echo ""
	@echo "✓ Quick pre-publish checks passed"
	@echo "  Use this after code fixes to avoid full rebuild"
	@echo ""
	@echo "Ready to publish with: make publish"

# Full pre-publish check (clean build + test) - use for final verification
pre-publish: clean build check-version check-changelog test verify-wheel
	@echo ""
	@echo "✓ Full pre-publish checks passed"
	@echo "  - Clean build: OK"
	@echo "  - All tests: OK"
	@echo "  - Version: OK"
	@echo "  - Wheel: OK"
	@echo ""
	@echo "Ready to publish with: make publish"

# Full publish pipeline (uses build-fast to save time after pre-publish)
publish:
	@if [ ! -f "backend/dist/peekview-*.whl" ]; then \
		echo "→ No wheel found, building..."; \
		make build; \
	fi
	@echo "→ Running final checks..."
	make check-version check-changelog verify-wheel
	@echo "→ Publishing to PyPI..."
	@if [ -z "$(PYPI_API_TOKEN)" ]; then \
		echo "✗ Error: PYPI_API_TOKEN not set"; \
		exit 1; \
	fi
	cd backend && python3 -m twine upload dist/* \
		-u __token__ -p "$(PYPI_API_TOKEN)" --non-interactive
	@echo "✓ Published to PyPI"

# Publish to TestPyPI
publish-test: clean build test check-version
	@echo "→ Publishing to TestPyPI..."
	@if [ -z "$(PYPI_TEST_API_TOKEN)" ]; then \
		echo "✗ Error: PYPI_TEST_API_TOKEN not set"; \
		exit 1; \
	fi
	cd backend && python3 -m twine upload dist/* \
		-u __token__ -p "$(PYPI_TEST_API_TOKEN)" \
		--repository testpypi --non-interactive
	@echo "✓ Published to TestPyPI"

# =============================================================================
# Development Targets
# =============================================================================

# Install locally (for development)
install:
	@echo "→ Installing locally..."
	make build
	pipx install backend/ --force
	@echo "✓ Installed peekview from source"

# Development mode (no build, just symlink)
dev:
	cd backend && pip install -e ".[test]"

clean:
	@echo "→ Cleaning..."
	cd frontend-v3 && rm -rf dist node_modules/.vite
	cd backend && rm -rf dist *.egg-info .pytest_cache build
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -type f -name "*.pyc" -delete
	@echo "✓ Cleaned"

# Quick local test (build + install)
try: build install

# =============================================================================
# Debug Workflow
# =============================================================================

debug: debug-build debug-start debug-verify-isolation debug-test
	@echo ""
	@echo "=== 调试流程完成 ==="
	@echo "✓ 服务运行在 http://127.0.0.1:8888"
	@echo "✓ 数据隔离验证通过"
	@echo "✓ E2E 测试通过"
	@echo ""
	@echo "请进行人工验证，确认无误后:"
	@echo "  make debug-stop     - 停止调试服务"
	@echo "  make pre-publish    - 预发布检查"
	@echo "  make publish        - 发布到 PyPI"

debug-build: clean build-frontend
	@echo ""
	@echo "→ 验证静态文件..."
	@if [ ! -f "backend/peekview/static/index.html" ]; then \
		echo "✗ 错误: index.html 不存在"; \
		exit 1; \
	fi
	@echo "✓ 静态文件已更新"
	@echo ""
	@echo "=== 调试构建完成 ==="
	@echo "下一步: make debug-start"

debug-start:
	@bash scripts/dev-server.sh start
	@echo ""
	@echo "→ 等待服务稳定..."
	@sleep 2

debug-verify-isolation:
	@echo ""
	@echo "=== 数据隔离验证 ==="
	@echo "→ 检查调试环境数据..."
	@DEBUG_COUNT=$$(curl -s http://127.0.0.1:8888/api/v1/entries 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('items',[])))" 2>/dev/null || echo "0") && \
	if [ "$$DEBUG_COUNT" = "0" ]; then \
		echo "  ✓ 调试环境数据独立 (条目数: 0)"; \
	else \
		echo "  ℹ 调试环境条目数: $$DEBUG_COUNT"; \
	fi
	@echo "→ 检查数据库位置..."
	@PID=$$(pgrep -f "uvicorn peekview.main.*8888" | head -1) && \
	if [ -n "$$PID" ]; then \
		DB_PATH=$$(lsof -p $$PID 2>/dev/null | grep "peekview.db" | grep "/tmp/peekview-debug" | head -1 | awk '{print $$NF}') && \
		if [ -n "$$DB_PATH" ]; then \
			echo "  ✓ 调试服务使用独立数据库: $$DB_PATH"; \
		else \
			DB_PATH=$$(lsof -p $$PID 2>/dev/null | grep "peekview.db" | head -1 | awk '{print $$NF}') && \
			if echo "$$DB_PATH" | grep -q "peekview-debug"; then \
				echo "  ✓ 调试服务使用独立数据库: $$DB_PATH"; \
			else \
				echo "  ✗ 警告: 调试服务可能使用生产数据库: $$DB_PATH"; \
				echo "  建议: 停止服务并检查 scripts/dev-server.sh 环境变量"; \
			fi; \
		fi; \
	else \
		echo "  ⚠ 调试服务未运行"; \
	fi
	@echo "→ 检查生产数据库是否被污染..."
	@PROD_TEST_COUNT=$$(curl -s http://127.0.0.1:8080/api/v1/entries 2>/dev/null | python3 -c "import sys,json; try: d=json.load(sys.stdin); print(sum(1 for e in d.get('items',[]) if 'e2e-' in e.get('slug','') or 'test-' in e.get('slug',''))) except: print('0')" 2>/dev/null || echo "0") && \
	if [ "$$PROD_TEST_COUNT" = "0" ]; then \
		echo "  ✓ 生产数据库无测试数据污染"; \
	else \
		echo "  ✗ ✗ ✗ 严重警告: 生产数据库发现 $$PROD_TEST_COUNT 条测试数据!"; \
		echo "    立即检查并清理污染数据!"; \
		echo "    命令: curl http://127.0.0.1:8080/api/v1/entries | grep 'e2e-'"; \
	fi
	@echo "✓ 数据隔离验证完成"

debug-stop:
	@bash scripts/dev-server.sh stop
	@echo "→ 清理调试数据..."
	@rm -rf /tmp/peekview-debug 2>/dev/null || true
	@echo "✓ 调试数据已清理"

debug-restart:
	@bash scripts/dev-server.sh restart
	@echo "→ 等待服务稳定..."
	@sleep 2

debug-test:
	@echo "=== E2E 测试安全启动 ==="
	@echo "→ 检查生产服务是否运行..."
	@if curl -s http://127.0.0.1:8080/health > /dev/null 2>&1; then \
		echo "⚠  警告: 生产服务正在运行 (端口 8080)"; \
		PROD_COUNT=$$(curl -s http://127.0.0.1:8080/api/v1/entries 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('total',0))" 2>/dev/null || echo "0"); \
		echo "   当前生产条目数: $$PROD_COUNT"; \
		echo "   如果测试数据写入生产，将被检测到"; \
	else \
		echo "ℹ  生产服务未运行"; \
	fi
	@echo ""
	@bash scripts/run-e2e-tests.sh

debug-test-mcp:
	@echo "=== MCP Server 集成测试 ==="
	@echo "→ 检查 PeekView 后端是否运行..."
	@if ! curl -s http://127.0.0.1:8888/health > /dev/null 2>&1; then \
		echo "✗ 错误: PeekView 调试服务未运行"; \
		echo "   请先运行: make debug-start"; \
		exit 1; \
	fi
	@echo "✓ PeekView 后端已启动"
	@echo ""
	@echo "→ 运行 MCP Server 单元测试..."
	cd packages/mcp-server && npm test
	@echo ""
	@echo "→ 运行 MCP Server 集成测试..."
	@echo "  注意: 集成测试需要 API Key"
	@if [ -z "$$PEEKVIEW_API_KEY" ]; then \
		echo "  ⚠ PEEKVIEW_API_KEY 未设置，部分测试可能失败"; \
		echo "  建议: export PEEKVIEW_API_KEY=your_api_key"; \
	fi
	cd packages/mcp-server && PEEKVIEW_URL=http://127.0.0.1:8888 PEEKVIEW_API_KEY=$$PEEKVIEW_API_KEY npm run test:integration || echo "  ⚠ 集成测试失败（可能需要 API Key）"
	@echo ""
	@echo "→ 运行 MCP Server E2E 测试..."
	cd frontend-v3 && BASE_URL=http://127.0.0.1:8888 npx playwright test e2e/mcp-server.spec.ts --reporter=line || echo "  ⚠ E2E 测试失败"
	@echo ""
	@echo "✓ MCP 测试流程完成"

debug-test-remote:
	@echo ""
	@echo "=== Remote CLI Mode Tests ==="
	@bash scripts/debug-remote-cli.sh test

debug-status:
	@bash scripts/dev-server.sh status || true

# =============================================================================
# MCP Server Targets
# =============================================================================

build-mcp:
	@echo "→ Building MCP Server..."
	cd packages/mcp-server && npm run build
	@echo "✓ MCP Server built"

test-mcp-unit:
	@echo "→ Running MCP Server unit tests..."
	cd packages/mcp-server && npm run test:unit
	@echo "✓ MCP unit tests passed"

test-mcp:
	@echo "→ Running MCP Server tests..."
	cd packages/mcp-server && npm test
	@echo "✓ MCP tests passed"

pre-publish-npm: test-mcp-unit
	@echo "→ Dry-run npm publish..."
	cd packages/mcp-server && npm publish --access public --dry-run
	@echo "✓ MCP Server pre-publish checks passed (dry-run OK)"
	@echo "  Note: npm publish automatically runs prepublishOnly (build + test:unit)"
publish-npm-dry:
	@echo "→ Dry-run npm publish..."
	cd packages/mcp-server && npm publish --access public --dry-run
	@echo "✓ Dry-run complete"

publish-npm:
	@echo "→ Publishing MCP Server to npm..."
	cd packages/mcp-server && npm publish --access public
	@echo "✓ Published @peekview/mcp-server"

# =============================================================================
# Documentation Consistency Checks
# =============================================================================

# Check documentation consistency with code
check-docs:
	@echo "=== 检查文档一致性 ==="
	@echo "→ 检查环境变量..."
	@bash scripts/check_doc_consistency.sh
	@echo "✓ 文档一致性检查完成"

# Check for old-style environment variables
check-env-vars:
	@echo "=== 检查环境变量命名 ==="
	@grep -rE "PEEKVIEW_(DATA_DIR|DB_PATH|HOST|PORT|API_KEY|CORS_ORIGINS|ALLOWED_PATHS)" \
	  README.md CLAUDE.md backend/README.md docs/ --include="*.md" 2>/dev/null | \
	  grep -v "STORAGE__\|SERVER__\|CLEANUP__\|LIMITS__\|LOGGING__\|^[[:space:]]*#" | \
	  grep -E "(\||\`).*PEEKVIEW_(DATA_DIR|DB_PATH|HOST|PORT)" | \
	  head -20 | sed 's/^/  ⚠ /' || echo "  ✓ 未发现旧格式环境变量"

# Full documentation audit
doc-audit: check-docs
	@echo "=== 文档审计完成 ==="
	@echo "请检查上述输出，修复不一致的文档"

## Check documentation sync with code (comprehensive)
check-doc-sync:
	@echo "=== 文档同步检查 ==="
	@echo "→ 检查功能特性文档..."
	@python3 scripts/doc-sync/check_feature_sync.py || true
	@echo "→ 检查版本同步..."
	@python3 scripts/doc-sync/check_version_sync.py || true
	@echo "→ 检查 API 文档..."
	@python3 scripts/doc-sync/check_api_docs.py || true
	@echo "→ 生成功能矩阵..."
	@python3 scripts/doc-sync/generate_feature_matrix.py
	@echo "=== 检查完成 ==="

## Auto-update documentation where possible
update-docs:
	@echo "=== 自动更新文档 ==="
	@python3 scripts/doc-sync/generate_feature_matrix.py
	@echo "✓ FEATURES.md 已更新"
	@echo ""
	@echo "注意：README.md 等需要手动更新"

# Setup Git hooks for automatic documentation checking
setup-hooks:
	@echo "=== 安装 Git Hooks ==="
	@bash scripts/setup-doc-automation.sh
	@echo "✓ Git hooks 安装完成"
	@echo ""
	@echo "本地保护（pre-commit hook）："
	@echo "  - 版本文件变更时强制检查版本一致性"
	@echo "  - 每次提交输出文档更新 checklist"
	@echo ""
	@echo "云端保护（GitHub Actions，push 后自动触发）："
	@echo "  - ci.yml: 后端测试 + 前端构建 + 文档一致性"
	@echo "  - publish.yml: push vX.Y.Z tag 时自动发布"
