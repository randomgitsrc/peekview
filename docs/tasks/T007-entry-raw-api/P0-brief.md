# P0-brief — T007 Entry Raw API

task: "新增 GET /api/v1/entries/{slug}/raw 接口，返回 entry 级别的结构化原始内容；前端 ActionBar 加 Raw 按钮作为可发现入口，打通 Agent 之间通过 URL 传递内容的链路"

known_risks:
  - "多文件 entry 的内容读取需要逐个从磁盘读取，大文件可能影响响应时间"
  - "私有 entry 的认证逻辑需要与现有 get_entry 认证保持一致"
  - "二进制文件不能序列化为 JSON 字符串，需要特殊处理"
  - "前端 SPA 无法在 <head> 里动态插入 <link>，需要评估是否值得做"

env_constraints:
  debug_env: "make debug（:8888，/tmp/peekview-debug/）"

pruning_tendency: "保守 — 涉及新 API 接口、认证逻辑、前后端改动，建议走完整 P1-P3-P4-P5-P6-P8"

phase_hint: [P1, P2, P3, P4, P5, P6, P8]
