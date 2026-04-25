<template>
  <Teleport to="body">
    <Transition name="drawer">
      <div v-if="isOpen" class="mobile-drawer-overlay" @click="close">
        <div class="mobile-drawer" @click.stop>
          <div class="drawer-header">
            <h3>Files</h3>
            <button class="close-btn" @click="close" aria-label="Close file drawer">
              <Icon icon="codicon:close" />
            </button>
          </div>
          <div class="drawer-content">
            <FileTree
              :files="files"
              :active-file-id="activeFileId"
              @select="onSelect"
            />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import FileTree from './FileTree.vue'
import type { FileResponse } from '../types'

const props = defineProps<{
  isOpen: boolean
  files: FileResponse[]
  activeFileId: number | null
}>()

const emit = defineEmits<{
  close: []
  select: [file: FileResponse]
}>()

function close() {
  emit('close')
}

function onSelect(file: FileResponse) {
  emit('select', file)
  close()
}
</script>

<style scoped>
.mobile-drawer-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 100;
  display: flex;
  justify-content: flex-end;
}

.mobile-drawer {
  width: 85%;
  max-width: 320px;
  height: 100%;
  background: var(--bg-primary);
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow-drawer); /* STYLE-SH-03: Drawer shadow */
}

.drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--border-color);
}

.drawer-header h3 {
  margin: 0;
  font-size: var(--font-md);
  color: var(--text-primary);
}

.close-btn {
  background: none;
  border: none;
  color: var(--text-secondary);
  font-size: 20px;
  cursor: pointer;
  padding: var(--space-1);
}

.drawer-content {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-2);
}

.drawer-content :deep(.file-tree) {
  min-width: auto;
  max-width: none;
  border: none;
  max-height: none;
}

.drawer-enter-active,
.drawer-leave-active {
  transition: opacity 0.2s ease; /* INTER-A-03: Drawer animation 200ms */
}

.drawer-enter-from,
.drawer-leave-to {
  opacity: 0;
}

.drawer-enter-active .mobile-drawer,
.drawer-leave-active .mobile-drawer {
  transition: transform 0.2s ease; /* INTER-A-03: Drawer animation 200ms */
}

.drawer-enter-from .mobile-drawer,
.drawer-leave-to .mobile-drawer {
  transform: translateX(100%);
}
</style>
