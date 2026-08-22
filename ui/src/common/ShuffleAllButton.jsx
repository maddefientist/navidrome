import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  Button as AdminButton,
  useDataProvider,
  useNotify,
  useTranslate,
} from 'react-admin'
import { useDispatch } from 'react-redux'
import {
  Avatar,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItem,
  makeStyles,
  Typography,
  useMediaQuery,
  useTheme,
} from '@material-ui/core'
import ShuffleIcon from '@material-ui/icons/Shuffle'
import PropTypes from 'prop-types'
import { playTracks } from '../actions'
import { httpClient } from '../dataProvider'
import subsonic from '../subsonic'
import { formatDuration } from '../utils'

const useStyles = makeStyles((theme) => ({
  dialogContent: {
    minHeight: theme.spacing(68),
  },
  previewList: {
    transition: 'opacity 150ms cubic-bezier(0.4, 0, 0.2, 1)',
    '&[data-loading="true"]': {
      opacity: 0.45,
    },
    '@media (prefers-reduced-motion: reduce)': {
      transition: 'none',
    },
  },
  trackRow: {
    minHeight: theme.spacing(7),
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1.5),
  },
  artwork: {
    width: theme.spacing(6),
    height: theme.spacing(6),
    flexShrink: 0,
    borderRadius: theme.spacing(0.5),
  },
  trackDetails: {
    minWidth: 0,
    flex: 1,
  },
  trackTitle: {
    fontWeight: 600,
    lineHeight: 1.35,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  trackMetadata: {
    color: theme.palette.text.secondary,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  reason: {
    display: 'block',
    color: theme.palette.text.secondary,
    marginTop: theme.spacing(0.5),
  },
  skeletonRow: {
    minHeight: theme.spacing(7),
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1.5),
  },
  skeletonArtwork: {
    width: theme.spacing(6),
    height: theme.spacing(6),
    flexShrink: 0,
    borderRadius: theme.spacing(0.5),
    backgroundColor: theme.palette.action.disabledBackground,
  },
  skeletonText: {
    minWidth: 0,
    flex: 1,
  },
  skeletonLine: {
    width: '62%',
    height: theme.spacing(1.25),
    borderRadius: theme.spacing(0.5),
    backgroundColor: theme.palette.action.disabledBackground,
    '& + &': {
      width: '42%',
      marginTop: theme.spacing(1),
    },
  },
  visuallyHidden: {
    position: 'absolute',
    width: 1,
    height: 1,
    padding: 0,
    margin: -1,
    overflow: 'hidden',
    clip: 'rect(0, 0, 0, 0)',
    whiteSpace: 'nowrap',
    border: 0,
  },
  actions: {
    [theme.breakpoints.down('xs')]: {
      flexWrap: 'wrap',
      padding: theme.spacing(1, 2, 2),
    },
  },
  secondaryAction: {
    [theme.breakpoints.down('xs')]: {
      flex: '1 1 auto',
    },
  },
  confirmAction: {
    [theme.breakpoints.down('xs')]: {
      flex: '1 0 100%',
      width: '100%',
      minHeight: theme.spacing(6),
      marginLeft: '0 !important',
      marginTop: theme.spacing(1),
    },
  },
  trigger: {
    minHeight: 48,
    minWidth: 48,
  },
}))

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

const previewSpec = (filters) => {
  const requestedLibraries = filters?.library_id
  const libraryIDs = (
    Array.isArray(requestedLibraries)
      ? requestedLibraries
      : requestedLibraries
        ? [requestedLibraries]
        : []
  )
    .map(Number)
    .filter((id) => Number.isInteger(id) && id > 0)

  return {
    mode: 'pure_shuffle',
    seed: createShuffleSeed(),
    limit: 100,
    artistSpacing: 2,
    ...(libraryIDs.length > 0 ? { libraryIds: libraryIDs } : {}),
  }
}

