#!/usr/bin/env python3
"""Seed debug database with realistic test data.

Usage: python3 scripts/seed-debug.py [BASE_URL]
Default BASE_URL: http://127.0.0.1:8888

Creates:
- 3 users: alice, bob, carol (password: testpass123)
- 12 entries: 9 public, 2 private, 1 archived
- File types: Python, TypeScript, YAML, Markdown (rich), HTML, SVG, PlantUML, Mermaid, JSON, Shell, binary PNG
"""

import sys
import requests

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8888"

MINI_PNG_B64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="

SVG_LOGO = (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">\n'
    '  <rect width="100" height="100" rx="15" fill="#6366f1"/>\n'
    '  <text x="50" y="65" font-size="48" font-family="monospace" fill="white" text-anchor="middle">PV</text>\n'
    '</svg>'
)

SVG_ICONS = (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 200">\n'
    '  <g transform="translate(20, 20)">\n'
    '    <circle cx="25" cy="25" r="20" fill="#22c55e"/>\n'
    '    <path d="M17 25 L23 31 L33 19" stroke="white" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>\n'
    '    <text x="25" y="65" font-size="12" text-anchor="middle" fill="#374151">成功</text>\n'
    '  </g>\n'
    '  <g transform="translate(80, 20)">\n'
    '    <circle cx="25" cy="25" r="20" fill="#ef4444"/>\n'
    '    <line x1="17" y1="17" x2="33" y2="33" stroke="white" stroke-width="3" stroke-linecap="round"/>\n'
    '    <line x1="33" y1="17" x2="17" y2="33" stroke="white" stroke-width="3" stroke-linecap="round"/>\n'
    '    <text x="25" y="65" font-size="12" text-anchor="middle" fill="#374151">失败</text>\n'
    '  </g>\n'
    '  <g transform="translate(140, 20)">\n'
    '    <circle cx="25" cy="25" r="20" fill="#f59e0b"/>\n'
    '    <line x1="25" y1="15" x2="25" y2="28" stroke="white" stroke-width="3" stroke-linecap="round"/>\n'
    '    <circle cx="25" cy="34" r="2" fill="white"/>\n'
    '    <text x="25" y="65" font-size="12" text-anchor="middle" fill="#374151">警告</text>\n'
    '  </g>\n'
    '  <g transform="translate(200, 20)">\n'
    '    <circle cx="25" cy="25" r="20" fill="#6366f1"/>\n'
    '    <text x="25" y="30" font-size="16" font-weight="bold" text-anchor="middle" fill="white">i</text>\n'
    '    <text x="25" y="65" font-size="12" text-anchor="middle" fill="#374151">信息</text>\n'
    '  </g>\n'
    '  <g transform="translate(20, 110)">\n'
    '    <rect x="0" y="0" width="80" height="36" rx="6" fill="#e0e7ff" stroke="#6366f1" stroke-width="1.5"/>\n'
    '    <text x="40" y="23" font-size="13" text-anchor="middle" fill="#4338ca">输入</text>\n'
    '    <line x1="85" y1="18" x2="115" y2="18" stroke="#6366f1" stroke-width="2" marker-end="url(#arrow)"/>\n'
    '    <rect x="120" y="0" width="80" height="36" rx="6" fill="#e0e7ff" stroke="#6366f1" stroke-width="1.5"/>\n'
    '    <text x="160" y="23" font-size="13" text-anchor="middle" fill="#4338ca">处理</text>\n'
    '    <line x1="205" y1="18" x2="235" y2="18" stroke="#6366f1" stroke-width="2" marker-end="url(#arrow)"/>\n'
    '    <rect x="240" y="0" width="80" height="36" rx="6" fill="#dcfce7" stroke="#22c55e" stroke-width="1.5"/>\n'
    '    <text x="280" y="23" font-size="13" text-anchor="middle" fill="#166534">输出</text>\n'
    '  </g>\n'
    '  <defs>\n'
    '    <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">\n'
    '      <path d="M 0 0 L 10 5 L 0 10 z" fill="#6366f1"/>\n'
    '    </marker>\n'
    '  </defs>\n'
    '</svg>'
)

