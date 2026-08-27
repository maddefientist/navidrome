import { createShuffleSeed } from '../common/shuffleSeed'

/**
 * Shared client logic for the authenticated POST /api/mix/preview contract.
 *
 * Frozen wire contract:
 *   request  { mode, seed, limit, artistSpacing, adventure?, libraryIds? }
 *   response { mode, seed, tracks, reasons, degraded }
 *
 * Supported modes: pure_shuffle, rediscover, familiar_fresh. `adventure`
 * (0..100) is only sent for familiar_fresh.
 *
 * The server implementation shipped with this revision answers pure_shuffle
 * with the earlier document { entries: [{ id, reason }], degraded,
 * degradations } and rejects unknown fields, so normalizePreviewPayload
 * accepts both documents and both surfaces share the same semantics without
 * duplicating request or parsing logic.
 */

export const MIX_PREVIEW_ENDPOINT = '/api/mix/preview'

export const MIX_MODES = ['pure_shuffle', 'rediscover', 'familiar_fresh']

export const DEFAULT_MIX_LIMIT = 100
export const DEFAULT_ARTIST_SPACING = 2
export const DEFAULT_ADVENTURE = 50

export const sanitizeLibraryIds = (filters) => {
  const requested = filters?.library_id
  return (
    Array.isArray(requested) ? requested : requested ? [requested] : []
  )
    .map(Number)
    .filter((id) => Number.isInteger(id) && id > 0)
}

export const clampAdventure = (value) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    return DEFAULT_ADVENTURE
  }
  return Math.min(100, Math.max(0, Math.round(parsed)))
}

// buildMixSpec returns the exact request body for POST /api/mix/preview.
// `adventure` is required for familiar_fresh (0..100) and must never leak
// into the bodies of modes that do not declare it.
export const buildMixSpec = ({
  mode,
  seed,
  limit = DEFAULT_MIX_LIMIT,
  artistSpacing = DEFAULT_ARTIST_SPACING,
  adventure,
  libraryIds = [],
} = {}) => {
  if (!MIX_MODES.includes(mode)) {
    throw new Error(`unsupported mix mode: ${mode}`)
  }
  const spec = {
    mode,
    seed: seed || createShuffleSeed(),
    limit,
    artistSpacing,
  }
  if (mode === 'familiar_fresh') {
    spec.adventure = clampAdventure(adventure)
  }
  if (Array.isArray(libraryIds) && libraryIds.length > 0) {
    spec.libraryIds = [...libraryIds]
  }
  return spec
}

// normalizePreviewPayload accepts both frozen preview documents and returns
// one internal shape: { mode, seed, tracks, degraded, degradations } where
// tracks is an ordered [{ id, reason }] list.
export const normalizePreviewPayload = (payload) => {
  const reasons =
    payload?.reasons && typeof payload.reasons === 'object'
      ? payload.reasons
      : {}

  const source = Array.isArray(payload?.entries)
    ? payload.entries
    : Array.isArray(payload?.tracks)
      ? payload.tracks
      : []

  const tracks = source
    .map((item) => {
      if (typeof item === 'string') {
        return { id: item, reason: reasons[item] }
      }
      const id = item?.id
      if (!id) {
        return null
      }
      return { id, reason: item.reason ?? reasons[id] }
    })
    .filter(Boolean)

  return {
    mode: payload?.mode,
    seed: payload?.seed,
    tracks,
    degraded: Boolean(payload?.degraded),
    degradations: Array.isArray(payload?.degradations)
      ? payload.degradations
      : [],
  }
}

// toPlayableItems joins ordered preview tracks against locally resolved songs
// and drops tracks that are missing or otherwise no longer resolvable.
export const toPlayableItems = (tracks, songs) => {
  const playableByID = new Map(
    (Array.isArray(songs) ? songs : [])
      .filter((song) => song?.id && !song.missing)
      .map((song) => [song.id, song]),
  )
  return tracks
    .map((track) => ({ track, song: playableByID.get(track.id) }))
    .filter(({ song }) => Boolean(song))
}