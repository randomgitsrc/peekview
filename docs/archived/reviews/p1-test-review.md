# spec-html-render P1 测试成果 — 专家评审

> Reviewer: Independent Reviewer (QA / Security / Testing)
> Date: 2026-05-18
> Subject: HTML render P1 test suite (36 test cases)
> Files: HtmlViewer.spec.ts (13) + HtmlViewerIntegration.spec.ts (8) + html-render.spec.ts (15)

---

## 总体评分

| 维度 | 评分 | 说明 |
|------|------|------|
| 覆盖范围 | ⭐⭐⭐⭐⭐ | P1 定义的所有项目都有测试，无明显遗漏 |
| 测试质量 | ⭐⭐⭐⭐ | 逻辑清晰，但有 2 个设计问题需改进 |
| 正向/反向平衡 | ⭐⭐⭐⭐⭐ | 安全 negative test 设计很完整 |
| 代码可读性 | ⭐⭐⭐⭐⭐ | 注释充分，测试数据意图清晰 |
| Mock 策略 | ⭐⭐⭐⭐⭐ | URL mock 干净，大文件 provide injection 很聪明 |

**整体能推进到 P2 代码实现。** 有 2 个设计问题需要在 P2 实现并行修正，不阻塞 P1 验收。

---

## 详细评审

### ✅ 做得好的地方

**1. Blob URL 内存泄漏检查完整**

三个 test case 覆盖了内存泄漏的全场景：挂载时创建、卸载时释放、content 变更时旧 URL 释放。Mock 策略也干净——`vi.fn()` 追踪调用，而不是真实创建 Blob 对象。

**2. iframe sandbox 反向测试很严格**

不仅验证了 `allow-scripts` 存在，还用 4 个 negative assert 确认危险权限都被禁掉：

```javascript
expect(sandbox).not.toContain('allow-same-origin')
expect(sandbox).not.toContain('allow-forms')
expect(sandbox).not.toContain('allow-popups')
expect(sandbox).not.toContain('allow-top-navigation')
```

这是 defensive testing 的正确做法，能防止未来有人不小心加回权限时测试无声失败。

**3. 相对路径检测的测试数据设计清晰**

在同一个 HTML fixture 里混合相对路径（3 个）和非相对路径（CDN + data URI），让计数逻辑的意图一眼就清楚，也能同时测试"计入什么"和"不计入什么"。

**4. 大文件 mock 策略聪明**

通过 `provide: { __testContentSize: 3 * MB }` 注入虚假大小，避免在 jsdom 里真实分配 2MB+ 字符串导致测试超时。测试逻辑（分支判断）和测试环境限制（内存/速度）解耦，是高质量测试工程的体现。

**5. E2E 安全测试用真实攻击代码**

```javascript
const HTML_SANDBOX_ESCAPE_ATTEMPT = `
<script>
  try {
    window.parent.document.cookie
    document.title = 'ESCAPE_SUCCESS'
  } catch(e) {
    document.title = 'SANDBOX_INTACT'
  }
  try {
    top.location.href = 'https://evil.com'
  } catch(e) {
    document.body.innerHTML = 'top.location blocked'
  }
</script>`
```

不是单纯验证 attribute，而是真实执行攻击代码再验证结果。这才是有效的安全测试，通过了就能说明沙盒确实在运行时生效。

---

### 🟠 ISSUE-1（HIGH）：HtmlViewerIntegration.spec 的"渲染分支测试"没有真正验证分支

**位置：** `HtmlViewerIntegration.spec.ts` lines 92–116

**问题：**

这个 describe 块叫"渲染分支 isHtml computed（store 层验证）"，但实际测试是这样写的：

```javascript
it('HTML 文件：activeFile.language 为 html', () => {
  store.$patch({ activeFile: makeFile({ language: 'html' }) })
  expect(store.activeFile?.language).toBe('html')
})
```

这只是在验证 `store.$patch` 能设置值——是在测试 Pinia 框架本身，不是在测试业务逻辑。`isHtml` 这个 computed（应该在 `EntryDetailView.vue` 里定义）完全没有被碰到。

测试注释解释了原因："完整的渲染分支切换由 E2E 覆盖"——但既然如此，这个 describe 块就是纯粹的冗余，它提供的保护是零。

