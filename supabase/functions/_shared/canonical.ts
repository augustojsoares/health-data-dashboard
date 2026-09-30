type CanonicalMetric = { key: string; value: number; unit: string; isDerived?: boolean }
type CanonicalRecord = { type: string; timestamp: string; metrics: CanonicalMetric[] }
const definitions: Record<string, { unit:string; min:number; max:number }> = {
  weight:{unit:'kg',min:10,max:500},waist:{unit:'cm',min:20,max:300},body_fat:{unit:'%',min:1,max:100},muscle:{unit:'%',min:1,max:100},skeletal_muscle_mass:{unit:'kg',min:1,max:300},visceral_fat:{unit:'index',min:1,max:100},bmi:{unit:'kg/m2',min:5,max:100},fat_mass:{unit:'kg',min:.1,max:300},fat_free_mass:{unit:'kg',min:1,max:400},body_age:{unit:'years',min:1,max:130},bmr:{unit:'kcal/day',min:100,max:10000},tdee:{unit:'kcal/day',min:100,max:20000},steps:{unit:'count',min:0,max:500000},calories:{unit:'kcal',min:0,max:50000},active_calories:{unit:'kcal',min:0,max:50000},heart_rate:{unit:'bpm',min:15,max:300},resting_heart_rate:{unit:'bpm',min:15,max:250},systolic_bp:{unit:'mmHg',min:40,max:300},diastolic_bp:{unit:'mmHg',min:20,max:200},sleep_duration:{unit:'min',min:0,max:1440},workout_duration:{unit:'min',min:0,max:1440},distance:{unit:'m',min:0,max:2000000},protein:{unit:'g',min:0,max:5000},carbohydrates:{unit:'g',min:0,max:5000},fat:{unit:'g',min:0,max:5000},fibre:{unit:'g',min:0,max:1000},sugar:{unit:'g',min:0,max:5000}
}
const aliases:Record<string,string>={activities:'activity',steps:'daily_activity',calories:'daily_activity'}
const factors:Record<string,number>={'g:kg':.001,'lb:kg':.45359237,'m:cm':100,'in:cm':2.54,'ratio:%':100,'kj:kcal':.239005736,'h:min':60,'s:min':1/60,'km:m':1000,'mi:m':1609.344,'mg:g':.001,'oz:g':28.349523125}

export const canonicalizeRecord = (record:{type:string;timestamp:string;metrics:{key:string;value:number;unit?:string;isDerived?:boolean}[]}) => {
  const issues:{path:string;message:string}[]=[]
  const type=aliases[record.type]??record.type
  if(!/^[\d]{4}-[\d]{2}-[\d]{2}T/.test(record.timestamp)||Number.isNaN(Date.parse(record.timestamp)))issues.push({path:'timestamp',message:'must be ISO-8601'})
  const metrics:CanonicalMetric[]=[]
  for(const [index,input] of record.metrics.entries()){
    const definition=definitions[input.key],path=`metrics[${index}]`
    if(!definition){issues.push({path:`${path}.key`,message:'is not registered'});continue}
    let value=input.value,unit=input.unit??definition.unit
    if(unit!==definition.unit){const factor=factors[`${unit.toLowerCase()}:${definition.unit.toLowerCase()}`];if(factor===undefined){issues.push({path:`${path}.unit`,message:`cannot convert ${unit} to ${definition.unit}`});continue};value*=factor;unit=definition.unit}
    if(!Number.isFinite(value)||value<definition.min||value>definition.max){issues.push({path:`${path}.value`,message:`must be between ${definition.min} and ${definition.max}`});continue}
    metrics.push({key:input.key,value,unit,isDerived:Boolean(input.isDerived)})
  }
  if(!metrics.length)issues.push({path:'metrics',message:'contains no valid readings'})
  return {record:{type,timestamp:record.timestamp,metrics} as CanonicalRecord,issues}
}
