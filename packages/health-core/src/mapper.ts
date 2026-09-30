import { metricRegistry, type CanonicalMetric, type CanonicalObservation, type MetricKey, type ValidationIssue, validateCanonicalObservation } from './schema.js'

export type Path = string
export type Condition = { path: Path; exists?: boolean; equals?: unknown; notEquals?: unknown }
export type Transform =
  | { kind: 'number'; decimalComma?: boolean }
  | { kind: 'timestamp'; timezone?: string }
  | { kind: 'duration'; from: 's' | 'min' | 'h'; to: 's' | 'min' | 'h' }
  | { kind: 'unit'; from: string | Path; to: string }
  | { kind: 'trim' }

export type MappingNode = string | number | boolean | null | {
  from?: Path
  fallback?: MappingNode[]
  default?: unknown
  when?: Condition
  transforms?: Transform[]
  map?: Record<string, MappingNode>
  merge?: MappingNode[]
}
export type MapperDefinition = { id: string; version: number; target: Record<string, MappingNode>; required?: readonly Path[] }
export type MappingResult = { value: Record<string, unknown>; issues: ValidationIssue[] }

const missing = Symbol('missing')
const isNode = (value: MappingNode): value is Exclude<MappingNode, string | number | boolean | null> => typeof value === 'object' && value !== null

export function getPath(input: unknown, path: Path): unknown {
  return path.split('.').reduce<unknown>((value, part) => {
    if (value === null || typeof value !== 'object') return undefined
    return (value as Record<string, unknown>)[part]
  }, input)
}

function conditionMatches(source: unknown, condition: Condition) {
  const value = getPath(source, condition.path)
  if (condition.exists !== undefined && (value !== undefined) !== condition.exists) return false
  if (condition.equals !== undefined && value !== condition.equals) return false
  return condition.notEquals === undefined || value !== condition.notEquals
}

function convertUnit(value: number, from: string, to: string): number | undefined {
  const unit = from.toLowerCase(), destination = to.toLowerCase()
  if (unit === destination) return value
  const conversions: Record<string, number> = { 'g:kg': 0.001, 'lb:kg': 0.45359237, 'm:cm': 100, 'in:cm': 2.54, 'ratio:%': 100, 'kj:kcal': 0.239005736, 'h:min': 60, 's:min': 1 / 60, 'km:m': 1000, 'mi:m': 1609.344, 'mg:g': 0.001, 'oz:g': 28.349523125 }
  return conversions[`${unit}:${destination}`] === undefined ? undefined : value * conversions[`${unit}:${destination}`]
}

function transform(value: unknown, transforms: readonly Transform[], source: unknown): unknown {
  return transforms.reduce<unknown>((current, item) => {
    if (current === undefined || current === null) return current
    if (item.kind === 'trim') return typeof current === 'string' ? current.trim() : current
    if (item.kind === 'number') {
      if (typeof current === 'number') return current
      const parsed = Number(String(current).trim().replace(item.decimalComma ? ',' : /$^/, '.'))
      return Number.isFinite(parsed) ? parsed : undefined
    }
    if (item.kind === 'timestamp') {
      const text = String(current).trim()
      const date = new Date(item.timezone && !/[zZ]|[+-]\d\d:\d\d$/.test(text) ? `${text} ${item.timezone}` : text)
      return Number.isFinite(date.getTime()) ? date.toISOString() : undefined
    }
    if (typeof current !== 'number') return undefined
    if (item.kind === 'duration') return convertUnit(current, item.from, item.to)
    const from = item.from.includes('.') ? getPath(source, item.from) : item.from
    return typeof from === 'string' ? convertUnit(current, from, item.to) : undefined
  }, value)
}

function resolve(node: MappingNode, source: unknown): unknown {
  if (!isNode(node)) return node
  if (node.when && !conditionMatches(source, node.when)) return missing
  if (node.map) {
    const result: Record<string, unknown> = {}
    for (const [key, child] of Object.entries(node.map)) {
      const value = resolve(child, source)
      if (value !== missing && value !== undefined) result[key] = value
    }
    return result
  }
  if (node.merge) {
    return node.merge.reduce<Record<string, unknown>>((result, part) => {
      const value = resolve(part, source)
      return value && typeof value === 'object' && !Array.isArray(value) ? { ...result, ...(value as Record<string, unknown>) } : result
    }, {})
  }
  let value = node.from ? getPath(source, node.from) : undefined
  if (value === undefined) for (const fallback of node.fallback ?? []) { value = resolve(fallback, source); if (value !== missing && value !== undefined) break }
  if (value === undefined) value = node.default
  return transform(value, node.transforms ?? [], source)
}

export function mapRecord(definition: MapperDefinition, source: unknown): MappingResult {
  const value = resolve({ map: definition.target }, source) as Record<string, unknown>
  const issues = (definition.required ?? []).flatMap(path => {
    const field = getPath(value, path)
    return field === undefined || field === null || field === '' ? [{ path, message: 'is required' }] : []
  })
  return { value, issues }
}

/** Converts mapper output to the API/storage contract and validates it against the registry. */
export function toCanonicalObservation(value: Record<string, unknown>): { observation?: CanonicalObservation; issues: ValidationIssue[] } {
  const metrics = Array.isArray(value.metrics) ? value.metrics as CanonicalMetric[] : []
  const observation: CanonicalObservation = {
    type: value.type as CanonicalObservation['type'], timestamp: String(value.timestamp ?? ''),
    timezone: typeof value.timezone === 'string' ? value.timezone : undefined,
    intervalEnd: typeof value.intervalEnd === 'string' ? value.intervalEnd : undefined,
    source: value.source as CanonicalObservation['source'], metrics, raw: value.raw
  }
  if (!observation.source || typeof observation.source.source !== 'string' || typeof observation.source.sourceIdentity !== 'string') return { issues: [{ path: 'source', message: 'source metadata is required' }] }
  return { observation, issues: validateCanonicalObservation(observation) }
}

export function mapHealthMetric(key: MetricKey, rawValue: unknown, rawUnit: string): { metric?: CanonicalMetric; issues: ValidationIssue[] } {
  const definition = metricRegistry[key]
  const value = transform(rawValue, [{ kind: 'number', decimalComma: true }, { kind: 'unit', from: rawUnit, to: definition.canonicalUnit }], {})
  if (typeof value !== 'number') return { issues: [{ path: 'value', message: `cannot convert ${rawUnit} to ${definition.canonicalUnit}` }] }
  const metric = { key, value, unit: definition.canonicalUnit }
  const issues = validateCanonicalObservation({ type: definition.observationTypes[0], timestamp: new Date().toISOString(), source: { source: 'validation', sourceIdentity: 'validation' }, metrics: [metric] })
  return issues.length ? { issues } : { metric, issues: [] }
}
