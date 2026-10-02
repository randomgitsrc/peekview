
## P1 revision round 1 (analyst) — 2026-10-02
- 复核 ORM 枚举：`__table__.columns` 得 11 张 table=True 表共 **25 个 datetime 列**（评审 25 正确；先前 model_fields 口径 16 因漏继承 EntryBase 的 expires_at/archived_at/archive_delete_at）。M5 采用 25/11。
- 复核 aware 写入点：entry_service 238/243/817/828/833/857/1058/1360、share_service 60/89/172/182/209/239/269/277/296、team_service 127/157、star_service 144、apikey_service 66/118/151/175、read_tracking 47/60/74/114/115/261 均为 aware 赋列/比较；确认 §2.1 多字段判定依据写反。
- 复核依赖防护：当前无 sqlmodel 上限（pyproject `sqlmodel>=0.0.14`），`make check-version` 仅查包版本一致性(sync_versions.py --check)，无依赖漂移守卫 → BDD-15 需改为「防护存在+注入漂移实测变红」。
- 修订完成：M1（§2.1 三分类 + §4.1.2 aware 清单 b1–b22）、M2（BDD-15）、M3（BDD-17）、M4（BDD-1/BDD-9）、M5（BDD-16 + §4.2 = 25列/11表）、M6（verification_env）全部闭合。BDD 18 条连续无跳号，frontmatter YAML 校验通过。
