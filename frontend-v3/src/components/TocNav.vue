<template>
  <nav v-if="headings.length > 0" class="toc-nav">
    <h3 class="toc-title">On this page</h3>
    <ul class="toc-list">
      <li
        v-for="heading in headings"
        :key="heading.id"
        :class="['toc-item', `toc-level-${heading.level}`, { active: activeId === heading.id }]"
      >
        <a :href="`#${heading.id}`" @click.prevent="scrollTo(heading.id)">
          {{ heading.text }}
        </a>
      </li>
    </ul>
  </nav>
</template>

<script setup lang="ts">
import type { TocHeading } from '@/types'

defineProps<{
  headings: TocHeading[]
  activeId: string | null
}>()

function scrollTo(id: string) {
  const element = document.getElementById(id)
  if (element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}
</script>

<style scoped>
.toc-nav { padding: var(--space-4); font-size: var(--font-sm); }
.toc-title { font-size: var(--font-xs); font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-tertiary); margin-bottom: var(--space-3); padding-bottom: var(--space-2); border-bottom: 1px solid var(--border-color); }
.toc-list { list-style: none; padding: 0; margin: 0; }
.toc-item { margin: var(--space-1) 0; }
.toc-item a { display: block; padding: var(--space-1) var(--space-2); color: var(--text-secondary); text-decoration: none; border-radius: var(--radius-sm); border-left: 2px solid transparent; transition: all var(--transition-fast); }
.toc-item a:hover { background: var(--bg-tertiary); color: var(--text-primary); }
.toc-item.active a { color: var(--accent-color); border-left-color: var(--accent-color); background: var(--accent-light); }
.toc-level-2 { padding-left: 0; }
.toc-level-3 { padding-left: var(--space-3); }
.toc-level-4 { padding-left: var(--space-6); }
</style>
