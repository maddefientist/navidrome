export const removeHomeCache = async () => {
  if (typeof window.caches === 'undefined') {
    return
  }

  try {
    const workboxKey = (await window.caches.keys()).find((key) =>
      key.startsWith('workbox-precache'),
    )
    if (!workboxKey) return

    const workboxCache = await window.caches.open(workboxKey)
    const indexKey = (await workboxCache.keys()).find((key) =>
      key.url.includes('app/index.html'),
    )

    if (indexKey) {
      await workboxCache.delete(indexKey)
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('error reading cache', e)
  }
}
