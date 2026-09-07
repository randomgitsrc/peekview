# BDD-5 清理失败必须显式失败 — 代码级断言记录（静态证据）

> 验收时点：2026-09-08；被验收代码 = 当前 HEAD 333f5209（P4/P5 后无代码改动）。
> 判据来源：P1 BDD-5 + P3 §4「清理钩子要求」；对照范式 teams-page.spec.ts（P1 §2.3/§3 BDD-5 引用）。

## 1. 断言机制逐行核对（3 spec 同构内联，逐文件亲读）

### mermaid.spec.ts L17-22（afterEach 清理钩子）

```typescript
test.afterEach(async ({ request }) => {
  for (const slug of createdEntries.splice(0)) {
    const del = await request.delete(`${ENTRIES_API}/${slug}`)
    if (![200, 204, 404].includes(del.status())) {
      throw new Error(`cleanup entry ${slug} failed: ${del.status()}`)
    }
  }
})
```

### mermaid-check.spec.ts L16-21 / mermaid-visual.spec.ts L16-21

grep 实证（P6 实跑）：两文件 L16-19 同构存在 `for (const slug of createdEntries.splice(0))` 与
`if (![200, 204, 404].includes(del.status()))`——容忍集与 throw 逻辑逐字符一致。

## 2. BDD-5 判据逐条核对

| P1 BDD-5 判据 | spec 实现 | 判定 |
|---|---|---|
| 清理队列模式（teams-page 范式：创建成功才入队） | `ensureEntry()`：预删（匿名 DELETE，`.catch(() => {})` 容忍不存在）→ POST（`if (![200, 201].includes(resp.status())) throw`）→ **通过后才 `createdEntries.push(slug)`**（mermaid.spec.ts L31-33；同构三 spec） | ✓ |
| afterEach 对队列 splice 无条件逐条删除 | `createdEntries.splice(0)` 先取走队列再逐条 DELETE；钩子语义保证断言失败路径仍执行 | ✓ |
| 删除请求返回 200/204/404 以外的状态码 → afterEach 抛错使用例 FAIL | `throw new Error(\`cleanup entry ${slug} failed: ${del.status()}\`)`——throw 发生在 afterEach 内，Playwright 将其归为该用例失败 | ✓ |
| 不允许静默吞掉清理失败 | 无 try/catch 包裹删除循环；除状态码断言外无任何吞错路径（`.catch(() => {})` 仅存在于**预删**——防御性预删允许 404/失败，不属清理队列） | ✓ |
| 404 视为「已删除」容忍场景 | 容忍集字面量 `[200, 204, 404]` 含 404 | ✓ |
| 认证配对（P1 §2.3：匿名建+匿名删同上下文） | 创建与删除均走 `request` fixture（匿名，无 Authorization header）；队列只存 slug，无 token 字段——结构性杜绝混用 | ✓ |

## 3. teams-page 范式对照（P1 引用的先行实现）

teams-page.spec.ts 清理队列同为「数组队列 + afterEach splice 逐条删除 + 非容忍状态码 throw」
模式；3 spec 为该范式的同构内联复制（P2 design_trivial / follows_existing_pattern 声明一致）。

## 4. 运行佐证（非本条判定必需，作旁证）

BDD-2/3 残留审计（residue-check.log）：两次完整运行后 14 个 fixture slug sqlite count 全部为 0、
`e2e-mermaid%` 全表 0 行——清理钩子在真实运行中实际生效，未出现清理失败路径。

## 5. 判定

BDD-5 判据（队列模式 / splice 无条件 / 非容忍码 throw / 404 容忍 / 认证配对）逐条满足，PASS。

EXIT_CODE: 0
