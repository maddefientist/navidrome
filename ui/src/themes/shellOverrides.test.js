import { describe, it, expect } from 'vitest'
import themes from './index'
import {
  getShellThemedTheme,
  SIDEBAR_WIDTH,
  SIDEBAR_CLOSED_WIDTH,
} from './useCurrentTheme'

describe('shell overrides', () => {
  const themeEntries = Object.entries(themes)

  it.each(themeEntries)(
    '%s receives the shared sidebar width contract',
    (_themeName, theme) => {
      const merged = getShellThemedTheme(theme)
      expect(merged.sidebar.width).toBe(SIDEBAR_WIDTH)
      expect(merged.sidebar.closedWidth).toBe(SIDEBAR_CLOSED_WIDTH)
      expect(SIDEBAR_WIDTH).toBe(248)
      expect(SIDEBAR_CLOSED_WIDTH).toBe(72)
    },
  )

  it.each(themeEntries)(
    '%s contains RaLayout and RaList within the document',
    (_themeName, theme) => {
      const merged = getShellThemedTheme(theme)
      expect(merged.overrides.RaLayout.root.minWidth).toBe(0)
      expect(merged.overrides.RaLayout.content.minWidth).toBe(0)
      expect(merged.overrides.RaList.content.minWidth).toBe(0)
      expect(merged.overrides.RaList.content.overflowX).toBe('auto')
    },
  )

  it.each(themeEntries)(
    '%s preserves its pre-existing overrides after merge',
    (_themeName, theme) => {
      const merged = getShellThemedTheme(theme)
      const originalOverrides = theme.overrides || {}

      const walk = (original, mergedNode) => {
        Object.keys(original).forEach((key) => {
          const originalValue = original[key]
          if (
            originalValue &&
            typeof originalValue === 'object' &&
            !Array.isArray(originalValue)
          ) {
            walk(originalValue, mergedNode[key])
          } else {
            expect(mergedNode[key]).toEqual(originalValue)
          }
        })
      }

      walk(originalOverrides, merged.overrides)
    },
  )

  it.each(themeEntries)(
    '%s returns a referentially stable merged theme for repeated calls',
    (_themeName, theme) => {
      const first = getShellThemedTheme(theme)
      const second = getShellThemedTheme(theme)
      expect(first).toBe(second)
    },
  )

  it('produces distinct merged themes for distinct base themes', () => {
    const merged = themeEntries.map(([, theme]) => getShellThemedTheme(theme))
    const uniqueRefs = new Set(merged)
    expect(uniqueRefs.size).toBe(merged.length)
  })
})
