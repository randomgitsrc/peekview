# Task 19: 完整测试体系设计文档

> 版本: 1.0  
> 日期: 2026-04-25  
> 状态: P1 测试设计阶段  

---

## 1. 测试项总览

基于需求文档 (spec-requirements.md)、设计文档 (spec-design.md)、测试计划 (spec-test-plan.md) 和 UI 设计规范 (ui-design-spec.md)，提取全部测试项。

### 1.1 后端测试项

| 类别 | 测试项 | 来源 | 优先级 |
|------|--------|------|--------|
| **数据模型** | Entry 创建、slug 唯一性、级联删除 | spec-design.md 3.1 | P0 |
| | File 创建、路径保留、外键约束 | spec-design.md 3.2 | P0 |
| **存储层** | 文件写入/读取、目录结构保留 | spec-design.md 4.1-4.4 | P0 |
| | 原子写入、路径遍历防护 | spec-design.md 4.4 | P0 |
| **语言检测** | 扩展名映射、文件名映射、二进制检测 | spec-design.md 10 | P1 |
| **服务层** | Entry 创建（内容/路径/目录/混合） | spec-requirements.md 4.1.2 | P0 |
| | slug 自动生成与冲突处理 | spec-requirements.md 4.1.8 | P0 |
| | 文件上传大小/数量限制 | spec-requirements.md 4.1.4 | P0 |
| | local_path 安全校验 | spec-design.md 4.3 | P0 |
| | 目录递归扫描（含忽略规则） | spec-design.md 4.5 | P1 |
| | FTS5 搜索、标签过滤 | spec-design.md 3.3 | P0 |
| **API 端点** | POST /entries - 创建条目 | spec-design.md 5.3 | P0 |
| | GET /entries - 列表查询 | spec-design.md 5.6 | P0 |
| | GET /entries/{slug} - 详情 | spec-design.md 5.8 | P0 |
| | DELETE /entries/{slug} - 删除 | spec-design.md 5.3 | P0 |
| | GET /entries/{slug}/files/{id} - 下载 | spec-design.md 5.3 | P0 |
| | GET /health - 健康检查 | spec-design.md 5.4 | P0 |
| | 错误响应格式 | spec-design.md 5.2 | P0 |
| **CLI** | peek serve - 启动服务 | spec-requirements.md 4.1.6 | P0 |
| | peek create - 创建条目 | spec-requirements.md 4.1.6 | P0 |
| | peek list - 列表查询 | spec-requirements.md 4.1.6 | P0 |
| | peek get - 查看详情 | spec-requirements.md 4.1.6 | P0 |
| | peek delete - 删除条目 | spec-requirements.md 4.1.6 | P0 |
| **安全** | 路径遍历攻击防护 | spec-design.md 4.3, SEC | P0 |
| | local_path 黑名单 | spec-design.md 4.3 | P0 |
| | SQL 注入防护 | spec-test-plan.md 3.3 | P0 |
| | XSS 防护 | spec-test-plan.md 3.4 | P0 |
| **配置** | 环境变量读取 | spec-design.md 9.2 | P1 |
| | 配置优先级 | spec-design.md 9.3 | P1 |

### 1.2 前端测试项

