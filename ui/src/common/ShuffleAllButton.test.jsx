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
  'song-1': { id: 'song-1', title: 'First Song', artist: 'Artist One' },
  'song-2': { id: 'song-2', title: 'Second Song', artist: 'Artist Two' },
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

describe('ShuffleAllButton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(window.crypto, 'randomUUID').mockReturnValue('stable-ui-seed')
    mockHttpClient.mockResolvedValue(previewResponse())
    mockGetMany.mockResolvedValue({ data: [songs['song-1'], songs['song-2']] })
  })

  afterEach(() => {
    vi.restoreAllMocks()
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
    expect(items[1]).toHaveTextContent('First Song')
    expect(items[0]).toHaveTextContent('Seeded library shuffle')

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
