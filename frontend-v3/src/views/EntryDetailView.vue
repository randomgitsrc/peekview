<template>
  <div class="entry-detail" :class="{ 'zen-mode': zenMode }">
    <span class="sr-only" aria-live="polite">{{ zenAriaText }}</span>

    <EntryDetailHeader
      :entry-title="entryTitle"
      :relative-time="relativeTime"
      :full-time="fullTime"
      :is-expired-but-active="isExpiredButActive"
      :meta-tags-hidden="metaTagsHidden"
      :is-file-tree-open="isFileTreeOpen"
      :is-toc-open="isTocOpen"
      :is-markdown="isMarkdown"
      :toc-headings="tocHeadings"
      :is-multi-file="entryDetailStore.isMultiFile"
      :can-copy="entryDetailStore.canCopy"
      :show-share-button="showShareButton"
      :share-dialog-open="shareDialogOpen"
      :active-share-count="activeShareCount"
      :overflow-items="overflowItems"
      :auth-state="authState"
      :current-entry="currentEntry"
      :slug="slug"
      :source-view-mode="sourceViewMode"
      :is-rich-renderable="isRichRenderable"
      @toggle-file-tree="isFileTreeOpen = !isFileTreeOpen"
      @toggle-toc="isTocOpen = !isTocOpen"
      @toggle-source-view="sourceViewMode = !sourceViewMode"
      @copy-content="copyContent"
      @toggle-share-dialog="shareDialogOpen = $event"
      @open-login="showLogin = true"
    />

    <EntryDetailBanners
      :is-expired-but-active="isExpiredButActive"
      :is-archived="currentEntry?.status === 'archived'"
      :is-owner="authStore.isOwner(currentEntry?.ownerId ?? null)"
      @show-expires-in-dialog="actions.showExpiresInDialog.value = true"
    />

    <EntryDetailContent
      :is-file-tree-open="isFileTreeOpen"
      :is-toc-open="isTocOpen"
      :show-file-drawer="showFileDrawer"
      :show-toc-drawer="showTocDrawer"
      :current-entry="currentEntry"
      :active-file="activeFile"
      :file-content="fileContent"
      :file-loading="entryDetailStore.loading"
      :file-error="entryDetailStore.error"
      :share-error-state="shareErrorState"
      :slug="slug"
      :is-markdown="isMarkdown"
      :is-html="isHtml"
      :is-csv="isCsv"
      :is-tsv="isTsv"
      :is-json="isJson"
      :is-yaml="isYaml"
      :is-xml="isXml"
      :is-image="isImage"
      :is-binary="isBinary"
      :path-map="pathMap"
      :toc-headings="tocHeadings"
      :sibling-file-ids="siblingFileIds"
      :wrap-enabled="entryDetailStore.wrapEnabled"
      :can-wrap="entryDetailStore.canWrap"
      :is-multi-file="entryDetailStore.isMultiFile"
      :source-view-mode="sourceViewMode"
      :download-file="downloadFile"
      @select-file="entryDetailStore.selectFile"
      @navigate-file="handleNavigateFile"
      @scroll-to-heading="scrollToHeading"
      @toggle-wrap="entryDetailStore.toggleWrap()"
      @close-file-drawer="showFileDrawer = false"
      @close-toc-drawer="showTocDrawer = false"
    />

    <EntryDetailMobileBar
      :is-multi-file="entryDetailStore.isMultiFile"
      :is-markdown="isMarkdown"
      :toc-headings="tocHeadings"
      :is-binary="isBinary"
      :can-wrap="entryDetailStore.canWrap"
      :can-copy="entryDetailStore.canCopy"
      :wrap-enabled="entryDetailStore.wrapEnabled"
      :show-file-drawer="showFileDrawer"
      :show-toc-drawer="showTocDrawer"
      :overflow-items="overflowItems"
      :current-entry="currentEntry"
      :source-view-mode="sourceViewMode"
      :is-rich-renderable="isRichRenderable"
      @toggle-file-drawer="showFileDrawer = !showFileDrawer"
      @toggle-toc-drawer="showTocDrawer = !showTocDrawer"
      @toggle-source-view="sourceViewMode = !sourceViewMode"
      @toggle-wrap="entryDetailStore.toggleWrap()"
      @copy-content="copyContent"
    />

    <EntryDetailDialogs
      :show-confirm-delete="actions.showConfirmDelete.value"
      :delete-message="deleteMessage"
      :show-expires-in-dialog="actions.showExpiresInDialog.value"
      :show-login="showLogin"
      :is-share-access="isShareAccess"
      :slug="slug"
      :is-archived="currentEntry?.status === 'archived'"
      :shared-by="currentEntry?.shareContext?.sharedBy ?? null"
      @update:show-confirm-delete="actions.showConfirmDelete.value = $event"
      @confirm-delete="actions.handleDelete(router)"
      @cancel-delete="actions.cancelDelete()"
      @update:show-expires-in-dialog="actions.showExpiresInDialog.value = $event"
      @expires-in-updated="actions.handleExpiresInUpdated(slug)"
      @update:show-login="showLogin = $event"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick, provide, toRef } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useEntryDetailStore } from '@/stores/entryDetail'
