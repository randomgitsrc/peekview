<template>
  <div class="pagination">
    <button
      class="page-btn"
      :disabled="page <= 1"
      @click="goToPage(page - 1)"
    >
      Prev
    </button>

    <span class="page-info">
      Page {{ page }} of {{ totalPages }}
    </span>

    <button
      class="page-btn"
      :disabled="page >= totalPages"
      @click="goToPage(page + 1)"
    >
      Next
    </button>
  </div>
</template>

<script setup lang="ts">
interface Props {
  page: number
  perPage: number
  total: number
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:page': [page: number]
}>()

const totalPages = computed(() => Math.ceil(props.total / props.perPage))

function goToPage(newPage: number) {
  if (newPage >= 1 && newPage <= totalPages.value) {
    emit('update:page', newPage)
  }
}
</script>

<script lang="ts">
import { computed } from 'vue'
</script>

<style scoped>
.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-4);
  padding: var(--space-4);
  margin-top: var(--space-4);
}

.page-btn {
  padding: var(--space-2) var(--space-4);
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  cursor: pointer;
  font-size: var(--font-sm);
  transition: all var(--transition-fast);
}

.page-btn:hover:not(:disabled) {
  background: var(--bg-tertiary);
  border-color: var(--border-hover);
}

.page-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.page-info {
  font-size: var(--font-sm);
  color: var(--text-secondary);
}
</style>
