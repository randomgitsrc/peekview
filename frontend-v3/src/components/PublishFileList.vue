<template>
  <div class="publish-file-list">
    <p v-if="drafts.length === 0" class="file-empty" data-testid="publish-file-empty">至少选择一个文件</p>
    <div v-else class="file-rows">
      <div
        v-for="draft in drafts"
        :key="draft.fileId"
        class="file-row"
        data-testid="publish-file-row"
        :data-file-id="draft.fileId"
      >
        <div class="file-row-head">
          <span class="file-name">{{ draft.filename }}</span>
          <span
            v-if="draft.isBinary"
            class="file-badge"
            data-testid="publish-file-badge-binary"
          >二进制</span>
          <span v-else class="file-badge file-badge-text">文本</span>
          <span class="file-size">{{ formatSize(draft.size) }}</span>
        </div>
        <input
          class="file-path-input"
          data-testid="publish-file-path-input"
          type="text"
          :value="draft.path"
          :disabled="disabled"
          :aria-label="'相对路径：' + draft.filename"
          :aria-describedby="'publish-file-error-' + draft.fileId"
          :aria-invalid="fileErrors[draft.fileId] ? 'true' : 'false'"
          @input="onPathInput(draft.fileId, $event)"
        />
        <button
          type="button"
          class="file-remove"
          data-testid="publish-file-remove"
          :disabled="disabled"
          @click="emit('remove', draft.fileId)"
        >移除</button>
        <p
          v-if="fileErrors[draft.fileId]"
          :id="'publish-file-error-' + draft.fileId"
          class="field-error file-row-error"
          data-testid="publish-file-row-error"
          role="alert"
        >{{ fileErrors[draft.fileId] }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PublishFileDraft } from '@/types'

defineProps<{
  drafts: PublishFileDraft[]
  fileErrors: Record<string, string>
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update-path': [fileId: string, path: string]
  remove: [fileId: string]
}>()

function onPathInput(fileId: string, e: Event): void {
  emit('update-path', fileId, (e.target as HTMLInputElement).value)
}

function formatSize(size: number): string {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}
</script>

<style scoped>
.publish-file-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.file-empty {
  margin: 0;
  padding: var(--space-3);
  font-size: var(--font-sm);
  color: var(--c-text-tertiary);
  background: var(--c-surface-lower);
  border: 1px dashed var(--c-border);
  border-radius: var(--radius-md);
}

.file-rows {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.file-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--c-border);
  border-radius: var(--radius-md);
  background: var(--c-surface);
}

.file-row-head {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
}

.file-name {
  font-family: var(--font-mono);
  font-size: var(--font-sm);
  color: var(--c-text);
  overflow-wrap: anywhere;
}

.file-badge {
  display: inline-flex;
  align-items: center;
  padding: 1px 8px;
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  font-size: var(--font-xs);
  background: var(--c-badge-private-bg);
  color: var(--c-error);
}

.file-badge-text {
  background: var(--c-badge-public-bg);
  color: var(--c-success);
}

.file-size {
  font-size: var(--font-xs);
  color: var(--c-text-tertiary);
}

.file-path-input {
  flex: 1;
  min-width: 180px;
  min-height: 36px;
  padding: 6px 10px;
  border-radius: var(--radius-md);
  border: 1px solid var(--c-border);
  background: var(--c-surface-lower);
  color: var(--c-text);
  font-family: var(--font-mono);
  font-size: var(--font-sm);
}

.file-path-input:focus {
  outline: 2px solid var(--c-accent);
  outline-offset: -1px;
}

.file-path-input[aria-invalid='true'] {
  border-color: var(--c-error);
}

.file-remove {
  padding: 6px 12px;
  border-radius: var(--radius-md);
  border: 1px solid var(--c-border-strong);
  background: transparent;
  color: var(--c-text-secondary);
  font-size: var(--font-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.file-remove:hover:not(:disabled) {
  background: var(--c-error-surface);
  color: var(--c-error);
  border-color: var(--c-error);
}

.file-remove:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.file-row-error {
  flex-basis: 100%;
  margin: 0;
}

@media (max-width: 640px) {
  .file-row {
    align-items: stretch;
  }

  .file-path-input {
    flex-basis: 100%;
    min-width: 0;
  }
}
</style>
