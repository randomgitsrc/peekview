.PHONY: dev test test-cov lint build clean

dev:
	uvicorn peek.main:app --host 127.0.0.1 --port 8080 --reload

test:
	python -m pytest tests/ -v --tb=short

test-cov:
	python -m pytest tests/ -v --tb=short --cov=peek --cov-report=term-missing

lint:
	ruff check peek/ tests/
	ruff format --check peek/ tests/

format:
	ruff check --fix peek/ tests/
	ruff format peek/ tests/

build:
	pip install -e ".[test]"

clean:
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -type f -name "*.pyc" -delete
	rm -rf .pytest_cache .coverage htmlcov
