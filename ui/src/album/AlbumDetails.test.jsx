// ui/src/album/__tests__/AlbumDetails.test.jsx
import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import { render } from '@testing-library/react'
import { RecordContextProvider } from 'react-admin'
import { useMediaQuery } from '@material-ui/core'
import { ThemeProvider, createTheme } from '@material-ui/core/styles'
import { Details, useStyles } from './AlbumDetails'

// Mock useMediaQuery
vi.mock('@material-ui/core', async () => {
  const actual = await import('@material-ui/core')
  return {
    ...actual,
    useMediaQuery: vi.fn(),
  }
})

// Mock formatFullDate to return deterministic results
vi.mock('../utils', async () => {
  const actual = await import('../utils')
  return {
    ...actual,
    formatFullDate: (date) => {
      if (!date) return ''
      // Use en-CA locale for consistent test results
      return new Date(date).toLocaleDateString('en-CA', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        timeZone: 'UTC',
      })
    },
  }
})

describe('Details component', () => {
  describe('Desktop view', () => {
    beforeEach(() => {
      // Set desktop view (isXsmall = false)
      vi.mocked(useMediaQuery).mockReturnValue(false)
    })

    test('renders correctly with just year range', () => {
      const record = {
        id: '123',
        name: 'Test Album',
        songCount: 12,
        duration: 3600,
        size: 102400,
        year: 2020,
      }

      const { container } = render(
        <RecordContextProvider value={record}>
          <Details />
        </RecordContextProvider>,
      )

      expect(container).toMatchSnapshot()
    })

    test('renders correctly with date', () => {
      const record = {
        id: '123',
        name: 'Test Album',
        songCount: 12,
        duration: 3600,
        size: 102400,
        date: '2020-05-01',
      }

      const { container } = render(
        <RecordContextProvider value={record}>
          <Details />
        </RecordContextProvider>,
      )

      expect(container).toMatchSnapshot()
    })

    test('renders correctly with originalDate', () => {
      const record = {
        id: '123',
        name: 'Test Album',
        songCount: 12,
        duration: 3600,
        size: 102400,
        originalDate: '2018-03-15',
      }

      const { container } = render(
        <RecordContextProvider value={record}>
          <Details />
        </RecordContextProvider>,
      )

      expect(container).toMatchSnapshot()
    })

    test('renders correctly with date and originalDate', () => {
      const record = {
        id: '123',
        name: 'Test Album',
        songCount: 12,
        duration: 3600,
        size: 102400,
        date: '2020-05-01',
        originalDate: '2018-03-15',
      }

      const { container } = render(
        <RecordContextProvider value={record}>
          <Details />
        </RecordContextProvider>,
      )

      expect(container).toMatchSnapshot()
    })

    test('renders correctly with releaseDate', () => {
      const record = {
        id: '123',
        name: 'Test Album',
        songCount: 12,
        duration: 3600,
        size: 102400,
        releaseDate: '2020-06-15',
      }

      const { container } = render(
        <RecordContextProvider value={record}>
          <Details />
        </RecordContextProvider>,
      )

      expect(container).toMatchSnapshot()
    })

    test('renders correctly with all date fields', () => {
      const record = {
        id: '123',
        name: 'Test Album',
        songCount: 12,
        duration: 3600,
        size: 102400,
        date: '2020-05-01',
        originalDate: '2018-03-15',
        releaseDate: '2020-06-15',
      }

      const { container } = render(
        <RecordContextProvider value={record}>
          <Details />
        </RecordContextProvider>,
      )

      expect(container).toMatchSnapshot()
    })
  })

  describe('Mobile view', () => {
    beforeEach(() => {
      // Set mobile view (isXsmall = true)
      vi.mocked(useMediaQuery).mockReturnValue(true)
    })

    afterEach(() => {
      vi.clearAllMocks()
    })

    test('renders correctly with just year range', () => {
      const record = {
        id: '123',
        name: 'Test Album',
        songCount: 12,
        duration: 3600,
        size: 102400,
        year: 2020,
      }

      const { container } = render(
        <RecordContextProvider value={record}>
          <Details />
        </RecordContextProvider>,
      )

      expect(container).toMatchSnapshot()
    })

    test('renders correctly with date', () => {
      const record = {
        id: '123',
        name: 'Test Album',
        songCount: 12,
        duration: 3600,
        size: 102400,
        date: '2020-05-01',
      }

      const { container } = render(
        <RecordContextProvider value={record}>
          <Details />
        </RecordContextProvider>,
      )

      expect(container).toMatchSnapshot()
    })

    test('renders correctly with originalDate', () => {
      const record = {
        id: '123',
        name: 'Test Album',
        songCount: 12,
        duration: 3600,
        size: 102400,
        originalDate: '2018-03-15',
      }

      const { container } = render(
        <RecordContextProvider value={record}>
          <Details />
        </RecordContextProvider>,
      )

      expect(container).toMatchSnapshot()
    })

    test('renders correctly with date and originalDate', () => {
      const record = {
        id: '123',
        name: 'Test Album',
        songCount: 12,
        duration: 3600,
        size: 102400,
        date: '2020-05-01',
        originalDate: '2018-03-15',
      }

      const { container } = render(
        <RecordContextProvider value={record}>
          <Details />
        </RecordContextProvider>,
      )

      expect(container).toMatchSnapshot()
    })

    test('renders correctly with releaseDate', () => {
      const record = {
        id: '123',
        name: 'Test Album',
        songCount: 12,
        duration: 3600,
        size: 102400,
        releaseDate: '2020-06-15',
      }

      const { container } = render(
        <RecordContextProvider value={record}>
          <Details />
        </RecordContextProvider>,
      )

      expect(container).toMatchSnapshot()
    })

    test('renders correctly with all date fields', () => {
      const record = {
        id: '123',
        name: 'Test Album',
        songCount: 12,
        duration: 3600,
        size: 102400,
        date: '2020-05-01',
        originalDate: '2018-03-15',
        releaseDate: '2020-06-15',
      }

      const { container } = render(
        <RecordContextProvider value={record}>
          <Details />
        </RecordContextProvider>,
      )

      expect(container).toMatchSnapshot()
    })

    test('renders correctly with no date fields', () => {
      const record = {
        id: '123',
        name: 'Test Album',
        songCount: 12,
        duration: 3600,
        size: 102400,
      }

      const { container } = render(
        <RecordContextProvider value={record}>
          <Details />
        </RecordContextProvider>,
      )

      expect(container).toMatchSnapshot()
    })

    test('renders correctly with year range (start and end years)', () => {
      const record = {
        id: '123',
        name: 'Test Album',
        songCount: 12,
        duration: 3600,
        size: 102400,
        year: 2018,
        yearEnd: 2020,
      }

      const { container } = render(
        <RecordContextProvider value={record}>
          <Details />
        </RecordContextProvider>,
      )

      expect(container).toMatchSnapshot()
    })

    test('renders correctly with originalYear range', () => {
      const record = {
        id: '123',
        name: 'Test Album',
        songCount: 12,
        duration: 3600,
        size: 102400,
        originalYear: 2015,
        originalYearEnd: 2016,
      }

      const { container } = render(
        <RecordContextProvider value={record}>
          <Details />
        </RecordContextProvider>,
      )

      expect(container).toMatchSnapshot()
    })
  })
})