与此同时，E2E 里的 `TC-HTML-030` 和 `TC-HTML-031` 确实验证了多文件切换时渲染方式正确切换，这才是真正覆盖了分支逻辑。

**修复建议：**

删掉 `HtmlViewerIntegration.spec.ts` 的 lines 92–116（`渲染分支 isHtml computed` describe 块），因为 E2E 已经覆盖，不需要在集成层用无效测试重复。保留 lines 52–86（`canWrap store` 测试），那部分是真正有价值的单元验证。

如果将来想在集成层覆盖渲染分支，正确方式是真实挂载 `EntryDetailView`（带 router + pinia），不 mock 子组件，验证不同 `language` 时对应的 Viewer 出现/消失。但这属于 P3 范围，不是 P1 阻塞项。

---

### 🟡 ISSUE-2（MEDIUM）：大文件三段式缺少边界值（512KB 和 2MB）测试

**位置：** `HtmlViewer.spec.ts` lines 200–258

**问题：**

当前测试覆盖了三段的中间值：
- 小文件：`SIMPLE_HTML`（几百字节）
- 中文件：`600 * 1024`（600KB，在 512KB~2MB 区间内）
- 大文件：`3 * MB`（在 >2MB 区间内）

**缺失的边界值：**
- 恰好 `512 * 1024` 字节时，应显示警告（检查 `>=` 还是 `>`）
- 恰好 `2 * 1024 * 1024` 字节时，应不自动渲染（检查 `>=` 还是 `>`）

边界值是 off-by-one bug 的高发区，尤其是 `>= 512KB` 和 `> 512KB` 在语义上相差一个字节。

**修复建议（加两个测试）：**

```javascript
it('恰好 512KB：显示性能警告，自动渲染', async () => {
  const wrapper = mount(HtmlViewer, {
    props: { content: SIMPLE_HTML },
    global: { provide: { __testContentSize: 512 * 1024 } },
  })
  await flushPromises()
  expect(wrapper.find('[data-testid="size-warning"]').exists()).toBe(true)
  expect(wrapper.find('iframe').exists()).toBe(true)
})

it('恰好 2MB：不自动渲染，显示手动触发按钮', async () => {
  const wrapper = mount(HtmlViewer, {
    props: { content: SIMPLE_HTML },
    global: { provide: { __testContentSize: 2 * 1024 * 1024 } },
  })
  await flushPromises()
  expect(wrapper.find('iframe').exists()).toBe(false)
  expect(wrapper.find('[data-testid="manual-render-btn"]').exists()).toBe(true)
})
```

这两个测试的实现成本极低（复制改数字），收益是明确了 `=` 边界的行为意图，也防止了实现时 `>` 写成 `>=` 后测试无法发现。

---

### 🟡 ISSUE-3（MEDIUM）：TC-HTML-SEC-001 的断言方式有脆弱性

**位置：** `html-render.spec.ts` lines 250–266

**问题：**

```javascript
// iframe 内脚本执行失败，title 应为 SANDBOX_INTACT
const iframe = page.frameLocator('iframe.html-frame')
const title = await iframe.locator('title').textContent().catch(() => '')
expect(title).not.toBe('ESCAPE_SUCCESS')
```

有两个问题：

1. **`title` 可能是空字符串**，因为沙盒内的脚本可能完全没有机会执行（比如 Blob URL 加载失败或时序问题），此时 `title` 也不是 `'ESCAPE_SUCCESS'`，测试通过了，但是安全性没有被真正验证。应该同时断言 `title` **等于** `'SANDBOX_INTACT'`，这才是正向确认沙盒生效。

2. **`catch(() => '')` 吞掉了错误**，如果 `frameLocator` 找不到 frame 或 `title` 不可访问，测试会通过（因为空字符串不等于 `'ESCAPE_SUCCESS'`），但这时候实际上是测试环境的问题，不是沙盒验证通过。

**修复建议：**

```javascript
test('TC-HTML-SEC-001: iframe 内无法读取父页面 cookie', async ({ page, context }) => {
  await context.addCookies([{
    name: 'sensitive_token', value: 'super_secret',
    domain: 'localhost', path: '/',
  }])
  await page.goto('/e2e-html-security')
  await waitForIframe(page)
  await page.waitForTimeout(500)

  const iframe = page.frameLocator('iframe.html-frame')
  // 正向断言：脚本执行后 title 应为 SANDBOX_INTACT
  // 如果这行失败说明要么沙盒逃逸成功，要么测试环境有问题（两者都不应该通过）
  await expect(iframe.locator('title')).toHaveText('SANDBOX_INTACT', { timeout: 3000 })
})
```

