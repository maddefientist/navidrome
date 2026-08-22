import React from 'react'
import { Link } from 'react-router-dom'
import { Typography } from '@material-ui/core'
import { makeStyles } from '@material-ui/core/styles'
import { useTranslate } from 'react-admin'
import clsx from 'clsx'
import subsonic from '../subsonic'
import { OverflowTooltip, PlayButton } from '../common'

const useStyles = makeStyles(
  (theme) => ({
    root: {
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      minWidth: 0,
      textDecoration: 'none',
      color: 'inherit',
      borderRadius: theme.spacing(1.5),
      backgroundColor:
        theme.palette.type === 'dark'
          ? 'rgba(255, 255, 255, 0.04)'
          : theme.palette.background.paper,
      padding: theme.spacing(1.25),
      transition: theme.transitions.create(['background-color', 'transform'], {
        duration: theme.transitions.duration.shorter,
      }),
      '&:hover, &:focus-within': {
        backgroundColor:
          theme.palette.type === 'dark'
            ? 'rgba(255, 255, 255, 0.09)'
            : theme.palette.action.hover,
      },
      '&:focus-visible': {
        outline: `2px solid ${theme.palette.primary.main}`,
        outlineOffset: 3,
      },
      '@media (prefers-reduced-motion: reduce)': {
        transition: 'none',
        '&:hover, &:focus-within': {
          transform: 'none',
        },
      },
    },
    coverWrap: {
      position: 'relative',
      width: '100%',
      aspectRatio: '1',
      overflow: 'hidden',
      borderRadius: theme.spacing(1),
      backgroundColor: theme.palette.action.hover,
    },
    cover: {
      display: 'block',
      width: '100%',
      height: '100%',
      objectFit: 'cover',
    },
    overlay: {
      position: 'absolute',
      inset: 0,
      display: 'flex',
      alignItems: 'flex-end',
      justifyContent: 'flex-end',
      padding: theme.spacing(1),
      background:
        'linear-gradient(to top, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 55%)',
      opacity: 0,
      pointerEvents: 'none',
      transition: theme.transitions.create('opacity', {
        duration: theme.transitions.duration.shorter,
      }),
      '$root:hover &, $root:focus-within &': {
        opacity: 1,
        pointerEvents: 'auto',
      },
      [theme.breakpoints.down('xs')]: {
        opacity: 1,
        pointerEvents: 'auto',
      },
      '@media (prefers-reduced-motion: reduce)': {
        transition: 'none',
        opacity: 1,
        pointerEvents: 'auto',
      },
    },
    play: {
      width: 48,
      height: 48,
      color: theme.palette.common.white,
      backgroundColor: theme.palette.primary.main,
      '&:hover': {
        backgroundColor: theme.palette.primary.light,
      },
      '&:focus-visible': {
        outline: `2px solid ${theme.palette.common.white}`,
        outlineOffset: 2,
      },
    },
    title: {
      marginTop: theme.spacing(1.25),
      fontWeight: 650,
      fontSize: '0.95rem',
      lineHeight: 1.35,
      overflow: 'hidden',
      whiteSpace: 'nowrap',
      textOverflow: 'ellipsis',
    },
    subtitle: {
      color: theme.palette.text.secondary,
      fontSize: '0.8rem',
      lineHeight: 1.35,
      overflow: 'hidden',
      whiteSpace: 'nowrap',
      textOverflow: 'ellipsis',
    },
    missing: {
      opacity: 0.38,
    },
  }),
  { name: 'NDMediaCard' },
)

export const MediaCard = ({ record }) => {
  const classes = useStyles()
  const translate = useTranslate()
  if (!record?.id) {
    return null
  }

  const coverSrc = subsonic.getCoverArtUrl(record, 300, true)
  const subtitle = record.albumArtist || record.artist || ''

  return (
    <Link
      className={clsx(classes.root, record.missing && classes.missing)}
      to={`/album/${record.id}/show`}
      aria-label={translate('listenNow.openAlbum', {
        name: record.name,
        _: record.name,
      })}
    >
      <div className={classes.coverWrap}>
        <img
          className={classes.cover}
          src={coverSrc || undefined}
          alt=""
          loading="lazy"
        />
        {!record.missing && (
          <div className={classes.overlay}>
            <PlayButton record={record} size="small" className={classes.play} />
          </div>
        )}
      </div>
      <OverflowTooltip title={record.name || ''}>
        <Typography className={classes.title}>{record.name}</Typography>
      </OverflowTooltip>
      {subtitle ? (
        <OverflowTooltip title={subtitle}>
          <Typography className={classes.subtitle}>{subtitle}</Typography>
        </OverflowTooltip>
      ) : null}
    </Link>
  )
}

export default MediaCard
