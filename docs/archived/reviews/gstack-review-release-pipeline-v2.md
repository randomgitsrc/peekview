# 发布流程评审（第二轮）

> 评审框架：gstack review（Staff Engineer）
> 日期：2026-05-20
> 评审对象：`publish-npm.yml`、`Makefile`（fix commit 4502cf0f）

---

## 上轮问题解决情况

| 问题 | 状态 |
|------|------|
| P0-1 workflow_dispatch version input 未使用 | ✅ 已修：加了 Verify version matches input 步骤 |
| P0-2 tag 触发未校验 tag vs package.json 版本 | ✅ 已修：GITHUB_REF_NAME 解析 tag 版本并比对 |
| P1-1 bump-version 强制同步 MCP 版本 | ✅ 已修：新增独立 bump-mcp-version，bump-version 末尾有提示 |
| P1-2 pre-publish-npm 无 dry-run | ✅ 已修：pre-publish-npm 现在包含 --dry-run |
| P2-2 publish-npm-dry 未集成 | ✅ 已修：整合进 pre-publish-npm |
| P2-3 缺 concurrency 控制 | ✅ 已修：加了 concurrency.group: npm-publish |

---

## 当前问题

### 🔴 P0 — 会导致 CI 行为错误

#### P0-1 `matrix` 与 `concurrency` 组合导致串行而非并行测试

**现状：**
```yaml
concurrency:
  group: npm-publish
  cancel-in-progress: false

strategy:
  matrix:
    node-version: ['18', '20']
```

**问题：** `concurrency.group` 作用于 **job 级别**。matrix 展开成两个 job，两个 job 的 concurrency group 名字相同（都是 `npm-publish`），所以：

1. node-18 job 获得锁，开始执行
2. node-20 job 进入队列等待（cancel-in-progress: false 保证不被取消）
3. node-18 job 执行完，node-20 job 才开始

**结果：** matrix 的两个 job **串行执行**，不是并行——加了 matrix 但整体时间翻倍，而不是节省时间。这违背了加 matrix 的初衷。

此外，`fail-fast`（默认 true）和 concurrency queue 在不同层次工作，行为难以预测：node-18 失败时，node-20 可能已经在 concurrency queue 里——是会被取消还是继续执行，取决于 GitHub Actions 的内部调度顺序。

**根本原因：** 发布工作流不应该把"兼容性测试"和"发布"放在同一个 job matrix 里。

**推荐修法：** 拆成两个 job：

```yaml
jobs:
  test:
    name: Test on Node ${{ matrix.node-version }}
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: ['18', '20']
      fail-fast: false      # 两个版本独立测试，不互相取消
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
      - run: cd packages/mcp-server && npm ci
      - run: cd packages/mcp-server && npm run build
      - run: cd packages/mcp-server && npm run test:unit

  publish:
    name: Publish to npm
    needs: test          # 所有 test matrix job 通过后才执行
    runs-on: ubuntu-latest
    environment: npm
    concurrency:
      group: npm-publish
      cancel-in-progress: false
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          registry-url: 'https://registry.npmjs.org'
      - run: cd packages/mcp-server && npm ci
      - name: Verify version matches tag/input
        run: |  # 版本校验逻辑移到这里
      - run: cd packages/mcp-server && npm publish --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

这样：
- node-18 和 node-20 **并行**测试
- 两者都通过后，才触发 publish job
- publish job 只跑一次（node-20），concurrency 控制并发发布

---

### 🟠 P1 — 不影响正确性，但会在维护时踩坑

#### P1-1 `package-lock.json` 版本元数据与 `package.json` 不一致

**现状：**
```
packages/mcp-server/package.json    → version: "0.2.0"
packages/mcp-server/package-lock.json → version: "0.1.0"（顶层和 node 条目）
```

`bump-mcp-version` 只更新 `package.json`，然后运行 `npm run build`（tsc，不跑 `npm install`），`package-lock.json` 的版本字段不会更新。

**影响：**
- `npm ci` 不报错（它只用 lock 文件验证**依赖**版本，不验证包本身版本）
- `npm publish` 发布的是 `package.json` 里的 `0.2.0`（正确）
- 但 lock 文件里的版本元数据是脏的，`git diff` 后看到 lock 文件没变化，开发者可能误以为版本没更新

**Fix：** `bump-mcp-version` 里加一步更新 lock 文件（不安装依赖，只同步元数据）：
```makefile
bump-mcp-version:
    sed -i "s/\"version\": \"[0-9]..." packages/mcp-server/package.json
    # 同步 lock 文件中的顶层 version 字段（仅元数据，不重新解析依赖）
    cd packages/mcp-server && npm install --package-lock-only
    cd packages/mcp-server && npm run build
