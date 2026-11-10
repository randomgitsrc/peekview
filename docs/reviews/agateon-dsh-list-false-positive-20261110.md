# Agateon × DSH：`--list` 过期检测对 YAML 折叠标量假阳性

> 报告人：PeekView 项目 Agent（DSH 环境）
> 日期：2026-11-10
> 环境：DSH 0.2.1-rc.2（commit `687f282e86`）/ Agateon **v0.83.1** / Linux（WSL2）
> 性质：**误报（false positive）**，不是模板内容错误

---

## 1. 一句话结论

`agate-setup.py --list` 报 DSH 声明块"与任何已装版本的权威模板都不一致（已过期或被手改）"，**这是误报**。

实测：用 v0.83.1 自己的生成函数 `agate_common.dsh_preset_block()` 重新生成声明块，与已装块比对：

- **插件包名集合完全一致**：26 个 vs 26 个，**零差异**
- **62 行文本差异全部位于 `persona.prefix` 的 YAML 折叠标量内**，是 `>-` 折叠时的换行位置不同
- 即：**语义等价，仅序列化格式不同**

根因是过期检测采用了**逐字文本比对**，而 YAML 折叠标量在"模板原文"与"生成块"之间必然发生重新折行。

---

## 2. 证据（可复现）

### 2.1 用 v0.83.1 自己的生成函数复现

```python
import sys, re, difflib
sys.path.insert(0, '/home/kity/.agate/v0.83.1/agate/scripts')
import agate_common as ac

blk = ac.dsh_preset_block('/home/kity/.agate/v0.83.1/agate')      # 9744 字符
inst = open('/home/kity/.dsh/profiles/web/cordis.patch.yml').read()
cur  = re.search(r'(# >>> agateon: preset-agate.*?# <<< agateon: preset-agate <<<)', inst, re.S).group(1)  # 9857 字符

# 包名集合
pkgs = lambda t: re.findall(r"name:\s*'(@deepseek-ai/[^']+)'", t)
print(sorted(pkgs(blk)) == sorted(pkgs(cur)))   # → True
print(len(pkgs(blk)), len(pkgs(cur)))           # → 26 26
```

**输出**：

```
包名集合是否相同: True
  生成: 26 个插件
  已装: 26 个插件
  差异: 无
总差异行: 62
其中 >100 字符的长文本行: 13
```

### 2.2 差异样本（全部是 prefix 折行）

```diff
-                ## 第一步（必须） 解析协议根，然后读权威行为规范： 1. 跑 `python3
-                ~/.agate/scripts/agate-resolve.py`，从输出读 `AGATE_ROOT=`。 2. 读
+                ## 第一步（必须）
+                解析协议根，然后读权威行为规范：
+                1. 跑 `python3 ~/.agate/scripts/agate-resolve.py`，从输出读 `AGATE_ROOT=`。
+                2. 读 `{agate_root}/orchestrator-template.md` 并严格遵守——它是**唯一**权威行为规范
```

同一段文字，一侧被压成两行、另一侧保持多行。**内容相同，仅换行位置不同。**

### 2.3 当前告警原文

```
$ python3 ~/.agate/scripts/agate-setup.py --list
  ⚠️  [dsh] /home/kity/.dsh/profiles/web/cordis.patch.yml  声明块存在但与**任何已装版本**的权威模板都不一致（已过期或被手改；重跑接入刷新）
```

---

## 3. 影响

| 影响 | 说明 |
|---|---|
| 每次 `--list` 都告警 | 用户无法区分"真的被手改"与"仅格式差异" |
| 引导语有破坏性 | "重跑接入刷新"会覆盖用户可能有意保留的改动，且**这次覆盖毫无必要** |
| 告警疲劳 | 持续误报会让真实告警（真的被手改）失去信号价值 |

**当前无功能性损坏**：已装 preset 可正常挂载（包名集合与 v0.83.1 生成结果一致，`@deepseek-ai/dsh-workflow-ptc` 在 DSH 0.2.1-rc.2 中存在且可解析）。

---

## 4. 建议修复方向

1. **比对改为语义比对**：解析 YAML 后比较（插件 id/name/config 树），而非逐字文本
2. 若坚持文本比对，**至少对 YAML 折叠标量做规范化**（把 `>-` 块按空白折叠为单行再比）
3. **告警文案区分两类**：
   - "内容不同（可能被手改）" → 提示差异摘要
   - "仅格式不同" → 不告警，或降级为 info
4. 建议 `--list` 增加 `--diff` 选项，输出语义差异摘要（哪个插件的哪个键不同）

---

## 5. 附：核实过程中排除的两个误判（供团队参考，避免重复排查）

| 曾怀疑 | 核实结果 |
|---|---|
| 模板引用了已删除的包 `dsh-workflow-worker-thread` | **不成立**。v0.83.1 的 `agate_common.py:1091-1095` 仍保留 `_DSH_PLUGIN_RENAMES`，生成时会把 `worker-thread` 替换为 `workflow-ptc`；实测生成块的包名集合里**没有** `worker-thread` |
| 生成器缺少包名替换逻辑 | **不成立**。替换在 `agate_common.py`（不在 `agate-setup.py`），v0.83.1 仍在 |

---

## 6. 现场未做改动

仅执行只读操作（`--list`、在 `/tmp` 内调用生成函数比对）。**未执行任何接入写操作**，DSH preset 保持原样可用。
