import { computed, ref, watch } from 'vue'
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
  const isSvg: ComputedRef<boolean> = computed(() => guessMimeType(activeFile.value?.filename ?? '') === 'image/svg+xml')
  const isRichRenderable: ComputedRef<boolean> = computed(() =>
    isCsv.value || isTsv.value || isJson.value || isYaml.value || (isXml.value && !isSvg.value) || isMarkdown.value,
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

  // TOC data has a single source: the `headings` returned by `useMarkdown().render()`
  // (written by the `heading_open` renderer in the same pass that sets body anchor ids).
  // This container only receives that list — there is no second heading scan here.
  const tocHeadings: Ref<TocHeading[]> = ref<TocHeading[]>([])

  function setTocHeadings(list: TocHeading[]): void {
    tocHeadings.value = list
  }

  watch(
    () => activeFile.value?.id ?? null,
    () => {
      tocHeadings.value = []
    },
  )

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
    isMarkdown, isHtml, isCsv, isTsv, isJson, isYaml, isXml, isSvg, isRichRenderable,
    isImage, isBinary, pathMap, siblingFileIds,
    entryTitle, tocHeadings, setTocHeadings,
    copyContent, downloadFile, downloadPack, scrollToHeading, handleNavigateFile,
  }
}
