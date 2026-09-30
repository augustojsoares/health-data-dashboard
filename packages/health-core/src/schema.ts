/** The stable model shared by ingestion adapters, mapper previews, and storage. */
export type MetricKey =
  | 'weight' | 'waist' | 'body_fat' | 'muscle' | 'skeletal_muscle_mass'
  | 'visceral_fat' | 'bmi' | 'fat_mass' | 'fat_free_mass' | 'body_age'
  | 'bmr' | 'tdee' | 'steps' | 'calories' | 'active_calories'
  | 'heart_rate' | 'resting_heart_rate' | 'systolic_bp' | 'diastolic_bp'
  | 'sleep_duration' | 'workout_duration' | 'distance' | 'protein'
  | 'carbohydrates' | 'fat' | 'fibre' | 'sugar'

export type ObservationType =
  | 'body_composition' | 'blood_pressure' | 'heart_rate' | 'sleep'
  | 'activity' | 'daily_activity' | 'nutrition' | 'manual'

export type TimeSemantics = 'instant' | 'interval' | 'daily_total' | 'daily_summary'

export type MetricDefinition = {
  key: MetricKey
  canonicalUnit: string
  acceptedUnits: readonly string[]
  minimum: number
  maximum: number
  observationTypes: readonly ObservationType[]
  timeSemantics: TimeSemantics
}

const metric = (definition: MetricDefinition) => definition

/**
 * Initial Health Connect-compatible registry. Bounds reject malformed imports;
 * they are data-quality guardrails rather than clinical reference ranges.
 */
export const metricRegistry = {
  weight: metric({ key: 'weight', canonicalUnit: 'kg', acceptedUnits: ['kg', 'g', 'lb'], minimum: 10, maximum: 500, observationTypes: ['body_composition', 'manual'], timeSemantics: 'instant' }),
  waist: metric({ key: 'waist', canonicalUnit: 'cm', acceptedUnits: ['cm', 'm', 'in'], minimum: 20, maximum: 300, observationTypes: ['body_composition', 'manual'], timeSemantics: 'instant' }),
  body_fat: metric({ key: 'body_fat', canonicalUnit: '%', acceptedUnits: ['%', 'ratio'], minimum: 1, maximum: 100, observationTypes: ['body_composition'], timeSemantics: 'instant' }),
  muscle: metric({ key: 'muscle', canonicalUnit: '%', acceptedUnits: ['%', 'ratio'], minimum: 1, maximum: 100, observationTypes: ['body_composition'], timeSemantics: 'instant' }),
  skeletal_muscle_mass: metric({ key: 'skeletal_muscle_mass', canonicalUnit: 'kg', acceptedUnits: ['kg', 'g', 'lb'], minimum: 1, maximum: 300, observationTypes: ['body_composition'], timeSemantics: 'instant' }),
  visceral_fat: metric({ key: 'visceral_fat', canonicalUnit: 'index', acceptedUnits: ['index'], minimum: 1, maximum: 100, observationTypes: ['body_composition'], timeSemantics: 'instant' }),
  bmi: metric({ key: 'bmi', canonicalUnit: 'kg/m2', acceptedUnits: ['kg/m2'], minimum: 5, maximum: 100, observationTypes: ['body_composition'], timeSemantics: 'instant' }),
  fat_mass: metric({ key: 'fat_mass', canonicalUnit: 'kg', acceptedUnits: ['kg', 'g', 'lb'], minimum: 0.1, maximum: 300, observationTypes: ['body_composition'], timeSemantics: 'instant' }),
  fat_free_mass: metric({ key: 'fat_free_mass', canonicalUnit: 'kg', acceptedUnits: ['kg', 'g', 'lb'], minimum: 1, maximum: 400, observationTypes: ['body_composition'], timeSemantics: 'instant' }),
  body_age: metric({ key: 'body_age', canonicalUnit: 'years', acceptedUnits: ['years'], minimum: 1, maximum: 130, observationTypes: ['body_composition'], timeSemantics: 'instant' }),
  bmr: metric({ key: 'bmr', canonicalUnit: 'kcal/day', acceptedUnits: ['kcal/day', 'kcal'], minimum: 100, maximum: 10000, observationTypes: ['body_composition'], timeSemantics: 'daily_summary' }),
  tdee: metric({ key: 'tdee', canonicalUnit: 'kcal/day', acceptedUnits: ['kcal/day', 'kcal'], minimum: 100, maximum: 20000, observationTypes: ['body_composition', 'daily_activity'], timeSemantics: 'daily_summary' }),
  steps: metric({ key: 'steps', canonicalUnit: 'count', acceptedUnits: ['count', 'steps'], minimum: 0, maximum: 500000, observationTypes: ['daily_activity'], timeSemantics: 'daily_total' }),
  calories: metric({ key: 'calories', canonicalUnit: 'kcal', acceptedUnits: ['kcal', 'kJ'], minimum: 0, maximum: 50000, observationTypes: ['daily_activity', 'nutrition'], timeSemantics: 'daily_total' }),
  active_calories: metric({ key: 'active_calories', canonicalUnit: 'kcal', acceptedUnits: ['kcal', 'kJ'], minimum: 0, maximum: 50000, observationTypes: ['activity', 'daily_activity'], timeSemantics: 'daily_total' }),
  heart_rate: metric({ key: 'heart_rate', canonicalUnit: 'bpm', acceptedUnits: ['bpm'], minimum: 15, maximum: 300, observationTypes: ['heart_rate', 'activity'], timeSemantics: 'instant' }),
  resting_heart_rate: metric({ key: 'resting_heart_rate', canonicalUnit: 'bpm', acceptedUnits: ['bpm'], minimum: 15, maximum: 250, observationTypes: ['heart_rate'], timeSemantics: 'daily_summary' }),
  systolic_bp: metric({ key: 'systolic_bp', canonicalUnit: 'mmHg', acceptedUnits: ['mmHg'], minimum: 40, maximum: 300, observationTypes: ['blood_pressure'], timeSemantics: 'instant' }),
  diastolic_bp: metric({ key: 'diastolic_bp', canonicalUnit: 'mmHg', acceptedUnits: ['mmHg'], minimum: 20, maximum: 200, observationTypes: ['blood_pressure'], timeSemantics: 'instant' }),
  sleep_duration: metric({ key: 'sleep_duration', canonicalUnit: 'min', acceptedUnits: ['min', 'h', 's'], minimum: 0, maximum: 1440, observationTypes: ['sleep'], timeSemantics: 'interval' }),
  workout_duration: metric({ key: 'workout_duration', canonicalUnit: 'min', acceptedUnits: ['min', 'h', 's'], minimum: 0, maximum: 1440, observationTypes: ['activity'], timeSemantics: 'interval' }),
  distance: metric({ key: 'distance', canonicalUnit: 'm', acceptedUnits: ['m', 'km', 'mi'], minimum: 0, maximum: 2000000, observationTypes: ['activity', 'daily_activity'], timeSemantics: 'interval' }),
  protein: metric({ key: 'protein', canonicalUnit: 'g', acceptedUnits: ['g', 'mg', 'oz'], minimum: 0, maximum: 5000, observationTypes: ['nutrition'], timeSemantics: 'daily_total' }),
  carbohydrates: metric({ key: 'carbohydrates', canonicalUnit: 'g', acceptedUnits: ['g', 'mg', 'oz'], minimum: 0, maximum: 5000, observationTypes: ['nutrition'], timeSemantics: 'daily_total' }),
  fat: metric({ key: 'fat', canonicalUnit: 'g', acceptedUnits: ['g', 'mg', 'oz'], minimum: 0, maximum: 5000, observationTypes: ['nutrition'], timeSemantics: 'daily_total' }),
  fibre: metric({ key: 'fibre', canonicalUnit: 'g', acceptedUnits: ['g', 'mg', 'oz'], minimum: 0, maximum: 1000, observationTypes: ['nutrition'], timeSemantics: 'daily_total' }),
  sugar: metric({ key: 'sugar', canonicalUnit: 'g', acceptedUnits: ['g', 'mg', 'oz'], minimum: 0, maximum: 5000, observationTypes: ['nutrition'], timeSemantics: 'daily_total' })
} as const satisfies Record<MetricKey, MetricDefinition>

