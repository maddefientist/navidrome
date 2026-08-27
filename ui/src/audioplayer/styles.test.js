import React from 'react'
import { render } from '@testing-library/react'
import { ThemeProvider, createTheme } from '@material-ui/core/styles'
import { describe, expect, it } from 'vitest'
import useStyle from './styles'

const Probe = (props) => {
  const classes = useStyle(props)
  return React.createElement('div', {
    'data-testid': 'player-styles',
    className: classes.player,
  })
}

const injectedCss = () =>
  Array.from(document.querySelectorAll('style'))
    .map((node) => node.textContent || '')
    .join('\n')

describe('audioplayer styles', () => {
  it('pads the player for the bottom safe-area and uses the MUI md compact breakpoint', () => {
    const theme = createTheme()
    render(
      React.createElement(
        ThemeProvider,
        { theme },
        React.createElement(Probe, {
          visible: true,
          enableCoverAnimation: true,
          isRadio: false,
        }),
      ),
    )

    const css = injectedCss()
    expect(css).not.toContain('810px')
    expect(css).toContain(theme.breakpoints.down('sm'))
    expect(css).toContain('padding-bottom: env(safe-area-inset-bottom, 0px)')
    expect(css).toContain('@media (prefers-reduced-motion)')
    expect(css).toContain('animation: none')
  })
})
