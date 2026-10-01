// TPV0100 网页发布入口 —— vitest 单元测试（BDD 1:1 映射的第 1 层）
//
// 运行：make test-frontend   （= npx vitest run，非 watch）
// 覆盖：BDD-8, BDD-14, BDD-15, BDD-16, BDD-17, BDD-18, BDD-19,
//       BDD-20, BDD-24, BDD-25, BDD-26, BDD-30
//
// 说明：本文件在实现前编写（TDD）。被测模块 useFileEncoding / usePublishValidation /
//   api.createEntry / api.getLimits / extractApiErrorMessage 尚未实现 → import 失败（B 类红灯）。
//
// ⚠️ vitest mock hoisting 反模式（T079 教训）：vi.mock() 回调只用字符串字面量，
//    不引用外部变量；动态 mock 用 vi.doMock 在 beforeEach 设置。

import { describe, it, expect, vi, beforeEach } from 'vitest'
import axios from 'axios'

// isBinaryContent / readFileAsEncoded 由实现阶段新增的 useFileEncoding 导出
import { isBinaryContent } from '@/composables/useFileEncoding'
// validatePublishForm 由实现阶段新增的 usePublishValidation 导出
import { validatePublishForm } from '@/composables/usePublishValidation'

vi.mock('axios')

const mockAxios = axios as unknown as {
  create: () => {
    get: ReturnType<typeof vi.fn>
    post: ReturnType<typeof vi.fn>
    patch: ReturnType<typeof vi.fn>
    delete: ReturnType<typeof vi.fn>
    interceptors: { response: { use: ReturnType<typeof vi.fn> } }
  }
}

/** 与后端 language.py:is_binary_content 对齐的基准样本（P2 §6.1 实测 8 样本） */
const enc = (s: string): Uint8Array => new TextEncoder().encode(s)

describe('TPV0100 BDD-30: 文本/二进制判定与后端规则一致', () => {
  it('test_bdd_30_binary_detection_matches_backend', () => {
    // Given 一组样本（NUL 字节流 / 合法 UTF-8 / 无 NUL 非法 UTF-8 / 0 字节）
    // Then 判定结果与后端 is_binary_content 逐一致（0 字节判为文本）
    expect(isBinaryContent(new Uint8Array([])), 'BDD-30: 0 字节 → 文本').toBe(false)
    expect(isBinaryContent(enc('hello world\n')), 'BDD-30: ASCII 合法 UTF-8 → 文本').toBe(false)
    expect(isBinaryContent(enc('中文内容 UTF-8\n')), 'BDD-30: CJK 合法 UTF-8 → 文本').toBe(false)
    expect(isBinaryContent(new Uint8Array([0x00, 0x01, 0x02])), 'BDD-30: 含 NUL → 二进制').toBe(true)
    expect(isBinaryContent(new Uint8Array([0xff, 0xfe, 0xfd])), 'BDD-30: 非法 UTF-8（含 NUL 无关）→ 二进制').toBe(true)
    // 无 NUL 的孤立 continuation 字节（0x80）——非法 UTF-8 但无 NUL
    expect(isBinaryContent(new Uint8Array([0x80, 0x80, 0x80])), 'BDD-30: 无 NUL 非法 UTF-8 → 二进制').toBe(true)
    // 截断的多字节序列（0xE4 0xB8 后缺第 3 字节）
    expect(isBinaryContent(new Uint8Array([0xe4, 0xb8])), 'BDD-30: 截断多字节 → 二进制').toBe(true)
  })
})

