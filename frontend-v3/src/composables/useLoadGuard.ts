/**
 * TPV0104 补充修复 B — 异步请求竞态守卫 + Entry 加载编排
 *
 * 1) 竞态守卫：A 的加载未返回时用户已导航到 B，A 的慢响应回来不得覆盖 B；
 *    快速连续切 file 时，早期内容请求不得覆盖最新选择。
 *    方案为单调递增序号（最小方案，不引入状态管理框架）。
 *
 * 2) 加载编排：把「取 entry + 解析目标文件 + 取内容」的流程从 store 内联代码里抽出来，
 *    是为了守住 t082 的既有行数契约（`entryDetail.ts < 150` 行）——不放宽契约。
 */
import { resolveDefaultFile } from '@/utils/default-file'
import type { Entry, File } from '@/types'

export interface LoadGuard {
  /** 取一个新序号，并使先前所有在途请求失效 */
  next(): number
  /** 给定序号是否仍是最新（false 表示应丢弃该响应） */
  isCurrent(seq: number): boolean
}

export function createLoadGuard(): LoadGuard {
  let current = 0
  return {
    next() {
      current += 1
      return current
    },
    isCurrent(seq: number) {
      return seq === current
    },
  }
}

export interface LoadResult {
  entry: Entry
  targetFile: File | null
  /** 预取内容；null 表示应另行获取（二进制，或预取的是别的文件） */
  content: string | null
  /** 当 content 为 null 时，需要对 targetFile 单独取内容 */
  needFetchTarget: boolean
}

/**
 * 计算一次加载的最终形态：给定 entry 与路由指定的 fileId，
 * 返回应选中的文件（含无效/缺失时回退默认入口）与内容获取策略。
 *
 * 纯函数（无副作用），便于单测与复用。
 */
export function resolveLoadTarget(entry: Entry, fileId: number | undefined, prefetched: string | null): LoadResult {
  if (entry.files.length === 0) {
    return { entry, targetFile: null, content: null, needFetchTarget: false }
  }
  const targetFile = (fileId != null ? entry.files.find(f => f.id === fileId) : null)
    ?? resolveDefaultFile(entry.files)
  if (!targetFile) {
    return { entry, targetFile: null, content: null, needFetchTarget: false }
  }
  // 只有预取的内容确实属于目标文件时才复用，否则需要重新取
  const reused = prefetched != null && targetFile.id === fileId
  if (reused) return { entry, targetFile, content: prefetched, needFetchTarget: false }
  if (targetFile.isBinary) return { entry, targetFile, content: null, needFetchTarget: false }
  return { entry, targetFile, content: null, needFetchTarget: true }
}
