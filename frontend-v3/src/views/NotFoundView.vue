<template>
  <div class="not-found">
    <h1>Page not found</h1>
    <p class="path">{{ route.path }}</p>
    <router-link to="/" class="home-link">返回首页</router-link>
  </div>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router'
const route = useRoute()
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
}
.not-found h1 {
  font-size: var(--font-xl);
  color: var(--text-primary);
  margin-bottom: var(--space-2);
}
.path {
  font-size: var(--font-md);
  color: var(--text-secondary);
  font-family: var(--font-mono);
  margin-bottom: var(--space-6);
}
.home-link {
  color: var(--accent-color);
  text-decoration: none;
  font-size: var(--font-md);
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-color);
  transition: all var(--transition-fast);
}

.home-link:hover {
  background: var(--accent-light);
  border-color: var(--accent-color);
}
</style>