RICH_MARKDOWN = (
    '# Markdown 渲染测试\n'
    '\n'
    '## 文本样式\n'
    '\n'
    '**粗体**、*斜体*、~~删除线~~、`行内代码`、[链接](https://peekview.dev)\n'
    '\n'
    '## 代码块\n'
    '\n'
    '```python\n'
    'def fibonacci(n: int) -> list[int]:\n'
    '    """生成斐波那契数列"""\n'
    '    a, b = 0, 1\n'
    '    result = []\n'
    '    for _ in range(n):\n'
    '        result.append(a)\n'
    '        a, b = b, a + b\n'
    '    return result\n'
    '```\n'
    '\n'
    '```sql\n'
    'SELECT e.slug, e.summary, COUNT(f.id) AS file_count\n'
    'FROM entries e\n'
    'LEFT JOIN files f ON f.entry_id = e.id\n'
    'WHERE e.is_public = 1 AND e.status = \'active\'\n'
    'GROUP BY e.id\n'
    'ORDER BY e.created_at DESC\n'
    'LIMIT 20;\n'
    '```\n'
    '\n'
    '## 表格\n'
    '\n'
    '| 功能 | 状态 | 优先级 |\n'
    '|------|------|--------|\n'
    '| 冷打开优化 | 进行中 | P0 |\n'
    '| Agent /raw 读取 | 未启动 | P1 |\n'
    '| 标签过滤 | 计划中 | P2 |\n'
    '| 暗色模式 | 已完成 | — |\n'
    '\n'
    '## 任务列表\n'
    '\n'
    '- [x] 数据库 WAL 模式\n'
    '- [x] FTS5 全文搜索\n'
    '- [x] JWT 认证\n'
    '- [ ] MCP Streamable HTTP\n'
    '- [ ] 引用关系字段\n'
    '\n'
    '## 引用与脚注\n'
    '\n'
    '> 好的设计是显而易见的，伟大的设计是透明的。[^1]\n'
    '\n'
    'PeekView 的核心价值是让 Agent 产出物**可读、可查、可回溯**。[^2]\n'
    '\n'
    '[^1]: Joe Sparano\n'
    '[^2]: 产品白皮书 v0.1\n'
    '\n'
    '## 图片\n'
    '\n'
    '![架构图](./architecture.svg)\n'
    '\n'
    '## 嵌套列表\n'
    '\n'
    '1. 后端\n'
    '   1. FastAPI\n'
    '   2. SQLModel + SQLite\n'
    '   3. JWT + bcrypt\n'
    '2. 前端\n'
    '   1. Vue 3 + TypeScript\n'
    '   2. Shiki 代码高亮\n'
    '   3. Mermaid / PlantUML 渲染\n'
    '3. MCP Server\n'
    '   - Node.js / TypeScript\n'
    '   - Streamable HTTP transport\n'
)

HTML_DEMO = (
    '<!DOCTYPE html>\n'
    '<html lang="zh-CN">\n'
    '<head>\n'
    '  <meta charset="UTF-8">\n'
    '  <title>PeekView HTML 渲染测试</title>\n'
    '  <style>\n'
    '    body { font-family: system-ui, sans-serif; max-width: 640px; margin: 2rem auto; padding: 0 1rem; }\n'
    '    .card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 1.5rem; margin: 1rem 0; }\n'
    '    .card h3 { margin-top: 0; color: #6366f1; }\n'
    '    .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; }\n'
    '    .badge-green { background: #dcfce7; color: #166534; }\n'
    '    .badge-red { background: #fee2e2; color: #991b1b; }\n'
    '  </style>\n'
    '</head>\n'
    '<body>\n'
    '  <h1>HTML 渲染测试</h1>\n'
    '  <p>此页面用于验证 PeekView 的 HTML 渲染和 CSP 策略。</p>\n'
    '  <div class="card">\n'
    '    <h3>样式注入</h3>\n'
    '    <p>内联 CSS 应该正常渲染。</p>\n'
    '    <span class="badge badge-green">PASS</span>\n'
    '    <span class="badge badge-red">FAIL</span>\n'
    '  </div>\n'
    '  <div class="card">\n'
    '    <h3>脚本隔离</h3>\n'
    '    <p>以下脚本在 sandbox iframe 中不应访问父页面：</p>\n'
    '    <script>\n'
    '      document.write(\'<p>脚本执行结果: \' + (window.parent ? "可访问父页面" : "隔离成功") + \'</p>\');\n'
    '    </script>\n'
    '  </div>\n'
    '  <div class="card">\n'
    '    <h3>表单</h3>\n'
    '    <form onsubmit="event.preventDefault(); document.getElementById(\'result\').textContent = \'已提交\'">\n'
    '      <input type="text" placeholder="输入测试" style="padding: 4px 8px; border: 1px solid #ccc; border-radius: 4px;" />\n'
    '      <button type="submit" style="padding: 4px 12px; background: #6366f1; color: white; border: none; border-radius: 4px; cursor: pointer;">提交</button>\n'
    '      <span id="result"></span>\n'
    '    </form>\n'
    '  </div>\n'
    '</body>\n'
    '</html>'
)

