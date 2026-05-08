# Task 19: 手工验证清单 (Manual Checklist)

> 版本: 1.0  
> 日期: 2026-04-25  
> 阶段: P1.3  

---

## 验证说明

本清单用于 E2E 测试的截图人工验证。每项测试必须有截图证据存放到 `P3-T19/evidences/`。

---

## 桌面端验证

### 问题 1: 三栏布局显示正确

**检查点**: desktop_three_column_layout

```markdown
- [ ] 步骤1: 使用桌面浏览器 (1920x1080) 访问多文件条目详情页
- [ ] 步骤2: 验证左侧显示文件树侧边栏
- [ ] 步骤3: 验证中间显示代码内容区
- [ ] 步骤4: 验证右侧显示 TOC 侧边栏（Markdown 文件）
- [ ] 证据: 截图保存到 evidences/P1-desktop-three-column.png
- [ ] 通过标准: 三栏比例约为 240px : 1fr : 200px，无重叠遮挡
```

---

### 问题 2: 工具栏按钮显示正确

**检查点**: desktop_toolbar_buttons

```markdown
- [ ] 步骤1: 访问代码文件详情页
- [ ] 步骤2: 验证工具栏显示 Copy 按钮
- [ ] 步骤3: 验证工具栏显示 Download 按钮
- [ ] 步骤4: 验证工具栏显示 Wrap 按钮（代码文件）
- [ ] 证据: 截图保存到 evidences/P2-desktop-toolbar.png
- [ ] 通过标准: 按钮可见，点击有反馈
```

---

### 问题 3: 代码高亮样式正确

**检查点**: desktop_code_highlighting

```markdown
- [ ] 步骤1: 访问 Python 代码文件
- [ ] 步骤2: 验证显示行号
- [ ] 步骤3: 验证代码语法着色（关键字、字符串、注释等）
- [ ] 步骤4: 行号不可选中（尝试复制，不应包含行号）
- [ ] 证据: 截图保存到 evidences/P3-code-highlighting.png
- [ ] 通过标准: 与 VSCode 语法着色一致
```

---

### 问题 4: Wrap 按钮切换正常

**检查点**: desktop_wrap_toggle

```markdown
- [ ] 步骤1: 打开长行代码文件
- [ ] 步骤2: 点击 Wrap 按钮
- [ ] 步骤3: 验证代码自动换行显示
- [ ] 步骤4: 再次点击 Wrap 按钮
- [ ] 步骤5: 验证恢复横向滚动
- [ ] 证据: 
  - evidences/P4-wrap-enabled.png
  - evidences/P4-wrap-disabled.png
- [ ] 通过标准: 切换有视觉反馈，行号对齐正确
```

---

### 问题 5: 复制功能正常

**检查点**: desktop_copy_functionality

```markdown
- [ ] 步骤1: 打开代码文件
- [ ] 步骤2: 点击 Copy 按钮
- [ ] 步骤3: 验证显示 Toast "Copied" 提示
- [ ] 步骤4: 粘贴到文本编辑器
- [ ] 步骤5: 验证内容不含行号
- [ ] 证据: 截图保存到 evidences/P5-copy-feedback.png
- [ ] 通过标准: 复制内容正确，Toast 显示
```

---

### 问题 6: 文件树导航正常

**检查点**: desktop_file_tree_navigation

```markdown
- [ ] 步骤1: 打开多文件条目
- [ ] 步骤2: 点击不同文件
- [ ] 步骤3: 验证当前文件高亮
- [ ] 步骤4: 验证内容区更新
- [ ] 证据: 截图保存到 evidences/P6-file-tree-nav.png
- [ ] 通过标准: 切换流畅，高亮正确
```

---

### 问题 7: TOC 导航正常

**检查点**: desktop_toc_navigation

```markdown
- [ ] 步骤1: 打开 Markdown 文件（带多级标题）
- [ ] 步骤2: 验证右侧 TOC 显示标题大纲
- [ ] 步骤3: 点击 TOC 项
- [ ] 步骤4: 验证页面滚动到对应位置
- [ ] 步骤5: 验证标题高亮
- [ ] 证据: 截图保存到 evidences/P7-toc-nav.png
- [ ] 通过标准: 跳转准确，高亮跟随滚动
```

