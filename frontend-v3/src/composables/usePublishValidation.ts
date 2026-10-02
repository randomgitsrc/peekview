import type { CreateEntryRequestPayload } from '@/api/types'

export interface PublishDraftLike {
  fileId: string
  filename: string
  size: number
  isBinary: boolean
  path: string
  encoded?: string
}

export interface PublishFormInput {
  summary: string
  slug: string
  tags: string[]
  isPublic: boolean
  expiresIn: string
  teamId: string | null
  files: PublishDraftLike[]
}

export interface RawPublishLimits {
  default_expires_in?: string
  max_file_size?: number
  max_entry_files?: number
  max_entry_size?: number
  max_slug_length?: number
  max_summary_length?: number
  defaultExpiresIn?: string
  maxFileSize?: number
  maxEntryFiles?: number
  maxEntrySize?: number
  maxSlugLength?: number
  maxSummaryLength?: number
}

export interface ResolvedLimits {
  defaultExpiresIn?: string
  maxFileSize?: number
  maxEntryFiles?: number
  maxEntrySize?: number
  maxSlugLength?: number
  maxSummaryLength?: number
}

export interface PublishValidationResult {
  ok: boolean
  summaryError: string
  slugError: string
  globalError: string
  fileErrors: Record<string, string>
}

const SLUG_PATTERN = /^[a-z0-9_-]+$/
const MAX_PATH_LENGTH = 500
const MAX_FILENAME_LENGTH = 255

function resolveLimits(limits?: RawPublishLimits | null): ResolvedLimits {
  if (!limits) return {}
  return {
    defaultExpiresIn: limits.defaultExpiresIn ?? limits.default_expires_in,
    maxFileSize: limits.maxFileSize ?? limits.max_file_size,
    maxEntryFiles: limits.maxEntryFiles ?? limits.max_entry_files,
    maxEntrySize: limits.maxEntrySize ?? limits.max_entry_size,
    maxSlugLength: limits.maxSlugLength ?? limits.max_slug_length,
    maxSummaryLength: limits.maxSummaryLength ?? limits.max_summary_length,
  }
}

export function validatePublishForm(input: PublishFormInput, limitsInput?: RawPublishLimits | null): PublishValidationResult {
  const limits = resolveLimits(limitsInput)
  const fileErrors: Record<string, string> = {}
  let summaryError = ''
  let slugError = ''
  let globalError = ''

  const summary = (input.summary ?? '').trim()
  if (!summary) {
    summaryError = 'Summary 为必填项'
  } else if (limits.maxSummaryLength !== undefined && summary.length > limits.maxSummaryLength) {
    summaryError = `Summary 不能超过 ${limits.maxSummaryLength} 个字符`
  }

  const slug = (input.slug ?? '').trim()
  if (slug) {
    if (limits.maxSlugLength !== undefined && slug.length > limits.maxSlugLength) {
      slugError = `Slug 不能超过 ${limits.maxSlugLength} 个字符`
    } else if (!SLUG_PATTERN.test(slug)) {
      slugError = 'Slug 只能包含小写字母、数字、下划线和连字符'
    }
  }

  const files = input.files ?? []
  if (files.length === 0) {
    globalError = '至少选择一个文件'
  } else if (limits.maxEntryFiles !== undefined && files.length > limits.maxEntryFiles) {
    globalError = `文件数最多 ${limits.maxEntryFiles} 个`
  }

  const totalSize = files.reduce((sum, f) => sum + (f.size ?? 0), 0)
  if (!globalError && limits.maxEntrySize !== undefined && totalSize > limits.maxEntrySize) {
    globalError = `文件总大小超过上限（当前总量 ${totalSize} 字节，上限 ${limits.maxEntrySize} 字节）`
  }

  const seenPaths = new Set<string>()
  for (const file of files) {
    const path = (file.path ?? '').trim()
    if (!path) {
      fileErrors[file.fileId] = '相对路径不能为空'
      continue
    }
    if (path.startsWith('/')) {
      fileErrors[file.fileId] = '相对路径不能以 / 开头'
      continue
    }
    if (path.split('/').some(seg => seg === '..')) {
      fileErrors[file.fileId] = '相对路径不能包含 .. 段'
      continue
    }
    if (path.length > MAX_PATH_LENGTH) {
      fileErrors[file.fileId] = `相对路径不能超过 ${MAX_PATH_LENGTH} 个字符`
      continue
    }
    const leaf = path.split('/').pop() ?? ''
    if (leaf.length > MAX_FILENAME_LENGTH) {
      fileErrors[file.fileId] = `文件名不能超过 ${MAX_FILENAME_LENGTH} 个字符`
      continue
    }
    if (seenPaths.has(path)) {
      fileErrors[file.fileId] = '相对路径重复'
      continue
    }
    seenPaths.add(path)
  }

  if (limits.maxFileSize !== undefined) {
    for (const file of files) {
      if (file.size > limits.maxFileSize && !fileErrors[file.fileId]) {
        fileErrors[file.fileId] = `文件 ${file.filename} 超过单文件上限 ${limits.maxFileSize} 字节`
      }
    }
  }

  const ok = !summaryError && !slugError && !globalError && Object.keys(fileErrors).length === 0
  return { ok, summaryError, slugError, globalError, fileErrors }
}

export function buildEntryPayload(
  input: PublishFormInput,
  limitsInput?: RawPublishLimits | null,
  idempotencyKey?: string | null,
): CreateEntryRequestPayload {
  const limits = resolveLimits(limitsInput)
  const summary = (input.summary ?? '').trim()
  const slug = (input.slug ?? '').trim()
  const expiresIn = input.expiresIn || limits.defaultExpiresIn || '15d'

  const payload: CreateEntryRequestPayload = {
    summary,
    is_public: input.isPublic,
    tags: input.tags ?? [],
    expires_in: expiresIn,
    files: (input.files ?? []).map(f => {
      const entry: CreateEntryRequestPayload['files'][number] = {
        filename: f.filename,
        path: (f.path ?? '').trim() || f.filename,
      }
      if (f.isBinary) {
        entry.content_base64 = f.encoded ?? ''
      } else {
        entry.content = f.encoded ?? ''
      }
      return entry
    }),
  }

  if (slug) payload.slug = slug
  if (input.teamId) payload.team_id = input.teamId
  if (idempotencyKey) payload.idempotency_key = idempotencyKey

  return payload
}

export function computePayloadFingerprint(input: PublishFormInput, limitsInput?: RawPublishLimits | null): string {
  const canonical = JSON.stringify(buildEntryPayload(input, limitsInput, null))
  let hash = 0
  for (let i = 0; i < canonical.length; i++) {
    hash = (Math.imul(31, hash) + canonical.charCodeAt(i)) | 0
  }
  return `${canonical.length.toString(16)}:${(hash >>> 0).toString(16)}:${canonical}`
}

export function usePublishValidation() {
  return { validatePublishForm, buildEntryPayload, computePayloadFingerprint }
}
