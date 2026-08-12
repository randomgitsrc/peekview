# agate pre-commit hook bug：check-p6-evidence.sh 的 WARNING（exit 2）被误当阻塞处理

## 问题来源

- 触发任务：peekview 项目 T086（admin/settings 信息架构收敛），P6 验收阶段 commit 时首次触发，P7 一致性检查阶段 commit 时复现
- 触发文件：`~/.agate/scripts/pre-commit-gate.sh`（第 258 行）
- 说明：`.git/hooks/pre-commit` 是指向该文件的符号链接（由 `install-hook.sh` 用 `ln -sf` 建立），不是项目本地独立副本——**这是 agate 框架的共享源文件，改动会影响机器上所有已安装该 hook 的项目仓库**

```
$ ls -la .git/hooks/pre-commit
lrwxrwxrwx  .git/hooks/pre-commit -> /home/kity/.agate/scripts/pre-commit-gate.sh
```

## 现象

任务已进入 P6/P7 阶段（`P6-acceptance.md` 已存在于任务目录），此后**任何一次** `git commit`（无论改动内容是否与 P6 证据相关）都会被 pre-commit hook 拦截，报 exit code 1：

```
$ git commit -m "..."
GATE P6-EVIDENCE: 17 条 BDD，证据目录非空
GATE P6-EVIDENCE WARNING: bdd-09-nonadmin-404.png 像素方差 31（<50，疑似纯色/占位图，请确认非充数）
GATE P6-EVIDENCE WARNING: bdd-10-unauth-404.png 像素方差 25（<50，疑似纯色/占位图，请确认非充数）
GATE P6-EVIDENCE WARNING: bdd-01-admin-userlist.png 像素方差 48（<50，疑似纯色/占位图，请确认非充数）
GATE P6-EVIDENCE WARNING: bdd-08-admin-404.png 像素方差 44（<50，疑似纯色/占位图，请确认非充数）
GATE P6-EVIDENCE WARNING: 有 4 张截图像素方差 < 50（疑似纯色/占位图，请确认非充数）
```

commit 进程以 exit 1 终止，工作树无法提交——即便这 4 处发现按脚本自身的输出文案和 `docs/process`/phase-card 文档描述都明确标注为 "WARNING"、"不阻断"。

人工逐张用图像查看工具打开这 4 张截图核实：均为真实渲染内容（404 页面 / 用户列表页），非空白或占位图。像素方差偏低的原因是页面本身的极简视觉设计（大面积浅色背景 + 小块深色文字/按钮），不是截图流程缺陷。

## 问题机理

### 1. `check-p6-evidence.sh` 自身的 exit code 契约（设计正确）

脚本内部逻辑（`~/.agate/scripts/check-p6-evidence.sh`）区分两类情况：

```bash
# 真失败（应阻断）：证据目录为空 / 无 PASS-FAIL 行 / 截图 md5 完全重复
...
exit 1

# WARNING（不应阻断，只是提醒人工确认）：像素方差<50疑似占位图 / 截图≤1KB
if [ "$VARIANCE_WARNING" -gt 0 ]; then
    echo "GATE P6-EVIDENCE WARNING: ..." >&2
    exit 2
fi
...
exit 0  # 全部通过
```

脚本头部注释虽然写的是 "exit 0 = 通过; exit 1 = 证据缺失; exit 2 = 无 P6 文件"（这行注释本身已过时，未同步脚本后续新增的 exit 2 = WARNING 语义），但脚本**实际运行逻辑**是自洽的：exit 1 为真失败必须阻断，exit 2 为 WARNING 不应阻断。这与 agate 协议里其他 gate 脚本（如 `check-gate.sh` 的 P1/P2/P5 分支）统一使用的 "exit 2 = 需主 Agent 手动判断/不阻断" 惯例一致。

### 2. `pre-commit-gate.sh` 对该脚本返回值的处理（存在 bug）

第 258 行：

```bash
bash "$AGATE_ROOT/scripts/check-p6-evidence.sh" "$TASK_DIR" || exit 1
```

`||` 只要左侧命令的退出码**非 0**就会执行右侧的 `exit 1`——这把 exit 1（真失败）和 exit 2（WARNING）**一视同仁地当成阻塞**处理，与脚本自身的三态设计（0/1/2）不符。

