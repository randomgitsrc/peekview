<template>
  <div class="app">
    <router-view />
  </div>
</template>

<script setup lang="ts">
// App root
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
