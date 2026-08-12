# P2 第二轮工程评审 — 进度留痕

## 评审信息
- task: T082-arch-refactor
- role: plan-eng-review (第二轮)
- 输入: P2-design.md (修订后), P2-review-eng.md (第一轮), P1-requirements.md
- 输出: P2-review-eng.md (覆盖第一轮)

## 验证步骤

### 1. BLOCKER-1 修复验证
- [x] 读取 P2-design.md R3 "entries.py status 验证特殊处理" 段
- [x] 确认：新增 `ParameterValidationError(PeekError)` with status_code=422
- [x] 确认：ValidationError(status_code=400) **不动**，明文声明"不动"
- [x] 确认：ValidationError 被 raise 9 处（share_service.py:55,58,68,79 / entry_service.py:173,175,857 / apikey_service.py:59）——grep 验证
- [x] 确认：设计文档明文列出这 9 处，并说明改 ValidationError.status_code 会导致行为变更
- [x] 确认：ParameterValidationError 仅用于 entries.py:205 新替换点，不追溯已有 ValidationError 调用点
- 结论：BLOCKER-1 **已修复**

### 2. NON-BLOCKER-1 处理验证 (PayloadTooLargeError details)
- [x] 读取 P2-design.md R3 "技术债 TD-T082-001" 段
- [x] 确认：已记录为 TD-T082-001，明文说明不迁移这些字段到 details
- [x] 确认：PeekError 基类 details 字段扩展 + 子类兼容性说明（PayloadTooLargeError.__init__ 调 super().__init__(message) 不传 details，默认 None，向后兼容）
- 结论：NON-BLOCKER-1 **已处理**（记录为技术债）

### 3. NON-BLOCKER-2 处理验证 (FTS 更新时机表述)
- [x] 读取 P2-design.md R4 "FTS 更新时机" 段
- [x] 确认：表述已修正为"FTS 更新仍在 `with Session` 块退出后执行，不受 flush→commit 改动影响"
- [x] 确认：`_update_fts_content` 内部创建自己的 `with Session(self.engine) as session`（line 90 验证）
- [x] 确认：line 325 在 `with Session` 块退出后、IntegrityError 处理之后执行（源码验证）
- 结论：NON-BLOCKER-2 **已处理**

### 4. NON-BLOCKER-3 处理验证 (get_entry_service fallback)
- [x] 读取 P2-design.md R1 "get_entry_service 函数处理" 段
- [x] 确认：明文声明删除 `get_entry_service` 函数（entry_service.py:51-74）
- [x] 确认：grep 验证仅 entries.py:35 和 files.py:169 调用，两者均移除
- 结论：NON-BLOCKER-3 **已处理**

### 5. 新引入问题检查
- [x] 检查 R3 方案 A 修改后是否引入新的不一致
- [x] 检查 PeekError 基类 __init__ 签名变更对已有子类的影响
- [x] 检查 ParameterValidationError 与 ValidationError 并存的语义清晰度
- [x] 发现 apikeys.py `_get_service` + `Depends` 未在 R1 明确处理（范围歧义，非阻塞）
- [x] 发现 entries.py 路由内 `Session(request.app.state.engine)` 未在 R1 处理（BDD 范围外，非阻塞）
- [x] 确认 MCP client 不解析 HTTP 错误响应体（第一轮顾虑已消除）

## 评审结论
- BLOCKER-1: 已修复
- NON-BLOCKER 1-3: 已处理
- 新问题: 2 个非阻塞范围歧义
- status: approved
