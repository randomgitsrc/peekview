# P3-progress — TPV0104 test-designer

- 05:49:38 读完 dispatch-context + test-designer.md + P1（54 BDD）+ P2（1071 行）+ P2-review（W1-W6/G11/G12/N5/R2-1/R2-2）
- 05:49:38 环境实测：debug :8888 = 200、:8080 = 000、HEAD=519321ab；seed id：k8s-deployment 13/14/15、unicode-filenames 31/34、dsh-architecture 4
- 05:49:38 测试分层规划完成：vitest 6 文件 / pytest 3 文件 / e2e 2 文件 / legacy 9 处迁移
- 06:01:37 vitest 批 1-5 写完并自跑：default-file(8F/1P)、csv-constructed-rows(4F/4P)、table-truncation(3F/4P)、real-file-bytes(2F/5P)、source-scan(5F/1P)、markdown-headings(4F/2P) — 全部 assertion-only
- 06:01:37 pytest test_tpv0104_inject_budget.py 写完并自跑：10F/3P，失败原因全为「报表块不存在 / _MAX_INJECT_IDS 关系不成立」classic assertion
- 06:04:54 pytest test_entry_file_order.py 写完自跑：3F/1P（assert 构造序≠字典序失败，非 collection error）
- 06:04:54 e2e tpv0104-viewer-hardening.spec.ts（BDD-01~06/08~12/14~23/24~31/42/44/48~54）与 tpv0104-mobile-bar-widths.spec.ts（360/375/390 三档）已落地
- 06:06:28 全量 make test-frontend：30 failed / 1475 passed / 4 skipped，7 个失败文件全为本任务新增 spec（无既有用例回归）
- 06:07:11 check-tdd-red.py：classic red-light (assertion failures only)，exit 0 → P3 gate 通过
- 06:07:11 check-platform-assumptions.py 两个新 pytest 文件均 0 命中
- 06:07:11 3 个 legacy spec firstFileId 迁移完成：viewer 2 / t091 4 / tpv0099 3 = 9 处归零
- 06:14 P3-test-cases.md 落盘：54/54 BDD 映射（脚本核对 missing=none / extra=none），test_code_dir 已声明
- 06:14 P3-test-code/ 归档副本 11 文件（vitest 7 / e2e 2 / pytest 2）
- 06:14 make typecheck exit 0（constructedRows 类型放宽用 constructedRowsOf() + 代码级锁 type 成员）
- 06:14 make test-frontend 最终读数：7 failed files / 31 failed / 1475 passed / 4 skipped（失败文件全部为本任务新增 spec）
- 06:14 后端取证命令：13 failed / 49 passed，全部 assertion failure，零 collection error
- 06:14 check-tdd-red.py exit 0 = classic red-light；check-platform-assumptions.py 0 命中
- 06:14 debug anon total = 15（基线未变）、e2e-tpv0104* 残留 0；未 commit
