import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { canonicalizeRecord } from '../_shared/canonical.ts'

const encoder = new TextEncoder()
const constantTimeEqual = (left: string, right: string) => {
  const a = encoder.encode(left); const b = encoder.encode(right)
  if (a.length !== b.length) return false
  let difference = 0
  for (let index = 0; index < a.length; index++) difference |= a[index] ^ b[index]
  return difference === 0
}
const localDate = (timestamp: string) => new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC' }).format(new Date(timestamp))
const sha256 = async (value: unknown) => {
  const hash = await crypto.subtle.digest('SHA-256', encoder.encode(JSON.stringify(value)))
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

type ImportRecord = { source: string; sourceIdentity: string; timestamp: string; type: string; logicalIdentity?: string; raw: unknown; metrics: { key: string; value: number; unit?: string; isDerived?: boolean }[]; provenance?: Record<string, unknown> }
Deno.serve(async request => {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 })
  const expected = Deno.env.get('HEALTH_SYNC_INGEST_SECRET')
  if (!expected || !constantTimeEqual(request.headers.get('authorization') ?? '', expected)) return new Response('Unauthorized', { status: 401 })
  let body: { records?: ImportRecord[] }; try { body = await request.json() } catch { return new Response('Invalid JSON', { status: 400 }) }
  if (!Array.isArray(body.records)) return new Response('records array required', { status: 422 })
  const db = createClient(Deno.env.get('SUPABASE_URL')!, serviceRoleKey())
  const ownerId = configuredOwnerId()
  await db.from('ingestion_raw_events').upsert({ source: 'health_sync', payload_hash: await sha256(body), payload: body }, { onConflict: 'source,payload_hash' })
  let accepted=0,rejected=0
  for (const record of body.records) {
    if (!record.source || !record.sourceIdentity || !record.timestamp || !Array.isArray(record.metrics)) { rejected++; continue }
    const normalized=canonicalizeRecord(record)
    const run={owner_id:ownerId,mapper_id:'health-sync-canonical',mapper_version:1,source:record.source,source_identity:record.sourceIdentity,status:normalized.issues.length?'rejected':'accepted',issues:normalized.issues,output:normalized.issues.length?null:normalized.record}
    const audit=await db.from('health_mapping_runs').insert(run)
    if(audit.error) return Response.json({error:audit.error.message},{status:500})
    if(normalized.issues.length){rejected++;continue}
    const base = { owner_id: ownerId, source: record.source, source_identity: record.sourceIdentity, logical_identity: record.logicalIdentity ?? null, source_timestamp: normalized.record.timestamp, local_date: localDate(normalized.record.timestamp), observation_type: normalized.record.type, raw_measurement: record.raw, provenance: { ...(record.provenance ?? {}), mapper_id:'health-sync-canonical', mapper_version:1 } }
    const saved = await db.from('health_observations').upsert(base, { onConflict: 'source,source_identity' }).select('id').single(); if (saved.error) return Response.json({ error: saved.error.message }, { status: 500 })
    const metrics = normalized.record.metrics.map(m => ({ observation_id: saved.data.id, owner_id: base.owner_id, metric_key: m.key, value_numeric: m.value, unit: m.unit, is_derived: Boolean(m.isDerived), source_timestamp: base.source_timestamp }))
    if (metrics.length) { const res = await db.from('health_metrics').upsert(metrics, { onConflict: 'observation_id,metric_key' }); if (res.error) return Response.json({ error: res.error.message }, { status: 500 }) }
    accepted++
  }
  return Response.json({ accepted, rejected })
})
