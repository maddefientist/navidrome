import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useDispatch, useSelector } from 'react-redux'
import { useAuthState, useDataProvider, useTranslate } from 'react-admin'
import { Player } from './Player'

vi.mock('react-redux', () => ({
  useDispatch: vi.fn(),
  useSelector: vi.fn(),
}))

vi.mock('react-admin', async () => {
  const actual = await vi.importActual('react-admin')
  return {
    ...actual,
    useAuthState: vi.fn(),
    useDataProvider: vi.fn(),
    useTranslate: vi.fn(),
  }
})

vi.mock('navidrome-music-player', () => ({
  default: () => <div data-testid="music-player" />,
}))

vi.mock('navidrome-music-player/assets/index.css', () => ({}))

vi.mock('../common', () => ({
  useInterval: vi.fn(),
}))

describe('<Player />', () => {
  const fakeState = {
    player: {
      queue: [],
      mode: 'order',
      volume: 1,
      current: {},
    },
    settings: { notifications: false },
    replayGain: { gainMode: 'none' },
    theme: 'DarkTheme',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    useDispatch.mockReturnValue(vi.fn())
    useSelector.mockImplementation((selector) => selector(fakeState))
    useAuthState.mockReturnValue({ authenticated: false })
    useDataProvider.mockReturnValue({ getOne: vi.fn() })
    useTranslate.mockReturnValue((key) => key)
  })

  // Regression test for a production crash: Player used to compute isDesktop
  // via `useMediaQuery((theme) => theme.breakpoints.up('md'))`, which reads
  // the Material-UI theme from React context. Player is mounted alongside
  // (not inside) the login page's own ThemeProvider, so on the login route
  // that context theme is null and the callback threw
  // "Cannot read properties of null (reading 'breakpoints')", breaking login.
  // Rendering <Player /> with no wrapping Material-UI ThemeProvider
  // reproduces that missing-context condition.
  it('mounts without an outer Material-UI ThemeProvider (e.g. on the login route)', () => {
    expect(() => render(<Player />)).not.toThrow()
    expect(screen.getByTestId('music-player')).toBeInTheDocument()
  })
})
