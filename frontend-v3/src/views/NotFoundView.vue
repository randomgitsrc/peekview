<template>
  <div class="not-found">
    <h1>Page not found</h1>
    <p class="path">{{ route.path }}</p>
    <BaseButton variant="secondary" @click="router.push('/')">返回首页</BaseButton>
  </div>
</template>

<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'
import BaseButton from '@/components/BaseButton.vue'
const route = useRoute()
const router = useRouter()
</script>

<style scoped>
.not-found {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: var(--space-4);
  text-align: center;
  background: var(--c-bg);
}
.not-found h1 {
  font-size: var(--font-xl);
  color: var(--c-text);
  margin-bottom: var(--space-2);
}
.path {
  font-size: var(--font-md);
  color: var(--c-text-secondary);
  font-family: var(--font-mono);
  margin-bottom: var(--space-6);
}
</style>
