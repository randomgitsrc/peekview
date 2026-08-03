<template>
  <div class="table-view">
    <TruncationBanner
      v-if="parsed.truncated"
      :message="`数据量过大，已显示前 ${props.maxRows.toLocaleString()} 行`"
      :download-fn="downloadFn"
    />

    <div v-if="parsed.headers.length === 0 && parsed.rows.length === 0" class="no-data">
      <span>无数据</span>
    </div>

    <template v-else>
      <div class="table-scroll" style="overflow-x: auto">
        <table>
          <thead>
            <tr v-for="headerGroup in table.getHeaderGroups()" :key="headerGroup.id">
              <th
                v-for="header in headerGroup.headers"
                :key="header.id"
                :aria-sort="sortAttr(header.column.getIsSorted())"
              >
                <button
                  type="button"
                  class="th-sort-btn"
                  @click="header.column.toggleSorting()"
                >
                  <span class="th-label">{{ header.column.columnDef.header }}</span>
                  <span v-if="header.column.getIsSorted()" class="sort-indicator">
                    {{ header.column.getIsSorted() === 'asc' ? '↑' : '↓' }}
                  </span>
                </button>
                <input
                  class="th-filter"
                  :aria-label="`Filter ${header.column.id}`"
                  :value="(header.column.getFilterValue() as string) ?? ''"
                  @input="header.column.setFilterValue(($event.target as HTMLInputElement).value)"
                  @click.stop
                />
              </th>
            </tr>
          </thead>
          <tbody>
            <template v-if="parsed.truncated">
              <tr v-for="(row, rowIndex) in parsed.rows" :key="`t-${rowIndex}`">
                <td v-for="(cell, cellIndex) in row" :key="cellIndex">{{ cell }}</td>
              </tr>
            </template>
            <template v-else>
              <tr v-for="row in pageRows" :key="row.id">
                <td v-for="cell in row.getVisibleCells()" :key="cell.id">
                  {{ cell.getValue() }}
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>

      <div class="table-controls" v-if="!parsed.truncated">
        <div class="per-page-wrapper" ref="perPageWrapper">
          <button
            type="button"
            class="per-page-trigger"
            :aria-haspopup="'listbox'"
            :aria-expanded="perPageOpen"
            @click="togglePerPage"
            @keydown="onTriggerKeydown"
          >
            <span>{{ perPage }}/page</span>
            <span class="per-page-arrow" :class="{ 'arrow-open': perPageOpen }">&#9662;</span>
          </button>
          <ul
            v-if="perPageOpen"
            class="per-page-listbox"
            role="listbox"
            @keydown="onListboxKeydown"
          >
            <li
              v-for="opt in perPageOptions"
              :key="opt"
              role="option"
              :data-value="opt"
              :aria-selected="perPage === opt"
              :class="{ 'option-active': perPage === opt, 'option-focused': focusedIndex === perPageOptions.indexOf(opt) }"
              tabindex="0"
              @click="selectPerPage(opt)"
              @keydown.enter.prevent.stop="selectPerPage(opt)"
            >
              {{ opt }}
            </li>
          </ul>
        </div>
        <Pagination
          :page="page"
          :per-page="perPage"
          :total="totalCount"
          @update:page="onPageChange"
        />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, shallowRef, computed, watch, onMounted, onUnmounted } from 'vue'
import {
  useVueTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
} from '@tanstack/vue-table'
import type { ColumnDef, Row } from '@tanstack/vue-table'
import Pagination from '@/components/Pagination.vue'
import TruncationBanner from '@/components/TruncationBanner.vue'
import { parseCsv } from '@/composables/useCsvParser'
import type { CsvParseResult } from '@/types/structured-data'

const props = withDefaults(defineProps<{
  content: string
  delimiter?: ',' | '\t'
  filename: string
  downloadFn: () => void
  maxRows?: number
}>(), {
  delimiter: ',',
  maxRows: 50000,
})

