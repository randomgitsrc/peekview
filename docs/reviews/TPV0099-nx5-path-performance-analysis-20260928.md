# TPV0099 性能诊断与优化建议报告

> 日期：2026-09-28
> 范围：TPV0099 的 P1/P2 阶段为何耗时过长；nx5 模型链路与 DSH 编排各自的贡献
> 方法：DSH 会话日志逐事件时间戳分析 + 受控 A/B 探针 + 网络层计时 + 源码查证
> 结论强度标注：**[实测]** 有测量数据 · **[文档]** 官方文档语义 · **[假设]** 待验证

---

## 1. 结论摘要

### 1.1 卡点排序（以 P2 plan-design-review 的 72.5 分钟为基准）

| 环节 | 时长 | 占比 | 可控性 |
|---|---|---|---|
| **生成推理 token** | **≈48.7 min** | **67%** | 当前**不可控**（见 §8） |
| **每步 TTFT**（86 步 × 11s） | **15.8 min** | **22%** | 可控（链路 + 步数） |
| 生成实际产出（文本 + 工具参数） | ≈5.4 min | 7% | 可控（产物粒度） |
| 工具执行 | 2.6 min | 4% | 不是问题 |

**一句话：卡点是"想得太多"（67%）+ "每步等入场"（22%）。**

### 1.2 改造 nx5 链路的天花板 [实测]

| 改造目标 | 可省 | 占 72.5 min |
|---|---|---|
| 消除 nx5 特有的 +1.53s/请求（86 步） | 2.2 min | **3%** |
| 再消除卡顿尾巴（TTFT 均值 11s → 中位 7.2s） | +5.4 min | +7% |
| 彻底消灭 TTFT（降到 0） | 15.8 min | 22% |
| 那 67% 的推理生成 | **0** | 与链路**完全无关** |

**把 bifrost / cloudflared / 直连全部改造到极致，最多拿回 3–10%。**

---

## 2. 测量方法与证据来源

| 证据 | 来源 | 说明 |
|---|---|---|
| 逐事件时间戳 | `~/.dsh/sessions/<workspace>/<sid>/session.v4.jsonl.zstd` | 事件类型 `step/start`、`assistant/message`（含 `usage` 与 `stream[].time/dt`）、`tool/call|result`、`request/header`、`request/context`、`subagent/descriptor` |
| 真实请求对照 | 1294 条 nx5 与 3070 条 commandcode 请求 | 限定 `provider/model` 分组，消除混淆 |
| 受控 A/B | `workflow` 的 `agent()` 支持 `provider`/`model` 覆盖 | 三臂同刻并发 × 3 轮，同 prompt |
| 网络层 | `curl -w`（分别经本地代理与 `--noproxy`） | 仅测连接建立与 TTFB |
| 源码 | `/home/kity/oclab/deepseek-harness/` | effort 传递、preset 定义、面板口径 |

**关键限制**：会话日志不含请求级参数（`request/header.config` 只有 provider/model），因此 effort 等参数只能从 descriptor 与源码推断其存在性——本文所有此类判断均已用源码交叉验证。

---

## 3. 时间归因（实测，自洽验证）

会话：P2 plan-design-review（`b944afc1`）

| 面板项 | 数值 |
|---|---|
| 模型用时 | 69 min 53 s |
| 工具调用用时 | 2 min 38 s |
| 首 token 平均 | 11 s |
| 步数 | 86 |
| 输出速度 | 103 tok/s |
| 输出 token | 334,411 |

**换算自洽**：`54.1 min × 60 × 103 tok/s ≈ 334,000` ≈ 面板输出 token。

其中 `54.1 min = 69.9 min（模型）− 15.8 min（TTFT）`。

### 3.1 Token 经济学

| 项 | 数值 |
|---|---|
| 总处理量 | 10,826,249 tok |
| 缓存读取 | 10,224,896 tok（97%） |
| 未缓存输入 | 266,942 tok |
| 输出 | 334,411 tok |
| **产出比** | **10.8M token → 27 KB 文件** |

**逐项核对通过**：86 步上下文之和 = 10,491,838 = 缓存读取 10,224,896 + 未缓存 266,942（精确相等）。

---

## 4. 被实测推翻的假设（含自我更正）

