# 默认白名单方案二次评审

> 评审框架：gstack review（/cso 安全官 + Staff Engineer）
> 日期：2026-06-09
> 评审对象：docs/plans/mcp-default-allowed-paths.md（按一次评审修订后）

---

## 一次评审问题解决情况

| 问题 | 状态 | 说明 |
|------|------|------|
| C1 默认含 $HOME + 黑名单漏 | ✅ 已修 | 默认白名单改为 `cwd + os.tmpdir()`，不含 HOME |
| C2 /tmp 预置文件风险 | ✅ 已修 | 文档警示 + owner 检查（stat.uid === getuid）|
| C3 symlink 在 HOME 内绕过 | ✅ 已修 | C1 修复后，HOME 不在默认范围，问题消失 |
| I1 trust_all_paths 裸奔 | ✅ 已修 | denylist 加 /etc /proc /sys /root /var/log 等 |
| I2 is_public 默认 true | ✅ 已修 | local 模式 publish_files 默认 false |
| M3 缺敏感文件测试 | ✅ 已修 | 测试计划加了 .env/.npmrc 等拒绝用例 |

一次评审的所有 Critical/Important 问题全部正确采纳，修订质量高。

---

## 关键认知：denylist 与白名单的职责分工

修订后的安全模型是**白名单为主，denylist 为辅**：

- **默认模式**（cwd + tmp）：HOME 下的所有敏感文件天然在范围外（out-of-scope），不依赖 denylist
- **denylist 的真正作用**：保护两个场景
  1. `trust_all_paths: true`（跳过白名单，全靠 denylist）
  2. cwd 或 /tmp 内恰好有敏感文件（如项目目录里的 `.env`）

这个分工是合理的——白名单是主防线，denylist 是兜底。但这也意味着 **denylist 的完整性在 `trust_all_paths` 模式下至关重要**。

---

## 当前问题

### 🟠 P1：denylist 在 trust_all_paths 模式下仍有遗漏

实测加强后的 denylist，以下敏感文件**仍漏网**（在 trust_all_paths 模式下会被发布）：

| 文件 | 内容 | 状态 |
|------|------|------|
| `~/.azure/accessTokens.json` | Azure 凭证 | ❌ 漏 |
| `~/.config/sops/age/keys.txt` | SOPS 加密密钥 | ❌ 漏 |
| `~/.terraform.d/credentials.tfrc.json` | Terraform Cloud token | ❌ 漏 |
| `~/.local/share/keyrings/*` | GNOME keyring | ❌ 漏 |
| `*.env`（如 `secrets.env`）| 非 dotfile 的 env | ❌ 漏 |
| `~/.config/Code/User/settings.json` | 可能含 token | ❌ 漏 |

**这印证了一次评审的核心判断：黑名单永远列不全。**

**建议：** 不要追求 denylist 完整（不可能完整），而是改变 `trust_all_paths` 的安全模型：

- `trust_all_paths` 文档明确标注：**此模式下 denylist 是 best-effort，不保证覆盖所有敏感文件**
- 启动 warning 强化：`⚠️ trust_all_paths 跳过目录边界，仅 best-effort 敏感文件过滤，切勿在含密钥/凭证的环境或多用户机器启用`
- 不要给用户"开了 trust_all_paths 还很安全"的错觉

### 🟡 P2：`.env` 正则只匹配 dotfile，漏掉 `*.env` 后缀

```typescript
/\/(?:\.env|\.env\..*)$/   // 只匹配 /.env 和 /.env.xxx
```

`secrets.env`、`config.env`、`production.env` 这类**以 .env 结尾但不是 dotfile** 的文件漏掉了。

**建议：**
```typescript
/(?:^|\/)\.env(?:\.[^/]*)?$/   // dotfile .env / .env.local
/\.env$/                        // 补：任何 *.env 后缀
```

但注意：过于宽泛的 `\.env$` 会误伤 `environment.env`、`test.env` 等可能合法的文件。这是安全 vs 可用性的权衡，建议在 trust_all_paths 下用严格版，默认模式（已有白名单保护）用宽松版。

### 🟡 P3：owner 检查的 race condition（TOCTOU）

方案 3.5 的 `/tmp` owner 检查：
```typescript
stat.uid === process.getuid?.()
```

`stat` 检查和后续 `readFile` 之间存在 TOCTOU 窗口——攻击者可以在检查通过后、读取前替换文件（symlink swap）。

**但风险等级低**：需要本地攻击者精确控制时序，且 realpath 已经做了一层解析。**建议记录为已知限制，不强制在 v0.7.1 修复**（修复需要 open fd 后 fstat，改动较大）。

### 🟡 P4：denylist 顺序——先 realpath 还是先黑名单匹配

方案 3.1 流程：先 realpath，再 denylist。这是正确的（防止 `~/link → ~/.ssh/id_rsa` 用 symlink 绕过文件名匹配）。

但要注意：denylist 里的系统路径模式（`/^\/etc/`）匹配的是 realpath 结果。如果 `/tmp/foo → /etc/passwd`，realpath 后是 `/etc/passwd`，被 `/^\/etc/` 挡住。✅ 正确。

**确认实现时务必对 realpath 后的路径做 denylist 匹配，不是对原始输入。** 方案描述正确，实现需保证。

---

## 其他

### Strengths

1. **采纳一次评审的核心修复** — 默认去掉 HOME，这是最关键的正确决策
2. **白名单为主 denylist 为辅的分层** — 架构合理
3. **trust_all_paths 优先级明确** — 与 allowed_paths 冲突时的行为有定义
4. **is_public 默认 false** — 降低误发即公开的风险
5. **owner 检查** — /tmp 多用户场景的额外防护（虽有 TOCTOU 但聊胜于无）
6. **错误信息区分敏感命中 vs 超范围** — agent/用户友好

### Minor

- **M1：** denylist 正则建议加注释说明每条防什么，便于维护
- **M2：** `os.tmpdir()` 在某些系统返回 `/var/folders/...`（macOS），文档的"/tmp"表述应改为"系统临时目录"
- **M3：** 测试应补 trust_all_paths 模式下 denylist 遗漏项的用例，明确哪些"已知不挡"

---

## 结论

修订版**安全模型从根本上改对了**——白名单为主（默认不含 HOME），denylist 为辅。一次评审的 Critical 问题全部解决。

剩余问题都是 P1/P2 级别，集中在 `trust_all_paths` 模式的 denylist 完整性上。核心建议：

**不要假装 denylist 能完整保护 trust_all_paths。** 它本质是 best-effort，应该在文档和启动 warning 里诚实地说明这一点，而不是给用户安全错觉。默认模式（白名单保护）是安全的，trust_all_paths 是用户主动选择放宽，风险由用户承担。

评分：安全设计 8/10（从一次评审的 4/10 大幅提升），可用性 9/10，综合 **8/10**，可以进入实施。

实施时注意：
1. denylist 对 realpath 后的路径匹配（不是原始输入）
2. trust_all_paths 的 warning 要诚实说明 denylist 是 best-effort
3. owner 检查的 TOCTOU 记录为已知限制

---

*二次评审完成：2026-06-09*
