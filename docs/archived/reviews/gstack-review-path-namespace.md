# Path Namespace 映射方案自评审

> 评审框架：gstack review（Staff Engineer + /cso）
> 日期：2026-06-10
> 评审对象：docs/plans/mcp-path-namespace-mapping.md

---

## 评审结论

方案核心设计正确（header 标识区分命名空间、initialize 绑定 session、翻译后走完整安全链）。核查中发现 1 个会影响方案正确性的问题，2 个补充点。

---

## 问题 1（关键）：`~` 展开缺失，且这是现有代码的潜在 bug

**核查发现：** 方案配置示例用了 `host_path: ~/docker-data1`，依赖 `~` 展开为用户家目录。但：

- 现有 `publishFiles.ts:324` 用 `path.resolve(p)` 处理 allowed_paths
- `path.resolve('~/docker-data1')` **不会展开 `~`**，会得到 `<cwd>/~/docker-data1`（一个名为 `~` 的字面目录）
- 代码库里没有 `expandHome` 工具函数

**这不只是新方案的问题——现有 allowed_paths 配 `~/xxx` 本身就不工作。** 用户现在必须配绝对路径（`/home/user/docker-data1`）才有效，配 `~/` 会静默失效。

**影响新方案：** path_namespaces 的 host_path 如果支持 `~`，必须先实现 expandHome；如果不支持，文档必须明确"只接受绝对路径"，与现有 allowed_paths 行为一致。

**建议：**
1. 实现统一的 `expandHome(p)` 工具函数（`p.startsWith('~/') ? path.join(os.homedir(), p.slice(2)) : p`）
2. allowed_paths、path_namespaces 的 host_path 都经过 expandHome
3. **这同时修复了现有 allowed_paths 的 `~` bug**，应作为方案的一部分（顺带修）
4. 或者：明确不支持 `~`，所有路径配置都要求绝对路径，文档强调，配置示例改用绝对路径

推荐方案 1（实现 expandHome），因为 `~` 是用户的自然预期，且顺手修了现有 bug。

---

## 问题 2（中等）：目录翻译后，scanDirectory 内部不能再翻译

**场景：** agent 传的是目录 `/opt/data`（不是单文件）。

```
/opt/data → 翻译 → ~/docker-data1
→ scanDirectory(~/docker-data1) 递归
→ 子文件路径已经是主机真实路径（~/docker-data1/sub/x.md）
→ 不能再翻译（否则二次翻译出错）
```

**确认：** 方案的翻译发生在主循环入口（对 params.paths 里的顶层路径翻译一次），scanDirectory 拿到的已经是翻译后的主机路径，内部不调用 translatePath。这是正确的——但方案文档没有明确说明这一点，实现者可能误在 scanDirectory 里也加翻译。

**建议：** 方案 Step 4 明确标注："translatePath 只对 params.paths 的顶层路径调用一次，scanDirectory 内部不翻译（子路径已是主机真实路径）。"

---

## 问题 3（中等）：错误信息回显翻译后路径可能泄露主机目录结构

**问题：** 决策 5 的错误信息：
```
ERROR: 路径不在允许范围: /opt/data/x.md
  (namespace docker-a → 翻译为 ~/docker-data1/x.md)
```

回显了主机真实路径 `~/docker-data1/x.md`。在 Docker agent 场景下，容器内的 agent 本不应该知道主机的目录布局（这正是容器隔离的意义）。错误信息泄露主机路径，削弱了隔离。

**权衡：** 调试友好 vs 信息泄露。

**建议：** 错误信息只回显容器路径（agent 已知的），主机路径只写服务端日志，不返回给 agent：
```
返回给 agent：ERROR: 路径不在允许范围: /opt/data/x.md (namespace docker-a)
服务端日志：  translated /opt/data/x.md → /home/user/docker-data1/x.md, not in allowlist
```

---

## 补充确认（核查通过的点）

| 点 | 结论 |
|----|------|
| namespace 在 initialize 绑定 session（不每请求传） | 正确，符合 stateful 模式 |
| 翻译后走完整安全链（realpath/denylist/allowlist） | 正确，安全模型不被绕过 |
| unknown namespace 拒绝不 fallback | 正确，避免误读主机文件 |
| 最长前缀匹配 | 正确，避免前缀歧义 |
| namespace 不是安全凭证（伪造也越不了 allowlist） | 正确，安全边界由 allowlist 保证 |
| 各 agent header 支持已查证 | 正确，且标注了 Claude Code issue #14977 风险 |

---

## 修正清单

| 优先级 | 问题 | 修正 |
|--------|------|------|
| 🔴 | `~` 展开缺失（影响新方案 + 现有 bug） | 实现 expandHome，allowed_paths 和 host_path 都用；顺带修现有 bug |
| 🟠 | scanDirectory 不应二次翻译 | 方案 Step 4 明确标注 |
| 🟠 | 错误信息泄露主机路径 | 返回容器路径，主机路径只入日志 |

---

## 评分

| 维度 | 评分 | 说明 |
|------|------|------|
| 核心设计 | 9/10 | header 命名空间机制正确优雅 |
| 安全性 | 8/10 | 安全链完整，错误信息泄露需修 |
| 实现可行性 | 7/10 | ~ 展开是必须先解决的前置问题 |
| 完整性 | 8/10 | scanDirectory 翻译边界需明确 |

综合 8/10，修正 3 点后可实施。

最重要的是问题 1——`~` 展开不仅是新方案需要，还暴露了现有 allowed_paths 配 `~/` 静默失效的 bug，应该一并修复。

---

*自评审完成：2026-06-10*
