<template>
  <div class="action-bar" :class="{ 'is-mobile': isMobile }">
    <!-- Desktop: horizontal layout -->
    <template v-if="!isMobile">
      <button
        v-if="canCopy"
        class="action-btn"
        :class="{ active: copied }"
        @click="copy"
        title="Copy content"
      >
        <Icon :icon="copied ? 'codicon:check' : 'codicon:copy'" />
        <span>{{ copied ? 'Copied!' : 'Copy' }}</span>
      </button>

      <button
        v-if="canDownload"
        class="action-btn"
        @click="download"
        title="Download file"
      >
        <Icon icon="codicon:download" />
        <span>Download</span>
      </button>

      <button
        v-if="canWrap"
        class="action-btn"
        :class="{ active: wrap }"
        @click="toggleWrap"
        title="Toggle word wrap"
      >
        <Icon :icon="wrap ? 'codicon:word-wrap' : 'codicon:debug-continue'" />
        <span>{{ wrap ? 'No wrap' : 'Wrap' }}</span>
      </button>

      <ThemeToggle />
    </template>

    <!-- Mobile: icon + label vertical -->
    <template v-else>
      <button
        v-if="canCopy"
        class="action-btn mobile"
        :class="{ active: copied }"
        @click="copy"
      >
        <Icon :icon="copied ? 'codicon:check' : 'codicon:copy'" />
        <span class="btn-label">{{ copied ? 'Done' : 'Copy' }}</span>
      </button>

      <button
        v-if="canDownload"
        class="action-btn mobile"
        @click="download"
      >
        <Icon icon="codicon:download" />
        <span class="btn-label">Save</span>
      </button>

      <button
        v-if="canWrap"
        class="action-btn mobile"
        :class="{ active: wrap }"
        @click="toggleWrap"
      >
        <Icon :icon="wrap ? 'codicon:word-wrap' : 'codicon:debug-continue'" />
        <span class="btn-label">{{ wrap ? 'Unwrap' : 'Wrap' }}</span>
      </button>

      <button class="action-btn mobile theme" @click="toggle">
        <Icon :icon="isDark ? 'codicon:sun' : 'codicon:moon'" />
        <span class="btn-label">{{ isDark ? 'Light' : 'Dark' }}</span>
      </button>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { Icon } from '@iconify/vue'
import ThemeToggle from './ThemeToggle.vue'
import { useTheme } from '../composables/useTheme'

const props = defineProps<{
  canCopy?: boolean
  canDownload?: boolean
  canWrap?: boolean
  content?: string
  filename?: string
  wrap?: boolean
  isMobile?: boolean
}>()

const emit = defineEmits<{
  copy: []
  download: []
  toggleWrap: []
}>()

const { theme, toggle } = useTheme()
const isDark = computed(() => theme.value === 'dark')

const copied = ref(false)

async function copy() {
  if (!props.content) return
  try {
    await navigator.clipboard.writeText(props.content)
    copied.value = true
    emit('copy')
    setTimeout(() => copied.value = false, 2000)
  } catch {
    // Clipboard not available
  }
}

function download() {
  emit('download')
}

function toggleWrap() {
  emit('toggleWrap')
}
</script>

<style scoped>
.action-bar {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.action-btn {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-2) var(--space-3);
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-size: var(--font-sm);
  cursor: pointer;
  transition: all 0.15s ease;
}

.action-btn:hover {
  background: var(--bg-tertiary);
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.action-btn.active {
  background: var(--accent-light);
  color: var(--accent-color);
  border-color: var(--accent-color);
}

/* Mobile styles */
.action-bar.is-mobile {
  display: flex;
  justify-content: space-around;
  padding: var(--space-2);
  gap: var(--space-1);
}

.action-btn.mobile {
  flex-direction: column;
  padding: var(--space-2);
  min-width: 64px;
  min-height: 56px;
  border: none;
  background: transparent;
  font-size: 10px;
}

.action-btn.mobile:hover {
  background: var(--bg-secondary);
  transform: none;
  box-shadow: none;
}

.action-btn.mobile.active {
  background: var(--accent-light);
}

.btn-label {
  margin-top: 2px;
  font-size: 10px;
  color: var(--text-secondary);
}

.action-btn.mobile.active .btn-label {
  color: var(--accent-color);
}
</style>
