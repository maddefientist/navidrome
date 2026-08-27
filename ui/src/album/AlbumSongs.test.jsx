import { describe, test, expect } from 'vitest'
import { render } from '@testing-library/react'
import { ThemeProvider, createTheme } from '@material-ui/core/styles'
import { useStyles } from './AlbumSongs'

describe('AlbumSongs containment CSS contract', () => {
  const StylesProbe = () => {
    const classes = useStyles({ isDesktop: true })
    return (
      <div>
        <div data-testid="main" className={classes.main} />
        <div data-testid="content" className={classes.content} />
      </div>
    )
  }

  const renderProbe = () =>
    render(
      <ThemeProvider theme={createTheme()}>
        <StylesProbe />
      </ThemeProvider>,
    )

  test('main flex container allows shrinking instead of widening the document', () => {
    const { getByTestId } = renderProbe()
    expect(getComputedStyle(getByTestId('main')).minWidth).toBe('0')
  })

  test('content wrapper allows shrinking so the table scrolls internally', () => {
    const { getByTestId } = renderProbe()
    expect(getComputedStyle(getByTestId('content')).minWidth).toBe('0')
  })
})
