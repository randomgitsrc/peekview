<template>
  <div class="table-view">
    <TruncationBanner
      v-if="parsed.truncated"
      :message="`数据量过大，已显示前 ${MAX_ROWS.toLocaleString()} 行`"
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
        <select class="per-page-select" :value="perPage" @change="onPerPageChange" aria-label="Rows per page">
          <option :value="50">50</option>
          <option :value="100">100</option>
          <option :value="500">500</option>
        </select>
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
import { ref, shallowRef, computed, watch } from 'vue'
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

const MAX_ROWS = 50000

const props = withDefaults(defineProps<{
  content: string
  delimiter?: ',' | '\t'
  filename: string
  downloadFn: () => void
}>(), {
  delimiter: ',',
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

const table = useVueTable({
  get data() {
    return parsed.value.rows
  },
  get columns() {
    return columns.value
  },
  getCoreRowModel: getCoreRowModel(),
  getSortedRowModel: getSortedRowModel(),
  getFilteredRowModel: getFilteredRowModel(),
})

const page = ref(1)
const perPage = ref(100)

const totalCount = computed(() => table.getRowModel().rows.length)

const pageRows = computed<Row<CsvRow>[]>(() => {
  if (parsed.value.truncated) return []
  const rows = table.getRowModel().rows
  const totalPages = Math.max(1, Math.ceil(rows.length / perPage.value))
  const current = Math.min(page.value, totalPages)
  const start = (current - 1) * perPage.value
  return rows.slice(start, start + perPage.value)
})

watch(
  () => props.content,
  () => {
    parsed.value = { headers: [], rows: [], totalRows: 0, truncated: false }
    page.value = 1
    try {
      parsed.value = parseCsv(props.content, props.delimiter)
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

function onPerPageChange(event: Event) {
  perPage.value = Number((event.target as HTMLSelectElement).value)
  page.value = 1
}

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

.per-page-select {
  padding: var(--space-1) var(--space-2);
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-size: var(--font-sm);
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

  .per-page-select {
    width: 100%;
  }

  .th-filter {
    display: none;
  }
}
</style>
