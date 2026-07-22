P2 progress:
1. Read dispatch-context + P1-requirements + LandingView + EntryListView + router.ts + auth.ts + main.ts
2. Confirmed root cause timing: app.use(router) → beforeEach (authState=loading) → fetchMe → mount
3. Designed 3 candidates: A (watch immediate), B (beforeEach async), C (onMounted)
4. Selected Plan A: watch immediate + Sign in conditional rendering
5. Wrote P2-design.md with full trade-off analysis, BDD mapping, four fields, files_to_read
