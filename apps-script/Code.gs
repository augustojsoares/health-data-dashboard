/*
 * Daily CSV -> Supabase importer.
 * Create a standalone Apps Script project, paste this file, set script
 * properties (SUPABASE_INGEST_URL, HEALTH_SYNC_INGEST_SECRET), then add a
 * daily time-driven trigger for importCsvExports.
 */
// Set HEALTH_DATA_EXPORT_FOLDER_ID to the Drive folder holding CSV exports.
// Subfolders are optional; their names help classify the record type.
const METRIC_ALIASES = {
  weight: 'weight', peso: 'weight', bodyfat: 'body_fat', body_fat: 'body_fat', percentagem_de_gordura_corporal: 'body_fat',
  porcentagem_de_musculo_esqueletico: 'muscle', percentagem_de_musculo_esqueletico: 'muscle', massa_muscular_esqueletica: 'skeletal_muscle_mass',
  circunferencia_abdominal: 'waist', perimetro_abdominal: 'waist', abdominal_perimeter: 'waist',
  taxa_metabolica_basica: 'bmr', steps: 'steps', passos: 'steps', calories: 'calories', energia: 'calories', energia_queimada: 'calories',
  heartrate: 'heart_rate', heart_rate: 'heart_rate', frequencia_cardiaca: 'heart_rate',
  resting_heart_rate: 'resting_heart_rate', resting_hr: 'resting_heart_rate', frequencia_cardiaca_em_repouso: 'resting_heart_rate',
  systolic: 'systolic_bp', sistolica: 'systolic_bp', pressao_sistolica: 'systolic_bp', diastolic: 'diastolic_bp', diastolica: 'diastolic_bp', pressao_diastolica: 'diastolic_bp',
  distancia: 'distance', distance: 'distance', duracao: 'workout_duration', duration: 'workout_duration', calorias_ativas: 'active_calories',
  proteina: 'protein', proteinas: 'protein', protein: 'protein', carboidratos: 'carbohydrates', carbohydrate: 'carbohydrates', carbohydrates: 'carbohydrates',
  gordura: 'fat', gorduras: 'fat', fat: 'fat', fibra: 'fibre', fiber: 'fibre', fibre: 'fibre', acucar: 'sugar', sugar: 'sugar'
};

function importCsvExports() {
  const props = PropertiesService.getScriptProperties();
  const exportRootFolderId = props.getProperty('HEALTH_DATA_EXPORT_FOLDER_ID');
  if (!exportRootFolderId) throw new Error('HEALTH_DATA_EXPORT_FOLDER_ID is required');
  const imported = JSON.parse(props.getProperty('IMPORTED_FILE_IDS') || '{}');
  const records = [];
  eachCsv(DriveApp.getFolderById(exportRootFolderId), (file, kind) => {
    if (imported[file.getId()]) return;
    records.push.apply(records, normalizeCsv(file, kind));
    imported[file.getId()] = true;
  });
  if (!records.length) return;
  const response = UrlFetchApp.fetch(props.getProperty('SUPABASE_INGEST_URL'), { method: 'post', contentType: 'application/json', headers: { Authorization: props.getProperty('HEALTH_SYNC_INGEST_SECRET') }, payload: JSON.stringify({ records }), muteHttpExceptions: true });
  if (response.getResponseCode() >= 300) throw new Error('Supabase import failed: ' + response.getContentText());
  props.setProperty('IMPORTED_FILE_IDS', JSON.stringify(imported));
}

function eachCsv(folder, visit, inheritedKind) {
  const kind = classify(folder.getName()) || inheritedKind || 'csv_import';
  const files = folder.getFiles();
  while (files.hasNext()) { const file = files.next(); if (/\.csv$/i.test(file.getName())) visit(file, classify(file.getName()) || kind); }
  const folders = folder.getFolders(); while (folders.hasNext()) eachCsv(folders.next(), visit, kind);
}
function classify(value) {
  const text = String(value).toLowerCase();
  if (/blood|press|tens|bp/.test(text)) return 'blood_pressure';
  if (/sleep|sono/.test(text)) return 'sleep';
  if (/heart|hr|cardiac/.test(text)) return 'heart_rate';
  if (/workout|activit|exercise|treino/.test(text)) return 'activities';
  if (/step|passo/.test(text)) return 'steps';
  if (/calorie|energia/.test(text)) return 'calories';
  if (/nutrition|food|meal|nutri/.test(text)) return 'nutrition';
  return null;
}