| 类别 | 测试项 | 来源 | 优先级 |
|------|--------|------|--------|
| **组件 - CodeViewer** | Shiki 语法高亮 | ui-design-spec.md 4.3 | P0 |
| | 行号显示（不可选中） | ui-design-spec.md 4.3 | P0 |
| | 自动换行切换 | ui-design-spec.md 4.3 | P0 |
| | 一键复制（不含行号） | ui-designments.md US-06 | P0 |
| | 加载骨架屏 | ui-design-spec.md 5.3 | P0 |
| **组件 - MarkdownViewer** | Markdown 渲染 | spec-requirements.md 4.2.2 | P0 |
| | 代码块高亮+复制按钮 | spec-requirements.md 4.2.2 | P0 |
| | 目录大纲(TOC) | spec-requirements.md 4.2.2 | P0 |
| | XSS 防护(sanitize-html) | spec-requirements.md 4.2.2 | P0 |
| | 表格横向滚动 | ui-design-spec.md 4.4 | P1 |
| **组件 - FileTree** | 树形结构渲染 | spec-requirements.md 4.2.3 | P0 |
| | 点击切换文件 | spec-requirements.md 4.2.3 | P0 |
| | 当前文件高亮 | ui-design-spec.md 5.1 | P0 |
| | 目录展开/收起 | spec-test-plan.md 4.1 | P0 |
| **组件 - MobileBottomBar** | 多文件显示汉堡按钮 | ui-design-spec.md 3.3, US-07 | P0 |
| | 单文件显示文件名 | ui-design-spec.md 3.3 | P0 |
| | 代码文件显示 Wrap 按钮 | ui-design-spec.md 3.3 | P0 |
| | Markdown 隐藏 Wrap 按钮 | ui-design-spec.md 3.3 | P0 |
| | 有 TOC 时显示 TOC 按钮 | ui-design-spec.md 3.3 | P0 |
| | Copy/Download 按钮 | ui-design-spec.md 4.2 | P0 |
| **组件 - ThemeToggle** | 主题切换 | spec-requirements.md US-10 | P0 |
| | 跟随系统偏好 | spec-requirements.md US-10 | P0 |
| | 持久化到 localStorage | spec-test-plan.md 4.2 | P0 |
| **页面 - EntryListView** | 条目列表渲染 | spec-requirements.md 4.3.1 | P0 |
| | 搜索功能 | spec-requirements.md US-04 | P0 |
| | 分页功能 | spec-requirements.md 4.3.1 | P0 |
| | 点击进入详情 | spec-requirements.md 4.3.1 | P0 |
| | 空状态显示 | spec-test-plan.md 4.4 | P1 |
| **页面 - EntryDetailView** | 详情渲染 | spec-requirements.md 4.2 | P0 |
| | 文件树交互 | spec-requirements.md 4.2.3 | P0 |
| | URL ?file= 参数定位 | spec-requirements.md 4.2.6 | P0 |
| | 二进制文件显示下载 | spec-requirements.md 4.2.4 | P0 |
| | 图片内联显示 | spec-requirements.md 4.2.4 | P0 |
| **Composables** | useTheme - 主题管理 | spec-test-plan.md 4.2 | P0 |
| | useEntry - 数据获取与缓存 | spec-test-plan.md 4.2 | P0 |
| | useShiki - 高亮初始化 | spec-test-plan.md 4.2 | P1 |
| **响应式** | 桌面端三栏布局 (≥1024px) | ui-design-spec.md 3.1 | P0 |
| | 平板两栏布局 (768-1023px) | ui-design-spec.md 3.2 | P1 |
| | 移动端单栏+底部栏 (<768px) | ui-design-spec.md 3.3, US-07 | P0 |
| | 抽屉交互（文件/TOC） | ui-design-spec.md 3.3 | P0 |
| **交互** | 按钮点击反馈 | ui-design-spec.md 5.2 | P1 |
| | Toast 通知 | ui-design-spec.md 5.5 | P1 |
| | 键盘导航无障碍 | ui-design-spec.md 7 | P1 |

---

## 2. 测试用例设计

### 2.1 E2E 测试用例（Playwright + CDP）

#### TC-E2E-01: 完整生命周期测试
```yaml
场景: 创建条目 → 查看列表 → 查看详情 → 下载文件 → 删除条目
前置条件:
  - Chrome CDP 运行: http://127.0.0.1:18800
  - PeekView 后端运行: http://localhost:8080
步骤:
  1. 调用 API 创建多文件条目
  2. 访问首页，验证条目显示在列表中
  3. 点击条目，进入详情页
  4. 验证文件树显示正确
  5. 点击文件，验证内容显示
  6. 点击复制按钮，验证剪贴板内容
  7. 点击下载按钮，验证文件下载
  8. 删除条目，验证列表中消失
预期结果: 所有步骤成功，截图验证每一步
```

#### TC-E2E-02: 桌面端布局验证
```yaml
场景: 桌面端三栏布局显示正确
视口: 1920x1080
步骤:
  1. 访问多文件条目详情页
  2. 截图验证左侧文件树、中间内容、右侧 TOC 布局
  3. 验证工具栏显示 Copy/Download/Wrap 按钮
  4. 点击文件树切换文件，验证内容更新
预期结果: 布局符合 ui-design-spec.md 3.1 规范
```

#### TC-E2E-03: 移动端布局验证
```yaml
场景: 移动端底部栏和抽屉交互
视口: 375x667 (iPhone SE)
步骤:
  1. 访问多文件条目详情页
  2. 验证底部栏显示汉堡按钮 + "N files" 徽章
  3. 点击汉堡按钮，验证文件抽屉滑出
  4. 点击文件，验证抽屉关闭，内容切换
  5. 访问 Markdown 文件，验证 TOC 按钮显示
  6. 点击 TOC 按钮，验证 TOC 抽屉滑出
预期结果: 符合 ui-design-spec.md 3.3 底部栏 v3 规范
```

#### TC-E2E-04: 主题切换测试
```yaml
场景: 主题切换和持久化
步骤:
  1. 访问首页，验证默认主题
  2. 点击主题切换按钮，切换到亮色模式
  3. 截图验证亮色主题生效
  4. 刷新页面，验证主题保持
  5. 切换到暗色模式，验证生效
预期结果: 主题切换正常，localStorage 持久化
```