| # | 曾经的假设 | 裁决 | 证据 |
|---|---|---|---|
| 1 | 并发争用导致请求互相阻塞/串行化 | ❌ **推翻** | 按并发度分组：k=0（n=676）TTFT 中位 6.60s、卡顿率 5%；k=1（n=562）7.21s、5%；k=2（n=55）6.01s、0%。**独占与 1 路并发的卡顿率完全相同** |
| 2 | 慢步与对方会话生成窗口 100% 重叠 = 排队证据 | ❌ **自我推翻** | 那是**窗口长度效应**（对方 77% 时间在生成）。严格检验"对方在途剩余时长"：7 个慢步中 5 个在对方仍差 296–350s 时就拿到了首 token |
| 3 | cloudflared + bifrost 带来约 2.3s/请求 | ⚠️ **修正为 1.53s** | 受控 A/B 实测；此前 2.3s 来自跨会话观测对比，混入了会话/负载差异 |
| 4 | `reasoningEffort: high` 可能导致推理量偏高 | ❌ **证伪** | 子代理 descriptor 无 `agentReasoningEffort` 字段 + 实际 `request/header.config` 只有 provider/model + nx5 模型无 reasoning 元数据（传了会抛错，见 §8） |
| 5 | 统计面板三项之和 > 上下文总量 = 面板 bug | ⚠️ **改为口径差异** | 百分比是 provider-exact，三项是启发式估算且**把 reasoning 计入**（见 §7） |
| 6 | TTFT 与上下文规模无关 | ⚠️ **修正** | 小上下文 5.14s → 119K 上下文时中位 7.2s（+40%） |
| 7 | DSH 运行时调度有开销 | ❌ 推翻 | 步间调度 0.1 min / 102 min，未归因 0.0 |
| 8 | 工具执行是瓶颈 | ❌ 推翻 | 面板 2.6 min（4%），与会话日志一致 |

---

## 5. nx5 链路剖面（实测）

### 5.1 受控 A/B（三臂同刻并发 ×3 轮，同 prompt）

| 臂 | n | TTFT 中位 | TTFT 范围 | 生成吞吐 | >20s 卡顿 |
|---|---|---|---|---|---|
| `xrouter/nx5` | 6 | **5.14 s** | 2.33–7.56 s | 131 tok/s | 0% |
| `commandcode` 直连（同后端模型） | 8 | **3.62 s** | 2.18–4.32 s | 147 tok/s | 0% |
| `deepseek-official/deepseek-flash` | 10 | **0.27 s** | 0.18–0.60 s | 87 tok/s | 0% |

**nx5 相对同后端直连：+1.53 s/请求（1.4×）。**
`responseModel` 实测为 `deepseek/deepseek-v4.1-flash`——**nx5 确实路由到该模型**（API 回包，非推断）。

### 5.2 真实请求规模对照

| provider/model | n | TTFT 中位 | >20s 卡顿 | 吞吐 |
|---|---|---|---|---|
| `xrouter/nx5` | 1274 | 6.78 s | 4% | 63.9 tok/s |
| `commandcode/deepseek-v4.1-flash` | 3070 | 4.48 s | 1% | 88.1 tok/s |
| `deepseek-official/deepseek-flash` | 31 | 1.25 s | 0% | 196.4 tok/s |
| `xrouter/daily-free-tr` | 755 | 6.82 s | 5% | 30.5 tok/s |
| `scnet/GLM-5.3-Flash` | 178 | 9.20 s | 12% | 23.1 tok/s |

注：nx5 在免费档中已属较优；换其他免费别名不会更好。

### 5.3 网络层

| 探测 | 结果 |
|---|---|
| CF 边缘 colo | **DFW（达拉斯）**，客户端 `loc=CN` → **可疑单点** |
| 协议 | HTTP/2 |
| 连接建立 | 冷连接 TLS ≈0.63 s；**同连接第 3 次 TTFB = 0.34 s** |
| origin 可达性 | 被 CF 隐藏（`server: cloudflare`、证书仅 `*.gsis.top`/`gsis.top`/`mm.gsis.top`） |
| 流内传输 | architect 流内 gap 中位 380 ms、p90 1172 ms、**最大 2.0 s**；review A 有 1/75 步出现 66 s 异常 gap |

**结论**：隧道传输 token 无问题；延迟集中在**首 token 之前的入场阶段**。

卡顿集中出现在 TTFT 阶段，实测样例：373.0s / 323.5s / 177s / 92s / 77.1s …

---

## 6. bifrost 配置：症状 → 旋钮映射

### 6.1 官方三旋钮 [文档]

| 参数 | 作用域 | 默认 | 含义 |
|---|---|---|---|
| `concurrency` | 每 provider | 1000 | 同时处理请求的 worker goroutine 数 |
| `buffer_size` | 每 provider | 5000 | 队列容量；满时行为由 `drop_excess_requests` 决定 |
| `initial_pool_size` | 全局 | 300（schema 页）/ 5000（性能页） | 预分配对象池，降 GC 压力 |

