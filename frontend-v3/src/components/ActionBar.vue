<template>
  <div class="action-bar">
    <button
      v-if="canCopy"
      class="btn btn-sm"
      :class="{ 'btn-secondary': variant === 'desktop' }"
      @click="$emit('copy')"
    >
      {{ variant === 'mobile' ? '📋' : '' }} Copy
    </button>

    <a
      v-if="canDownload && downloadUrl"
      :href="downloadUrl"
      download
      class="btn btn-sm"
      :class="{ 'btn-secondary': variant === 'desktop' }"
    >
      {{ variant === 'mobile' ? '⬇️' : '' }} Download
    </a>

    <a
      v-if="canPack && packUrl"
      :href="packUrl"
      download
      class="btn btn-sm"
      :class="{ 'btn-secondary': variant === 'desktop' }"
    >
      {{ variant === 'mobile' ? '📦' : '' }} Pack
    </a>

    <button
      v-if="canWrap"
      class="btn btn-sm"
      :class="{ active: wrap, 'btn-secondary': variant === 'desktop' && !wrap }"
      @click="$emit('toggle-wrap')"
    >
      {{ variant === 'mobile' ? '↩️' : '' }} Wrap
    </button>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  canCopy: boolean
  canDownload: boolean
  canWrap: boolean
  canPack: boolean
  wrap: boolean
  downloadUrl?: string
  packUrl?: string
  variant: 'desktop' | 'mobile'
}>()

defineEmits<{
  copy: []
  'toggle-wrap': []
}>()
</script>

<style scoped>
.action-bar { display: flex; gap: var(--space-2); align-items: center; }
.action-bar .btn { white-space: nowrap; }
</style>
