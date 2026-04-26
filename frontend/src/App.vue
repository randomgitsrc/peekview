<template>
  <div class="app">
    <router-view />
    <Toast />
  </div>
</template>

<script setup lang="ts">
import Toast from './components/ui/Toast.vue'
</script>

<style scoped>
.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
  color: var(--text-primary);
  overflow-y: auto; /* Enable page scrolling */
}
</style>
