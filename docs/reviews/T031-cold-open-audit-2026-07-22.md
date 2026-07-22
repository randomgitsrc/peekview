# T031 冷打开体验审计

> 2026-07-22 · 基于 debug 环境截图 + vision 分析

## 审计范围

"冷打开"= 别人收到一个 PeekView 链接，第一次打开时看到什么。这是 T032 数据验证的最高频场景（87% 非自读，全部是浏览器访问）。

## 审计场景

| 场景 | 截图 | 关键发现 |
|------|------|---------|
| 首页（匿名） | `t031-landing.png` | 信息密度好，但 Sign in 视觉权重低 |
| Entry 直接链接（匿名） | `t031-entry-cold-open.png` | **孤岛页面**——无品牌、无导航、无注册入口 |
| Explore 列表（匿名） | `t031-explore-anonymous.png` | 功能可用，但卡片信息密度低，语言不一致 |
| 手机端 entry | `t031-mobile-entry.png` | 同样孤岛，比桌面更缺入口 |

## 核心发现：Entry 详情页是孤岛

**这是冷打开体验最严重的问题。**

一个从未听过 PeekView 的人收到链接 `peek.gsis.top/abc123`，点开后：
1. ❌ 不知道这是什么网站（无品牌标识）
2. ❌ 不知道能注册/登录（右上角无 Sign in）
3. ❌ 不知道怎么去其他页面（无首页链接、无 Explore 入口）
4. ❌ 不知道图标按钮干什么（文件树/TOC/复制/更多 — 无标签无 tooltip）

**结果**：读完就走，转化率为零。

## 问题清单

### 🔴 P0 — 必须修

| # | 问题 | 影响 | 位置 |
|---|------|------|------|
| 1 | Entry 详情页无站点导航 | 冷用户无法离开当前页 | EntryDetailView 顶栏 |
| 2 | Entry 详情页无 Sign in 入口 | 零注册转化 | EntryDetailView 顶栏 |
| 3 | 图标按钮无可发现性 | 功能不可达 | 文件树/TOC/复制/更多 |

### 🟠 P1 — 应该修

| # | 问题 | 影响 | 位置 |
|---|------|------|------|
| 4 | 桌面端不显示 reads 计数（移动端显示） | 行为不一致 | EntryDetailView 元信息区 |
| 5 | Explore 卡片无 summary 预览 | 点击率低 | EntryListView 卡片 |
| 6 | 搜索框中文 placeholder，其余 UI 英文 | 语言不一致 | Explore 搜索框 |
| 7 | 首页 Sign in 视觉权重低 | 注册率低 | LandingView |
| 8 | 移动端 "Files 2" 文案突兀 | 可读性差 | MobileEntryDetail 底栏 |

### 🟡 P2 — 体验优化

| # | 问题 | 影响 | 位置 |
|---|------|------|------|
| 9 | 标签点击无过滤 | 发现能力弱 | Explore 卡片标签 |
| 10 | 无排序选项 | 多 entry 时体验差 | Explore |
| 11 | 作者 @handle 无预览 | 内链断裂 | EntryDetailView |
| 12 | "Explore" 按钮文案模糊 | 冷用户不知去哪 | LandingView |

## 附带发现：database.py 新数据库启动崩溃

审计过程中发现 `database.py` 的 `init_db()` 在全新数据库上崩溃：
- `create_all()` 执行时 models 未导入 → metadata 为空 → 表未创建
- `_run_migrations()` 试图 `PRAGMA table_info(entries)` → no such table → 崩溃
- 旧数据库不受影响（表已存在）
- 修复：在 `create_all()` 前加 `from peekview import models` 确保注册

## 建议下一步

P0 问题（孤岛页面）需要前端改动，应走 agate 流程。修复范围：
- EntryDetailView 顶栏加 PeekView logo（回首页）+ Sign in 链接
- 图标按钮加 tooltip 或文字标签
- 移动端顶栏同样处理

P1/P2 可以后续迭代。
