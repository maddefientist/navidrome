import React, { useState } from 'react'
import { useSelector } from 'react-redux'
import { useLocation } from 'react-router-dom'
import { Divider, makeStyles } from '@material-ui/core'
import clsx from 'clsx'
import { useTranslate, MenuItemLink, getResources } from 'react-admin'
import ViewListIcon from '@material-ui/icons/ViewList'
import AlbumIcon from '@material-ui/icons/Album'
import HomeOutlinedIcon from '@material-ui/icons/HomeOutlined'
import HomeIcon from '@material-ui/icons/Home'
import LibraryMusicOutlinedIcon from '@material-ui/icons/LibraryMusicOutlined'
import SubMenu from './SubMenu'
import { humanize, pluralize } from 'inflection'
import albumLists from '../album/albumLists'
import PlaylistsSubMenu from './PlaylistsSubMenu'
import LibrarySelector from '../common/LibrarySelector'
import config from '../config'

const useStyles = makeStyles(
  (theme) => ({
    root: {
      marginTop: theme.spacing(1),
      marginBottom: theme.spacing(1),
      transition: theme.transitions.create('width', {
        easing: theme.transitions.easing.sharp,
        duration: theme.transitions.duration.leavingScreen,
      }),
      paddingBottom: (props) => (props.addPadding ? '96px' : '24px'),
    },
    open: {
      width: 248,
    },
    closed: {
      width: 56,
    },
    active: {
      color: theme.palette.text.primary,
      fontWeight: 700,
      '& .MuiListItemIcon-root': {
        color: 'inherit',
      },
    },
    menuItem: {
      minHeight: 48,
      minWidth: 48,
      borderRadius: theme.spacing(1),
      margin: theme.spacing(0.25, 1),
      color: theme.palette.text.primary,
      '& .MuiListItemIcon-root': {
        color: 'inherit',
      },
      '&:focus-visible': {
        outline: `2px solid ${theme.palette.primary.main}`,
        outlineOffset: 2,
      },
    },
  }),
  { name: 'NDMenu' },
)

const translatedResourceName = (resource, translate) =>
  translate(`resources.${resource.name}.name`, {
    smart_count: 2,
    _:
      resource.options && resource.options.label
        ? translate(resource.options.label, {
            smart_count: 2,
            _: resource.options.label,
          })
        : humanize(pluralize(resource.name)),
  })

const Menu = ({ dense = false }) => {
  const open = useSelector((state) => state.admin.ui.sidebarOpen)
  const translate = useTranslate()
  const location = useLocation()
  const queue = useSelector((state) => state.player?.queue)
  const classes = useStyles({ addPadding: queue.length > 0 })
  const resources = useSelector(getResources)
  const listenNowActive = location.pathname === '/'

  // TODO State is not persisted in mobile when you close the sidebar menu. Move to redux?
  const [state, setState] = useState({
    menuCollection: true,
    menuAlbumList: false,
    menuPlaylists: true,
    menuSharedPlaylists: true,
  })

  const handleToggle = (menu) => {
    setState((state) => ({ ...state, [menu]: !state[menu] }))
  }

  const renderResourceMenuItemLink = (resource) => (
    <MenuItemLink
      key={resource.name}
      to={`/${resource.name}`}
      className={classes.menuItem}
      activeClassName={classes.active}
      primaryText={translatedResourceName(resource, translate)}
      leftIcon={resource.icon || <ViewListIcon />}
      sidebarIsOpen={open}
      dense={dense}
    />
  )

  const renderAlbumMenuItemLink = (type, al) => {
    const resource = resources.find((r) => r.name === 'album')
    if (!resource) {
      return null
    }

    const albumListAddress = `/album/${type}`

    const name = translate(`resources.album.lists.${type || 'default'}`, {
      _: translatedResourceName(resource, translate),
    })

    return (
      <MenuItemLink
        key={albumListAddress}
        to={albumListAddress}
        className={classes.menuItem}
        activeClassName={classes.active}
        primaryText={name}
        leftIcon={al.icon || <ViewListIcon />}
        sidebarIsOpen={open}
        dense={dense}
        exact
      />
    )
  }

  const subItems = (subMenu) => (resource) =>
    resource.hasList && resource.options && resource.options.subMenu === subMenu

  return (
    <div
      className={clsx(classes.root, {
        [classes.open]: open,
        [classes.closed]: !open,
      })}
    >
      {open && <LibrarySelector />}
      <MenuItemLink
        to="/"
        exact
        className={classes.menuItem}
        activeClassName={classes.active}
        primaryText={translate('menu.listenNow', { _: 'Listen Now' })}
        leftIcon={listenNowActive ? <HomeIcon /> : <HomeOutlinedIcon />}
        sidebarIsOpen={open}
        dense={dense}
      />
      <SubMenu
        handleToggle={() => handleToggle('menuCollection')}
        isOpen={state.menuCollection}
        sidebarIsOpen={open}
        name="menu.library"
        icon={<LibraryMusicOutlinedIcon />}
        dense={dense}
      >
        {resources.filter(subItems(undefined)).map(renderResourceMenuItemLink)}
        <SubMenu
          handleToggle={() => handleToggle('menuAlbumList')}
          isOpen={state.menuAlbumList}
          sidebarIsOpen={open}
          name="menu.albumList"
          icon={<AlbumIcon />}
          dense={dense}
        >
          {Object.keys(albumLists).map((type) =>
            renderAlbumMenuItemLink(type, albumLists[type]),
          )}
        </SubMenu>
      </SubMenu>
      {config.devSidebarPlaylists && open ? (
        <>
          <Divider />
          <PlaylistsSubMenu
            state={state}
            setState={setState}
            sidebarIsOpen={open}
            dense={dense}
          />
        </>
      ) : (
        resources.filter(subItems('playlist')).map(renderResourceMenuItemLink)
      )}
    </div>
  )
}

export default Menu
