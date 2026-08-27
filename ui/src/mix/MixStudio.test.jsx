import React from 'react'
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { ThemeProvider, createTheme } from '@material-ui/core/styles'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MixStudio } from './MixStudio'

const mockDispatch = vi.fn()
const mockGetMany = vi.fn()
const mockHttpClient = vi.fn()
let selectedLibraries = [2, 4]

vi.mock('react-redux', () => ({
  useSelector: (selector) =>
    selector({
      library: { selectedLibraries },
      player: { queue: [] },
    }),
  useDispatch: () => mockDispatch,
}))

vi.mock('../dataProvider', () => ({
  httpClient: (...args) => mockHttpClient(...args),
}))

vi.mock('react-admin', () => ({
  Title: () => null,
  useDataProvider: () => ({ getMany: mockGetMany }),
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

vi.mock('../subsonic', () => ({
  default: {
    getCoverArtUrl: (record) => `cover-${record.id}`,
  },
}))

const songs = {
  'song-1': {
    id: 'song-1',
    title: 'First Song',
    artist: 'Artist One',
    album: 'First Album',
    duration: 180,
  },
  'song-2': {
    id: 'song-2',
    title: 'Second Song',
    artist: 'Artist Two',
    album: 'Second Album',
    duration: 240,
  },
}

const previewPayload = (overrides = {}) => ({
  mode: 'pure_shuffle',
  seed: 'stable-ui-seed',
  tracks: ['song-2', 'song-1'],
  reasons: { 'song-2': 'library_shuffle', 'song-1': 'library_shuffle' },
  degraded: false,
  ...overrides,
})

const renderStudio = () =>
  render(
    <ThemeProvider theme={createTheme()}>
      <MixStudio />
    </ThemeProvider>,
  )

const resolvePlayableSongs = () =>
  mockGetMany.mockResolvedValue({
    data: [songs['song-1'], songs['song-2']],
  })

describe('MixStudio', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    selectedLibraries = [2, 4]
    vi.spyOn(window.crypto, 'randomUUID').mockReturnValue('stable-ui-seed')
    localStorage.setItem('username', 'listener')
  })

  afterEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it('renders three differentiated mode cards as an accessible radio group', () => {
    renderStudio()

    const group = screen.getByRole('radiogroup', { name: 'Mix mode' })
    expect(within(group).getAllByRole('radio')).toHaveLength(3)
    expect(screen.getByTestId('mode-card-pure_shuffle')).toHaveTextContent(
      'Pure Shuffle',
    )
    expect(screen.getByTestId('mode-card-rediscover')).toHaveTextContent(
      'Rediscover',
    )
    expect(screen.getByTestId('mode-card-familiar_fresh')).toHaveTextContent(
      'Familiar + Fresh',
    )
    expect(screen.getByTestId('mode-card-pure_shuffle')).toHaveAttribute(
      'aria-checked',
      'true',
    )

    fireEvent.click(screen.getByTestId('mode-card-rediscover'))
    expect(screen.getByTestId('mode-card-rediscover')).toHaveAttribute(
      'aria-checked',
      'true',
    )
    expect(screen.getByTestId('mode-card-pure_shuffle')).toHaveAttribute(
      'aria-checked',
      'false',
    )
  })

  it('previews pure_shuffle with the frozen request body and selected libraries', async () => {
    mockHttpClient.mockResolvedValue({ json: previewPayload() })
    resolvePlayableSongs()
    renderStudio()

    expect(
      await screen.findByText('Mixing from 2 selected libraries'),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('mix-preview-trigger'))

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
  })

  it('previews the whole accessible library when no library selection exists', async () => {
    selectedLibraries = []
    mockHttpClient.mockResolvedValue({ json: previewPayload() })
    resolvePlayableSongs()
    renderStudio()

    expect(
      await screen.findByText('Mixing from every library you can access'),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('mix-preview-trigger'))

    await waitFor(() => expect(mockHttpClient).toHaveBeenCalledTimes(1))
    expect(JSON.parse(mockHttpClient.mock.calls[0][1].body)).toEqual({
      mode: 'pure_shuffle',
      seed: 'stable-ui-seed',
      limit: 100,
      artistSpacing: 2,
    })
  })

  it('previews rediscover without an adventure value', async () => {
    mockHttpClient.mockResolvedValue({ json: previewPayload() })
    resolvePlayableSongs()
    renderStudio()

    fireEvent.click(screen.getByTestId('mode-card-rediscover'))
    fireEvent.click(screen.getByTestId('mix-preview-trigger'))

    await waitFor(() => expect(mockHttpClient).toHaveBeenCalledTimes(1))
    expect(JSON.parse(mockHttpClient.mock.calls[0][1].body)).toEqual({
      mode: 'rediscover',
      seed: 'stable-ui-seed',
      limit: 100,
      artistSpacing: 2,
      libraryIds: [2, 4],
    })
  })

  it('keeps the adventure control disabled until familiar_fresh is selected', () => {
    renderStudio()

    const slider = screen.getByRole('slider', {
      name: 'Familiar ↔ Fresh adventure',
    })
    expect(slider).toHaveClass('Mui-disabled')

    fireEvent.click(screen.getByTestId('mode-card-familiar_fresh'))
    expect(
      screen.getByRole('slider', { name: 'Familiar ↔ Fresh adventure' }),
    ).not.toHaveClass('Mui-disabled')
  })

  it('sends an explicit 0..100 adventure value for familiar_fresh', async () => {
    mockHttpClient.mockResolvedValue({
      json: previewPayload({ mode: 'familiar_fresh' }),
    })
    resolvePlayableSongs()
    renderStudio()

    fireEvent.click(screen.getByTestId('mode-card-familiar_fresh'))
    const slider = screen.getByRole('slider', {
      name: 'Familiar ↔ Fresh adventure',
    })
    expect(screen.getByTestId('adventure-value')).toHaveTextContent('50 / 100')

    fireEvent.keyDown(slider, { key: 'End' })
    expect(screen.getByTestId('adventure-value')).toHaveTextContent('100 / 100')

    fireEvent.click(screen.getByTestId('mix-preview-trigger'))

    await waitFor(() => expect(mockHttpClient).toHaveBeenCalledTimes(1))
    expect(JSON.parse(mockHttpClient.mock.calls[0][1].body)).toEqual({
      mode: 'familiar_fresh',
      seed: 'stable-ui-seed',
      limit: 100,
      artistSpacing: 2,
      adventure: 100,
      libraryIds: [2, 4],
    })
  })

  it('clamps the adventure control down to 0 without leaking it into other modes', async () => {
    mockHttpClient.mockResolvedValue({ json: previewPayload() })
    resolvePlayableSongs()
    renderStudio()

    fireEvent.click(screen.getByTestId('mode-card-familiar_fresh'))
    fireEvent.keyDown(
      screen.getByRole('slider', { name: 'Familiar ↔ Fresh adventure' }),
      { key: 'Home' },
    )
    expect(screen.getByTestId('adventure-value')).toHaveTextContent('0 / 100')

    fireEvent.click(screen.getByTestId('mode-card-pure_shuffle'))
    fireEvent.click(screen.getByTestId('mix-preview-trigger'))

    await waitFor(() => expect(mockHttpClient).toHaveBeenCalledTimes(1))
    expect(JSON.parse(mockHttpClient.mock.calls[0][1].body)).toEqual({
      mode: 'pure_shuffle',
      seed: 'stable-ui-seed',
      limit: 100,
      artistSpacing: 2,
      libraryIds: [2, 4],
    })
  })

  it('shows the preview and replaces the queue only after explicit confirmation', async () => {
    mockHttpClient.mockResolvedValue({ json: previewPayload() })
    resolvePlayableSongs()
    renderStudio()

    fireEvent.click(screen.getByTestId('mix-preview-trigger'))

    const list = await screen.findByRole('list', {
      name: 'Mix preview tracks',
    })
    const items = within(list).getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(items[0]).toHaveTextContent('Second Song')
    expect(items[0]).toHaveTextContent('Artist Two · Second Album')
    expect(screen.getByText(/2 tracks · 07:00/)).toBeInTheDocument()
    expect(mockDispatch).not.toHaveBeenCalled()

    fireEvent.click(screen.getByTestId('confirm-mix-play'))

    expect(mockDispatch).toHaveBeenCalledTimes(1)
    const action = mockDispatch.mock.calls[0][0]
    expect(action.id).toBe('song-2')
    expect(Object.keys(action.data)).toEqual(['song-2', 'song-1'])
    await waitFor(() =>
      expect(
        screen.queryByRole('list', { name: 'Mix preview tracks' }),
      ).not.toBeInTheDocument(),
    )
  })

  it('shows an actionable error and preserves the queue when the API fails', async () => {
    mockHttpClient
      .mockRejectedValueOnce(new Error('network unavailable'))
      .mockResolvedValueOnce({ json: previewPayload() })
    resolvePlayableSongs()
    renderStudio()

    fireEvent.click(screen.getByTestId('mix-preview-trigger'))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveAttribute('data-testid', 'mix-studio-error')
    expect(alert).toHaveTextContent(
      'The mix engine could not be reached. Playback was not changed.',
    )
    expect(mockDispatch).not.toHaveBeenCalled()
    expect(mockGetMany).not.toHaveBeenCalled()

    fireEvent.click(within(alert).getByRole('button', { name: 'Try again' }))
    expect(
      await screen.findByRole('list', { name: 'Mix preview tracks' }),
    ).toBeInTheDocument()
    expect(mockDispatch).not.toHaveBeenCalled()
  })

  it('shows session-expired guidance when the preview request is unauthorized', async () => {
    mockHttpClient.mockRejectedValue(
      Object.assign(new Error('expired'), { status: 401 }),
    )
    renderStudio()

    fireEvent.click(screen.getByTestId('mix-preview-trigger'))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Your session expired.')
    expect(alert).toHaveAttribute('data-error-kind', 'auth')
    expect(mockDispatch).not.toHaveBeenCalled()
  })

  it('shows a truthful empty state when the mix returns no tracks', async () => {
    mockHttpClient.mockResolvedValue({
      json: previewPayload({ tracks: [], reasons: {} }),
    })
    renderStudio()

    fireEvent.click(screen.getByTestId('mix-preview-trigger'))

    const empty = await screen.findByTestId('mix-studio-empty')
    expect(empty).toHaveRole('status')
    expect(empty).toHaveTextContent('This mix found no playable tracks')
    expect(mockGetMany).not.toHaveBeenCalled()
    expect(mockDispatch).not.toHaveBeenCalled()
  })

  it('treats a preview whose songs all became missing as empty', async () => {
    mockHttpClient.mockResolvedValue({ json: previewPayload() })
    mockGetMany.mockResolvedValue({
      data: [
        { ...songs['song-1'], missing: true },
        { ...songs['song-2'], missing: true },
      ],
    })
    renderStudio()

    fireEvent.click(screen.getByTestId('mix-preview-trigger'))

    const empty = await screen.findByTestId('mix-studio-empty')
    expect(empty).toBeInTheDocument()
    expect(mockDispatch).not.toHaveBeenCalled()
  })

  it('surfaces degradation metadata while keeping the preview playable', async () => {
    mockHttpClient.mockResolvedValue({
      json: previewPayload({ degraded: true }),
    })
    resolvePlayableSongs()
    renderStudio()

    fireEvent.click(screen.getByTestId('mix-preview-trigger'))

    expect(
      await screen.findByText(
        'Some spacing or availability preferences could not be fully maintained.',
      ),
    ).toHaveAttribute('role', 'status')
    expect(screen.getByTestId('confirm-mix-play')).toBeEnabled()
    expect(mockDispatch).not.toHaveBeenCalled()
  })

  it('consumes the earlier entries document so both surfaces share one client', async () => {
    mockHttpClient.mockResolvedValue({
      json: {
        entries: [
          { id: 'song-2', reason: 'library_shuffle' },
          { id: 'song-1', reason: 'library_shuffle' },
        ],
        degraded: false,
        degradations: [],
      },
    })
    resolvePlayableSongs()
    renderStudio()

    fireEvent.click(screen.getByTestId('mix-preview-trigger'))

    const list = await screen.findByRole('list', {
      name: 'Mix preview tracks',
    })
    expect(within(list).getAllByRole('listitem')).toHaveLength(2)
    expect(mockDispatch).not.toHaveBeenCalled()
  })

  it('drops a stale preview when the mode changes so confirm cannot replay it', async () => {
    mockHttpClient.mockResolvedValue({ json: previewPayload() })
    resolvePlayableSongs()
    renderStudio()

    fireEvent.click(screen.getByTestId('mix-preview-trigger'))
    expect(
      await screen.findByRole('list', { name: 'Mix preview tracks' }),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('mode-card-rediscover'))

    expect(
      screen.queryByRole('list', { name: 'Mix preview tracks' }),
    ).not.toBeInTheDocument()
    expect(screen.queryByTestId('confirm-mix-play')).not.toBeInTheDocument()
    expect(mockDispatch).not.toHaveBeenCalled()
  })

  it('drops a stale preview when the adventure level changes', async () => {
    mockHttpClient.mockResolvedValue({
      json: previewPayload({ mode: 'familiar_fresh' }),
    })
    resolvePlayableSongs()
    renderStudio()

    fireEvent.click(screen.getByTestId('mode-card-familiar_fresh'))
    fireEvent.click(screen.getByTestId('mix-preview-trigger'))
    expect(
      await screen.findByRole('list', { name: 'Mix preview tracks' }),
    ).toBeInTheDocument()

    fireEvent.keyDown(
      screen.getByRole('slider', { name: 'Familiar ↔ Fresh adventure' }),
      { key: 'End' },
    )

    expect(
      screen.queryByRole('list', { name: 'Mix preview tracks' }),
    ).not.toBeInTheDocument()
    expect(screen.queryByTestId('confirm-mix-play')).not.toBeInTheDocument()
    expect(mockDispatch).not.toHaveBeenCalled()
  })

  it('drops a stale preview when the selected library scope changes', async () => {
    mockHttpClient.mockResolvedValue({ json: previewPayload() })
    resolvePlayableSongs()
    const view = renderStudio()

    fireEvent.click(screen.getByTestId('mix-preview-trigger'))
    expect(
      await screen.findByRole('list', { name: 'Mix preview tracks' }),
    ).toBeInTheDocument()

    selectedLibraries = [9]
    view.rerender(
      <ThemeProvider theme={createTheme()}>
        <MixStudio />
      </ThemeProvider>,
    )

    expect(
      screen.queryByRole('list', { name: 'Mix preview tracks' }),
    ).not.toBeInTheDocument()
    expect(screen.queryByTestId('confirm-mix-play')).not.toBeInTheDocument()
    expect(mockDispatch).not.toHaveBeenCalled()
  })
})
