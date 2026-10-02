<template>
  <div
    class="file-dropzone"
    :class="{ 'is-dragover': isDragOver, 'is-disabled': disabled }"
    data-testid="publish-dropzone"
    role="button"
    :tabindex="disabled ? -1 : 0"
    :aria-disabled="disabled ? 'true' : 'false'"
    @click="openPicker"
    @keydown.enter.prevent="openPicker"
    @keydown.space.prevent="openPicker"
    @dragover.prevent="onDragOver"
    @dragleave.prevent="onDragLeave"
    @drop.prevent="onDrop"
  >
    <p class="dropzone-title">拖拽文件到此处，或点击选择</p>
    <p class="dropzone-hint">支持多选，最多 {{ maxFiles }} 个文件</p>
    <input
      ref="inputRef"
      class="dropzone-input"
      data-testid="publish-file-input"
      type="file"
      :accept="accept"
      multiple
      :disabled="disabled"
      @change="onChange"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const props = withDefaults(defineProps<{
  disabled?: boolean
  accept?: string
  maxFiles?: number
}>(), {
  disabled: false,
  accept: '',
  maxFiles: 50,
})

const emit = defineEmits<{
  'files-added': [files: File[]]
  reject: [reason: string]
}>()

const inputRef = ref<HTMLInputElement | null>(null)
const isDragOver = ref(false)

function openPicker(): void {
  if (props.disabled) return
  inputRef.value?.click()
}

function onDragOver(): void {
  if (props.disabled) return
  isDragOver.value = true
}

function onDragLeave(): void {
  isDragOver.value = false
}

function onDrop(e: DragEvent): void {
  isDragOver.value = false
  if (props.disabled) return
  const files = Array.from(e.dataTransfer?.files ?? [])
  accept_(files)
}

function onChange(e: Event): void {
  const target = e.target as HTMLInputElement
  accept_(Array.from(target.files ?? []))
  target.value = ''
}

function accept_(files: File[]): void {
  const seen = new Set<string>()
  const unique = files.filter(f => {
    const key = `${f.name}:${f.size}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  if (unique.length > props.maxFiles) {
    emit('reject', `最多 ${props.maxFiles} 个文件`)
    emit('files-added', unique.slice(0, props.maxFiles))
    return
  }
  emit('files-added', unique)
}
</script>

<style scoped>
.file-dropzone {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-1);
  padding: var(--space-5);
  border: 2px dashed var(--c-border-strong);
  border-radius: var(--radius-lg);
  background: var(--c-surface-lower);
  color: var(--c-text-secondary);
  cursor: pointer;
  text-align: center;
  transition: border-color var(--transition-fast), background var(--transition-fast);
}

.file-dropzone:hover,
.file-dropzone.is-dragover {
  border-color: var(--c-accent);
  background: var(--c-surface);
}

.file-dropzone:focus-visible {
  outline: 2px solid var(--c-accent-secondary);
  outline-offset: 2px;
}

.file-dropzone.is-disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.dropzone-title {
  margin: 0;
  font-size: var(--font-sm);
  color: var(--c-text);
}

.dropzone-hint {
  margin: 0;
  font-size: var(--font-xs);
  color: var(--c-text-tertiary);
}

.dropzone-input {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
</style>
