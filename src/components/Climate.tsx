import { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, CloudRain, Thermometer, CalendarDays, Sun, Play } from 'lucide-react';
import { hazardInfo } from '../data/territories';
import { decimal } from '../lib/scenarios';
import { Sources } from './Sources';
import { Note } from './ui';
import { Fold } from './DataHub';
interface Normal {period:string;parameter:string;code:string;station:string;coordinates:number[];altitude:number;months:(number|null)[];annual:number|null;}
const months=['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const periods=['1961-1990','1971-2000','1981-2010','1991-2020'];
const variables=[{id:'PRECIPITACIÓN',label:'Precipitación',unit:'mm',icon:CloudRain},{id:'TEMPERATURA MEDIA',label:'Temperatura media',unit:'°C',icon:Thermometer},{id:'TEMPERATURA MÁXIMA',label:'Temperatura máxima',unit:'°C',icon:Thermometer},{id:'TEMPERATURA MÍNIMA',label:'Temperatura mínima',unit:'°C',icon:Thermometer},{id:'No. DE DIAS CON LLUVIA',label:'Días con lluvia',unit:'días',icon:CalendarDays},{id:'BRILLO SOLAR',label:'Brillo solar',unit:'h',icon:Sun}];
const sspNames=['SSP1-2.6','SSP2-4.5','SSP3-7.0','SSP5-8.5'];
const temperatureRanges=[[[.5,1.5],[1.5,2],[1,2],[.5,1.5]],[[.5,1.5],[1.5,2],[1.5,2.5],[2,3]],[[.5,1.5],[1.5,3],[2,3],[2.5,4]],[[.5,1.5],[1.5,3],[2.5,4],[3,5]]];
const horizons=['2021–2040','2041–2060','2061–2080','2081–2100'];
const report='https://backbiblio.sire.gov.co/server/api/core/bitstreams/f6644a19-8b5c-4b17-a9c3-d1a5aa96ec3a/content';
const IMPACTS:{hazard:'torrential'|'flood'|'landslide';signal:string;actions:string[]}[]=[
 {hazard:'torrential',signal:'Más lluvia anual (+5 a +20 % a mitad de siglo) y posibles aguaceros cortos más intensos en los cerros: mayor caudal pico y arrastre de sedimentos en quebradas de respuesta rápida.',actions:['Inventariar obstrucciones y reforzar la vigilancia de lluvia intensa en las cuencas de los cerros.','Recalcular caudales y sedimentos con lluvias de diseño ajustadas al clima futuro.','Reevaluar usos del suelo y devolver espacio a los corredores de las quebradas.']},
 {hazard:'flood',signal:'Aumentos de lluvia más marcados en el norte y el centro hacia fin de siglo (SSP3-7.0 y SSP5-8.5): más escorrentía en cuencas urbanas muy impermeabilizadas y más presión sobre el drenaje.',actions:['Cruzar cuencas, drenaje y ocupación con los eventos observados.','Ensayar drenaje sostenible, retención y protección de infraestructura crítica.','Diseñar un sistema de drenaje flexible ante varios futuros climáticos.']},
 {hazard:'landslide',signal:'Temporadas de lluvia más cargadas (marzo-mayo y septiembre-noviembre) elevan la lluvia antecedente y la saturación de laderas; la alternancia con periodos más cálidos y secos agrieta los suelos.',actions:['Medir lluvia antecedente, piezometría e intervenciones en laderas.','Revisar la estabilidad con parámetros medidos y escenarios de saturación.','Reconsiderar la exposición y las soluciones territoriales de largo plazo.']},
];
export type ClimateSection='past'|'future'|'sources';
export function Climate({only,onOnly}:{only?:ClimateSection;onOnly?:(k:ClimateSection)=>void}={}){
 const [open,setOpen]=useState<'past'|'future'|'sources'|null>(null),[data,setData]=useState<Normal[]>([]),[failed,setFailed]=useState(false),[variable,setVariable]=useState('PRECIPITACIÓN'),[station,setStation]=useState('21205790'),[period,setPeriod]=useState('1991-2020'),[ssp,setSsp]=useState(1),[horizon,setHorizon]=useState(1);
 useEffect(()=>{fetch('/data/climate-normals.json').then(r=>r.json()).then(d=>{setData(d.rows);const dorado=d.rows.find((r:Normal)=>r.station.includes('Dorado'));if(dorado)setStation(dorado.code);}).catch(()=>setFailed(true));},[]);
 const available=useMemo(()=>data.filter(r=>r.parameter===variable),[data,variable]);
 const stations=useMemo(()=>Array.from(new Map(available.map(r=>[r.code==='21205790'?'21205791':r.code,r.station])).entries()).sort((a,b)=>a[1].localeCompare(b[1])),[available]);
 const stationCode=stations.some(s=>s[0]===station)?station:stations[0]?.[0];
 const selectedRows=available.filter(r=>r.code===stationCode||(stationCode==='21205791'&&r.code==='21205790')),current=selectedRows.find(r=>r.period===period),comparison=selectedRows.find(r=>r.period==='1981-2010');
 const v=variables.find(v=>v.id===variable)!,delta=current?.annual!=null&&comparison?.annual!=null?current.annual-comparison.annual:null;
 const max=Math.max(1,...selectedRows.flatMap(r=>r.months.filter(n=>n!==null) as number[]))*1.1;
 const line=(row:Normal)=>row.months.map((n,i)=>n===null?'':`${i===0||row.months[i-1]===null?'M':'L'} ${58+i*57} ${240-n/max*190}`).join(' ');
 const toggle=(k:'past'|'future'|'sources')=>setOpen(open===k?null:k);
 void onOnly;
 const sec=(k:ClimateSection,title:string,body:React.ReactNode)=>only?(only===k?<div className="world-section" key={k}>{body}</div>:null):<Fold title={title} open={open===k} onToggle={()=>toggle(k)}>{body}</Fold>;
 const facts=(rows:[string,React.ReactNode][])=><dl className="climate-facts">{rows.map(([k,t])=><div key={k}><dt>{k}</dt><dd>{t}</dd></div>)}</dl>;
 const pending=(label:string)=><button className="model-pending-btn" aria-disabled="true" onClick={e=>e.preventDefault()}><Play size={12}/>{label}<small className="pending-chip">Módulo pendiente</small></button>;
 return <div className="climate-module data-hub data-hub-compact">{sec('past','Análisis retrospectivo',<><div className="climate-body">
 <p className="climate-approach"><b>Enfoque.</b> El riesgo hidrometeorológico de Bogotá no se explica por su volumen anual de lluvia, moderado, sino por la simultaneidad de una lluvia convectiva de tarde, extremos de corta duración, la modulación de El Niño y La Niña, microcuencas de fuerte pendiente y una ciudad muy impermeabilizada. Leemos aquí lo observado: las normales climatológicas del IDEAM para las estaciones del municipio (1961-1990 a 1991-2020, promedios de treinta años que se solapan), los análisis de lluvia del IDIGER y el informe meteorológico del diagnóstico. El Dorado sirve de referencia por su serie larga; Delirio o El Verjón muestran el contraste de los cerros.</p>
 <div className="climate-steps">
 <section><h4><span>1</span>Precipitación</h4>{facts([
  ['Volumen anual','800 a 1 100 mm/año en promedio distrital, con fuertes gradientes: de ~600 mm en el occidente seco a ~1 500 mm en los piedemontes orientales (factor 2 a 2,5). Una sola estación no representa la ciudad.'],
  ['Régimen','Bimodal en ~77 % de las estaciones: máximos en abril–mayo y octubre–noviembre, mínimos en diciembre–febrero y junio–agosto. El 23 % restante, con influencia orinoquense, es monomodal con máximo en junio–julio.'],
  ['Ciclo horario','La convección se dispara al mediodía y alcanza su máximo entre las 14:00 y las 19:00, con granizo y rayos, justo en la hora pico de movilidad. De noche domina una lluvia estratiforme que satura los suelos y difiere el riesgo de deslizamientos.'],
  ['Lluvia intensa','Máximos mensuales en 24 h de 51 a 100 mm en el análisis IDIGER de 18 estaciones (1981–2010). Bogotá tiene más de 150 días de lluvia al año, pero el daño se concentra en una minoría de aguaceros intensos de 10 a 60 minutos.']])}</section>
 <section><h4><span>2</span>Temperatura</h4>{facts([
  ['Media','13 a 15 °C según el sector, con un ciclo diurno de 10 a 14 °C mucho mayor que el ciclo anual (~2 °C). Mínimas por debajo de 5 °C en madrugadas despejadas de la temporada seca (heladas en la Sabana y la ruralidad).'],
  ['Tendencia','+0,06 °C/año en la red urbana RMCAB, 2009–2026: serie corta, no extrapolable a 2100.'],
  ['Isla de calor','Varios grados de diferencia entre el centro denso y la periferia; la temperatura mínima nocturna es tan crítica como la máxima para la salud.']])}</section>
 <section><h4><span>3</span>El Niño y La Niña</h4>{facts([
  ['La Niña','Aumenta la lluvia: más de +40 % mensual en eventos moderados o fuertes (2010-2011 fue el caso extremo reciente), con suelos saturados, crecientes y deslizamientos.'],
  ['El Niño','Reduce la lluvia y eleva la temperatura: incendios en los cerros, sequía agrícola y presión sobre el sistema Chingaza, como en el racionamiento de 2024-2025.'],
  ['Matices','La respuesta varía según la estación y el mes. El ENSO debe entrar en el modelo como condicionante probabilístico, junto con la ZCIT, la humedad amazónica y orinoquense, la oscilación de Madden-Julian y la lluvia antecedente, no como predictor único.']])}</section>
 <section><h4><span>4</span>Normales IDEAM por estación</h4>
 <div className="climate-controls"><label>Variable<select value={variable} onChange={e=>setVariable(e.target.value)}>{variables.map(v=><option key={v.id}>{v.id}</option>)}</select></label><label>Estación<select value={stationCode||''} onChange={e=>setStation(e.target.value)}>{stations.map(([code,name])=><option key={code} value={code}>{name}</option>)}</select></label></div>
 {failed?<Note>No se pudo cargar el archivo local de normales. Consulte las fuentes para acceder al catálogo IDEAM.</Note>:!data.length?<p>Cargando normales IDEAM…</p>:<>
 <div className="climate-retro-grid"><div className="climate-chart"><div className="chart-top"><span>{v.label} · {v.unit}</span><div><i className="dot mint"/>{period}<i className="dot gray"/>1981–2010</div></div><svg viewBox="0 0 740 290" role="img" aria-label={`Ciclo mensual de ${v.label}, estación ${current?.station||stationCode}`}>
 {[0,1,2,3,4].map(i=><g key={i}><line x1="45" x2="710" y1={240-i*47.5} y2={240-i*47.5} stroke="#a2c8bd14"/><text x="33" y={244-i*47.5} textAnchor="end" fill="#8fa5ad" fontSize="10">{decimal(max*i/4,variable.includes('TEMPERATURA')?1:0)}</text></g>)}
 {comparison&&<path d={line(comparison)} fill="none" stroke="#84969f" strokeWidth="2" strokeDasharray="5 5"/>}{current&&<><path d={line(current)} fill="none" stroke="#a9e2d0" strokeWidth="3"/>{current.months.map((n,i)=>n!==null&&<g key={i}><circle cx={58+i*57} cy={240-n/max*190} r="4" fill="#b3e5d6"><title>{months[i]}: {decimal(n)} {v.unit}</title></circle><text x={58+i*57} y={225-n/max*190} fill="#c7e4db" textAnchor="middle" fontSize="10">{decimal(n,variable.includes('TEMPERATURA')?1:0)}</text></g>)}</>}{months.map((m,i)=><text key={m} x={58+i*57} y="267" textAnchor="middle" fill="#8fa5ad" fontSize="11">{m}</text>)}</svg>
 {!current&&<Note>Esta estación no tiene una normal publicada para {period}. Seleccione otro período; no se interpolan datos faltantes.</Note>}
 <div className="normal-periods">{periods.map(p=>{const row=selectedRows.find(r=>r.period===p);return <button key={p} className={period===p?'active':''} onClick={()=>setPeriod(p)} disabled={!row}><span>{p}</span><strong>{row?.annual==null?'—':decimal(row.annual)}<small> {v.unit}</small></strong></button>;})}</div></div>
 <aside className="climate-observation"><span className="eyebrow">LECTURA DE LA ESTACIÓN</span><h4>{current?.station||stations.find(s=>s[0]===stationCode)?.[1]}</h4><strong>{current?.annual==null?'—':decimal(current.annual)}<small> {v.unit}</small></strong><span>{variable.includes('TEMPERATURA')?'Media de la normal':'Acumulado anual de la normal'} · {period}</span>{delta!==null&&period!=='1981-2010'&&<p><b>{delta>=0?'+':''}{decimal(delta)} {v.unit}</b> frente a 1981–2010</p>}<small>Comparación descriptiva entre normales parcialmente solapadas. No es una tasa anual ni una prueba de significancia.</small>{stationCode==='21205791'&&<small className="station-code-note">El CSV identifica El Dorado como 21205790 en 1981–2010 y 21205791 en las otras normales, con igual nombre y coordenadas. Continuidad instrumental por verificar.</small>}<a href="/data/climate-normals.json" target="_blank" rel="noreferrer">Ver valores originales<ArrowUpRight size={13}/></a></aside></div></>}</section>
 <section><h4><span>5</span>Lo que falta para concluir</h4><p className="climate-plain">Las normales muestran ciclos y diferencias entre periodos, no tendencias de los extremos. Para saber si los aguaceros intensos están cambiando se necesitan series diarias y subhorarias homogéneas (red SAB del IDIGER, IDEAM, CAR, EAAB), índices Rx1day y Rx5day, percentiles y pruebas de tendencia, y la calibración local de productos satelitales (GPM IMERG, CHIRPS). Estas series aún no están integradas.</p></section>
 </div>
 </div></>)}
 {sec('future','Análisis prospectivo',<><div className="climate-body">
 <div className="climate-model-bar">{pending('Lanzar una modelación de largo plazo')}</div>
 <p className="climate-approach"><b>Enfoque.</b> Leemos el estudio de reducción de escala del IDIGER (enero de 2026), que corrige modelos climáticos globales CMIP6 con las estaciones del Distrito frente a la referencia 1991-2020, para cuatro trayectorias de emisiones. Se muestran los rangos publicados, sin interpolarlos, y después lo que cada cambio puede significar para los riesgos priorizados. <a className="inline-link" href={report+'#page=30'} target="_blank" rel="noreferrer">Estudio completo<ArrowUpRight size={12}/></a></p>
 <div className="ssp-tabs">{sspNames.map((s,i)=><button key={s} className={ssp===i?'active':''} onClick={()=>setSsp(i)}><span>{s}</span><small>{['Bajas emisiones','Intermedio','Altas emisiones','Muy altas emisiones'][i]}</small></button>)}</div>
 <div className="climate-steps">
 <section><h4><span>1</span>Temperatura media<a href={report+'#page=58'} target="_blank" rel="noreferrer">Fuente · p. 58 ↗</a></h4><div className="projection-chart compact"><div className="projection-ranges">{horizons.map((h,i)=>{const range=temperatureRanges[ssp][i];return <button key={h} className={horizon===i?'active':''} onClick={()=>setHorizon(i)}><div className="range-track"><span style={{bottom:range[0]/5*100+'%',height:(range[1]-range[0])/5*100+'%'}}/><i style={{bottom:(range[0]+range[1])/10*100+'%'}}/></div><strong>+{decimal(range[0])} a +{decimal(range[1])} °C</strong><span>{h}</span></button>;})}</div></div>
 <p className="climate-plain">Incremento respecto a 1991–2020. La temperatura mínima sube aún más: hasta +6 °C a fin de siglo en los escenarios altos, lo que agrava la isla de calor nocturna.</p></section>
 <section><h4><span>2</span>Precipitación<a href={report+'#page=41'} target="_blank" rel="noreferrer">Informe · pp. 41–44 ↗</a></h4><div className="precip-row">{horizons.map((h,i)=><div key={h} className={horizon===i?'active':''}><strong>{i<2?'+5 a +20 %':i===3?'+10 a +50 %':'Heterogéneo'}</strong><span>{h}</span></div>)}</div>
 <p className="climate-plain">Aumento anual en la primera mitad del siglo, con posibles reducciones en Sumapaz; a fin de siglo, los mayores aumentos se dan en el norte y el centro, sobre todo con SSP3-7.0 y SSP5-8.5. Más que el total anual cambia su reparto en el año: las temporadas de marzo–mayo y septiembre–noviembre se cargan.</p></section>
 </div>
 <p className="climate-approach climate-outro"><b>Alcance.</b> Siete variables proyectadas (precipitación, temperatura media, máxima y mínima, humedad, radiación y viento) a 10 km para la lluvia y 25 km para radiación y viento: un píxel mezcla cerros, ciudad densa y humedales, y solo siete estaciones cumplen los criterios de calidad para temperatura y humedad. Un cambio de lluvia anual no se aplica directamente a una tormenta de 30 minutos ni a una curva IDF: hacen falta un downscaling dinámico (WRF) sobre la Sabana y curvas IDF futuras. Estos escenarios no son pronósticos.</p>
 <section className="risk-impacts"><h4>Impacto del cambio climático en los riesgos priorizados</h4>
 <div className="impact-table-wrap"><table className="impact-table"><thead><tr><th>Riesgo</th><th>Señal climática</th><th>2030 · Preparar</th><th>2050 · Adaptar</th><th>2100 · Transformar</th><th/></tr></thead><tbody>{IMPACTS.map(r=><tr key={r.hazard} style={{'--risk-color':hazardInfo[r.hazard].color} as React.CSSProperties}><th><i className="impact-dot"/>{hazardInfo[r.hazard].name}</th><td>{r.signal}</td>{r.actions.map((a,i)=><td key={i}>{a}</td>)}<td>{pending('Modelar')}</td></tr>)}</tbody></table></div>
 <p className="climate-chain">Clima → proceso físico → exposición → vulnerabilidad → consecuencias. La relación no es automática: antes de estimar daños deben integrarse modelos calibrados, escenarios demográficos e incertidumbre.</p></section>
 </div></>)}
 {sec('sources','Fuentes',<Sources topic="climate"/>)}
 </div>;
}
