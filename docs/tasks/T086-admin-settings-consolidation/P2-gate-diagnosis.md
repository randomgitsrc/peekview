---
phase: P2
task_id: T086-admin-settings-consolidation
type: gate-diagnosis
trace_id: T086-P2-20260807
created: 2026-08-07
---

# P2 gate 诊断 — check-gate.sh P2 失败（候选方案数）

## 现象

`check-gate.sh P2` exit 1："P2-design.md 需至少 2 个候选方案 + 权衡 + 选择理由（design_trivial/follows_existing_pattern 时可只写 1 个）"。但 P2-design.md 明确只写了 1 个候选方案（§0 已做 3 方向探索并排除 2 个，§1 是唯一候选），P2-review.md 也已 approved 且未对"候选方案数不足"提出异议。

## 根因

`check-gate.sh` P2 分支（脚本第 107 行）用正则 `^(design_trivial|follows_existing_pattern):\s*\S` **读取的是 `P1-requirements.md`**（不是 P2-design.md），检查该字段是否以行首 YAML 键值对形式声明。P1-requirements.md 第 5 节"裁剪说明"里，`follows_existing_pattern` 只出现在两处散文表述中（第 149 行 SUGGEST 引号内、第 157 行反引号内联），**没有**作为独立行首字段 `follows_existing_pattern: [...]` 出现。脚本解析不到 → 视为"未声明简化条件" → 要求候选方案数 ≥2 → P2-design.md 只有 1 个 → gate 判定不满足。

这与 P1 阶段 `check-pruning.sh` 的 `phases:` 字段失败是**同一类问题**（P1-requirements.md 裁剪声明是散文而非机器可读字段），当时已修过 `phases:`，但漏了 `follows_existing_pattern:` 这个同一节里的姊妹字段。

## 处置

不改动 P2-design.md（内容和候选方案数本身没有问题，P2-review.md 已确认合理）。派 analyst 对 P1-requirements.md 做第二次最小格式补丁：在第 5 节"裁剪说明"追加

```yaml
follows_existing_pattern: [frontend-v3/src/views/SettingsView.vue]
```

不改动第 5 节任何现有散文表述，不改动 BDD/其他章节。这是对已有裁剪意图（P1 第 157 行已明确表述"follows_existing_pattern...单候选方案即可"）的机器可读镜像，语义零变化。

按 P1 基线保护规则，此次追加需标注 `[BASELINE_CHANGE: 理由]`：理由为"补充 check-gate.sh P2 解析所需的机器可读字段，不改变第 157 行已声明的裁剪意图"。

修补后重跑 `check-gate.sh P2` 确认 exit 2（或 0，视脚本约定），不需要重新派 P1 requirements-review（内容语义零改动）或重新派 P2 architect/plan-design-review（P2-design.md 本身不改动）。

## 追加诊断（同一 gate，第二个子问题）

P1 字段补丁生效后（`MIN_CANDIDATES` 从 2 降为 1，证明 `follows_existing_pattern:` 已被正确解析），`check-gate.sh P2` 仍 exit 1，原因变为候选方案标题格式不匹配。

脚本用正则 `^#{2,4}\s*(候选方案|方案\s*[A-Za-z0-9一二三四五]|Alternative|Option)` 扫描 P2-design.md 的标题行统计候选方案数：

- L30 `## 1. 候选方案（唯一方案，follows_existing_pattern）` —— "候选方案"前有"1. "编号前缀，`\s*` 不匹配数字+点+空格，不命中
- L32 `### 方案：tab computed 化 + ...` —— "方案"后直接是全角冒号"："，不在 `[A-Za-z0-9一二三四五]` 允许字符集内，不命中

两处标题均因为标点/编号细节未命中正则，`CANDIDATE_COUNT=0` < `MIN_CANDIDATES=1`。这是纯标题文字问题，候选方案本身的内容（权衡/选择理由）完整存在，不需要重新设计。

**处置**：派 architect 只改 L32 标题文字，从 `### 方案：tab computed 化 + 三处统一 isAdmin 判断 + UserMenu 动态落地 tab` 改为 `### 方案一：tab computed 化 + 三处统一 isAdmin 判断 + UserMenu 动态落地 tab`（"方案"后加中文数字"一"，命中正则字符集），不改动 L30 及其余任何内容。
