import { computed } from 'vue'
import type { Ref, ComputedRef } from 'vue'
import { useEntryDetailStore } from '@/stores/entryDetail'
import { useToast } from '@/composables/useToast'
import { buildPathMap } from '@/utils/path-map'
import type { PathMap } from '@/utils/path-map'
import { guessMimeType } from '@/utils/mime'
import type { Entry, File, TocHeading } from '@/types'

export function useEntryDetailComputed(
  slug: Ref<string>,
  currentEntry: Ref<Entry | null>,
  activeFile: Ref<File | null>,
) {
  const entryDetailStore = useEntryDetailStore()
  const toast = useToast()

  const isMarkdown: ComputedRef<boolean> = computed(() => activeFile.value?.language === 'markdown')
  const isHtml: ComputedRef<boolean> = computed(() => activeFile.value?.language === 'html')
  const isCsv: ComputedRef<boolean> = computed(() => activeFile.value?.language === 'csv')
  const isTsv: ComputedRef<boolean> = computed(() => activeFile.value?.language === 'tsv')
  const isJson: ComputedRef<boolean> = computed(() => activeFile.value?.language === 'json')
  const isYaml: ComputedRef<boolean> = computed(() => activeFile.value?.language === 'yaml')
  const isXml: ComputedRef<boolean> = computed(() => activeFile.value?.language === 'xml')
  const isRichRenderable: ComputedRef<boolean> = computed(() =>
    isCsv.value || isTsv.value || isJson.value || isYaml.value || isXml.value || isMarkdown.value,
  )
  const isImage: ComputedRef<boolean> = computed(() => {
    const file = activeFile.value
    if (!file) return false
    const mime = guessMimeType(file.filename)
    if (mime === 'image/svg+xml') return true
    return file.isBinary && (mime?.startsWith('image/') ?? false)
  })
  const isBinary: ComputedRef<boolean> = computed(() => activeFile.value?.isBinary ?? false)

  const pathMap: ComputedRef<PathMap | null> = computed(() => {
    if (!currentEntry.value) return null
    return buildPathMap(currentEntry.value.files, currentEntry.value.slug)
  })

  const siblingFileIds: ComputedRef<number[]> = computed(() => {
    if (!currentEntry.value || !activeFile.value) return []
    if (activeFile.value.language !== 'html') return []
    return currentEntry.value.files.filter(f => f.id !== activeFile.value!.id).map(f => f.id)
  })

  const entryTitle: ComputedRef<string> = computed(() => currentEntry.value?.summary || slug.value)

  function extractHeadings(content: string): TocHeading[] {
    const headings: TocHeading[] = []
    const usedIds = new Set<string>()
    for (const line of content.split('\n')) {
      const match = line.match(/^(#{1,6})\s+(.+)$/)
      if (match) {
        const level = match[1].length
        if (level < 2 || level > 4) continue
        const text = match[2].trim()
        let id = text.toLowerCase()
          .replace(/[^\w\s一-龥぀-ゟ゠-ヿ-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/^-+|-+$/g, '')
          .substring(0, 50) || 'heading'
        let uniqueId = id
        let counter = 1
        while (usedIds.has(uniqueId)) { uniqueId = `${id}-${counter}`; counter++ }
        usedIds.add(uniqueId)
        headings.push({ level, text, id: uniqueId })
      }
    }
    return headings
  }

  const tocHeadings: ComputedRef<TocHeading[]> = computed(() => {
    if (!isMarkdown.value || !entryDetailStore.fileContent) return []
    return extractHeadings(entryDetailStore.fileContent)
  })

  function copyContent() {
    if (entryDetailStore.fileContent) {
      navigator.clipboard.writeText(entryDetailStore.fileContent)
    }
  }

  function downloadFile() {
    if (!activeFile.value || !currentEntry.value) return
    const blob = new Blob([entryDetailStore.fileContent], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = activeFile.value.filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  async function downloadPack() {
    if (!currentEntry.value) return
    try {
      const response = await fetch(`/api/v1/entries/${currentEntry.value.slug}/download`)
      if (!response.ok) throw new Error(`Download failed: ${response.status}`)
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${currentEntry.value.slug}.zip`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.show('Pack downloaded', 'success')
    } catch (e) {
      console.error('Pack download error:', e)
      toast.show('Failed to download pack', 'error')
    }
  }

  function scrollToHeading(heading: TocHeading) {
    document.getElementById(heading.id)?.scrollIntoView({ behavior: 'smooth' })
  }

  function handleNavigateFile(fileId: number) {
    const file = currentEntry.value?.files.find(f => f.id === fileId)
    if (file) entryDetailStore.selectFile(file)
  }

  return {
    isMarkdown, isHtml, isCsv, isTsv, isJson, isYaml, isXml, isRichRenderable,
    isImage, isBinary, pathMap, siblingFileIds,
    entryTitle, tocHeadings, extractHeadings,
    copyContent, downloadFile, downloadPack, scrollToHeading, handleNavigateFile,
  }
}
