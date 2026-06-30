---
phase: P0
task_id: T042
task_name: html-module-script-inject
type: bug
trace_id: T042-P0-20260630
created: 2026-06-30
status: draft
parent: T019 (sibling injection 功能性 bug)
---

task: `<script type="module">` sibling 注入完全失效 — 双重 bug

## Bug 描述

`html_render_service.py` 的 `inject_resources()` 在处理 `<script type="module" src="main.js">` 时有两个 bug：

### Bug 1: module script 被跳过不替换

`inject_resources` 第 148-149 行：
```python
type_attr = script.get("type")
if type_attr and type_attr != "text/javascript":
    continue
```

`type="module"` 不等于 `text/javascript`，所以被跳过。原始 `<script type="module" src="main.js">` 保留在 HTML 中，浏览器尝试加载 `main.js` 路径但 404。

### Bug 2: 追加为普通 script（双重加载 + 语法错误）

被跳过的 module script 的 sibling 文件（main.js）被当作"未引用 JS"，追加为普通 `<script>` 标签。结果：
1. 原始 `<script type="module" src="main.js">` 保留 → 浏览器加载失败（404）
2. 追加的普通 `<script>` 包含 `import * as THREE from 'three';` → ES module 语法在普通 script 中非法 → **静默语法错误，JS 完全不执行**

### 实测验证

用 Three.js demo（index.html + main.js，含 `<script type="module" src="main.js">` 和 `import * as THREE from 'three'`）创建 entry，Canvas 保持默认 300x150，Three.js 完全没初始化。

## 修正方向

`type="module"` script 也应被内联替换，保留 `type="module"` 属性：

```python
# Before: 跳过非 text/javascript
if type_attr and type_attr != "text/javascript":
    continue

# After: 也处理 type="module"
if type_attr and type_attr not in ("text/javascript", "module"):
    continue
```

替换时保留原始 type 属性：
```python
inline = soup.new_tag("script")
if type_attr:
    inline["type"] = type_attr  # 保留 module
inline.string = f"/* injected from: {key} */\n{text_map[key]}"
```

### 注意事项

1. **ES module 的 `import` 语句中的相对路径**（如 `import './dep.js'`）不会被替换——这是运行时行为，BS4 无法静态分析。如果 dep.js 也是 sibling，它需要作为独立 module 被注入，但 `<script type="module">` 不支持内联 `import`。可能的解决方案：
   - 将 sibling JS 文件注册为 import map 的条目
   - 或将 `import './dep.js'` 替换为内联代码
   - 或接受限制，在警告中说明

2. **`type="importmap"` script** 已在 HTML 中内联（如 Three.js 场景），不受此 bug 影响。

3. **去重问题**：修复后需确保 module script 替换后不会被当作"未引用 JS"重复追加。当前逻辑中 `used_text_keys` 追踪已使用的 key，但 module script 被跳过时 key 没加入 `used_text_keys`，修复后需确认加入。

## 改动域

- `backend/peekview/services/html_render_service.py` — 修改 script 处理逻辑
- `backend/tests/test_html_render.py` — 补充 module script 注入测试

known_risks:
  - ES module 内联后 `import` 相对路径仍可能失败（硬限制）
  - 需测试 importmap + module script 组合场景
  - 需测试多个 module script 的注入顺序

executor_env:
  platform: opencode
  has_task_tool: true
  has_local_runtime: true
  network: full

env_constraints:
  debug_env: make debug (127.0.0.1:8888, /tmp/peekview-debug/)

pruning_tendency: 保守 — 涉及安全相关（script 注入）+ 浏览器兼容性，须走 P2 评审 + P3 TDD
