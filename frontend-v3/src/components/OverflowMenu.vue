<template>
  <div class="overflow-menu" ref="menuRef">
    <button
      class="overflow-trigger"
      :class="{ 'is-open': isOpen }"
      ref="triggerRef"
      @click="toggle"
      aria-haspopup="true"
      :aria-expanded="isOpen"
    >
      ⋯
    </button>
    <div
      v-if="isOpen"
      class="overflow-dropdown"
      role="menu"
    >
      <template v-for="item in items" :key="item.label">
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
          <span v-if="item.icon" class="item-icon">{{ item.icon }}</span>
          {{ item.label }}
        </a>
        <button
          v-else
          class="overflow-item"
          :class="{ 'item-danger': item.variant === 'danger' }"
          role="menuitem"
          @click="handleAction(item)"
        >
          <span v-if="item.icon" class="item-icon">{{ item.icon }}</span>
          {{ item.label }}
        </button>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

export interface OverflowMenuItem {
  label: string
  icon?: string
  href?: string
  target?: string
  rel?: string
  variant?: 'default' | 'danger'
  action?: () => void
}

defineProps<{
  items: OverflowMenuItem[]
}>()

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
}

.overflow-trigger {
  min-width: 44px;
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--c-border-strong);
  border-radius: var(--radius-lg);
  background: transparent;
  color: var(--c-text);
  font-size: 18px;
  cursor: pointer;
  transition: all var(--transition-fast);
  padding: 0 10px;
}

.overflow-trigger:hover {
  background: var(--c-border);
  border-color: var(--c-text-tertiary);
}

.overflow-trigger.is-open {
  background: var(--c-border);
  border-color: var(--c-accent);
}

.overflow-dropdown {
  position: absolute;
  bottom: 100%;
  right: 0;
  margin-bottom: 4px;
  min-width: 160px;
  max-height: calc(100vh - var(--header-height) - 120px);
  overflow-y: auto;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.15);
  z-index: 100;
}

.overflow-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  width: 100%;
  min-height: 44px;
  padding: 12px 16px;
  font-size: var(--font-sm);
  color: var(--text-primary);
  background: transparent;
  border: none;
  cursor: pointer;
  text-decoration: none;
  transition: background 0.15s;
}

.overflow-item:hover {
  background: var(--bg-secondary);
}

.overflow-item.item-danger {
  color: var(--c-error);
}

.overflow-item.item-danger:hover {
  background: var(--error-bg);
}

.item-icon {
  flex-shrink: 0;
}
</style>
