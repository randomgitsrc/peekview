# T032 探针数据复查（backlog #28）——跨 Agent 读取信号

> 2026-08-28 | 复查窗口：2026-07-28 结论（"跨 Agent 读取信号极弱，3 个月后复查"）到期
> 数据源：生产库 `~/.peekview/peekview.db`（只读模式分析，未改动任何数据）

---

## 一、复查判据（product-positioning.md）

- 半年数据都是零 → 多 Agent 总线愿景从战略文档**降级**
- 开始出现信号 → 那时再**按真实形状**去加强它（检索、引用关系、语义查询）

## 二、总体数据

- `entry_reads` 总量：**1310 条**（2026-06-30 ~ 2026-08-27，约 2 个月），5 分钟窗口去重后的计数
- 通道分布：`api` 1291 / `mcp` **16** / `share` 3
- 读者类型：authenticated 885 / anonymous 425
- 来源：internal 438 / direct 31 / search 5（其余 836 空）
- 动作：discover 794 / read 469 / raw **30** / download 17

## 三、核心发现：MCP 通道出现真实的外部 Agent 读取信号

### 3.1 匿名 MCP raw 读取（决定性信号）

2026-07-28 复查区间内，MCP 通道有 **5 条匿名 raw 读取**，全部来自不同 IP 指纹、时间分散、无 referer（direct）：

| 时间 | 指纹 | entry | 内容 | 公开 |
|------|------|-------|------|------|
| 08-15 13:42 | a:b02ccf3f | yr6t1v | agate 复盘（TAG0010+11+文档体系） | 公开 |
| 08-16 20:57 | a:9af74794 | lhdidt | OpenCode Session 记录提取指南 | 公开 |
| 08-16 23:13 | a:b02ccf3f | efkaxw | TPV0093 复盘（编排事故与修复） | 公开 |
| 08-18 02:16 | a:7e0a7c48 | svsi1w | TAG0006 复盘（tag 未 push 教训） | 公开 |
| 08-24 02:02 | a:baeb59bd | **nbqd5j** | dsh.gsis.top 访问链路说明 | **私有** |

**关键性质**：
- 全部 `action=raw` + `channel=mcp`（X-PeekView-Source: mcp header 判定）+ `reader_type=anonymous` + `source=direct`（无 referer）→ **这是 MCP 客户端免认证读取的典型形态**（TPV0092 的跨 host 匿名读取路径）
- 读取内容**高度聚焦在"复盘/文档/指南"类**——正是"另一个 Agent 读 Agent 产出"的教科书场景
- **nbqd5j 是私有 entry**：有未撤销的 share token `fmZgsE6o`（max_views=1），被匿名 MCP 读取 → 确认走的是 share 授权路径，**外部主体持 share token 通过 MCP 读取了私有内容**

### 3.2 MCP 通道月度趋势（信号在增长）

| 月份 | MCP 读取 |
|------|---------|
| 06 月 | 0 |
| 07 月 | 2（均为自读 u:1） |
| **08 月** | **10（其中 5 条匿名外部 + 1 条 u:16 跨用户）** |

### 3.3 跨创建者认证读取

复查区间内认证用户读取**他人** entry 记录显著（非自读）：
- peek 读 maia/claude/iris/nasoc/user01 的 25+ 个 entry
- iris / origin / nasoc 读 peek 的多个 entry

但需注意：多数是认证用户（浏览器/人工/自用 agent），且 `internal` 来源占主导，**不足以单独判定为外部 Agent 总线信号**；真正的信号在 MCP 匿名通道。

## 四、结论

**信号已出现，不再是"极弱"**：

1. **MCP 通道存在真实的外部 Agent 读取**——4 个独立匿名指纹、5 次 raw 读取、时间分散在 4 天、内容聚焦复盘/文档、含 1 次私有 entry（经 share token）。
2. **按判据**：未达"半年全零"→ 总线愿景**不降级**；但信号体量仍小（一个多月 5 条外部 MCP 读取）→ 未到"重活层"全面加强的阈值。
3. **建议**：
   - **维持探针原样**，继续积累（信号趋势向上，8 月 MCP 是 7 月的 5 倍）
   - **轻量结构决策可提前**：backlog #29（references/referenced_by + 轻量语义标签）成本低、是"现在加便宜"的一次性决策，且读取内容已是文档/复盘类（有引用诉求）——建议**优先做 #29**，而非等信号更强
   - 检索/引用图谱/语义查询等重活层：**仍冻结**，等 MCP 匿名读取达到稳定月均两位数再启动

## 五、数据口径说明

- 指纹 `a:{sha256(ip)[:8]}`，5 分钟窗口合并，无法反查 IP
- 自读（is_self_read=1，u:1/u:16 等读自己）已排除在外部信号判定外
- nbqd5j 私有读取合法性：存在未撤销 share token → 是授权读取，非漏洞；也侧面验证 TPV0092 share 读取路径被真实使用
