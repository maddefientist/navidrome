import * as React from 'react'
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
  cleanup,
} from '@testing-library/react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { useInput, useTranslate } from 'react-admin'
import {
  SmartPlaylistBuilder,
  PRESETS,
  validateSmartPlaylistRules,
} from './SmartPlaylistBuilder'

const mockHttpClient = vi.fn()
vi.mock('../dataProvider', () => ({
  httpClient: (...args) => mockHttpClient(...args),
}))

vi.mock('react-admin', () => ({
  useInput: vi.fn(),
  useTranslate: vi.fn(),
}))

const schema = {
  fields: [
    { name: 'title', canonicalName: 'title' },
    { name: 'playCount', canonicalName: 'playCount', numeric: true },
    { name: 'lastPlayed', canonicalName: 'lastPlayed' },
    { name: 'dateAdded', canonicalName: 'dateAdded' },
    { name: 'loved', canonicalName: 'loved', boolean: true },
  ],
  operators: [
    'is',
    'isNot',
    'gt',
    'lt',
    'inTheLast',
    'notInTheLast',
    'contains',
  ],
  conjunctions: ['all', 'any'],
  orders: ['asc', 'desc'],
}

const serverSchema = {
  ...schema,
  fields: [
    { name: 'dateadded', canonicalName: 'dateadded' },
    { name: 'lastplayed', canonicalName: 'lastplayed' },
    { name: 'loved', canonicalName: 'loved', boolean: true },
    { name: 'playcount', canonicalName: 'playcount', numeric: true },
    { name: 'title', canonicalName: 'title' },
  ],
}

const COPY = {
  'resources.playlist.smart.errors.unsupportedField':
    'Field "%{field}" is not supported.',
  'resources.playlist.smart.errors.unsupportedOperator':
    'Operator "%{operator}" is not supported.',
}

const translate = (key, options = {}) => {
  let text = COPY[key] || key
  Object.entries(options).forEach(([name, replacement]) => {
    text = text.replace(`%{${name}}`, replacement)
  })
  return text
}

// A small stateful harness so onChange mutates real React state and the
// component re-renders like it would inside an actual react-final-form field.
const Harness = ({ initial = null }) => {
  const [value, setValue] = React.useState(initial)
  useInput.mockImplementation(() => ({
    input: { value, onChange: setValue },
    meta: { error: undefined },
  }))
  return <SmartPlaylistBuilder source="rules" />
}

const renderHarness = (initial) => render(<Harness initial={initial} />)

