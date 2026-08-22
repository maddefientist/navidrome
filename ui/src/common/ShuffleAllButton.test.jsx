import React from 'react'
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { TestContext } from 'ra-test'
import { ThemeProvider, createTheme } from '@material-ui/core/styles'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ShuffleAllButton } from './ShuffleAllButton'
import { createShuffleSeed } from './shuffleSeed'

const mockDispatch = vi.fn()
const mockGetMany = vi.fn()
const mockNotify = vi.fn()
const mockHttpClient = vi.fn()

vi.mock('react-redux', () => ({ useDispatch: () => mockDispatch }))
vi.mock('../dataProvider', () => ({
  httpClient: (...args) => mockHttpClient(...args),
}))
vi.mock('react-admin', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    useDataProvider: () => ({ getMany: mockGetMany }),
    useNotify: () => mockNotify,
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
  }
})

const songs = {
  'song-1': {
    id: 'song-1',
    title: 'First Song',
    artist: 'Artist One',
    album: 'First Album',
    duration: 180,
    updatedAt: '2026-08-21T00:00:00Z',
  },
  'song-2': {
    id: 'song-2',
    title: 'Second Song',
    artist: 'Artist Two',
    album: 'Second Album',
    duration: 240,
    updatedAt: '2026-08-21T00:00:00Z',
  },
}

const previewResponse = (overrides = {}) => ({
  json: {
    entries: [
      { id: 'song-2', reason: 'library_shuffle' },
      { id: 'song-1', reason: 'library_shuffle' },
    ],
    degraded: false,
    degradations: [],
    ...overrides,
  },
})

const renderButton = (filters = {}) =>
  render(
    <TestContext>
      <ThemeProvider theme={createTheme()}>
        <ShuffleAllButton filters={filters} />
      </ThemeProvider>
    </TestContext>,
  )

const openPreview = () =>
  fireEvent.click(screen.getByRole('button', { name: /shuffle library/i }))

