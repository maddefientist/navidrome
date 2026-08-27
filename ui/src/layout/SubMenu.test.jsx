import React from 'react'
import { render, screen } from '@testing-library/react'
import { Provider } from 'react-redux'
import { createStore } from 'redux'
import { ThemeProvider, createTheme } from '@material-ui/core/styles'
import LibraryMusicOutlinedIcon from '@material-ui/icons/LibraryMusicOutlined'
import { describe, expect, it, vi } from 'vitest'
import SubMenu from './SubMenu'

vi.mock('react-admin', () => ({
  setSidebarVisibility: vi.fn(),
  useTranslate: () => (key) => key,
}))

const renderSubMenu = ({ sidebarIsOpen }) =>
  render(
    <Provider store={createStore(() => ({}))}>
      <ThemeProvider theme={createTheme()}>
        <SubMenu
          handleToggle={vi.fn()}
          isOpen
          sidebarIsOpen={sidebarIsOpen}
          name="menu.library"
          icon={<LibraryMusicOutlinedIcon data-testid="library-icon" />}
        >
          <div>child</div>
        </SubMenu>
      </ThemeProvider>
    </Provider>,
  )

describe('<SubMenu /> collapsed identity', () => {
  it('shows the section icon while the sidebar is collapsed', () => {
    renderSubMenu({ sidebarIsOpen: false })
    expect(screen.getByTestId('library-icon')).toBeInTheDocument()
  })

  it('shows the expansion state while the sidebar is open', () => {
    const { queryByTestId } = renderSubMenu({ sidebarIsOpen: true })
    expect(queryByTestId('library-icon')).not.toBeInTheDocument()
  })
})
