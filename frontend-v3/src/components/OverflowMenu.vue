<template>
  <div class="overflow-menu" ref="menuRef">
    <button
      class="icon-btn overflow-trigger"
      :class="{ 'is-open': isOpen }"
      ref="triggerRef"
      @click="toggle"
      aria-haspopup="true"
      :aria-expanded="isOpen"
      :aria-label="variant === 'sheet' ? 'More actions' : 'More'"
    >
      <MoreHorizontalIcon :size="16" />
      <ChevronDownIcon :size="12" />
    </button>

    <!-- Dropdown variant -->
    <div
      v-if="isOpen && variant === 'dropdown'"
      class="overflow-dropdown"
      role="menu"
    >
      <template v-for="item in items" :key="item.label">
        <div v-if="item.divider" class="dropdown-divider"></div>
        <a
          v-if="item.href"
          :href="item.href"
          :target="item.target"
          :rel="item.rel"
          class="overflow-item"
          :class="{ 'item-danger': item.variant === 'danger' }"
          role="menuitem"
          @click="close"
        >
          <IconRenderer v-if="item.icon" :name="item.icon" class="item-icon" />
          <span class="item-label">{{ item.label }}</span>
          <span v-if="item.hint" class="item-hint">{{ item.hint }}</span>
        </a>
        <button
          v-else
          class="overflow-item"
          :class="{ 'item-danger': item.variant === 'danger' }"
          role="menuitem"
          @click="handleAction(item)"
        >
          <IconRenderer v-if="item.icon" :name="item.icon" class="item-icon" />
          <span class="item-label">{{ item.label }}</span>
          <span v-if="item.hint" class="item-hint">{{ item.hint }}</span>
        </button>
      </template>
    </div>

    <!-- Sheet variant (mobile) -->
    <Teleport v-if="isOpen && variant === 'sheet'" to="body">
      <div class="sheet-backdrop" @click="close"></div>
      <div class="bottom-sheet" role="menu">
        <div class="sheet-drag-handle"></div>
        <div class="sheet-header">
          <span class="sheet-title">More actions</span>
          <button class="sheet-close-btn" @click="close" aria-label="Close">
            <XIcon :size="20" />
          </button>
        </div>
        <div class="sheet-body">
          <template v-for="item in items" :key="item.label">
            <div v-if="item.divider" class="sheet-divider"></div>
            <a
              v-if="item.href"
              :href="item.href"
              :target="item.target"
              :rel="item.rel"
              class="sheet-item"
              :class="{ 'item-danger': item.variant === 'danger' }"
              role="menuitem"
              @click="close"
            >
              <IconRenderer v-if="item.icon" :name="item.icon" class="sheet-item-icon" />
              <span class="sheet-item-label">{{ item.label }}</span>
              <span v-if="item.hint" class="sheet-item-hint">{{ item.hint }}</span>
            </a>
            <button
              v-else
              class="sheet-item"
              :class="{ 'item-danger': item.variant === 'danger' }"
              role="menuitem"
              @click="handleAction(item)"
            >
              <IconRenderer v-if="item.icon" :name="item.icon" class="sheet-item-icon" />
              <span class="sheet-item-label">{{ item.label }}</span>
              <span v-if="item.hint" class="sheet-item-hint">{{ item.hint }}</span>
            </button>
          </template>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, h } from 'vue'
import {
  MoreHorizontal as MoreHorizontalIcon,
  X as XIcon,
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
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<style scoped>
.overflow-menu {
  position: relative;
  display: inline-flex;
}

.overflow-trigger.is-open {
  background: var(--c-border);
  color: var(--c-accent);
}

/* Dropdown */
.overflow-dropdown {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 4px;
  width: 220px;
  background: var(--c-surface);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
  z-index: 100;
}

.overflow-item {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: var(--space-2);
  width: 100%;
  height: 40px;
  padding: 0 12px;
  font-size: var(--font-sm);
  color: var(--text-primary);
  background: transparent;
  border: none;
  cursor: pointer;
  text-decoration: none;
  transition: background 0.15s;
}

.overflow-item:hover {
  background: var(--c-border);
}
.overflow-item:focus-visible {
  outline: 2px solid var(--c-accent);
  outline-offset: -2px;
}

.overflow-item.item-danger {
  color: var(--c-error);
}

.overflow-item.item-danger:hover {
  background: var(--error-bg);
}

.item-icon {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.item-icon :deep(svg) {
  width: 18px;
  height: 18px;
  stroke-width: 2;
}

.item-label {
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-hint {
  font-size: 11px;
  color: var(--text-tertiary);
  white-space: nowrap;
  margin-left: auto;
}

.dropdown-divider {
  height: 1px;
  background: var(--border-color);
  margin: 4px 0;
}

/* Bottom Sheet */
.sheet-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  z-index: 1000;
}

.bottom-sheet {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: var(--c-surface);
  border-radius: 16px 16px 0 0;
  z-index: 1001;
  max-height: 70vh;
  display: flex;
  flex-direction: column;
  padding-bottom: env(safe-area-inset-bottom, 0px);
  box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.2);
}

.sheet-drag-handle {
  width: 36px;
  height: 4px;
  background: var(--c-text-tertiary);
  border-radius: 2px;
  margin: 8px auto 0;
  opacity: 0.4;
}

.sheet-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px 8px;
  border-bottom: 1px solid var(--c-border);
}

.sheet-title {
  font-size: var(--font-md);
  font-weight: 600;
}

.sheet-close-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 7px;
  background: transparent;
  color: var(--c-text-secondary);
  cursor: pointer;
}

.sheet-close-btn:hover {
  background: var(--c-border);
  color: var(--c-text);
}

.sheet-body {
  overflow-y: auto;
  padding: 4px 0;
}

.sheet-item {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: var(--space-3);
  width: 100%;
  min-height: 48px;
  padding: 12px 16px;
  font-size: var(--font-sm);
  color: var(--text-primary);
  background: transparent;
  border: none;
  cursor: pointer;
  text-decoration: none;
  transition: background 0.15s;
}

.sheet-item:hover {
  background: var(--c-border);
}
.sheet-item:focus-visible {
  outline: 2px solid var(--c-accent);
  outline-offset: -2px;
}

.sheet-item.item-danger {
  color: var(--c-error);
}

.sheet-item.item-danger:hover {
  background: var(--error-bg);
}

.sheet-item-icon {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.sheet-item-icon :deep(svg) {
  width: 18px;
  height: 18px;
  stroke-width: 2;
}

.sheet-item-label {
  flex: 1;
  text-align: left;
}

.sheet-item-hint {
  font-size: 12px;
  color: var(--text-tertiary);
  white-space: nowrap;
  margin-left: auto;
}

.sheet-divider {
  height: 1px;
  background: var(--border-color);
  margin: 4px 16px;
}
</style>
