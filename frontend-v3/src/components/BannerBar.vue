<template>
  <div class="banner-bar">
    <router-link to="/explore" class="banner-back">
      <span class="banner-back-arrow">&larr;</span>
      <span>Back to Home</span>
    </router-link>
    <h1 class="banner-title">
      <span class="banner-at">@</span>{{ username }}<span class="banner-apos">'s</span> entries
    </h1>
  </div>
</template>

<script setup lang="ts">
defineProps<{ username: string }>()
</script>

<style scoped>
.banner-bar {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-4) var(--space-5);
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
}

.banner-back {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--font-sm);
  color: var(--text-secondary);
  text-decoration: none;
  white-space: nowrap;
}

.banner-back:hover { color: var(--accent-color); }

.banner-title {
  margin: 0 auto;
  font-size: var(--font-xl);
  font-weight: 700;
  color: var(--text-primary);
  text-align: center;
}

@media (max-width: 480px) {
  .banner-bar {
    flex-direction: column;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-4);
    text-align: center;
  }
  .banner-back {
    align-self: flex-start;
    padding: var(--space-1) 0;
    min-height: 44px;
    align-items: center;
  }
  .banner-title {
    font-size: var(--font-lg);
    margin: 0;
  }
}

@media (max-width: 360px) {
  .banner-bar { padding: var(--space-2) var(--space-3); }
  .banner-title { font-size: var(--font-md); }
}
</style>
