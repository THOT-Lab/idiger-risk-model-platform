import { useEffect, useMemo, useState } from 'react';
import buffer from '@turf/buffer';
import type { Polygon } from 'geojson';
import { RadioTower, BookOpen, Building2, MapPin, Play, Route, Waves } from 'lucide-react';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import type { Buildings, Station, Territory } from '../lib/types';
import { decimal, fmt } from '../lib/scenarios';
type Stats=Record<string,{buildings:number|null;riversKm:number;roadsKm:number|null;estimated?:boolean}>;
let statsCache:Promise<Stats>|null=null;
function useTerritoryStats(){const [s,setS]=useState<Stats>({});useEffect(()=>{statsCache??=fetch(import.meta.env.BASE_URL+'data/territory-stats.json').then(r=>r.ok?r.json():{}).catch(()=>({}));statsCache.then(setS);},[]);return s;}
export function TerritoryPanel({showStations,onShowStations,territory,stations,loading,onSimulate,onSources}:{showStations:boolean;onShowStations:(v:boolean)=>void;territory:Territory;stations:Station[];buildings:Buildings;loading:boolean;onSimulate:()=>void;onSources:()=>void}){

 const [net,setNet]=useState<{id:string;name:string;network:string;category:string;coordinates:[number,number];inside:boolean}[]>([]);
 useEffect(()=>{fetch(import.meta.env.BASE_URL+'data/networks.json').then(r=>r.json()).then(d=>setNet((['idiger','eaab','car','ideam','rmcab','sgc','particulares','aerocivil','ciudadana'] as const).filter(k=>d.networks[k]).flatMap(k=>d.networks[k].stations.map((x:{id:string;name:string;category:string;coordinates:[number,number]})=>({...x,network:d.networks[k].name,inside:false}))))).catch(()=>{});},[]);
 // Les trois réseaux, dans le territoire ou à moins de 600 m (comme sur la carte).
 const related=useMemo(()=>{void stations;const zone=buffer(territory.geometry as Polygon,.6,{units:'kilometers'})!;return net.filter(s=>booleanPointInPolygon(s.coordinates,zone)).map(s=>({...s,inside:booleanPointInPolygon(s.coordinates,territory.geometry)})).sort((a,b)=>Number(b.inside)-Number(a.inside));},[net,stations,territory]);
 const stats=useTerritoryStats()[territory.id];
 const items:[React.ReactNode,string,string][]=[[<MapPin size={15}/>,`${decimal(territory.area)} km²`,'Superficie'],[<Building2 size={15}/>,stats?.buildings!=null?(stats.estimated?'≈ ':'')+fmt(stats.buildings):'…','Edificaciones'],[<Waves size={15}/>,stats?`${decimal(stats.riversKm)} km`:'…','Ríos y quebradas'],[<Route size={15}/>,stats?.roadsKm!=null?`${decimal(stats.roadsKm)} km`:'…','Vías']];
 return <aside className="territory-summary panel" aria-label={territory.name}><div className="summary-grid">{items.map(([icon,value,label])=><div key={label}>{icon}<strong>{value}</strong><span>{label}</span></div>)}</div><div className="station-pill"><RadioTower size={15}/><span>Estaciones de medición</span><b>{related.length}</b><button className={showStations?'on':''} aria-pressed={showStations} onClick={()=>onShowStations(!showStations)}>{showStations?'Ocultar':'Mostrar'}</button></div><div className="summary-foot"><button className="source-button" aria-label="Fuentes del territorio" title="Fuentes" onClick={onSources}><BookOpen size={13}/></button><small>Catastro Bogotá · EAAB · OpenStreetMap</small></div><button className="primary-button full map-simulate in-card" onClick={onSimulate} disabled={loading}><Play size={13}/>{loading?'Cargando edificaciones…':territory.hazard==='landslide'?'Definir el escenario':'Definir la lluvia'}</button></aside>;
}