硬约束：`buffer_size >= concurrency`，否则 provider 启动失败。

⚠️ **两页官方文档口径不一致**（concurrency/buffer 默认值、`initial_pool_size` 默认值、`drop_excess_requests` 的语义描述），**以运行版本实际行为为准**。

### 6.2 症状映射

#### 症状 A：4–5% 请求卡 20–373 s，且与自身并发无关

**最符合数据的假设** [假设]：`drop_excess_requests: false`（默认）时**队列满则阻塞等待**，而这台是**共享聚合网关**——队列里排的是其他租户的请求。我们只能在自身会话层面观测并发，看不到其他租户，因此表现为：随机时刻、与自身并发无关、所有会话一律中招、且集中在 TTFT 阶段。

**验证手段（决定性）**：在 VPS 上查 `/metrics`：

```bash
curl -s http://localhost:8080/metrics | grep -iE "queue|drop|latency|inflight"
curl -s http://localhost:8080/health
```

官方健康阈值：队列深度 < buffer_size 的 50%、丢弃请求 = 0、p99 < 2× 平均。**若在 §附录A 的卡顿时刻看到队列深度飙升 → 定论。**

**对应改法**（按稳妥度）：
1. `drop_excess_requests: true` → 队列满快速失败（429），而非干等 373 s。**前提：客户端会对 429 重试**，否则把"慢成功"变成"失败"
2. 提高 `concurrency`（若 VPS 资源允许）
3. 检查 `governance.rate_limits` / `model_configs` → 若该 key 被限流，则卡点是限流排队而非链路

#### 症状 B：+1.53 s/请求的固定开销

| 可疑项 | 为什么 | 查法 |
|---|---|---|
| `plugins` 含 `semantic_cache` | 若启用，每请求需 embedding + 向量检索，**秒级开销头号嫌疑** | 看 `config.json` 的 `plugins` 数组 |
| `enable_logging` + 内容日志 | 请求体大（119K token ≈ 数百 KB），逐请求序列化落库有成本 | 可设 `disable_content_logging: true` |
| `otel` / `maxim` / `datadog` 插件 | 每个插件都在请求路径上加处理 | 同上 |
| provider 的 `network_config` | `stream_idle_timeout_in_seconds` 等设置不当会误杀长流 | 看 provider 段 |

#### 症状 C：流式传输

