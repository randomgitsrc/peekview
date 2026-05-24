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

summary 自动从路径生成，不需要用户输入：
- 单文件：`main.py`
- 单目录：`src/`
- 多路径：`src/main.py + 1 more`
- 当前目录：项目目录名（`basename $PWD`）

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

# 生成 summary：取第一个路径的basename，多路径时加计数
FIRST=$(echo $PATHS | awk '{print $1}')
COUNT=$(echo $PATHS | wc -w)
if [ "$COUNT" -gt 1 ]; then
  SUMMARY="$(basename $FIRST) + $((COUNT-1)) more"
else
  SUMMARY="$(basename $FIRST)"
fi

peekview create $PATHS --summary "$SUMMARY"
```

---

## 安装

斜杠命令文件放在项目的 `.claude/commands/` 目录，Claude Code 自动加载。

对于个人全局使用，放在 `~/.claude/commands/peeklink.md`，所有项目均可使用。

---

*设计完成：2026-05-24*
