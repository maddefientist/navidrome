import * as React from 'react'
import { render, screen, cleanup } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import PlaylistEdit from './PlaylistEdit'

const record = {
  id: 'pls1',
  name: 'My Playlist',
  comment: 'A comment',
  public: true,
  ownerId: 'user1',
  ownerName: 'someone',
  rules: null,
}

vi.mock('react-admin', () => ({
  Edit: ({ children, title }) => (
    <div data-testid="edit-component">
      {title}
      {children}
    </div>
  ),
  SimpleForm: ({ children }) => (
    <form data-testid="simple-form">{children}</form>
  ),
  FormDataConsumer: ({ children }) => children({ formData: record }),
  TextInput: ({ source }) => (
    <input data-testid={`text-input-${source}`} readOnly />
  ),
  TextField: ({ source }) => <span data-testid={`text-field-${source}`} />,
  BooleanInput: ({ source, disabled }) => (
    <input
      type="checkbox"
      readOnly
      data-testid={`boolean-input-${source}`}
      data-disabled={!!disabled}
    />
  ),
  ReferenceInput: ({ children }) => (
    <div data-testid="reference-input-ownerId">{children}</div>
  ),
  SelectInput: () => <div data-testid="select-input-owner" />,
  required: () => () => 'required',
  useTranslate: () => (key) => key,
  usePermissions: () => ({ permissions: 'admin' }),
}))

vi.mock('../common', () => ({
  Title: ({ subTitle }) => <div data-testid="title">{subTitle}</div>,
  isWritable: () => true,
}))

vi.mock('./SmartPlaylistBuilder', () => ({
  SmartPlaylistBuilder: (props) => (
    <div data-testid="smart-playlist-builder" data-source={props.source} />
  ),
}))

describe('<PlaylistEdit />', () => {
  afterEach(cleanup)

  it('renders the ordinary manual playlist fields untouched', () => {
    render(<PlaylistEdit record={record} />)

    expect(screen.getByTestId('edit-component')).toBeInTheDocument()
    expect(screen.getByTestId('simple-form')).toBeInTheDocument()
    expect(screen.getByTestId('text-input-name')).toBeInTheDocument()
    expect(screen.getByTestId('text-input-comment')).toBeInTheDocument()
    expect(screen.getByTestId('boolean-input-public')).toBeInTheDocument()
  })

  it('shows the owner select for admins', () => {
    render(<PlaylistEdit record={record} />)
    expect(screen.getByTestId('reference-input-ownerId')).toBeInTheDocument()
  })

  it('renders the smart playlist builder bound to the rules field', () => {
    render(<PlaylistEdit record={record} />)

    expect(screen.getByTestId('smart-playlist-builder')).toHaveAttribute(
      'data-source',
      'rules',
    )
  })
})