---

### 问题 8: Markdown 渲染正确

**检查点**: desktop_markdown_rendering

```markdown
- [ ] 步骤1: 打开带完整 Markdown 语法的文件
- [ ] 步骤2: 验证标题层级正确（h1-h6）
- [ ] 步骤3: 验证代码块高亮
- [ ] 步骤4: 验证表格渲染（如有）
- [ ] 步骤5: 验证图片显示（如有）
- [ ] 步骤6: 验证 XSS 过滤（无 script 执行）
- [ ] 证据: 截图保存到 evidences/P8-markdown-render.png
- [ ] 通过标准: 渲染符合 GitHub 风格
```

---

### 问题 9: 主题切换正常

**检查点**: desktop_theme_switching

```markdown
- [ ] 步骤1: 验证默认主题（通常跟随系统）
- [ ] 步骤2: 点击主题切换按钮
- [ ] 步骤3: 验证主题切换（暗色↔亮色）
- [ ] 步骤4: 验证代码高亮主题同步切换
- [ ] 步骤5: 刷新页面
- [ ] 步骤6: 验证主题保持
- [ ] 证据:
  - evidences/P9-theme-dark.png
  - evidences/P9-theme-light.png
- [ ] 通过标准: 切换流畅，高亮同步，持久化正常
```

---

### 问题 10: 列表页搜索过滤正常

**检查点**: desktop_search_filter

```markdown
- [ ] 步骤1: 确保有多个条目
- [ ] 步骤2: 输入搜索关键词
- [ ] 步骤3: 验证列表过滤显示匹配条目
- [ ] 步骤4: 清除搜索
- [ ] 步骤5: 验证恢复全部显示
- [ ] 证据: 截图保存到 evidences/P10-search-filter.png
- [ ] 通过标准: 实时过滤，结果准确
```

---

## 移动端验证

### 问题 11: 底部栏多文件显示正确

**检查点**: mobile_bottom_bar_multi_file

```markdown
- [ ] 步骤1: 使用移动端视口 (375x667)
- [ ] 步骤2: 访问多文件条目
- [ ] 步骤3: 验证底部栏显示汉堡按钮 + "N files" 徽章
- [ ] 步骤4: 验证显示 Wrap、Copy、Download 按钮
- [ ] 证据: 截图保存到 evidences/P11-mobile-multi-file.png
- [ ] 通过标准: 布局符合底部栏 v3 规范
```

---

### 问题 12: 底部栏单文件显示正确

**检查点**: mobile_bottom_bar_single_file

```markdown
- [ ] 步骤1: 访问单文件条目
- [ ] 步骤2: 验证底部栏显示文件名（无汉堡）
- [ ] 步骤3: 验证仍显示 Wrap、Copy、Download 按钮
- [ ] 证据: 截图保存到 evidences/P12-mobile-single-file.png
- [ ] 通过标准: 无汉堡按钮，文件名显示完整
```

---

### 问题 13: Markdown 隐藏 Wrap 按钮

**检查点**: mobile_markdown_no_wrap

```markdown
- [ ] 步骤1: 访问 Markdown 文件
- [ ] 步骤2: 验证底部栏无 Wrap 按钮
- [ ] 步骤3: 验证显示 Copy、Download、TOC 按钮
- [ ] 证据: 截图保存到 evidences/P13-mobile-markdown-buttons.png
- [ ] 通过标准: Wrap 按钮隐藏，TOC 按钮显示
```

---

### 问题 14: 文件抽屉正常

**检查点**: mobile_file_drawer

```markdown
- [ ] 步骤1: 点击汉堡按钮
- [ ] 步骤2: 验证文件抽屉从底部滑出
- [ ] 步骤3: 验证显示完整文件树
- [ ] 步骤4: 点击遮罩层
- [ ] 步骤5: 验证抽屉关闭
- [ ] 步骤6: 再次打开，点击文件
- [ ] 步骤7: 验证抽屉关闭，内容切换
- [ ] 证据:
  - evidences/P14-drawer-open.png
  - evidences/P14-drawer-closed.png
- [ ] 通过标准: 动画流畅，交互正常
```

