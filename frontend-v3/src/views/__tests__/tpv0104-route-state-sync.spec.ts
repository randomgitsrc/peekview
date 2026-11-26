/**
 * 补充修复 B — SPA 路由变化时 Entry / file / share 状态同步（集成级）
 *
 * 与 `t031-entry-detail-view.spec.ts` 的区别（关键）：
 * t031 把 `@/stores/entryDetail` **整体 mock**，因此任何 "loadEntry 是否带 fileId/shareToken"
 * 的缺陷都测不出来。本文件**不 mock store 与 api 的行为契约**，而是：
 *   - 真实 Pinia store（`useEntryDetailStore`）
 *   - 真实 vue-router（`createMemoryHistory`）
 *   - 真实 `EntryDetailView` 组件挂载
 * 只把最底层的 `@/api/client` 换成受控假实现，以便断言「加载了哪个 slug / 哪个 fileId / 哪个 shareToken」。
 *
 * 缺陷本体（修复前）：
 *   `watch(() => props.slug)` 只调 `loadEntry(newSlug)` —— 丢失 `route.query.file`
 *   与 `route.query.share`，随后 `syncUrl()` 还会把有效的 `file` 参数清掉。
 *   Vue Router 复用同一组件（`/:slug` 与 `/:slug/f` 同一 component）时必然触发。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory, RouterView } from 'vue-router'
import { defineComponent, h } from 'vue'

// ── 受控 api 假实现：记录每次调用参数，并支持按 slug 注入延迟以模拟竞态 ────────
interface FileRec { id: number; filename: string; path: string | null; language: string; isBinary: boolean; size: number }
interface EntryRec { slug: string; files: FileRec[]; isPublic: boolean }

function file(id: number, filename: string, language = 'markdown'): FileRec {
  return { id, filename, path: filename, language, isBinary: false, size: 10 }
}

const ENTRIES: Record<string, EntryRec> = {
  'entry-a': { slug: 'entry-a', isPublic: true, files: [file(1, 'README.md'), file(2, 'a-2.md')] },
  'entry-b': { slug: 'entry-b', isPublic: true, files: [file(11, 'README.md'), file(12, 'b-2.md'), file(13, 'b-3.md')] },
  'entry-c': { slug: 'entry-c', isPublic: false, files: [file(21, 'README.md')] },
}

const getEntryCalls: Array<{ slug: string; shareToken?: string }> = []
const getContentCalls: Array<{ slug: string; fileId: number }> = []
// slug → 人为延迟（ms），用于竞态测试
const delays: Record<string, number> = {}

vi.mock('@/api/client', () => ({
  api: {
    getEntry: vi.fn(async (slug: string, shareToken?: string) => {
      getEntryCalls.push({ slug, shareToken })
      const d = delays[slug]
      if (d) await new Promise(r => setTimeout(r, d))
      const rec = ENTRIES[slug]
      if (!rec) throw new Error(`Entry not found: ${slug}`)
      return { ...rec, files: rec.files.map(f => ({ ...f })) }
    }),
    getFileContent: vi.fn(async (slug: string, fileId: number) => {
      getContentCalls.push({ slug, fileId })
      return `content-of-${slug}-${fileId}`
    }),
    setUnauthorizedHandler: vi.fn(),
  },
}))

import EntryDetailView from '../EntryDetailView.vue'
import { useEntryDetailStore } from '@/stores/entryDetail'

const Blank = defineComponent({ render: () => h('div') })

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/:slug', name: 'detail', component: EntryDetailView, props: true },
      { path: '/:slug/f', name: 'detail-zen-locked', component: EntryDetailView, props: true, meta: { zen: 'locked' } },
      { path: '/', name: 'home', component: Blank },
    ],
  })
}

/** 挂载真实组件于真实路由，并等待首个加载完成 */
async function mountAt(router: any, path: string) {
  await router.push(path)
  await router.isReady()
  const wrapper = mount(defineComponent({ render: () => h(RouterView) }), {
    global: {
      plugins: [router],
      stubs: {
        // 与被测逻辑无关的重型子组件
        MarkdownViewer: true, CodeViewer: true, HtmlViewer: true, TreeView: true,
        TableView: true, ImageViewer: true, SvgViewer: true, MermaidViewer: true,
        FileTree: true, TocNav: true, EntryDetailHeader: true, EntryDetailMobileBar: true,
        ShareDialog: true, TeamVisibilityDialog: true, PinDialog: true, CommentPanel: true,
        DiffViewer: true, CsvViewer: true,
      },
    },
  })
  await flushPromises()
  return wrapper
}

