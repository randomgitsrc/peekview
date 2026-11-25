/**
 * 文件字节数单点（P2-design.md D-3 / BDD-42/43/44）。
 *
 * `file.size` 是后端回报的**真实字节数**（`client.ts` 的 `transformFile` 已映射），
 * 而 `content.length` 是 **UTF-16 码元数**——中文等非 ASCII 内容下后者显著小于前者
 * （实测 700084 chars / 2100088 bytes），据此判断大文件阈值会漏挡。
 *
 * 优先用真实字节；`size` 缺失/非法（非有限非负数）时回退 `content.length`，
 * 保留无 `size` 来源（如单测直接传 `content`）的既有语义。
 */
export function resolveFileSize(
  fileLike: { size?: number | null } | null | undefined,
  content: string,
): number {
  const size = fileLike?.size
  if (typeof size === 'number' && Number.isFinite(size) && size >= 0) return size
  return content.length
}
