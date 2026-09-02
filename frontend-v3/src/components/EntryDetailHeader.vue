<template>
  <!-- Mobile sticky header -->
  <div v-if="isMobile" v-show="!zenMode" class="mobile-sticky-header">
    <router-link to="/" class="mobile-logo-link" aria-label="Back to home">
      <svg width="24" height="24" viewBox="0 0 32 32" fill="none"><rect x="2" y="2" width="28" height="28" rx="8" fill="var(--c-accent)"/><path d="M12 23.5V9.5h5.4a4.6 4.6 0 0 1 0 9.2H12" stroke="var(--text-on-accent)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </router-link>
    <span class="sticky-title two-line">{{ entryTitle }}</span>
    <AuthButton v-if="authState === 'anonymous'" page-type="functional" mobile-override="true" @sign-in="$emit('open-login')" />
    <UserMenu v-else-if="authState === 'authenticated'" />
  </div>

  <!-- Desktop/Tablet header -->
  <header v-if="isDesktop" v-show="!zenMode" class="detail-header">
    <div class="title-row">
      <router-link to="/" class="detail-logo" title="Back to home">
        <svg width="28" height="28" viewBox="0 0 32 32" fill="none"><rect x="2" y="2" width="28" height="28" rx="8" fill="var(--c-accent)"/><path d="M12 23.5V9.5h5.4a4.6 4.6 0 0 1 0 9.2H12" stroke="var(--text-on-accent)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <span class="detail-logo-word">PeekView</span>
      </router-link>
      <span class="brand-sep"></span>
      <div class="title-group"><h1 class="title">{{ entryTitle }}</h1></div>
      <div class="actions-area">
        <button v-if="isMultiFile" :class="['toggle-btn', { active: isFileTreeOpen }]" @click="$emit('toggle-file-tree')" aria-label="Toggle file tree" :aria-expanded="isFileTreeOpen">
          <FolderIcon :size="16" />
          <span v-if="currentEntry?.files.length" class="toggle-badge">{{ currentEntry.files.length }}</span>
          <span class="tooltip">Toggle file tree</span>
        </button>
        <button v-if="isMarkdown && tocHeadings.length > 0" :class="['toggle-btn', { active: isTocOpen }]" @click="$emit('toggle-toc')" aria-label="Table of Contents" :aria-expanded="isTocOpen">
          <ListIcon :size="16" /><span class="tooltip">Table of Contents</span>
        </button>
        <button v-if="isRichRenderable" :class="['toggle-btn', { active: sourceViewMode }]" @click="$emit('toggle-source-view')" :aria-label="sourceViewMode ? 'Show rendered view' : 'Show source code'" :aria-pressed="sourceViewMode">
          <CodeIcon v-if="!sourceViewMode" :size="16" />
          <EyeIcon v-else :size="16" />
          <span class="tooltip">{{ sourceViewMode ? 'Render' : 'Source' }}</span>
        </button>
        <StarToggle
          v-if="currentEntry"
          :entry="currentEntry"
          :auth-state="(authState as AuthState)"
          @open-login="$emit('open-login')"
          @changed="$emit('star-changed', $event)"
        />
        <span class="action-sep"></span>
        <button v-if="canCopy" class="icon-btn" @click="$emit('copy-content')" aria-label="Copy">
          <CopyIcon :size="16" /><span class="tooltip">Copy</span>
        </button>
        <button v-if="showShareButton" ref="shareBtnRef" class="icon-btn share-btn" @click="$emit('toggle-share-dialog', !shareDialogOpen)" aria-label="Share">
          <Share2Icon :size="16" />
          <span v-if="activeShareCount > 0" class="share-badge">{{ activeShareCount }}</span>
          <span class="tooltip">Share</span>
        </button>
        <ShareDialog v-if="showShareButton" v-model:open="shareDialogModel" :entry-slug="slug" :trigger-ref="shareBtnRef" variant="popover" />
        <span class="action-sep"></span>
        <OverflowMenu :items="overflowItems" variant="dropdown" />
        <AuthButton v-if="authState === 'anonymous'" page-type="functional" mobile-override="false" @sign-in="$emit('open-login')" />
    <UserMenu v-else-if="authState === 'authenticated'" />
        <ThemeToggle />
      </div>
    </div>
    <div class="meta-row">
      <router-link v-if="currentEntry?.username" :to="`/users/${currentEntry.username}`" class="entry-owner-link">@{{ currentEntry.username }}</router-link>
      <span class="meta-dot"></span>
      <span :title="fullTime">{{ relativeTime }}</span>
      <template v-if="currentEntry?.status === 'archived'"><span class="meta-dot"></span><span class="status-tag">Archived</span></template>
      <template v-else-if="isExpiredButActive"><span class="meta-dot"></span><span class="status-tag" style="color:var(--c-warning)">Expired</span></template>
      <template v-else-if="currentEntry?.expiresAt"><span class="meta-dot"></span><span>Expires {{ formatExpiresIn(currentEntry.expiresAt) }}</span></template>
      <span class="meta-sep"></span>
      <template v-if="currentEntry?.readStats"><span>{{ currentEntry.readStats.totalCount }} read{{ currentEntry.readStats.totalCount !== 1 ? 's' : '' }}</span><span class="meta-dot"></span></template>
      <template v-if="currentEntry?.teamId">
        <span class="status-tag team">仅团队可见 · {{ currentEntry.team?.name || currentEntry.team?.slug }}</span>
      </template>
      <template v-else-if="currentEntry">
        <span :class="['status-tag', currentEntry.isPublic ? 'public' : 'private']">{{ currentEntry.isPublic ? 'Public' : 'Private' }}</span>
      </template>
      <BaseTag
        v-for="tag in currentEntry?.tags ?? []"
        :key="tag"
        :href="'/explore?tags=' + encodeURIComponent(tag)"
        @navigate="navigateToTag"
      >{{ tag }}</BaseTag>
    </div>
  </header>
