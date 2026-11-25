## P7 consistency-reviewer progress

| # | 检查项 | 结论 |
|---|---|---|
| 1 | DESIGN_GAP 配对（6 条） | 逐条核对 P4 原文 + 代码现状，6 条裁定：5 accepted / 1 accepted(改进)；已备 6 条 DESIGN_GAP_REVIEWED |
| 2 | SCOPE+ 闭环（2 条） | :512 已实现（syncUrl 对每个出口调用，代码实测）；:737 判**登记技术债**（独立复现存储层同名覆盖，唯 inlined 计数口径需修正） |
| 3 | 跨文件一致性 | BDD 54==54==54；P2 packages 三包 vs VERSIONS.json 两版本源（frontend-v3 无独立版本）；P4 实现路径 vs batches.output 有 2 处越界（已核） |
| 4 | 未决项清零 | P1 行首 [NEED_CONFIRM]/[BLOCKER]/[DEVIATION-CRITICAL] = 0；P6 NEED_CONFIRM = 0 |
| 5 | CODE-MAP 核对 | `agents/CODE-MAP.md` 不存在 → WARNING 跳过；P4 2 条 CODE_MAP_EXEMPT 计入 frontmatter |
| 6 | 架构决策落点 | `{AGATE_WORKSPACE}/decisions/` 不存在 → WARNING 跳过；仅 `agents/project.md` 在 |
| — | 独立复现：存储层同名覆盖 | `.agate-tmp/p7-m2-independent.py`（进程内临时 app）：DB 2 行 / 磁盘 1 个 app.css(48B) / 两条记录均读到 PNG 内容 → P4 对 :737 根因判断**成立** |
| — | 独立复现：`inlined` 口径 | 同素材 render 报表 `requested=2 inlined=1 skipped=[id3 not_injectable]`，但响应 `<style>` 内实为 PNG 字节、文本 CSS 未进入 → 「报表准确」仅在计数层成立，语义层有落差（记 WARNING 并入技术债） |
| — | 独立复现：C2 根因 | `python3 -c "len('İ'.lower())"` = 2（源串 1）→ `lower()` 非保长确认；`finditer[-1]` 保 `rfind` 末个语义，P4-review §5 亦自认原建议有缺陷 |
| — | 独立核验：DG4 可达性 | 跨 entry id / 不存在 id / 0 / 负数 全部 404 → `content` 恒 null；`entry.files` 为全量 → `targetFile.id === fileId` 守卫为**防御性**，P4 所述失效形态当前不可复现 |
| — | gate 路径判定 | `task_level=2` → `check-gate.py P7` 走 `_gate_p7_structured`（成对声明聚合），须在 frontmatter 写 design_gaps/design_gap_reviews/scope_plus/scope_resolved 等；正文行首禁 `[BLOCKER]`/`[DEVIATION-CRITICAL]` |
| — | 自检：gate | `check-gate.py P7 $TASK_DIR` → **[exit code: 0]**「成对声明聚合判据通过」 |
| — | 自检：旧格式兼容 | `count_p7_markers` = (0,0)；`count_design_gap(P7)` = (0,0)；行首 `[BLOCKER]`/`[DEVIATION-CRITICAL]` = 0；跨文件关键词 ✓ |
| — | 自检：配对闭合 | 6 条 `DESIGN_GAP_REVIEWED`（DG1–DG6）；`design_gaps`≡`design_gap_reviews`；`scope_plus`≡`scope_resolved`；`code_map`≡`code_map_reviewed`（2/2） |
| — | 自检：红线 | P1 未改（`git status` 无 P1）；e2e spec 未改；`~/.peekview/` mtime 仍 2026-11-12；`:8080` = 000；未 commit |
| — | 结论 | **BLOCKER: 0 / CRITICAL: 0**；WARNING 5 + NOTE 2，全部不阻断；→ 可进 P8 |
