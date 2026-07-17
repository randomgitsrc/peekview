<template>
  <div class="overflow-menu" ref="menuRef">
    <button
      class="icon-btn overflow-trigger"
      :class="{ 'is-open': isOpen }"
      ref="triggerRef"
      @click="toggle"
      @keydown.enter="open"
      @keydown.space.prevent="open"
      aria-haspopup="true"
      :aria-expanded="isOpen"
      :aria-label="variant === 'sheet' ? 'More actions' : 'More'"
    >
      <MoreHorizontalIcon :size="16" />
      <ChevronDownIcon :size="12" />
    </button>

    <OverflowMenuDropdown
      v-if="isOpen && variant === 'dropdown'"
      :items="items"
      @close="close"
      @action="handleAction"
    >
      <template #icon="{ item }">
        <IconRenderer v-if="item.icon" :name="item.icon" class="item-icon" />
      </template>
    </OverflowMenuDropdown>

    <OverflowMenuSheet
      v-if="isOpen && variant === 'sheet'"
      :items="items"
      @close="close"
      @action="handleAction"
    >
      <template #icon="{ item }">
        <IconRenderer v-if="item.icon" :name="item.icon" class="sheet-item-icon" />
      </template>
    </OverflowMenuSheet>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, h } from 'vue'
import {
  MoreHorizontal as MoreHorizontalIcon,
  ChevronDown as ChevronDownIcon,
  Moon as MoonIcon,
  Sun as SunIcon,
  Globe as GlobeIcon,
  Lock as LockIcon,
  Share2 as Share2Icon,
  Download as DownloadIcon,
  Package as PackageIcon,
  FileText as FileTextIcon,
  List as ListIcon,
  Trash2 as Trash2Icon,
  Copy as CopyIcon,
} from 'lucide-vue-next'
import OverflowMenuDropdown from '@/components/OverflowMenuDropdown.vue'
import OverflowMenuSheet from '@/components/OverflowMenuSheet.vue'

const iconMap: Record<string, any> = {
  moon: MoonIcon,
  sun: SunIcon,
  globe: GlobeIcon,
  lock: LockIcon,
  'share-2': Share2Icon,
  download: DownloadIcon,
  package: PackageIcon,
  'file-text': FileTextIcon,
  list: ListIcon,
  'trash-2': Trash2Icon,
  copy: CopyIcon,
}

export interface OverflowMenuItem {
  label: string
  icon?: string
  hint?: string
  href?: string
  target?: string
  rel?: string
  variant?: 'default' | 'danger'
  divider?: boolean
  action?: () => void
}

withDefaults(defineProps<{
  items: OverflowMenuItem[]
  variant?: 'dropdown' | 'sheet'
}>(), {
  variant: 'dropdown',
})

const IconRenderer = (props: { name: string; class?: string }) => {
  const icon = iconMap[props.name]
  if (icon) {
    return h(icon, { size: 18, class: props.class })
  }
  return null
}
IconRenderer.props = ['name', 'class']

const isOpen = ref(false)
const menuRef = ref<HTMLElement>()
const triggerRef = ref<HTMLElement>()

function toggle() {
  isOpen.value = !isOpen.value
}

function open() {
  isOpen.value = true
}

function close() {
  isOpen.value = false
  triggerRef.value?.focus()
}

function handleAction(item: OverflowMenuItem) {
  close()
  item.action?.()
}

function handleClickOutside(e: MouseEvent) {
  if (menuRef.value && !menuRef.value.contains(e.target as Node)) {
    close()
  }
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && isOpen.value) {
    close()
  }
  if (e.key === 'Tab' && isOpen.value) {
    close()
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  document.removeEventListener('keydown', handleKeydown)
})

defineExpose({ close })
</script>

<style scoped>
.overflow-menu {
  position: relative;
  display: inline-flex;
}

.overflow-trigger.is-open {
  background: var(--c-surface-lower);
  color: var(--c-accent);
}
</style>
