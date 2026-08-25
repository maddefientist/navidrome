import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ThemeProvider, createTheme } from '@material-ui/core/styles'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { HomeRail } from './HomeRail'

vi.mock('../common', () => ({
  OverflowTooltip: ({ children }) => children,
  PlayButton: () => <button type="button">play</button>,
}))

vi.mock('../subsonic', () => ({
  default: {
    getCoverArtUrl: (record) => `cover-${record.id}`,
  },
}))

vi.mock('react-admin', () => ({
  useTranslate:
    () =>
    (key, options = {}) =>
      options._ || key,
}))

const albums = [
  { id: 'a1', name: 'Visible Album', albumArtist: 'Artist One' },
  { id: 'a2', name: 'Missing Album', missing: true },
]

const renderRail = (props = {}) =>
  render(
    <MemoryRouter>
      <ThemeProvider theme={createTheme()}>
        <HomeRail
          id="recentlyAdded"
          title="Recently added"
          sourceLabel="Local library · date added"
          destination="/album/recentlyAdded"
          items={albums}
          {...props}
        />
      </ThemeProvider>
    </MemoryRouter>,
  )

describe('HomeRail', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('links See all to the existing album destination and hides missing albums', () => {
    renderRail()

    expect(screen.getByTestId('see-all-recentlyAdded')).toHaveAttribute(
      'href',
      '/album/recentlyAdded',
    )
    expect(screen.getByText('Visible Album')).toBeInTheDocument()
    expect(screen.queryByText('Missing Album')).not.toBeInTheDocument()
    expect(screen.getByText('Local library · date added')).toBeInTheDocument()
  })

  it('reserves snap geometry while a local rail is loading', () => {
    renderRail({ loading: true, items: [] })
    expect(screen.getAllByTestId('rail-skeleton-card')).toHaveLength(6)
    expect(
      screen.getByRole('status', { name: 'Loading albums' }),
    ).toBeInTheDocument()
  })

  it('renders an empty local shelf without inventing connected sources', () => {
    renderRail({ items: [] })

    expect(screen.getByText('No albums in this shelf yet.')).toBeInTheDocument()
    expect(screen.queryByText(/listenbrainz/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/ollama/i)).not.toBeInTheDocument()
  })

  it('exposes a retry action when a local request fails', () => {
    const onRetry = vi.fn()
    renderRail({ items: [], error: true, onRetry })

    expect(screen.queryByTestId('rail-skeleton-card')).not.toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Could not load this shelf.',
    )
    fireEvent.click(screen.getByRole('button', { name: /try again/i }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('honors reduced motion on the snap scroller', () => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: vi.fn((query) => ({
        matches: query.includes('prefers-reduced-motion'),
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })

    renderRail()
    expect(screen.getByTestId('home-rail-recentlyAdded')).toHaveAttribute(
      'data-reduced-motion',
      'true',
    )
  })
})
