<template>
  <div class="search-input-wrapper">
    <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
    <input
      type="text"
      class="search-input"
      :value="modelValue"
      :placeholder="placeholder"
      @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      @keydown="$emit('keydown', $event)"
    />
    <button
      v-if="modelValue"
      type="button"
      class="clear-btn"
      aria-label="Clear"
      @click="$emit('clear'); $emit('update:modelValue', '')"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  modelValue?: string
  placeholder?: string
}>(), {
  modelValue: '',
  placeholder: '搜索标题、标签和文件内容...',
})

defineEmits<{
  'update:modelValue': [value: string]
  clear: []
  keydown: [e: KeyboardEvent]
}>()
</script>

<style scoped>
.search-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  background: var(--c-surface-lower);
  border: 1px solid var(--c-border);
  border-radius: var(--radius-lg);
}

.search-input-wrapper:focus-within {
  border-color: var(--c-accent);
  box-shadow: 0 0 0 3px var(--c-glow);
}

.search-icon {
  position: absolute;
  left: 12px;
  color: var(--c-text-tertiary);
  pointer-events: none;
}

.search-input {
  width: 100%;
  padding: 6px 12px 6px 36px;
  border: none;
  background: transparent;
  color: var(--c-text);
  font-size: var(--font-sm);
  font-family: inherit;
  outline: none;
}

.search-input::placeholder {
  color: var(--c-text-tertiary);
}

.clear-btn {
  position: absolute;
  right: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  color: var(--c-text-tertiary);
  cursor: pointer;
  padding: 4px;
  border-radius: var(--radius-sm);
}

.clear-btn:hover {
  color: var(--c-text);
  background: var(--c-border);
}
</style>