const setMediaQueries = ({ mobile = false, reducedMotion = false } = {}) => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn((query) => ({
      matches:
        (mobile && query.includes('max-width')) ||
        (reducedMotion && query.includes('prefers-reduced-motion')),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
}

describe('ShuffleAllButton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setMediaQueries()
    vi.spyOn(window.crypto, 'randomUUID').mockReturnValue('stable-ui-seed')
    localStorage.setItem('username', 'listener')
    localStorage.setItem('subsonic-token', 'token')
    localStorage.setItem('subsonic-salt', 'salt')
    mockHttpClient.mockResolvedValue(previewResponse())
    mockGetMany.mockResolvedValue({ data: [songs['song-1'], songs['song-2']] })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it('creates a usable seed when Web Crypto is unavailable on a LAN origin', () => {
    const fallbackInputs = {
      now: () => 1724300000000,
      random: () => 0.25,
    }

    expect(createShuffleSeed({ cryptoProvider: null, ...fallbackInputs })).toBe(
      'shuffle-m04rp728-9',
    )
    expect(createShuffleSeed({ cryptoProvider: {}, ...fallbackInputs })).toBe(
      'shuffle-m04rp728-9',
    )
  })

  it('previews in API order and changes playback only after confirmation', async () => {
    renderButton({ library_id: ['2', 4] })
    openPreview()

    await waitFor(() => expect(mockHttpClient).toHaveBeenCalledTimes(1))
    const [url, options] = mockHttpClient.mock.calls[0]
    expect(url).toBe('/api/mix/preview')
    expect(options.method).toBe('POST')
    expect(JSON.parse(options.body)).toEqual({
      mode: 'pure_shuffle',
      seed: 'stable-ui-seed',
      limit: 100,
      artistSpacing: 2,
      libraryIds: [2, 4],
    })

    await waitFor(() =>
      expect(mockGetMany).toHaveBeenCalledWith('song', {
        ids: ['song-2', 'song-1'],
      }),
    )
    expect(mockDispatch).not.toHaveBeenCalled()

    const list = await screen.findByRole('list', {
      name: 'shuffle-preview-tracks',
    })
    const items = within(list).getAllByRole('listitem')
    expect(items[0]).toHaveTextContent('Second Song')
    expect(items[0]).toHaveTextContent('Artist Two · Second Album')
    expect(items[1]).toHaveTextContent('First Song')
    expect(items[0]).not.toHaveTextContent('Seeded library shuffle')
    expect(screen.getAllByText('Seeded library shuffle')).toHaveLength(1)
    expect(screen.getByText(/2 tracks · 07:00/)).toBeInTheDocument()
    expect(within(items[0]).getByRole('img')).toHaveAttribute(
      'src',
      expect.stringContaining('mf-song-2'),
    )

    fireEvent.click(screen.getByTestId('confirm-shuffle-preview'))

    expect(mockDispatch).toHaveBeenCalledTimes(1)
    const action = mockDispatch.mock.calls[0][0]
    expect(action.id).toBe('song-2')
    expect(Object.keys(action.data)).toEqual(['song-2', 'song-1'])
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    )
  })

  it('invalidates an in-flight preview when cancelled', async () => {
    let resolvePreview
    mockHttpClient.mockReturnValue(
      new Promise((resolve) => {
        resolvePreview = resolve
      }),
    )
    renderButton()
    openPreview()

    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    )

    await act(async () => {
      resolvePreview(previewResponse())
      await Promise.resolve()
    })

    expect(mockGetMany).not.toHaveBeenCalled()
    expect(mockDispatch).not.toHaveBeenCalled()
    expect(mockNotify).not.toHaveBeenCalled()
  })

  it('reserves the preview geometry while the initial request loads', async () => {
    mockHttpClient.mockReturnValue(new Promise(() => {}))
    renderButton()
    openPreview()

    expect(await screen.findByRole('dialog')).toHaveAttribute(
      'aria-labelledby',
      'shuffle-preview-title',
    )
    expect(screen.getAllByTestId('preview-skeleton-row')).toHaveLength(10)
    expect(screen.getByTestId('confirm-shuffle-preview')).toBeDisabled()
    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument()
  })

  it('keeps a valid preview playable when trying another shuffle fails', async () => {
    mockHttpClient
      .mockResolvedValueOnce(previewResponse())
      .mockRejectedValueOnce(new Error('retry unavailable'))
    renderButton()
    openPreview()

    const list = await screen.findByRole('list', {
      name: 'shuffle-preview-tracks',
    })
    fireEvent.click(screen.getByRole('button', { name: /try another/i }))

    await waitFor(() => expect(mockNotify).toHaveBeenCalledTimes(1))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(list).toHaveTextContent('Second Song')
    expect(mockDispatch).not.toHaveBeenCalled()

    fireEvent.click(screen.getByTestId('confirm-shuffle-preview'))
    expect(mockDispatch).toHaveBeenCalledTimes(1)
    expect(Object.keys(mockDispatch.mock.calls[0][0].data)).toEqual([
      'song-2',
      'song-1',
    ])
  })

  it('uses a full-screen, immediate-transition dialog when requested', async () => {
    setMediaQueries({ mobile: true, reducedMotion: true })
    renderButton()
    openPreview()

    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveClass('MuiDialog-paperFullScreen')
    await screen.findByRole('list', { name: 'shuffle-preview-tracks' })
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    )
  })

  it('notifies and preserves playback when the preview request fails', async () => {
    mockHttpClient.mockRejectedValue(new Error('network unavailable'))
    renderButton()
    openPreview()

    await waitFor(() => expect(mockNotify).toHaveBeenCalledTimes(1))
    expect(mockNotify.mock.calls[0][1]).toBe('warning')
    expect(mockDispatch).not.toHaveBeenCalled()
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    )
  })

  it('rejects an empty usable preview without mutating playback', async () => {
    mockHttpClient.mockResolvedValue(previewResponse({ entries: [] }))
    renderButton()
    openPreview()

    await waitFor(() => expect(mockNotify).toHaveBeenCalledTimes(1))
    expect(mockGetMany).not.toHaveBeenCalled()
    expect(mockDispatch).not.toHaveBeenCalled()
  })

  it('shows degradation and filters songs that became missing', async () => {
    mockHttpClient.mockResolvedValue(
      previewResponse({ degraded: true, degradations: ['artist_spacing'] }),
    )
    mockGetMany.mockResolvedValue({
      data: [songs['song-1'], { ...songs['song-2'], missing: true }],
    })
    renderButton()
    openPreview()

    expect(
      await screen.findByText(
        'Some spacing or availability preferences could not be fully maintained.',
      ),
    ).toHaveAttribute('role', 'status')

    fireEvent.click(screen.getByTestId('confirm-shuffle-preview'))
    expect(mockDispatch).toHaveBeenCalledTimes(1)
    const action = mockDispatch.mock.calls[0][0]
    expect(Object.keys(action.data)).toEqual(['song-1'])
  })
})
