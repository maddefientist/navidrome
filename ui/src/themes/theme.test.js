import themes from './index'
import { describe, it, expect } from 'vitest'

describe('NDPlaylistDetails styles', () => {
  const themeEntries = Object.entries(themes)

  it.each(themeEntries)(
    '%s should not set minWidth on details',
    (themeName, theme) => {
      const details = theme.overrides?.NDPlaylistDetails?.details
      expect(details?.minWidth).toBeUndefined()
    },
  )
})

describe('dark sidebar contrast', () => {
  const contrastThemes = Object.values(themes)
    .filter((theme) =>
      ['Dark', 'Spotify-ish', 'AMusic'].includes(theme.themeName),
    )
    .map((theme) => [theme.themeName, theme])

  it.each(contrastThemes)(
    '%s defines a dark RaSidebar drawerPaper surface with legible navigation colors',
    (_themeName, theme) => {
      const drawerPaper = theme.overrides?.RaSidebar?.drawerPaper
      const drawerSurface =
        theme.overrides?.MuiDrawer?.paper?.backgroundColor ||
        theme.overrides?.MuiDrawer?.root?.background
      const menu = theme.overrides?.RaMenuItemLink

      expect(drawerPaper?.backgroundColor).toEqual(
        expect.stringMatching(/!important/i),
      )
      expect(drawerPaper?.backgroundColor.toLowerCase()).not.toMatch(
        /#fff(?:fff)?\b|white/,
      )
      expect(drawerSurface).toBeTruthy()
      expect(String(drawerSurface).toLowerCase()).not.toMatch(
        /#fff(?:fff)?\b|white/,
      )
      expect(drawerPaper?.color).toBeTruthy()
      expect(menu?.root?.minHeight).toBe(48)
      expect(menu?.root?.color).toBeTruthy()
      expect(menu?.root?.['& .MuiListItemIcon-root']?.color).toBeTruthy()
      expect(menu?.active?.color).toBeTruthy()
      expect(menu?.root?.['&:focus-visible']?.outline).toEqual(
        expect.stringMatching(/solid/),
      )
    },
  )
})
