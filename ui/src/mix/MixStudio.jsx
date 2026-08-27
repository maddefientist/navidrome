import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Title, useDataProvider, useTranslate } from 'react-admin'
import {
  Avatar,
  Box,
  Button,
  ButtonBase,
  List,
  ListItem,
  makeStyles,
  Slider,
  Typography,
} from '@material-ui/core'
import { alpha } from '@material-ui/core/styles/colorManipulator'
import ShuffleIcon from '@material-ui/icons/Shuffle'
import RestoreIcon from '@material-ui/icons/Restore'
import TuneIcon from '@material-ui/icons/Tune'
import { playTracks } from '../actions'
import { httpClient } from '../dataProvider'
import subsonic from '../subsonic'
import { formatDuration } from '../utils'
import { createShuffleSeed } from '../common/shuffleSeed'
import {
  buildMixSpec,
  DEFAULT_ADVENTURE,
  MIX_PREVIEW_ENDPOINT,
  MIX_MODES,
  normalizePreviewPayload,
  toPlayableItems,
} from './index'

const MODE_ICONS = {
  pure_shuffle: ShuffleIcon,
  rediscover: RestoreIcon,
  familiar_fresh: TuneIcon,
}

const MODE_FALLBACKS = {
  pure_shuffle: {
    title: 'Pure Shuffle',
    description:
      'Seeded, unbiased shuffle across your selected libraries. Same seed, same mix.',
  },
  rediscover: {
    title: 'Rediscover',
    description: 'Favours tracks you own but have not played recently.',
  },
  familiar_fresh: {
    title: 'Familiar + Fresh',
    description:
      'Blends loved, familiar material with tracks you have played less.',
  },
}

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

const useStyles = makeStyles(
  (theme) => ({
    page: {
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(3),
      width: '100%',
      minWidth: 0,
      maxWidth: 1180,
      margin: '0 auto',
      padding: theme.spacing(2, 2, 6),
      [theme.breakpoints.up('sm')]: {
        padding: theme.spacing(3, 3, 8),
      },
      [theme.breakpoints.up('md')]: {
        padding: theme.spacing(4, 4, 10),
      },
    },
    intro: {
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(0.5),
    },
    title: {
      fontWeight: 750,
      letterSpacing: '-0.02em',
      lineHeight: 1.15,
      fontSize: '1.85rem',
      [theme.breakpoints.up('sm')]: {
        fontSize: '2.25rem',
      },
    },
    subtitle: {
      color: theme.palette.text.secondary,
      maxWidth: 640,
      lineHeight: 1.55,
    },
    scope: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: theme.spacing(0.75),
      marginTop: theme.spacing(1),
      padding: theme.spacing(0.5, 1.25),
      borderRadius: theme.spacing(1.5),
      backgroundColor: alpha(theme.palette.primary.main, 0.12),
      color: theme.palette.primary.light || theme.palette.primary.main,
      alignSelf: 'flex-start',
      fontSize: '0.8rem',
      fontWeight: 600,
    },
    modeGroup: {
      display: 'grid',
      gridTemplateColumns: '1fr',
      gap: theme.spacing(1.5),
      [theme.breakpoints.up('sm')]: {
        gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
      },
    },
    modeCard: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-start',
      gap: theme.spacing(1),
      width: '100%',
      padding: theme.spacing(2),
      textAlign: 'left',
      borderRadius: theme.spacing(1.5),
      border: `2px solid ${alpha(theme.palette.divider, 0.6)}`,
      backgroundColor: theme.palette.background.paper,
      transition:
        'border-color 150ms cubic-bezier(0.4, 0, 0.2, 1), box-shadow 150ms cubic-bezier(0.4, 0, 0.2, 1)',
      '&:focus-visible': {
        outline: `2px solid ${theme.palette.primary.main}`,
        outlineOffset: 2,
      },
      '@media (prefers-reduced-motion: reduce)': {
        transition: 'none',
      },
    },
    modeCardSelected: {
      borderColor: theme.palette.primary.main,
      boxShadow: `0 0 0 1px ${alpha(theme.palette.primary.main, 0.6)}`,
      backgroundColor: alpha(theme.palette.primary.main, 0.08),
    },
    modeIcon: {
      color: theme.palette.text.secondary,
      fontSize: '1.6rem',
    },
    modeIconSelected: {
      color: theme.palette.primary.light || theme.palette.primary.main,
    },
    modeTitle: {
      fontWeight: 700,
    },
    modeDescription: {
      color: theme.palette.text.secondary,
      lineHeight: 1.5,
    },
    adventure: {
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(0.5),
      padding: theme.spacing(2),
      borderRadius: theme.spacing(1.5),
      border: `1px solid ${alpha(theme.palette.divider, 0.6)}`,
      backgroundColor: alpha(theme.palette.background.paper, 0.6),
    },
    adventureHeader: {
      display: 'flex',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: theme.spacing(1),
    },
    adventureHint: {
      color: theme.palette.text.secondary,
    },
    controls: {
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: theme.spacing(1.5),
      marginTop: theme.spacing(0.5),
    },
    previewTrigger: {
      minHeight: 48,
      paddingLeft: theme.spacing(2),
      paddingRight: theme.spacing(2),
    },
    results: {
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1.5),
    },
    banner: {
      display: 'flex',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: theme.spacing(1.5),
      padding: theme.spacing(1.5, 2),
      borderRadius: theme.spacing(1.5),
    },
    errorBanner: {
      backgroundColor: alpha(theme.palette.error.main, 0.12),
      color: theme.palette.error.light || theme.palette.error.main,
    },
    emptyBanner: {
      backgroundColor: alpha(theme.palette.text.primary, 0.06),
      color: theme.palette.text.secondary,
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
      minHeight: 56,
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1.5),
    },
    artwork: {
      width: 48,
      height: 48,
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
    skeletonRow: {
      minHeight: 56,
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1.5),
    },
    skeletonArtwork: {
      width: 48,
      height: 48,
      flexShrink: 0,
      borderRadius: theme.spacing(0.5),
      backgroundColor: theme.palette.action.disabledBackground,
    },
    skeletonText: {
      minWidth: 0,
      flex: 1,
    },
    skeletonLine: {
      width: '58%',
      height: 10,
      borderRadius: theme.spacing(0.5),
      backgroundColor: theme.palette.action.disabledBackground,
      '& + &': {
        width: '38%',
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
    previewActions: {
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: theme.spacing(1.5),
    },
  }),
  { name: 'NDMixStudio' },
)