#### TC-E2E-05: 搜索过滤测试
```yaml
场景: 索引页搜索功能
步骤:
  1. 创建 5+ 不同标签的测试条目
  2. 访问首页，截图初始列表
  3. 输入关键词搜索，验证结果过滤
  4. 按标签过滤，验证结果正确
  5. 组合搜索+标签，验证结果
预期结果: 搜索和过滤正常工作
```

#### TC-E2E-06: URL 行号高亮测试
```yaml
场景: URL hash 定位到指定行
步骤:
  1. 创建带代码文件的条目
  2. 访问 /{slug}?file=test.py#L5-L10
  3. 验证页面自动滚动到第 5 行
  4. 验证第 5-10 行高亮显示
预期结果: 行号定位和跳转正常
```

### 2.2 前端单元测试用例（Vitest）

#### TC-FE-01: CodeViewer 组件
```typescript
describe('CodeViewer', () => {
  it('CV1: renders code with Shiki highlighting', () => {})
  it('CV2: displays line numbers', () => {})
  it('CV3: line numbers are not selectable', () => {})
  it('CV4: wrap toggle changes layout', () => {})
  it('CV5: copy button writes to clipboard without line numbers', () => {})
  it('CV6: shows loading skeleton', () => {})
  it('CV7: empty file shows "Empty file" message', () => {})
})
```

#### TC-FE-02: MobileBottomBar 组件
```typescript
describe('MobileBottomBar', () => {
  it('MB1: multi-file shows hamburger + file count', () => {})
  it('MB2: single-file shows filename without hamburger', () => {})
  it('MB3: code file shows Wrap button', () => {})
  it('MB4: markdown hides Wrap button', () => {})
  it('MB5: markdown with TOC shows TOC button', () => {})
  it('MB6: wrap button toggles state', () => {})
  it('MB7: copy button copies content', () => {})
})
```

### 2.3 后端单元测试用例（pytest）

详见 spec-test-plan.md，此处列出关键新增项：

#### TC-BE-01: Entry 创建
```python
def test_create_entry_with_content():
    """内容直传创建"""

def test_create_entry_with_local_path():
    """本地路径引用创建"""

def test_create_entry_dir_upload():
    """目录递归扫描创建"""

def test_create_entry_slug_collision():
    """slug 冲突自动加后缀"""

def test_create_entry_exceeds_file_limit():
    """超出文件数限制返回 413"""
```

---

## 3. 测试脚本/程序设计

### 3.1 测试目录结构

```
peekview/tests/                    # 根测试目录
├── e2e/                          # E2E 测试
│   ├── conftest.py               # Playwright fixtures
│   ├── test_lifecycle.py         # TC-E2E-01
│   ├── test_desktop_layout.py    # TC-E2E-02
│   ├── test_mobile_layout.py     # TC-E2E-03
│   ├── test_theme.py             # TC-E2E-04
│   ├── test_search.py            # TC-E2E-05
│   ├── test_url_hash.py          # TC-E2E-06
│   └── screenshots/              # 截图基线
│       ├── desktop/
│       └── mobile/
└── integration/                  # 集成测试
    └── test_full_stack.py
```

### 3.2 E2E 测试核心代码

#### conftest.py - 共享 fixtures
```python
import pytest
from playwright.async_api import async_playwright

@pytest.fixture(scope="session")
async def browser():
    """连接到 Chrome CDP"""
    async with async_playwright() as p:
        browser = await p.chromium.connect_over_cdp("http://127.0.0.1:18800")
        yield browser
        await browser.close()

@pytest.fixture
async def context(browser):
    """创建新浏览器上下文"""
    context = await browser.new_context()
    yield context
    await context.close()

@pytest.fixture
async def page(context):
    """创建新页面"""
    page = await context.new_page()
    yield page
    await page.close()

@pytest.fixture
async def mobile_context(browser):
    """创建移动端上下文"""
    context = await browser.new_context(
        viewport={'width': 375, 'height': 667},
        user_agent='Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)'
    )
    yield context
    await context.close()
```

#### test_desktop_layout.py - 桌面端测试
```python
import pytest
from playwright.async_api import Page

async def test_desktop_three_column_layout(page: Page):
    """TC-E2E-02: 桌面端三栏布局"""
    await page.goto('http://localhost:8080')
    await page.set_viewport_size({'width': 1920, 'height': 1080})
    
    # 截图验证
    await page.screenshot(path='tests/e2e/screenshots/desktop_layout.png')
    
    # 验证三栏布局元素存在
    assert await page.locator('.file-tree').is_visible()
    assert await page.locator('.content-area').is_visible()
    assert await page.locator('.toc-sidebar').is_visible()
```

