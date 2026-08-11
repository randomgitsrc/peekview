# P4 progress — TPV0089

## 1. 已读 dispatch-context + implementer 角色定义
- dispatch-context 明确：只改 `frontend-v3/src/utils/path-map.ts`；方案 A 契约；P3 红灯 6 条（BDD-1~5/7 decode 用例）；既有 38 条不回归
- 实现约束：normalizeRef/buildPathMap 零改动；不加注释；不改测试

## 2. 已读 P0-brief.md
- 根因：path-map.ts resolvePath/normalizeRef 缺 decode；markdown-it 自动 percent-encode 非 ASCII src/href
- 环境约束：纯前端单文件改动，禁止启动服务、禁止触碰 :8080/~/.peekview/；自查用 vitest
- BDD 需覆盖中文/日文/重音/空格/韩文等多场景

## 3. 已读 P2-design.md
- 方案 A 全貌：raw 优先（matchRef）→ try/catch decode-once → 无 % 可解返回 null → decode 后重跑 normalizeRef 守卫 → matchRef
- 抽私有 matchRef()：exact → basename 两段查找，返回 number | null
- 红线：BDD-7 decode 不得进 normalizeRef；key 保持 DB 原始文件名
- 需保持 useMarkdown.ts 4 处调用点签名不变

## 4. 已读 P3-test-cases.md
- 红灯 6 条：TC-UNI-01~05/08（BDD-1~5 + BDD-7），失败断言 `expected null to be <fileId>`，为 B 类红灯（被测模块未实现）
- 绿灯 45 条必须保持：既有 38 + BDD-6/8/9（TC-UNI-06/07/09/10）+ 守卫 TC-UNI-11/12/13（decode 后守卫重跑语义，implement 后不能漏 guard 重跑否则变红）
- 关键：TC-UNI-11/12/13 钉死「decode 结果必须重跑 normalizeRef 守卫」——外部/锚点/协议编码形式返回 null

## 5. 已读 path-map.ts（89 行）
- 现状 resolvePath：normalizeRef → pathMap.has(exact) → basename → null
- normalizeRef 守卫正则：`/^(https?:\/\/|data:|blob:|mailto:|tel:|ftp:|\/\/|#)/`，拒绝 `/api/v1/entries/`，`/` 开头取 basename，`./` 剥离
- 需抽 matchRef 复用 exact→basename 两段；resolvePath 加 raw 优先 + decode 兜底 + guard 重跑

## 6. 已读 path-map.test.ts（286 行）
- 单测全貌核对：13 条 unicode 用例 + 既有 38 条
- 逐条核对方案 A 走查：
  - TC-UNI-01~05（中文 path/basename、日文、重音、空格）：raw miss → decode-once → 命中 ✓
  - TC-UNI-06/09（字面 % 精确命中）：raw 优先命中，decode 不触发 ✓
  - TC-UNI-07（畸形 % 空 map）：decode URIError → catch → null ✓
  - TC-UNI-08（a%2520b → a%20b）：decode 一次后命中 key `a%20b.png` ✓
  - TC-UNI-11/12/13（编码锚点/外部 URL/data URI）：decode 后重跑 normalizeRef 守卫 → null ✓

## 7. 已读 useMarkdown.ts L111-134, L293-327
- 4 处调用点（rewriteHtmlRefs L117/L126、image rule L299、link_open L317）均 `resolvePath(ref, pathMap)` 且判 `fileId !== null`
- 签名保持 `(ref: string, pathMap: PathMap) => number | null` 即可零改动

## 8. 实现 path-map.ts

## 9. 实现完成 + 自查
- path-map.ts：matchRef 抽取 + resolvePath raw 优先/decode-once/守卫重跑；normalizeRef/buildPathMap 零改动
- vitest 全绿：51 passed（红灯 6 条变绿，既有 38 + 新增保护 7 条不回归）
- 产出：P4-implementation.md 已写，声明 implementation_dir: frontend-v3/src/utils/
- 无 [DESIGN_GAP]/[SCOPE+]/[CLARIFY]；[PROD_NOT_TOUCHED]