describe('补充修复 B：SPA 路由状态同步（真实 store + 真实路由）', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    getEntryCalls.length = 0
    getContentCalls.length = 0
    for (const k of Object.keys(delays)) delete delays[k]
  })

  it('test_b1_slug_change_honours_new_route_file_and_share', async () => {
    const router = makeRouter()
    await mountAt(router, '/entry-a')

    // 组件复用：从 A 导航到 B，且 B 带有效 file
    await router.push('/entry-b?file=12')
    await flushPromises()

    const store = useEntryDetailStore()
    // ① 加载了 B，且 fileId 来自**新路由**
    const lastEntryCall = getEntryCalls[getEntryCalls.length - 1]
    expect(lastEntryCall.slug).toBe('entry-b')
    // ② Store 最终是 B 的 file 12，未被默认入口(11)覆盖
    expect(store.currentEntry?.slug).toBe('entry-b')
    expect(store.activeFile?.id).toBe(12)
    // ③ URL 未丢 file 参数
    expect(router.currentRoute.value.query.file).toBe('12')
  })

  it('test_b2_same_entry_file_query_transitions', async () => {
    const router = makeRouter()
    const wrapper = await mountAt(router, '/entry-b')
    const store = useEntryDetailStore()

    // 默认 → 12 → 13 → 默认
    expect(store.activeFile?.id).toBe(11)

    await router.push('/entry-b?file=12'); await flushPromises()
    expect(store.activeFile?.id).toBe(12)
    expect(router.currentRoute.value.query.file).toBe('12')

    await router.push('/entry-b?file=13'); await flushPromises()
    expect(store.activeFile?.id).toBe(13)
    expect(router.currentRoute.value.query.file).toBe('13')

    // 回到无 file：应回默认入口，且 URL 不再带冗余 file
    await router.push('/entry-b'); await flushPromises()
    expect(store.activeFile?.id).toBe(11)
    expect(router.currentRoute.value.query.file).toBeUndefined()

    wrapper.unmount()
  })

  it('test_b3_share_token_participates_in_load', async () => {
    const router = makeRouter()
    await mountAt(router, '/entry-a')

    await router.push('/entry-c?share=tok-abc')
    await flushPromises()

    const lastEntryCall = getEntryCalls[getEntryCalls.length - 1]
    expect(lastEntryCall.slug).toBe('entry-c')
    // share token 必须参与加载（权限验证依赖它）
    expect(lastEntryCall.shareToken).toBe('tok-abc')
    // 且不得被 URL 规范化丢掉
    expect(router.currentRoute.value.query.share).toBe('tok-abc')
  })

  it('test_b4_share_token_change_and_removal', async () => {
    const router = makeRouter()
    await mountAt(router, '/entry-c?share=tok-abc')

    // token 变化 → 必须重新加载（不能沿用旧权限状态）
    const before = getEntryCalls.length
    await router.push('/entry-c?share=tok-xyz')
    await flushPromises()
    expect(getEntryCalls.length).toBeGreaterThan(before)
    expect(getEntryCalls[getEntryCalls.length - 1].shareToken).toBe('tok-xyz')

    // token 被删除 → 也重新加载，且不再携带旧 token
    await router.push('/entry-c')
    await flushPromises()
    expect(getEntryCalls[getEntryCalls.length - 1].shareToken).toBeUndefined()
  })

  it('test_b5_invalid_file_falls_back_to_default', async () => {
    const router = makeRouter()
    await mountAt(router, '/entry-b?file=99999')
    const store = useEntryDetailStore()

    // 回退到 B 的默认入口，不读取其他 Entry 的文件
    expect(store.currentEntry?.slug).toBe('entry-b')
    expect(store.activeFile?.id).toBe(11)
    // URL 规范化：无效 file 被移除
    expect(router.currentRoute.value.query.file).toBeUndefined()
  })

  it('test_b6_slow_entry_a_cannot_override_b', async () => {
    const router = makeRouter()
    delays['entry-b'] = 0    // B 很快
    delays['entry-a'] = 80   // A 很慢

    // 先挂载到 B（完成一次正常加载），再导航到慢的 A，随后立刻切回 B。
    // 这样能确定性地制造「A 的请求在途、B 已完成」的竞态窗口。
    const wrapper = await mountAt(router, '/entry-b')
    const store = useEntryDetailStore()
    expect(store.currentEntry?.slug).toBe('entry-b')

    await router.push('/entry-a')             // 发起 A 的慢加载（不等待完成）
    await flushPromises()
    await router.push('/entry-b?file=12')     // A 仍在途时切回 B
    await flushPromises()

    // 等 A 的慢响应真正回来
    await new Promise(r => setTimeout(r, 150))
    await flushPromises()

    // A 的迟到响应不得覆盖 B
    expect(store.currentEntry?.slug).toBe('entry-b')
    expect(store.activeFile?.id).toBe(12)
    expect(router.currentRoute.value.query.file).toBe('12')

    wrapper.unmount()
  })

  it('test_b7_rapid_file_switching_keeps_last_selection', async () => {
    const router = makeRouter()
    const wrapper = await mountAt(router, '/entry-b')
    const store = useEntryDetailStore()

    // 快速连续切换，不逐次 await 完成
    await router.push('/entry-b?file=12')
    await router.push('/entry-b?file=13')
    await flushPromises()
    await new Promise(r => setTimeout(r, 50))
    await flushPromises()

    expect(store.activeFile?.id).toBe(13)
    expect(router.currentRoute.value.query.file).toBe('13')

    wrapper.unmount()
  })

  it('test_b8_other_query_params_preserved', async () => {
    const router = makeRouter()
    const wrapper = await mountAt(router, '/entry-b?share=tok-abc&file=12')

    // 页内切到另一个文件（模拟用户点击文件树）——只应更新 file，不动 share
    const store = useEntryDetailStore()
    const target = store.currentEntry!.files.find(f => f.id === 13)!
    await store.selectFile(target)
    await flushPromises()
    await new Promise(r => setTimeout(r, 50))
    await flushPromises()

    expect(store.activeFile?.id).toBe(13)
    expect(router.currentRoute.value.query.share).toBe('tok-abc')
    expect(router.currentRoute.value.query.file).toBe('13')

    wrapper.unmount()
  })
})
