import { useSelector } from 'react-redux'
import useMediaQuery from '@material-ui/core/useMediaQuery'
import deepmerge from 'deepmerge'
import themes from './index'
import { AUTO_THEME_ID } from '../consts'
import config from '../config'
import { useEffect } from 'react'

export const SIDEBAR_WIDTH = 248
export const SIDEBAR_CLOSED_WIDTH = 72

const SHELL_OVERRIDES = {
  sidebar: {
    width: SIDEBAR_WIDTH,
    closedWidth: SIDEBAR_CLOSED_WIDTH,
  },
  overrides: {
    RaLayout: {
      root: {
        minWidth: 0,
      },
      content: {
        minWidth: 0,
      },
    },
    RaList: {
      content: {
        minWidth: 0,
        overflowX: 'auto',
      },
    },
  },
}

// Cache keeps merged shell overrides referentially stable per base theme,
// preventing React Admin from rebuilding on every render.
const mergedThemeCache = new WeakMap()

export const getShellThemedTheme = (baseTheme) => {
  if (mergedThemeCache.has(baseTheme)) {
    return mergedThemeCache.get(baseTheme)
  }
  const merged = deepmerge(baseTheme, SHELL_OVERRIDES)
  mergedThemeCache.set(baseTheme, merged)
  return merged
}

const useCurrentTheme = () => {
  const prefersLightMode = useMediaQuery('(prefers-color-scheme: light)')
  const theme = useSelector((state) => {
    let baseTheme
    if (state.theme === AUTO_THEME_ID) {
      baseTheme = prefersLightMode ? themes.LightTheme : themes.DarkTheme
    } else {
      const themeName =
        Object.keys(themes).find((t) => t === state.theme) ||
        Object.keys(themes).find(
          (t) => themes[t].themeName === config.defaultTheme,
        ) ||
        'DarkTheme'
      baseTheme = themes[themeName]
    }
    return getShellThemedTheme(baseTheme)
  })

  useEffect(() => {
    const styles = document.getElementsByTagName('style')
    let style
    for (let i = 0; i < styles.length; i++) {
      if (styles[i].id === 'nd-player-style-override') {
        style = styles[i]
      }
    }
    if (theme.player.stylesheet) {
      if (style === undefined) {
        style = document.createElement('style')
        style.id = 'nd-player-style-override'
        style.innerHTML = theme.player.stylesheet
        document.head.appendChild(style)
      } else {
        style.innerHTML = theme.player.stylesheet
      }
    } else {
      if (style !== undefined) {
        document.head.removeChild(style)
      }
    }

    // Set body background color to match theme (fixes white background on pull-to-refresh)
    const isDark = theme.palette?.type === 'dark'
    const bgColor =
      theme.palette?.background?.default || (isDark ? '#303030' : '#fafafa')
    document.body.style.backgroundColor = bgColor
  }, [theme])

  return theme
}

export default useCurrentTheme
