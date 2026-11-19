import type { FeatureCollection, Feature, Polygon, MultiPolygon, LineString, MultiLineString } from 'geojson';
import buffer from '@turf/buffer';
import { routeExposure, slideRoute } from './terrain';
import bboxClip from '@turf/bbox-clip';
import type { BuildingProperties, Buildings, Result, Scenario, Territory, TerrainData } from './types';
export const fmt=(n:number)=>new Intl.NumberFormat('es-CO',{maximumFractionDigits:0}).format(n);
export const decimal=(n:number,digits=1)=>new Intl.NumberFormat('es-CO',{maximumFractionDigits:digits,minimumFractionDigits:digits}).format(n);
export const money=(n:number)=>'$ '+decimal(n/1e6,0)+' M';
export const presetNames={frequent:'Frecuente',severe:'Severo',extreme:'Extremo exploratorio'};
export const coefficients={frequent:{c1:2065.54,x0:18.7,c2:-.97224,tr:5},severe:{c1:2757.7,x0:16.1,c2:-.9525,tr:50},extreme:{c1:3067.83,x0:15.9,c2:-.95569,tr:100}};
// Périodes de retour proposées : courbes IDF EAAB (point 0) ; 101 = « > 100 años » = 1,3 × T100, prueba exploratoria.
export const RETURN_PERIODS=[5,10,25,50,100,101];
export const IDF:Record<number,{c1:number;x0:number;c2:number}>={3:{c1:1991.53,x0:20.7,c2:-.98708},5:{c1:2065.54,x0:18.7,c2:-.97224},10:{c1:2295.89,x0:17.6,c2:-.96622},25:{c1:2578.14,x0:16.6,c2:-.95855},50:{c1:2757.7,x0:16.1,c2:-.9525},100:{c1:3067.83,x0:15.9,c2:-.95569}};
export const trOf=(s:Pick<Scenario,'preset'|'tr'>)=>s.tr??coefficients[s.preset].tr+(s.preset==='extreme'?1:0);
export const presetOf=(tr:number):Scenario['preset']=>tr<=10?'frequent':tr<=50?'severe':'extreme';
export const trLabel=(tr:number)=>tr>100?'> 100 años':`T = ${tr} años`;
export function intensity(s:Pick<Scenario,'preset'|'duration'|'tr'>){const tr=trOf(s),c=IDF[Math.min(tr,100)];return c.c1*Math.pow(s.duration+c.x0,c.c2)*(tr>100?1.3:1);}
const SEV:[number,number][]=[[5,.39],[10,.5],[25,.65],[50,.78],[100,.92],[101,1.15]];
export function scenarioSeverity(s:Scenario,h:Territory['hazard']){
 if(h==='landslide')return Math.min(1.35,Math.max(.16,.14+s.rain/300+s.saturation/280+(s.slope-15)/120+s.shaking*.8+s.intervention/450+s.drainage/450));
 const tr=trOf(s),base=(SEV.find(([t])=>t>=tr)??SEV[SEV.length-1])[1];
 return base*(.82+Math.sqrt(s.duration/60)*.18);
}
function seeded(seed:number){let a=seed;return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const buildingCache=new Map<string,Buildings>();
export function prepareBuildings(t:Territory,raw:FeatureCollection,dem?:TerrainData):Buildings {
 const route=dem?slideRoute(dem):null;
 const seed=[...t.id].reduce((a,c)=>a+c.charCodeAt(0),0);
 const features=raw.features.filter(f=>f.geometry.type==='Polygon'||f.geometry.type==='MultiPolygon').map((f,i)=>{
  const p=f.properties||{},random=seeded(seed+Number(f.id||i)),area=Number(p.area)||70;
  const ring=f.geometry.type==='Polygon'?f.geometry.coordinates[0]:(f.geometry as MultiPolygon).coordinates[0][0],lon=ring.reduce((a,c)=>a+c[0],0)/ring.length,lat=ring.reduce((a,c)=>a+c[1],0)/ring.length,slide=dem&&route?routeExposure(dem,route,lon,lat):null;
  const use:BuildingProperties['use']=area>1800?'Equipamiento':area>380?'Comercio':'Vivienda';
  return{type:'Feature' as const,id:i,geometry:f.geometry as Polygon|MultiPolygon,properties:{id:i,sourceId:p.sourceId,zone:t.id,slideAlong:slide?.along,slideDistance:slide?.normalized,height:Number(p.height)||6,area,distanceToWater:Number(p.distanceToWater),footprintSource:p.footprintSource,people:use==='Equipamiento'?Math.round(area/16):use==='Comercio'?Math.round(area/25):Math.max(2,Math.round(area/22*(.8+random()))),value:area*(1800000+random()*2200000),vulnerability:.3+random()*.65,exposure:Math.max(0,1-Number(p.distanceToWater)/(t.hazard==='flood'?480:240)),use}};
 });
 const result:Buildings={type:'FeatureCollection',features};buildingCache.set(t.id,result);return result;
}
export function createBuildings(t:Territory):Buildings{return buildingCache.get(t.id)||{type:'FeatureCollection',features:[]};}
export async function loadBuildings(t:Territory){if(buildingCache.has(t.id))return buildingCache.get(t.id)!;const r=await fetch(import.meta.env.BASE_URL+'data/buildings/'+t.id+'.json');if(!r.ok)throw new Error('No se pudo cargar la muestra de edificaciones');const dem=t.hazard==='landslide'?await fetch(import.meta.env.BASE_URL+'data/terrain/'+t.id+'.json').then(r=>{if(!r.ok)throw Error('DEM indisponible');return r.json();}):undefined;return prepareBuildings(t,await r.json(),dem);}
export type Damage='low'|'medium'|'high';
export function damage(b:BuildingProperties,severity:number,progress=1):Damage {
 if(b.slideAlong!==undefined&&b.slideDistance!==undefined){const run=Math.max(0,Math.min(1,(progress-.1)/.78));if(run<=0||b.slideAlong>run||b.slideDistance>severity*Math.min(1,run*7))return'low';return (1-b.slideDistance/Math.max(.01,severity))*b.vulnerability>.35?'high':'medium';}
 const reach=severity*Math.min(1,Math.max(0,progress)/.9);
 if(progress<=0||b.exposure<1-reach*.72)return'low';
 return(b.exposure-(1-reach*.72))*b.vulnerability>.21?'high':'medium';
}
export function results(t:Territory,s:Scenario,buildings:Buildings,progress=1):Result {
 const severity=scenarioSeverity(s,t.hazard);let high=0,medium=0,people=0,criticalPeople=0,direct=0,services=0;
 for(const b of buildings.features){const status=damage(b.properties,severity,progress);if(status==='low')continue;if(status==='high'){high++;criticalPeople+=b.properties.people;}else medium++;people+=b.properties.people;direct+=b.properties.value*(status==='high'?.44:.12);if(b.properties.use==='Equipamiento')services++;}
 direct=Math.round(direct);const indirect=Math.round(direct*.22),reach=Math.min(1,progress/.9);
 return{total:buildings.features.length,high,medium,low:buildings.features.length-high-medium,exposed:high+medium,people,criticalPeople,direct,indirect,totalLoss:direct+indirect,depth:Number((severity*(t.hazard==='flood'?2.5:1.8)*reach).toFixed(1)),area:Number((severity*(t.hazard==='flood'?34:5.2)*reach).toFixed(1)),severity,services,progress};
}
const channelCache=new Map<string,FeatureCollection>();
export function channelGeometry(t:Territory):FeatureCollection {
 if(channelCache.has(t.id))return channelCache.get(t.id)!;
 const r=t.hazard==='flood'?.014:.007,[x,y]=t.focus;
 const features=t.waterways.features.flatMap(f=>{
  try{const c=bboxClip(f as Feature<LineString|MultiLineString>,[x-r,y-r,x+r,y+r]);return(c.geometry.coordinates.length?[c]:[]);}catch{return[];}
 });
 const result:FeatureCollection={type:'FeatureCollection',features};channelCache.set(t.id,result);return result;
}
const waterCache=new Map<string,FeatureCollection>();
export function waterGeometry(t:Territory,severity:number,progress:number):FeatureCollection {
 const step=Math.round(Math.min(1,progress/.9)*40),key=t.id+'-'+severity.toFixed(3)+'-'+step;
 if(!step||t.hazard==='landslide')return{type:'FeatureCollection',features:[]};
 if(waterCache.has(key))return waterCache.get(key)!;
 const width=(t.hazard==='flood'?480:240)*severity*.72*step/40;
 const geometry=buffer(channelGeometry(t),width,{units:'meters',steps:4}) as FeatureCollection|undefined;
 const value=geometry||{type:'FeatureCollection' as const,features:[]};waterCache.set(key,value);if(waterCache.size>240)waterCache.delete(waterCache.keys().next().value!);return value;
}
export function download(name:string,content:string,type='application/json'){const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export function safeRead<T>(key:string,fallback:T):T{try{const s=localStorage.getItem(key);return s?JSON.parse(s):fallback;}catch{return fallback;}}
export function safeWrite(key:string,value:unknown){try{localStorage.setItem(key,JSON.stringify(value));return true;}catch{return false;}}
export function scenarioExport(t:Territory,s:Scenario,r:Result){return{schema:'idiger-demo-v2',status:'DEMOSTRACIÓN · NO VALIDADO',generatedAt:new Date().toISOString(),territory:{id:t.id,name:t.name,boundaries:t.boundarySource,hydroCode:t.hydroCode},scenario:s,rainfall:t.hazard==='landslide'?null:{intensityMmH:intensity(s),durationMin:s.duration,reference:'EAAB, punto 0 del corpus E2; asignación espacial pendiente',returnPeriodYears:s.preset==='extreme'?null:coefficients[s.preset].tr,extremeNote:s.preset==='extreme'?'1,3 × T=100 años; sin probabilidad asignada':null},results:r,units:{loss:'COP',depth:'m',area:'ha'},assumptions:['Huellas geográficas de copia pública UDFJC 2022; ocupación, vulnerabilidad y valores sintéticos','Animación prescrita; no se ejecuta un modelo físico','Pérdida directa: 44 % del valor en daño alto, 12 % en medio; indirecta: 22 % de directa','criticalPeople = ocupación sintética de edificios con daño alto; NO estima fallecidos','El alcance corresponde al instante progress del escenario'],sources:[...t.sourceIds,'EXP-HUELLAS','MODEL-HYP',t.hazard==='landslide'?'S16':'S04']};}