describe('TPV0100 BDD-8: 无 NUL 但非合法 UTF-8 的文件被判为二进制', () => {
  it('test_bdd_8_non_utf8_without_nul_is_binary', () => {
    // Given 不含 NUL 字节但无法以 UTF-8 严格解码的文件（Latin-1 的 0xE9 = é）
    const latin1Bytes = new Uint8Array([0x68, 0x65, 0x6c, 0x6c, 0x6f, 0x20, 0xe9, 0x0a])
    // When 判定
    const result = isBinaryContent(latin1Bytes)
    // Then is_binary 为 true（未被误判为文本）
    expect(result, 'BDD-8: 无 NUL 非法 UTF-8 须判为二进制').toBe(true)
    // 负向对照：同长度的合法 UTF-8 须为 false（防恒真）
    expect(isBinaryContent(enc('hello é\n')), 'BDD-8 对照: 合法 UTF-8 须判为文本').toBe(false)
  })
})

// ---------------------------------------------------------------------------
// 表单预校验（BDD-14 ~ BDD-19）
// ---------------------------------------------------------------------------

/** 构造 limits（取自 GET /api/v1/config/limits 的 6 字段） */
function makeLimits(over: Record<string, unknown> = {}) {
  return {
    default_expires_in: '15d',
    max_file_size: 20 * 1024 * 1024,
    max_entry_files: 50,
    max_entry_size: 100 * 1024 * 1024,
    max_slug_length: 64,
    max_summary_length: 500,
    ...over,
  }
}

/** 构造一个文件草稿 */
function makeFile(over: Record<string, unknown> = {}) {
  return {
    fileId: 'fid-1',
    filename: 'a.txt',
    size: 10,
    isBinary: false,
    path: 'a.txt',
    ...over,
  }
}

/** 构造表单输入 */
function makeInput(over: Record<string, unknown> = {}) {
  return {
    summary: 'test summary',
    slug: '',
    tags: [],
    isPublic: true,
    expiresIn: '15d',
    teamId: null,
    files: [makeFile()],
    ...over,
  }
}

describe('TPV0100 BDD-14: 空 summary 阻止提交', () => {
  it('test_bdd_14_empty_summary_blocks_submit', () => {
    // Given 已选 ≥1 个文件但 summary 为空
    const r = validatePublishForm(makeInput({ summary: '   ' }), makeLimits() as never)
    // Then ok=false 且就地对 summary 给出必填提示
    expect(r.ok, 'BDD-14: 空 summary 须校验失败').toBe(false)
    expect(r.summaryError, 'BDD-14: 须给出 summary 必填提示').toBeTruthy()
    expect(String(r.summaryError)).toMatch(/summary|必填|不能为空|required/i)
    // 负向对照：合法 summary 须通过
    expect(validatePublishForm(makeInput(), makeLimits() as never).ok, 'BDD-14 对照: 合法 summary 须通过').toBe(true)
  })
})

describe('TPV0100 BDD-15: 无文件阻止提交', () => {
  it('test_bdd_15_no_files_blocks_submit', () => {
    // Given summary 已填写但未选择任何文件
    const r = validatePublishForm(makeInput({ files: [] }), makeLimits() as never)
    // Then ok=false 且提示"至少选择一个文件"
    expect(r.ok, 'BDD-15: 无文件须校验失败').toBe(false)
    expect(r.globalError, 'BDD-15: 须给出"至少选择一个文件"提示').toBeTruthy()
    expect(String(r.globalError)).toMatch(/至少|文件|file/i)
  })
})

