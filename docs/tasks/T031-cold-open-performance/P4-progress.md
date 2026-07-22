## P4 Progress Log

### Sub-item A: Parallel loading
- stores/entry.ts: loadEntry now accepts optional fileId, fires getEntry + getFileContent concurrently via Promise.all
- EntryDetailView.vue: reads firstFileId from route query, passes to loadEntry, cleans query after
- EntryListView.vue: navigateToEntry passes firstFileId query param

### Sub-item B: Card → real <a>
- EntryCard.vue: .card-body div → <a :href> + @click.prevent; removed role/tabindex/keydown
- EntryListRow.vue: root div → <a :href> + @click.prevent; removed role/tabindex/keydown
- username: router-link → span[role=link] + navigateToUser + @click.stop.prevent + @keydown.enter
- toggle/delete: parent containers use @click.stop.prevent

### Sub-item C: Separator fix
- EntryCard.vue, EntryListRow.vue: .meta-sep inline style font-family: Inter, -apple-system, sans-serif
- EntryListView.vue footer: .separator font-family added

### Sub-item D: Search placeholder
- EntryListView.vue: placeholder="Search titles, tags & content..."

### Sub-item E: Explore → Browse public
- LandingView.vue: two occurrences changed

### Sub-item F: Skeleton
- EntryListView.vue: grid (6 .skeleton-card) + list (6 .skeleton-row) with shimmer animation
- EntryDetailView.vue: header skeleton + content skeleton with shimmer

### Self-check
- vitest: 16/16 passed
- vue-tsc --noEmit: 0 errors
