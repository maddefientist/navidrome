export const createShuffleSeed = ({
  cryptoProvider = window.crypto,
  now = Date.now,
  random = Math.random,
} = {}) => {
  if (typeof cryptoProvider?.randomUUID === 'function') {
    return cryptoProvider.randomUUID()
  }

  // Web Crypto is unavailable on plain HTTP LAN origins in Safari and some
  // Chromium configurations. This seed only makes a shuffle reproducible; it
  // is not a security token, so a time-and-random fallback is appropriate.
  return `shuffle-${now().toString(36)}-${random().toString(36).slice(2)}`
}
