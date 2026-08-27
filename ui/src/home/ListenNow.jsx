import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSelector } from 'react-redux'
import { Title, useDataProvider, useTranslate } from 'react-admin'
import { makeStyles } from '@material-ui/core/styles'
import { alpha } from '@material-ui/core/styles/colorManipulator'
import albumLists from '../album/albumLists'
import config from '../config'
import { HeroShuffleCard } from './HeroShuffleCard'
import { HomeRail } from './HomeRail'

const RAIL_LIMIT = 12

const parseAlbumListParams = (query = '') => {
  const params = new URLSearchParams(query)
  let filter = {}
  const rawFilter = params.get('filter')
  if (rawFilter) {
    try {
      filter = JSON.parse(rawFilter) || {}
    } catch (_error) {
      filter = {}
    }
  }
  return {
    sort: {
      field: params.get('sort') || 'name',
      order: params.get('order') || 'ASC',
    },
    filter,
  }
}

const listenNowRails = () =>
  [
    {
      id: 'recentlyAdded',
      titleKey: 'listenNow.rails.recentlyAdded.title',
      titleFallback: 'Recently added',
      sourceKey: 'listenNow.rails.recentlyAdded.source',
      sourceFallback: 'Local library · date added',
      emptyKey: 'listenNow.rails.recentlyAdded.empty',
      emptyFallback: 'Newly imported albums will appear here.',
      destination: '/album/recentlyAdded',
      listKey: 'recentlyAdded',
    },
    {
      id: 'recentlyPlayed',
      titleKey: 'listenNow.rails.recentlyPlayed.title',
      titleFallback: 'Recently played',
      sourceKey: 'listenNow.rails.recentlyPlayed.source',
      sourceFallback: 'Local listening history',
      emptyKey: 'listenNow.rails.recentlyPlayed.empty',
      emptyFallback: 'Play something from this library to fill this shelf.',
      destination: '/album/recentlyPlayed',
      listKey: 'recentlyPlayed',
    },
    config.enableFavourites && {
      id: 'favourites',
      titleKey: 'listenNow.rails.favourites.title',
      titleFallback: 'Favourites',
      sourceKey: 'listenNow.rails.favourites.source',
      sourceFallback: 'Local starred albums',
      emptyKey: 'listenNow.rails.favourites.empty',
      emptyFallback: 'Star an album to keep it on this shelf.',
      destination: '/album/starred',
      listKey: 'starred',
    },
    {
      id: 'discover',
      titleKey: 'listenNow.rails.discover.title',
      titleFallback: 'From this library',
      sourceKey: 'listenNow.rails.discover.source',
      sourceFallback: 'Local random albums',
      emptyKey: 'listenNow.rails.discover.empty',
      emptyFallback: 'Add albums to this library to explore them here.',
      destination: '/album/random',
      listKey: 'random',
    },
  ].filter(Boolean)

const useStyles = makeStyles(
  (theme) => ({
    page: {
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(4),
      width: '100%',
      minWidth: 0,
      maxWidth: 1680,
      margin: '0 auto',
      padding: theme.spacing(2, 2, 6),
      [theme.breakpoints.up('sm')]: {
        padding: theme.spacing(3, 3, 8),
      },
      [theme.breakpoints.up('md')]: {
        padding: theme.spacing(4, 4, 10),
      },
      [theme.breakpoints.up('lg')]: {
        padding: theme.spacing(5, '5vw', 12),
      },
      [theme.breakpoints.up('xl')]: {
        padding: theme.spacing(6, '6vw', 14),
      },
    },
    pageError: {
      minHeight: 72,
      display: 'flex',
      alignItems: 'center',
      padding: theme.spacing(2, 2.5),
      borderRadius: theme.spacing(1.5),
      backgroundColor: alpha(theme.palette.error.main, 0.12),
      color: theme.palette.error.light || theme.palette.error.main,
    },
  }),
  { name: 'NDListenNow' },
)

const emptyRailState = () => ({
  items: [],
  loading: true,
  error: false,
  authError: false,
})

const getHttpStatus = (error) => {
  if (typeof error === 'number') {
    return error
  }
  if (!error || typeof error !== 'object') {
    return undefined
  }
  const status = error.status ?? error.statusCode ?? error.status_code
  if (typeof status === 'number') {
    return status
  }
  if (typeof status === 'string' && status.trim() !== '') {
    const parsed = Number(status)
    return Number.isFinite(parsed) ? parsed : undefined
  }
  return undefined
}

const isUnauthorizedError = (error) => getHttpStatus(error) === 401