describe('TPV0100 BDD-16: 超出限额（文件数 / 单文件 / 总量）阻止提交并指出对象', () => {
  it('test_bdd_16_over_limits_blocks_submit_with_object', () => {
    const limits = makeLimits({ max_entry_files: 2, max_file_size: 100, max_entry_size: 150 })

    // 分支①：文件数 > max_entry_files
    const tooMany = validatePublishForm(
      makeInput({ files: [makeFile({ fileId: 'a', path: 'a' }), makeFile({ fileId: 'b', path: 'b' }), makeFile({ fileId: 'c', path: 'c' })] }),
      limits as never,
    )
    expect(tooMany.ok, 'BDD-16①: 文件数超限须失败').toBe(false)
    expect(String(tooMany.globalError)).toMatch(/2|文件数|数量|个数|最多/i)

    // 分支②：单文件 > max_file_size（提示须指出文件名）
    const tooBig = validatePublishForm(
      makeInput({ files: [makeFile({ filename: 'big.bin', path: 'big.bin', size: 101 })] }),
      limits as never,
    )
    expect(tooBig.ok, 'BDD-16②: 单文件超限须失败').toBe(false)
    expect(`${tooBig.globalError ?? ''}${JSON.stringify(tooBig.fileErrors ?? {})}`,
      'BDD-16②: 提示须指出超限文件名').toMatch(/big\.bin/)

    // 分支③：总大小 > max_entry_size（提示须含当前总量）
    const tooMuch = validatePublishForm(
      makeInput({ files: [makeFile({ fileId: 'x', path: 'x', size: 80 }), makeFile({ fileId: 'y', path: 'y', size: 80 })] }),
      limits as never,
    )
    expect(tooMuch.ok, 'BDD-16③: 总量超限须失败').toBe(false)
    expect(String(tooMuch.globalError), 'BDD-16③: 提示须含当前总量').toMatch(/160|总量|总大小|合计/i)
  })
})

describe('TPV0100 BDD-17: 非法相对路径阻止提交', () => {
  it('test_bdd_17_invalid_path_blocks_submit', () => {
    // 分支①：空路径
    const empty = validatePublishForm(
      makeInput({ files: [makeFile({ fileId: 'e1', path: '   ' })] }),
      makeLimits() as never,
    )
    expect(empty.ok, 'BDD-17①: 空路径须失败').toBe(false)
    expect(empty.fileErrors?.['e1'], 'BDD-17①: 对应行须被标记').toBeTruthy()

    // 分支②：以 / 开头
    const abs = validatePublishForm(
      makeInput({ files: [makeFile({ fileId: 'e2', path: '/etc/passwd' })] }),
      makeLimits() as never,
    )
    expect(abs.ok, 'BDD-17②: 以 / 开头须失败').toBe(false)
    expect(abs.fileErrors?.['e2'], 'BDD-17②: 对应行须被标记').toBeTruthy()

    // 分支③：含 .. 段
    const dotdot = validatePublishForm(
      makeInput({ files: [makeFile({ fileId: 'e3', path: '../secret.txt' })] }),
      makeLimits() as never,
    )
    expect(dotdot.ok, 'BDD-17③: 含 .. 须失败').toBe(false)
    expect(dotdot.fileErrors?.['e3'], 'BDD-17③: 对应行须被标记').toBeTruthy()
  })
})

describe('TPV0100 BDD-18: 重复相对路径阻止提交', () => {
  it('test_bdd_18_duplicate_path_blocks_submit', () => {
    // Given 两个文件的相对路径完全相同
    const r = validatePublishForm(
      makeInput({
        files: [
          makeFile({ fileId: 'd1', filename: 'a.txt', path: 'same/a.txt' }),
          makeFile({ fileId: 'd2', filename: 'b.txt', path: 'same/a.txt' }),
        ],
      }),
      makeLimits() as never,
    )
    // Then ok=false 且对应行被标记
    expect(r.ok, 'BDD-18: 重复路径须校验失败').toBe(false)
    const marked = Boolean(r.fileErrors?.['d1']) || Boolean(r.fileErrors?.['d2'])
    expect(marked, 'BDD-18: 至少一个重复行须被标记').toBe(true)
    // 负向对照：路径不同须通过
    expect(validatePublishForm(
      makeInput({ files: [makeFile({ fileId: 'n1', path: 'a/1.txt' }), makeFile({ fileId: 'n2', path: 'b/2.txt' })] }),
      makeLimits() as never,
    ).ok, 'BDD-18 对照: 路径不同须通过').toBe(true)
  })
})