describe('AlbumDetails shell CSS contract', () => {
  const StylesProbe = () => {
    const classes = useStyles()
    return (
      <div>
        <div data-testid="root" className={classes.root} />
        <div data-testid="cardContents" className={classes.cardContents} />
        <div data-testid="details" className={classes.details} />
        <div data-testid="content" className={classes.content} />
        <div data-testid="recordName" className={classes.recordName} />
        <div data-testid="recordArtist" className={classes.recordArtist} />
      </div>
    )
  }

  const renderProbe = () =>
    render(
      <ThemeProvider theme={createTheme()}>
        <StylesProbe />
      </ThemeProvider>,
    )

  test('root has no minWidth floor', () => {
    const { getByTestId } = renderProbe()
    expect(getComputedStyle(getByTestId('root')).minWidth).toBe('0')
  })

  test('cardContents and details are shrink-safe with minWidth 0', () => {
    const { getByTestId } = renderProbe()
    expect(getComputedStyle(getByTestId('cardContents')).minWidth).toBe('0')
    expect(getComputedStyle(getByTestId('details')).minWidth).toBe('0')
    expect(getComputedStyle(getByTestId('content')).minWidth).toBe('0')
  })

  test('long album/artist text wraps instead of overflowing', () => {
    const { getByTestId } = renderProbe()
    const nameStyle = getComputedStyle(getByTestId('recordName'))
    const artistStyle = getComputedStyle(getByTestId('recordArtist'))
    expect(nameStyle.overflowWrap).toBe('break-word')
    expect(artistStyle.overflowWrap).toBe('break-word')
  })
})
