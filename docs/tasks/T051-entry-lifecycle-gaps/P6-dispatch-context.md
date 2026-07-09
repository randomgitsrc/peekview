# T051 P6 Dispatch Context

## 环境状态

- Debug backend 运行在 http://127.0.0.1:8888
- 测试用户: testuser / testpass123 (is_admin=true)
- 数据库: /tmp/peekview-debug/peekview.db (隔离)
- CDP Chrome: http://127.0.0.1:18800

## 测试数据

- p6-active: active 条目, owner=testuser, is_public=true
- p6-expired: active 条目但 expires_at 已过期 (DB 手动设置), owner=testuser, is_public=true
- 还有之前的匿名条目 (owner_id=null)

## 关键 CSS 选择器

- 筛选栏 tabs: .owner-tab
- 用户名链接: a.meta-username (router-link to /users/{username})
- 过期警告 banner: .expired-warning-banner (黄色背景)
- Header meta 行: .header-meta-row
- Header actions 行: .header-actions-row
- 移动端操作栏: .mobile-actions
- 时间显示: .entry-time (text=相对时间, title=绝对时间)
- Archived badge: .entry-archived-badge (红色)

## 前端路由

- 列表页: /explore (不是 /)
- 详情页: /{slug} (不是 /entries/{slug})
- 用户条目列表: /users/{username}

## 后端 API

- 登录: POST /api/v1/auth/login {"username":"testuser","password":"testpass123"}
- 列表: GET /api/v1/entries?status=archived
- 详情: GET /api/v1/entries/{slug}

## Playwright 注意事项

- 连接: chromium.connectOverCDP('http://127.0.0.1:18800')
- 登录后设 cookie: peekview_token
- 列表页 tabs 仅登录后可见 (showTabs = authState === 'authenticated')
- 不要 browser.close() — CDP 共享 Chrome
