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
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
  color: var(--text-primary);
}
</style>
