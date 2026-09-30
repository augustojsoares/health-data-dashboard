import assert from 'node:assert/strict'
import test from 'node:test'
import { getPath, mapHealthMetric, mapRecord, toCanonicalObservation } from '../dist/index.js'

test('mapper resolves paths, fallbacks, defaults, conditions, nested maps, and merges', () => {
  const result = mapRecord({
    id: 'example', version: 1, required: ['timestamp', 'source.sourceIdentity'],
    target: {
      timestamp: { from: 'reading.recorded_at', transforms: [{ kind: 'timestamp' }] },
      label: { from: 'reading.label', fallback: [{ from: 'device.name' }, { default: 'Imported reading' }], transforms: [{ kind: 'trim' }] },
      source: { map: { source: { default: 'test_device' }, sourceIdentity: { from: 'reading.id' } } },
      provenance: { merge: [{ map: { device: { from: 'device.name' } } }, { map: { transport: { default: 'sample' } } }] },
      optional: { from: 'reading.note', when: { path: 'flags.includeNote', equals: true } }
    }
  }, { reading: { id: 'abc', recorded_at: '2026-09-30T08:00:00Z', label: '  Morning  ' }, device: { name: 'Scale' }, flags: { includeNote: false } })
  assert.equal(result.value.timestamp, '2026-09-30T08:00:00.000Z')
  assert.equal(result.value.label, 'Morning')
  assert.deepEqual(result.value.source, { source: 'test_device', sourceIdentity: 'abc' })
  assert.deepEqual(result.value.provenance, { device: 'Scale', transport: 'sample' })
  assert.equal('optional' in result.value, false)
  assert.deepEqual(result.issues, [])
})

test('mapper reports missing required output fields', () => {
  const result = mapRecord({ id: 'required', version: 1, required: ['timestamp'], target: {} }, {})
  assert.deepEqual(result.issues, [{ path: 'timestamp', message: 'is required' }])
})

test('mapper supports indexed, collected, and quoted path segments with array-item maps', () => {
  const source = {
    readings: [{ metric: 'weight', value: '75.2' }, { metric: 'body_fat', value: '18.4' }],
    'device.name': 'Scale'
  }
  assert.equal(getPath(source, 'readings[0].metric'), 'weight')
  assert.deepEqual(getPath(source, 'readings[].value'), ['75.2', '18.4'])
  assert.equal(getPath(source, '["device.name"]'), 'Scale')
  const result = mapRecord({
    id: 'array-mapping', version: 1,
    target: { metrics: { each: { from: 'readings', map: { key: { from: 'metric' }, value: { from: 'value', transforms: [{ kind: 'number' }] } } } } }
  }, source)
  assert.deepEqual(result.value.metrics, [{ key: 'weight', value: 75.2 }, { key: 'body_fat', value: 18.4 }])
})

test('timestamp transform handles explicit Unix epochs', () => {
  const result = mapRecord({ id: 'epoch', version: 1, target: { timestamp: { from: 'recorded', transforms: [{ kind: 'timestamp', epoch: 's' }] } } }, { recorded: 1727683200 })
  assert.equal(result.value.timestamp, '2024-09-30T08:00:00.000Z')
})

test('health transforms convert numeric formats and supported units to the registry unit', () => {
  assert.deepEqual(mapHealthMetric('weight', '176,37', 'lb').metric, { key: 'weight', value: 80.00008629690001, unit: 'kg' })
  assert.deepEqual(mapHealthMetric('sleep_duration', 8, 'h').metric, { key: 'sleep_duration', value: 480, unit: 'min' })
  assert.ok(mapHealthMetric('weight', 1, 'stone').issues.length)
})

test('canonical adapter returns only registry-valid output', () => {
  const mapped = toCanonicalObservation({
    type: 'body_composition', timestamp: '2026-09-30T08:00:00Z',
    source: { source: 'openscale', sourceIdentity: '1:2', mapperId: 'openscale-default', mapperVersion: 1 },
    metrics: [{ key: 'weight', value: 75, unit: 'kg' }]
  })
  assert.equal(mapped.issues.length, 0)
  assert.equal(mapped.observation?.source.mapperId, 'openscale-default')
  assert.equal(getPath({ a: { b: 2 } }, 'a.b'), 2)
})
