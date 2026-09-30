import assert from 'node:assert/strict'
import test from 'node:test'
import { defaultMapperForSource, mapRecord, toCanonicalObservation } from '../dist/index.js'

test('Health Sync default maps its current ingestion contract to a canonical observation', () => {
  const mapper = defaultMapperForSource('health_sync')
  assert.ok(mapper)
  const mapped = mapRecord(mapper, { source: 'csv_import', sourceIdentity: 'weight:1', type: 'body_composition', timestamp: '2026-09-30T08:00:00Z', raw: { weight: '75.2' }, provenance: { file: 'example.csv' }, metrics: [{ key: 'weight', value: '75,2', unit: 'kg' }] })
  assert.deepEqual(mapped.issues, [])
  assert.equal(toCanonicalObservation(mapped.value).issues.length, 0)
})
