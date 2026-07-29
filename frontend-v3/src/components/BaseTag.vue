<template>
  <a v-if="href" class="base-tag" :href="href" @click.prevent="$emit('navigate', href)">
    <slot />
  </a>
  <span v-else class="base-tag"><slot /></span>
</template>

<script setup lang="ts">
defineProps<{
  href?: string
}>()

defineEmits<{
  navigate: [href: string]
}>()
</script>

<style scoped>
.base-tag {
  display: inline-flex;
  align-items: center;
  background: var(--c-tag-bg);
  color: var(--c-accent-secondary);
  border-radius: 6px;
  padding: 4px 10px;
  font-size: var(--font-xs);
  font-family: var(--font-mono);
}

a.base-tag {
  text-decoration: none;
  cursor: pointer;
}

a.base-tag:hover {
  text-decoration: underline;
}

a.base-tag:focus-visible {
  outline: 2px solid var(--c-accent-secondary);
  outline-offset: 2px;
  border-radius: 6px;
}
</style>