MERMAID_FLOWCHART = (
    '# 流程图\n'
    '\n'
    '```mermaid\n'
    'graph TD\n'
    '    A[用户访问链接] --> B{已登录?}\n'
    '    B -->|是| C[显示完整内容]\n'
    '    B -->|否| D[显示公开内容]\n'
    '    D --> E{需要编辑?}\n'
    '    E -->|是| F[跳转登录]\n'
    '    E -->|否| G[浏览结束]\n'
    '    C --> G\n'
    '    F --> C\n'
    '```'
)

MERMAID_SEQUENCE = (
    '# 时序图\n'
    '\n'
    '```mermaid\n'
    'sequenceDiagram\n'
    '    participant U as 用户\n'
    '    participant F as 前端\n'
    '    participant A as API\n'
    '    participant D as SQLite\n'
    '\n'
    '    U->>F: 点击 entry\n'
    '    F->>A: GET /api/v1/entries/:slug\n'
    '    A->>D: SELECT * FROM entries\n'
    '    D-->>A: entry data\n'
    '    A->>D: INSERT INTO entry_reads\n'
    '    A-->>F: 200 OK + entry JSON\n'
    '    F-->>U: 渲染详情页\n'
    '```'
)

MERMAID_GANTT = (
    '# 甘特图\n'
    '\n'
    '```mermaid\n'
    'gantt\n'
    '    title PeekView 开发路线图\n'
    '    dateFormat YYYY-MM-DD\n'
    '    section 基础功能\n'
    '    数据库 + API        :done, db, 2026-06-01, 2026-06-15\n'
    '    前端渲染            :done, fe, 2026-06-10, 2026-06-25\n'
    '    认证系统            :done, auth, 2026-06-20, 2026-07-05\n'
    '    section 增强功能\n'
    '    MCP Server          :done, mcp, 2026-07-01, 2026-07-15\n'
    '    冷打开优化          :active, cold, 2026-07-20, 2026-07-30\n'
    '    section 规划中\n'
    '    引用关系            :plan, ref, 2026-08-01, 2026-08-15\n'
    '    标签过滤            :plan, tag, 2026-08-10, 2026-08-20\n'
    '```'
)

PLANTUML_ARCH = (
    '@startuml\n'
    '!theme cerulean\n'
    'skinparam componentStyle rectangle\n'
    'skinparam defaultFontName "Noto Sans SC"\n'
    '\n'
    'package "前端" {\n'
    '    [Vue 3 应用] as FE\n'
    '    [Pinia 状态管理] as Store\n'
    '}\n'
    '\n'
    'package "后端" {\n'
    '    [FastAPI] as API\n'
    '    [Entry Service] as EntrySvc\n'
    '    [Auth Service] as AuthSvc\n'
    '    [SQLite WAL] as DB\n'
    '}\n'
    '\n'
    'package "MCP" {\n'
    '    [MCP Server] as MCP\n'
    '    [PeekView Client] as Client\n'
    '}\n'
    '\n'
    'FE --> API : HTTP/REST\n'
    'Store --> API : Axios\n'
    'API --> EntrySvc : DI\n'
    'API --> AuthSvc : DI\n'
    'EntrySvc --> DB : SQLModel\n'
    'AuthSvc --> DB : SQLModel\n'
    'MCP --> Client : Streamable HTTP\n'
    'Client --> API : HTTP/REST\n'
    '\n'
    'note right of DB\n'
    '  WAL 模式\n'
    '  FTS5 全文搜索\n'
    '  忙等超时 5s\n'
    'end note\n'
    '@enduml'
)