const emit = defineEmits<{
  'parse-error': [message: string]
}>()

type CsvRow = string[]

const parsed = shallowRef<CsvParseResult>({ headers: [], rows: [], totalRows: 0, truncated: false })

const columns = computed<ColumnDef<CsvRow>[]>(() =>
  parsed.value.headers.map((headerName, index) => ({
    id: headerName || `col${index}`,
    accessorFn: (row: CsvRow) => row[index] ?? '',
    header: headerName,
    cell: info => String(info.getValue()),
    filterFn: 'includesString',
  })),
)

const page = ref(1)
const perPage = ref(100)

const totalCount = computed(() => parsed.value.rows.length)
const totalPages = computed(() => Math.max(1, Math.ceil(totalCount.value / perPage.value)))

const pagedData = computed<CsvRow[]>(() => {
  if (parsed.value.truncated) return []
  const current = Math.min(page.value, totalPages.value)
  const start = (current - 1) * perPage.value
  return parsed.value.rows.slice(start, start + perPage.value)
})

const table = useVueTable({
  get data() {
    return pagedData.value
  },
  get columns() {
    return columns.value
  },
  getCoreRowModel: getCoreRowModel(),
  getSortedRowModel: getSortedRowModel(),
  getFilteredRowModel: getFilteredRowModel(),
})

const perPageOpen = ref(false)
const focusedIndex = ref(0)
const perPageOptions = [50, 100, 500] as const
const perPageWrapper = ref<HTMLElement>()

const pageRows = computed<Row<CsvRow>[]>(() => table.getRowModel().rows)

watch(
  () => props.content,
  () => {
    parsed.value = { headers: [], rows: [], totalRows: 0, truncated: false }
    page.value = 1
    try {
      parsed.value = parseCsv(props.content, props.delimiter, props.maxRows)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      emit('parse-error', message)
    }
  },
  { immediate: true },
)

function onPageChange(newPage: number) {
  page.value = newPage
}

function togglePerPage() {
  perPageOpen.value = !perPageOpen.value
  if (perPageOpen.value) {
    focusedIndex.value = perPageOptions.indexOf(perPage.value as 50 | 100 | 500)
    if (focusedIndex.value < 0) focusedIndex.value = 0
  }
}

function selectPerPage(value: number) {
  perPage.value = value
  page.value = 1
  perPageOpen.value = false
}

function onTriggerKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
    event.preventDefault()
    if (!perPageOpen.value) {
      perPageOpen.value = true
      focusedIndex.value = perPageOptions.indexOf(perPage.value as 50 | 100 | 500)
      if (focusedIndex.value < 0) focusedIndex.value = 0
    }
  } else if (event.key === 'ArrowDown' && perPageOpen.value) {
    event.preventDefault()
    focusedIndex.value = Math.min(focusedIndex.value + 1, perPageOptions.length - 1)
  } else if (event.key === 'ArrowUp' && perPageOpen.value) {
    event.preventDefault()
    focusedIndex.value = Math.max(focusedIndex.value - 1, 0)
  } else if (event.key === 'Escape' && perPageOpen.value) {
    event.preventDefault()
    perPageOpen.value = false
  }
}

function onListboxKeydown(event: KeyboardEvent) {
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    focusedIndex.value = Math.min(focusedIndex.value + 1, perPageOptions.length - 1)
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    focusedIndex.value = Math.max(focusedIndex.value - 1, 0)
  } else if (event.key === 'Enter') {
    event.preventDefault()
    selectPerPage(perPageOptions[focusedIndex.value])
  } else if (event.key === 'Escape') {
    event.preventDefault()
    perPageOpen.value = false
  }
}

function onDocumentClick(event: MouseEvent) {
  if (perPageWrapper.value && !perPageWrapper.value.contains(event.target as Node)) {
    perPageOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', onDocumentClick)
})

