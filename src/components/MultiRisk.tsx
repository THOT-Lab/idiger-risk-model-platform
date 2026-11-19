import { useState } from 'react';
import { ChevronDown, Users, HeartPulse, Wallet, Trees, Plus } from 'lucide-react';
import type { Hazard } from '../lib/types';
import { hazardInfo } from '../data/territories';
import { Fold } from './DataHub';
import { Sources } from './Sources';
interface Row {hazard:Hazard;probability:number;dimensions:number[];}
const initial:Row[]=[{hazard:'torrential',probability:3,dimensions:[4,3,3,2]},{hazard:'flood',probability:4,dimensions:[3,4,4,3]},{hazard:'landslide',probability:3,dimensions:[5,3,2,3]}];
const DIMENSIONS=[{name:'Vida y salud',Icon:Users},{name:'Servicios esenciales',Icon:HeartPulse},{name:'Economía',Icon:Wallet},{name:'Ambiente y sociedad',Icon:Trees}];
const levelOf=(p:number,g:number)=>{const score=p*g;return g===5?'critical':score>=15?'high':score>=9?'elevated':score>=5?'moderate':'low';};
// Matrice gravité × probabilité en grand, puis les trois risques priorisés avec leurs critères dépliables.
export function MultiRisk(){
 const [rows,setRows]=useState(initial),[open,setOpen]=useState<number|null>(null),[selected,setSelected]=useState(0),[sources,setSources]=useState(false);
 const gravityOf=(r:Row)=>Math.max(...r.dimensions);
 const update=(i:number,partial:Partial<Row>)=>setRows(rows.map((r,ri)=>ri===i?{...r,...partial}:r));
 const pick=(i:number)=>{setSelected(i);setOpen(open===i?null:i);};
 return <div className="multirisk-content mr-v4 data-hub data-hub-compact">
  <p className="climate-approach"><b>Metodología.</b> Cada escenario se sitúa en una matriz de gravedad y probabilidad. La gravedad se califica de 1 a 5 en cuatro dimensiones (vida y salud, servicios esenciales, economía, ambiente y sociedad) y se retiene la más alta: un impacto humano crítico no se compensa con una pérdida económica menor. La probabilidad del escenario también va de 1 a 5. Los valores actuales son de demostración: ni los umbrales ni las probabilidades están validados, y no se deducen del periodo de retorno de una lluvia.</p>
  <section className="mr-matrix"><div className="matrix-key mr-key"><span className="mr-key-title">Nivel de riesgo</span><span><i className="dot" style={{background:'#3fd29e'}}/>Bajo</span><span><i className="dot" style={{background:'#b5dc55'}}/>Moderado</span><span><i className="dot" style={{background:'#ffc247'}}/>Alto</span><span><i className="dot" style={{background:'#ff8b4a'}}/>Muy alto</span><span><i className="dot" style={{background:'#f2545b'}}/>Crítico</span></div><div className="matrix-container"><span className="y-axis">PROBABILIDAD DEL ESCENARIO</span><div className="matrix-y-labels">{['Muy alta','Alta','Media','Baja','Muy baja'].map(t=><span key={t}>{t}</span>)}</div><div className="risk-matrix">{Array.from({length:25},(_,i)=>{const p=5-Math.floor(i/5),g=i%5+1;const sel=rows[selected];return <div key={i} className={'matrix-cell '+levelOf(p,g)+(p===sel.probability&&g===gravityOf(sel)?' chosen':'')}>{rows.map((r,ri)=>gravityOf(r)===g&&r.probability===p?<span key={ri} className="mr-chip" style={{'--risk-color':hazardInfo[r.hazard].color} as React.CSSProperties}><i/>{hazardInfo[r.hazard].name}</span>:null)}</div>;})}</div><div className="matrix-x-labels">{['Menor','Moderada','Seria','Grave','Crítica'].map(t=><span key={t}>{t}</span>)}</div><span className="x-axis">GRAVEDAD DE LAS CONSECUENCIAS</span></div>
  </section>
  <section className="mr-risks">{rows.map((r,i)=><div key={r.hazard} className={'mr-risk'+(open===i?' open':'')+(selected===i?' active':'')} style={{'--risk-color':hazardInfo[r.hazard].color} as React.CSSProperties}>
   <button className="mr-risk-head" aria-expanded={open===i} onClick={()=>pick(i)}><span className="mr-num"/><strong>{hazardInfo[r.hazard].name}</strong><span className="gp-tag">G{gravityOf(r)} · P{r.probability}</span><ChevronDown size={16}/></button>
   <div className="data-fold-wrap" aria-hidden={open!==i}><div className="data-fold-inner"><div className="mr-criteria">
    {DIMENSIONS.map(({name,Icon},di)=><label key={name}><span><Icon size={15}/>{name}<strong>{r.dimensions[di]} / 5</strong></span><input aria-label={name} tabIndex={open===i?0:-1} type="range" min="1" max="5" value={r.dimensions[di]} onChange={e=>update(i,{dimensions:r.dimensions.map((d,k)=>k===di?Number(e.target.value):d)})}/></label>)}
    <label className="probability-control"><span>Probabilidad del escenario<strong>{r.probability} / 5</strong></span><input type="range" aria-label="Probabilidad del escenario" tabIndex={open===i?0:-1} min="1" max="5" value={r.probability} onChange={e=>update(i,{probability:Number(e.target.value)})}/></label>
   </div></div></div></div>)}
   <div className="mr-risk mr-add"><button className="mr-risk-head" aria-describedby="mr-pending"><span className="mr-num"><Plus size={14}/></span><strong>Añadir otros riesgos</strong></button><span id="mr-pending" role="tooltip" className="pending-tip">Módulo pendiente</span></div>
  </section>
  <Fold title="Fuentes" open={sources} onToggle={()=>setSources(!sources)}><Sources topic="multirisk"/></Fold>
 </div>;
}