export const ShuffleAllButton = ({ filters, className }) => {
  const classes = useStyles()
  const theme = useTheme()
  const fullScreen = useMediaQuery(theme.breakpoints.down('xs'))
  const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  const translate = useTranslate()
  const dataProvider = useDataProvider()
  const dispatch = useDispatch()
  const notify = useNotify()
  const requestID = useRef(0)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [preview, setPreview] = useState(null)

  const invalidateRequest = useCallback(() => {
    requestID.current += 1
  }, [])

  const resetPreview = useCallback(() => {
    setLoading(false)
    setPreview(null)
  }, [])

  const handleClose = useCallback(() => {
    invalidateRequest()
    setOpen(false)
    resetPreview()
  }, [invalidateRequest, resetPreview])

  useEffect(() => invalidateRequest, [invalidateRequest])

  const loadPreview = useCallback(async () => {
    const currentRequest = requestID.current + 1
    const previousPreview = preview
    requestID.current = currentRequest
    setOpen(true)
    setLoading(true)
    if (!previousPreview) {
      setPreview(null)
    }

    try {
      const { json } = await httpClient('/api/mix/preview', {
        method: 'POST',
        body: JSON.stringify(previewSpec(filters)),
      })
      const entries = Array.isArray(json?.entries) ? json.entries : []
      const ids = entries.map((entry) => entry.id).filter(Boolean)
      if (ids.length === 0) {
        throw new Error('empty mix preview')
      }
      if (requestID.current !== currentRequest) {
        return
      }

      const { data: songs = [] } = await dataProvider.getMany('song', { ids })
      if (requestID.current !== currentRequest) {
        return
      }

      const playableByID = new Map(
        songs
          .filter((song) => song?.id && !song.missing)
          .map((song) => [song.id, song]),
      )
      const items = entries
        .map((entry) => ({ entry, song: playableByID.get(entry.id) }))
        .filter(({ song }) => Boolean(song))

      if (items.length === 0) {
        throw new Error('empty playable mix preview')
      }

      setPreview({
        items,
        degraded: Boolean(json?.degraded) || items.length !== entries.length,
        degradations: Array.isArray(json?.degradations)
          ? json.degradations
          : [],
      })
    } catch (_error) {
      if (requestID.current !== currentRequest) {
        return
      }
      notify(
        translate('message.shufflePreviewFailed', {
          _: 'Could not prepare a playable library shuffle.',
        }),
        'warning',
      )
      if (!previousPreview) {
        setOpen(false)
        setPreview(null)
      }
    } finally {
      if (requestID.current === currentRequest) {
        setLoading(false)
      }
    }
  }, [dataProvider, filters, notify, preview, translate])

  const handleConfirm = useCallback(() => {
    if (!preview?.items?.length) {
      return
    }
    const data = {}
    const ids = []
    preview.items.forEach(({ song }) => {
      data[song.id] = song
      ids.push(song.id)
    })
    dispatch(playTracks(data, ids))
    handleClose()
  }, [dispatch, handleClose, preview])

  const visibleItems = preview?.items?.slice(0, 10) || []
  const hiddenCount = Math.max(
    (preview?.items?.length || 0) - visibleItems.length,
    0,
  )
  const totalDuration = (preview?.items || []).reduce(
    (total, { song }) => total + (Number(song.duration) || 0),
    0,
  )
  const reasons = [...new Set(visibleItems.map(({ entry }) => entry.reason))]
  const sharedReason = reasons.length === 1 ? reasons[0] : null

  return (
    <>
      <AdminButton
        className={
          className ? `${classes.trigger} ${className}` : classes.trigger
        }
        onClick={loadPreview}
        label={translate('resources.song.actions.shuffleLibrary', {
          _: 'Shuffle library',
        })}
      >
        <ShuffleIcon />
      </AdminButton>
      <Dialog
        open={open}
        onClose={handleClose}
        aria-labelledby="shuffle-preview-title"
        fullWidth
        fullScreen={fullScreen}
        maxWidth="sm"
        transitionDuration={reduceMotion ? 0 : undefined}
      >
        <DialogTitle id="shuffle-preview-title">
          {translate('resources.song.mix.previewTitle', {
            _: 'Preview library shuffle',
          })}
        </DialogTitle>
        <DialogContent className={classes.dialogContent} aria-busy={loading}>
          {loading && !preview && (
            <Box
              role="status"
              aria-label={translate('ra.message.loading', { _: 'Loading' })}
            >
              <span className={classes.visuallyHidden}>
                {translate('ra.message.loading', { _: 'Loading' })}
              </span>
              {Array.from({ length: 10 }, (_, index) => (
                <div
                  className={classes.skeletonRow}
                  data-testid="preview-skeleton-row"
                  key={index}
                >
                  <div className={classes.skeletonArtwork} />
                  <div className={classes.skeletonText}>
                    <div className={classes.skeletonLine} />
                    <div className={classes.skeletonLine} />
                  </div>
                </div>
              ))}
            </Box>
          )}
          {preview && (
            <>
              <Typography variant="body2" gutterBottom>
                {translate('resources.song.mix.ready', {
                  _: '%{count} tracks · %{duration}. Your current queue will not change until you confirm.',
                  count: preview.items.length,
                  duration: formatDuration(totalDuration),
                })}
              </Typography>
              {preview.degraded && (
                <Typography color="textSecondary" role="status" gutterBottom>
                  {translate('resources.song.mix.degraded', {
                    _: 'Some spacing or availability preferences could not be fully maintained.',
                  })}
                </Typography>
              )}
              {sharedReason && (
                <Typography variant="caption" className={classes.reason}>
                  {translate(`resources.song.mix.reason.${sharedReason}`, {
                    _: 'Seeded library shuffle',
                  })}
                </Typography>
              )}
              <List
                dense
                aria-label="shuffle-preview-tracks"
                className={classes.previewList}
                data-loading={loading}
              >
                {visibleItems.map(({ entry, song }) => (
                  <ListItem
                    key={song.id}
                    disableGutters
                    className={classes.trackRow}
                  >
                    <Avatar
                      className={classes.artwork}
                      src={subsonic.getCoverArtUrl(song, 80)}
                      variant="square"
                      alt=""
                      loading="lazy"
                    />
                    <div className={classes.trackDetails}>
                      <Typography className={classes.trackTitle}>
                        {song.title}
                      </Typography>
                      <Typography
                        variant="body2"
                        className={classes.trackMetadata}
                      >
                        {[song.artist || song.albumArtist, song.album]
                          .filter(Boolean)
                          .join(' · ')}
                        {!sharedReason && (
                          <>
                            {' · '}
                            {translate(
                              `resources.song.mix.reason.${entry.reason}`,
                              { _: 'Seeded library shuffle' },
                            )}
                          </>
                        )}
                      </Typography>
                    </div>
                  </ListItem>
                ))}
              </List>
              {hiddenCount > 0 && (
                <Typography variant="caption" color="textSecondary">
                  {translate('resources.song.mix.moreTracks', {
                    _: 'and %{count} more',
                    count: hiddenCount,
                  })}
                </Typography>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions className={classes.actions}>
          <Button
            onClick={handleClose}
            color="primary"
            className={classes.secondaryAction}
          >
            {translate('ra.action.cancel')}
          </Button>
          <Button
            onClick={loadPreview}
            color="primary"
            disabled={loading}
            className={classes.secondaryAction}
          >
            {translate('resources.song.mix.tryAnother', { _: 'Try another' })}
          </Button>
          <Button
            onClick={handleConfirm}
            color="primary"
            variant="contained"
            disabled={loading || !preview?.items?.length}
            data-testid="confirm-shuffle-preview"
            className={classes.confirmAction}
          >
            {translate('resources.song.mix.play', { _: 'Play this shuffle' })}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

ShuffleAllButton.propTypes = {
  filters: PropTypes.object,
  className: PropTypes.string,
}

ShuffleAllButton.defaultProps = {
  filters: {},
}
