import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useInput, useTranslate } from 'react-admin'
import {
  Box,
  Button,
  CircularProgress,
  FormControlLabel,
  IconButton,
  Switch,
  TextField,
  Typography,
} from '@material-ui/core'
import { makeStyles } from '@material-ui/core/styles'
import DeleteIcon from '@material-ui/icons/Delete'
import AddIcon from '@material-ui/icons/Add'
import Alert from '@material-ui/lab/Alert'
import { httpClient } from '../dataProvider'
import { REST_URL } from '../consts'

export const CRITERIA_FIELDS_ENDPOINT = `${REST_URL}/criteria/fields`

// Operators whose value is a plain boolean flag (no field type dependency).
const FLAG_OPERATORS = new Set(['isMissing', 'isPresent'])
// Operators whose value is a single number (e.g. a day count).
const NUMERIC_OPERATORS = new Set(['gt', 'lt', 'inTheLast', 'notInTheLast'])
// Operators whose value is a [min, max] pair of numbers.
const RANGE_OPERATORS = new Set(['inTheRange'])

export const PRESETS = [
  {
    id: 'recentlyPlayed',
    labelKey: 'resources.playlist.smart.presets.recentlyPlayed',
    rules: {
      all: [{ inTheLast: { lastPlayed: 30 } }],
      sort: 'lastPlayed',
      order: 'desc',
      limit: 100,
    },
  },
  {
    id: 'unplayed',
    labelKey: 'resources.playlist.smart.presets.unplayed',
    rules: {
      all: [{ is: { playCount: 0 } }],
      sort: 'dateAdded',
      order: 'desc',
      limit: 100,
    },
  },
  {
    id: 'lovedButForgotten',
    labelKey: 'resources.playlist.smart.presets.lovedButForgotten',
    rules: {
      all: [{ is: { loved: true } }, { notInTheLast: { lastPlayed: 60 } }],
      sort: 'lastPlayed',
      order: 'asc',
      limit: 100,
    },
  },
  {
    id: 'freshArrivals',
    labelKey: 'resources.playlist.smart.presets.freshArrivals',
    rules: {
      all: [{ inTheLast: { dateAdded: 30 } }],
      sort: 'dateAdded',
      order: 'desc',
      limit: 100,
    },
  },
]

const operatorName = (op) => (typeof op === 'string' ? op : op?.name)
const normalizedFieldName = (name) =>
  typeof name === 'string' ? name.toLowerCase() : ''

const uniqueSchemaFields = (schema) => {
  const seen = new Set()
  return (schema?.fields || []).filter((field) => {
    const name = field.canonicalName || field.name
    const normalized = normalizedFieldName(name)
    if (!normalized || seen.has(normalized)) return false
    seen.add(normalized)
    return true
  })
}

const preferredField = (schema) => {
  const fields = uniqueSchemaFields(schema)
  return (
    fields.find(
      (field) =>
        normalizedFieldName(field.canonicalName || field.name) === 'title',
    ) || fields[0]
  )
}

const preferredOperator = (schema) => {
  const operators = (schema?.operators || []).map(operatorName)
  return operators.includes('contains')
    ? 'contains'
    : operators.includes('is')
      ? 'is'
      : operators[0] || ''
}

const optionValue = (field, currentValue) => {
  const name = field.canonicalName || field.name
  return normalizedFieldName(name) === normalizedFieldName(currentValue)
    ? currentValue
    : name
}

export const getConjunction = (rules) => (rules?.any ? 'any' : 'all')

export const getConditions = (rules) => {
  const conjunction = getConjunction(rules)
  return (rules && rules[conjunction]) || []
}

const isCompleteExpression = (expr) => {
  if (!expr || typeof expr !== 'object') return false
  const opKeys = Object.keys(expr)
  if (opKeys.length !== 1) return false
  const fieldMap = expr[opKeys[0]]
  if (!fieldMap || typeof fieldMap !== 'object') return false
  return Object.keys(fieldMap).length === 1
}

const conditionParts = (expr) => {
  if (!isCompleteExpression(expr))
    return { operator: '', field: '', value: undefined }
  const operator = Object.keys(expr)[0]
  const field = Object.keys(expr[operator])[0]
  return { operator, field, value: expr[operator][field] }
}

const buildExpression = (operator, field, value) => {
  if (!operator || !field) return {}
  return { [operator]: { [field]: value } }
}

