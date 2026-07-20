<template>
  <div class="share-dialog" ref="containerRef">
    <template v-if="variant === 'popover'">
      <Teleport to="body">
        <div
          v-if="isOpen"
          class="share-popover"
          :class="{ 'flip-up': flipUp }"
          :style="popoverStyle"
          ref="popoverRef"
          @keydown="onKeyDown"
        >
          <ShareDialogContent
            :entry-slug="entrySlug"
            @created="onCreated"
            @revoked="onRevoked"
            @close="closeDialog"
          />
        </div>
      </Teleport>
    </template>

    <template v-if="variant === 'sheet'">
      <Teleport to="body">
        <div v-if="isOpen" class="share-sheet-backdrop" @click="closeDialog"></div>
        <div
          v-if="isOpen"
          class="share-bottom-sheet"
          :class="{ dragging: isDragging, closing: isClosing }"
          :style="sheetStyle"
          ref="sheetRef"
          @touchstart="onTouchStart"
          @touchmove="onTouchMove"
          @touchend="onTouchEnd"
        >
          <div class="sheet-drag-handle"></div>
          <ShareDialogContent
            :entry-slug="entrySlug"
            @created="onCreated"
            @revoked="onRevoked"
            @close="closeDialog"
          />
        </div>
      </Teleport>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import ShareDialogContent from '@/components/ShareDialogContent.vue'

const props = withDefaults(defineProps<{
  entrySlug: string
  variant?: 'popover' | 'sheet'
  triggerRef?: HTMLElement
}>(), {
  variant: 'popover',
})

const isOpen = defineModel<boolean>('open', { default: false })

const emit = defineEmits<{
  created: []
  revoked: []
}>()

const containerRef = ref<HTMLElement>()
const popoverRef = ref<HTMLElement>()
const sheetRef = ref<HTMLElement>()
const flipUp = ref(false)
const popoverPos = ref({ top: 0, right: 0 })

const dragOffsetY = ref(0)
const isDragging = ref(false)
const isClosing = ref(false)
let touchStartY = 0

const popoverStyle = computed(() => {
  if (flipUp.value) {
    return {
      position: 'fixed' as const,
      bottom: `${window.innerHeight - popoverPos.value.top + 4}px`,
      right: `${window.innerWidth - popoverPos.value.right}px`,
      width: '280px',
    }
  }
  return {
    position: 'fixed' as const,
    top: `${popoverPos.value.top + 4}px`,
    right: `${window.innerWidth - popoverPos.value.right}px`,
    width: '280px',
  }
})

const sheetStyle = computed(() => ({
  transform: isDragging.value ? `translateY(${dragOffsetY.value}px)` : undefined,
}))

function closeDialog() {
  isOpen.value = false
}

function onCreated() {
  emit('created')
}

function onRevoked() {
  emit('revoked')
}

function updatePosition() {
  if (props.variant !== 'popover') return
  const triggerEl = props.triggerRef ?? containerRef.value?.previousElementSibling as HTMLElement | null
  if (!triggerEl) return
  const triggerRect = triggerEl.getBoundingClientRect()
  popoverPos.value = { top: triggerRect.bottom, right: triggerRect.right }
  if (popoverRef.value) {
    const availableBelow = window.innerHeight - triggerRect.bottom
    const popoverHeight = popoverRef.value.scrollHeight
    flipUp.value = availableBelow < Math.min(popoverHeight, 400)
  }
}

function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    closeDialog()
    const triggerEl = props.triggerRef ?? containerRef.value?.previousElementSibling as HTMLElement | null
    triggerEl?.focus()
    return
  }
  if (e.key === 'Tab' && popoverRef.value) {
    const focusable = popoverRef.value.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    if (!focusable.length) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      closeDialog()
      const triggerEl = props.triggerRef ?? containerRef.value?.previousElementSibling as HTMLElement | null
      triggerEl?.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      closeDialog()
      const triggerEl = props.triggerRef ?? containerRef.value?.previousElementSibling as HTMLElement | null
      triggerEl?.focus()
    }
  }
}

function onTouchStart(e: TouchEvent) {
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
      closeDialog()
    }, 200)
  } else {
    dragOffsetY.value = 0
  }
}

function onGlobalKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && isOpen.value) {
    closeDialog()
  }
}

function handleClickOutside(e: MouseEvent) {
  if (props.variant !== 'popover' || !isOpen.value) return
  const target = e.target as Node
  if (popoverRef.value && popoverRef.value.contains(target)) return
  if (containerRef.value && containerRef.value.contains(target)) return
  if (props.triggerRef && props.triggerRef.contains(target)) return
  if (!target.isConnected) return
  closeDialog()
}

function onScrollClose() {
  if (isOpen.value && props.variant === 'popover') {
    closeDialog()
  }
}

function onResize() {
  if (isOpen.value && props.variant === 'popover') {
    updatePosition()
  }
}

watch(isOpen, async (val) => {
  if (val && props.variant === 'popover') {
    await nextTick()
    updatePosition()
  }
})

onMounted(() => {
  document.addEventListener('keydown', onGlobalKeydown)
  document.addEventListener('click', handleClickOutside)
  window.addEventListener('scroll', onScrollClose, true)
  window.addEventListener('resize', onResize)
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onGlobalKeydown)
  document.removeEventListener('click', handleClickOutside)
  window.removeEventListener('scroll', onScrollClose, true)
  window.removeEventListener('resize', onResize)
})
</script>

<style scoped>
.share-dialog {
  display: contents;
}

.share-popover {
  max-height: calc(100vh - var(--header-height) - 20px);
  overflow-y: auto;
  background: var(--c-surface);
  border: 1px solid var(--c-border-strong);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.16);
  z-index: 200;
}

.share-sheet-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  z-index: 1000;
}

.share-bottom-sheet {
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
  overflow-y: auto;
}

.share-bottom-sheet.dragging {
  transition: none;
}

.share-bottom-sheet.closing {
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
  flex-shrink: 0;
}
</style>