const reasonLabel = (reason, translate) =>
  translate(`resources.song.mix.reason.${reason || 'library_shuffle'}`, {
    _: translate('mixStudio.reasonFallback', { _: 'Picked for this mix' }),
  })

export const MixStudio = () => {
  const classes = useStyles()
  const translate = useTranslate()
  const dispatch = useDispatch()
  const dataProvider = useDataProvider()
  const requestID = useRef(0)
  const [mode, setMode] = useState('pure_shuffle')
  const [adventure, setAdventure] = useState(DEFAULT_ADVENTURE)
  const [status, setStatus] = useState('idle')
  const [errorKind, setErrorKind] = useState(null)
  const [preview, setPreview] = useState(null)

  const selectedLibraries = useSelector(
    (state) => state.library?.selectedLibraries || [],
  )
  const libraryIds = useMemo(
    () =>
      (Array.isArray(selectedLibraries) ? selectedLibraries : [])
        .map(Number)
        .filter((id) => Number.isInteger(id) && id > 0),
    [selectedLibraries],
  )

  useEffect(() => {
    const current = requestID.current
    return () => {
      // Invalidate any in-flight preview so it can never resolve after unmount.
      requestID.current = current + 1
    }
  }, [])

  useEffect(() => {
    // A preview is valid only for the exact controls and library scope that
    // produced it. Invalidate both visible and in-flight results whenever
    // either input changes so confirmation can never play a stale mix.
    requestID.current += 1
    setPreview(null)
    setStatus('idle')
    setErrorKind(null)
  }, [adventure, libraryIds])

  const selectMode = useCallback((nextMode) => {
    setMode(nextMode)
    // A preview generated for a different mode is stale; drop it so the
    // confirmation can only ever play the preview that is visible.
    setPreview(null)
    setStatus('idle')
    setErrorKind(null)
  }, [])

  const loadPreview = useCallback(async () => {
    const current = requestID.current + 1
    requestID.current = current
    setStatus('loading')
    setErrorKind(null)

    try {
      const spec = buildMixSpec({
        mode,
        seed: createShuffleSeed(),
        adventure,
        libraryIds,
      })
      const { json } = await httpClient(MIX_PREVIEW_ENDPOINT, {
        method: 'POST',
        body: JSON.stringify(spec),
      })
      if (requestID.current !== current) {
        return
      }

      const { tracks, degraded, degradations } = normalizePreviewPayload(json)
      const ids = tracks.map((track) => track.id).filter(Boolean)
      if (ids.length === 0) {
        setPreview(null)
        setStatus('empty')
        return
      }

      const { data: songs = [] } = await dataProvider.getMany('song', { ids })
      if (requestID.current !== current) {
        return
      }

      const items = toPlayableItems(tracks, songs)
      if (items.length === 0) {
        setPreview(null)
        setStatus('empty')
        return
      }

      setPreview({ items, degraded, degradations })
      setStatus('ready')
    } catch (error) {
      if (requestID.current !== current) {
        return
      }
      setPreview(null)
      setErrorKind(getHttpStatus(error) === 401 ? 'auth' : 'load')
      setStatus('error')
    }
  }, [adventure, dataProvider, libraryIds, mode])

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
    requestID.current += 1
    setPreview(null)
    setStatus('idle')
    setErrorKind(null)
  }, [dispatch, preview])

  const loading = status === 'loading'
  const visibleItems = preview?.items?.slice(0, 10) || []
  const hiddenCount = Math.max(
    (preview?.items?.length || 0) - visibleItems.length,
    0,
  )
  const totalDuration = (preview?.items || []).reduce(
    (total, { song }) => total + (Number(song.duration) || 0),
    0,
  )
  const reasons = [...new Set(visibleItems.map(({ track }) => track.reason))]
  const sharedReason = reasons.length === 1 ? reasons[0] : null

  const scopeLabel =
    libraryIds.length > 0
      ? translate('mixStudio.scope.selected', {
          _: 'Mixing from %{count} selected libraries',
          count: libraryIds.length,
        })
      : translate('mixStudio.scope.all', {
          _: 'Mixing from every library you can access',
        })

  return (
    <div className={classes.page} data-testid="mix-studio-page">
      <Title
        subTitle={translate('mixStudio.title', { _: 'Mix Studio' })}
      />
      <header className={classes.intro}>
        <Typography
          id="mix-studio-title"
          className={classes.title}
          variant="h4"
          component="h1"
        >
          {translate('mixStudio.title', { _: 'Mix Studio' })}
        </Typography>
        <Typography className={classes.subtitle}>
          {translate('mixStudio.subtitle', {
            _: 'Deterministic, preview-first mixes over the library you own. Nothing plays until you confirm.',
          })}
        </Typography>
        <Typography className={classes.scope} component="span">
          {scopeLabel}
        </Typography>
      </header>

      <div
        role="radiogroup"
        aria-label={translate('mixStudio.modeGroupLabel', { _: 'Mix mode' })}
        className={classes.modeGroup}
      >
        {MIX_MODES.map((id) => {
          const Icon = MODE_ICONS[id]
          const selected = mode === id
          return (
            <ButtonBase
              key={id}
              role="radio"
              aria-checked={selected}
              className={`${classes.modeCard} ${
                selected ? classes.modeCardSelected : ''
              }`}
              onClick={() => selectMode(id)}
              data-testid={`mode-card-${id}`}
            >
              <Icon
                className={`${classes.modeIcon} ${
                  selected ? classes.modeIconSelected : ''
                }`}
              />
              <Typography className={classes.modeTitle} component="span">
                {translate(`mixStudio.modes.${id}.title`, {
                  _: MODE_FALLBACKS[id].title,
                })}
              </Typography>
              <Typography
                variant="body2"
                className={classes.modeDescription}
                component="span"
              >
                {translate(`mixStudio.modes.${id}.description`, {
                  _: MODE_FALLBACKS[id].description,
                })}
              </Typography>
            </ButtonBase>
          )
        })}
      </div>

      <section
        className={classes.adventure}
        aria-label={translate('mixStudio.adventure.label', {
          _: 'Familiar ↔ Fresh adventure',
        })}
      >
        <div className={classes.adventureHint}>
          <Typography gutterBottom={false}>
            {translate('mixStudio.adventure.label', {
              _: 'Familiar ↔ Fresh adventure',
            })}
          </Typography>
          <Typography variant="body2" color="textSecondary">
            {mode === 'familiar_fresh'
              ? translate('mixStudio.adventure.helper', {
                  _: 'Toward Fresh weights the blend toward material you have played less.',
                })
              : translate('mixStudio.adventure.disabledHint', {
                  _: 'Select Familiar + Fresh to tune its blend.',
                })}
          </Typography>
        </div>
        <Slider
          value={adventure}
          min={0}
          max={100}
          step={1}
          aria-label={translate('mixStudio.adventure.label', {
            _: 'Familiar ↔ Fresh adventure',
          })}
          aria-valuetext={`${adventure} / 100`}
          valueLabelDisplay="auto"
          disabled={mode !== 'familiar_fresh'}
          marks={[
            { value: 0, label: translate('mixStudio.adventure.familiar', { _: 'Familiar' }) },
            { value: 100, label: translate('mixStudio.adventure.fresh', { _: 'Fresh' }) },
          ]}
          onChange={(_, value) => setAdventure(value)}
        />
        <Typography
          variant="caption"
          color="textSecondary"
          data-testid="adventure-value"
        >
          {adventure} / 100
        </Typography>
      </section>

      <div className={classes.controls}>
        <Button
          variant="contained"
          color="primary"
          className={classes.previewTrigger}
          onClick={loadPreview}
          disabled={loading}
          data-testid="mix-preview-trigger"
        >
          {translate('mixStudio.actions.preview', { _: 'Preview this mix' })}
        </Button>
      </div>

      <div
        className={classes.results}
        aria-live="polite"
        aria-busy={loading}
        data-testid="mix-studio-results"
      >
        {loading && !preview && (
          <Box
            role="status"
            aria-label={translate('mixStudio.loading', {
              _: 'Loading mix preview',
            })}
          >
            <span className={classes.visuallyHidden}>
              {translate('mixStudio.loading', { _: 'Loading mix preview' })}
            </span>
            {Array.from({ length: 6 }, (_, index) => (
              <div
                className={classes.skeletonRow}
                data-testid="mix-skeleton-row"
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

        {status === 'error' && (
          <Box
            className={`${classes.banner} ${classes.errorBanner}`}
            role="alert"
            data-testid="mix-studio-error"
            data-error-kind={errorKind || 'load'}
          >
            <Typography>
              {errorKind === 'auth'
                ? translate('mixStudio.sessionExpired', {
                    _: 'Your session expired. Sign in again to preview mixes. Playback was not changed.',
                  })
                : translate('mixStudio.error', {
                    _: 'The mix engine could not be reached. Playback was not changed.',
                  })}
            </Typography>
            <Button color="inherit" onClick={loadPreview} disabled={loading}>
              {translate('mixStudio.actions.retry', { _: 'Try again' })}
            </Button>
          </Box>
        )}

        {status === 'empty' && (
          <Box
            className={`${classes.banner} ${classes.emptyBanner}`}
            role="status"
            data-testid="mix-studio-empty"
          >
            <Typography>
              {translate('mixStudio.empty', {
                _: 'This mix found no playable tracks in the selected libraries. Adjust the mode or library selection, then try again.',
              })}
            </Typography>
          </Box>
        )}

        {preview && (
          <>
            <Typography variant="body2" gutterBottom={false}>
              {translate('mixStudio.ready', {
                _: '%{count} tracks · %{duration}. Your queue stays unchanged until you confirm.',
                count: preview.items.length,
                duration: formatDuration(totalDuration),
              })}
            </Typography>
            {preview.degraded && (
              <Typography color="textSecondary" role="status" gutterBottom={false}>
                {translate('mixStudio.degraded', {
                  _: 'Some spacing or availability preferences could not be fully maintained.',
                })}
              </Typography>
            )}
            {sharedReason && (
              <Typography variant="caption" color="textSecondary">
                {reasonLabel(sharedReason, translate)}
              </Typography>
            )}
            <List
              dense
              aria-label={translate('mixStudio.previewListLabel', {
                _: 'Mix preview tracks',
              })}
              className={classes.previewList}
              data-loading={loading}
            >
              {visibleItems.map(({ track, song }) => (
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
                          {reasonLabel(track.reason, translate)}
                        </>
                      )}
                    </Typography>
                  </div>
                </ListItem>
              ))}
            </List>
            {hiddenCount > 0 && (
              <Typography variant="caption" color="textSecondary">
                {translate('mixStudio.moreTracks', {
                  _: 'and %{count} more',
                  count: hiddenCount,
                })}
              </Typography>
            )}
            <div className={classes.previewActions}>
              <Button
                color="primary"
                onClick={loadPreview}
                disabled={loading}
                data-testid="mix-try-another"
              >
                {translate('mixStudio.actions.tryAnother', {
                  _: 'Try another seed',
                })}
              </Button>
              <Button
                variant="contained"
                color="primary"
                onClick={handleConfirm}
                disabled={loading || !preview.items.length}
                data-testid="confirm-mix-play"
              >
                {translate('mixStudio.actions.play', { _: 'Play this mix' })}
              </Button>
              <Typography variant="caption" color="textSecondary">
                {translate('mixStudio.actions.playHint', {
                  _: 'Replaces the current queue after you confirm.',
                })}
              </Typography>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default MixStudio
