<template>
  <span class="base-tag"><slot /></span>
</template>

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
</style>
