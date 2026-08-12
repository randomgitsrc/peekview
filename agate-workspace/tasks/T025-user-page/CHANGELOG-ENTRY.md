### Added
- `/users/:username` route — public user entry listing page with banner header
- `list_entries` API: `owner=username` query param (case-insensitive lookup via `func.lower`)
- `EntryListResponse.owner_found` tri-state field (None=not applicable, True=user exists, False=not found)
- `BannerBar` component — shows "@username's entries" with "Back to Home" link
- `FilterChip` component — dismissible filter indicator (reusable for search filter chips)

### Changed
- EntryListView: `owner` prop drives three-state UI (banner mode / chip mode / tab mode)
- Entry card `@username` is now a clickable `<router-link>` navigating to user page (clicking own username navigates to `/explore?owner=me`)
- EntryListView tab switching syncs to URL via `router.replace` (`/explore?owner=me` shareable)
- Entry card wrapper changed from `<router-link>` to `<div @click>` — fixes nested `<a>` HTML violation
