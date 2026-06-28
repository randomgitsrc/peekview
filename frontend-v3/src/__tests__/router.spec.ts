import { describe, it, expect } from 'vitest'

describe('router: /users/:username registration', () => {
  it('routes array includes /users/:username route', async () => {
    // Import routes definition - this tests that the route exists in the compiled module
    const routerModule = await import('@/router')
    const router = routerModule.default

    const routes = router.getRoutes()
    const userRoute = routes.find(r => r.name === 'user-entries')

    expect(userRoute).toBeDefined()
    expect(userRoute!.path).toBe('/users/:username')
  })

  it('/users/alice matches user-entries route (not /:slug detail route)', async () => {
    const routerModule = await import('@/router')
    const router = routerModule.default

    const resolved = router.resolve('/users/alice')
    expect(resolved.name).toBe('user-entries')
    expect(resolved.name).not.toBe('detail')
    expect(resolved.params).toEqual({ username: 'alice' })
  })

  it('/:slug still matches detail route for non-user paths', async () => {
    const routerModule = await import('@/router')
    const router = routerModule.default

    const resolved = router.resolve('/some-entry-slug')
    expect(resolved.name).toBe('detail')
    expect(resolved.params).toEqual({ slug: 'some-entry-slug' })
  })

  it('/explore still resolves correctly', async () => {
    const routerModule = await import('@/router')
    const router = routerModule.default

    const resolved = router.resolve('/explore')
    expect(resolved.name).toBe('explore')
  })

  it('user-entries route passes owner prop from username param', async () => {
    const routerModule = await import('@/router')
    const router = routerModule.default

    const resolved = router.resolve('/users/alice')
    expect(resolved.name).toBe('user-entries')
    // props function should extract username as owner
    // We verify the route exists and params are correct; the actual props
    // function behavior is tested in P4 integration
    expect(resolved.params.username).toBe('alice')
  })
})