describe('TPV0100 BDD-19: 自定义 slug 非法或超长时阻止提交', () => {
  it('test_bdd_19_invalid_or_too_long_slug_blocks_submit', () => {
    // 分支①：超过 64 字符
    const tooLong = validatePublishForm(makeInput({ slug: 'a'.repeat(65) }), makeLimits() as never)
    expect(tooLong.ok, 'BDD-19①: slug 超长须失败').toBe(false)
    expect(tooLong.slugError, 'BDD-19①: 须就地提示 slug 非法').toBeTruthy()

    // 分支②：含空格
    const withSpace = validatePublishForm(makeInput({ slug: 'my slug' }), makeLimits() as never)
    expect(withSpace.ok, 'BDD-19②: 含空格须失败').toBe(false)
    expect(withSpace.slugError, 'BDD-19②: 须就地提示').toBeTruthy()

    // 分支③：含 /
    const withSlash = validatePublishForm(makeInput({ slug: 'a/b' }), makeLimits() as never)
    expect(withSlash.ok, 'BDD-19③: 含 / 须失败').toBe(false)
    expect(withSlash.slugError, 'BDD-19③: 须就地提示').toBeTruthy()

    // 负向对照：合法 slug 须通过
    expect(validatePublishForm(makeInput({ slug: 'my_slug-01' }), makeLimits() as never).ok,
      'BDD-19 对照: 合法 slug 须通过').toBe(true)
    // 空 slug 合法（走后端生成）
    expect(validatePublishForm(makeInput({ slug: '' }), makeLimits() as never).ok,
      'BDD-19 对照: 空 slug 须通过（后端生成）').toBe(true)
  })
})

// ---------------------------------------------------------------------------
// 默认值 / 幂等键 / API 错误提取（BDD-20, BDD-24, BDD-25, BDD-26）
// ---------------------------------------------------------------------------

describe('TPV0100 BDD-20: 默认公开且过期时间默认取 default_expires_in', () => {
  it('test_bdd_20_default_public_and_default_expiry', async () => {
    // Given 未改动可见性与过期时间 → 表单构造的载荷须 is_public=true + expires_in=limits.default_expires_in
    const { buildEntryPayload } = await import('@/composables/usePublishValidation') as never as {
      buildEntryPayload: (input: never, limits: never, key: string | null) => Record<string, unknown>
    }
    const payload = buildEntryPayload(makeInput() as never, makeLimits() as never, 'k1')
    expect(payload.is_public, 'BDD-20: 默认须公开').toBe(true)
    expect(payload.expires_in, 'BDD-20: 过期默认取 default_expires_in').toBe('15d')
  })
})

describe('TPV0100 BDD-24: 载荷变更后重试视为新意图', () => {
  it('test_bdd_24_payload_change_resets_idempotency_key', async () => {
    const { computePayloadFingerprint } = await import('@/composables/usePublishValidation') as never as {
      computePayloadFingerprint: (input: never, limits: never) => string
    }
    const limits = makeLimits()
    const base = computePayloadFingerprint(makeInput() as never, limits as never)
    const same = computePayloadFingerprint(makeInput() as never, limits as never)
    const changed = computePayloadFingerprint(makeInput({ summary: 'another summary' }) as never, limits as never)

    // 同载荷 → 同指纹（复用幂等键）
    expect(same, 'BDD-24: 相同载荷指纹须一致').toBe(base)
    // 载荷变更 → 指纹变化（换幂等键 = 新意图）
    expect(changed, 'BDD-24: summary 变更须改变指纹').not.toBe(base)
    // 文件集合变更 → 指纹变化
    expect(computePayloadFingerprint(makeInput({ files: [] }) as never, limits as never),
      'BDD-24: 文件集合变更须改变指纹').not.toBe(base)
  })
})

describe('TPV0100 BDD-25: 限流（429）有明确提示', () => {
  it('test_bdd_25_rate_limit_error_is_readable', async () => {
    const { extractApiErrorMessage } = await import('@/api/client') as never as {
      extractApiErrorMessage: (err: unknown) => string
    }
    // Given 创建请求返回 429（body {"error":{"code":"RATE_LIMITED","message":...}}）
    const msg = extractApiErrorMessage({
      response: { status: 429, data: { error: { code: 'RATE_LIMITED', message: 'Too many requests' } } },
      message: 'Request failed with status code 429',
    })
    // Then 页面可获得非空可读提示
    expect(msg, 'BDD-25: 429 须有非空提示').toBeTruthy()
    expect(msg).toMatch(/频繁|限流|稍后|429|Too many/i)
  })
})

