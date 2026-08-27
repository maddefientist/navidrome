import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Button,
  IconButton,
  Typography,
  useMediaQuery,
} from '@material-ui/core'
import { makeStyles, alpha } from '@material-ui/core/styles'
import { useTranslate } from 'react-admin'
import ChevronLeftIcon from '@material-ui/icons/ChevronLeft'
import ChevronRightIcon from '@material-ui/icons/ChevronRight'
import clsx from 'clsx'
import { MediaCard } from './MediaCard'

const CARD_WIDTH_XS = 156
const CARD_WIDTH_SM = 176
const CARD_WIDTH_MD = 196
const CARD_WIDTH_LG = 208

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
    scrollerWrap: {
      position: 'relative',
      minWidth: 0,
    },
    scroller: {
      display: 'flex',
      gap: theme.spacing(1.5),
      overflowX: 'auto',
      paddingBottom: theme.spacing(1),
      scrollSnapType: 'x proximity',
      scrollPaddingInline: theme.spacing(0.5),
      scrollBehavior: 'smooth',
      overscrollBehaviorInline: 'contain',
      WebkitOverflowScrolling: 'touch',
      // Hide native scrollbar tracks cross-browser while keeping
      // keyboard/touch/trackpad scroll behavior intact.
      scrollbarWidth: 'none',
      msOverflowStyle: 'none',
      '&::-webkit-scrollbar': {
        display: 'none',
      },
      '&:focus-visible': {
        outline: `2px solid ${theme.palette.primary.main}`,
        outlineOffset: 3,
      },
      '@media (prefers-reduced-motion: reduce)': {
        scrollBehavior: 'auto',
      },
    },
    snap: {
      flex: `0 0 ${CARD_WIDTH_XS}px`,
      width: CARD_WIDTH_XS,
      minWidth: 0,
      maxWidth: CARD_WIDTH_XS,
      scrollSnapAlign: 'start',
      [theme.breakpoints.up('sm')]: {
        flexBasis: CARD_WIDTH_SM,
        width: CARD_WIDTH_SM,
        maxWidth: CARD_WIDTH_SM,
      },
      [theme.breakpoints.up('md')]: {
        flexBasis: CARD_WIDTH_MD,
        width: CARD_WIDTH_MD,
        maxWidth: CARD_WIDTH_MD,
      },
      [theme.breakpoints.up('lg')]: {
        flexBasis: CARD_WIDTH_LG,
        width: CARD_WIDTH_LG,
        maxWidth: CARD_WIDTH_LG,
      },
    },
    edgeFade: {
      pointerEvents: 'none',
      position: 'absolute',
      top: 0,
      bottom: theme.spacing(1),
      width: theme.spacing(4),
      opacity: 0,
      transition: theme.transitions.create('opacity', {
        duration: theme.transitions.duration.shorter,
      }),
      '@media (prefers-reduced-motion: reduce)': {
        transition: 'none',
      },
      [theme.breakpoints.down('sm')]: {
        display: 'none',
      },
    },
    edgeFadeVisible: {
      opacity: 1,
    },
    edgeFadeStart: {
      left: 0,
      background: `linear-gradient(to right, ${theme.palette.background.default} 0%, ${alpha(
        theme.palette.background.default,
        0,
      )} 100%)`,
    },
    edgeFadeEnd: {
      right: 0,
      background: `linear-gradient(to left, ${theme.palette.background.default} 0%, ${alpha(
        theme.palette.background.default,
        0,
      )} 100%)`,
    },
    chevron: {
      display: 'none',
      [theme.breakpoints.up('md')]: {
        display: 'flex',
      },
      position: 'absolute',
      top: `calc(50% - ${theme.spacing(2)}px - 24px)`,
      width: 48,
      height: 48,
      zIndex: 1,
      backgroundColor: theme.palette.background.paper,
      boxShadow: theme.shadows[2],
      '&:hover': {
        backgroundColor: theme.palette.action.hover,
      },
      '&:focus-visible': {
        outline: `2px solid ${theme.palette.primary.main}`,
        outlineOffset: 2,
      },
    },
    chevronPrev: {
      left: theme.spacing(0.5),
    },
    chevronNext: {
      right: theme.spacing(0.5),
    },
    status: {
      maxWidth: CARD_WIDTH_XS * 3,
      minHeight: CARD_WIDTH_XS,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'flex-start',
      gap: theme.spacing(1.5),
      padding: theme.spacing(2),
      borderRadius: theme.spacing(1.5),
      backgroundColor: alpha(theme.palette.text.primary, 0.04),
    },
    skeletonCard: {
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      minWidth: 0,
      borderRadius: theme.spacing(1.5),
      backgroundColor: alpha(theme.palette.text.primary, 0.04),
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
  const scrollerRef = useRef(null)
  const [canScrollPrev, setCanScrollPrev] = useState(false)
  const [canScrollNext, setCanScrollNext] = useState(false)

  const measureOverflow = useCallback(() => {
    const el = scrollerRef.current
    if (!el) return
    const maxScrollLeft = el.scrollWidth - el.clientWidth
    setCanScrollPrev(el.scrollLeft > 1)
    setCanScrollNext(el.scrollLeft < maxScrollLeft - 1)
  }, [])

  useEffect(() => {
    measureOverflow()
    const el = scrollerRef.current
    if (!el) return undefined

    el.addEventListener('scroll', measureOverflow, { passive: true })
    window.addEventListener('resize', measureOverflow)

    let resizeObserver
    if (typeof ResizeObserver === 'function') {
      resizeObserver = new ResizeObserver(measureOverflow)
      resizeObserver.observe(el)
    }

    return () => {
      el.removeEventListener('scroll', measureOverflow)
      window.removeEventListener('resize', measureOverflow)
      resizeObserver?.disconnect()
    }
  }, [measureOverflow, playableItems.length, loading])

  const scrollByCards = useCallback(
    (direction) => {
      const el = scrollerRef.current
      if (!el) return
      const card = el.querySelector(`.${classes.snap}`)
      const cardWidth = card?.getBoundingClientRect().width || CARD_WIDTH_MD
      const gap = 12
      const distance = (cardWidth + gap) * 3 * direction
      el.scrollBy({
        left: distance,
        behavior: reduceMotion ? 'auto' : 'smooth',
      })
    },
    [classes.snap, reduceMotion],
  )

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
        <div className={classes.scrollerWrap}>
          <div
            className={clsx(classes.edgeFade, classes.edgeFadeStart, {
              [classes.edgeFadeVisible]: canScrollPrev,
            })}
            aria-hidden="true"
          />
          <div
            className={clsx(classes.edgeFade, classes.edgeFadeEnd, {
              [classes.edgeFadeVisible]: canScrollNext,
            })}
            aria-hidden="true"
          />
          {canScrollPrev && (
            <IconButton
              className={clsx(classes.chevron, classes.chevronPrev)}
              onClick={() => scrollByCards(-1)}
              aria-label={translate('listenNow.scrollPrev', {
                _: 'Scroll left',
              })}
              data-testid={`scroll-prev-${id}`}
            >
              <ChevronLeftIcon />
            </IconButton>
          )}
          {canScrollNext && (
            <IconButton
              className={clsx(classes.chevron, classes.chevronNext)}
              onClick={() => scrollByCards(1)}
              aria-label={translate('listenNow.scrollNext', {
                _: 'Scroll right',
              })}
              data-testid={`scroll-next-${id}`}
            >
              <ChevronRightIcon />
            </IconButton>
          )}
          <div
            className={classes.scroller}
            data-testid={`home-rail-scroller-${id}`}
            role="group"
            aria-label={title}
            tabIndex={0}
            ref={scrollerRef}
          >
            {playableItems.map((record) => (
              <div className={classes.snap} key={record.id}>
                <MediaCard record={record} />
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

export default HomeRail
