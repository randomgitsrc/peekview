# P8 Progress — T021 zen-mode

## Step 1: Read release.md ✅
- 流程: bump-version → 手动填 CHANGELOG → amend commit → 构建/验证
- `make bump-version NEW_VERSION=x.y.z` 自动更新 `__init__.py`, `pyproject.toml`, `frontend-v3/package.json`
- bump 后必须手动填 CHANGELOG.md 再 --amend

## Step 2: Current state
- Current version: 0.1.66
- Target version: 0.1.67
- P2 packages: [frontend-v3]
- Git: clean (only untracked T024-T027 dirs and modified active-tasks.md, not related to T021)
- Latest commit: 09567b90 wf(T021-P6): 验收通过
