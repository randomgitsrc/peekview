---
phase: P1
task_id: T070
type: review
parent: P1-requirements.md
trace_id: T070-P1-review-20260725-r2
status: approved
created: 2026-07-25
agent: requirements-review
---

## 第一轮必须修改逐项复核

### 1. BDD-7 Then 不可二值判定（"或"字句）→ 已解决

修订后 BDD-7 Then 改为"allowed_paths 被解析为 ["/data", "/tmp"]，不抛出错误"——单一判定，可二值验证（解析结果为数组且无异常 = PASS，否则 = FAIL）。

### 2. BDD-6 与 BDD-1 重复 → 已解决

修订后 BDD-6 重新定义为"cwd=/ 且未配 allowed_paths 时错误信息包含两个原因"（关注错误信息内容），与 BDD-1（关注 publish_files 成功发布）不再重复。

### 3. BDD-5 与 BDD-2 Given/When 重叠需拆分关注点 → 已解决

修订后 BDD-2 Then 改为"返回错误，publish_files 失败"（只关注拒绝行为），BDD-6 Then 改为"错误信息同时包含'cwd 为根目录'和'未配置 allowed_paths'两个原因"（只关注错误信息内容）。关注点已拆分，Given/While 相同但 Then 验证不同维度，可接受。

### 4. BDD-15~19 When 不可二值判定 → 已解决

修订后全部文档 BDD 改为可机械验证形式：
- BDD-18: When "搜索 path_namespaces 相关段落" → Then 不包含错误表述 + 包含正确说明
- BDD-19: When "搜索 allowed_paths 配置说明段落" → Then 同时包含两种格式示例
- BDD-20: When "检查 Docker Compose 示例中的 image 字段" → Then 不包含不存在的镜像名
- BDD-21: When "检查三份文档" → Then 均包含关键词
- BDD-22: When "检查 MCP 接入章节" → Then 包含关键词及配置示例

全部可 grep/搜索验证，可二值判定。

### 5. 缺 trust_all_paths=true + cwd=/ 边界 BDD → 已解决

修订后新增 BDD-5："trust_all_paths=true 且 cwd=/ 时 publish_files 正常工作"。Given 明确（trust_all_paths=true, cwd=/, 未配 allowed_paths），Then 明确（成功发布，trust_all_paths 跳过 CWD guard）。

## 第一轮建议修改逐项复核

### 6. 空 allowed_paths 数组边界 → 已处理

修订后新增 BDD-9："空 allowed_paths 数组等同于未配置"。Given 明确（allowed_paths: [], cwd=/），Then 明确（空数组视为未配置，CWD guard 拒绝）。

### 7. /health 响应格式向后兼容 → 已处理

修订后 BDD-15 Then 包含"且现有字段（status/version）不变"，BDD-16 Then 同样包含"且现有字段（status/version）不变"，BDD-17 Then 也包含"且现有字段（status/version）不变"。

### 8. remote 模式下 /health 语义 → 已处理

修订后新增 BDD-17："MCP Server 运行在 remote 模式"下 /health 的 cwd/allowed_paths 语义。Then 明确"allowed_paths 不适用或为空"。

### 9. config list 输出格式向后兼容 → 已处理

修订后 BDD-12 Then 明确"现有输出字段（server/port/url 等）格式不变，新增字段（cwd/mode/resolved allowed_paths）追加在现有字段之后"。

## BDD 评审（全量）

### BDD-1: 已配 allowed_paths 且 cwd=/ 时 publish_files 正常工作
- 判定: PASS-able
- 覆盖维度: 数据✓ 前端✗(无前端) 多端✗ 边界✓ 兼容✓

### BDD-2: 未配 allowed_paths 且 cwd=/ 时 publish_files 被拒绝
- 判定: PASS-able
- 覆盖维度: 数据✓ 前端✗ 多端✗ 边界✓ 兼容✓

### BDD-3: 已配 allowed_paths 且 cwd 非根目录时行为不变
- 判定: PASS-able
- 覆盖维度: 数据✓ 前端✗ 多端✗ 边界✓ 兼容✓

### BDD-4: 未配 allowed_paths 且 cwd 非根目录时行为不变
- 判定: PASS-able
- 覆盖维度: 数据✓ 前端✗ 多端✗ 边界✓ 兼容✓

### BDD-5: trust_all_paths=true 且 cwd=/ 时 publish_files 正常工作
- 判定: PASS-able
- 覆盖维度: 数据✓ 前端✗ 多端✗ 边界✓ 兼容✓

### BDD-6: cwd=/ 且未配 allowed_paths 时错误信息包含两个原因
- 判定: PASS-able
- 覆盖维度: 数据✓ 前端✗ 多端✗ 边界✓ 兼容✓

### BDD-7: YAML 文件中 allowed_paths 写为冒号分隔字符串时自动解析为数组
- 判定: PASS-able
- 覆盖维度: 数据✓ 前端✗ 多端✗ 边界✓ 兼容✓

### BDD-8: YAML 文件中 allowed_paths 写为数组时正常工作
- 判定: PASS-able
- 覆盖维度: 数据✓ 前端✗ 多端✗ 边界✓ 兼容✓

### BDD-9: 空 allowed_paths 数组等同于未配置
- 判定: PASS-able
- 覆盖维度: 数据✓ 前端✗ 多端✗ 边界✓ 兼容✓

### BDD-10: config list 显示运行时 cwd
- 判定: PASS-able
- 覆盖维度: 数据✓ 前端✗ 多端✗ 边界✓ 兼容✓

