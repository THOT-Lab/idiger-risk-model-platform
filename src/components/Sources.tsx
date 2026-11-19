import { useState } from 'react';
import { BookOpen, Search } from 'lucide-react';
import { sources, sourcesFor, type SourceTopic } from '../data/catalog';
export function SourceButton({onClick,label='Fuentes'}:{onClick:()=>void;label?:string}){return <button className="source-button" onClick={onClick}><BookOpen size={14}/>{label}</button>;}
export function Sources({topic,all=false}:{topic:SourceTopic;all?:boolean}){
 const [query,setQuery]=useState('');
 const list=(all?sources:sourcesFor(topic)).filter(s=>`${s.name} ${s.owner} ${s.use}`.toLocaleLowerCase('es').includes(query.toLocaleLowerCase('es')));
 const total=(all?sources:sourcesFor(topic)).length;
 return <div className={'context-sources'+(total<=8?' few':'')}>{false&&<label className="search-field"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar documento, institución o variable…" aria-label="Buscar fuentes"/></label>}<ol className="library-raw source-raw context-source-list">{list.map((s,i)=>{const url=s.link||s.local||null;const body=<><span className="ref-n">{i+1}</span><span className="ref-text"><span className="ref-main"><span className="ref-owner">{s.owner}.</span> <cite>{s.name}</cite></span><span className="ref-use">{s.use}</span></span>{!url&&<em className="ref-local">documento interno</em>}</>;return <li key={s.id}>{url?<a href={url} target="_blank" rel="noreferrer">{body}</a>:<div>{body}</div>}</li>;})}</ol>{!list.length&&<p>Sin resultados para esta búsqueda.</p>}</div>;
}
