<template>
  <Teleport to="body">
    <Transition name="drawer">
      <div v-if="isOpen" class="mobile-drawer-overlay" @click="close">
        <div class="mobile-drawer" @click.stop>
          <div class="drawer-header">
            <h3>Outline</h3>
            <button class="close-btn" @click="close">
              <Icon icon="codicon:close" />
            </button>
          </div>
          <nav class="drawer-content toc-nav">
            <ul class="toc-list">
              <li v-for="h in headings" :key="h.id" :class="`toc-level-${h.level}`">
                <a :href="`#${h.id}`" @click.prevent="navigate(h.id)">{{ h.text }}</a>
              </li>
            </ul>
          </nav>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
interface Heading { id: string; text: string; level: number }
const props = defineProps<{ isOpen: boolean; headings: Heading[] }>()
const emit = defineEmits<{ close: []; navigate: [id: string] }>()
const close = () => emit('close')
const navigate = (id: string) => { emit('navigate', id); close() }
</script>

<style scoped>
.mobile-drawer-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 100; display: flex; justify-content: flex-end; }
.mobile-drawer { width: 85%; max-width: 320px; height: 100%; background: var(--bg-primary); display: flex; flex-direction: column; box-shadow: var(--shadow-drawer); }
.drawer-header { display: flex; align-items: center; justify-content: space-between; padding: var(--space-3) var(--space-4); border-bottom: 1px solid var(--border-color); }
.drawer-header h3 { margin: 0; font-size: var(--font-md); color: var(--text-primary); }
.close-btn { background: none; border: none; color: var(--text-secondary); font-size: 20px; cursor: pointer; padding: var(--space-1); }
.drawer-content { flex: 1; overflow-y: auto; padding: var(--space-3); }
.toc-list { list-style: none; margin: 0; padding: 0; }
.toc-list li { margin: var(--space-2) 0; }
.toc-list a { color: var(--text-secondary); text-decoration: none; display: block; padding: var(--space-1) 0; border-left: 2px solid transparent; padding-left: var(--space-2); }
.toc-list a:hover { color: var(--text-primary); }
.toc-level-2 { padding-left: var(--space-3); }
.toc-level-3 { padding-left: var(--space-6); }
.drawer-enter-active, .drawer-leave-active { transition: opacity 0.2s ease; }
.drawer-enter-from, .drawer-leave-to { opacity: 0; }
.drawer-enter-active .mobile-drawer, .drawer-leave-active .mobile-drawer { transition: transform 0.2s ease; }
.drawer-enter-from .mobile-drawer, .drawer-leave-to .mobile-drawer { transform: translateX(100%); }
</style>
