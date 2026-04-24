<template>
  <div class="skeleton" :style="{ width, height }">
    <div class="skeleton-pulse"></div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  width?: string
  height?: string
}
defineProps<Props>()
</script>

<style scoped>
.skeleton {
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.skeleton-pulse {
  width: 100%;
  height: 100%;
  background: linear-gradient(
    90deg,
    var(--bg-secondary) 25%,
    var(--bg-tertiary) 50%,
    var(--bg-secondary) 75%
  );
  background-size: 200% 100%;
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
</style>