</template>

<script setup lang="ts">
import { inject, ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { formatExpiresIn } from '@/utils/expires'
import OverflowMenu from '@/components/OverflowMenu.vue'
import type { OverflowMenuItem } from '@/components/OverflowMenu.vue'
import ShareDialog from '@/components/ShareDialog.vue'
import ThemeToggle from '@/components/ThemeToggle.vue'
import AuthButton from '@/components/AuthButton.vue'
import UserMenu from '@/components/UserMenu.vue'
import BaseTag from '@/components/BaseTag.vue'
import StarToggle from '@/components/StarToggle.vue'
import type { Entry, TocHeading, AuthState } from '@/types'
import { ZenModeKey, IsMobileKey } from '@/composables/entryDetailKeys'
import {
  Folder as FolderIcon,
  List as ListIcon,
  Copy as CopyIcon,
  Share2 as Share2Icon,
  Code as CodeIcon,
  Eye as EyeIcon,
} from 'lucide-vue-next'

const props = withDefaults(defineProps<{
  entryTitle: string
  relativeTime: string
  fullTime: string
  isExpiredButActive: boolean
  isFileTreeOpen: boolean
  isTocOpen: boolean
  isMarkdown: boolean
  tocHeadings: TocHeading[]
  isMultiFile: boolean
  canCopy: boolean
  showShareButton: boolean
  shareDialogOpen: boolean
  activeShareCount: number
  overflowItems: OverflowMenuItem[]
  authState: string
  currentEntry: Entry | null
  slug: string
  sourceViewMode?: boolean
  isRichRenderable?: boolean
}>(), {
  sourceViewMode: false,
  isRichRenderable: false,
})

const emit = defineEmits<{
  'toggle-file-tree': []
  'toggle-toc': []
  'toggle-source-view': []
  'copy-content': []
  'toggle-share-dialog': [value: boolean]
  'open-login': []
  'star-changed': [data: { starCount: number; isStarred: boolean }]
}>()

const zenMode = inject(ZenModeKey)!
const isMobile = inject(IsMobileKey)!
const isDesktop = computed(() => !isMobile.value)

const router = useRouter()

const shareBtnRef = ref<HTMLElement>()

const shareDialogModel = computed({
  get: () => props.shareDialogOpen,
  set: (v: boolean) => emit('toggle-share-dialog', v),
})

function navigateToTag(href: string) {
  router.push(href)
}
</script>

<style scoped>
.mobile-sticky-header { display: flex; align-items: center; gap: var(--space-2); padding: var(--space-2) var(--space-3); background: var(--c-surface); border-bottom: 1px solid var(--c-border); position: sticky; top: 0; z-index: 50; }
.mobile-logo-link { display: inline-flex; flex-shrink: 0; }
.sticky-title { flex: 1; font-size: var(--font-sm); font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.detail-header { background: var(--c-surface); border-bottom: 1px solid var(--c-border); padding: var(--space-3) var(--space-5); }
.title-row { display: flex; align-items: center; gap: var(--space-3); }
.detail-logo { display: inline-flex; align-items: center; gap: var(--space-2); text-decoration: none; flex-shrink: 0; }
.detail-logo-word { font-size: 20px; font-weight: 700; color: var(--c-text); letter-spacing: -0.02em; }
.brand-sep { width: 1px; height: 24px; background: var(--c-border); }
.title-group { flex: 1; display: flex; flex-direction: column; min-width: 0; }
.title-group .title { margin: 0; padding: 0; }
.actions-area { display: flex; align-items: center; gap: var(--space-1); flex-shrink: 0; }
.toggle-btn { display: inline-flex; align-items: center; position: relative; background: none; border: none; cursor: pointer; padding: var(--space-1); border-radius: var(--radius-sm); color: var(--c-text-secondary); transition: all var(--transition-fast); }
.toggle-btn:hover { background: var(--c-surface-lower); color: var(--c-text); }
.toggle-btn.active { background: var(--c-accent-surface); color: var(--c-accent); }
.toggle-badge { position: absolute; top: -2px; right: -2px; min-width: 14px; height: 14px; display: flex; align-items: center; justify-content: center; background: var(--c-accent); color: var(--text-on-accent); border-radius: 7px; padding: 0 4px; font-size: 10px; font-weight: 600; }
.action-sep { width: 1px; height: 16px; background: var(--c-border); }
.icon-btn { display: inline-flex; align-items: center; position: relative; background: none; border: none; cursor: pointer; padding: var(--space-1); border-radius: var(--radius-sm); color: var(--c-text-secondary); text-decoration: none; transition: all var(--transition-fast); }
.icon-btn:hover { background: var(--c-surface-lower); color: var(--c-text); }
.tooltip { position: absolute; bottom: -28px; left: 50%; transform: translateX(-50%); background: var(--c-surface-lower); color: var(--c-text); padding: 2px 6px; border-radius: var(--radius-sm); font-size: 11px; white-space: nowrap; opacity: 0; pointer-events: none; transition: opacity var(--transition-fast); }
.icon-btn:hover .tooltip, .toggle-btn:hover .tooltip { opacity: 1; }
.share-btn { position: relative; }
.share-badge { position: absolute; top: -4px; right: -4px; min-width: 16px; height: 16px; display: flex; align-items: center; justify-content: center; line-height: 1; pointer-events: none; background: var(--c-accent); color: var(--text-on-accent); border-radius: 6px; padding: 2px 6px; font-size: 11px; font-family: var(--font-mono); }
.meta-row { display: flex; align-items: center; gap: var(--space-1); margin-top: var(--space-2); font-size: var(--font-xs); color: var(--c-text-secondary); flex-wrap: wrap; }
.entry-owner-link { font-size: 12px; color: var(--c-accent); text-decoration: none; font-family: var(--font-mono); }
.entry-owner-link:hover { text-decoration: underline; }
.meta-dot { width: 3px; height: 3px; border-radius: 50%; background: var(--c-text-tertiary); flex-shrink: 0; }
.status-tag { font-size: 10px; padding: 1px 6px; border-radius: 4px; background: var(--c-tag-bg); color: var(--c-text-tertiary); }
.status-tag.public { background: var(--c-accent-surface); color: var(--c-accent); }
.status-tag.private { background: var(--c-surface-lower); color: var(--c-text-secondary); }
.status-tag.team { background: var(--c-badge-shared-bg); color: var(--c-warning); }
</style>
