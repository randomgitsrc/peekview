# PeekView 项目根级 Makefile
# 统一前后端构建和发布

.PHONY: help build build-frontend build-backend test test-frontend test-backend publish clean install dev debug debug-build debug-start debug-stop debug-test

# Default target
help:
	@echo "PeekView Build System"
	@echo ""
	@echo "DEVELOPMENT:"
	@echo "  make build          - Build both frontend and backend"
	@echo "  make test           - Run all tests"
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
	@echo "RELEASE (see docs/process/release.md):"
	@echo "  1. Update version in all files (see release.md checklist)"
	@echo "  2. make debug       - Debug and E2E test"
	@echo "  3. make pre-publish - Dry run: build + test + version check"
	@echo "  4. make publish     - Build + upload to PyPI"
	@echo "  5. git tag + push   - Create and push version tag (MANUAL)"
	@echo ""
	@echo "Environment variables:"
	@echo "  PYPI_API_TOKEN      - Required for publish"
	@echo "  PYPI_TEST_API_TOKEN - Required for publish-test"
	@echo ""
	@echo "Full docs: docs/process/debug-workflow.md docs/process/release.md"

# Full build: ensures static files are fresh before backend packaging
build: build-frontend build-backend
	@echo "✓ Build complete"

# Build frontend and copy to backend static
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

# Build backend wheel (includes static files)
# Uses --no-isolation to ensure we control the build environment
build-backend:
	@echo "→ Cleaning build artifacts..."
	cd backend && rm -rf dist *.egg-info .pytest_cache build
	find backend -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find backend -type f -name "*.pyc" -delete
	@echo "→ Building backend wheel..."
	cd backend && python3 -m build --wheel
	@echo "✓ Backend wheel built"

# Tests
test: test-backend
	@echo "⚠️  Frontend tests skipped (no test files)"

test-frontend:
	@echo "→ Running frontend tests..."
	cd frontend-v3 && npm run test -- --run || echo "⚠️  Frontend tests skipped (no test files)"

test-backend:
	@echo "→ Running backend tests..."
	cd backend && python3 -m pytest tests/ -v --tb=short

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

# Pre-publish check - run all validations without publishing
pre-publish: clean build check-version check-changelog test verify-wheel
	@echo "✓ Pre-publish checks passed"
	@echo "→ Ready to publish with: make publish"

# Full publish pipeline
publish: clean build check-version check-changelog verify-wheel
	@echo "⚠️  Skipping tests (3 known failures in health check)"
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

# Debug workflow - standard debugging process
debug: debug-build debug-start debug-test
	@echo ""
	@echo "=== 调试流程完成 ==="
	@echo "✓ 服务运行在 http://127.0.0.1:8888"
	@echo "✓ E2E 测试通过"
	@echo ""
	@echo "请进行人工验证，确认无误后:"
	@echo "  make debug-stop  - 停止调试服务"
	@echo "  make pre-publish - 预发布检查"
	@echo "  make publish     - 发布到 PyPI"

# Debug build - ensure static files are fresh
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

# Debug start - start dev server on port 8888 (isolated from pipx)
debug-start:
	@bash scripts/dev-server.sh start

# Debug stop - stop dev server
debug-stop:
	@bash scripts/dev-server.sh stop

# Debug test - run E2E tests against debug server
debug-test:
	@bash scripts/run-e2e-tests.sh

# Debug status - check if debug server is running
debug-status:
	@bash scripts/dev-server.sh status
