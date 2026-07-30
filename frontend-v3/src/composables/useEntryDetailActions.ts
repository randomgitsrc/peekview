import { ref, computed } from 'vue'
import type { Ref, ComputedRef } from 'vue'
import { useEntryDetailStore } from '@/stores/entryDetail'
import { useEntryListStore } from '@/stores/entryList'
import { useAuthStore } from '@/stores/auth'
import { useThemeStore } from '@/stores/theme'
import { useToast } from '@/composables/useToast'
import type { OverflowMenuItem } from '@/components/OverflowMenu.vue'
import type { Entry } from '@/types'

export function useEntryDetailActions(
  currentEntry: Ref<Entry | null>,
  activeFile: Ref<{ id: number; filename: string } | null>,
  onDownloadFile: () => void,
  onDownloadPack: () => void,
) {
  const entryDetailStore = useEntryDetailStore()
  const entryListStore = useEntryListStore()
  const authStore = useAuthStore()
  const themeStore = useThemeStore()
  const toast = useToast()

  const showConfirmDelete = ref(false)
  const showExpiresInDialog = ref(false)

  const deleteMessage: ComputedRef<string> = computed(() =>
    currentEntry.value ? `Are you sure you want to delete "${currentEntry.value.summary}"?` : ''
  )

  function confirmDeleteEntry() {
    showConfirmDelete.value = true
  }

  async function handleDelete(router: { push: (path: string) => void }) {
    if (!currentEntry.value) return
    const success = await entryListStore.deleteEntry(currentEntry.value.slug)
    if (success) {
      toast.show('Entry deleted', 'success')
      router.push('/explore')
    } else {
      toast.show('Failed to delete entry', 'error')
    }
  }

  function cancelDelete() {}

  async function handleToggleVisibility() {
    if (!currentEntry.value) return
    const wasPublic = currentEntry.value.isPublic
    const success = await entryListStore.toggleVisibility(currentEntry.value)
    if (success) {
      if (wasPublic) toast.show('Entry made private', 'success')
    } else {
      toast.show('Failed to change visibility', 'error')
    }
  }

  async function handleExpiresInUpdated(slug: string) {
    await entryDetailStore.loadEntry(slug)
    toast.show('Entry updated', 'success')
  }

  const overflowItems: ComputedRef<OverflowMenuItem[]> = computed(() => {
    const items: OverflowMenuItem[] = []
    items.push({
      label: themeStore.theme === 'dark' ? 'Light theme' : 'Dark theme',
      icon: themeStore.theme === 'dark' ? 'sun' : 'moon',
      hint: 'Tap to toggle',
      divider: false,
      action: () => themeStore.toggle(),
    })
    if (currentEntry.value && authStore.isOwner(currentEntry.value.ownerId)) {
      items.push({
        label: currentEntry.value.isPublic ? 'Make Private' : 'Make Public',
        icon: currentEntry.value.isPublic ? 'lock' : 'globe',
        hint: currentEntry.value.isPublic ? 'Currently Public' : 'Currently Private',
        divider: true,
        action: handleToggleVisibility,
      })
    }
    if (entryDetailStore.canDownload) {
      items.push({
        label: 'Download',
        icon: 'download',
        hint: activeFile.value?.filename ?? '',
        divider: !!(currentEntry.value && authStore.isOwner(currentEntry.value.ownerId)),
        action: onDownloadFile,
      })
    }
    if (currentEntry.value) {
      items.push({
        label: 'Raw',
        icon: 'file-text',
        hint: 'Structured JSON',
        href: `/api/v1/entries/${currentEntry.value.slug}/raw`,
        target: '_blank',
        rel: 'noopener noreferrer',
      })
    }
    if (entryDetailStore.canPack && currentEntry.value) {
      items.push({
        label: 'Download as Pack',
        icon: 'package',
        hint: `${currentEntry.value.files.length} files`,
        action: onDownloadPack,
      })
    }
    if (currentEntry.value && authStore.isOwner(currentEntry.value.ownerId)) {
      items.push({
        label: 'Delete entry',
        icon: 'trash-2',
        hint: 'Permanently',
        variant: 'danger',
        divider: true,
        action: confirmDeleteEntry,
      })
    }
    return items
  })

  return {
    showConfirmDelete,
    showExpiresInDialog,
    deleteMessage,
    confirmDeleteEntry,
    handleDelete,
    cancelDelete,
    handleToggleVisibility,
    handleExpiresInUpdated,
    overflowItems,
  }
}
