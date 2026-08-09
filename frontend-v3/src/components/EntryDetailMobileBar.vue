<template>
  <div v-if="isMobile && currentEntry" v-show="!zenMode" class="mobile-bottom-bar" data-testid="mobile-bottom-bar">
    <button v-if="isMultiFile"
      :class="['toggle-btn', { active: showFileDrawer }]"
      @click="$emit('toggle-file-drawer')"
      aria-label="Files"
      data-testid="mobile-bar-filetree-btn">
      <FolderIcon :size="16" />
      <span v-if="currentEntry?.files.length" class="toggle-badge">{{ currentEntry.files.length }}</span>
    </button>
    <button v-if="isMarkdown && tocHeadings.length > 0"
      :class="['toggle-btn', { active: showTocDrawer }]"
      @click="$emit('toggle-toc-drawer')"
      aria-label="Table of Contents"
      data-testid="mobile-bar-toc-btn">
      <ListIcon :size="16" />
    </button>
    <button
      v-if="isRichRenderable"
      :class="['toggle-btn', { active: sourceViewMode }]"
      @click="$emit('toggle-source-view')"
      :aria-label="sourceViewMode ? 'Show rendered view' : 'Show source code'"
      :aria-pressed="sourceViewMode"
      data-testid="mobile-bar-source-toggle-btn">
      <CodeIcon v-if="!sourceViewMode" :size="16" />
      <EyeIcon v-else :size="16" />
    </button>
    <div class="flex-spacer"></div>
    <template v-if="!isBinary">
      <button v-if="canWrap"
        :class="['toggle-btn', { active: wrapEnabled }]"
        @click="$emit('toggle-wrap')"
        :aria-label="wrapEnabled ? 'Disable line wrap' : 'Enable line wrap'"
        :aria-pressed="wrapEnabled"
        data-testid="mobile-bar-wrap-btn">
        <WrapTextIcon :size="16" />
      </button>
      <button v-if="canCopy" class="icon-btn" @click="$emit('copy-content')" aria-label="Copy" data-testid="mobile-bar-copy-btn">
        <CopyIcon :size="16" />
      </button>
    </template>
    <OverflowMenu :items="overflowItems" variant="sheet" />
  </div>
</template>

<script setup lang="ts">
import { inject } from 'vue'
import OverflowMenu from '@/components/OverflowMenu.vue'
import type { OverflowMenuItem } from '@/components/OverflowMenu.vue'
import type { Entry, TocHeading } from '@/types'
import { ZenModeKey, IsMobileKey } from '@/composables/entryDetailKeys'
import {
  Folder as FolderIcon,
  List as ListIcon,
  Copy as CopyIcon,
  Code as CodeIcon,
  Eye as EyeIcon,
  WrapText as WrapTextIcon,
} from 'lucide-vue-next'

defineProps<{
  isMultiFile: boolean
  isMarkdown: boolean
  tocHeadings: TocHeading[]
  isBinary: boolean
  canWrap: boolean
  canCopy: boolean
  wrapEnabled: boolean
  showFileDrawer: boolean
  showTocDrawer: boolean
  overflowItems: OverflowMenuItem[]
  currentEntry: Entry | null
  sourceViewMode: boolean
  isRichRenderable: boolean
}>()

defineEmits<{
  'toggle-file-drawer': []
  'toggle-toc-drawer': []
  'toggle-source-view': []
  'toggle-wrap': []
  'copy-content': []
}>()

const zenMode = inject(ZenModeKey)!
const isMobile = inject(IsMobileKey)!
</script>

<style scoped>
.mobile-bottom-bar {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-1) var(--space-3);
  padding-bottom: calc(var(--space-1) + env(safe-area-inset-bottom, 0px));
  background: var(--c-surface);
  border-top: 1px solid var(--c-border);
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 50;
  min-height: var(--mobile-bar-height);
}

.toggle-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  position: relative;
  background: none;
  border: none;
  cursor: pointer;
  padding: var(--space-1);
  border-radius: var(--radius-sm);
  color: var(--c-text-secondary);
  min-width: 44px;
  min-height: 44px;
}

.toggle-btn.active {
  color: var(--c-accent);
}

.toggle-badge {
  position: absolute;
  top: -2px;
  right: -2px;
  min-width: 14px;
  height: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--c-accent);
  color: var(--text-on-accent);
  border-radius: 7px;
  padding: 0 4px;
  font-size: 10px;
  font-weight: 600;
}

.flex-spacer {
  flex: 1;
}

.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  position: relative;
  background: none;
  border: none;
  cursor: pointer;
  padding: var(--space-1);
  border-radius: var(--radius-sm);
  color: var(--c-text-secondary);
  min-width: 44px;
  min-height: 44px;
}
</style>