const isValidValue = (operator, value) => {
  if (FLAG_OPERATORS.has(operator)) {
    return typeof value === 'boolean'
  }
  if (NUMERIC_OPERATORS.has(operator)) {
    return typeof value === 'number' && Number.isFinite(value)
  }
  if (RANGE_OPERATORS.has(operator)) {
    return (
      Array.isArray(value) &&
      value.length === 2 &&
      value.every((v) => typeof v === 'number' && Number.isFinite(v)) &&
      value[0] <= value[1]
    )
  }
  if (typeof value === 'boolean' || typeof value === 'number') {
    return true
  }
  return typeof value === 'string' && value.trim() !== ''
}

// Validates a playlist `rules` value against the loaded criteria schema. `null`/`undefined`
// (manual playlist) always validates. Exported so PlaylistCreate/PlaylistEdit tests and the
// field-level validate() closure share one source of truth for "malformed rules" detection.
export const validateSmartPlaylistRules = (rules, schema, translate) => {
  if (rules === null || rules === undefined) return undefined

  if (typeof rules !== 'object' || Array.isArray(rules)) {
    return translate('resources.playlist.smart.errors.incompleteCondition')
  }

  if (!schema) {
    return translate('resources.playlist.smart.errors.schemaUnavailable')
  }

  const conditions = getConditions(rules)
  if (!Array.isArray(conditions) || conditions.length === 0) {
    return translate('resources.playlist.smart.errors.noConditions')
  }

  const fieldNames = new Set()
  ;(schema.fields || []).forEach((f) => {
    if (f.name) fieldNames.add(normalizedFieldName(f.name))
    if (f.canonicalName)
      fieldNames.add(normalizedFieldName(f.canonicalName))
  })
  const operatorNames = new Set((schema.operators || []).map(operatorName))

  for (const expr of conditions) {
    if (!isCompleteExpression(expr)) {
      return translate('resources.playlist.smart.errors.incompleteCondition')
    }
    const { operator, field, value } = conditionParts(expr)
    if (!operatorNames.has(operator)) {
      return translate('resources.playlist.smart.errors.unsupportedOperator', {
        operator,
      })
    }
    if (!fieldNames.has(normalizedFieldName(field))) {
      return translate('resources.playlist.smart.errors.unsupportedField', {
        field,
      })
    }
    if (!isValidValue(operator, value)) {
      return translate('resources.playlist.smart.errors.invalidValue')
    }
  }

  if (rules.sort && !fieldNames.has(normalizedFieldName(rules.sort))) {
    return translate('resources.playlist.smart.errors.unsupportedField', {
      field: rules.sort,
    })
  }

  const limit = rules.limit
  if (
    limit === undefined ||
    limit === null ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 5000
  ) {
    return translate('resources.playlist.smart.errors.invalidLimit')
  }

  return undefined
}

const useStyles = makeStyles(
  (theme) => ({
    root: {
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1.5),
      width: '100%',
      padding: theme.spacing(2),
      marginTop: theme.spacing(1),
      marginBottom: theme.spacing(1),
      border: `1px solid ${theme.palette.divider}`,
      borderRadius: theme.shape.borderRadius,
    },
    header: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: theme.spacing(1),
    },
    help: {
      color: theme.palette.text.secondary,
    },
    presets: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: theme.spacing(1),
    },
    topRow: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: theme.spacing(2),
      alignItems: 'flex-start',
    },
    condition: {
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'flex-start',
      gap: theme.spacing(1),
      padding: theme.spacing(1),
      border: `1px solid ${theme.palette.divider}`,
      borderRadius: theme.shape.borderRadius,
    },
    field: {
      minWidth: 160,
      flex: '1 1 160px',
    },
    smallField: {
      minWidth: 120,
      flex: '1 1 120px',
    },
  }),
  { name: 'NDSmartPlaylistBuilder' },
)

const defaultRules = (schema) => {
  const field = preferredField(schema)
  const fieldName = field?.canonicalName || field?.name || ''
  const operator = preferredOperator(schema)
  return {
    all: fieldName
      ? [buildExpression(operator, fieldName, field?.boolean ? false : '')]
      : [],
    sort: '',
    order: 'desc',
    limit: 100,
  }
}

