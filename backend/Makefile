# ⚠️ WARNING: This Makefile is for backend-only operations
# For full builds including frontend, use the root Makefile:
#   cd .. && make build    # Builds frontend + backend
#   cd .. && make publish  # Full publish pipeline
#
# This file is kept for backward compatibility and quick backend tests.

.PHONY: dev test test-cov lint build clean publish publish-test check-version

dev:
	@echo "⚠️  Note: Frontend changes require 'cd .. && make build-frontend'"
	uvicorn peekview.main:app --host 127.0.0.1 --port 8080 --reload

test:
	python -m pytest tests/ -v --tb=short

test-cov:
	python -m pytest tests/ -v --tb=short --cov=peekview --cov-report=term-missing

lint:
	ruff check peekview/ tests/
	ruff format --check peekview/ tests/

format:
	ruff check --fix peekview/ tests/
	ruff format peekview/ tests/

# ⚠️ Local development install only - does not include fresh frontend build
build:
	@echo "⚠️  Note: This does not rebuild frontend."
	@echo "    Use 'cd .. && make build' for full build."
	pip install -e ".[test]"

clean:
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -type f -name "*.pyc" -delete
	rm -rf .pytest_cache .coverage htmlcov dist/ *.egg-info

# Build package for distribution
build-dist:
	@echo "⚠️  Warning: Ensure frontend is built first with 'cd .. && make build-frontend'"
	python3 -m build

# Check version consistency across files
check-version:
	@python3 scripts/check_version.py

# Publish to PyPI (requires $PYPI_API_TOKEN env var)
# ⚠️ DEPRECATED: Use 'cd .. && make publish' instead
publish: clean check-version build-dist
	@echo "⚠️  Warning: This does not rebuild frontend."
	@echo "    Use 'cd .. && make publish' for complete publish."
	python3 -m twine upload dist/* -u __token__ -p "$(PYPI_API_TOKEN)" --non-interactive

# Publish to TestPyPI (for testing)
# ⚠️ DEPRECATED: Use 'cd .. && make publish-test' instead
publish-test: clean check-version build-dist
	@echo "⚠️  Warning: This does not rebuild frontend."
	@echo "    Use 'cd .. && make publish-test' for complete publish."
	python3 -m twine upload dist/* -u __token__ -p "$(PYPI_TEST_API_TOKEN)" --repository testpypi --non-interactive