describe('validateSmartPlaylistRules', () => {
  it('allows manual playlists (null rules)', () => {
    expect(validateSmartPlaylistRules(null, schema, translate)).toBeUndefined()
    expect(
      validateSmartPlaylistRules(undefined, schema, translate),
    ).toBeUndefined()
  })

  it('accepts every preset unchanged', () => {
    PRESETS.forEach((preset) => {
      expect(
        validateSmartPlaylistRules(preset.rules, schema, translate),
      ).toBeUndefined()
    })
  })

  it('accepts documented camelCase rules against lowercase server fields', () => {
    PRESETS.forEach((preset) => {
      expect(
        validateSmartPlaylistRules(preset.rules, serverSchema, translate),
      ).toBeUndefined()
    })
  })

  it('fails closed when the schema failed to load', () => {
    expect(validateSmartPlaylistRules(PRESETS[0].rules, null, translate)).toBe(
      'resources.playlist.smart.errors.schemaUnavailable',
    )
  })

  it('rejects an empty condition list', () => {
    const rules = { all: [], sort: '', order: 'desc', limit: 100 }
    expect(validateSmartPlaylistRules(rules, schema, translate)).toBe(
      'resources.playlist.smart.errors.noConditions',
    )
  })

  it('rejects incomplete conditions', () => {
    const rules = { all: [{ is: {} }], limit: 100 }
    expect(validateSmartPlaylistRules(rules, schema, translate)).toBe(
      'resources.playlist.smart.errors.incompleteCondition',
    )
  })

  it('rejects unsupported fields', () => {
    const rules = { all: [{ is: { notAField: 1 } }], limit: 100 }
    expect(validateSmartPlaylistRules(rules, schema, translate)).toBe(
      'Field "notAField" is not supported.',
    )
  })

  it('rejects unsupported operators', () => {
    const rules = { all: [{ notAnOperator: { playCount: 1 } }], limit: 100 }
    expect(validateSmartPlaylistRules(rules, schema, translate)).toBe(
      'Operator "notAnOperator" is not supported.',
    )
  })

  it('rejects invalid values for numeric operators', () => {
    const rules = { all: [{ inTheLast: { lastPlayed: 'soon' } }], limit: 100 }
    expect(validateSmartPlaylistRules(rules, schema, translate)).toBe(
      'resources.playlist.smart.errors.invalidValue',
    )
  })

  it('rejects a limit outside 1..5000', () => {
    const base = { all: [{ is: { loved: true } }] }
    expect(
      validateSmartPlaylistRules({ ...base, limit: 0 }, schema, translate),
    ).toBe('resources.playlist.smart.errors.invalidLimit')
    expect(
      validateSmartPlaylistRules({ ...base, limit: 5001 }, schema, translate),
    ).toBe('resources.playlist.smart.errors.invalidLimit')
    expect(
      validateSmartPlaylistRules({ ...base, limit: 100 }, schema, translate),
    ).toBeUndefined()
  })
})