onUnmounted(() => {
  document.removeEventListener('click', onDocumentClick)
})

function sortAttr(sort: false | 'asc' | 'desc'): 'ascending' | 'descending' | undefined {
  if (sort === 'asc') return 'ascending'
  if (sort === 'desc') return 'descending'
  return undefined
}
</script>

<style scoped>
.table-view {
  min-width: 0;
}

.table-scroll {
  overflow-x: auto;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
}

.table-scroll table {
  border-collapse: collapse;
  width: 100%;
  font-size: var(--font-sm);
}

.table-scroll thead th {
  position: sticky;
  top: 0;
  background: var(--bg-secondary);
  color: var(--text-primary);
  text-align: left;
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid var(--border-color);
  white-space: nowrap;
  user-select: none;
}

.table-scroll thead th:hover {
  background: var(--bg-tertiary);
}

.th-sort-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  width: 100%;
  background: none;
  border: none;
  padding: 0;
  font: inherit;
  color: inherit;
  cursor: pointer;
  text-align: left;
}

.th-sort-btn:focus-visible {
  outline: 2px solid var(--accent-hover);
  outline-offset: 2px;
}

.th-label {
  font-weight: 600;
}

.sort-indicator {
  color: var(--accent-color);
  font-size: var(--font-xs);
}

.th-filter {
  display: block;
  width: 100%;
  margin-top: var(--space-1);
  padding: var(--space-1) var(--space-2);
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-size: var(--font-xs);
}

.th-filter:focus {
  outline: none;
  border-color: var(--accent-color);
}

.table-scroll tbody td {
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid var(--border-color);
  white-space: nowrap;
}

.table-scroll tbody tr:last-child td {
  border-bottom: none;
}

.table-scroll tbody tr:hover {
  background: var(--bg-tertiary);
}

.table-controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  margin-top: var(--space-3);
  flex-wrap: wrap;
}

.per-page-wrapper {
  position: relative;
  display: inline-block;
}

.per-page-trigger {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  min-height: 44px;
  padding: var(--space-2) var(--space-3);
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-size: var(--font-sm);
  cursor: pointer;
  transition: border-color 0.15s;
}

.per-page-trigger:hover {
  border-color: var(--accent-color);
}

.per-page-trigger:focus-visible {
  outline: 2px solid var(--accent-hover);
  outline-offset: 2px;
}

.per-page-arrow {
  font-size: 10px;
  transition: transform 0.15s;
}

.per-page-arrow.arrow-open {
  transform: rotate(180deg);
}

.per-page-listbox {
  position: absolute;
  top: 100%;
  left: 0;
  margin-top: 4px;
  min-width: 100%;
  list-style: none;
  padding: 0;
  margin-bottom: 0;
  background: var(--c-surface);
  border: 1px solid var(--c-border-strong);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.16);
  z-index: 200;
}

.per-page-listbox li {
  min-height: 44px;
  display: flex;
  align-items: center;
  padding: var(--space-2) var(--space-3);
  font-size: var(--font-sm);
  color: var(--c-text);
  cursor: pointer;
  transition: background 0.15s;
}

.per-page-listbox li:hover,
.per-page-listbox li.option-focused {
  background: var(--c-surface-lower);
}

.per-page-listbox li.option-active {
  font-weight: 600;
  color: var(--accent-color);
}

.per-page-listbox li:focus-visible {
  outline: 2px solid var(--c-accent);
  outline-offset: -2px;
}

.no-data {
  padding: var(--space-6);
  text-align: center;
  color: var(--text-secondary);
  font-size: var(--font-sm);
}

@media (max-width: 640px) {
  .table-controls {
    flex-direction: column;
    align-items: stretch;
  }

  .per-page-wrapper {
    width: 100%;
  }

  .per-page-trigger {
    width: 100%;
    justify-content: center;
  }

  .th-filter {
    display: none;
  }
}
</style>