const ValueEditor = ({
  index,
  operator,
  value,
  fieldInfo,
  onChange,
  disabled,
  translate,
}) => {
  const classes = useStyles()

  if (FLAG_OPERATORS.has(operator) || fieldInfo?.boolean) {
    const boolValue = value === true ? 'true' : value === false ? 'false' : ''
    return (
      <TextField
        select
        SelectProps={{
          native: true,
          inputProps: { 'data-testid': `condition-value-${index}` },
        }}
        className={classes.smallField}
        variant="outlined"
        size="small"
        disabled={disabled}
        label={translate('resources.playlist.smart.valueLabel')}
        value={boolValue}
        onChange={(e) => onChange(e.target.value === 'true')}
      >
        <option value="" disabled />
        <option value="true">{translate('ra.boolean.true')}</option>
        <option value="false">{translate('ra.boolean.false')}</option>
      </TextField>
    )
  }

  if (RANGE_OPERATORS.has(operator)) {
    const [min, max] = Array.isArray(value) ? value : ['', '']
    return (
      <Box display="flex" gridGap={8}>
        <TextField
          type="number"
          className={classes.smallField}
          variant="outlined"
          size="small"
          disabled={disabled}
          label={translate('resources.playlist.smart.valueMin')}
          value={min ?? ''}
          onChange={(e) =>
            onChange([
              e.target.value === '' ? '' : Number(e.target.value),
              max ?? '',
            ])
          }
          inputProps={{ 'data-testid': `condition-value-min-${index}` }}
        />
        <TextField
          type="number"
          className={classes.smallField}
          variant="outlined"
          size="small"
          disabled={disabled}
          label={translate('resources.playlist.smart.valueMax')}
          value={max ?? ''}
          onChange={(e) =>
            onChange([
              min ?? '',
              e.target.value === '' ? '' : Number(e.target.value),
            ])
          }
          inputProps={{ 'data-testid': `condition-value-max-${index}` }}
        />
      </Box>
    )
  }

  if (NUMERIC_OPERATORS.has(operator) || fieldInfo?.numeric) {
    return (
      <TextField
        type="number"
        className={classes.smallField}
        variant="outlined"
        size="small"
        disabled={disabled}
        label={translate('resources.playlist.smart.valueLabel')}
        value={value ?? ''}
        onChange={(e) =>
          onChange(e.target.value === '' ? '' : Number(e.target.value))
        }
        inputProps={{ 'data-testid': `condition-value-${index}` }}
      />
    )
  }

  return (
    <TextField
      className={classes.field}
      variant="outlined"
      size="small"
      disabled={disabled}
      label={translate('resources.playlist.smart.valueLabel')}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      inputProps={{ 'data-testid': `condition-value-${index}` }}
    />
  )
}

const ConditionRow = ({
  index,
  expression,
  schema,
  onChange,
  onRemove,
  translate,
}) => {
  const classes = useStyles()
  const { operator, field, value } = conditionParts(expression)
  const fields = uniqueSchemaFields(schema)
  const fieldInfo = fields.find(
    (f) =>
      normalizedFieldName(f.canonicalName || f.name) ===
      normalizedFieldName(field),
  )

  const handleFieldChange = (newField) => {
    onChange(buildExpression(operator, newField, value))
  }
  const handleOperatorChange = (newOperator) => {
    let newValue = value
    if (FLAG_OPERATORS.has(newOperator)) newValue = true
    else if (RANGE_OPERATORS.has(newOperator)) newValue = ['', '']
    else if (NUMERIC_OPERATORS.has(newOperator)) newValue = ''
    onChange(buildExpression(newOperator, field, newValue))
  }
  const handleValueChange = (newValue) => {
    onChange(buildExpression(operator, field, newValue))
  }

  return (
    <fieldset
      className={classes.condition}
      aria-label={translate('resources.playlist.smart.conditionLegend', {
        index: index + 1,
      })}
    >
      <TextField
        select
        SelectProps={{
          native: true,
          inputProps: { 'data-testid': `condition-field-${index}` },
        }}
        className={classes.field}
        variant="outlined"
        size="small"
        label={translate('resources.playlist.smart.fieldLabel')}
        value={field}
        onChange={(e) => handleFieldChange(e.target.value)}
      >
        {fields.map((f) => {
          const name = optionValue(f, field)
          return (
            <option key={name} value={name}>
              {f.name}
            </option>
          )
        })}
      </TextField>
      <TextField
        select
        SelectProps={{
          native: true,
          inputProps: { 'data-testid': `condition-operator-${index}` },
        }}
        className={classes.smallField}
        variant="outlined"
        size="small"
        label={translate('resources.playlist.smart.operatorLabel')}
        value={operator}
        onChange={(e) => handleOperatorChange(e.target.value)}
      >
        {(schema?.operators || []).map((op) => {
          const name = operatorName(op)
          return (
            <option key={name} value={name}>
              {name}
            </option>
          )
        })}
      </TextField>
      <ValueEditor
        index={index}
        operator={operator}
        value={value}
        fieldInfo={fieldInfo}
        onChange={handleValueChange}
        translate={translate}
      />
      <IconButton
        size="small"
        onClick={onRemove}
        aria-label={translate('resources.playlist.smart.removeCondition', {
          index: index + 1,
        })}
        data-testid={`remove-condition-${index}`}
      >
        <DeleteIcon fontSize="small" />
      </IconButton>
    </fieldset>
  )
}

