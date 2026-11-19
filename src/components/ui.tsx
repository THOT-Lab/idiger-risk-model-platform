import { useEffect, useRef, useState, type ReactNode } from 'react';
import { X, ArrowUpRight, Info } from 'lucide-react';
import type { Hazard } from '../lib/types';
// Titre qui « vole » depuis la tuile d'accueil (origin = sélecteur du texte d'origine) jusqu'à l'en-tête,
// puis suffixe tapé lettre à lettre ; à la fermeture, le titre revient se poser dans la tuile.
export function Modal({title,eyebrow,subtitle,children,onClose,wide=false,className='',origin,typed}:{title:string;eyebrow?:string;subtitle?:string;children:ReactNode;onClose:()=>void;wide?:boolean;className?:string;origin?:string;typed?:string}){
 const ref=useRef<HTMLDivElement>(null),h2=useRef<HTMLHeadingElement>(null),[closing,setClosing]=useState(false),[typedN,setTypedN]=useState(0),closingRef=useRef(false);
 const reduced=typeof window!=='undefined'&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 function fly(reverse:boolean,done:()=>void){
  const o=origin?document.querySelector<HTMLElement>(origin):null,t=h2.current?.querySelector<HTMLElement>('.title-main');
  if(!o||!t||reduced){if(o&&reverse)o.style.opacity='';done();return;}
  // Boîtes du texte lui-même (Range), pas des blocs : un titre centré dans sa tuile n'a pas le même bord gauche que son bloc.
  const box=(el:HTMLElement)=>{const r=document.createRange();r.selectNodeContents(el);const b=r.getBoundingClientRect();return b.width?b:el.getBoundingClientRect();};
  const a=box(o),b=box(t),ct=getComputedStyle(t);
  const clone=document.createElement('span');clone.textContent=t.textContent;clone.className='title-fly';
  Object.assign(clone.style,{position:'fixed',left:b.left+'px',top:b.top+'px',width:b.width+'px',font:ct.font,fontVariationSettings:ct.fontVariationSettings,letterSpacing:ct.letterSpacing,lineHeight:ct.lineHeight,color:ct.color,margin:'0',zIndex:'2000',pointerEvents:'none',transformOrigin:'0 0',whiteSpace:'nowrap'});
  document.body.append(clone);
  const k=a.width/b.width||parseFloat(getComputedStyle(o).fontSize)/parseFloat(ct.fontSize),from=`translate(${a.left-b.left}px,${a.top+(a.height-b.height*k)/2-b.top}px) scale(${k})`;
  t.style.opacity='0';o.style.opacity='0';
  const anim=clone.animate(reverse?[{transform:'none'},{transform:from}]:[{transform:from},{transform:'none'}],{duration:reverse?560:680,easing:'cubic-bezier(.22,1,.36,1)',fill:'forwards'});
  anim.onfinish=()=>{if(reverse)o.style.opacity='';else t.style.opacity='';clone.remove();done();};
 }
 function requestClose(){if(closingRef.current)return;closingRef.current=true;setClosing(true);setTypedN(0);fly(true,onClose);}
 useEffect(()=>{let timer=0;fly(false,()=>{if(!typed)return;let n=0;timer=window.setInterval(()=>{n++;setTypedN(n);if(n>=typed.length)window.clearInterval(timer);},55);});
  return()=>{window.clearInterval(timer);const o=origin?document.querySelector<HTMLElement>(origin):null;if(o)o.style.opacity='';document.querySelectorAll('.title-fly').forEach(e=>e.remove());};
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[]);
 useEffect(()=>{const previous=document.activeElement as HTMLElement|null;ref.current?.focus();const handler=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.stopPropagation();requestClose();}if(e.key==='Tab'){const elements=ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input, select, textarea, [tabindex="0"]');if(!elements?.length)return;const first=elements[0],last=elements[elements.length-1];if(e.shiftKey&&(document.activeElement===first||document.activeElement===ref.current)){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}};document.addEventListener('keydown',handler);const old=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{document.removeEventListener('keydown',handler);document.body.style.overflow=old;previous?.focus();};},[onClose]);
 return <div className={'modal-backdrop'+(closing?' closing':'')} onMouseDown={e=>{if(e.target===e.currentTarget)requestClose();}}><div role="dialog" aria-modal="true" aria-label={title+(typed||'')} tabIndex={-1} ref={ref} className={'modal '+(wide?'wide ':'')+(closing?'closing ':'')+(origin?'has-origin ':'')+className}><header className="modal-header"><div>{eyebrow&&<div className="eyebrow">{eyebrow}</div>}<h2 ref={h2}><span className="title-main">{title}</span>{typed&&<span className="title-typed" aria-hidden="true">{typed.slice(0,typedN)}{typedN>0&&typedN<typed.length&&<i className="title-caret"/>}</span>}</h2>{subtitle&&<p className="modal-subtitle">{subtitle}</p>}</div><button className="icon-button" onClick={requestClose} aria-label="Cerrar ventana"><X size={21}/></button></header><div className="modal-body">{children}</div></div></div>;
}
export function Note({children}:{children:ReactNode}){return <div className="note"><Info size={14}/><span>{children}</span></div>;}
export function External({href,children}:{href:string;children:ReactNode}){return <a href={href} target="_blank" rel="noopener noreferrer" className="external-link">{children}<ArrowUpRight size={14}/></a>;}
function ArtBuilding({x,y,h=12,c}:{x:number;y:number;h?:number;c:string}){return <g stroke={c} strokeWidth=".75"><path d={`M${x},${y} l9,-5 9,5 v${-h} l-9,-5 -9,5Z`} fill={c} fillOpacity=".12"/><path d={`M${x},${y-h} l9,5 9,-5 M${x+9},${y+5-h} v${h}`} opacity=".7"/></g>;}
export function RiskArt({hazard}:{hazard:Hazard}){
 const color={torrential:'#83c9ee',flood:'#8bd3c3',landslide:'#d6b286'}[hazard];
 return <svg className={'risk-art '+hazard} viewBox="0 0 320 230" fill="none" aria-hidden="true"><defs><linearGradient id={'fade-'+hazard} x1="35" y1="20" x2="280" y2="220" gradientUnits="userSpaceOnUse"><stop stopColor={color} stopOpacity=".06"/><stop offset=".5" stopColor={color} stopOpacity=".6"/><stop offset="1" stopColor={color} stopOpacity=".1"/></linearGradient></defs>
 {hazard==='torrential'?<>
 {Array.from({length:12},(_,i)=><g key={i} stroke={'url(#fade-'+hazard+')'} strokeWidth=".8"><path d={`M ${15-i*3} ${80+i*10} C ${55+i*2} ${36+i*7}, ${90+i*2} ${30+i*8}, ${150+i*.8} ${130+i*4}`}/><path d={`M ${312+i*2} ${45+i*11} C ${255-i*2} ${28+i*10}, ${213-i} ${56+i*10}, ${154+i*.5} ${130+i*4}`}/></g>)}
 <path d="M170 36 C150 56 178 76 154 96 S163 121 151 143 S130 176 164 206" stroke={color} strokeWidth="13" opacity=".08"/><path d="M170 36 C150 56 178 76 154 96 S163 121 151 143 S130 176 164 206" stroke={color} strokeWidth="2.6"/><path d="m108 77 22 18 24 1m67 18-35 8-35 21m-39 3 18 14 12 8" stroke={color} opacity=".55"/><circle cx="153" cy="144" r="4" fill={color}/>{[0,1,2,3].map(i=><ArtBuilding key={i} x={185+i*21} y={170+i*5} h={10+i%2*7} c={color}/>)}</>:hazard==='flood'?<>
 {Array.from({length:10},(_,i)=><g key={i} stroke={'url(#fade-'+hazard+')'} strokeWidth=".8"><path d={`M-15 ${30+i*13} Q80 ${5+i*13} 135 ${109+i*2} T330 ${175+i*6}`}/><path d={`M330 ${12+i*10} Q238 ${-2+i*10} 176 ${108+i*3} T-10 ${194+i*4}`}/></g>)}
 <path d="M14 134 Q75 94 124 127 T210 138 T315 165" stroke={color} strokeWidth="18" opacity=".08"/><path d="M14 134 Q75 94 124 127 T210 138 T315 165" stroke={color} strokeWidth="2.2"/>
 <g stroke={color} opacity=".35">{[0,1,2,3].map(i=><path key={i} d={`M${80+i*35} 150 l85 48 M${108+i*32} 140 l-55 61`}/>)}</g>{[[105,159],[140,169],[172,179],[185,151],[216,168],[243,180],[74,184]].map(([x,y],i)=><ArtBuilding key={i} x={x} y={y} h={12+i%3*7} c={color}/>)}</>:<>
 {Array.from({length:7},(_,i)=><path key={i} d={`M${23-i*4} ${130+i*8} Q65 ${68+i*8} 130 ${56+i*9} T${302+i*4} ${120+i*8}`} stroke={'url(#fade-'+hazard+')'} strokeWidth=".8"/>)}
 <path d="m42 153 102-99 126 78-98 60Z" fill={color} fillOpacity=".07" stroke={color} opacity=".8"/><path d="m42 153 130 39 98-60v27l-98 57-130-37Z" fill={color} fillOpacity=".04" stroke={color} opacity=".4"/>
 <g stroke={color} strokeWidth=".7" opacity=".5"><path d="m42 153 55-22 47-77 8 65 31-41 15 65 72-11-39 36-59 24-20-73-55 12 75 61M97 131l47-77 39 24-31 41 46 24-26 49m26-49 33 25M42 161l130 39 98-57M42 171l130 38 98-58"/></g>
 {[[123,89],[155,102],[185,119],[81,142]].map(([x,y],i)=><ArtBuilding key={i} x={x} y={y} h={11+i%2*7} c={color}/>)}<path d="m151 123 10 25 20 23 37 30" stroke={color} strokeWidth="8" opacity=".13"/>{Array.from({length:20},(_,i)=><circle key={i} cx={154+i*3+(i%3)*3} cy={128+i*3.6+(i%4)*2} r={i%3===0?2:1} fill={color} opacity={.9-i*.025}/>)}
 </>}
 </svg>;
}
export function IdigerLogo(){return <span className="idiger-logo" aria-hidden="true">
 <svg className="idiger-shield" viewBox="0 0 40 46" fill="none"><defs><linearGradient id="idiger-co" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FCD116"/><stop offset=".5" stopColor="#FCD116"/><stop offset=".5" stopColor="#1f52bd"/><stop offset=".75" stopColor="#1f52bd"/><stop offset=".75" stopColor="#CE1126"/><stop offset="1" stopColor="#CE1126"/></linearGradient><linearGradient id="idiger-shine" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff" stopOpacity=".32"/><stop offset=".5" stopColor="#fff" stopOpacity="0"/></linearGradient></defs>
 <path d="M20 2.5 36.5 7.5v13.2c0 10.6-7 18.7-16.5 22.8C10.5 39.4 3.5 31.3 3.5 20.7V7.5Z" fill="url(#idiger-co)"/>
 <path d="M20 2.5 36.5 7.5v13.2c0 10.6-7 18.7-16.5 22.8C10.5 39.4 3.5 31.3 3.5 20.7V7.5Z" fill="url(#idiger-shine)"/>
 <path d="M9.5 19.5 16 11l4 5.2 3.2-3.7 7.3 7" stroke="#16314a" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" opacity=".78"/>
 <path d="M20 2.5 36.5 7.5v13.2c0 10.6-7 18.7-16.5 22.8C10.5 39.4 3.5 31.3 3.5 20.7V7.5Z" stroke="#fff" strokeOpacity=".55" strokeWidth="1.2" strokeLinejoin="round"/>
 <path d="M20 5.6 33.6 9.8v10.9c0 8.9-5.7 15.9-13.6 19.6C12.1 36.6 6.4 29.6 6.4 20.7V9.8Z" stroke="#fff" strokeOpacity=".28" strokeWidth=".7" strokeLinejoin="round"/></svg>
 <span className="idiger-word">IDIGER</span>
</span>;}
