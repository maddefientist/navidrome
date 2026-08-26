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

const renderMenu = (queue = []) => {
  const store = createStore(() => ({
    admin: { ui: { sidebarOpen: true } },
    player: { queue },
    resources: [],
  }))
  return render(
    <Provider store={store}>
      <ThemeProvider theme={createTheme()}>
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
})