function normalizeCsv(file, kind) {
  const csv = file.getBlob().getDataAsString();
  const firstLine = csv.split(/\r?\n/, 1)[0];
  // CSV exports may use semicolons when decimal values use commas.
  const delimiter = (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ';' : ',';
  const matrix = Utilities.parseCsv(csv, delimiter);
  if (matrix.length < 2) return [];
  const headers = matrix[0].map(normalizeHeader);
  return matrix.slice(1).flatMap((row, index) => {
    const raw = headers.reduce((all, header, i) => { all[header] = row[i]; return all; }, {});
    const timestamp = findTimestamp(raw); if (!timestamp) return [];
    const metrics = headers.flatMap(header => {
      let key = METRIC_ALIASES[header];
      if (kind === 'sleep' && (header === 'duracao' || header === 'duration' || header === 'sleep_duration')) key = 'sleep_duration';
      if (kind === 'activities' && (header === 'duracao' || header === 'duration')) key = 'workout_duration';
      const value = metricValue(raw[header]);
      return key && Number.isFinite(value) ? [{ key, value, unit: unitFor(key) }] : [];
    });
    if (!metrics.length) return [];
    const weight = metrics.find(m => m.key === 'weight');
    // A content-derived key makes overlapping exports idempotent while keeping
    // the latest file details in the raw provenance.
    const signature = metrics.slice().sort((a, b) => a.key.localeCompare(b.key)).map(m => m.key + ':' + m.value).join('|');
    const sourceIdentity = ['csv_import', kind, timestamp, signature].join(':');
    return [{ source: 'csv_import', sourceIdentity, timestamp, type: kind, logicalIdentity: weight ? 'body-composition:' + localDate(timestamp) + ':' + Math.round(weight.value * 10) : null, raw, metrics, provenance: { file_id: file.getId(), file_name: file.getName(), folder: kind, importer: 'Apps Script' } }];
  });
}
function normalizeHeader(value) { return String(value).toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''); }
function findTimestamp(raw) {
  const value = raw.timestamp || raw.time || raw.date || raw.start_time || raw.start || (raw.data && raw.hora ? raw.data + ' ' + raw.hora : null);
  if (!value) return null;
  // Accept common ISO-like and day/month/year date formats.
  let normalized = String(value).replace(/(\d{4})\.(\d{2})\.(\d{2})/, '$1-$2-$3');
  normalized = normalized.replace(/^(\d{2})\/(\d{2})\/(\d{4})/, '$3-$2-$1');
  const date = new Date(normalized); return isNaN(date) ? null : date.toISOString();
}
function localDate(iso) { return Utilities.formatDate(new Date(iso), 'UTC', 'yyyy-MM-dd'); }
function unitFor(key) { return ({ weight: 'kg', body_fat: '%', steps: 'count', calories: 'kcal', active_calories: 'kcal', heart_rate: 'bpm', resting_heart_rate: 'bpm', systolic_bp: 'mmHg', diastolic_bp: 'mmHg', sleep_duration: 'h', workout_duration: 'min', distance: 'km', protein: 'g', carbohydrates: 'g', fat: 'g', fibre: 'g', sugar: 'g' })[key] || null; }
function metricValue(value) {
  const text = String(value || '').trim();
  if (/^\d{1,2}:\d{2}:\d{2}$/.test(text)) { const parts = text.split(':').map(Number); return parts[0] + parts[1] / 60 + parts[2] / 3600; }
  return Number(text.replace(',', '.'));
}
