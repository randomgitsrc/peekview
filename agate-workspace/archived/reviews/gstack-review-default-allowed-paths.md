# MCP 默认白名单优化方案评审

> 评审框架：gstack review（/cso 安全官 + Staff Engineer）
> 日期：2026-06-09
> 评审对象：docs/plans/mcp-default-allowed-paths.md（v0.7.1）

---

## 总体评价

方案要解决的可用性问题是真实的——v0.7.0 默认只允许 cwd，导致 local 模式"事实上不可用"。零配置体验、错误信息改进、工具描述强化这几个方向都正确。

**但默认白名单扩展到整个 `$HOME` 是一个严重的安全设计问题，必须修正后才能实施。**

---

## Critical Issues

### C1: 默认允许整个 $HOME，但黑名单只挡 4 类路径，大量敏感文件漏网

**问题：** 方案默认白名单 = `cwd + $HOME + /tmp`，安全依赖 `SENSITIVE_PATTERNS` 黑名单兜底。但黑名单只有：
```
.ssh/  .gnupg/  .aws/  .config/gcloud/  *.pem  *.key  *.p12  *.pfx
```

实测 `$HOME` 下以下高敏感文件**全部漏网**（黑名单不拦）：

| 文件 | 内容 | 黑名单 |
|------|------|--------|
| `~/.env` | API 密钥、数据库密码 | ❌ 漏 |
| `~/.git-credentials` | Git 明文凭证 | ❌ 漏 |
| `~/.npmrc` | npm token | ❌ 漏 |
| `~/.pypirc` | PyPI 密码 | ❌ 漏 |
| `~/.netrc` | FTP/HTTP 明文密码 | ❌ 漏 |
| `~/.kube/config` | K8s 集群凭证 | ❌ 漏 |
| `~/.docker/config.json` | 镜像仓库凭证 | ❌ 漏 |
| `~/.config/gh/hosts.yml` | GitHub token | ❌ 漏 |
| `~/.bash_history` | 历史命令（常含密码）| ❌ 漏 |
| `~/.mozilla/.../cookies.sqlite` | 浏览器 cookie | ❌ 漏 |

**攻击场景：** prompt injection 让 agent 调用 `publish_files({paths:["~/.env"]})`，文件被发布到 PeekView（默认 `is_public: true`），凭证泄露到公网链接。

**黑名单是"枚举已知坏路径"，本质上是黑名单防御的经典缺陷——永远列不全。** 用黑名单保护整个 HOME 是不可行的。

**修复方案（二选一）：**

**方案 A（推荐）：默认不含 $HOME，只含 cwd + /tmp 的子目录**
```
默认白名单 = cwd + /tmp
不含 $HOME（HOME 下文件太敏感，要发布需显式配置 allowed_paths）
```
理由：用户在项目目录（cwd）工作，发布项目文件是主场景；`/tmp` 用于 Agent 生成内容暂存。HOME 根目录极少需要直接发布，需要时显式配置。

**方案 B：保留 $HOME，但大幅扩充黑名单 + 加 dotfile 默认拦截**
```
默认拦截所有 $HOME 下的 dotfile/dotdir（以 . 开头）
即 ~/.* 默认全部拒绝，除非显式 allowed_paths
```
这覆盖了绝大多数敏感配置（它们几乎都是 dotfile），同时允许 `~/notes.md` 这类普通文件。

**建议采用方案 A + 方案 B 的 dotfile 拦截**：默认 `cwd + /tmp`，不含 HOME 根；如果将来要支持 HOME，必须配合 dotfile 默认拦截。

---

### C2: /tmp 默认允许，存在 prompt injection 预置文件风险

**问题：** `/tmp` 是全局可写目录（777 + sticky bit）。任何本地用户/进程都能在 `/tmp` 写文件。

**风险：** 多用户机器上，攻击者在 `/tmp/evil.md` 预置内容，诱导 agent 发布；或 agent 被注入后写入 `/tmp` 再发布敏感聚合数据。

**但权衡：** `/tmp` 也是 Agent 生成内容暂存的标准位置（"write_file 到 /tmp 再 publish"的推荐流程依赖它）。

**建议：** `/tmp` 保留在默认白名单，但：
- 文档明确：多用户共享机器上应显式配置 `allowed_paths` 收紧
- 考虑只允许 `/tmp` 下属于当前用户的文件（检查文件 owner == process uid），过滤掉其他用户预置的文件

---

### C3: symlink 绕过——realpath 后仍在 HOME 的敏感文件

**问题：** 方案用 `fs.realpath` 解析符号链接后再检查，这对"指向白名单外"的 symlink 有效（如 `~/link → /etc/shadow`，realpath 后 `/etc/shadow` 不在白名单，被 out_of_scope 拦）。

