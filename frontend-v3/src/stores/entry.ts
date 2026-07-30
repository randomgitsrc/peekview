import { useEntryListStore } from './entryList'
import { useEntryDetailStore } from './entryDetail'

export { useEntryListStore } from './entryList'
export { useEntryDetailStore } from './entryDetail'

export function useEntryStore() {
  const listStore = useEntryListStore()
  const detailStore = useEntryDetailStore()
  return {
    entries: listStore.entries,
    loading: listStore.loading,
    error: listStore.error,
    ownerFound: listStore.ownerFound,
    page: listStore.page,
    perPage: listStore.perPage,
    total: listStore.total,
    loadEntries: listStore.loadEntries,
    toggleVisibility: listStore.toggleVisibility,
    deleteEntry: listStore.deleteEntry,
    currentEntry: detailStore.currentEntry,
    activeFile: detailStore.activeFile,
    fileContent: detailStore.fileContent,
    wrapEnabled: detailStore.wrapEnabled,
    isMultiFile: detailStore.isMultiFile,
    canWrap: detailStore.canWrap,
    canCopy: detailStore.canCopy,
    canDownload: detailStore.canDownload,
    canPack: detailStore.canPack,
    loadEntry: detailStore.loadEntry,
    selectFile: detailStore.selectFile,
    toggleWrap: detailStore.toggleWrap,
    clearEntry: detailStore.clearEntry,
  }
}
