import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  Button as AdminButton,
  useDataProvider,
  useNotify,
  useTranslate,
} from 'react-admin'
import { useDispatch } from 'react-redux'
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItem,
  ListItemText,
  Typography,
} from '@material-ui/core'
import ShuffleIcon from '@material-ui/icons/Shuffle'
import PropTypes from 'prop-types'
import { playTracks } from '../actions'
import { httpClient } from '../dataProvider'

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
    seed: window.crypto.randomUUID(),
    limit: 100,
    artistSpacing: 2,
    ...(libraryIDs.length > 0 ? { libraryIds: libraryIDs } : {}),
  }
}

export const ShuffleAllButton = ({ filters }) => {
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
    requestID.current = currentRequest
    setOpen(true)
    setLoading(true)
    setPreview(null)

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
      setOpen(false)
      setPreview(null)
    } finally {
      if (requestID.current === currentRequest) {
        setLoading(false)
      }
    }
  }, [dataProvider, filters, notify, translate])

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

  return (
    <>
      <AdminButton
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
        maxWidth="sm"
      >
        <DialogTitle id="shuffle-preview-title">
          {translate('resources.song.mix.previewTitle', {
            _: 'Preview library shuffle',
          })}
        </DialogTitle>
        <DialogContent>
          {loading && (
            <Box display="flex" justifyContent="center" py={4}>
              <CircularProgress
                size={32}
                aria-label={translate('ra.message.loading', { _: 'Loading' })}
              />
            </Box>
          )}
          {!loading && preview && (
            <>
              <Typography variant="body2" gutterBottom>
                {translate('resources.song.mix.ready', {
                  _: '%{count} tracks ready. Your current queue will not change until you confirm.',
                  count: preview.items.length,
                })}
              </Typography>
              {preview.degraded && (
                <Typography color="textSecondary" role="status" gutterBottom>
                  {translate('resources.song.mix.degraded', {
                    _: 'Some spacing or availability preferences could not be fully maintained.',
                  })}
                </Typography>
              )}
              <List dense aria-label="shuffle-preview-tracks">
                {visibleItems.map(({ entry, song }) => (
                  <ListItem key={song.id} disableGutters>
                    <ListItemText
                      primary={song.title}
                      secondary={`${song.artist || song.albumArtist || ''} · ${translate(
                        `resources.song.mix.reason.${entry.reason}`,
                        { _: 'Seeded library shuffle' },
                      )}`}
                    />
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
        <DialogActions>
          <Button onClick={handleClose} color="primary">
            {translate('ra.action.cancel')}
          </Button>
          <Button onClick={loadPreview} color="primary" disabled={loading}>
            {translate('resources.song.mix.tryAnother', { _: 'Try another' })}
          </Button>
          <Button
            onClick={handleConfirm}
            color="primary"
            variant="contained"
            disabled={loading || !preview?.items?.length}
            data-testid="confirm-shuffle-preview"
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
}

ShuffleAllButton.defaultProps = {
  filters: {},
}
