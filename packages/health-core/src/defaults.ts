import type { MapperDefinition } from './mapper.js'

export type HealthMapperDefinition = MapperDefinition & { source: string; name: string }

/** Shipped, immutable starting points. User copies are stored separately. */
export const defaultHealthMappers: readonly HealthMapperDefinition[] = [
  {
    id: 'health-sync-canonical', version: 1, source: 'health_sync', name: 'Health Sync canonical export',
    required: ['type', 'timestamp', 'source.source', 'source.sourceIdentity', 'metrics'],
    target: {
      type: { from: 'type' }, timestamp: { from: 'timestamp', transforms: [{ kind: 'timestamp' }] },
      source: { map: { source: { from: 'source' }, sourceIdentity: { from: 'sourceIdentity' }, upstream: { from: 'provenance' } } },
      raw: { from: 'raw' }, metrics: { each: { from: 'metrics', map: { key: { from: 'key' }, value: { from: 'value', transforms: [{ kind: 'number', decimalComma: true }] }, unit: { from: 'unit' }, isDerived: { from: 'isDerived', default: false } } } }
    }
  }
]

export const defaultMapperForSource = (source: string) => defaultHealthMappers.find(mapper => mapper.source === source)
