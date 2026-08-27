import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ThemeProvider, createTheme } from '@material-ui/core/styles'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MediaCard } from './MediaCard'

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

const renderCard = (record) =>
  render(
    <MemoryRouter>
      <ThemeProvider theme={createTheme()}>
        <MediaCard record={record} />
      </ThemeProvider>
    </MemoryRouter>,
  )

describe('MediaCard', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('keeps a one-line ellipsized title/subtitle that cannot widen the card', () => {
    const longTitle = 'B'.repeat(300)
    renderCard({ id: 'a1', name: longTitle, albumArtist: 'Artist' })

    const title = screen.getByText(longTitle)
    const style = getComputedStyle(title)

    expect(style.whiteSpace).toBe('nowrap')
    expect(style.overflow).toBe('hidden')
    expect(style.textOverflow).toBe('ellipsis')
    expect(style.maxWidth).toBe('100%')
  })

  it('renders a neutral fallback instead of a broken image glyph on artwork error', () => {
    renderCard({ id: 'a2', name: 'Album Two', albumArtist: 'Artist Two' })

    const img = screen.getByAltText('')
    fireEvent.error(img)

    expect(screen.getByTestId('media-cover-fallback')).toBeInTheDocument()
    expect(screen.queryByAltText('')).not.toBeInTheDocument()
  })

  it('preserves the accessible album name on the enclosing link', () => {
    renderCard({ id: 'a3', name: 'Album Three', albumArtist: 'Artist Three' })

    expect(
      screen.getByRole('link', { name: 'Album Three' }),
    ).toBeInTheDocument()
  })
})
