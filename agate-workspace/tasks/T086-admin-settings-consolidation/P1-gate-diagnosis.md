---
phase: P1
task_id: T086-admin-settings-consolidation
type: gate-diagnosis
trace_id: T086-P1-20260807
created: 2026-08-07
---

# P1 gate 诊断 — check-pruning.sh 失败

## 现象

`check-gate.sh P1` 已通过（exit 2，P1-review.md approved + BDD 锚点齐全）。但 pre-commit hook 的 `check-pruning.sh` 拦截提交，报 P2/P3/P4/P5/P6/P7/P8 均"不可裁剪"错误。

## 根因

`check-pruning.sh` 用正则 `phases:\s*\[([^\]]+)\]`（或 YAML 缩进列表）解析 P1-requirements.md 的 `phases:` 字段来判断哪些阶段被声明裁剪。P1-requirements.md 第 5 节"裁剪说明"是**纯散文表述**（"不裁剪任何阶段。全部走 P0-P8"），没有对应的机器可读 `phases: [...]` YAML 字段。脚本解析不到任何 phase → `PHASES_DECLARED` 为空 → 逐条判定"P2/P3/.../P8 未在 phases 列表中" → 误判为"被裁剪但未满足裁剪条件"。

这是**格式缺陷**，不是内容缺陷：analyst 的裁剪意图（全部阶段保留）本身是对的，且 requirements-review 已核实"裁剪说明第 5 节标题与正文内容一致，无夸大或遗漏"——只是没有用脚本要求的机器可读格式表达。

## 处置

不重新走完整 review 循环（BDD/隐含需求/裁剪理由的语义未变，只是补一个结构化字段），派 analyst 做最小格式修补：在 P1-requirements.md 第 5 节补充：

```yaml
phases: [P0, P1, P2, P3, P4, P5, P6, P7, P8]
```

修补后不改变第 5 节任何一句现有散文表述（仍保留"不裁剪任何阶段"等原文），只是新增这一个可解析字段作为对散文声明的机器可读镜像。修补后重跑 `check-pruning.sh` 确认通过，不需重新派发 requirements-review（BDD 内容零改动）。
