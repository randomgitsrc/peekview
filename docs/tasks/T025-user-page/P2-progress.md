# P2 进度日志 — T025 user-page

- **已读**: P0-brief.md → P1-requirements.md → PAUSED-resolution.md → CLAUDE.md → WORKFLOW.md → architect.md
- **代码巡检**:
  - `entry_service.py` list_entries (289-411): owner="me" 分支（325-329），权限过滤（330-344），batch username resolve（378-385），EntryListResponse 构造（411）
  - `models.py`: EntryListResponse 当前无 owner_found 字段（429-435），EntryListItem 有 username/owner_id（389-403）
  - `entries.py` API route: owner query param 已透传（108-127），无改动
  - `EntryListView.vue`: router-link 包裹 card-body（77），setOwner() 无 URL 同步（194-197），mount 仅恢复 ?owner=me（287-295）
  - `router.ts`: 无 /users/:username 路由
  - `entry.ts` store: loadEntries 未回传 ownerFound
  - `api/types.ts`: EntryListApiResponse 无 owner_found
  - `types/index.ts`: EntryListResponse 无 ownerFound，Entry 有 username/ownerId
  - `client.ts`: transformListItem 映射 username/owner_id

- **设计要点确认**:
  1. 后端解耦：owner→user_id 解析 + 权限叠加（两阶段），无分支爆炸
  2. owner_found 三态：true/false/None（null）
  3. 前端 owner prop 三态：undefined(banner无,tabs有)/"me"(banner无,tabs高亮Mine)/"alice"(banner有,tabs隐藏)
  4. 嵌套 router-link：外层 @click + router.push，username 用 <a> 或 router-link
  5. chip 组件：/explore?owner=alice 显示 "@alice ×"，dismissible
  6. banner 组件：/users/alice 显示 "@alice 的发布内容" + Back to Home
  7. 点自己 username → /explore?owner=me（需判断 currentUser）
  8. tab URL 同步：setOwner() + router.replace

- **Round 2 评审修正**:
  - BLK-1/2: 确认所有 EntryListResponse 构造点（L327, L365-367, L411，+新 Phase 1 return），每个必须显式传 owner_found
  - H-1: BannerBar 加 ownerFound 条件，不存在用户时不显示 banner
  - H-2: 卡片外层 div 加 role="link" + tabindex="0" + keydown 处理
  - H-3: authState race — 加 watch(authState) 在 authenticated 时补检 URL
  - M-1: user-not-found 整合进 v-if chain
  - M-2: explore 分支 currentPage=1 显式重置
  - M-3: setOwner/clearOwnerFilter 统一数据→URL 顺序
  - M-4: BannerBar 移动端断点具体化
  - M-5: func.lower 无函数索引记 tech debt
  - M-6: 增补 BE-8/BE-9（FTS + owner 组合）
  - M-7: owner_found 字段加 Field(description=...)
  - S-1~4: 措辞修正、owner_found 语义集中定义、FilterChip YAGNI、路由注释
