import { ref } from 'vue'
import { defineStore } from 'pinia'
import { api } from '@/api/client'
import type { StarItem, StarListParams } from '@/types'

export const useStarStore = defineStore('star', () => {
  const items = ref<StarItem[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function load(params?: StarListParams): Promise<void> {
    loading.value = true
    error.value = null
    try {
      const response = await api.listStars(params)
      items.value = response.items
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load stars'
    } finally {
      loading.value = false
    }
  }

  async function remove(ids: number[]): Promise<void> {
    await api.removeStars(ids)
  }

  function removeLocally(ids: number[]): void {
    items.value = items.value.filter(i => !ids.includes(i.id))
  }

  return { items, loading, error, load, remove, removeLocally }
})
