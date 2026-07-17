<template>
  <Teleport to="body">
    <div class="sheet-backdrop" @click="emit('close')"></div>
    <div
      class="bottom-sheet"
      :class="{ dragging: isDragging, closing: isClosing }"
      :style="sheetStyle"
      role="menu"
      ref="sheetRef"
      @touchstart="onTouchStart"
      @touchmove="onTouchMove"
      @touchend="onTouchEnd"
    >
      <div class="sheet-drag-handle"></div>
      <div class="sheet-header">
        <span class="sheet-title">More actions</span>
        <button class="sheet-close-btn" @click="emit('close')" aria-label="Close">
          <XIcon :size="20" />
        </button>
      </div>
      <div class="sheet-body" ref="sheetBodyRef">
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
            @click="emit('close')"
          >
            <slot name="icon" :item="item" />
            <span class="sheet-item-label">{{ item.label }}</span>
            <span v-if="item.hint" class="sheet-item-hint">{{ item.hint }}</span>
          </a>
          <button
            v-else
            class="sheet-item"
            :class="{ 'item-danger': item.variant === 'danger' }"
            role="menuitem"
            @click="emit('action', item)"
          >
            <slot name="icon" :item="item" />
            <span class="sheet-item-label">{{ item.label }}</span>
            <span v-if="item.hint" class="sheet-item-hint">{{ item.hint }}</span>
          </button>
        </template>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { X as XIcon } from 'lucide-vue-next'

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

const sheetRef = ref<HTMLElement>()
const sheetBodyRef = ref<HTMLElement>()
const dragOffsetY = ref(0)
const isDragging = ref(false)
const isClosing = ref(false)
let touchStartY = 0

const sheetStyle = computed(() => ({
  transform: isDragging.value ? `translateY(${dragOffsetY.value}px)` : undefined,
}))

function onTouchStart(e: TouchEvent) {
  if (sheetBodyRef.value && sheetBodyRef.value.scrollTop > 0) return
  touchStartY = e.touches[0].clientY
  isDragging.value = true
}

function onTouchMove(e: TouchEvent) {
  if (!isDragging.value) return
  const deltaY = e.touches[0].clientY - touchStartY
  if (deltaY > 0) {
    dragOffsetY.value = deltaY
  } else {
    dragOffsetY.value = 0
  }
}

function onTouchEnd() {
  isDragging.value = false
  if (dragOffsetY.value >= 50) {
    isClosing.value = true
    setTimeout(() => {
      isClosing.value = false
      dragOffsetY.value = 0
      emit('close')
    }, 200)
  } else {
    dragOffsetY.value = 0
  }
}
</script>

<style scoped>
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
  transition: transform 200ms ease-out;
}

.bottom-sheet.dragging {
  transition: none;
}

.bottom-sheet.closing {
  transition: transform 200ms ease-out;
  transform: translateY(100%);
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
  background: var(--c-surface-lower);
  color: var(--c-text);
}

.sheet-body {
  overflow-y: auto;
  padding: 4px 0;
}

.sheet-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  width: 100%;
  min-height: 48px;
  padding: 12px 16px;
  font-size: var(--font-sm);
  color: var(--c-text);
  background: transparent;
  border: none;
  cursor: pointer;
  text-decoration: none;
  transition: background 0.15s;
}

.sheet-item:hover {
  background: var(--c-surface-lower);
}
.sheet-item:focus-visible {
  outline: 2px solid var(--c-accent);
  outline-offset: -2px;
}

.sheet-item.item-danger {
  color: var(--c-error);
}

.sheet-item.item-danger:hover {
  background: var(--c-error-surface);
}

.sheet-item-icon {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
}

.sheet-item-label {
  flex: 1;
  text-align: left;
}

.sheet-item-hint {
  font-size: 12px;
  color: var(--c-text-tertiary);
  white-space: nowrap;
  margin-left: auto;
}

.sheet-divider {
  height: 1px;
  background: var(--c-border);
  margin: 4px 16px;
}
</style>
