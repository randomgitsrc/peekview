import { ref } from 'vue'
import { defineStore } from 'pinia'
import { api } from '@/api/client'
import type { ShareInfo } from '@/types'

export const useShareStore = defineStore('share', () => {
  const shares = ref<ShareInfo[]>([])
  const loading = ref(false)
  const shareUrlCache = ref<Map<number, string>>(new Map())

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
    const result = await api.createShare(slug, { expires_in: expiresIn, max_views: maxViews ?? null })
    shareUrlCache.value.set(result.id, result.shareUrl)
    await fetchShares(slug)
    return result
  }

  async function revokeShares(slug: string, shareIds: number[]) {
    await api.revokeShares(slug, { share_ids: shareIds })
    await fetchShares(slug)
  }

  function getShareUrl(shareId: number): string | null {
    return shareUrlCache.value.get(shareId) ?? null
  }

  return { shares, loading, shareUrlCache, fetchShares, createShare, revokeShares, getShareUrl }
})