export const ListenNow = () => {
  const classes = useStyles()
  const translate = useTranslate()
  const dataProvider = useDataProvider()
  const getListRef = useRef(dataProvider.getList)
  getListRef.current = dataProvider.getList
  const selectedLibraries = useSelector(
    (state) => state.library?.selectedLibraries || [],
  )
  const rails = useMemo(() => listenNowRails(), [])
  const [railState, setRailState] = useState(() =>
    rails.reduce((acc, rail) => {
      acc[rail.id] = emptyRailState()
      return acc
    }, {}),
  )
  const [reloadToken, setReloadToken] = useState(0)

  const libraryIds = useMemo(
    () =>
      (Array.isArray(selectedLibraries) ? selectedLibraries : [])
        .map(Number)
        .filter((id) => Number.isInteger(id) && id > 0),
    [selectedLibraries],
  )
  const shuffleFilters = useMemo(
    () => (libraryIds.length > 0 ? { library_id: libraryIds } : {}),
    [libraryIds],
  )
  const albumFilter = useMemo(
    () => (libraryIds.length > 0 ? { library_id: libraryIds } : {}),
    [libraryIds],
  )

  const settleRail = useCallback((railId, nextState, signal) => {
    if (signal?.aborted) {
      return
    }
    setRailState((current) => ({
      ...current,
      [railId]: {
        items: [],
        loading: false,
        error: false,
        authError: false,
        ...nextState,
      },
    }))
  }, [])

  const loadRails = useCallback(
    async (signal) => {
      setRailState((current) =>
        rails.reduce((acc, rail) => {
          acc[rail.id] = {
            items: current[rail.id]?.items || [],
            loading: true,
            error: false,
            authError: false,
          }
          return acc
        }, {}),
      )

      await Promise.all(
        rails.map(async (rail) => {
          try {
            const list = albumLists[rail.listKey]
            if (!list) {
              settleRail(rail.id, { items: [] }, signal)
              return
            }

            const { sort, filter } = parseAlbumListParams(list.params)
            const { data = [] } = await Promise.resolve(
              getListRef.current('album', {
                pagination: { page: 1, perPage: RAIL_LIMIT },
                sort,
                filter: { ...filter, ...albumFilter },
              }),
            )
            settleRail(
              rail.id,
              {
                items: Array.isArray(data) ? data : [],
              },
              signal,
            )
          } catch (error) {
            settleRail(
              rail.id,
              {
                items: [],
                error: true,
                authError: isUnauthorizedError(error),
              },
              signal,
            )
          }
        }),
      )
    },
    [albumFilter, rails, settleRail],
  )

  useEffect(() => {
    const controller =
      typeof AbortController === 'function' ? new AbortController() : null
    loadRails(controller?.signal)
    return () => controller?.abort()
  }, [loadRails, reloadToken])

  const retryRail = useCallback((railId) => {
    setReloadToken((token) => token + 1)
    setRailState((current) => ({
      ...current,
      [railId]: {
        ...(current[railId] || emptyRailState()),
        loading: true,
        error: false,
        authError: false,
      },
    }))
  }, [])

  const mosaicAlbums = railState.recentlyAdded?.items || []
  const hasAuthError = rails.some((rail) => railState[rail.id]?.authError)
  const hasPageError = rails.every((rail) => railState[rail.id]?.error)
  const pageErrorMessage = hasAuthError
    ? translate('listenNow.sessionExpired', {
        _: 'Your session expired. Sign in again to load these shelves. Playback was not changed.',
      })
    : translate('listenNow.pageError', {
        _: 'Local shelves could not be loaded. Playback was not changed.',
      })

  return (
    <div className={classes.page} data-testid="listen-now-page">
      <Title subTitle={translate('menu.listenNow', { _: 'Listen Now' })} />
      <HeroShuffleCard filters={shuffleFilters} albums={mosaicAlbums} />
      {(hasAuthError || hasPageError) && (
        <div
          className={classes.pageError}
          role="alert"
          data-testid="listen-now-page-error"
          data-error-kind={hasAuthError ? 'auth' : 'load'}
        >
          {pageErrorMessage}
        </div>
      )}
      {rails.map((rail) => {
        const state = railState[rail.id] || emptyRailState()
        return (
          <HomeRail
            key={rail.id}
            id={rail.id}
            title={translate(rail.titleKey, { _: rail.titleFallback })}
            sourceLabel={translate(rail.sourceKey, { _: rail.sourceFallback })}
            destination={rail.destination}
            items={state.items}
            loading={state.loading}
            error={state.error}
            emptyMessage={translate(rail.emptyKey, { _: rail.emptyFallback })}
            onRetry={() => retryRail(rail.id)}
          />
        )
      })}
    </div>
  )
}

export default ListenNow