def register(username: str, password: str = "testpass123") -> str:
    # Login first (user may already exist after restart without data cleanup)
    r = requests.post(f"{BASE}/api/v1/auth/login", json={"username": username, "password": password})
    if r.ok:
        return r.json()["access_token"]
    # User doesn't exist yet, register
    r = requests.post(f"{BASE}/api/v1/auth/register", json={"username": username, "password": password})
    r.raise_for_status()
    return r.json()["access_token"]


def create_entry(token: str, **kwargs) -> dict | None:
    # Deterministic idempotency key from summary → re-running seed won't duplicate
    summary = kwargs.get("summary", "")
    kwargs["idempotency_key"] = f"seed-{summary}"
    r = requests.post(
        f"{BASE}/api/v1/entries",
        headers={"Authorization": f"Bearer {token}"},
        json=kwargs,
    )
    r.raise_for_status()
    return r.json()


def main():
    print(f"Seeding {BASE} ...")

    alice = register("alice")
    bob = register("bob")
    carol = register("carol")
    print("Users: alice, bob, carol")

    # 1. 富 Markdown（表格、代码块、任务列表、脚注、图片链接）
    create_entry(alice,
        summary="Markdown 渲染测试集",
        tags=["markdown", "测试", "渲染"],
        is_public=True,
        files=[
            {"filename": "rich-markdown.md", "content": RICH_MARKDOWN},
            {"filename": "architecture.svg", "content": SVG_LOGO},
        ],
    )

    # 2. HTML 文件（sibling 注入 + CSP 测试）
    create_entry(bob,
        summary="HTML 渲染与 CSP 测试",
        tags=["html", "安全", "CSP"],
        is_public=True,
        files=[
            {"filename": "demo.html", "content": HTML_DEMO},
        ],
    )

    # 3. SVG 矢量图
    create_entry(carol,
        summary="SVG 图标库示例",
        tags=["svg", "图标", "设计"],
        is_public=True,
        files=[
            {"filename": "icons.svg", "content": SVG_ICONS},
            {"filename": "logo.svg", "content": SVG_LOGO},
        ],
    )

    # 4. Mermaid 图表（流程图、时序图、甘特图）
    create_entry(alice,
        summary="Mermaid 图表示例集",
        tags=["mermaid", "图表", "文档"],
        is_public=True,
        files=[
            {"filename": "flowchart.md", "content": MERMAID_FLOWCHART},
            {"filename": "sequence.md", "content": MERMAID_SEQUENCE},
            {"filename": "gantt.md", "content": MERMAID_GANTT},
        ],
    )

    # 5. PlantUML 架构图
    create_entry(bob,
        summary="PlantUML 架构图",
        tags=["plantuml", "架构"],
        is_public=True,
        files=[
            {"filename": "architecture.puml", "content": PLANTUML_ARCH},
        ],
    )

    # 6. Python 项目（多文件）
    create_entry(alice,
        summary="FastAPI 项目脚手架",
        tags=["python", "fastapi", "脚手架"],
        is_public=True,
        files=[
            {"filename": "main.py", "content": "from fastapi import FastAPI\n\napp = FastAPI(title=\"My API\")\n\n@app.get(\"/health\")\nasync def health():\n    return {\"status\": \"ok\"}\n\n@app.get(\"/items/{item_id}\")\nasync def read_item(item_id: int, q: str | None = None):\n    return {\"item_id\": item_id, \"q\": q}"},
            {"filename": "requirements.txt", "content": "fastapi>=0.104.0\nuvicorn[standard]>=0.24.0\nsqlmodel>=0.0.14\nhttpx>=0.25.0"},
            {"filename": "tests/test_main.py", "content": "from fastapi.testclient import TestClient\nfrom main import app\n\nclient = TestClient(app)\n\ndef test_health():\n    response = client.get(\"/health\")\n    assert response.status_code == 200\n    assert response.json() == {\"status\": \"ok\"}"},
        ],
    )

    # 7. K8s YAML
    create_entry(bob,
        summary="Kubernetes 部署速查表",
        tags=["k8s", "devops", "速查"],
        is_public=True,
        files=[
            {"filename": "deployment.yaml", "content": "apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: my-app\nspec:\n  replicas: 3\n  selector:\n    matchLabels:\n      app: my-app\n  template:\n    spec:\n      containers:\n      - name: my-app\n        image: my-app:latest\n        ports:\n        - containerPort: 8080\n        resources:\n          requests:\n            memory: \"128Mi\"\n            cpu: \"100m\""},
            {"filename": "service.yaml", "content": "apiVersion: v1\nkind: Service\nmetadata:\n  name: my-app-svc\nspec:\n  selector:\n    app: my-app\n  ports:\n  - port: 80\n    targetPort: 8080\n  type: ClusterIP"},
            {"filename": "README.md", "content": "# K8s 部署速查表\n\n## 常用命令\n\n```bash\nkubectl rollout status deployment/my-app\nkubectl scale deployment/my-app --replicas=5\nkubectl rollout undo deployment/my-app\n```"},
        ],
    )

    # 8. 多文件全栈模板（含 JSON 配置）
    create_entry(alice,
        summary="全栈项目模板（12 文件）",
        tags=["模板", "全栈", "python", "vue"],
        is_public=True,
        files=[
            {"filename": "README.md", "content": "# 全栈项目模板\n\n生产就绪的全栈模板。\n\n## 技术栈\n- 后端: FastAPI + SQLModel + SQLite\n- 前端: Vue 3 + TypeScript + Vite\n- 认证: JWT + bcrypt"},
            {"filename": "src/app.py", "content": "from fastapi import FastAPI\nfrom sqlmodel import SQLModel\n\napp = FastAPI(title=\"Full Stack Template\")\n\n@app.on_event(\"startup\")\ndef on_startup():\n    SQLModel.metadata.create_all(engine)"},
            {"filename": "src/models.py", "content": "from sqlmodel import SQLModel, Field\n\nclass Entry(SQLModel, table=True):\n    id: int | None = Field(default=None, primary_key=True)\n    slug: str = Field(index=True, unique=True)\n    summary: str"},
            {"filename": "src/config.py", "content": "from pydantic_settings import BaseSettings\n\nclass Settings(BaseSettings):\n    database_url: str = \"sqlite:///./app.db\"\n    secret_key: str = \"change-me\"\n    class Config:\n        env_prefix = \"APP_\""},
            {"filename": "frontend/src/main.ts", "content": "import { createApp } from 'vue'\nimport { createPinia } from 'pinia'\nimport App from './App.vue'\nimport router from './router'\n\nconst app = createApp(App)\napp.use(createPinia())\napp.use(router)\napp.mount('#app')"},
            {"filename": "frontend/src/views/Home.vue", "content": "<template>\n  <div class=\"home\">\n    <h1>欢迎</h1>\n    <p>生产就绪的全栈模板。</p>\n  </div>\n</template>"},
            {"filename": "tsconfig.json", "content": '{\n  "compilerOptions": {\n    "target": "ES2022",\n    "module": "ESNext",\n    "strict": true\n  },\n  "include": ["src/**/*.ts"]\n}'},
            {"filename": "docker-compose.yml", "content": "version: '3.8'\nservices:\n  app:\n    build: .\n    ports:\n      - \"8080:8080\"\n    volumes:\n      - app-data:/app/data\nvolumes:\n  app-data:"},
            {"filename": "Dockerfile", "content": "FROM python:3.12-slim\nWORKDIR /app\nCOPY requirements.txt .\nRUN pip install --no-cache-dir -r requirements.txt\nCMD [\"uvicorn\", \"src.app:app\", \"--host\", \"0.0.0.0\", \"--port\", \"8080\"]"},
            {"filename": ".github/workflows/ci.yml", "content": "name: CI\non: [push, pull_request]\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - run: pip install -r requirements.txt\n      - run: pytest"},
            {"filename": ".gitignore", "content": "__pycache__/\n*.pyc\nnode_modules/\ndist/\n.env"},
            {"filename": "Makefile", "content": "dev:\n\tuvicorn src.app:app --reload\n\ntest:\n\tpytest tests/\n\nbuild:\n\tdocker build -t my-app ."},
        ],
    )

    # 9. 含二进制图片的 entry
    create_entry(carol,
        summary="产品截图与设计稿",
        tags=["截图", "设计", "图片"],
        is_public=True,
        files=[
            {"filename": "README.md", "content": "# 产品截图\n\n## 首页\n\n![首页截图](screenshot.png)\n\n## Logo\n\n![Logo](logo.svg)\n\n## 说明\n\n- `screenshot.png` — 二进制图片（不可编辑，显示为预览）\n- `logo.svg` — SVG 矢量图（可编辑，显示为代码+预览）\n"},
            {"filename": "screenshot.png", "content_base64": MINI_PNG_B64},
            {"filename": "logo.svg", "content": SVG_LOGO},
        ],
    )

    # 10. 私有：内部设计文档
    create_entry(alice,
        summary="内部 API v2 设计稿",
        tags=["内部", "设计", "草稿"],
        is_public=False,
        files=[
            {"filename": "api-v2.md", "content": "# API v2 设计\n\n## 破坏性变更\n\n1. `/entries` → `/api/v2/entries`\n2. 响应信封: `{data: {...}, meta: {...}}`\n3. 分页: cursor-based 替代 offset\n\n## TODO\n- [ ] 编写迁移指南\n- [ ] 更新 SDK 客户端\n- [ ] 废弃时间线"},
        ],
    )

    # 11. 私有：安全审计
    create_entry(bob,
        summary="安全审计记录 Q3",
        tags=["安全", "审计", "机密"],
        is_public=False,
        files=[
            {"filename": "audit-2026-q3.md", "content": "# 安全审计 Q3 2026\n\n## 发现\n\n### 严重\n- 无\n\n### 高危\n- CSP 允许 'unsafe-eval'（Mermaid 需要）\n\n### 中危\n- 仅认证端点有速率限制\n- 状态变更请求无 CSRF token\n\n### 低危\n- 服务器版本头暴露"},
            {"filename": "remediation.md", "content": "# 修复计划\n\n## 高优先级\n1. CSP: 评估 Mermaid sandbox 方案\n2. CSRF: 实现 double-submit cookie\n\n## 中优先级\n1. 所有 API 端点限速\n2. 移除 server header\n\n## 时间线\n- Q3 2026: 高优先级\n- Q4 2026: 中优先级"},
        ],
    )

    # 12. 归档 entry
    r = create_entry(carol,
        summary="旧版部署脚本（已归档）",
        tags=["旧版", "部署"],
        is_public=True,
        files=[
            {"filename": "deploy.sh", "content": "#!/bin/bash\nset -e\n\necho \"部署到生产环境...\"\nssh prod-server \"cd /app && git pull && docker-compose up -d\"\necho \"完成!\""},
        ],
    )
    requests.patch(
        f"{BASE}/api/v1/entries/{r['slug']}",
        headers={"Authorization": f"Bearer {carol}"},
        json={"status": "archived"},
    )

    r = requests.get(f"{BASE}/api/v1/entries", headers={"Authorization": f"Bearer {alice}"})
    total = r.json().get("total", "?")
    print(f"Done. Total entries: {total}")
    print("Users: alice/bob/carol (password: testpass123)")
    print("Entries: 9 public + 2 private + 1 archived")


if __name__ == "__main__":
    main()
