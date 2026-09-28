// TPV0099 锁死态（/{slug}/f）zen composable 单测 —— P3 TDD 红灯
//
// 运行：make test-frontend（vitest，jsdom）
// 覆盖：BDD-4（锁死下 f 不改变视图）/ BDD-5（锁死下 Escape 不改变视图）/
//       BDD-6（锁死态不宣告退出方式）/ BDD-12（非锁死态行为不变）
//       + M9「锁定态派生随 route meta 翻转」（禁止变体的唯一可执行拦截）
//
// 实现规格依据：P2-design.md §1.1「锁死态接口的最终规格」表（唯一形态）
//   useZenMode(locked: () => boolean = () => false)
//   内部一律 locked()；zenMode = computed(() => locked() || manualZen.value)
//   返回对象 = { zenMode, zenAriaText, handleZenKeydown }（无 updateZenAria）
//   handleZenKeydown 首行锁死短路 = 整函数 return（不 preventDefault / 不 stopPropagation）
//
// TDD 红灯形态（P3 时点，实现未写）：全部为断言失败（B 类），非语法/import 错。
//   - 现状 useZenMode() 无参、zenMode 为 ref(false)、zenAriaText 为 ref、返回含 updateZenAria
//   - 传入 thunk 时运行期被忽略（vitest 走 esbuild 剥类型、不做类型检查）→ 锁死态断言失败
//
// ⚠️ 类型纪律（防 P5 误红）：本文件被 `make typecheck`（vue-tsc，include: src/**/*.ts）
//    覆盖。因此**禁止使用 `@ts-expect-error`**——P4 实现新签名后该指令会变成
//    "未使用"（TS2578）而打红 typecheck。改为下方 `zenApi()` 类型化包装：
//    它对「旧签名」与「新签名」两种实现**均可编译**，故不产生 P3→P5 的类型翻转。
//
// ⚠️ 硬约束 1（P2 eng-review NB-1，本文件最重要的一条）：
//    M9 翻转用例 **必须由 reactive 源驱动 thunk**。若用非响应式局部变量驱动，
//    computed 不会重算，**正确实现也会返回 [false,false,false] → 误红正确实现**。
//    故本文件用 `reactive({ meta: {} })` 模拟 `route.meta`，并以「不重新调用 useZenMode()」
//    为硬性前提（见 test_m9_*）。

import { describe, it, expect } from 'vitest'
import { reactive, nextTick } from 'vue'
import { useZenMode } from '../useZenMode'

// ---------- BDD-6 词表（闭集，逐字取自 P1 BDD-6） ----------
const EXIT_PHRASES = ['Press f or Escape to exit', '按 f 退出']

/**
 * P2 §1.1 最终规格的调用面（旧/新签名均可编译的包装，见文件头「类型纪律」）。
 * 形态：`useZenMode(locked: () => boolean = () => false)`
 * 返回：`{ zenMode, zenAriaText, handleZenKeydown }`
 */
interface ZenApi {
  zenMode: { value: boolean }
  zenAriaText: { value: string }
  handleZenKeydown: (event: KeyboardEvent) => void
}
const zenApi = useZenMode as unknown as (locked?: () => boolean) => ZenApi

/** 构造一个「锁死态 thunk 读 reactive 源」的 route 替身（P2 §1.1 M3 的调用点形态）。 */
function makeRouteStub(initialZen?: string) {
  return reactive<{ meta: { zen?: string } }>({ meta: { zen: initialZen } })
}

/** P2 §1.1 M3 的调用点形态（thunk + 可选链，二者缺一不可）。 */
function lockedFrom(route: { meta: { zen?: string } }) {
  return () => route.meta?.zen === 'locked'
}

function keydown(key: string, init: KeyboardEventInit = {}): KeyboardEvent {
  return new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init })
}

