import React from 'react'
import { Box, Typography } from '@material-ui/core'
import { makeStyles } from '@material-ui/core/styles'
import { alpha } from '@material-ui/core/styles/colorManipulator'
import { useTranslate } from 'react-admin'
import { ShuffleAllButton } from '../common'
import subsonic from '../subsonic'

const useStyles = makeStyles(
  (theme) => ({
    root: {
      position: 'relative',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(3),
      padding: theme.spacing(3),
      minHeight: 240,
      borderRadius: theme.spacing(2.5),
      backgroundImage: `linear-gradient(135deg, ${alpha(
        theme.palette.primary.main,
        0.28,
      )} 0%, ${alpha(theme.palette.background.paper, 0.92)} 58%, ${
        theme.palette.background.paper
      } 100%)`,
      border: `1px solid ${alpha(theme.palette.common.white, 0.08)}`,
      boxShadow:
        theme.palette.type === 'dark'
          ? '0 18px 48px rgba(0, 0, 0, 0.32)'
          : '0 12px 32px rgba(15, 23, 42, 0.08)',
      [theme.breakpoints.up('sm')]: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: theme.spacing(4),
        minHeight: 280,
      },
    },
    copy: {
      position: 'relative',
      zIndex: 1,
      maxWidth: 560,
    },
    eyebrow: {
      display: 'inline-flex',
      alignItems: 'center',
      minHeight: 32,
      marginBottom: theme.spacing(1),
      letterSpacing: 1.4,
      textTransform: 'uppercase',
      fontWeight: 700,
      color: theme.palette.primary.light || theme.palette.primary.main,
    },
    title: {
      fontWeight: 750,
      letterSpacing: '-0.03em',
      lineHeight: 1.1,
      fontSize: '2rem',
      [theme.breakpoints.up('sm')]: {
        fontSize: '2.65rem',
      },
    },
    subtitle: {
      marginTop: theme.spacing(1.5),
      maxWidth: 460,
      color: theme.palette.text.secondary,
      fontSize: '1rem',
      lineHeight: 1.55,
    },
    hint: {
      marginTop: theme.spacing(1),
      color: theme.palette.text.secondary,
      fontSize: '0.85rem',
    },
    actions: {
      marginTop: theme.spacing(3),
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: theme.spacing(1.5),
    },
    shuffle: {
      minHeight: 48,
      minWidth: 48,
      paddingLeft: theme.spacing(2),
      paddingRight: theme.spacing(2),
    },
    mosaic: {
      position: 'relative',
      display: 'grid',
      gridTemplateColumns: 'repeat(2, minmax(72px, 1fr))',
      gap: theme.spacing(1),
      width: '100%',
      maxWidth: 248,
      alignSelf: 'flex-end',
      [theme.breakpoints.up('sm')]: {
        alignSelf: 'center',
      },
    },
    tile: {
      width: '100%',
      aspectRatio: '1',
      borderRadius: theme.spacing(1.25),
      objectFit: 'cover',
      backgroundColor: alpha(theme.palette.common.black, 0.2),
      boxShadow: '0 10px 24px rgba(0, 0, 0, 0.28)',
    },
    tileEmpty: {
      backgroundColor: alpha(theme.palette.primary.main, 0.16),
    },
  }),
  { name: 'NDListenNow' },
)

export const HeroShuffleCard = ({ filters = {}, albums = [] }) => {
  const classes = useStyles()
  const translate = useTranslate()
  const mosaic = albums.filter((album) => album?.id).slice(0, 4)

  return (
    <section
      className={classes.root}
      data-testid="listen-now-hero"
      aria-labelledby="listen-now-hero-title"
    >
      <div className={classes.copy}>
        <Typography className={classes.eyebrow} variant="overline">
          {translate('listenNow.heroEyebrow', { _: 'Your library' })}
        </Typography>
        <Typography
          id="listen-now-hero-title"
          className={classes.title}
          variant="h4"
          component="h1"
        >
          {translate('listenNow.heroTitle', { _: 'Remix what you own' })}
        </Typography>
        <Typography className={classes.subtitle}>
          {translate('listenNow.heroSubtitle', {
            _: 'Start a seeded shuffle across the music already on this server. Missing tracks stay out of the queue.',
          })}
        </Typography>
        <Typography className={classes.hint}>
          {translate('listenNow.shuffleHint', {
            _: 'Preview first. The current queue stays put until you confirm.',
          })}
        </Typography>
        <Box className={classes.actions}>
          <ShuffleAllButton filters={filters} className={classes.shuffle} />
        </Box>
      </div>
      <div className={classes.mosaic} aria-hidden="true">
        {Array.from({ length: 4 }, (_, index) => {
          const album = mosaic[index]
          if (!album) {
            return (
              <div
                className={`${classes.tile} ${classes.tileEmpty}`}
                key={index}
              />
            )
          }
          return (
            <img
              key={album.id}
              className={classes.tile}
              src={subsonic.getCoverArtUrl(album, 200, true) || undefined}
              alt=""
            />
          )
        })}
      </div>
    </section>
  )
}

export default HeroShuffleCard
