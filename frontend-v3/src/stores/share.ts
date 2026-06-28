import { ref } from 'vue'
import { defineStore } from 'pinia'
import { api } from '@/api/client'
import type { ShareInfo } from '@/types'

export const useShareStore = defineStore('share', () => {
  const shares = ref<ShareInfo[]>([])
  const loading = ref(false)

  async function fetchShares(slug: string) {
    loading.value = true
    try {
      const response = await api.listShares(slug)
      shares.value = response.shares
    } finally {
      loading.value = false
    }
  }

  async function createShare(slug: string, expiresIn: string, maxViews?: number) {
    return api.createShare(slug, { expires_in: expiresIn, max_views: maxViews ?? null })
  }

  async function revokeShares(slug: string, shareIds: number[]) {
    await api.revokeShares(slug, { share_ids: shareIds })
    await fetchShares(slug)
  }

  return { shares, loading, fetchShares, createShare, revokeShares }
})