describe('TPV0099 锁死态 zen（/{slug}/f）', () => {
  // ============================================================
  // BDD-4: 全屏视图内按 f 不改变视图
  // ============================================================
  it('test_bdd_4_locked_f_key_keeps_state_unchanged', async () => {
    const route = makeRouteStub('locked')
    const { zenMode, zenAriaText, handleZenKeydown } = zenApi(lockedFrom(route))

    // Given 已通过 /{slug}/f 进入全屏视图
    expect(zenMode.value, 'l3_1 锁死态 zenMode 应为 true（PIN:computed_locked_derivation）').toBe(true)
    const ariaBefore = zenAriaText.value

    // When 依次按 f、F、Ctrl+f
    const events = [keydown('f'), keydown('F'), keydown('f', { ctrlKey: true })]
    for (const ev of events) handleZenKeydown(ev)
    await nextTick()

    // Then 视图状态不变
    expect(zenMode.value, 'l4_1 锁死态按 f/F/Ctrl+f 后 zenMode 必须保持 true').toBe(true)
    expect(zenAriaText.value, 'l4_2 锁死态按 f/F/Ctrl+f 后公告文本必须不变').toBe(ariaBefore)
    for (const ev of events) {
      expect(ev.defaultPrevented, `l4_3 锁死短路必须整函数 return，不得 preventDefault（key=${ev.key}）`).toBe(false)
    }
  })

  // ============================================================
  // BDD-5: 全屏视图内按 Escape 不改变视图
  // ============================================================
  it('test_bdd_5_locked_escape_keeps_state_unchanged', async () => {
    const route = makeRouteStub('locked')
    const { zenMode, zenAriaText, handleZenKeydown } = zenApi(lockedFrom(route))

    expect(zenMode.value, 'l3_1 锁死态 zenMode 应为 true（PIN:computed_locked_derivation）').toBe(true)
    const ariaBefore = zenAriaText.value

    const ev = keydown('Escape')
    handleZenKeydown(ev)
    await nextTick()

    expect(zenMode.value, 'l5_1 锁死态按 Escape 后 zenMode 必须保持 true（无页内出口）').toBe(true)
    expect(zenAriaText.value, 'l5_2 锁死态按 Escape 后公告文本必须不变').toBe(ariaBefore)
    // BDD-7（锁死不吞内容区内嵌组件的 Escape）在 composable 层的等价判据：
    // 锁死短路必须整函数 return，既不 preventDefault 也不 stopPropagation，
    // 否则 document 级监听会改变内嵌组件的 Escape 语义（P2 §3.3）。
    expect(ev.defaultPrevented, 'l5_3 锁死短路不得 preventDefault（BDD-7 前提）').toBe(false)
  })

  // ============================================================
  // BDD-6: 全屏视图不向用户宣告任何退出方式
  // ============================================================
  it('test_bdd_6_locked_aria_announces_no_exit_route', () => {
    const route = makeRouteStub('locked')
    const { zenAriaText } = zenApi(lockedFrom(route))

    const text = String(zenAriaText.value)
    expect(text.length, 'l6_0 锁死态必须有公告文本（现状为空字符串）').toBeGreaterThan(0)
    for (const phrase of EXIT_PHRASES) {
      expect(text.includes(phrase), `l6_1 公告文本不得包含退出提示词组「${phrase}」`).toBe(false)
    }
    expect(text.includes('Escape'), 'l6_2 公告文本不得包含子串 Escape').toBe(false)
    expect(text.includes('exit'), 'l6_3 公告文本不得包含子串 exit').toBe(false)
  })

  // ============================================================
  // BDD-12: 回归 —— 既有 f 键 zen 外观与语义不变
  // ============================================================
  it('test_bdd_12_non_locked_zen_shortcuts_and_announcement_unchanged', async () => {
    const route = makeRouteStub(undefined)
    const { zenMode, zenAriaText, handleZenKeydown } = zenApi(lockedFrom(route))

    // Given 打开 /{slug}（无 f）—— 非锁死态
    expect(zenMode.value, 'l12_1 非锁死态初始 zenMode 应为 false').toBe(false)

    // When 按 f 进入 zen
    const fEv = keydown('f')
    handleZenKeydown(fEv)
    await nextTick()
    expect(zenMode.value, 'l12_2 非锁死态按 f 必须进入 zen（回归不得被锁死污染）').toBe(true)
    // 既有公告语义：必须仍宣告 f 或 Escape 可退出（BDD-6 判据的负向对照）
    expect(String(zenAriaText.value), 'l12_3 非锁死态公告文本仍须宣告 f/Escape 退出')
      .toContain('Escape')
    expect(fEv.defaultPrevented, 'l12_4 非锁死态 f 键仍须 preventDefault（既有行为不变）').toBe(true)

    // When 再按 Escape 退出
    const escEv = keydown('Escape')
    handleZenKeydown(escEv)
    await nextTick()
    expect(zenMode.value, 'l12_5 非锁死态按 Escape 必须退出 zen').toBe(false)
    expect(escEv.defaultPrevented, 'l12_6 非锁死态 Escape 仍须 preventDefault（既有行为不变）').toBe(true)
  })

  // ============================================================
  // 锁死态接口形态（P2 §1.1 最终规格表，支撑 BDD-4/5/6）
  // ============================================================
  it('test_locked_interface_shape_has_no_update_zen_aria', () => {
    const result = zenApi(() => false) as unknown as Record<string, unknown>

    // §1.1 最终规格：返回对象 = { zenMode, zenAriaText, handleZenKeydown }
    expect(Object.prototype.hasOwnProperty.call(result, 'updateZenAria'),
      'l7_1 返回对象必须已移除 updateZenAria（否则 zenAriaText 转 computed 会触发 TS2540）').toBe(false)
    expect(Object.keys(result).sort(), 'l7_2 返回对象键集合应为唯一规格形态')
      .toEqual(['handleZenKeydown', 'zenAriaText', 'zenMode'])
  })

  it('test_locked_default_argument_is_thunk_defaulting_to_false', () => {
    // 签名默认值 `locked: () => boolean = () => false`：
    // ① 省略入参 → 派生 false；② 显式传 thunk → 按 thunk 结果派生（证明入参是被 **调用** 的 thunk）
    expect(zenApi().zenMode.value, 'l8_1 省略 locked 入参时 zenMode 必须为 false（默认 () => false）').toBe(false)
    expect(typeof zenApi().zenMode.value, 'l8_2 zenMode 必须是布尔派生值而非 ref 包装对象').toBe('boolean')
    expect(zenApi(() => true).zenMode.value,
      'l8_3 显式传入恒真 thunk 时 zenMode 必须为 true（入参是 thunk 且被读取，非被忽略）').toBe(true)
  })

  // ============================================================
  // M9: 锁定态派生随 route meta 翻转（禁止变体的唯一可执行拦截）
  //
  // ⚠️ 硬约束 1（P2 eng-review NB-1）：thunk 必须读 **reactive 源**。
  //    非响应式局部变量驱动时 computed 不重算，**正确实现也会返回
  //    [false,false,false] → 误红正确实现**。本用例用 reactive({meta:{}}) 模拟 route.meta。
  // ⚠️ 全程 **不得重新调用 useZenMode()** —— 一旦重调，组件复用场景（P2 §4 V3：
  //    onMounted 仅 1 次、DOM 节点同一）就不再被覆盖，「setup 期一次性快照」的
  //    禁止变体会逃逸（它在该场景下 zenMode 残留 true、f 键永久失效，P2 §2.3 实测）。
  // ============================================================
  it('test_m9_zen_derivation_follows_reactive_route_meta', async () => {
    const route = makeRouteStub(undefined)
    const { zenMode, zenAriaText } = zenApi(lockedFrom(route))

    const snapshot = () => ({ zen: zenMode.value, aria: String(zenAriaText.value) })

    // ① 非锁死路由：false
    const s0 = snapshot()
    expect(s0.zen, 'm9_1 初始（route.meta.zen 非 locked）zenMode 必须为 false').toBe(false)

    // ② 进入锁死路由：true（同一 composable 实例，不重新调用 useZenMode）
    route.meta.zen = 'locked'
    await nextTick()
    const s1 = snapshot()
    expect(s1.zen, 'm9_2 route.meta.zen 变为 locked 后 zenMode 必须翻转 true（computed 随 reactive 源重算）').toBe(true)
    expect(s1.aria, 'm9_3 公告文本必须随锁死态切换').not.toBe(s0.aria)

    // ③ 离开锁死路由：false（无残留 —— 拦截「setup 期一次性快照」禁止变体）
    route.meta.zen = undefined
    await nextTick()
    const s2 = snapshot()
    expect(s2.zen, 'm9_4 离开锁死路由后 zenMode 必须回落 false（不得残留，否则 f 键永久失效）').toBe(false)
    expect(s2.aria, 'm9_5 离开锁死路由后公告文本必须回落至初始态').toBe(s0.aria)

    // 翻转三元组形态（与 P2 §1.1 禁止变体③的判别依据一致）：
    // 正确实现 = [false,true,false]；一次性快照变体 = [false,false,false]
    expect([s0.zen, s1.zen, s2.zen], 'm9_6 派生三元组必须为 [false,true,false]')
      .toEqual([false, true, false])
  })
})