export const SmartPlaylistBuilder = (props) => {
  const { source = 'rules' } = props
  const classes = useStyles()
  const translate = useTranslate()

  const [schema, setSchema] = useState(null)
  const [schemaStatus, setSchemaStatus] = useState('loading')
  const schemaRef = useRef(null)
  const translateRef = useRef(translate)
  translateRef.current = translate
  schemaRef.current = schemaStatus === 'error' ? null : schema

  const validate = useMemo(
    () => (value) =>
      validateSmartPlaylistRules(value, schemaRef.current, (...args) =>
        translateRef.current(...args),
      ),
    [],
  )

  const {
    input: { value, onChange },
    meta: { error },
  } = useInput({ source, validate })

  const draftRef = useRef(null)

  const loadSchema = useCallback(() => {
    setSchemaStatus('loading')
    httpClient(CRITERIA_FIELDS_ENDPOINT)
      .then(({ json }) => {
        setSchema(json)
        setSchemaStatus('ready')
      })
      .catch(() => {
        setSchema(null)
        setSchemaStatus('error')
      })
  }, [])

  useEffect(() => {
    loadSchema()
  }, [loadSchema])

  const enabled = !!value
  const conjunction = getConjunction(value)
  const conditions = getConditions(value)
  const sort = value?.sort || ''
  const order = value?.order || 'desc'
  const limit = value?.limit ?? 100

  const emit = useCallback(
    (patch) => {
      const next = {
        [patch.conjunction || conjunction]: patch.conditions || conditions,
        order: patch.order !== undefined ? patch.order : order,
        limit: patch.limit !== undefined ? patch.limit : limit,
      }
      const nextSort = patch.sort !== undefined ? patch.sort : sort
      if (nextSort) next.sort = nextSort
      onChange(next)
    },
    [conjunction, conditions, order, limit, sort, onChange],
  )

  const handleToggle = (e) => {
    const checked = e.target.checked
    if (checked) {
      onChange(draftRef.current || defaultRules(schema))
    } else {
      if (value) draftRef.current = value
      onChange(null)
    }
  }

  const handlePreset = (preset) => {
    onChange(JSON.parse(JSON.stringify(preset.rules)))
  }

  const handleAddCondition = () => {
    const field = preferredField(schema)
    const fieldName = field?.canonicalName || field?.name || ''
    const operator = preferredOperator(schema)
    emit({
      conditions: [
        ...conditions,
        buildExpression(operator, fieldName, field?.boolean ? false : ''),
      ],
    })
  }

  const handleRemoveCondition = (index) => {
    emit({ conditions: conditions.filter((_, i) => i !== index) })
  }

  const handleConditionChange = (index, expression) => {
    emit({
      conditions: conditions.map((c, i) => (i === index ? expression : c)),
    })
  }

  const canAddCondition = schemaStatus === 'ready'

  return (
    <div className={classes.root} data-testid="smart-playlist-builder">
      <div className={classes.header}>
        <FormControlLabel
          control={
            <Switch
              checked={enabled}
              onChange={handleToggle}
              disabled={!enabled && schemaStatus !== 'ready'}
              inputProps={{
                'aria-label': translate('resources.playlist.smart.toggleLabel'),
                'data-testid': 'smart-playlist-toggle',
              }}
            />
          }
          label={translate('resources.playlist.smart.toggleLabel')}
        />
      </div>
      <Typography variant="body2" className={classes.help}>
        {translate('resources.playlist.smart.toggleHelp')}
      </Typography>

      {enabled && (
        <>
          {schemaStatus === 'loading' && (
            <Box display="flex" alignItems="center" gridGap={8}>
              <CircularProgress size={18} />
              <Typography variant="body2">
                {translate('resources.playlist.smart.schema.loading')}
              </Typography>
            </Box>
          )}

          {schemaStatus === 'error' && (
            <Alert
              severity="error"
              action={
                <Button color="inherit" size="small" onClick={loadSchema}>
                  {translate('resources.playlist.smart.schema.retry')}
                </Button>
              }
              data-testid="smart-playlist-schema-error"
            >
              {translate('resources.playlist.smart.schema.error')}
            </Alert>
          )}

          {schemaStatus === 'ready' && (
            <>
              <div className={classes.presets}>
                <Typography variant="body2" className={classes.help}>
                  {translate('resources.playlist.smart.presetsLabel')}
                </Typography>
                {PRESETS.map((preset) => (
                  <Button
                    key={preset.id}
                    size="small"
                    variant="outlined"
                    onClick={() => handlePreset(preset)}
                    data-testid={`smart-preset-${preset.id}`}
                  >
                    {translate(preset.labelKey)}
                  </Button>
                ))}
              </div>

              <TextField
                select
                SelectProps={{
                  native: true,
                  inputProps: { 'data-testid': 'smart-playlist-conjunction' },
                }}
                className={classes.smallField}
                variant="outlined"
                size="small"
                label={translate('resources.playlist.smart.conjunctionLabel')}
                value={conjunction}
                onChange={(e) => emit({ conjunction: e.target.value })}
              >
                <option value="all">
                  {translate('resources.playlist.smart.conjunctionAll')}
                </option>
                <option value="any">
                  {translate('resources.playlist.smart.conjunctionAny')}
                </option>
              </TextField>

              <div
                role="group"
                aria-label={translate(
                  'resources.playlist.smart.conditionsLegend',
                )}
              >
                {conditions.map((expression, index) => (
                  <ConditionRow
                    key={index}
                    index={index}
                    expression={expression}
                    schema={schema}
                    onChange={(expr) => handleConditionChange(index, expr)}
                    onRemove={() => handleRemoveCondition(index)}
                    translate={translate}
                  />
                ))}
                <Button
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={handleAddCondition}
                  disabled={!canAddCondition}
                  data-testid="add-condition"
                >
                  {translate('resources.playlist.smart.addCondition')}
                </Button>
              </div>

              <div className={classes.topRow}>
                <TextField
                  select
                  SelectProps={{
                    native: true,
                    inputProps: { 'data-testid': 'smart-playlist-sort' },
                  }}
                  className={classes.field}
                  variant="outlined"
                  size="small"
                  label={translate('resources.playlist.smart.sortLabel')}
                  value={sort}
                  onChange={(e) => emit({ sort: e.target.value })}
                >
                  <option value="">
                    {translate('resources.playlist.smart.sortNone')}
                  </option>
                  {uniqueSchemaFields(schema).map((f) => {
                    const name = optionValue(f, sort)
                    return (
                      <option key={name} value={name}>
                        {f.name}
                      </option>
                    )
                  })}
                </TextField>
                <TextField
                  select
                  SelectProps={{
                    native: true,
                    inputProps: { 'data-testid': 'smart-playlist-order' },
                  }}
                  className={classes.smallField}
                  variant="outlined"
                  size="small"
                  label={translate('resources.playlist.smart.orderLabel')}
                  value={order}
                  onChange={(e) => emit({ order: e.target.value })}
                >
                  {(schema?.orders || ['asc', 'desc']).map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </TextField>
                <TextField
                  type="number"
                  className={classes.smallField}
                  variant="outlined"
                  size="small"
                  label={translate('resources.playlist.smart.limitLabel')}
                  value={limit}
                  inputProps={{
                    min: 1,
                    max: 5000,
                    'data-testid': 'smart-playlist-limit',
                  }}
                  onChange={(e) =>
                    emit({
                      limit:
                        e.target.value === '' ? '' : Number(e.target.value),
                    })
                  }
                />
              </div>
            </>
          )}

          {error && (
            <Typography color="error" variant="caption" role="alert">
              {error}
            </Typography>
          )}
        </>
      )}
    </div>
  )
}

export default SmartPlaylistBuilder
