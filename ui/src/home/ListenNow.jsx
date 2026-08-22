import React, { useCallback, useEffect, useMemo, useState } from 'react'
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
      maxWidth: 1280,
      margin: '0 auto',
      padding: theme.spacing(2, 2, 6),
      [theme.breakpoints.up('sm')]: {
        padding: theme.spacing(3, 3, 8),
      },
      [theme.breakpoints.up('md')]: {
        padding: theme.spacing(4, 4, 10),
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
})

export const ListenNow = () => {
  const classes = useStyles()
  const translate = useTranslate()
  const dataProvider = useDataProvider()
  const getList = dataProvider.getList
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

  const loadRails = useCallback(
    async (signal) => {
      setRailState((current) =>
        rails.reduce((acc, rail) => {
          acc[rail.id] = {
            items: current[rail.id]?.items || [],
            loading: true,
            error: false,
          }
          return acc
        }, {}),
      )

      await Promise.all(
        rails.map(async (rail) => {
          const list = albumLists[rail.listKey]
          if (!list) {
            if (signal?.aborted) {
              return
            }
            setRailState((current) => ({
              ...current,
              [rail.id]: { items: [], loading: false, error: false },
            }))
            return
          }

          const { sort, filter } = parseAlbumListParams(list.params)
          try {
            const { data = [] } = await getList('album', {
              pagination: { page: 1, perPage: RAIL_LIMIT },
              sort,
              filter: { ...filter, ...albumFilter },
            })
            if (signal?.aborted) {
              return
            }
            setRailState((current) => ({
              ...current,
              [rail.id]: {
                items: Array.isArray(data) ? data : [],
                loading: false,
                error: false,
              },
            }))
          } catch (_error) {
            if (signal?.aborted) {
              return
            }
            setRailState((current) => ({
              ...current,
              [rail.id]: { items: [], loading: false, error: true },
            }))
          }
        }),
      )
    },
    [albumFilter, getList, rails],
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
      },
    }))
  }, [])

  const mosaicAlbums = railState.recentlyAdded?.items || []
  const hasPageError = rails.every((rail) => railState[rail.id]?.error)

  return (
    <div className={classes.page} data-testid="listen-now-page">
      <Title subTitle={translate('menu.listenNow', { _: 'Listen Now' })} />
      <HeroShuffleCard filters={shuffleFilters} albums={mosaicAlbums} />
      {hasPageError && (
        <div className={classes.pageError} role="alert">
          {translate('listenNow.pageError', {
            _: 'Local shelves could not be loaded. Playback was not changed.',
          })}
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
