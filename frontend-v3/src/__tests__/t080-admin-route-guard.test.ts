// T086: admin/settings 信息架构收敛
//
// 本文件原测试路由级 requiresAdmin guard（/admin 独立路由）。T086 删除了该路由，
// 权限判断下沉到 SettingsView.vue 内部的 tab 级逻辑（tabs computed 过滤 /
// activeTab 回退 / mobile-stacked v-if），因此本文件原地重写为测试 tab 级守卫。
//
// 迁移映射（P2-design.md §3.6）：
//   test_bdd_14  → 非 admin 请求 ?tab=user-manager 回退 profile          (对应 T086 BDD-6)
//   test_bdd_14b → admin 请求 ?tab=user-manager 拿到 user-manager tab   (对应 T086 BDD-4 反面验证)
//   test_bdd_15/15b/15c → 路由级 loading→resolve 时序测试，迁移后失去测试对象，
//     标注 [DESIGN_GAP:]，理由见下方对应 describe 块。
//
// 新增（P2-review Advisory Note #1 要求为三处权限判断各写红灯用例，覆盖 T086 BDD-4/5/13/14/17）：
//   桌面 tab-nav 按钮渲染 / 移动端堆叠区块渲染 / 前端 /admin 遗留引用回归检查

import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { fileURLToPath } from 'node:url'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { useAuthStore } from '@/stores/auth'
import SettingsView from '@/views/SettingsView.vue'
import type { User } from '@/types'

vi.mock('@/api/client', () => ({
  api: {
    listEntries: vi.fn(),
    logout: vi.fn(),
    login: vi.fn(),
    register: vi.fn(),
    getMe: vi.fn().mockResolvedValue(null),
    deleteEntry: vi.fn(),
    toggleEntryVisibility: vi.fn(),
    getEntry: vi.fn(),
    getFileContent: vi.fn(),
    listUsers: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    disableUser: vi.fn(),
    enableUser: vi.fn(),
    promoteUser: vi.fn(),
    demoteUser: vi.fn(),
    resetUserPassword: vi.fn(),
    deleteUser: vi.fn(),
    listApiKeys: vi.fn().mockResolvedValue([]),
    createApiKey: vi.fn(),
    revokeApiKey: vi.fn(),
    cleanupExpiredKeys: vi.fn(),
    changePassword: vi.fn(),
    updateProfile: vi.fn(),
  },
}))

const ADMIN_USER: User = { id: 1, username: 'admin', displayName: null, isActive: true, isAdmin: true, createdAt: '' }
const NORMAL_USER: User = { id: 2, username: 'bob', displayName: null, isActive: true, isAdmin: false, createdAt: '' }

async function mountSettings(user: User, tab?: string) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const authStore = useAuthStore()
  authStore.initializing = false
  authStore.user = user

  const { createRouter, createMemoryHistory } = await import('vue-router')
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'landing', component: { render: () => null } },
      { path: '/settings', name: 'settings', component: { render: () => null } },
    ],
  })
  await router.push(tab ? `/settings?tab=${tab}` : '/settings')
  await router.isReady()

  const wrapper = mount(SettingsView, {
    global: {
      plugins: [pinia, router],
      stubs: {
        ThemeToggle: true,
        ProfileTab: true,
        SecurityTab: true,
        ApiKeySettingsTab: true,
      },
    },
  })
  await flushPromises()
  return wrapper
}

describe('T086 BDD-4: admin desktop tab-nav shows user-manager option', () => {
  it('test_bdd_4: renders [data-testid="tab-user-manager"] in desktop tab-nav for admin', async () => {
    const wrapper = await mountSettings(ADMIN_USER)
    expect(wrapper.find('[data-testid="tab-user-manager"]').exists()).toBe(true)
  })
})

describe('T086 BDD-5: non-admin desktop tab-nav does not show user-manager option', () => {
  it('test_bdd_5: does not render [data-testid="tab-user-manager"] in desktop tab-nav for non-admin', async () => {
    const wrapper = await mountSettings(NORMAL_USER)
    expect(wrapper.find('[data-testid="tab-user-manager"]').exists()).toBe(false)
  })
})

