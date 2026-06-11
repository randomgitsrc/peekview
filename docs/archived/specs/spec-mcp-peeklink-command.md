# /peeklink 斜杠命令设计

> 日期：2026-05-24
> 场景：用户主动发布本地文件到 PeekView，不需要 Claude 推理介入

---

## 定位

`/peeklink` 是 Claude Code 的自定义斜杠命令，**完全绕过 Claude 的推理链**，直接调用 `peekview create` CLI。

适用场景：用户明确知道要发布什么，不需要 Claude 判断或组织内容。

| 工具 | 适用场景 | 速度 |
|------|---------|------|
| `/peeklink` | 用户主动发布，路径明确 | 秒级，无推理开销 |
| `publish_files` MCP 工具 | Agent 自主决策发布 | 秒级（MCP 读文件） |
| `create_entry` MCP 工具 | Agent 发布自己生成的内容 | 正常推理时间 |

---

## 用法

```
/peeklink <路径> [路径2 ...]
```

路径支持相对路径（基于项目根目录）和绝对路径：

```
/peeklink src/main.py
/peeklink src/
/peeklink .
/peeklink src/main.py docs/README.md
```

**路径解析规则：**
- 自动检测 git 根目录作为项目基准：`$(git rev-parse --show-toplevel)`
- 未在 git 仓库中时，使用当前工作目录 `$PWD`
- 相对路径基于检测到的项目根目录解析
- 绝对路径直接使用

---

## 实现

**文件**：`.claude/commands/peeklink.md`

```markdown
---
description: Publish files to PeekView instantly (no AI processing)
---

Run this shell command:

PATHS="$ARGUMENTS"
if [ -z "$PATHS" ]; then
  echo "Usage: /peeklink <path> [path2 ...]"
  exit 1
fi

# 检测项目根目录（git 根目录或当前目录）
PROJECT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
cd "$PROJECT_ROOT"

# 生成 summary：取第一个路径的 basename，多路径时加计数
FIRST=$(echo $PATHS | awk '{print $1}')
COUNT=$(echo $PATHS | wc -w)
if [ "$COUNT" -gt 1 ]; then
  SUMMARY="$(basename $FIRST) + $((COUNT-1)) more"
else
  SUMMARY="$(basename $FIRST)"
fi

peekview create $PATHS --summary "$SUMMARY"
```

**说明**：
- 使用 `git rev-parse --show-toplevel` 自动检测项目根目录
- 非 git 仓库时回退到 `pwd`
- 所有相对路径基于此目录解析
- 安全边界：用户主动操作，安全责任在用户（CLI 本身无 allowlist 限制）

---

## 安装

斜杠命令文件放在项目的 `.claude/commands/` 目录，Claude Code 自动加载。

对于个人全局使用，放在 `~/.claude/commands/peeklink.md`，所有项目均可使用。

---

*设计完成：2026-05-24*
