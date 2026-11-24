/**
 * TPV0104 — BDD-50 迁移守卫（代码级）+ BDD-45 安全边界文档三要素（文档 grep）
 *
 * BDD-50 Then①：三个 legacy e2e spec 内 `firstFileId` 字面量出现次数 **== 0**。
 *   Then② 是同名失败的回归等价性对照（失败集合不劣于基线），由 P5 按 `known-failures.md`
 *   逐 case 判定 —— 属 e2e 实跑范畴，单测层只能锁死 ①。
 *
 * ⚠️ 不要为 ② 去改 `markdown-test` 的 team 可见性、也不要给 `playwright.config.ts` 加
 * `storageState`：那是范围蔓延（P2-design.md §0.2「不改什么」第 5 条）。
 * 基线（改动前实测）：viewer 18F/20P、t091 12F/12P、tpv0099 6P/0F。
 *
 * BDD-45：落点唯一钉定 `docs/architecture/html-preview-security-modes.md`，
 * 三要素须可逐项 grep 计数非零（两档定义 / 当前默认是「交互式 Demo」/ 仍允许外传）。
 */

import { describe, it, expect } from 'vitest'
import { fileURLToPath } from 'node:url'
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const FRONTEND_DIR = join(HERE, '..', '..')
const E2E_DIR = join(FRONTEND_DIR, 'e2e')
const REPO_ROOT = join(FRONTEND_DIR, '..')

const LEGACY_SPECS = [
  'viewer.spec.ts',
  't091-mobile-detail-visual-polish.spec.ts',
  'tpv0099-fullscreen-link-auth.spec.ts',
]

describe('TPV0104 BDD-50 legacy spec 不再依赖 firstFileId（代码级）', () => {
  it('test_bdd_50_no_first_file_id_literal_in_legacy_specs', () => {
    const offenders: Record<string, number> = {}
    for (const spec of LEGACY_SPECS) {
      const path = join(E2E_DIR, spec)
      expect(existsSync(path), `legacy spec 必须存在：${spec}`).toBe(true)
      const text = readFileSync(path, 'utf-8')
      const hits = (text.match(/firstFileId/g) ?? []).length
      if (hits > 0) offenders[spec] = hits
    }
    expect(offenders).toEqual({})
  })

  it('test_bdd_50_legacy_specs_use_file_query_instead', () => {
    for (const spec of LEGACY_SPECS) {
      const text = readFileSync(join(E2E_DIR, spec), 'utf-8')
      // 迁移是「改名 + 换机制」，不是删掉整段导航
      expect(text).toMatch(/\?file=/)
    }
  })
})

describe('TPV0104 BDD-45 安全边界文档三要素（落点唯一）', () => {
  const DOC = join(REPO_ROOT, 'docs', 'architecture', 'html-preview-security-modes.md')

  it('test_bdd_45_security_modes_doc_exists_at_unique_location', () => {
    expect(existsSync(DOC), `BDD-45 落点钉定为 docs/architecture/html-preview-security-modes.md`).toBe(true)
  })

  it('test_bdd_45_doc_defines_both_modes', () => {
    const text = readFileSync(DOC, 'utf-8')
    expect((text.match(/安全预览/g) ?? []).length).toBeGreaterThan(0)
    expect((text.match(/交互式\s*Demo/g) ?? []).length).toBeGreaterThan(0)
  })

  it('test_bdd_45_doc_declares_current_default_is_interactive_demo', () => {
    const text = readFileSync(DOC, 'utf-8')
    // 当前默认档 = 交互式 Demo（允许脚本与外部网络）
    expect(/当前默认[^\n]*交互式\s*Demo/.test(text) || /交互式\s*Demo[^\n]*当前默认/.test(text)).toBe(true)
  })

  it('test_bdd_45_doc_declares_connect_src_still_allows_https', () => {
    const text = readFileSync(DOC, 'utf-8')
    expect(text).toContain('connect-src')
    expect(/https:/.test(text)).toBe(true)
    expect(/独立决策/.test(text)).toBe(true)
  })
})
