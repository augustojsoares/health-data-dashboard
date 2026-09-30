import { FormEvent, useMemo, useState } from 'react'
import { defaultHealthMappers, mapRecord, toCanonicalObservation, type HealthMapperDefinition } from '../packages/health-core/src/index'
import { supabase } from './supabase'

type StoredMapper = { id:string; mapper_id:string; source:string; version:number; name:string; definition:HealthMapperDefinition }

export function MapperStudio({ ownerId, saved, reload }:{ ownerId:string; saved:StoredMapper[]; reload:()=>Promise<void> }) {
  const [selected,setSelected]=useState<HealthMapperDefinition>(defaultHealthMappers[0])
  const [sample,setSample]=useState('{\n  "source": "csv_import",\n  "sourceIdentity": "example:1",\n  "type": "body_composition",\n  "timestamp": "2026-09-30T08:00:00Z",\n  "raw": { "weight": "75.2" },\n  "metrics": [{ "key": "weight", "value": "75.2", "unit": "kg" }]\n}')
  const [result,setResult]=useState<string>('')
  const choices=useMemo(()=>[...defaultHealthMappers,...saved.map(row=>row.definition)], [saved])
  const preview=(event:FormEvent)=>{event.preventDefault();try { const mapped=mapRecord(selected,JSON.parse(sample)); const canonical=toCanonicalObservation(mapped.value); setResult(JSON.stringify({ mapped: mapped.value, issues: [...mapped.issues,...canonical.issues] },null,2)) } catch (error) { setResult(JSON.stringify({ issues:[{ path:'sample', message:error instanceof Error?error.message:'Invalid JSON' }] },null,2)) }}
  const save=async()=>{if(!supabase)return;const { error }=await supabase.from('health_mapper_definitions').insert({ owner_id:ownerId, mapper_id:selected.id, source:selected.source, version:selected.version, name:selected.name, definition:selected });if(error)setResult(JSON.stringify({ issues:[{path:'save',message:error.message}] },null,2));else await reload()}
  return <section className="mapper-grid"><article className="panel"><p className="eyebrow">MAPPER ENGINE</p><h2>Preview an import</h2><p className="caption">Mappings run against a sample locally. Saving creates your own versioned copy; it does not change existing records.</p><label>Mapper<select value={`${selected.id}:${selected.version}`} onChange={event=>{const next=choices.find(mapper=>`${mapper.id}:${mapper.version}`===event.target.value);if(next)setSelected(next)}}>{choices.map(mapper=><option key={`${mapper.id}:${mapper.version}`} value={`${mapper.id}:${mapper.version}`}>{mapper.name} · v{mapper.version}</option>)}</select></label><form onSubmit={preview}><label>Raw record JSON<textarea value={sample} onChange={event=>setSample(event.target.value)} rows={13} spellCheck={false}/></label><div><button type="submit">Preview mapping</button><button type="button" className="quiet" onClick={()=>void save()}>Save a versioned copy</button></div></form></article><article className="panel"><p className="eyebrow">CANONICAL OUTPUT</p><h2>Validation result</h2><pre className="mapper-output">{result||'Run a preview to see the canonical record and any validation issues.'}</pre></article></section>
}
