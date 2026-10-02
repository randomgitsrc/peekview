# P4 progress — implementer

- [read] P4-dispatch-context + P2-design §0/§2.1/§2.2 + implementer.md
- [read] models.py L1-1120（列定义落点确认）
- [read] pyproject.toml（sqlmodel L28）
- [read] P3 测试文件（test_datetime_naive_compat.py / test_dependency_guard.py）——只读不改
- [plan] 25 列：EntryBase(3) UserBase(1) User(2) Team(2) TeamMember(1) ApiKey(4)
         Entry(2) EntryShare(3) EntryRead(2) EntryStar(1) EntryTombstone(1)
         EntryReadStats(2) File(1) = 25
- [edit] models.py: import 补 DateTime；25 列改 Column(DateTime(timezone=False), ...)
- [edit] pyproject.toml: sqlmodel>=0.0.14,<1.0.0
- [verify] ORM 枚举 = 25 列，全 timezone=False
- [verify] 0.0.47 / 0.0.38 定向 13 passed exit 0
- [verify] 0.0.47 / 0.0.38 全量 exit 0；ruff peekview/ 干净；platform-assumptions 0 命中
- [out] P4-implementation.md