describe('TPV0100 BDD-26: 后端校验错误（400/422）有明确提示', () => {
  it('test_bdd_26_backend_validation_error_readable', async () => {
    const { extractApiErrorMessage } = await import('@/api/client') as never as {
      extractApiErrorMessage: (err: unknown) => string
    }
    // 路径①：400 —— body {"error":{"code":"INVALID_SLUG","message":"Slug must match ..."}}
    const e400 = extractApiErrorMessage({
      response: { status: 400, data: { error: { code: 'INVALID_SLUG', message: 'Slug must match ^[a-z0-9_-]+$' } } },
      message: 'Request failed with status code 400',
    })
    expect(e400, 'BDD-26: 400 须显示 error.message 原文').toContain('Slug must match')

    // 路径②：422 —— FastAPI 默认 {"detail":[{loc,msg,type},...]}（数组）
    const e422 = extractApiErrorMessage({
      response: { status: 422, data: { detail: [{ loc: ['body', 'summary'], msg: 'String should have at most 500 characters', type: 'string_too_long' }] } },
      message: 'Request failed with status code 422',
    })
    expect(e422, 'BDD-26: 422 须显示 detail[].msg 原文').toContain('String should have at most 500 characters')
    expect(e422, 'BDD-26: 禁止渲染 [object Object]').not.toContain('[object Object]')
  })
})

// ---------------------------------------------------------------------------
// API 层契约（createEntry / getLimits）—— 作为 BDD-20/21 的载荷契约单元层支撑
// ---------------------------------------------------------------------------

describe('TPV0100 API 层: createEntry 请求体契约与 getLimits', () => {
  let mockPost: ReturnType<typeof vi.fn>
  let mockGet: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.resetModules()
    mockPost = vi.fn()
    mockGet = vi.fn()
    const mockClient = {
      get: mockGet,
      post: mockPost,
      patch: vi.fn(),
      delete: vi.fn(),
      interceptors: { response: { use: vi.fn() } },
    }
    mockAxios.create = vi.fn(() => mockClient)
    vi.clearAllMocks()
  })

  it('createEntry posts to /entries with payload and returns transformed result', async () => {
    mockPost.mockResolvedValue({
      data: {
        id: 42,
        slug: 'my-entry',
        url: 'https://peek.gsis.top/my-entry',
        is_public: true,
        owner_id: 7,
        expires_at: '2026-10-16T00:00:00Z',
        created_at: '2026-10-01T00:00:00Z',
        files: [
          { id: 1, path: 'a.md', filename: 'a.md', language: 'markdown', is_binary: false, size: 3, line_count: 1 },
        ],
      },
    })
    const { api } = await import('@/api/client')
    const payload = { summary: 's', files: [{ filename: 'a.md', content: 'hi' }], idempotency_key: 'k1' }
    const result = await api.createEntry(payload as never)
    expect(mockPost).toHaveBeenCalledWith('/entries', payload)
    expect(result.slug).toBe('my-entry')
    expect(result.isPublic).toBe(true)
  })

  it('getLimits reads GET /config/limits', async () => {
    mockGet.mockResolvedValue({
      data: {
        default_expires_in: '15d',
        max_file_size: 20971520,
        max_entry_files: 50,
        max_entry_size: 104857600,
        max_slug_length: 64,
        max_summary_length: 500,
      },
    })
    const { api } = await import('@/api/client')
    const limits = await api.getLimits()
    expect(mockGet).toHaveBeenCalledWith('/config/limits')
    expect(limits.defaultExpiresIn).toBe('15d')
    expect(limits.maxEntryFiles).toBe(50)
  })
})
