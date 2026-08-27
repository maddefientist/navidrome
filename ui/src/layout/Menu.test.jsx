import React from 'react'
import { render } from '@testing-library/react'
import { Provider } from 'react-redux'
import { createStore } from 'redux'
import { ThemeProvider, createTheme } from '@material-ui/core/styles'
import { describe, expect, it, vi } from 'vitest'
import Menu from './Menu'

vi.mock('react-admin', () => ({
  useTranslate:
    () =>
    (key, options = {}) =>
      options._ || key,
  MenuItemLink: () => null,
  getResources: (state) => state.resources || [],
}))

vi.mock('react-router-dom', () => ({
  useLocation: () => ({ pathname: '/' }),
}))

vi.mock('./SubMenu', () => ({
  default: ({ children }) => <div>{children}</div>,
}))
vi.mock('./PlaylistsSubMenu', () => ({ default: () => null }))
vi.mock('../common/LibrarySelector', () => ({ default: () => null }))
vi.mock('../album/albumLists', () => ({ default: {} }))
vi.mock('../config', () => ({
  default: { devSidebarPlaylists: false },
}))

const injectedCss = () =>
  Array.from(document.querySelectorAll('style'))
    .map((node) => node.textContent || '')
    .join('\n')

const renderMenu = (queue = [], { sidebarOpen = true, theme } = {}) => {
  const store = createStore(() => ({
    admin: { ui: { sidebarOpen } },
    player: { queue },
    resources: [],
  }))
  return render(
    <Provider store={store}>
      <ThemeProvider theme={theme || createTheme()}>
        <Menu />
      </ThemeProvider>
    </Provider>,
  )
}

describe('<Menu />', () => {
  it('reserves its normal spacing plus the bottom safe-area when idle', () => {
    const { container } = renderMenu([])
    const css = injectedCss()

    expect(container.firstChild).toBeTruthy()
    const paddingBottom = getComputedStyle(container.firstChild).paddingBottom
    expect(paddingBottom).toContain('calc(24px')
    expect(paddingBottom).toContain('safe-area-inset-bottom')
    expect(css).not.toContain('calc(96px + env(safe-area-inset-bottom, 0px))')
  })

  it('reserves the player footprint plus the bottom safe-area when a queue is present', () => {
    const { container } = renderMenu([{ id: 'song-1' }])

    const paddingBottom = getComputedStyle(container.firstChild).paddingBottom
    expect(paddingBottom).toContain('calc(96px')
    expect(paddingBottom).toContain('safe-area-inset-bottom')
  })

  it('reads the open/closed widths from the shared theme.sidebar contract', () => {
    const shellTheme = createTheme({ sidebar: { width: 248, closedWidth: 72 } })

    const { container: openContainer } = renderMenu([], {
      sidebarOpen: true,
      theme: shellTheme,
    })
    expect(getComputedStyle(openContainer.firstChild).width).toBe('248px')

    const { container: closedContainer } = renderMenu([], {
      sidebarOpen: false,
      theme: shellTheme,
    })
    expect(getComputedStyle(closedContainer.firstChild).width).toBe('72px')
  })

  it('falls back to the 248/72 contract when theme.sidebar is missing', () => {
    const { container: openContainer } = renderMenu([], { sidebarOpen: true })
    expect(getComputedStyle(openContainer.firstChild).width).toBe('248px')

    const { container: closedContainer } = renderMenu([], {
      sidebarOpen: false,
    })
    expect(getComputedStyle(closedContainer.firstChild).width).toBe('72px')
  })

  it('leaves room for the 56px MUI icon slot within the closed width', () => {
    const shellTheme = createTheme({ sidebar: { width: 248, closedWidth: 72 } })
    const { container } = renderMenu([], {
      sidebarOpen: false,
      theme: shellTheme,
    })

    const closedWidth = parseFloat(getComputedStyle(container.firstChild).width)
    const menuItemMarginX = shellTheme.spacing(1) * 2
    const availableForIcon = closedWidth - menuItemMarginX
    expect(availableForIcon).toBeGreaterThanOrEqual(56)
  })

  it('removes collapsed-row padding and labels so the icon slot is contained', () => {
    renderMenu([], { sidebarOpen: false })
    const css = injectedCss()

    expect(css).toMatch(/\.MuiListItem-root[^}]*justify-content:\s*center/)
    expect(css).toMatch(/\.MuiListItem-root[^}]*padding-left:\s*0/)
    expect(css).toMatch(/\.MuiListItem-root[^}]*padding-right:\s*0/)
    expect(css).toMatch(/\.MuiListItemIcon-root[^}]*min-width:\s*56px/)
    expect(css).toMatch(/\.MuiTypography-root[^}]*display:\s*none/)
  })

  it('keeps a 48px minimum hit target on menu items', () => {
    renderMenu([])
    const css = injectedCss()
    expect(css).toMatch(/min-height:\s*48px/)
    expect(css).toMatch(/min-width:\s*48px/)
  })
})