### BDD-11: config list 显示 env 覆盖后的最终生效值
- 判定: PASS-able
- 覆盖维度: 数据✓ 前端✗ 多端✗ 边界✓ 兼容✓

### BDD-12: config list 新增字段不改变现有输出格式
- 判定: PASS-able
- 覆盖维度: 数据✓ 前端✗ 多端✗ 边界✓ 兼容✓

### BDD-13: config verify 测试 allowed_paths 文件可读性
- 判定: PASS-able
- 覆盖维度: 数据✓ 前端✗ 多端✗ 边界✓ 兼容✓

### BDD-14: config verify 报告不可读的 allowed_paths
- 判定: PASS-able
- 覆盖维度: 数据✓ 前端✗ 多端✗ 边界✓ 兼容✓

### BDD-15: /health 返回 cwd 和 mode 信息（local 模式）
- 判定: PASS-able
- 覆盖维度: 数据✓ 前端✗ 多端✗ 边界✓ 兼容✓

### BDD-16: /health 返回 allowed_paths 信息（local 模式）
- 判定: PASS-able
- 覆盖维度: 数据✓ 前端✗ 多端✗ 边界✓ 兼容✓

### BDD-17: /health 在 remote 模式下 cwd/allowed_paths 语义正确
- 判定: PASS-able
- 覆盖维度: 数据✓ 前端✗ 多端✓ 边界✓ 兼容✓

### BDD-18: mcp-server/README.md namespace 语义描述正确
- 判定: PASS-able
- 覆盖维度: 数据✓ 前端✗ 多端✗ 边界✗ 兼容✓

### BDD-19: mcp-server/README.md allowed_paths 格式区分配置文件和环境变量
- 判定: PASS-able
- 覆盖维度: 数据✓ 前端✗ 多端✗ 边界✗ 兼容✓

### BDD-20: mcp-server/README.md Docker 示例不使用不存在的镜像名
- 判定: PASS-able
- 覆盖维度: 数据✓ 前端✗ 多端✗ 边界✓ 兼容✓

### BDD-21: 三份 README 均有 Docker 场景指引
- 判定: PASS-able
- 覆盖维度: 数据✓ 前端✗ 多端✗ 边界✓ 兼容✓

### BDD-22: 根 README.md 包含 OpenCode/Cursor 接入示例
- 判定: PASS-able
- 覆盖维度: 数据✓ 前端✗ 多端✗ 边界✗ 兼容✓

### BDD-23: publish_files 工具描述包含 Docker 场景提示
- 判定: PASS-able
- 覆盖维度: 数据✓ 前端✗ 多端✗ 边界✓ 兼容✓

### BDD-24: publish_files 工具描述包含诊断命令提示
- 判定: PASS-able
- 覆盖维度: 数据✓ 前端✗ 多端✗ 边界✓ 兼容✓

## 隐含需求覆盖

### 数据维度
- 覆盖: allowed_paths 字符串→数组（BDD-7）、数组格式（BDD-8）、空数组（BDD-9）、env 覆盖（BDD-11）
- 状态: ✓ 覆盖

### 前端维度
- 覆盖: 正确声明无前端改动
- 状态: ✓ 不适用

### 多端维度
- 覆盖: CLI config list/verify 与 /health 端点行为分别定义（BDD-10~14, BDD-15~17），remote 模式 /health 语义（BDD-17）
- 状态: ✓ 覆盖

### 边界维度
- 覆盖: cwd=/ 场景（BDD-1, BDD-2, BDD-5）、空数组（BDD-9）、trust_all_paths=true + cwd=/（BDD-5）
- 状态: ✓ 覆盖

### 兼容维度
- 覆盖: 修复后行为不变（BDD-3, BDD-4）、/health 现有字段不变（BDD-15~17）、config list 现有格式不变（BDD-12）
- 状态: ✓ 覆盖

## 裁剪评审

- 全阶段不裁剪: 合理（安全相关 P3 必走，多文件 P7 必走，Docker 实测 P6 必走）
- P2 简化: 合理（CWD guard follows_existing_pattern）
- risk_level=medium: 合理

## P1 纯净性

- 隐含需求描述问题不描述实现方案，BDD 只定义行为不定义实现
- "增强现有命令而非新增"是需求方向声明，非实现细节
-细节，可接受
- 判定: 未越界

## 覆盖维度总表

| 维度 | 状态 | 说明 |
|------|------|------|
| 数据 | ✓ 覆盖 | BDD-7/8/9/11 覆盖格式/边界/空值 |
| 前端 | ✓ 不适用 | 正确声明无前端改动 |
| 多端 | ✓ 覆盖 | BDD-17 覆盖 remote 模式 /health 语义 |
| 边界 | ✓ 覆盖 | BDD-5 覆盖 trust_all_paths=true + cwd=/，BDD-9 覆盖空数组 |
| 兼容 | ✓ 覆盖 | BDD-3/4 行为不变，BDD-12/15/16/17 输出格式不变 |

## 结论

**status: approved**

5 项必须修改全部解决：
1. BDD-7 Then 改为单一判定（自动解析为数组，不抛错）
2. BDD-6 重新定义为错误信息内容验证，不再与 BDD-1 重复
3. BDD-2/BDD-6 关注点拆分（拒绝行为 vs 错误信息内容）
4. BDD-18~22 When 改为可机械验证形式（搜索/检查关键词）
5. BDD-5 新增 trust_all_paths=true + cwd=/ 场景

4 项建议修改全部处理：
6. BDD-9 新增空数组边界
7. BDD-15/16/17 Then 声明现有字段不变
8. BDD-17 新增 remote 模式 /health 语义
9. BDD-12 声明现有输出格式不变

[PROD_NOT_TOUCHED]
