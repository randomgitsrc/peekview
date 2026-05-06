<template>
  <div class="pagination">
    <!-- 上一页 -->
    <button
      class="page-btn"
      :disabled="page <= 1"
      @click="goToPage(page - 1)"
    >
      Prev
    </button>

    <!-- 页码列表 -->
    <div class="page-numbers">
      <button
        v-for="pageNum in visiblePages"
        :key="pageNum"
        class="page-num"
        :class="{ active: pageNum === page }"
        @click="goToPage(pageNum)"
      >
        {{ pageNum }}
      </button>
    </div>

    <!-- 下一页 -->
    <button
      class="page-btn"
      :disabled="page >= totalPages"
      @click="goToPage(page + 1)"
    >
      Next
    </button>

    <!-- 快速跳转 -->
    <div class="page-jumper">
      <span>Go to</span>
      <input
        v-model="jumpPage"
        type="number"
        min="1"
        :max="totalPages"
        class="page-input"
        @keyup.enter="handleJump"
      >
      <span>/ {{ totalPages }}</span>
      <button class="page-btn jump-btn" @click="handleJump">Go</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

interface Props {
  page: number
  perPage: number
  total: number
  maxVisible?: number  // 最多显示的页码数
}

const props = withDefaults(defineProps<Props>(), {
  maxVisible: 7
})

const emit = defineEmits<{
  'update:page': [page: number]
}>()

const jumpPage = ref('')

const totalPages = computed(() => Math.max(1, Math.ceil(props.total / props.perPage)))

// 计算可见的页码列表
const visiblePages = computed(() => {
  const total = totalPages.value
  const current = props.page
  const max = props.maxVisible

  if (total <= max) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }

  // 计算左右显示的页码数
  const half = Math.floor(max / 2)
  let start = current - half
  let end = current + half

  if (start < 1) {
    start = 1
    end = max
  }

  if (end > total) {
    end = total
    start = total - max + 1
  }

  const pages: (number | string)[] = []

  // 第一页
  if (start > 1) {
    pages.push(1)
    if (start > 2) pages.push('...')
  }

  // 中间页码
  for (let i = start; i <= end; i++) {
    pages.push(i)
  }

  // 最后一页
  if (end < total) {
    if (end < total - 1) pages.push('...')
    pages.push(total)
  }

  return pages.filter((p): p is number => typeof p === 'number')
})

function goToPage(newPage: number) {
  if (newPage >= 1 && newPage <= totalPages.value) {
    emit('update:page', newPage)
  }
}

function handleJump() {
  const page = parseInt(jumpPage.value)
  if (page >= 1 && page <= totalPages.value) {
    goToPage(page)
    jumpPage.value = ''
  }
}
</script>

<style scoped>
.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
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

/* 页码列表 */
.page-numbers {
  display: flex;
  gap: var(--space-1);
}

.page-num {
  min-width: 36px;
  height: 36px;
  padding: 0 var(--space-2);
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  cursor: pointer;
  font-size: var(--font-sm);
  transition: all var(--transition-fast);
}

.page-num:hover:not(.active) {
  background: var(--bg-tertiary);
  border-color: var(--border-hover);
}

.page-num.active {
  background: var(--accent-color);
  border-color: var(--accent-color);
  color: var(--text-on-accent);
  cursor: default;
}

/* 快速跳转 */
.page-jumper {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--font-sm);
  color: var(--text-secondary);
}

.page-input {
  width: 60px;
  padding: var(--space-1) var(--space-2);
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-size: var(--font-sm);
  text-align: center;
}

.page-input:focus {
  outline: none;
  border-color: var(--accent-color);
}

/* 移除 number input 的箭头 */
.page-input::-webkit-inner-spin-button,
.page-input::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.jump-btn {
  padding: var(--space-1) var(--space-3);
}

/* 移动端适配 */
@media (max-width: 640px) {
  .pagination {
    gap: var(--space-2);
  }

  .page-numbers {
    order: -1;
    width: 100%;
    justify-content: center;
  }

  .page-jumper {
    width: 100%;
    justify-content: center;
    margin-top: var(--space-2);
  }
}
</style>
