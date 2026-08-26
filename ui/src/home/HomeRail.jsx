import React from 'react'
import { Link } from 'react-router-dom'
import { Button, Typography, useMediaQuery } from '@material-ui/core'
import { makeStyles } from '@material-ui/core/styles'
import { useTranslate } from 'react-admin'
import clsx from 'clsx'
import { MediaCard } from './MediaCard'

const useStyles = makeStyles(
  (theme) => ({
    root: {
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1.5),
      minWidth: 0,
    },
    header: {
      display: 'flex',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      gap: theme.spacing(2),
    },
    heading: {
      minWidth: 0,
    },
    title: {
      fontWeight: 720,
      letterSpacing: '-0.02em',
      fontSize: '1.35rem',
      lineHeight: 1.2,
    },
    source: {
      display: 'block',
      marginTop: theme.spacing(0.5),
      color: theme.palette.text.secondary,
      fontSize: '0.8rem',
      letterSpacing: 0.2,
    },
    seeAll: {
      flexShrink: 0,
      minHeight: 48,
      minWidth: 48,
      paddingLeft: theme.spacing(1.5),
      paddingRight: theme.spacing(1.5),
      fontWeight: 650,
      '&:focus-visible': {
        outline: `2px solid ${theme.palette.primary.main}`,
        outlineOffset: 3,
      },
    },
    scroller: {
      display: 'flex',
      gap: theme.spacing(1.5),
      overflowX: 'auto',
      paddingBottom: theme.spacing(1),
      scrollSnapType: 'x proximity',
      scrollPaddingInline: theme.spacing(0.5),
      WebkitOverflowScrolling: 'touch',
      scrollbarWidth: 'thin',
      '@media (prefers-reduced-motion: reduce)': {
        scrollBehavior: 'auto',
      },
    },
    snap: {
      flex: '0 0 156px',
      scrollSnapAlign: 'start',
      [theme.breakpoints.up('sm')]: {
        flexBasis: 176,
      },
      [theme.breakpoints.up('md')]: {
        flexBasis: 196,
      },
    },
    status: {
      minHeight: 156,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'flex-start',
      gap: theme.spacing(1.5),
      padding: theme.spacing(2),
      borderRadius: theme.spacing(1.5),
      backgroundColor:
        theme.palette.type === 'dark'
          ? 'rgba(255, 255, 255, 0.04)'
          : theme.palette.action.hover,
    },
    skeletonCard: {
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      minWidth: 0,
      borderRadius: theme.spacing(1.5),
      backgroundColor:
        theme.palette.type === 'dark'
          ? 'rgba(255, 255, 255, 0.04)'
          : theme.palette.background.paper,
      padding: theme.spacing(1.25),
    },
    skeletonCover: {
      width: '100%',
      aspectRatio: '1',
      borderRadius: theme.spacing(1),
      backgroundColor: theme.palette.action.disabledBackground,
      animation: '$pulse 1.4s ease-in-out infinite',
      '@media (prefers-reduced-motion: reduce)': {
        animation: 'none',
      },
    },
    skeletonLine: {
      height: 12,
      borderRadius: 4,
      marginTop: theme.spacing(1.25),
      backgroundColor: theme.palette.action.disabledBackground,
      animation: '$pulse 1.4s ease-in-out infinite',
      '@media (prefers-reduced-motion: reduce)': {
        animation: 'none',
      },
    },
    skeletonLineShort: {
      width: '60%',
      marginTop: theme.spacing(0.75),
    },
    '@keyframes pulse': {
      '0%': { opacity: 0.55 },
      '50%': { opacity: 0.9 },
      '100%': { opacity: 0.55 },
    },
  }),
  { name: 'NDHomeRail' },
)

export const HomeRail = ({
  id,
  title,
  sourceLabel,
  destination,
  items = [],
  loading = false,
  error = false,
  emptyMessage,
  onRetry,
}) => {
  const classes = useStyles()
  const translate = useTranslate()
  const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  const headingId = `home-rail-${id}-title`
  const playableItems = items.filter((item) => item?.id && !item.missing)

  return (
    <section
      className={classes.root}
      data-testid={`home-rail-${id}`}
      data-source-kind="local"
      data-reduced-motion={reduceMotion ? 'true' : 'false'}
      aria-labelledby={headingId}
    >
      <header className={classes.header}>
        <div className={classes.heading}>
          <Typography id={headingId} className={classes.title} component="h2">
            {title}
          </Typography>
          {sourceLabel && (
            <Typography className={classes.source} variant="caption">
              {sourceLabel}
            </Typography>
          )}
        </div>
        {destination && (
          <Button
            className={classes.seeAll}
            component={Link}
            to={destination}
            color="primary"
            data-testid={`see-all-${id}`}
          >
            {translate('listenNow.seeAll', { _: 'See all' })}
          </Button>
        )}
      </header>
      {loading && (
        <div
          className={classes.scroller}
          role="status"
          aria-label={translate('listenNow.loading', { _: 'Loading albums' })}
        >
          {Array.from({ length: 6 }, (_, index) => (
            <div className={classes.snap} key={`${id}-skeleton-${index}`}>
              <div
                className={classes.skeletonCard}
                data-testid="rail-skeleton-card"
              >
                <div className={classes.skeletonCover} />
                <div className={classes.skeletonLine} />
                <div
                  className={clsx(
                    classes.skeletonLine,
                    classes.skeletonLineShort,
                  )}
                />
              </div>
            </div>
          ))}
        </div>
      )}
      {!loading && error && (
        <div className={classes.status} role="alert">
          <Typography>
            {translate('listenNow.error', {
              _: 'Could not load this shelf.',
            })}
          </Typography>
          {onRetry && (
            <Button
              color="primary"
              variant="outlined"
              onClick={onRetry}
              className={classes.seeAll}
            >
              {translate('listenNow.retry', { _: 'Try again' })}
            </Button>
          )}
        </div>
      )}
      {!loading && !error && playableItems.length === 0 && (
        <div className={classes.status} role="status">
          <Typography>
            {emptyMessage ||
              translate('listenNow.empty', {
                _: 'No albums in this shelf yet.',
              })}
          </Typography>
        </div>
      )}
      {!loading && !error && playableItems.length > 0 && (
        <div
          className={classes.scroller}
          data-testid={`home-rail-scroller-${id}`}
        >
          {playableItems.map((record) => (
            <div className={classes.snap} key={record.id}>
              <MediaCard record={record} />
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

export default HomeRail
