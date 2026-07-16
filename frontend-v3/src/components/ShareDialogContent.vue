<script setup lang="ts">
import { ref, computed } from 'vue'
import { useShareStore } from '@/stores/share'

const props = defineProps<{
  entrySlug: string
}>()

const emit = defineEmits<{
  close: []
}>()

const currentView = ref<'list' | 'create'>('list')

defineExpose({ currentView })
</script>

<template>
  <div data-testid="share-content">
    <!-- TDD stub: implementation in P4 -->
  </div>
</template>
