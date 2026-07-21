@AGENTS.md

## Claude Code 专属
- 大改动前用 plan mode
- mypy strict 配置在 pyproject.toml 但未进 venv，不是门禁。`make lint`（ruff）是唯一本地 lint gate。前端 typecheck（vue-tsc）CI 强制。
