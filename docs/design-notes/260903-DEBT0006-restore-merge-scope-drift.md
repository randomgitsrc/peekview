# DEBT0006 复盘：backup/restore merge 模式的表覆盖漂移

> 状态：DRAFT（供排期讨论用，非正式登记文本——正式登记仍以 `agate-workspace/debt/tech-debt.md` 的 DEBT0006 条目为准）
> 日期：2026-09-03
> 范围：`_restore_merge`（`backend/peekview/services/admin_service.py:816-1073`）表覆盖范围与新增数据模型的对齐问题
> 关联：DEBT0006（2026-08-16 登记）、TPV0093（star-lifecycle）、TPV0095（team-visibility）

---

## 1. 问题

`peekview admin backup` 的 restore 有两种模式：`replace`（整库替换）和 `merge`（合并导入，用于"从备份找回部分数据"场景）。`replace` 模式对新表天然安全——它是整个数据库文件级别的替换，不存在遗漏问题。

`_restore_merge` 不同，它是逐表显式编码的：每张要恢复的表都对应一段手写的读取-重建-写入逻辑。这意味着**它只会恢复"写代码的人当时想到的表"**。

当前 `_restore_merge` 覆盖的表，按代码里出现的顺序：

```
users → entries → files → entry_shares → entry_reads → entry_read_stats → api_keys
```

DEBT0006 在 2026-08-16 登记时的问题描述是"漏了 `entry_stars`、`entry_tombstones` 两张表"（TPV0093 引入）。这次核实代码时发现，问题范围比登记文本描述的更大：

- `entry_stars`、`entry_tombstones`：仍然缺失，和登记时一致。
- **`teams`、`team_members`**（TPV0095 新增）：同样完全不在覆盖列表里，登记文本没有跟上。
- **`entries.team_id` 字段**：更隐蔽的一处——`entries` 表本身在覆盖列表里，*表*会被恢复，但 `_restore_merge` 里重建 `Entry` 对象时是逐字段显式构造的（`slug`/`summary`/`status`/`tags`/`is_public`/`owner_id`/`expires_at`），**没有带 `team_id`**。也就是说 entries 数据不是"整表消失"，而是"表恢复了，但其中一个新增字段被静默清空"，比整表缺失更难在测试或人工核查中被发现。

## 2. 影响

三态判据"不修它，当前任务的验收声明会不会变假"——TPV0095 验收用的是全新库走 migration 建表，不经过 merge-restore 路径，所以验收声明本身没有变假，这也是这个缺口没有在 P6 被拦下来的原因。但判据的另一半"会不会让未来变更更贵/更危险"在这里已经从"数据丢失"升级为"权限语义错位"：

- **旧库 → 新版本方向**（无 team 概念的旧备份，merge 到有 team 功间的新库）：安全。`_table_exists` 检查会判定表不存在直接跳过，不会报错，只是恢复不出新数据，属于良性降级。
- **新库 → 新库方向**（有 team 结构的备份 merge-restore 回同样有 team 结构的库）：这是真正的风险场景。用户在 v0.22.0 建了团队、发布了一批 team-visible 内容，做了备份；之后因为误删等原因需要 merge-restore 这份备份找回数据——**`teams`/`team_members` 两张表整体不恢复，`entries.team_id` 字段被清空**。后果不是"这批 entry 消失"，而是这批 entry 会以**丢失了 team 归属**的状态被恢复出来。由于 team-visible entry 在写入时服务端强制 `is_public=false`（见 `docs/design-notes/team-visibility.md` §3.3），team_id 一旦丢失，这批内容的可见性判定会退化为"私有且无归属"——不仅原来的团队成员看不到，连"这是团队内容"这个语义本身也一并消失，且没有任何报错或警告提示用户数据已经发生了这种转变。

对比 star/tombstone 缺口（丢的是"星标状态"和"删除豁免标记"，影响是内容管理层面的），team 缺口丢的是**访问控制的一部分语义**，性质上更接近权限类问题，值得和纯粹的数据完整性问题区别对待。

## 3. 根因

**结构性根因**：`_restore_merge` 是"新增数据模型时容易被遗漏同步"的一类实现——它不像 schema migration 那样有 `check_schema` 做列级别的强制比对（漏改字段会导致启动即报错），merge-restore 的覆盖范围没有任何自动化手段去检测"新表/新字段是否已纳入"，完全依赖写新功能的人记得回头补这一处。