describe('<SmartPlaylistBuilder />', () => {
  beforeEach(() => {
    mockHttpClient.mockReset()
    mockHttpClient.mockResolvedValue({ json: schema })
    useTranslate.mockReturnValue(translate)
  })

  afterEach(cleanup)

  it('renders disabled by default for a manual playlist and explains smart playlists', () => {
    renderHarness(null)
    expect(screen.getByTestId('smart-playlist-toggle')).not.toBeChecked()
    expect(
      screen.getByText('resources.playlist.smart.toggleHelp'),
    ).toBeInTheDocument()
    expect(screen.queryByTestId('add-condition')).not.toBeInTheDocument()
  })

  it('enables smart mode with a starter condition once the schema loads', async () => {
    renderHarness(null)
    await waitFor(() =>
      expect(screen.getByTestId('smart-playlist-toggle')).not.toBeDisabled(),
    )
    fireEvent.click(screen.getByTestId('smart-playlist-toggle'))

    await waitFor(() => expect(screen.getByTestId('add-condition')))
    expect(screen.getByTestId('condition-field-0')).toBeInTheDocument()
    expect(screen.getByTestId('condition-field-0')).toHaveValue('title')
    expect(screen.getByTestId('condition-operator-0')).toHaveValue('contains')
  })

  it('disabling smart mode submits rules as null', async () => {
    renderHarness(PRESETS[0].rules)
    await waitFor(() => screen.getByTestId('smart-playlist-toggle'))
    expect(screen.getByTestId('smart-playlist-toggle')).toBeChecked()

    fireEvent.click(screen.getByTestId('smart-playlist-toggle'))
    expect(screen.getByTestId('smart-playlist-toggle')).not.toBeChecked()
    expect(screen.queryByTestId('add-condition')).not.toBeInTheDocument()
  })

  it('restores the previous draft when re-enabling after a disable', async () => {
    renderHarness(PRESETS[1].rules)
    await waitFor(() => screen.getByTestId('smart-playlist-conjunction'))

    fireEvent.click(screen.getByTestId('smart-playlist-toggle'))
    fireEvent.click(screen.getByTestId('smart-playlist-toggle'))

    await waitFor(() =>
      expect(screen.getByTestId('smart-playlist-limit')).toHaveValue(100),
    )
    expect(screen.getByTestId('condition-field-0')).toHaveValue('playCount')
  })

  describe.each(PRESETS)('preset $id', (preset) => {
    it('serializes to the exact criteria DSL', async () => {
      renderHarness(null)
      fireEvent.click(screen.getByTestId('smart-playlist-toggle'))
      await waitFor(() => screen.getByTestId(`smart-preset-${preset.id}`))

      fireEvent.click(screen.getByTestId(`smart-preset-${preset.id}`))

      await waitFor(() => {
        const limitInput = screen.getByTestId('smart-playlist-limit')
        expect(limitInput).toHaveValue(preset.rules.limit)
      })
      expect(screen.getByTestId('smart-playlist-sort')).toHaveValue(
        preset.rules.sort,
      )
      expect(screen.getByTestId('smart-playlist-order')).toHaveValue(
        preset.rules.order,
      )
      const conjunction = preset.rules.any ? 'any' : 'all'
      expect(screen.getByTestId('smart-playlist-conjunction')).toHaveValue(
        conjunction,
      )
      const conditions = preset.rules[conjunction]
      conditions.forEach((_, index) => {
        expect(
          screen.getByTestId(`condition-field-${index}`),
        ).toBeInTheDocument()
      })
    })
  })

  it('adds and removes condition rows', async () => {
    renderHarness(PRESETS[0].rules)
    await waitFor(() => screen.getByTestId('add-condition'))
    expect(screen.getByTestId('condition-field-0')).toBeInTheDocument()
    expect(screen.queryByTestId('condition-field-1')).not.toBeInTheDocument()

    fireEvent.click(screen.getByTestId('add-condition'))
    expect(screen.getByTestId('condition-field-1')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('remove-condition-1'))
    expect(screen.queryByTestId('condition-field-1')).not.toBeInTheDocument()
  })

  it('edits field, operator, and value for a condition', async () => {
    renderHarness(PRESETS[0].rules)
    await waitFor(() => screen.getByTestId('condition-field-0'))

    fireEvent.change(screen.getByTestId('condition-field-0'), {
      target: { value: 'loved' },
    })
    expect(screen.getByTestId('condition-field-0')).toHaveValue('loved')

    fireEvent.change(screen.getByTestId('condition-operator-0'), {
      target: { value: 'is' },
    })
    expect(screen.getByTestId('condition-operator-0')).toHaveValue('is')
  })

  it('hydrates an existing "any" playlist without losing its conditions', async () => {
    const existingRules = {
      any: [{ is: { loved: true } }, { notInTheLast: { lastPlayed: 60 } }],
      sort: 'lastPlayed',
      order: 'asc',
      limit: 100,
    }
    renderHarness(existingRules)
    await waitFor(() => screen.getByTestId('smart-playlist-conjunction'))

    expect(screen.getByTestId('smart-playlist-conjunction')).toHaveValue('any')
    expect(screen.getByTestId('condition-field-0')).toHaveValue('loved')
    expect(screen.getByTestId('condition-field-1')).toHaveValue('lastPlayed')
    expect(screen.getByTestId('smart-playlist-sort')).toHaveValue('lastPlayed')
    expect(screen.getByTestId('smart-playlist-order')).toHaveValue('asc')
  })

  it('shows a retryable error when the schema fails to load', async () => {
    mockHttpClient.mockReset()
    mockHttpClient.mockRejectedValueOnce(new Error('network error'))
    mockHttpClient.mockResolvedValueOnce({ json: schema })

    renderHarness(PRESETS[0].rules)

    await waitFor(() =>
      expect(
        screen.getByTestId('smart-playlist-schema-error'),
      ).toBeInTheDocument(),
    )
    expect(screen.queryByTestId('add-condition')).not.toBeInTheDocument()

    fireEvent.click(
      within(screen.getByTestId('smart-playlist-schema-error')).getByText(
        'resources.playlist.smart.schema.retry',
      ),
    )

    await waitFor(() =>
      expect(screen.getByTestId('add-condition')).toBeInTheDocument(),
    )
    expect(mockHttpClient).toHaveBeenCalledTimes(2)
  })
})