---

### 问题 15: TOC 抽屉正常

**检查点**: mobile_toc_drawer

```markdown
- [ ] 步骤1: 打开带标题的 Markdown
- [ ] 步骤2: 点击 TOC 按钮
- [ ] 步骤3: 验证 TOC 抽屉从底部滑出
- [ ] 步骤4: 验证显示标题大纲
- [ ] 步骤5: 点击标题项
- [ ] 步骤6: 验证抽屉关闭，页面滚动到对应位置
- [ ] 证据: 截图保存到 evidences/P15-toc-drawer.png
- [ ] 通过标准: 跳转准确，动画流畅
```

---

### 问题 16: 移动端代码横向滚动

**检查点**: mobile_horizontal_scroll

```markdown
- [ ] 步骤1: 打开长行代码文件
- [ ] 步骤2: 确保 Wrap 关闭
- [ ] 步骤3: 左右滑动代码区
- [ ] 步骤4: 验证横向滚动正常
- [ ] 步骤5: 验证行号跟随滚动
- [ ] 证据: 录屏保存到 evidences/P16-mobile-scroll.mp4
- [ ] 通过标准: 滚动流畅，行号固定
```

---

### 问题 17: 移动端主题切换

**检查点**: mobile_theme

```markdown
- [ ] 步骤1: 验证移动端主题按钮位置
- [ ] 步骤2: 点击切换主题
- [ ] 步骤3: 验证暗色/亮色切换
- [ ] 步骤4: 验证底部栏颜色同步变化
- [ ] 证据:
  - evidences/P17-mobile-dark.png
  - evidences/P17-mobile-light.png
- [ ] 通过标准: 主题切换正常，移动端适配
```

---

## 全量测试验证

### 问题 18: 完整生命周期

**检查点**: full_lifecycle

```markdown
- [ ] 步骤1: 通过 API 创建多文件条目
- [ ] 步骤2: 在浏览器中访问首页，验证条目显示
- [ ] 步骤3: 点击进入详情页
- [ ] 步骤4: 验证文件树、代码显示、TOC
- [ ] 步骤5: 点击复制，验证剪贴板
- [ ] 步骤6: 点击下载，验证文件下载
- [ ] 步骤7: 通过 API 删除条目
- [ ] 步骤8: 刷新页面，验证条目消失
- [ ] 证据:
  - evidences/P18-lifecycle-created.png
  - evidences/P18-lifecycle-detail.png
  - evidences/P18-lifecycle-deleted.png
- [ ] 通过标准: 全流程正常
```

---

## 验证汇总

| 问题 | 检查点 | 状态 | 截图路径 | 备注 |
|------|--------|------|----------|------|
| P1 | desktop_three_column_layout | ⏳ | - | - |
| P2 | desktop_toolbar_buttons | ⏳ | - | - |
| P3 | desktop_code_highlighting | ⏳ | - | - |
| P4 | desktop_wrap_toggle | ⏳ | - | - |
| P5 | desktop_copy_functionality | ⏳ | - | - |
| P6 | desktop_file_tree_navigation | ⏳ | - | - |
| P7 | desktop_toc_navigation | ⏳ | - | - |
| P8 | desktop_markdown_rendering | ⏳ | - | - |
| P9 | desktop_theme_switching | ⏳ | - | - |
| P10 | desktop_search_filter | ⏳ | - | - |
| P11 | mobile_bottom_bar_multi_file | ⏳ | - | - |
| P12 | mobile_bottom_bar_single_file | ⏳ | - | - |
| P13 | mobile_markdown_no_wrap | ⏳ | - | - |
| P14 | mobile_file_drawer | ⏳ | - | - |
| P15 | mobile_toc_drawer | ⏳ | - | - |
| P16 | mobile_horizontal_scroll | ⏳ | - | - |
| P17 | mobile_theme | ⏳ | - | - |
| P18 | full_lifecycle | ⏳ | - | - |

---

## 提交说明

每项验证完成后：
1. 勾选对应复选框
2. 截图保存到 evidences/ 目录
3. 更新本清单状态
4. 所有 P0 项目通过后可进入 P3 阶段