**过程性根因**：TPV0093、TPV0095 两次引入新表的任务，P2 设计阶段都没有把"新表是否需要接入 merge-restore"列为标准检查项。TPV0093 的 P2 设计文档里其实已经提到了这个缺口（DEBT0006 的 evidence 就引用自 `TPV0093-star-lifecycle/P2-design.md`），说明**设计阶段是能想到这一点的**，但想到之后的处理方式是"记一条 debt，标记为已知限制，继续往前走"，而不是"在 closure_criteria 里预留出后续新表接入的扩展点"。这导致 TPV0095 的 P2 阶段面对同样的问题时，没有一个现成的检查清单可以复用，等于每次都要重新意识到这个坑。

**登记文本本身也有滞后**：DEBT0006 的 `closure_criteria` 写的是"补 `entry_stars`/`entry_tombstones` 两表导入"，这个文本从登记那天起就没有再更新过，即使代码里已经又新增了两张表和一个字段。debt 登记如果不随代码变化同步更新范围描述，登记本身会变成"过期快照"——下次真正去做 closure 的时候，很可能只按登记文本里写的两张表去修，修完却发现验收范围其实早就扩大了。

## 4. 解决措施

**短期（登记文本纠偏，成本低，建议随手做）**：
- 更新 DEBT0006 的 evidence / impact / closure_criteria，把 `teams`、`team_members`、`entries.team_id` 三项缺口补进去，而不是保留"只差两张表"的旧描述。
- 在 impact 里明确写出"team_id 丢失会导致可见性语义错位"这一层，和"数据条目丢失"分开描述，方便以后排优先级时不会被"只是丢点数据"这种轻描淡写的措辞误导。

**中期（实际补齐，建议作为一次性任务立项，而非顺手 hotfix）**：
- `_restore_merge` 增补 `teams`、`team_members`、`entry_stars`、`entry_tombstones` 四张表的导入逻辑，以及 `entries` 重建时补上 `team_id` 字段（需要处理好依赖顺序——team 必须先于引用它的 entry 被导入，且 team_id 的旧 ID 需要经过和 entry_map/user_map 类似的映射转换）。
- `RestorePreview` 增加对应的计数字段（`team_count` 等），让 dry-run 阶段就能看到这些数据是否会被恢复，而不是恢复完才发现。
- 补验收用例：至少要覆盖"team-visible entry 经 merge-restore 后 team_id 和可见性语义都保持不变"这一条，而不只是"表能不能恢复"。

**流程性动作（防止同类缺口再次产生）**：
- 把"新增表/新增外键字段时，是否需要接入 `_restore_merge`"作为 P2 设计阶段的标准检查项之一，写进设计文档模板或 review checklist，而不是留给个人记忆。
- 如果某次判断"这张新表不需要接入 merge-restore"（比如它是纯派生/可重建数据），也应该在设计文档里显式写一句"为什么不需要"，避免下一次看到这条 debt 时以为是遗漏而不是有意为之。

## 5. 举一反三

这不是一次孤立的疏漏，而是一类结构性问题的第二次出现——第一次是 TPV0093 引入 star/tombstone，第二次是 TPV0095 引入 team。值得推广的判断：

- **任何"手写字段级别同步逻辑"（而不是"整表/整库级别操作"）的代码路径，都是新增数据模型时的天然盲区**，不止 `_restore_merge` 一处。项目里如果还有类似性质的代码（比如导出功能、跨实例同步脚本，或者任何逐字段序列化/反序列化的地方），都值得排查一遍是否有同样的"新表/新字段默认不覆盖"的风险，而不是等到第三次踩坑才想起来查。
- **debt 登记不是终点，登记文本本身需要跟着代码演进维护**。如果一条 debt 的 evidence/closure_criteria 已经不能准确描述当前代码状态，这条 debt 事实上已经处于"失真"状态——下次讨论排期时,可以把"债务登记文本是否与代码现状一致"作为定期检查的一部分,而不是只在要 close 它的时候才重新核对。
- **"记一条 debt 然后继续往前走"本身没有问题，这是三态判据鼓励的正常路径**，但如果同一类缺口连续两次用这种方式处理，就该考虑是否值得为它补一次性的结构化解法（比如给 P2 设计模板加检查项），把"下次会不会又漏"从"靠记性"变成"靠流程"。这本身也是一次可以套用到🎯一次性结构决策框架里的判断——"现在补一个检查项成本很低，但如果不补，未来每次新增数据模型都要重新交一次学费"。
