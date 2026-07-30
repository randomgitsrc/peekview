<template>
  <BaseButton :variant="resolvedVariant" size="small" @click="$emit('sign-in')">Sign in</BaseButton>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import BaseButton from '@/components/BaseButton.vue'

const props = defineProps<{
  pageType: 'marketing' | 'functional'
  mobileOverride?: string
}>()

defineEmits<{
  'sign-in': []
}>()

const internalIsMobile = ref(false)

let mql: MediaQueryList | null = null
function onMediaChange(e: MediaQueryListEvent) {
  internalIsMobile.value = e.matches
}

if (typeof globalThis !== 'undefined' && globalThis.matchMedia) {
  mql = globalThis.matchMedia('(max-width: 640px)')
  internalIsMobile.value = mql.matches
}

onMounted(() => {
  if (mql) {
    mql.addEventListener('change', onMediaChange)
  }
})

onUnmounted(() => {
  if (mql) {
    mql.removeEventListener('change', onMediaChange)
  }
})

const resolvedVariant = computed(() => {
  if (props.pageType === 'marketing') return 'primary'
  const mobile = props.mobileOverride !== undefined
    ? props.mobileOverride === 'true'
    : internalIsMobile.value
  return mobile ? 'ghost' : 'secondary'
})
</script>