```

`npm install --package-lock-only` 只更新 `package-lock.json`，不下载任何包，速度很快。

---

#### P1-2 版本校验步骤在 matrix 的每个 node 版本上都运行，但只有 node-20 发布

**现状（已被 P0-1 的拆 job 方案解决，但当前设计下）：**

```yaml
- name: Verify version matches tag
  if: startsWith(github.ref, 'refs/tags/mcp-v')
  # node-18 和 node-20 都运行这个步骤
  
- name: Publish to npm
  if: matrix.node-version == '20'
  # 只有 node-20 发布
```

版本校验在两个 node 版本上各跑一次，但只有一次有意义。等到按 P0-1 拆 job 后，这个问题自然消失。

---

### 🟡 P2 — 细节

#### P2-1 `bump-mcp-version` 不更新 `CHANGELOG.md`，但 `bump-version` 有提示

`bump-version` 末尾提示：
```
还需手动完成：
  1. 编辑 CHANGELOG.md，填写 [x.y.z] 具体变更内容
```

`bump-mcp-version` 末尾提示：
```
还需手动完成：
  1. 编辑 CHANGELOG.md，填写 [mcp-vx.y.z] 变更内容
```

两者都有提示，很好。但 `bump-version` 会调用 `scripts/doc-sync/update_version_docs.py` 自动同步文档版本引用，`bump-mcp-version` 没有等价的自动化步骤。这是有意设计（MCP 文档版本引用较少），但可以在注释里说明原因。

#### P2-2 `release.md` 的 MCP 版本节（6.5 节）仍未更新以反映独立版本管理

`release.md` 第 6.5 节写的是旧流程（当时 MCP 和 Python 共用版本），现在 `bump-mcp-version` 独立后，这一节的步骤描述应该更新：

```markdown
### 6.5 发布 MCP Server 到 npm（如有 MCP 变更）

# 更新版本
make bump-mcp-version NEW_MCP_VERSION=0.3.0

# 预发布检查
make pre-publish-npm

# 发布
make publish-npm
# 或推 tag 触发 CI：
git tag mcp-v0.3.0 && git push origin mcp-v0.3.0
```

---

## 总结

### 评分

| 维度 | 本轮 | 上轮 | 变化 |
|------|------|------|------|
| workflow 正确性 | 6/10 | 5/10 | ↑（版本校验到位，但 matrix+concurrency 设计有误） |
| 版本管理策略 | 9/10 | 5/10 | ↑↑↑（独立 bump-mcp-version，设计清晰） |
| 发布文档完整性 | 8/10 | 8/10 | →（release.md 6.5 节未同步） |
| 自动化质量 | 8/10 | 7/10 | ↑（dry-run 集成，pre-publish-npm 改进） |

**综合：7.5/10**

### 最优先的一件事

**修 P0-1（workflow 拆 job）**——这是本轮唯一的 P0，修法明确（把 matrix 测试和 publish 拆成两个 job，用 `needs: test` 串联），修完后 workflow 才真正达到"并行测试 + 保证质量后发布"的目标。当前设计是并行意图但串行执行，且 concurrency 和 fail-fast 的交互行为难以预测。

---

*评审完成：2026-05-20*