import { useAuthStore } from '@/stores/auth'
import { useShareStore } from '@/stores/share'
import { isExpired } from '@/utils/expires'
import { useRelativeTime } from '@/composables/useRelativeTime'
import { useZenMode } from '@/composables/useZenMode'
import { useResponsiveLayout } from '@/composables/useResponsiveLayout'
import { useEntryDetailComputed } from '@/composables/useEntryDetailComputed'
import { useEntryDetailActions } from '@/composables/useEntryDetailActions'
import { ZenModeKey, IsMobileKey, ZenAriaTextKey } from '@/composables/entryDetailKeys'
import EntryDetailHeader from '@/components/EntryDetailHeader.vue'
import EntryDetailBanners from '@/components/EntryDetailBanners.vue'
import EntryDetailContent from '@/components/EntryDetailContent.vue'
import EntryDetailMobileBar from '@/components/EntryDetailMobileBar.vue'
import EntryDetailDialogs from '@/components/EntryDetailDialogs.vue'
import type { ShareInfo } from '@/types'

const props = defineProps<{ slug: string }>()
const slug = toRef(props, 'slug')

const router = useRouter()
const route = useRoute()
const entryDetailStore = useEntryDetailStore()
const authStore = useAuthStore()
const shareStore = useShareStore()
const { currentEntry, activeFile, fileContent } = storeToRefs(entryDetailStore)
const { authState } = storeToRefs(authStore)

const { zenMode, zenAriaText, handleZenKeydown } = useZenMode()
const { isMobile, isDesktop, metaTagsHidden, handleResize, setupScrollHide } = useResponsiveLayout()

provide(ZenModeKey, zenMode)
provide(IsMobileKey, isMobile)
provide(ZenAriaTextKey, zenAriaText)

const {
  isMarkdown, isHtml, isCsv, isTsv, isJson, isYaml, isXml, isRichRenderable,
  isImage, isBinary, pathMap, siblingFileIds,
  entryTitle, tocHeadings, copyContent, downloadFile, downloadPack,
  scrollToHeading, handleNavigateFile,
} = useEntryDetailComputed(slug, currentEntry, activeFile)

const actions = useEntryDetailActions(currentEntry, activeFile, downloadFile, downloadPack)
const { deleteMessage, overflowItems } = actions

const showLogin = ref(false)
const showFileDrawer = ref(false)
const showTocDrawer = ref(false)
const shareDialogOpen = ref(false)
const shareErrorState = ref(false)
const isFileTreeOpen = ref(false)
const isTocOpen = ref(false)
const sourceViewMode = ref(false)

watch(() => entryDetailStore.activeFile?.id, () => {
  sourceViewMode.value = false
})

function isShareExpired(share: ShareInfo): boolean {
  return share.expiresAt ? new Date(share.expiresAt) <= new Date() : false
}

const activeShareCount = computed(() =>
  shareStore.shares.filter(s => s.revokedAt === null && !isShareExpired(s)).length
)
const isShareAccess = computed(() => {
  if (!currentEntry.value || authStore.isOwner(currentEntry.value.ownerId)) return false
  return currentEntry.value.shareContext?.isShareAccess === true
})
const showShareButton = computed(() => {
  if (!currentEntry.value || !authStore.isOwner(currentEntry.value.ownerId)) return false
  if (currentEntry.value.status === 'archived') return false
  return !currentEntry.value.isPublic
})
const isExpiredButActive = computed(() => currentEntry.value ? isExpired(currentEntry.value) : false)
const createdAtRef = computed(() => currentEntry.value?.createdAt ?? null)
const { relative: relativeTime, full: fullTime } = useRelativeTime(createdAtRef)

onMounted(async () => {
  const shareToken = route.query.share as string | undefined
  const firstFileId = route.query.firstFileId ? Number(route.query.firstFileId) : undefined
  shareErrorState.value = false
  await entryDetailStore.loadEntry(props.slug, firstFileId, shareToken)
  if (shareToken && !currentEntry.value && entryDetailStore.error) shareErrorState.value = true
  if (firstFileId || shareToken) router.replace({ path: route.path, query: {} })
  document.addEventListener('keydown', handleZenKeydown)
  window.addEventListener('resize', handleResize)
  await nextTick()
  if (isDesktop.value) {
    if (entryDetailStore.isMultiFile) isFileTreeOpen.value = true
    if (isMarkdown.value && tocHeadings.value.length > 0) isTocOpen.value = true
  }
  const content = document.querySelector('.content-area')
  if (content) onUnmounted(setupScrollHide(content as HTMLElement))
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleZenKeydown)
  window.removeEventListener('resize', handleResize)
})

watch(() => props.slug, async (newSlug) => {
  isFileTreeOpen.value = false
  isTocOpen.value = false
  await entryDetailStore.loadEntry(newSlug)
})
watch(() => showShareButton.value, (show) => {
  if (show && props.slug) shareStore.fetchShares(props.slug)
}, { immediate: true })
watch(() => entryDetailStore.currentEntry, (entry) => {
  document.querySelectorAll('link[data-peekview-raw]').forEach(el => el.remove())
  if (entry) {
    const link = document.createElement('link')
    link.rel = 'alternate'
    link.type = 'application/json'
    link.href = `/api/v1/entries/${entry.slug}/raw`
    link.setAttribute('data-peekview-raw', '1')
    document.head.appendChild(link)
  }
  if (isDesktop.value) {
    if (entryDetailStore.isMultiFile) isFileTreeOpen.value = true
    if (isMarkdown.value && tocHeadings.value.length > 0) isTocOpen.value = true
  }
}, { immediate: true })
</script>

<style scoped>
.entry-detail { display: flex; flex-direction: column; min-height: 100vh; background: var(--c-bg); }
.entry-detail.zen-mode :deep(.detail-header),
.entry-detail.zen-mode :deep(.mobile-sticky-header),
.entry-detail.zen-mode :deep(.mobile-bottom-bar),
.entry-detail.zen-mode :deep(.meta-tags-bar) { display: none; }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border-width: 0; }
</style>
