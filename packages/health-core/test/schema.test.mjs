import assert from 'node:assert/strict'
import test from 'node:test'
import { metricRegistry, validateCanonicalObservation } from '../dist/index.js'

test('registry defines a canonical unit and time meaning for every metric', () => {
  for (const definition of Object.values(metricRegistry)) {
    assert.ok(definition.canonicalUnit)
    assert.ok(definition.acceptedUnits.includes(definition.canonicalUnit))
    assert.ok(definition.minimum <= definition.maximum)
    assert.ok(definition.observationTypes.length)
  }
})

test('canonical validation accepts a valid body-composition reading', () => {
  const issues = validateCanonicalObservation({
    type: 'body_composition', timestamp: '2026-09-30T07:30:00.000Z',
    source: { source: 'openscale', sourceIdentity: '42:100' },
    metrics: [{ key: 'weight', value: 75.3, unit: 'kg' }]
  })
  assert.deepEqual(issues, [])
})

test('canonical validation rejects unsupported units, ranges, and observation pairings', () => {
  const issues = validateCanonicalObservation({
    type: 'sleep', timestamp: 'not-a-time', source: { source: '', sourceIdentity: '' },
    metrics: [{ key: 'heart_rate', value: 900, unit: 'Hz' }]
  })
  assert.equal(issues.length, 5)
  assert.ok(issues.some(issue => issue.path === 'metrics[0].unit'))
})