export type CanonicalMetric = { key: MetricKey; value: number; unit: string; isDerived?: boolean }
export type SourceMetadata = { source: string; sourceIdentity: string; receivedAt?: string; mapperId?: string; mapperVersion?: number; upstream?: Record<string, unknown> }
export type CanonicalObservation = { type: ObservationType; timestamp: string; timezone?: string; intervalEnd?: string; source: SourceMetadata; metrics: CanonicalMetric[]; raw?: unknown }
export type ValidationIssue = { path: string; message: string }

export function validateCanonicalObservation(observation: CanonicalObservation): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  if (!/^\d{4}-\d{2}-\d{2}T/.test(observation.timestamp) || !Number.isFinite(Date.parse(observation.timestamp))) issues.push({ path: 'timestamp', message: 'must be an ISO timestamp' })
  if (!observation.source.source.trim() || !observation.source.sourceIdentity.trim()) issues.push({ path: 'source', message: 'source and sourceIdentity are required' })
  if (!observation.metrics.length) issues.push({ path: 'metrics', message: 'at least one metric is required' })
  for (const [index, value] of observation.metrics.entries()) {
    const definition = metricRegistry[value.key]
    const path = `metrics[${index}]`
    if (!definition) { issues.push({ path: `${path}.key`, message: 'is not registered' }); continue }
    if (!definition.observationTypes.includes(observation.type)) issues.push({ path: `${path}.key`, message: `is not valid for ${observation.type}` })
    if (value.unit !== definition.canonicalUnit) issues.push({ path: `${path}.unit`, message: `must be ${definition.canonicalUnit}` })
    if (!Number.isFinite(value.value) || value.value < definition.minimum || value.value > definition.maximum) issues.push({ path: `${path}.value`, message: `must be between ${definition.minimum} and ${definition.maximum}` })
  }
  return issues
}
