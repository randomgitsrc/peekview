<template>
  <section class="publish-result" data-testid="publish-result" role="status" aria-live="polite">
    <h2 ref="titleRef" class="result-title" tabindex="-1">发布成功</h2>

    <div class="result-link-block">
      <span class="result-link-label">页面链接</span>
      <span class="result-link-value" data-testid="publish-page-link">{{ result.pageLink }}</span>
      <button
        type="button"
        class="result-copy"
        data-testid="publish-copy-page"
        @click="copy(result.pageLink, 'page')"
      >{{ copiedTarget === 'page' ? '已复制' : '复制' }}</button>
    </div>

    <div class="result-link-block">
      <span class="result-link-label">Raw 链接（给 Agent 用，免认证可读）</span>
      <span class="result-link-value" data-testid="publish-raw-link">{{ result.rawLink }}</span>
      <button
        type="button"
        class="result-copy"
        data-testid="publish-copy-raw"
        @click="copy(result.rawLink, 'raw')"
      >{{ copiedTarget === 'raw' ? '已复制' : '复制' }}</button>
    </div>

    <p v-if="result.expiresAt" class="result-expiry">过期时间：{{ formattedExpiry }}</p>

    <div class="result-actions">
      <BaseButton variant="primary" data-testid="publish-view-detail" @click="emit('view-detail')">查看详情</BaseButton>
      <BaseButton variant="secondary" data-testid="publish-again" @click="emit('publish-again')">再发一个</BaseButton>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import BaseButton from '@/components/BaseButton.vue'
import { useToast } from '@/composables/useToast'
import type { PublishResult } from '@/types'

const props = defineProps<{
  result: PublishResult
}>()

const emit = defineEmits<{
  'view-detail': []
  'publish-again': []
}>()

const toast = useToast()
const copiedTarget = ref<'page' | 'raw' | null>(null)

const formattedExpiry = computed(() => {
  if (!props.result.expiresAt) return ''
  return new Date(props.result.expiresAt).toLocaleString()
})

async function copy(text: string, target: 'page' | 'raw'): Promise<void> {
  try {
    await navigator.clipboard.writeText(text)
    copiedTarget.value = target
    setTimeout(() => {
      if (copiedTarget.value === target) copiedTarget.value = null
    }, 2000)
  } catch {
    toast.error('复制失败，请手动选择')
  }
}
</script>

<style scoped>
.publish-result {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: var(--space-5);
  border: 1px solid var(--c-border-strong);
  border-radius: var(--radius-lg);
  background: var(--c-surface);
}

.result-title {
  margin: 0;
  font-size: var(--font-lg);
  color: var(--c-text);
}

.result-title:focus-visible {
  outline: 2px solid var(--c-accent-secondary);
  outline-offset: 2px;
}

.result-link-block {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding: var(--space-3);
  border: 1px solid var(--c-border);
  border-radius: var(--radius-md);
  background: var(--c-surface-lower);
}

.result-link-label {
  font-size: var(--font-xs);
  color: var(--c-text-secondary);
}

.result-link-value {
  font-family: var(--font-mono);
  font-size: var(--font-sm);
  color: var(--c-text);
  overflow-wrap: anywhere;
  word-break: break-all;
}

.result-copy {
  align-self: flex-start;
  margin-top: var(--space-1);
  min-height: 44px;
  padding: 8px 16px;
  border-radius: var(--radius-md);
  border: 1px solid var(--c-border-strong);
  background: transparent;
  color: var(--c-text);
  font-size: var(--font-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.result-copy:hover {
  background: var(--c-border);
}

.result-expiry {
  margin: 0;
  font-size: var(--font-xs);
  color: var(--c-text-tertiary);
}

.result-actions {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
}

@media (max-width: 640px) {
  .result-actions {
    flex-direction: column;
  }

  .result-actions :deep(.base-button) {
    width: 100%;
    min-height: 44px;
  }
}
</style>
