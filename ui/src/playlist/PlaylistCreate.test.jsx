import * as React from 'react'
import { render, screen, cleanup } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import PlaylistCreate from './PlaylistCreate'

const hooks = vi.hoisted(() => ({
  create: null,
  notify: vi.fn(),
  redirect: vi.fn(),
  refresh: vi.fn(),
}))

vi.mock('react-admin', () => ({
  Create: ({ children, title, onSuccess, ...rest }) => {
    hooks.create = { onSuccess, ...rest }
    return (
      <div data-testid="create-component">
        {title}
        {children}
      </div>
    )
  },
  SimpleForm: ({ children }) => (
    <form data-testid="simple-form">{children}</form>
  ),
  TextInput: ({ source, validate }) => (
    <input
      data-testid={`text-input-${source}`}
      data-required={!!validate}
      readOnly
    />
  ),
  BooleanInput: ({ source, initialValue }) => (
    <input
      type="checkbox"
      readOnly
      checked={!!initialValue}
      data-testid={`boolean-input-${source}`}
    />
  ),
  required: () => () => 'required',
  useTranslate: () => (key) => key,
  useNotify: () => hooks.notify,
  useRedirect: () => hooks.redirect,
  useRefresh: () => hooks.refresh,
}))

vi.mock('../common', () => ({
  Title: ({ subTitle }) => <div data-testid="title">{subTitle}</div>,
}))

vi.mock('./SmartPlaylistBuilder', () => ({
  SmartPlaylistBuilder: (props) => (
    <div data-testid="smart-playlist-builder" data-source={props.source} />
  ),
}))

describe('<PlaylistCreate />', () => {
  afterEach(cleanup)

  it('renders the ordinary manual playlist fields untouched', () => {
    render(<PlaylistCreate />)

    expect(screen.getByTestId('create-component')).toBeInTheDocument()
    expect(screen.getByTestId('simple-form')).toBeInTheDocument()
    expect(screen.getByTestId('text-input-name')).toHaveAttribute(
      'data-required',
      'true',
    )
    expect(screen.getByTestId('text-input-comment')).toBeInTheDocument()
    expect(screen.getByTestId('boolean-input-public')).toBeChecked()
  })

  it('renders the smart playlist builder bound to the rules field', () => {
    render(<PlaylistCreate />)

    expect(screen.getByTestId('smart-playlist-builder')).toHaveAttribute(
      'data-source',
      'rules',
    )
  })

  it('notifies and redirects to the list on successful creation', () => {
    render(<PlaylistCreate basePath="/playlist" />)

    hooks.create.onSuccess()

    expect(hooks.notify).toHaveBeenCalledWith(
      'ra.notification.created',
      'info',
      {
        smart_count: 1,
      },
    )
    expect(hooks.redirect).toHaveBeenCalledWith('list', '/playlist')
    expect(hooks.refresh).toHaveBeenCalled()
  })
})