describe('BDD-14 (legacy label, migrated): tab-level guard for ?tab=user-manager query param', () => {
  it('test_bdd_14: non-admin requesting ?tab=user-manager falls back to profile tab content (T086 BDD-6)', async () => {
    const wrapper = await mountSettings(NORMAL_USER, 'user-manager')
    expect(wrapper.find('[data-testid="user-manager-content"]').exists()).toBe(false)
    expect(wrapper.find('profile-tab-stub').exists()).toBe(true)
  })

  it('test_bdd_14b: admin requesting ?tab=user-manager gets user-manager tab content (T086 BDD-4 反面验证)', async () => {
    const wrapper = await mountSettings(ADMIN_USER, 'user-manager')
    expect(wrapper.find('[data-testid="user-manager-content"]').exists()).toBe(true)
  })
})

describe('BDD-15 (legacy label, migrated): unauthenticated/loading timing — DESIGN_GAP', () => {
  // [DESIGN_GAP: t080 原 test_bdd_15/15b/15c 测的是路由级 requiresAdmin guard 在
  // authState 从 loading→resolve 过渡期间的重定向时序。T086 删除了 /admin 路由，
  // SettingsView.vue 模板根节点始终是 `v-if="authState === 'authenticated'"`
  // （见 frontend-v3/src/views/SettingsView.vue:2），即整个 tab-nav/tab-content/
  // mobile-stacked 子树只在已确定 authenticated 之后才挂载，component 内部不存在
  // "loading→resolve" 的中间态需要测试——未登录场景已经在路由级 /settings guard
  // 处理（BDD-7，且已有 frontend-v3/src/__tests__/t069-auth-guard.test.ts 的
  // BDD-1/2/4/5 覆盖 /settings 的 loading→authenticated / loading→anonymous
  // 时序）。判断为：无处可迁移，非遗漏。P4/P7 请复核，若认可请转抄为
  // [DESIGN_GAP_REVIEWED: ...]]
  it.skip('test_bdd_15: [DESIGN_GAP: 见上方 describe 块注释——路由级 loading 时序场景已由 t069-auth-guard.test.ts BDD-2 覆盖，SettingsView 内部无对应中间态]', () => {
    expect(true).toBe(true)
  })

  it.skip('test_bdd_15b: [DESIGN_GAP: 见上方 describe 块注释——loading→unauthenticated 时序已由 t069-auth-guard.test.ts BDD-2 覆盖]', () => {
    expect(true).toBe(true)
  })

  it.skip('test_bdd_15c: [DESIGN_GAP: 见上方 describe 块注释——loading→admin 时序已由 t069-auth-guard.test.ts BDD-1 覆盖，SettingsView 内部无对应中间态]', () => {
    expect(true).toBe(true)
  })
})

describe('T086 BDD-13: admin mobile-stacked shows user-manager section', () => {
  it('test_bdd_13: .mobile-stacked contains [data-testid="user-manager-content"] for admin', async () => {
    const wrapper = await mountSettings(ADMIN_USER)
    expect(wrapper.find('.mobile-stacked [data-testid="user-manager-content"]').exists()).toBe(true)
  })
})

describe('T086 BDD-14: non-admin mobile-stacked does not render user-manager section', () => {
  it('test_t086_bdd_14: .mobile-stacked does not contain [data-testid="user-manager-content"] for non-admin', async () => {
    const wrapper = await mountSettings(NORMAL_USER)
    expect(wrapper.find('.mobile-stacked [data-testid="user-manager-content"]').exists()).toBe(false)
  })
})

describe('T086 BDD-17: no lingering frontend /admin navigation references', () => {
  it('test_bdd_17: no hardcoded "/admin" navigation outside router.ts and api/client.ts', () => {
    const testDir = dirname(fileURLToPath(import.meta.url))
    const srcDir = join(testDir, '..')
    const offenders: string[] = []
    const ADMIN_LITERAL = /(['"`])\/admin\1/

    function walk(dir: string) {
      for (const entry of readdirSync(dir)) {
        if (entry === '__tests__' || entry === 'node_modules') continue
        const full = join(dir, entry)
        const stat = statSync(full)
        if (stat.isDirectory()) {
          walk(full)
          continue
        }
        if (!/\.(vue|ts)$/.test(entry)) continue
        if (full.endsWith(join('src', 'router.ts'))) continue
        if (full.endsWith(join('api', 'client.ts'))) continue

        const content = readFileSync(full, 'utf-8')
        if (ADMIN_LITERAL.test(content)) {
          offenders.push(full)
        }
      }
    }

    walk(srcDir)
    expect(offenders).toEqual([])
  })
})