### 3. 同一文件里已有正确处理模式的先例（矛盾点）

`pre-commit-gate.sh` 主 gate 结果处理逻辑（约第 304 行）采用的是三态 `case` 分支，正确区分了 "阻断" 和 "警告不阻断"：

```bash
case "$GATE_EXIT" in
    0) echo "GATE $PHASE ($TASK_ID): 通过" >&2 ;;
    1) echo "GATE $PHASE ($TASK_ID): 未通过" >&2; echo "$GATE_OUTPUT" >&2; exit 1 ;;
    2) echo "GATE $PHASE ($TASK_ID): 需主 Agent 手动判断" >&2; echo "$GATE_OUTPUT" >&2 ;;  # 不 exit，继续
esac
```

第 258 行调用 `check-p6-evidence.sh` 时没有使用同样的三态处理，是**同文件内自相矛盾的两种写法**——大概率是后来给 `check-p6-evidence.sh` 新增 exit 2（WARNING）语义时，忘记同步更新调用处的处理逻辑。

## 影响范围

- 任何任务只要 P6 阶段截图触发像素方差 WARNING 或小图 WARNING（低对比度/极简设计页面很容易触发，非充数场景下也会误伤），P6 及其后所有阶段（P7/P8）的 commit 都会被无差别拦截
- 影响所有安装了这个 hook 的仓库（`.git/hooks/pre-commit` 全部是同一个符号链接目标），不是 peekview 独有问题

## 修改措施（待审核）

将 `~/.agate/scripts/pre-commit-gate.sh` 第 258 行的调用方式，改为与文件内既有的三态 `case` 模式一致：

```bash
# 现状（第 258 行）
bash "$AGATE_ROOT/scripts/check-p6-evidence.sh" "$TASK_DIR" || exit 1
```

```bash
# 拟修改为
EVIDENCE_OUTPUT=$(bash "$AGATE_ROOT/scripts/check-p6-evidence.sh" "$TASK_DIR" 2>&1)
EVIDENCE_EXIT=$?
case "$EVIDENCE_EXIT" in
    0) ;;
    1) echo "$EVIDENCE_OUTPUT" >&2; exit 1 ;;   # 真失败：证据缺失/md5重复/无PASS行——照样拦截
    2) echo "$EVIDENCE_OUTPUT" >&2 ;;            # WARNING：低方差/小图——只警告，不阻断
esac
```

### 修改范围与风险

- **改动文件**：仅 `~/.agate/scripts/pre-commit-gate.sh`（`.git/hooks/pre-commit` 是符号链接，无需单独改）
- **是否放宽真失败判定**：否。`check-p6-evidence.sh` 内部三种真实阻断条件（证据目录为空、无 PASS/FAIL 行、截图 md5 完全重复）对应的 exit 1，在新逻辑里**仍然阻断**，不受影响
- **变化的行为**：仅 exit 2（像素方差<50 疑似占位图、截图≤1KB）从"误阻断"变为"仅打印 WARNING、不阻断"，与脚本自身注释、P6 phase card 文档（`~/.agate/phase-cards/P6-acceptance.md`："≤1KB 虽不阻断但会触发 WARNING"）描述的预期行为一致
- **附带修正建议**（非必须）：脚本头部第 6 行的过期注释 `# exit 0 = 通过; exit 1 = 证据缺失; exit 2 = 无 P6 文件` 应同步更新为准确描述（exit 2 实际含义是 WARNING 不阻断，"无 P6 文件"只是 exit 2 众多触发场景之一）
- **影响面**：机器上所有使用 `~/.agate` 安装此 hook 的项目仓库，行为变得更宽松（不会误拦不该拦的），不会有项目因此变得更容易被拦截

## 本次 workaround（未修复期间）

T086 任务在 P6/P7 commit 时使用 `git commit --no-verify` 绕过，经用户明确批准（非默认选择），已在对应 commit message 中注明绕过原因。

## 附：临时复现验证命令

```bash
cd <repo>
bash .git/hooks/pre-commit; echo "EXIT: $?"
# 或单独跑子脚本验证三态语义
bash ~/.agate/scripts/check-p6-evidence.sh <task_dir>; echo "EXIT: $?"
```