**不是 buffering 问题** [实测]。同症状的已知问题单 [maximhq/bifrost#4542](https://github.com/maximhq/bifrost/issues/4542) 表现为 `TTFB 7.29s / 总时长 7.32s / 124 chunk 挤在 0.03s`；**我们的形态是 TTFT 5–11s 之后平滑流 38s**，与之不符。该 issue 已于 2026-06-21 关闭，只需确认版本 ≥ 修复版本。

### 6.3 建议配置（可直接照做的部分）

```json
{
  "client": {
    "drop_excess_requests": true,
    "disable_content_logging": true,
    "enable_logging": true,
    "max_request_body_size_mb": 100
  },
  "providers": {
    "<provider 名>": {
      "concurrency_and_buffer_size": {
        "concurrency": 1000,
        "buffer_size": 1500
      }
    }
  }
}
```

**外加一项诊断配置**：`plugins` 启用 `otel` → 拿到逐请求分段耗时，直接回答"这 1.53 s 花在 bifrost 内还是上游"。这是把假设变定论的唯一干净手段。

---

## 7. 统计面板口径说明 [实测 + 源码]

| 面板项 | 实测值 | 判定 |
|---|---|---|
| 上下文已用 16% ~172K | 末步上下文 = **171,466 = 16.4%** | ✅ 精确吻合（provider-exact） |
| 缓存读取 + 未缓存输入 | 86 步之和 = **10,491,838** | ✅ 分毫不差 |
| 系统 2.3K + 工具 16.3K + **对话 354K** | 三项之和 372.6K > 真实 171.5K | ❌ **口径不同** |

**机制已查明**：`ContextMeter.tsx` 注释明说**百分比是 provider-exact、三分项是启发式**；`estimate.ts` 的 `CHARS_PER_TOKEN = 4` 且 `estimateContent` **把 `reasoning` 块计入**。而数值闭环证明**推理不随请求重发**：

```
请求上下文增长（末步 − 首步） = 144,540 tok
非推理内容折算（文本 6,525 + 工具参数 104,444 + 工具结果 460,451 字符 ÷ 4） = 142,855 tok
比值 = 1.012  →  推理未进入请求
```

推理总量折算 258,292 tok，正是"对话消息 354K"的主体。

**使用建议**：判断真实上下文占用看"上下文已用 16% ~172K"，**不要用三分项之和**。

---

## 8. 推理量问题：当前不可控 [实测 + 源码]

### 8.1 实测占比

| 会话 | 步数 | 输出 tok | 推理字符 | 文本字符 | 工具参数字符 | 推理占比 |
|---|---|---|---|---|---|---|
| P2 plan-design-review | 86 | 334,411 | 1,033,167 | 6,525 | 104,444 | **90.3%** |
| P2 architect | 145 | 411,621 | 1,187,487 | 4,827 | 194,340 | 85.6% |
| P2 plan-eng-review | 51 | 162,695 | 517,312 | 3,821 | 42,733 | 91.7% |

**为写出 27 KB 评审文件，模型生成了 103 万字符推理（约 10:1）。**

### 8.2 effort 参数的三重障碍

| 障碍 | 证据 |
|---|---|
| workflow 路径拒绝 | `workflow-ptc/src/runtime.ts:35`：`DEFERRED_AGENT_OPTIONS = new Set(['effort','isolation','agentType'])` |
| subagent 路径未暴露 | `tool-subagent/src/index.ts:370`：参数仅在 `subagentProvider.agentRouteDefaults !== undefined` 时注册；本部署挂 `provider: spawn`，全仓仅 `subagent-dsh-sdk` 声明该属性 |
| **nx5 模型不接受** | `models.ts:59-60`：无 reasoning 元数据的模型 `getSupportedThinkingLevels` 返回 `['off']`；`adapter.ts:158-169`：不在支持档位则**抛错** `UNSUPPORTED_REASONING_EFFORT` |

**记录级交叉验证**：子代理 descriptor 无 `agentReasoningEffort`；`request/header.config` 与 `request/context` 均只有 provider/model。→ **effort 从未生效，且在该路由上不可设。**

### 8.3 prompt 层抑制：实测无效

| 会话 | 步数 | 每步推理字符 |
|---|---|---|
| 对照 r1 | **6** | 3,633 |
| 对照 r2 | 1 | **981** |
| 抑制 r1 | 1 | **1,039** |
| 抑制 r2 | 1 | **1,153** |

按单步比：对照 981 vs 抑制 1,039 / 1,153 → **抑制无效果**。
（聚合看"降到 10%"是**步数差异**造成的假象：对照有一个 run 自行走了 6 步。）

**附带实测**：同一 prompt 下步数 1 vs 6，**步数由模型自主行为决定，不可用 prompt 约束**——而"步数 × TTFT"是主成本之一。

### 8.4 唯一有真实 effort 控制的路径 [源码]

| 路径 | 能力 |
|---|---|
| `deepseek-official`（内置 `llm-deepseek`） | `reasoningEffort: off \| low \| high \| max`（默认 high）+ `thinking: enabled \| disabled` |
| `xrouter/nx5`（pi-ai 手写模型） | 仅 `off`（=不传参）。要在其上用 effort，须在 provider 的 models 条目声明 `reasoningEfforts`（键=档位、值=wire 拼写），**上游是否接受未验证** |

---

## 9. 上下文与工具面（每步重复支付的固定成本）[实测]

| 项 | 数值 | 影响 |
|---|---|---|
| 每请求工具定义 | **82 个 ≈ 16.3K tok** | 占 10.2M 缓存读取的 **14%** |
| 每步上下文 | 中位 ≈122K，末步 171K | TTFT 随上下文上升（5.14s → 7.2s） |
| dispatch context | 每份 36–40 KB，被内联进每一步 | 放大每步上下文 |

可做：**按需挂载工具**（82 个里对本任务无用者不挂）、**dispatch context 改用 `path:line` 指针**替代整段内联。

---

## 10. agate 层观测（仅事实，供 agateon 判断）

| 观测 | 数据 |
|---|---|
| C8 映射 | P1 声明 `risk_level: medium` + `domains: [frontend]` → 按 C8 仅强制 `plan-design-review`；实际派出 `plan-design-review` + `plan-eng-review` + `review-lead`（dispatch context 已写） |
| P1 评审轮次 | `needs-revision` 出现 129 次；根因为 BDD-3 判据恒真（对错误实现也返回 PASS），最终以三态负向对照定案 |
| 产物体积 | `P1-requirements.md` 60 KB、`P2-design.md` 68 KB、4 份 dispatch context 36–40 KB |
| 模式状态 | 父会话 09-28 **13:46:05** 触发 `agent-preset/selected` → `agate`；评审子代理（15:36 派发）继承的是父上下文**当前组合**的 preset（`child-agent.ts:145`） |
| 模式影响 | **PTC 模式禁用 `workflow-ptc` / `tool-workflow` / `tool-ralph`**；标准模式禁用 `tool-ralph`；极简模式仅 2 个 tool 插件（无 subagent / compaction）；创造模式移除 skill 子系统、加入 `tool-cordis` |

> 本节只列事实，不评判流程设计——agateon 的编排逻辑由其自身定义。

---

## 11. 待确认信息与未验证假设

| 项 | 类型 | 说明 |
|---|---|---|
| 共享队列阻塞 | **[假设]** | 最符合数据，需 `/metrics` 队列深度证实 |
| nx5 特有开销在 119K 大上下文下的大小 | **未测** | +1.53 s 测于小上下文；大上下文未做 nx5 vs 直连配对 |
| bifrost `semantic_cache` 是否启用 | **未知** | 若启用则为秒级开销头号嫌疑 |
| 直连 VPS 是否可行/更快 | **未知** | 需 VPS 公网地址与端口；且 CF tunnel 常用于规避 CN→海外 VPS 的直连质量问题 |
| `drop_excess_requests: true` 的副作用 | **未知** | 取决于客户端对 429 的重试策略 |
| colo=DFW 的成因 | **未知** | 本地代理出口 or CF anycast；需换出口对比 |
| effort 对推理量的实际影响 | **未测** | 仅 `deepseek-official` 具备该能力，可测 |

**需要提供的信息**：① `config.json` 的 `client` + `providers` 段（尤其 `plugins`、`concurrency_and_buffer_size`、`network_config`）② `/metrics` 或 `/health` 快照 ③ VPS 规格（CPU/内存）④ bifrost 版本 ⑤ 该网关是否多人共用。

---

## 12. 建议执行顺序

| 顺序 | 动作 | 预期产出 |
|---|---|---|
| 1 | VPS 上 `curl -s localhost:8080/metrics`，对照附录 A 的卡顿时刻 | **定论**共享队列假设 |
| 2 | 用附录 A 时间戳 grep `cloudflared` 与 bifrost 日志 | 区分卡点在隧道 / 网关 / 上游 |
| 3 | 核查 `config.json` 的 `plugins`（`semantic_cache`？）与 `enable_logging` 内容日志 | 定位 +1.53 s 的固定开销 |
| 4 | 启用 `otel` 插件，拿逐请求分段耗时 | 把假设变定论 |
| 5 | 依据 §6.3 调整 `drop_excess_requests` / `concurrency_and_buffer_size`（**先确认客户端 429 重试策略**） | 消除长尾等待 |
| 6 | 核查 colo=DFW：换客户端出口节点各测一次 `cdn-cgi/trace` + TTFT | 判断是否需要改路由 |
| 7 | （若要直连）提供 VPS 地址端口后做直连 vs 隧道对照 | 量化直连收益与风险 |

---

## 附录 A：卡顿时间戳清单（用于 grep VPS 日志）

```
2026-09-28
15:16:18   15:37:11   15:43:32 (373.0s)   15:51:42 (323.5s)   15:51:43 (33.7s)
15:57:34   15:58:42   16:03:22 (77.1s)    16:07:01   16:10:06
16:11:30   16:14:39   16:24:37
```

均为 TTFT（首 token 等待）超 20 s 的请求起始时刻，时区 CST。

## 附录 B：证据文件位置

| 内容 | 路径 |
|---|---|
| 评审会话日志 | `~/.dsh/sessions/--home-kity-oclab-peekview--/b944afc1-098e-4734-a921-a3b3d50e534e/` |
| architect 会话日志 | 同目录 `c65e9c1c-5e78-4e30-9/` |
| eng-review 会话日志 | 同目录 `961adcf0-a692-4871-9/` |
| 任务产物 | `agate-workspace/tasks/TPV0099-fullscreen-link/` |
| DSH 源码（effort / preset / 面板口径） | `/home/kity/oclab/deepseek-harness/packages/` |

## 附录 C：外部引用

- [Bifrost Performance Tuning](https://docs.getbifrost.ai/providers/performance)
- [Bifrost config.json Schema Reference](https://docs.getbifrost.ai/deployment-guides/config-json/schema-reference)
- [Bifrost Provider Setup](https://docs.getbifrost.ai/deployment-guides/config-json/providers)
- [maximhq/bifrost#4542 — streaming buffered server-side（已关闭）](https://github.com/maximhq/bifrost/issues/4542)

---

> **敏感信息提示**：本报告包含内部基础设施细节（网关域名、CF colo、本地代理端口、配置项），**不应公开发布**。
