<template>
  <div class="truncation-banner" role="status">
    <AlertTriangleIcon :size="16" />
    <span class="truncation-message">{{ message }}</span>
    <button class="download-btn" @click="downloadFn()">
      <DownloadIcon :size="14" />
      <span>Download</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { AlertTriangle as AlertTriangleIcon, Download as DownloadIcon } from 'lucide-vue-next'

defineProps<{
  message: string
  downloadFn: () => void
}>()
</script>

<style scoped>
.truncation-banner {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3);
  margin-bottom: var(--space-3);
  border-radius: var(--radius-md);
  background: var(--warning-bg);
  color: var(--warning-text);
  border: 1px solid var(--warning-border);
  font-size: var(--font-sm);
}

.truncation-message {
  flex: 1;
}

.download-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-3);
  border: 1px solid var(--warning-border);
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--warning-text);
  cursor: pointer;
  font-size: var(--font-sm);
  flex-shrink: 0;
}

.download-btn:hover {
  background: var(--warning-bg);
}
</style>
