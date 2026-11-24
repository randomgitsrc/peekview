// TPV0104 移动端底部操作栏三档宽度守护（design M1 / D-3 专用 spec）
//
// 运行：E2E_SPEC=e2e/tpv0104-mobile-bar-widths.spec.ts make debug-test
// 前置：debug backend :8888 在线 + `make debug-seed` 已灌 seed。
//
// 为什么独立成 spec/key（P2-design.md §5 口径说明）：
//   ① 失败含义不同——主 spec 红 = 功能没做对，本 spec 红 = **布局回归 / 最小支持宽度破线**；
//   ② BDD-24 的 Given 只钉 390×844，**360 与 375 属 P1 未覆盖的守护面**；
//   ③ 独立后可在 P5/P6 按需单跑。
//
// 最小支持宽度 = **360px**（`DESIGN.md §9` 只给 Mobile 档上界 <=640px、未给下界；
// 360dp 是 Android Galaxy S 等主流窄档）。三档都必须 `scrollWidth <= clientWidth`。
//
// 实测依据（P2-design.md V14）：`gap: 8px` 下 @360 溢出 10px、@375 恰好用尽、@390 有余量；
// 把生效的 scoped `gap` 由 8px 收到 4px 后 @360 溢出 0（spacer 余 5.39px）。
//
// 环境隔离：[PROD_NOT_TOUCHED] —— 只读 seed entry，不造件。

import { test, expect } from '@playwright/test'

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:8888'
const EVIDENCE_DIR = 'agate-workspace/tasks/TPV0104-viewer-correctness-hardening/evidences'

const MOBILE_BOTTOM_BAR = '[data-testid="mobile-bottom-bar"]'

/** 最坏形态素材：多文件 + wrap 按钮可见（P2-design.md V14 实测的三个复现例） */
const WORST_CASE_ENTRIES = ['k8s-deployment', 'unicode-filenames', 'multi-format-demo']

/** 三档宽度：360 = 最小支持宽度声明，375 = 临界档，390 = BDD-24 的 Given 视口 */
const WIDTHS = [360, 375, 390] as const

const MAX_BAR_HEIGHT = 64

for (const width of WIDTHS) {
  test.describe(`TPV0104 mobile bottom bar @${width}px`, () => {
    test.use({ viewport: { width, height: 844 } })

    for (const slug of WORST_CASE_ENTRIES) {
      test(`test_m1_no_horizontal_overflow_${width}px_${slug}`, async ({ page }) => {
        await page.goto(`${BASE_URL}/${slug}`)
        await page.waitForSelector('[data-testid="content-area"], .empty-state', { timeout: 20000 })
        await page.waitForTimeout(1200)

        const bar = page.locator(MOBILE_BOTTOM_BAR)
        await expect(bar).toHaveCount(1)

        const metrics = await bar.evaluate((el) => {
          const h = el as HTMLElement
          return {
            scrollWidth: h.scrollWidth,
            clientWidth: h.clientWidth,
            height: h.getBoundingClientRect().height,
          }
        })

        // ① 无横向溢出（这是「入口不遮挡 / 不被裁切」的唯一判定式）
        expect(metrics.scrollWidth, `${slug} @${width}px 底栏横向溢出`)
          .toBeLessThanOrEqual(metrics.clientWidth)
        // ② 栏高不因新增入口增高
        expect(metrics.height).toBeLessThanOrEqual(MAX_BAR_HEIGHT)
        // ③ 「更多操作」入口右缘仍落在视口内（被裁的正是它 → 功能损失）
        const overflowRight = await page.evaluate(() => {
          const trigger = document.querySelector('[data-testid="mobile-bottom-bar"] .overflow-menu, [data-testid="mobile-bottom-bar"] button[aria-haspopup]') as HTMLElement | null
          return trigger ? trigger.getBoundingClientRect().right : -1
        })
        if (overflowRight > 0) {
          expect(overflowRight).toBeLessThanOrEqual(width + 1)
        }

        if (width === 390 && slug === 'k8s-deployment') {
          await page.screenshot({ path: `${EVIDENCE_DIR}/mobile_390x844.png` })
        }
      })
    }
  })
}