这样任何一种失败（逃逸成功、脚本未执行、frame 找不到）都会让测试失败，不再有"假通过"的可能。

---

### 🟢 ISSUE-4（LOW）：TC-HTML-003 验证 CDN 加载的断言太弱

**位置：** `html-render.spec.ts` lines 110–118

**问题：**

```javascript
test('TC-HTML-003: CDN 外链资源正常加载', async ({ page }) => {
  await page.goto('/e2e-html-cdn')
  await waitForIframe(page)

  const iframe = page.frameLocator('iframe.html-frame')
  await expect(iframe.locator('#cdn-heading')).toBeVisible()
})
```

这个测试只验证了"有一个 `#cdn-heading` 可见"，但**没有验证 Tailwind CDN 的样式实际生效**。即便 CDN 脚本加载失败（比如网络问题），`#cdn-heading` 仍然可见（只是没样式），测试照样通过。

如果目的是验证 CDN 加载成功，应该检查样式是否生效：
```javascript
// 验证 Tailwind 的 text-2xl 确实被应用（说明 CDN 加载成功）
const heading = iframe.locator('#cdn-heading')
const fontSize = await heading.evaluate(el => getComputedStyle(el).fontSize)
expect(parseFloat(fontSize)).toBeGreaterThan(18) // text-2xl = 1.5rem ≈ 24px
```

不过，这个测试的真实目的可能只是"确认 CDN 外链不被 sandbox 阻断（iframe 正常渲染）"，如果是这个意图，那当前的测试就够了——但应该把测试名改为 `TC-HTML-003: CDN 外链不被 sandbox 阻断，页面正常渲染`，让意图更精确。

**修复建议：** 修改 test 名称明确意图，或者加样式断言。二选一即可，不阻塞 P2。

---

### 🟢 ISSUE-5（LOW）：E2E 测试依赖 `page.waitForTimeout(500)` 的硬等待

**位置：** `html-render.spec.ts` lines 261, 271

**问题：**

```javascript
await page.waitForTimeout(500)
```

硬等待是 E2E 测试的反模式：
- 在快机器上可能是浪费
- 在慢 CI 机器或弱网络环境可能等不够，导致 flakiness

安全测试里 500ms 是等 iframe 内脚本执行完。更稳定的方式是等一个可观测的 DOM 状态：

```javascript
// 等 iframe 内 body 出现预期文字，表示脚本已执行
const iframe = page.frameLocator('iframe.html-frame')
await expect(iframe.locator('body')).toContainText('top.location blocked', { timeout: 3000 })
```

这样既消除了硬等待，又让等待条件有语义。

---

## 问题汇总与优先级

| 编号 | 级别 | 文件 | 建议 |
|------|------|------|------|
| ISSUE-1 | 🟠 HIGH | HtmlViewerIntegration.spec.ts | 删除无效的"渲染分支 store 层验证"describe 块 |
| ISSUE-2 | 🟡 MEDIUM | HtmlViewer.spec.ts | 补充 512KB 和 2MB 边界值测试 |
| ISSUE-3 | 🟡 MEDIUM | html-render.spec.ts | TC-HTML-SEC-001 改为正向断言 `SANDBOX_INTACT` |
| ISSUE-4 | 🟢 LOW | html-render.spec.ts | TC-HTML-003 明确意图（改名或加样式断言） |
| ISSUE-5 | 🟢 LOW | html-render.spec.ts | 安全测试用 DOM 等待替代硬等待 |

---

## P1 验收结论

**P1 测试成果通过评审，可以推进 P2。**

ISSUE-1（冗余测试）和 ISSUE-3（断言脆弱性）建议在 P2 实现开始前修掉，因为：
- ISSUE-1 影响测试套件的可读性和维护性，趁现在测试少改代价最低
- ISSUE-3 是安全测试的假通过风险，修复后才能对沙盒验证有信心

ISSUE-2 可以在 P2 开发中并行修，改动极小（加两个 test case）。

ISSUE-4 和 ISSUE-5 随手改即可，不影响 P2 时间线。
