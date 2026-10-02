## P2 architect 完成 (2026-10-02)
- 读 P1/P0/P1-review + models.py/pyproject/ci/conftest/star_service
- minimal_validation 完成：修法 A 双版本四路径 8/8 OK；对照确认根因 + NaiveDatetime 0.0.38 不可导入
- 产出 P2-design.md（candidate_count=3，选定方案1：逐列 Column(DateTime(timezone=False)) + 依赖上限守卫）
- check-gate.py P2 结构检查通过（仅缺 P2-review.md 待评审）
