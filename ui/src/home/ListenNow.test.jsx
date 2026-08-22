import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ThemeProvider, createTheme } from '@material-ui/core/styles'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ListenNow } from './ListenNow'

const mockGetList = vi.fn()
const mockDispatch = vi.fn()
let selectedLibraries = [2, 4]

vi.mock('react-redux', () => ({
  useSelector: (selector) =>
    selector({
      library: { selectedLibraries },
      player: { queue: [] },
    }),
  useDispatch: () => mockDispatch,
}))

const dataProvider = { getList: (...args) => mockGetList(...args) }

vi.mock('react-admin', () => ({
  Title: () => null,
  useDataProvider: () => dataProvider,
  useTranslate:
    () =>
    (key, options = {}) => {
      const value = options._ || key
      return Object.entries(options).reduce(
        (text, [name, replacement]) =>
          name === '_' ? text : text.replace(`%{${name}}`, replacement),
        value,
      )
    },
}))

vi.mock('../common', () => ({
  OverflowTooltip: ({ children }) => children,
  PlayButton: () => <button type="button">play album</button>,
  ShuffleAllButton: ({ filters }) => (
    <button
      type="button"
      data-testid="hero-shuffle"
      data-filters={JSON.stringify(filters)}
    >
      Shuffle library
    </button>
  ),
}))

vi.mock('../subsonic', () => ({
  default: {
    getCoverArtUrl: (record) => `cover-${record.id}`,
  },
}))

vi.mock('../config', () => ({
  default: {
    enableFavourites: true,
    uiCoverArtSize: 300,
  },
}))

const albums = {
  recentlyAdded: [{ id: 'new-1', name: 'Newest Album', albumArtist: 'A' }],
  recentlyPlayed: [{ id: 'played-1', name: 'Played Album', albumArtist: 'B' }],
  starred: [{ id: 'star-1', name: 'Loved Album', albumArtist: 'C' }],
  random: [{ id: 'rand-1', name: 'Random Album', albumArtist: 'D' }],
}

const resolveBySort = (params) => {
  const field = params?.sort?.field
  if (field === 'recently_added') {
    return { data: albums.recentlyAdded, total: 1 }
  }
  if (field === 'play_date') {
    return { data: albums.recentlyPlayed, total: 1 }
  }
  if (field === 'starred_at') {
    return { data: albums.starred, total: 1 }
  }
  if (field === 'random') {
    return { data: albums.random, total: 1 }
  }
  return { data: [], total: 0 }
}

const renderPage = () =>
  render(
    <MemoryRouter>
      <ThemeProvider theme={createTheme()}>
        <ListenNow />
      </ThemeProvider>
    </MemoryRouter>,
  )

describe('ListenNow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    selectedLibraries = [2, 4]
    mockGetList.mockImplementation((_resource, params) =>
      Promise.resolve(resolveBySort(params)),
    )
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('loads local album rails and forwards selected libraries', async () => {
    renderPage()

    expect(screen.getByTestId('listen-now-hero')).toBeInTheDocument()
    expect(screen.getByTestId('hero-shuffle')).toHaveAttribute(
      'data-filters',
      JSON.stringify({ library_id: [2, 4] }),
    )

    await waitFor(() => expect(mockGetList).toHaveBeenCalledTimes(4))
    const requests = mockGetList.mock.calls.map(([, params]) => params)
    requests.forEach((params) => {
      expect(params.pagination).toEqual({ page: 1, perPage: 12 })
      expect(params.filter.library_id).toEqual([2, 4])
    })
    expect(requests.map((params) => params.sort.field).sort()).toEqual([
      'play_date',
      'random',
      'recently_added',
      'starred_at',
    ])

    expect(await screen.findByText('Newest Album')).toBeInTheDocument()
    expect(screen.getByText('Played Album')).toBeInTheDocument()
    expect(screen.getByText('Loved Album')).toBeInTheDocument()
    expect(screen.getByText('Random Album')).toBeInTheDocument()
    expect(screen.getByTestId('see-all-recentlyAdded')).toHaveAttribute(
      'href',
      '/album/recentlyAdded',
    )
    expect(screen.getByTestId('see-all-recentlyPlayed')).toHaveAttribute(
      'href',
      '/album/recentlyPlayed',
    )
    expect(screen.getByTestId('see-all-favourites')).toHaveAttribute(
      'href',
      '/album/starred',
    )
    expect(screen.getByTestId('see-all-discover')).toHaveAttribute(
      'href',
      '/album/random',
    )
    expect(mockDispatch).not.toHaveBeenCalled()
  })

  it('does not autoplay or mutate the queue on mount', async () => {
    renderPage()
    await waitFor(() => expect(mockGetList).toHaveBeenCalled())
    expect(mockDispatch).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('omits library filters when no libraries are selected', async () => {
    selectedLibraries = []
    renderPage()

    await waitFor(() => expect(mockGetList).toHaveBeenCalled())
    expect(screen.getByTestId('hero-shuffle')).toHaveAttribute(
      'data-filters',
      JSON.stringify({}),
    )
    mockGetList.mock.calls.forEach(([, params]) => {
      expect(params.filter.library_id).toBeUndefined()
    })
  })

  it('shows empty and error states without claiming external sources', async () => {
    mockGetList.mockImplementation((_resource, params) => {
      if (params.sort.field === 'recently_added') {
        return Promise.resolve({ data: [], total: 0 })
      }
      if (params.sort.field === 'play_date') {
        return Promise.reject(new Error('history unavailable'))
      }
      return Promise.resolve({ data: [], total: 0 })
    })

    renderPage()

    expect(
      await screen.findByText('Newly imported albums will appear here.'),
    ).toBeInTheDocument()
    expect(screen.getByText('Could not load this shelf.')).toBeInTheDocument()
    expect(screen.queryByText(/listenbrainz/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/lidarr/i)).not.toBeInTheDocument()
    expect(mockDispatch).not.toHaveBeenCalled()
  })
})
