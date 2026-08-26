import React from 'react'
import { render, screen } from '@testing-library/react'
import { Provider } from 'react-redux'
import { createStore } from 'redux'
import { ThemeProvider, createTheme } from '@material-ui/core/styles'
import { describe, expect, it, vi } from 'vitest'
import Layout from './Layout'

vi.mock('react-admin', () => ({
  Layout: ({ className }) => (
    <div data-testid="layout-root" className={className} />
  ),
  toggleSidebar: () => ({ type: 'RA/TOGGLE_SIDEBAR' }),
}))

vi.mock('react-hotkeys', () => ({
  HotKeys: ({ children }) => children,
}))

vi.mock('./Menu', () => ({ default: () => null }))
vi.mock('./AppBar', () => ({ default: () => null }))
vi.mock('./Notification', () => ({ default: () => null }))
vi.mock('../themes/useCurrentTheme', () => ({
  default: () => createTheme(),
}))
vi.mock('../common', () => ({
  useSearchRefocus: () => {},
}))

const injectedCss = () =>
  Array.from(document.querySelectorAll('style'))
    .map((node) => node.textContent || '')
    .join('\n')

const renderLayout = (queue = []) => {
  const store = createStore(() => ({ player: { queue } }))
  return render(
    <Provider store={store}>
      <ThemeProvider theme={createTheme()}>
        <Layout />
      </ThemeProvider>
    </Provider>,
  )
}

describe('<Layout />', () => {
  it('uses a 100vh shell with a 100dvh override and no player padding without a queue', () => {
    renderLayout([])
    const root = screen.getByTestId('layout-root')
    const css = injectedCss()

    expect(root.className).toBeTruthy()
    expect(css).toMatch(/min-height:\s*100vh/)
    expect(css).toContain('@supports (min-height: 100dvh)')
    expect(css).toMatch(/min-height:\s*100dvh/)
    expect(css).not.toContain('calc(96px + env(safe-area-inset-bottom, 0px))')
  })

  it('reserves the player footprint plus the bottom safe-area when a queue is present', () => {
    renderLayout([{ id: 'song-1' }])
    const root = screen.getByTestId('layout-root')
    const css = injectedCss()

    expect(css).toMatch(/min-height:\s*100vh/)
    expect(css).toContain('@supports (min-height: 100dvh)')
    expect(css).toMatch(/min-height:\s*100dvh/)
    const paddingBottom = getComputedStyle(root).paddingBottom
    expect(paddingBottom).toContain('calc(96px')
    expect(paddingBottom).toContain('safe-area-inset-bottom')
  })
})
