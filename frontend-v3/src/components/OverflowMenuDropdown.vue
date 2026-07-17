<template>
  <div class="overflow-dropdown" role="menu" ref="dropdownRef">
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
        @click="emit('close')"
      >
        <slot name="icon" :item="item" />
        <span class="item-label">{{ item.label }}</span>
        <span v-if="item.hint" class="item-hint">{{ item.hint }}</span>
      </a>
      <button
        v-else
        class="overflow-item"
        :class="{ 'item-danger': item.variant === 'danger' }"
        role="menuitem"
        @click="emit('action', item)"
      >
        <slot name="icon" :item="item" />
        <span class="item-label">{{ item.label }}</span>
        <span v-if="item.hint" class="item-hint">{{ item.hint }}</span>
      </button>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

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

defineProps<{
  items: OverflowMenuItem[]
}>()

const emit = defineEmits<{
  close: []
  action: [item: OverflowMenuItem]
}>()

const dropdownRef = ref<HTMLElement>()
</script>

<style scoped>
.overflow-dropdown {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 4px;
  min-width: 220px;
  max-height: calc(100vh - var(--header-height) - 120px);
  overflow-y: auto;
  background: var(--c-surface);
  border: 1px solid var(--c-border-strong);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.16);
  z-index: 100;
}

.overflow-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  width: 100%;
  min-height: 36px;
  padding: 8px 12px;
  font-size: var(--font-sm);
  color: var(--c-text);
  background: transparent;
  border: none;
  cursor: pointer;
  text-decoration: none;
  transition: background 0.15s;
}

.overflow-item:hover {
  background: var(--c-surface-lower);
}
.overflow-item:focus-visible {
  outline: 2px solid var(--c-accent);
  outline-offset: -2px;
}

.overflow-item.item-danger {
  color: var(--c-error);
}

.overflow-item.item-danger:hover {
  background: var(--c-error-surface);
}

.item-icon {
  flex-shrink: 0;
  width: 18px;
  height: 18px;
}

.item-label {
  flex: 1;
}

.item-hint {
  font-size: 11px;
  color: var(--c-text-tertiary);
  white-space: nowrap;
  margin-left: auto;
}

.dropdown-divider {
  height: 1px;
  background: var(--c-border);
  margin: 4px 0;
}
</style>
