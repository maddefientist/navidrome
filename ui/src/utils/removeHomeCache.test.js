import { afterEach, describe, expect, it, vi } from 'vitest'
import { removeHomeCache } from './removeHomeCache'

describe('removeHomeCache', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    delete window.caches
  })

  it('is a quiet no-op when CacheStorage is unavailable on an HTTP LAN origin', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(removeHomeCache()).resolves.toBeUndefined()
    expect(consoleError).not.toHaveBeenCalled()
  })

  it('removes the cached app index when CacheStorage is available', async () => {
    const indexRequest = { url: 'http://navidrome.test/app/index.html' }
    const deleteEntry = vi.fn().mockResolvedValue(true)
    window.caches = {
      keys: vi.fn().mockResolvedValue(['workbox-precache-v1']),
      open: vi.fn().mockResolvedValue({
        keys: vi.fn().mockResolvedValue([indexRequest]),
        delete: deleteEntry,
      }),
    }

    await removeHomeCache()

    expect(window.caches.open).toHaveBeenCalledWith('workbox-precache-v1')
    expect(deleteEntry).toHaveBeenCalledWith(indexRequest)
  })
})
