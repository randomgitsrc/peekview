<script setup lang="ts">
import ShareDialogContent from '@/components/ShareDialogContent.vue'

const props = defineProps<{
  entrySlug: string
  variant: 'popover' | 'sheet'
}>()

const isOpen = ref(false)
</script>

<template>
  <div>
    <!-- TDD stub: implementation in P4 -->
  </div>
</template>

<script lang="ts">
import { ref } from 'vue'
</script>