**但如果默认白名单含 HOME（C1 的问题），`~/link → ~/.kube/config` 这种 realpath 后仍在 HOME 的 symlink，黑名单不拦、白名单允许，照样泄露。**

这是 C1 的衍生问题。修复 C1（HOME 不默认允许）后此问题消失。

---

## Important Issues

### I1: trust_all_paths 仍然只靠黑名单，泄露面巨大

`trust_all_paths: true` 跳过白名单，只剩黑名单。结合 C1 的黑名单缺陷，这等于"几乎裸奔"——`/etc/shadow`（不在黑名单）、`/var/log`、其他用户的 HOME 全部可发布。

方案说"仅推荐本机自用"，但"本机自用"也可能被 prompt injection 利用。

**建议：**
- `trust_all_paths` 的黑名单必须比默认更严格（至少加 `/etc/`, `/var/`, `/proc/`, `/sys/`, `/root/`, 所有 dotfile）
- 启动时打印醒目 warning：`⚠️ trust_all_paths 已启用，仅黑名单保护，请勿在多用户/不可信环境使用`
- 文档标注为"危险选项"

### I2: 默认 is_public=true + 默认宽白名单 = 双重风险叠加

publish_files 的 `is_public` 默认 `true`（继承自 create_entry）。如果默认白名单又宽（HOME），一旦误发敏感文件，直接公网可访问。

**建议：** local 模式下 `publish_files` 的 `is_public` 默认改为 `false`。本地发布的内容默认私有更安全，用户要公开可显式指定。

### I3: 错误信息泄露白名单结构（信息泄露）

改进后的错误信息列出了完整的允许目录：
```
当前允许的基准目录：
  - /home/kity/cclab/test-01 (cwd)
  - /home/kity (HOME)
  - /tmp
```

这对正常用户友好，但 prompt injection 场景下，攻击者通过故意触发错误来探测服务器的目录结构（cwd 在哪、用户名是什么）。

**权衡：** 可用性 vs 信息泄露。建议保留（可用性更重要，且这些信息泄露危害有限），但记录这个权衡。

---

## Minor Issues

- **M1:** 方案 5.2 的 `os.homedir()` 需要 `import * as os`，现有 publishFiles.ts 没 import os，需补
- **M2:** `/tmp` 硬编码，Windows 上无 `/tmp`。应该用 `os.tmpdir()`（跨平台）。但 MCP local 模式主要面向 Unix，可在文档注明 Windows 暂不支持
- **M3:** 测试用例缺少"~/.env 应被拒绝"——这正是 C1 暴露的缺口，必须加测试
- **M4:** `trust_all_paths` + `allowed_paths` 同时配置时的优先级未定义，应明确 trust_all_paths 优先（或报冲突）

---

## Strengths

1. **可用性问题识别准确** — v0.7.0 只允许 cwd 确实太严格
2. **错误信息改进优秀** — 区分黑名单 vs 白名单，给出修复路径，agent-friendly
3. **工具描述强化** — "传文件 vs 传目录"的引导解决了实际误用
4. **向后兼容** — allowed_paths 显式配置行为不变
5. **黑名单始终生效** — 即使 trust_all_paths 也走黑名单（方向对，但黑名单本身要加强）

---

## 修复后才能实施的清单

| 优先级 | 问题 | 修复 |
|--------|------|------|
| 🔴 C1 | HOME 默认允许 + 黑名单漏 | 默认改为 cwd + /tmp，不含 HOME 根；或加 dotfile 默认拦截 |
| 🔴 C2 | /tmp 预置文件风险 | 文档警示 + 考虑 owner 检查 |
| 🟠 I1 | trust_all_paths 裸奔 | 加强黑名单 + 启动 warning |
| 🟠 I2 | is_public 默认 true | local 模式默认改 false |
| 🟡 M3 | 缺敏感文件测试 | 加 ~/.env、~/.git-credentials 等拒绝测试 |

---

## 结论

方案的**可用性改进部分（错误信息、工具描述、零配置体验）全部正确，可以直接实施**。

但**默认白名单的安全设计有 Critical 缺陷**：用黑名单保护整个 HOME 是不可行的（黑名单永远列不全，实测 `.env`/`.git-credentials`/`.kube` 等十余类敏感文件漏网）。

**最小修复：默认白名单去掉 `$HOME`，只保留 `cwd + /tmp`。** 这既解决了 v0.7.0"只有 cwd"的可用性问题（多了 /tmp 用于暂存），又避免了 HOME 敏感文件的大面积暴露。需要发布 HOME 下文件的用户，显式配置 `allowed_paths` 即可。

评分：可用性设计 8/10，安全设计 4/10，综合 **6/10**（修复 C1/C2 后可达 8/10）。

---

*评审完成：2026-06-09*
