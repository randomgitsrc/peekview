---
phase: P8
task_id: T024-landing-page
type: release
parent: P6-acceptance.md
status: done
created: 2026-06-28
---

# P8 发布 — T024 landing-page

## 版本
bump to v0.2.5

## 包含
- T023: 404 兜底页 + 删除 HomeView
- T024: LandingView + /explore 路由 + beforeEach 守卫 + EntryDetailView 修正
- CHANGELOG 已更新

## 发布步骤
1. `make bump-version NEW_VERSION=0.2.5` ✅
2. `CHANGELOG.md` 填写完成 ✅
3. `git commit --amend` ✅
4. tag v0.2.5 已创建
5. `make publish` 待用户执行
