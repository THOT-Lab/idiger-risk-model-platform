import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Rotate3D, Maximize2, Mountain, MousePointer2, BookOpen } from 'lucide-react';
import type { Buildings, Result, Scenario, TerrainData, Territory } from '../lib/types';
import { Playback } from './ResultsPanel';
import { damage, fmt, money, scenarioSeverity } from '../lib/scenarios';
import { slideRoute, terrainSampler, terrainXY } from '../lib/terrain';
interface Props {territory:Territory;buildings:Buildings;scenario:Scenario;result:Result;progress:number;playing:boolean;onProgress:(p:number)=>void;onPlaying:(p:boolean)=>void;onReplay:()=>void;onReady:()=>void;onSources:()=>void;}
export default function LandslideScene({territory,buildings,scenario,result,progress,playing,onProgress,onPlaying,onReplay,onReady,onSources}:Props){
 const host=useRef<HTMLDivElement>(null),current=useRef({progress,playing}),ready=useRef(onReady),controlsRef=useRef<OrbitControls|null>(null);current.current={progress,playing};ready.current=onReady;
 const [orbit,setOrbit]=useState(false),[error,setError]=useState(''),[loaded,setLoaded]=useState(false);const orbitRef=useRef(orbit);orbitRef.current=orbit;
 useEffect(()=>{
  let disposed=false,cleanup:()=>void=()=>{};const element=host.current;if(!element)return;
  fetch(import.meta.env.BASE_URL+'data/terrain/'+territory.id+'.json').then(r=>{if(!r.ok)throw Error('No se pudo cargar el relieve documentado.');return r.json() as Promise<TerrainData>;}).then(dem=>{
   if(disposed)return;const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
   renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.6));renderer.setSize(element.clientWidth,element.clientHeight);renderer.setClearColor(0x0a1219,1);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.35;element.appendChild(renderer.domElement);
   const scene=new THREE.Scene();scene.fog=new THREE.FogExp2(0x0a1219,.0026);const camera=new THREE.PerspectiveCamera(38,element.clientWidth/element.clientHeight,.1,800);
   const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,8,0);controls.enableDamping=true;controls.minDistance=90;controls.maxDistance=320;controls.maxPolarAngle=Math.PI*.49;controls.autoRotateSpeed=.7;controlsRef.current=controls;
   const initial=new THREE.Vector3(0,225,7),destination=new THREE.Vector3(130,105,135);camera.position.copy(initial);
   let touched=false;controls.addEventListener('start',()=>{touched=true;});
   scene.add(new THREE.HemisphereLight(0xc8e6f5,0x34493b,2.2));const sun=new THREE.DirectionalLight(0xffe3be,3.2);sun.position.set(-70,120,40);scene.add(sun);const rim=new THREE.DirectionalLight(0x88c9d2,1.4);rim.position.set(40,30,-60);scene.add(rim);
   const minHeight=Math.min(...dem.heights),maxHeight=Math.max(...dem.heights);
   const xy=(lon:number,lat:number)=>terrainXY(dem,lon,lat),heightAt=terrainSampler(dem);
   // The terrain is sampled from a regional DEM; the colored units are conceptual, not a soil survey.
   const geometry=new THREE.PlaneGeometry(120,100,40,40);geometry.rotateX(-Math.PI/2);const pos=geometry.attributes.position;
   for(let i=0;i<pos.count;i++)pos.setY(i,heightAt(pos.getX(i),pos.getZ(i)));geometry.computeVertexNormals();
   const facets=geometry.toNonIndexed(),colors=new Float32Array(facets.attributes.position.count*3),color=new THREE.Color();
   for(let i=0;i<facets.attributes.position.count;i+=3){const x=facets.attributes.position.getX(i),z=facets.attributes.position.getZ(i),h=heightAt(x,z),band=Math.sin(x*.08+z*.035)*.6+h/35;color.set(band>.85?'#6f8064':band>.1?'#89917a':'#a09678');color.multiplyScalar(.91+Math.sin(i*19)*.07);for(let j=0;j<3;j++)color.toArray(colors,(i+j)*3);}
   facets.setAttribute('color',new THREE.BufferAttribute(colors,3));scene.add(new THREE.Mesh(facets,new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,flatShading:true})));
   const meshLines=new THREE.LineSegments(new THREE.WireframeGeometry(geometry),new THREE.LineBasicMaterial({color:0xdce2b6,transparent:true,opacity:.09}));scene.add(meshLines);
   // Layered cutaway on all four edges, explicitly hypothetical depth/thickness.
   for(const side of [0,1,2,3])for(let layer=0;layer<3;layer++){
    const verts:number[]=[],indices:number[]=[];
    for(let i=0;i<=64;i++){const x=side===2?-60:side===3?60:-60+i/64*120,z=side===0?-50:side===1?50:-50+i/64*100,h=heightAt(x,z),levels=[h,h-2,h-6,-9];verts.push(x,levels[layer],z,x,levels[layer+1],z);if(i<64){const a=i*2;indices.push(a,a+1,a+2,a+1,a+3,a+2);}}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));g.setIndex(indices);g.computeVertexNormals();scene.add(new THREE.Mesh(g,new THREE.MeshStandardMaterial({color:[0x768265,0xa48761,0x59645d][layer],side:THREE.DoubleSide,roughness:1})));
   }
   const base=new THREE.Mesh(new THREE.BoxGeometry(120.1,1,100.1),new THREE.MeshStandardMaterial({color:0x22343b,roughness:.8}));base.position.y=-9.5;scene.add(base);const grid=new THREE.GridHelper(280,28,0x2a4246,0x14282e);grid.position.y=-10.1;scene.add(grid);
   // True footprint centers and dimensions. Heights use the imported cadastral attributes.
   const items=buildings.features.map(f=>{const ring=f.geometry.type==='Polygon'?f.geometry.coordinates[0]:f.geometry.coordinates[0][0];const points=ring.map(p=>xy(p[0],p[1]));const xs=points.map(p=>p[0]),zs=points.map(p=>p[1]),x=(Math.min(...xs)+Math.max(...xs))/2,z=(Math.min(...zs)+Math.max(...zs))/2;return{x,z,w:Math.max(.25,Math.max(...xs)-Math.min(...xs)),d:Math.max(.25,Math.max(...zs)-Math.min(...zs)),h:Math.max(.3,f.properties.height/10),props:f.properties};}).filter(b=>Math.abs(b.x)<59&&Math.abs(b.z)<49);
   const houses=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshStandardMaterial({roughness:.8,metalness:.03}),items.length);scene.add(houses);const obj=new THREE.Object3D();
   // Prescribed release follows local downhill gradient of the DEM. No geotechnical solver is claimed.
   const route=slideRoute(dem).map(([x,z])=>new THREE.Vector2(x,z));
   const pathAt=(t:number)=>{const f=THREE.MathUtils.clamp(t,0,1)*90,i=Math.min(89,Math.floor(f));return route[i].clone().lerp(route[i+1],f-i);};
   const ribbon=new THREE.PlaneGeometry(1,1,16,80);ribbon.rotateX(-Math.PI/2);const rp=ribbon.attributes.position,uv=ribbon.attributes.uv;
   const runout=new THREE.Mesh(ribbon,new THREE.MeshStandardMaterial({color:0xbb9063,roughness:1,side:THREE.DoubleSide,flatShading:true}));scene.add(runout);
   const rocks=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,0),new THREE.MeshStandardMaterial({color:0xd0ad78,roughness:1}),700);scene.add(rocks);
   const severity=scenarioSeverity(scenario,'landslide');let frame=0,last=-1,start=performance.now(),lastTime=0;
   const render=(time:number)=>{frame=requestAnimationFrame(render);if(time-lastTime<28)return;lastTime=time;const p=current.current.progress,run=THREE.MathUtils.clamp((p-.1)/.78,0,1);
    if(!touched&&time-start<2300){const t=THREE.MathUtils.smoothstep((time-start)/2300,0,1);camera.position.lerpVectors(initial,destination,t);}controls.autoRotate=orbitRef.current;controls.update();
    if(Math.abs(p-last)>.0001){last=p;runout.visible=run>.001;rocks.visible=run>.001;
     for(let i=0;i<rp.count;i++){const v=uv.getY(i),u=uv.getX(i),q=pathAt(v*run),q2=pathAt(Math.min(1,v*run+.01)),dx=q2.x-q.x,dz=q2.y-q.y,len=Math.hypot(dx,dz)||1,width=(3+v*4)*severity*Math.min(1,run*7),x=q.x-dz/len*(u-.5)*width*2,z=q.y+dx/len*(u-.5)*width*2;rp.setXYZ(i,x,heightAt(x,z)+.3+Math.sin(u*Math.PI)*.8,z);}rp.needsUpdate=true;ribbon.computeVertexNormals();
     for(let i=0;i<700;i++){const a=((i*73)%701)/701,b=((i*137)%701)/701,q=pathAt(run*(.12+a*.88)),q2=pathAt(Math.min(1,run*(.12+a*.88)+.01)),dx=q2.x-q.x,dz=q2.y-q.y,len=Math.hypot(dx,dz)||1,lateral=(b-.5)*(6+run*8)*severity,x=q.x-dz/len*lateral,z=q.y+dx/len*lateral,size=.15+((i*97)%700)/700*.55;obj.position.set(x,heightAt(x,z)+size*.5+.3,z);obj.rotation.set(run*6+i,run*4+i,run*9+i);obj.scale.setScalar(size*Math.min(1,run*8));obj.updateMatrix();rocks.setMatrixAt(i,obj.matrix);}rocks.instanceMatrix.needsUpdate=true;
     items.forEach((b,i)=>{const status=damage(b.props,severity,p);obj.position.set(b.x,heightAt(b.x,b.z)+b.h/2,b.z);obj.rotation.set(0,0,0);obj.scale.set(b.w,b.h,b.d);obj.updateMatrix();houses.setMatrixAt(i,obj.matrix);color.set(status==='high'?'#ee9477':status==='medium'?'#e3c787':'#d7ded3');houses.setColorAt(i,color);});houses.instanceMatrix.needsUpdate=true;if(houses.instanceColor)houses.instanceColor.needsUpdate=true;
    }renderer.render(scene,camera);
   };frame=requestAnimationFrame(render);
   const observer=new ResizeObserver(()=>{if(element.clientWidth&&element.clientHeight){camera.aspect=element.clientWidth/element.clientHeight;camera.updateProjectionMatrix();renderer.setSize(element.clientWidth,element.clientHeight);}});observer.observe(element);element.dataset.ready='true';element.dataset.terrainRange=`${minHeight}–${maxHeight}`;setLoaded(true);ready.current();
   cleanup=()=>{cancelAnimationFrame(frame);observer.disconnect();controls.dispose();controlsRef.current=null;geometry.dispose();scene.traverse(o=>{if(o instanceof THREE.Mesh||o instanceof THREE.Line||o instanceof THREE.Points){o.geometry.dispose();(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.dispose());}});renderer.dispose();renderer.domElement.remove();};
  }).catch(e=>{if(!disposed){setError(e instanceof Error?e.message:'La vista necesita WebGL.');ready.current();}});
  return()=>{disposed=true;cleanup();};
 },[territory,buildings,scenario]);
 const phase=progress<.18?0:progress<.72?1:2;
 return <div className="landslide-experience"><div className="scene-view"><div ref={host} className="three-host" role="img" aria-label={`Relieve geográfico de ${territory.name}, huellas de edificios y deslizamiento ilustrativo`}/>{!loaded&&!error&&<div className="scene-loading"><span className="spinner"/>Cargando relieve…</div>}{error&&<div className="scene-error">{error} Los resultados cartográficos siguen disponibles.</div>}<div className="scene-top-label"><Mountain size={16}/><span>{territory.name}</span><b>3D</b></div><div className="scene-tools"><button className={orbit?'active':''} onClick={()=>setOrbit(!orbit)}><Rotate3D size={16}/>{orbit?'Detener órbita':'Orbitar'}</button><button onClick={()=>{const c=controlsRef.current;if(c){c.object.position.set(130,105,135);c.target.set(0,8,0);c.update();}}} aria-label="Restablecer cámara 3D"><Maximize2 size={16}/></button><button onClick={onSources}><BookOpen size={14}/>Fuentes</button></div><div className="soil-key"><span className="eyebrow">UNIDADES CONCEPTUALES</span><span><i style={{background:'#768265'}}/>Cobertura superficial</span><span><i style={{background:'#a48761'}}/>Depósito de ladera</span><span><i style={{background:'#59645d'}}/>Sustrato</span><small>Polígonos y espesores hipotéticos.<br/>Pendiente visual del DEM regional.</small></div><div className="scene-live"><span>IMPACTOS ILUSTRATIVOS</span><strong>{money(result.totalLoss)} <small>COP</small></strong><span>Pérdida económica</span><strong>{fmt(result.criticalPeople)} <small>personas</small></strong><span>Exposición crítica · no mortalidad</span></div><div className="scene-instruction"><MousePointer2 size={13}/>Arrastre para girar · Rueda para acercar</div><div className="scene-phase-row">{['01 · Ruptura','02 · Propagación','03 · Depósito'].map((p,i)=><span key={p} className={phase===i?'active':''}>{p}</span>)}</div></div><Playback progress={progress} onProgress={onProgress} playing={playing} onPlaying={onPlaying} duration={12} onReplay={onReplay} before={progress===0} onBefore={()=>{onPlaying(false);onProgress(progress===0?1:0);}}/><p className="scene-footnote">DEM regional · huellas Catastro / copia UDFJC 2022 · escala vertical ×1,35 · suelo y trayectoria prescritos · secuencia sin velocidad física calculada</p></div>;
}
