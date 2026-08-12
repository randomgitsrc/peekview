---
phase: P2
task_id: T001
parent: P2-design.md
trace_id: T001-P2-review-20260615
reviewer: Staff Engineer + Security Officer (/review + /cso)
---

# P2 设计评审 — T001 MCP Path Namespace Mapping

## status: approved

方案正确，安全模型清晰，改动点最小化。几点确认：

### ✅ 认可

1. **translatePath 只在顶层调用**：scanDirectory 不二次翻译，正确
2. **错误信息用 inputPath 不暴露 hostPath**：通过 logger 分离，正确
3. **expandHome 统一应用**：allowedPaths + namespace host_path 都经过，修复现有 bug 的同时不引入新问题
4. **unknown namespace 400 而非 fallback**：Agent 明确声明了 namespace 却 fallback 是危险的，拒绝是正确选择
5. **namespace 不是安全凭证**：明确，翻译后安全链不变

### 🔍 实现时注意

**SecurityRejection 的第一个参数**：现有代码是 `new SecurityRejection(realPath, ...)`，改为 `new SecurityRejection(inputPath, ...)` 时要确认 SecurityRejection 的错误消息拼接方式——不能让 realPath 从别的地方泄露出去。查一下 SecurityRejection 的构造函数和 catch 块里的错误响应格式。

**isWithinAllowed 里的 path.resolve(base)**：现在 base 经过 expandHome 后还需要 resolve。expandHome 只展开 `~`，不展开相对路径。allowedPaths 里的 base 在 mergeConfig 里用 expandHome 处理后，isWithinAllowed 内部还有一层 `path.resolve(base)`——两者不冲突，但要确认 resolve 顺序正确（expandHome 先，resolve 后）。

**pathNamespaces 环境变量不支持**：文档说明了，合理。namespace 是复杂结构，env var 不适合，只从 file config 读。

### 无 BLOCKER
