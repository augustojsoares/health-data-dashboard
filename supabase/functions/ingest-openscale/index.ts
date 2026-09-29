import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const encoder = new TextEncoder()
const constantTimeEqual = (left: string, right: string) => {
  const a = encoder.encode(left)
  const b = encoder.encode(right)
  if (a.length !== b.length) return false
  let difference = 0
  for (let index = 0; index < a.length; index++) difference |= a[index] ^ b[index]
  return difference === 0
}
const localDate = (timestamp: string) => new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC' }).format(new Date(timestamp))
const sha256 = async (value: unknown) => {
  const bytes = encoder.encode(JSON.stringify(value))
  const hash = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(hash)].map(byte => byte.toString(16).padStart(2, '0')).join('')
}
const serviceRoleKey = () => {
  const key = Deno.env.get('HEALTH_DASHBOARD_SERVER_KEY')
  if (!key) throw new Error('Supabase service key is unavailable')
  return key
}
const configuredOwnerId = () => {
  const ownerId = Deno.env.get('HEALTH_DATA_OWNER_ID')
  if (!ownerId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(ownerId)) throw new Error('HEALTH_DATA_OWNER_ID must be a user UUID')
  return ownerId
}

type OpenScaleValue = { key?: string; name?: string; unit?: string; isDerived?: boolean; value?: number }
type OpenScaleMeasurement = { id?: number | string; userId?: number | string; username?: string; date?: string; weight?: number; body_fat?: number; water?: number; muscle?: number; values?: OpenScaleValue[] }
type Metric = { key: string; value: number; unit?: string | null; isDerived?: boolean }
const metricNames: Record<string, string> = { weight: 'weight', body_fat: 'body_fat', water: 'water', muscle: 'muscle', visceral_fat: 'visceral_fat', bmr: 'bmr', tdee: 'tdee', bmi: 'bmi' }

Deno.serve(async (request) => {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 })
  const expected = Deno.env.get('OPENSCALE_WEBHOOK_SECRET')
  if (!expected || !constantTimeEqual(request.headers.get('authorization') ?? '', expected)) return new Response('Unauthorized', { status: 401 })
  let body: { event?: string; measurements?: OpenScaleMeasurement[] }
  try { body = await request.json() } catch { return new Response('Invalid JSON', { status: 400 }) }
  // openScale's "Test connection" sends a probe rather than a measurement update.
  // Acknowledge it without storing anything; real syncs must still be update events.
  if (body.event !== 'update' && !Array.isArray(body.measurements)) return Response.json({ ok: true, probe: true })
  if (body.event !== 'update' || !Array.isArray(body.measurements)) return new Response('Expected an update event with measurements', { status: 422 })
  const db = createClient(Deno.env.get('SUPABASE_URL')!, serviceRoleKey())
  const ownerId = configuredOwnerId()
  const rawHash = await sha256(body)
  const raw = await db.from('ingestion_raw_events').upsert({ source: 'openscale', payload_hash: rawHash, payload: body }, { onConflict: 'source,payload_hash' })
  if (raw.error) return new Response(JSON.stringify({ error: raw.error.message }), { status: 500 })
  let accepted = 0
  for (const measurement of body.measurements) {
    if (measurement.id == null || measurement.userId == null || !measurement.date || Number.isNaN(Date.parse(measurement.date))) continue
    const values = new Map<string, OpenScaleValue>()
    for (const item of measurement.values ?? []) if (item.key && typeof item.value === 'number') values.set(item.key, item)
    const direct: Metric[] = [
      ['weight', measurement.weight, 'kg'], ['body_fat', measurement.body_fat, '%'], ['muscle', measurement.muscle, '%']
    ].flatMap(([key, value, unit]) => typeof value === 'number' && value !== 0 ? [{ key: String(key), value, unit: String(unit), isDerived: false }] : [])
    // openScale Sync serializes missing water as 0. It is intentionally omitted.
    const extra = [...values.values()].flatMap(value => value.key && typeof value.value === 'number' && metricNames[value.key] ? [{ key: metricNames[value.key], value: value.value, unit: value.unit ?? null, isDerived: Boolean(value.isDerived) }] : [])
    const metrics = [...direct, ...extra.filter(item => !direct.some(d => d.key === item.key))]
    const sourceIdentity = `${measurement.userId}:${measurement.id}`
    const observation = { owner_id: ownerId, source: 'openscale', source_identity: sourceIdentity, logical_identity: `body-composition:${localDate(measurement.date)}:${Math.round((measurement.weight ?? -1) * 10)}`, source_timestamp: measurement.date, local_date: localDate(measurement.date), observation_type: 'body_composition', raw_measurement: measurement, provenance: { upstream: 'webhook', upstream_user_id: measurement.userId, upstream_measurement_id: measurement.id } }
    const saved = await db.from('health_observations').upsert(observation, { onConflict: 'source,source_identity' }).select('id').single()
    if (saved.error) return new Response(JSON.stringify({ error: saved.error.message }), { status: 500 })
    const rows = metrics.map(m => ({ observation_id: saved.data.id, owner_id: observation.owner_id, metric_key: m.key, value_numeric: m.value, unit: m.unit ?? null, is_derived: Boolean(m.isDerived), source_timestamp: measurement.date }))
    if (rows.length) { const result = await db.from('health_metrics').upsert(rows, { onConflict: 'observation_id,metric_key' }); if (result.error) return new Response(JSON.stringify({ error: result.error.message }), { status: 500 }) }
    accepted++
  }
  return Response.json({ accepted, received: body.measurements.length })
})
