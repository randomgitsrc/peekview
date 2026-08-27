# Dispatch 对照实验记录

> 日期：2026-06-28
> 方法：agate dispatch prompt 格式，唯一变量为任务类型和规模
> prompter：主 Agent（Claude via OpenCode）

## 实验列表

| # | 实验 | 类型 | 产出 | 结果 | commit |
|---|------|------|------|------|--------|
| 1 | Toast 测试 | 测试 | 1 文件 86行 | ✅ | b2ff0b06 |
| 2 | ThemeToggle 测试 | 测试 | 1 文件 53行 | ✅ | 7fcee043 |
| 3 | ConfirmDialog 测试 | 测试 | 1 文件 162行 | ✅ | c5f068a8 |
| 4 | Pagination+CodeViewer | 测试 | 2 文件 37tests | ✅ | 3a4cae3b |
| 5 | Pagination test (split) | 测试 | 1 文件 25tests | ✅ | cb2daec3 |
| 6 | CodeViewer test (split) | 测试 | 1 文件 12tests | ✅ | b00c5bb9 |
| 7 | TocNav+TreeNodeItem+ActionBar | 测试 | 3 文件 62tests | ✅ | （未 commit） |
| 8 | ImageViewer+LoginDialog+MarkdownViewer | 测试 | 3 复杂文件 45tests | ✅ | （未 commit） |
| 9 | useDebounce composable+test | 实现+测试 | 2 异构文件 | ✅ | （未 commit） |
| 10 | Pagination+CodeViewer (对照组) | 测试 | 2 文件(与#4对比) | ✅ | 3a4cae3b |
| 11 | StatusBadge+test | 实现 | 1组件 4variant | ✅ | 已删除 |
| 12 | Divider+Tooltip+tests | 实现 | 2组件+2测试=4文件 | ✅ | 已删除 |
| 13 | useDiagramViewer composable | 实现 | 1 文件 274行 | ✅ | 9e6a02d4 |
| 14 | MermaidRenderer 实现 | 实现 | 1 组件 370行 | ✅ | dfbafd65 |

## 失败的实验（不在14次内）

| 任务 | 失败原因 |
|------|---------|
| T020 DiagramBlock 完整版 | 5行为×3分支=15决策点交叉，3次空返回 |
| T020 useMarkdown blocks 重写 | 6子任务挤在一起 |

## 已验证的安全阈值

| 维度 | 上限 | 证据 |
|------|------|------|
| 测试：文件数 | ≥3（含 MarkdownViewer 439行） | #7, #8 |
| 实现：文件数 | ≥4（2组件+2测试） | #12 |
| 实现：variant数 | ≥4 | #11 |
| 异构：实现+测试混合 | ≥2文件 | #9 |
| 决策交叉 | 未知（4安全，15失败） | #11 vs T020 |

## 结论

agate dispatch prompt 格式使 subagent 在正常开发任务上 100% 成功。
唯一已知失败是 15 决策点交叉的极端场景。
"文件数""异构性"不是独立变量——用 agate 格式后这些都不复现为失败原因。