#### test_mobile_layout.py - 移动端测试
```python
import pytest

async def test_mobile_bottom_bar_multi_file(mobile_page):
    """TC-E2E-03: 移动端多文件底部栏"""
    await mobile_page.goto('http://localhost:8080/test-entry')
    
    # 验证汉堡按钮和文件计数
    hamburger = mobile_page.locator('.mobile-hamburger')
    await expect(hamburger).to_be_visible()
    await expect(hamburger).to_contain_text('3 files')
    
    # 截图
    await mobile_page.screenshot(path='tests/e2e/screenshots/mobile_bottom_bar.png')
```

### 3.3 测试辅助函数

```python
# tests/e2e/utils.py

async def create_test_entry(api_client, files: dict, summary: str = "Test") -> str:
    """创建测试条目，返回 slug"""
    response = await api_client.post('/api/entries', json={
        'summary': summary,
        'files': [
            {'path': path, 'content': content}
            for path, content in files.items()
        ]
    })
    data = await response.json()
    return data['slug']

async def take_screenshot(page, name: str, full_page: bool = True):
    """截图并保存到标准位置"""
    path = f'tests/e2e/screenshots/{name}.png'
    await page.screenshot(path=path, full_page=full_page)
    return path

def compare_screenshot_baseline(screenshot_path: str, baseline_path: str) -> float:
    """对比截图与基线，返回差异百分比"""
    # 使用 Pillow 进行图像对比
    pass
```

---

## 4. 测试执行计划

### 4.1 P0 测试项（阻塞发布）

| 序号 | 测试项 | 类型 | 状态 | 截图要求 |
|------|--------|------|------|----------|
| 1 | Entry 创建 - 内容直传 | 后端单元 | ⏳ | - |
| 2 | Entry 创建 - 本地路径 | 后端单元 | ⏳ | - |
| 3 | slug 冲突处理 | 后端单元 | ⏳ | - |
| 4 | 文件大小/数量限制 | 后端单元 | ⏳ | - |
| 5 | local_path 安全校验 | 后端安全 | ⏳ | - |
| 6 | API - 创建/查询/删除 | 后端 API | ⏳ | - |
| 7 | 路径遍历防护 | 后端安全 | ⏳ | - |
| 8 | XSS 防护 | 后端安全 | ⏳ | - |
| 9 | CLI - create/list/get/delete | 后端 CLI | ⏳ | - |
| 10 | CodeViewer - 高亮/行号/复制 | 前端单元 | ⏳ | - |
| 11 | MobileBottomBar - 按钮逻辑 | 前端单元 | ⏳ | - |
| 12 | ThemeToggle - 切换/持久化 | 前端单元 | ⏳ | - |
| 13 | EntryListView - 列表/搜索 | 前端单元 | ⏳ | - |
| 14 | EntryDetailView - 详情/交互 | 前端单元 | ⏳ | - |
| 15 | 桌面端三栏布局 | E2E | ⏳ | ✅ |
| 16 | 移动端底部栏 | E2E | ⏳ | ✅ |
| 17 | 主题切换 | E2E | ⏳ | ✅ |
| 18 | 完整生命周期 | E2E | ⏳ | ✅ |

### 4.2 测试执行顺序

```
Phase 1: 后端基础测试
  ├─ 数据模型测试
  ├─ 存储层测试
  └─ 服务层测试

Phase 2: 后端 API/CLI 测试
  ├─ API 端点测试
  ├─ CLI 命令测试
  └─ 安全测试

Phase 3: 前端单元测试
  ├─ 组件测试
  ├─ Composables 测试
  └─ 页面测试

Phase 4: E2E 测试
  ├─ 桌面端布局
  ├─ 移动端布局
  └─ 功能流程

Phase 5: 集成验收
  └─ 全量测试 + 截图验证
```

---

## 5. 测试输出物清单

每个测试项完成后必须输出：

1. **测试代码** - 可执行的测试脚本
2. **测试结果** - test-results.md（通过/失败记录）
3. **截图证据** - 对于 UI 测试，必须有截图
4. **覆盖率报告** - 单元测试覆盖率数据

---

## 6. 检查点状态

| 检查点 | 状态 | 输出文件 |
|--------|------|----------|
| P0.1 problems.md | ✅ 完成 | docs/process/checkpoints/P0-T19/problems.md |
| P0.2 test-strategy.md | ✅ 完成 | docs/process/checkpoints/P0-T19/test-strategy.md |
| P1.1 test-cases.md | ✅ 完成 | 本文档 |
| P1.2 单元测试代码 | ⏳ 待开始 | backend/tests/, frontend/**/*.spec.ts |
| P1.3 manual-checklist.md | ⏳ 待开始 | docs/process/checkpoints/P1-T19/manual-checklist.md |
| P2 代码实现 | ⏳ 待开始 | 测试代码 |
| P3 测试执行 | ⏳ 待开始 | test-results/manual.md + evidences/ |
| P4 一致性检查 | ⏳ 待开始 | consistency-check.md |

---

*下一步：进入 P1.2 编写单元测试代码*
