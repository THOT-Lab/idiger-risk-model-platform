import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import * as maplibregl from 'maplibre-gl';
import type { GeoJSONSource, StyleSpecification } from 'maplibre-gl';
import type { FeatureCollection } from 'geojson';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import buffer from '@turf/buffer';
import type { Polygon } from 'geojson';
import 'maplibre-gl/dist/maplibre-gl.css';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import { ChevronDown, Layers, Check, X, MousePointerClick, Navigation2, Play, RotateCcw, RotateCw, Satellite } from 'lucide-react';
import { territories, hazardInfo } from '../data/territories';
import { channelGeometry, damage, scenarioSeverity, waterGeometry } from '../lib/scenarios';
import type { Hazard, Scenario, Station, Territory, ViewMode, Buildings } from '../lib/types';
import { applyWorld, type World } from '../lib/worlds';
import { slideRoute } from '../lib/terrain';
import type { TerrainData } from '../lib/types';
// MDT extrait pour chaque secteur de Movimientos en masa (même fichier que la vue 3D).
const demCache=new Map<string,Promise<TerrainData|null>>();
const loadDem=(id:string)=>{if(!demCache.has(id))demCache.set(id,fetch('/data/terrain/'+id+'.json').then(r=>r.ok?r.json():null).catch(()=>null));return demCache.get(id)!;};
const empty:FeatureCollection={type:'FeatureCollection',features:[]};
maplibregl.setWorkerUrl(workerUrl);
interface Props {landing?:boolean;world?:World|null;onWorldInfo?:(s:string)=>void;stationsVisible?:boolean;onStationsVisible?:(v:boolean)=>void;territoryPanel?:React.ReactNode;panelKey?:string;onClearTerritory?:()=>void;home:boolean;hazard:Hazard;territory:Territory|null;scenario:Scenario;progress:number;view:ViewMode;result:boolean;onSelect:(t:Territory)=>void;stations:Station[];buildings:Buildings;sceneOpen:boolean;dataOpen:boolean;onLayersOpen:()=>void;}
const style:StyleSpecification={version:8,sources:{
 'local-satellite':{type:'image',url:'/data/bogota-satellite.jpg',coordinates:[[-74.28,4.86],[-73.96,4.86],[-73.96,4.46],[-74.28,4.46]]},
 satellite:{type:'raster',tiles:['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],tileSize:256,maxzoom:19}
},layers:[{id:'background',type:'background',paint:{'background-color':'#0a1116'}},{id:'fallback',type:'raster',source:'local-satellite',paint:{'raster-opacity':1,'raster-saturation':-.28,'raster-brightness-max':.72}},{id:'satellite',type:'raster',source:'satellite',paint:{'raster-saturation':-.25,'raster-brightness-max':.8}}]};
// Vue de départ de l'espace carte (cadrage choisi par Laurent : Bogotá vue du sud, de Santander à Tibabita).
const START={center:[-74.085,4.565] as [number,number],zoom:11.75,pitch:62};
type NetStation={name:string;network:string;category:string;coordinates:[number,number];sensors:{variable:string}[]};
// Les neuf réseaux de « Manejo de datos » (networks.json), chacun avec sa couleur.
export const NET_COLOR:Record<string,string>={IDIGER:'#9ee3cc',Acueducto:'#71c7f5',CAR:'#e8c47d',IDEAM:'#c3a6f2','SDA · aire':'#f29bc1',SGC:'#ff9f6e',Particulares:'#d7dde2',Aerocivil:'#7fb0ff','Ciencia ciudadana':'#b6e36b'};
const NET_KEYS=['idiger','eaab','car','ideam','rmcab','sgc','particulares','aerocivil','ciudadana'] as const;
// Réseau d'une quebrada : affiché seulement pour le bassin survolé (ou sélectionné), avec son nom.
// Au repos, seuls les contours des bassins sont dessinés (moins de lignes drapées sur le relief = pas de scintillement).
function tnetHover(map:maplibregl.Map,id:string|null){if(!map.getLayer('tnet-mapped'))return;const f=(kinds:string[]):maplibregl.FilterSpecification=>['all',['in',['get','kind'],['literal',kinds]],['==',['get','territory'],id??'__none__']];
 map.setFilter('tnet-mapped',f(['mapped']));map.setFilter('tnet-inferred',f(['inferred']));map.setFilter('tnet-glow',f(['mapped','inferred']));map.setFilter('tnet-points',f(['outlet','crest']));
 document.querySelectorAll<HTMLElement>('.map-label.hover-only:not(.always)').forEach(el=>el.classList.toggle('show',el.dataset.id===id));
 document.querySelectorAll<HTMLElement>('.map-label.always').forEach(el=>el.classList.toggle('hot',el.dataset.id===id));}
export function MapView(props:Props){
 const container=useRef<HTMLDivElement>(null),mapRef=useRef<maplibregl.Map|null>(null),latest=useRef(props);latest.current=props;
 // Pendant un evento (scénario, résultats), la carte est figée sur la cuenca ; sinon on peut en choisir une autre.
 const locked=()=>!!latest.current.territory&&latest.current.panelKey!=='territory';
 const dimRef=useRef<'2d'|'3d'>('3d'),markers=useRef<maplibregl.Marker[]>([]),popup=useRef<maplibregl.Popup|null>(null);
 const [netStations,setNetStations]=useState<NetStation[]>([]),[ready,setReady]=useState(false),[failed,setFailed]=useState(false),[layers,setLayers]=useState(false),[ownStations,setOwnStations]=useState(true),[legendNets,setLegendNets]=useState<string[]>([]),[inventoryVisible,setInventoryVisible]=useState(true),[,setTerrain]=useState(false),[dim,setDim]=useState<'2d'|'3d'>('3d'),[pitch,setPitch]=useState(25),[bearing,setBearing]=useState(0),[findOpen,setFindOpen]=useState(false);
 // Emplacement « Capas » dans la barre du haut (à côté de Mis escenarios), rendu par portail.
 const [topSlot,setTopSlot]=useState<HTMLElement|null>(null);useEffect(()=>{setTopSlot(props.home?null:document.getElementById('topbar-slot'));},[props.home]);
 // Survol d'un nom dans la liste = même surbrillance que le survol de la carte.
 const previewRef=useRef<string|null>(null);
 const previewZone=(id:string|null)=>{const map=mapRef.current;if(!map||!map.getSource('zones')||locked())return;if(previewRef.current)map.setFeatureState({source:'zones',id:previewRef.current},{hover:false});previewRef.current=id;if(id)map.setFeatureState({source:'zones',id},{hover:true});tnetHover(map,id??latest.current.territory?.id??null);};
 const stationsVisible=props.stationsVisible??ownStations,setStationsVisible=props.onStationsVisible??setOwnStations;
 // Couche « Modelo digital de elevación » : relief ombré seul (l'image satellite s'efface).
 const [demVisible,setDemVisible]=useState(false);
 useEffect(()=>{const map=mapRef.current;if(!map||!ready||!map.getLayer('dem-preload'))return;
  map.setPaintProperty('dem-preload','hillshade-exaggeration',demVisible?.75:0);
  map.setPaintProperty('dem-preload','hillshade-shadow-color',demVisible?'#06121a':'#000000');map.setPaintProperty('dem-preload','hillshade-highlight-color',demVisible?'#e6f4f1':'#ffffff');map.setPaintProperty('dem-preload','hillshade-accent-color',demVisible?'#2b4a57':'#000000');
  for(const id of ['satellite','fallback'])if(map.getLayer(id))map.setPaintProperty(id,'raster-opacity',demVisible?.06:1);
 },[ready,demVisible]);
 // « Simular un evento » glisse jusqu'à sa place dans la fiche qui se déplie (clone qui suit la cible à chaque image).
 const simRef=useRef<HTMLButtonElement>(null),simRect=useRef<DOMRect|null>(null);
 useLayoutEffect(()=>{if(simRef.current)simRect.current=simRef.current.getBoundingClientRect();});
 useEffect(()=>{if(!props.territory||!simRect.current||props.panelKey!=='territory')return;const from=simRect.current;simRect.current=null;
  // Animation confiée au compositeur (Web Animations) : elle reste fluide même si la carte occupe le fil principal.
  requestAnimationFrame(()=>requestAnimationFrame(()=>{const target=document.querySelector<HTMLElement>('.map-territory-fold .territory-summary .primary-button'),card=target?.closest<HTMLElement>('.territory-summary');if(!target||!card)return;
   const t=target.getBoundingClientRect(),c=card.getBoundingClientRect(),to={left:t.left,top:t.top,width:t.width,height:t.height};void c;
   // Le clone EST le bouton d'arrivée (même forme, même contenu) : pas de saut quand il se pose.
   const clone=target.cloneNode(true) as HTMLElement;clone.classList.add('sim-fly');clone.removeAttribute('id');clone.setAttribute('aria-hidden','true');Object.assign(clone.style,{left:to.left+'px',top:to.top+'px',width:to.width+'px',height:to.height+'px'});document.body.append(clone);target.style.visibility='hidden';
   const sx=from.width/to.width,sy=from.height/to.height;
   const a=clone.animate([{transform:`translate(${from.left-to.left}px,${from.top-to.top}px) scale(${sx},${sy})`,transformOrigin:'0 0'},{transform:'none',transformOrigin:'0 0'}],{duration:700,easing:'cubic-bezier(.22,1,.36,1)'});
   a.onfinish=()=>{target.style.visibility='';clone.remove();};}));
 },[props.territory?.id,props.panelKey]);
 useEffect(()=>{if(props.dataOpen)setLayers(false);},[props.dataOpen]);
 useEffect(()=>{fetch('/data/networks.json').then(r=>r.json()).then(d=>setNetStations(NET_KEYS.filter(k=>d.networks[k]).flatMap(k=>d.networks[k].stations.map((x:NetStation)=>({...x,network:d.networks[k].name}))))).catch(()=>{});},[]);
 useEffect(()=>{
  if(!container.current)return;let map:maplibregl.Map;
  try{map=new maplibregl.Map({container:container.current,style,center:[-74.09,4.65],zoom:11.6,pitch:25,bearing:0,attributionControl:false,canvasContextAttributes:{antialias:true},maxPitch:80,minZoom:8,maxZoom:19,renderWorldCopies:false,dragRotate:true,aroundCenter:false,rotateSpeed:.8,touchZoomRotate:true});mapRef.current=map;if(import.meta.env.DEV)(window as unknown as {__map:maplibregl.Map}).__map=map;}catch{setFailed(true);return;}
  map.on('pitch',()=>setPitch(Math.round(map.getPitch())));map.on('rotate',()=>setBearing(map.getBearing()));
  map.on('load',()=>{
   map.addSource('hydrography',{type:'geojson',data:'/data/hydrography.geojson'});
   map.addLayer({id:'hydro-line',type:'line',source:'hydrography',paint:{'line-color':'#83cde7','line-width':['interpolate',['linear'],['zoom'],10,.45,14,1.2,17,2.2],'line-opacity':.6}});
   map.addSource('inventory',{type:'geojson',data:'/data/landslide-inventory.geojson'});
   map.addLayer({id:'inventory-fill',type:'fill',source:'inventory',paint:{'fill-color':'#e0a776','fill-opacity':['case',['boolean',['feature-state','hover'],false],.5,.2]}});
   map.addLayer({id:'inventory-line',type:'line',source:'inventory',paint:{'line-color':'#e0b58c','line-width':1,'line-opacity':.6}});
   map.addSource('zones',{type:'geojson',data:empty,promoteId:'id'});
   map.addLayer({id:'zones-fill',type:'fill',source:'zones',paint:{'fill-color':['get','color'],'fill-opacity':['case',['boolean',['feature-state','hover'],false],.26,.025]}});
   map.addLayer({id:'zones-line',type:'line',source:'zones',paint:{'line-color':['get','color'],'line-width':['case',['boolean',['feature-state','hover'],false],2,1],'line-opacity':.55}});
   // Réseau de chaque quebrada torrentielle : tronçons EAAB + tramo inferido jusqu'à la confluence.
   map.addSource('tnet',{type:'geojson',data:{type:'FeatureCollection',features:[]}});
   // Réseau des quebradas torrentielles + réseau EAAB de chaque grande cuenca d'Inundaciones (même surbrillance).
   Promise.all(['/data/torrential-network.geojson','/data/flood-network.geojson'].map(u=>fetch(u).then(r=>r.json()).catch(()=>({features:[]})))).then(([a,b])=>(map.getSource('tnet') as GeoJSONSource|undefined)?.setData({type:'FeatureCollection',features:[...a.features,...b.features]}));
   map.addLayer({id:'tnet-glow',type:'line',source:'tnet',filter:['in',['get','kind'],['literal',['mapped','inferred']]],layout:{'line-cap':'round','line-join':'round',visibility:'none'},paint:{'line-color':'#7fa7b5','line-width':['interpolate',['linear'],['zoom'],10,4,15,8],'line-blur':3,'line-opacity':.12}});
   map.addLayer({id:'tnet-mapped',type:'line',source:'tnet',filter:['==',['get','kind'],'mapped'],layout:{'line-cap':'round','line-join':'round',visibility:'none'},paint:{'line-color':'#91b4bf','line-width':['interpolate',['linear'],['zoom'],10,1.2,14,2,17,3],'line-opacity':.8}});
   map.addLayer({id:'tnet-inferred',type:'line',source:'tnet',filter:['==',['get','kind'],'inferred'],layout:{'line-cap':'round','line-join':'round',visibility:'none'},paint:{'line-color':'#7da9b9','line-width':['interpolate',['linear'],['zoom'],10,1,14,1.8,17,3],'line-dasharray':[1.6,1.4],'line-opacity':.75}});
   map.addLayer({id:'tnet-points',type:'circle',source:'tnet',filter:['in',['get','kind'],['literal',['outlet','crest']]],layout:{visibility:'none'},paint:{'circle-radius':['case',['==',['get','kind'],'outlet'],5,3.5],'circle-color':['case',['==',['get','kind'],'outlet'],'#c5b080','#b4c6c9'],'circle-opacity':.85,'circle-stroke-color':'#0b1820','circle-stroke-width':1.5}});
   map.addLayer({id:'tnet-hit',type:'line',source:'tnet',filter:['in',['get','kind'],['literal',['mapped','inferred']]],layout:{visibility:'none'},paint:{'line-color':'#000','line-width':12,'line-opacity':0.001}});
   map.addSource('water',{type:'geojson',data:empty});
   map.addLayer({id:'water-fill',type:'fill',source:'water',paint:{'fill-color':'#32a8ca','fill-opacity':.4}});
   map.addLayer({id:'water-outline',type:'line',source:'water',paint:{'line-color':'#9fe4ff','line-width':1.3,'line-opacity':.7}});
   map.addSource('selected-channel',{type:'geojson',data:empty});
   map.addLayer({id:'selected-channel-line',type:'line',source:'selected-channel',paint:{'line-color':'#9ad9f0','line-width':2,'line-opacity':.8}});
   map.addSource('buildings',{type:'geojson',data:empty});
   map.addLayer({id:'buildings-3d',type:'fill-extrusion',source:'buildings',paint:{'fill-extrusion-color':['get','color'],'fill-extrusion-height':['get','height'],'fill-extrusion-opacity':.85,'fill-extrusion-base':0}});
   map.addSource('stations',{type:'geojson',data:empty});
   map.addLayer({id:'stations-point',type:'circle',source:'stations',paint:{'circle-radius':6,'circle-color':['get','color'],'circle-stroke-color':'#132a24','circle-stroke-width':2}});
   let hovered:string|number|undefined;
   map.on('mousemove','zones-fill',e=>{if(latest.current.home||locked())return;map.getCanvas().style.cursor='pointer';const id=e.features?.[0]?.id;if(id===hovered)return;if(hovered!==undefined)map.setFeatureState({source:'zones',id:hovered},{hover:false});hovered=id;if(id!==undefined)map.setFeatureState({source:'zones',id},{hover:true});tnetHover(map,id===undefined?null:String(id));});
   map.on('mouseleave','zones-fill',()=>{map.getCanvas().style.cursor='';if(hovered!==undefined)map.setFeatureState({source:'zones',id:hovered},{hover:false});hovered=undefined;if(!locked())tnetHover(map,latest.current.territory?.id??null);});
   map.on('mousemove','tnet-hit',e=>{if(latest.current.home||locked()||latest.current.hazard==='landslide')return;const id=e.features?.[0]?.properties.territory;if(!id||id===hovered)return;map.getCanvas().style.cursor='pointer';if(hovered!==undefined)map.setFeatureState({source:'zones',id:hovered},{hover:false});hovered=id;map.setFeatureState({source:'zones',id},{hover:true});tnetHover(map,id);});
   map.on('mouseleave','tnet-hit',()=>{if(locked())return;map.getCanvas().style.cursor='';if(hovered!==undefined)map.setFeatureState({source:'zones',id:hovered},{hover:false});hovered=undefined;tnetHover(map,latest.current.territory?.id??null);});
   map.on('click','tnet-hit',e=>{if(latest.current.home||locked()||latest.current.hazard==='landslide')return;const t=territories.find(t=>t.id===e.features?.[0]?.properties.territory);if(t)latest.current.onSelect(t);});
   map.on('click','zones-fill',e=>{if(latest.current.home||locked())return;const t=territories.find(t=>t.id===e.features?.[0]?.properties.id);if(t&&t.id!==latest.current.territory?.id)latest.current.onSelect(t);});
   const showStation=(e:maplibregl.MapLayerMouseEvent)=>{const f=e.features?.[0];if(!f)return;map.getCanvas().style.cursor='pointer';popup.current?.remove();const div=document.createElement('div'),title=document.createElement('strong'),text=document.createElement('p');title.textContent=f.properties.name;text.textContent=`Red ${f.properties.network} · ${f.properties.category}\n${f.properties.sensors}\nFicha y datos: Datos · Manejo de datos`;div.append(title,text);popup.current=new maplibregl.Popup({closeButton:false,offset:12,maxWidth:'280px'}).setLngLat(e.lngLat).setDOMContent(div).addTo(map);};
   map.on('mouseenter','stations-point',showStation);map.on('click','stations-point',showStation);map.on('mouseleave','stations-point',()=>{map.getCanvas().style.cursor='';popup.current?.remove();});
   map.on('mouseenter','buildings-3d',()=>{map.getCanvas().style.cursor='pointer';});map.on('mouseleave','buildings-3d',()=>{map.getCanvas().style.cursor='';});
   map.on('click','buildings-3d',e=>{const f=e.features?.[0];if(!f)return;const div=document.createElement('div'),b=document.createElement('strong'),p=document.createElement('p');b.textContent='Edificación · '+f.properties.sourceId;p.textContent=`Huella geográfica · ${f.properties.height} m\n${f.properties.people} personas · ocupación sintética\n${f.properties.damageLabel}\nCopia UDFJC 2022 / atributos de Catastro`;div.append(b,p);new maplibregl.Popup({offset:8}).setLngLat(e.lngLat).setDOMContent(div).addTo(map);});
   let inventoryHover:string|number|undefined;
   map.on('mousemove','inventory-fill',e=>{if(latest.current.hazard!=='landslide')return;if(inventoryHover!==undefined)map.setFeatureState({source:'inventory',id:inventoryHover},{hover:false});inventoryHover=e.features?.[0]?.id;if(inventoryHover!==undefined)map.setFeatureState({source:'inventory',id:inventoryHover},{hover:true});map.getCanvas().style.cursor='pointer';});
   map.on('mouseleave','inventory-fill',()=>{if(inventoryHover!==undefined)map.setFeatureState({source:'inventory',id:inventoryHover},{hover:false});map.getCanvas().style.cursor='';});
   map.on('click','inventory-fill',e=>{if(latest.current.hazard!=='landslide'||latest.current.territory)return;const f=e.features?.[0];if(!f)return;const div=document.createElement('div'),b=document.createElement('strong'),p=document.createElement('p');b.textContent='Antecedente IDIGER · 2016';p.textContent=`Registro ${f.properties.OBJECTID} · ${f.properties.NOMBRE||'Sin nombre'}\nTIPO: ${f.properties.TIPO} (código original)\nSeleccione un sector rotulado para explorar un escenario.`;div.append(b,p);new maplibregl.Popup({offset:8}).setLngLat(e.lngLat).setDOMContent(div).addTo(map);});
   // Précharger le relief dès l'accueil (calque invisible) : à l'ouverture, les tuiles DEM sont
   // déjà là et le sol ne « monte » plus pendant l'animation (petit saut de caméra).
   if(!map.getSource('dem'))map.addSource('dem',{type:'raster-dem',tiles:['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],tileSize:256,maxzoom:14,encoding:'terrarium'});
   if(!map.getSource('dem-cache'))map.addSource('dem-cache',{type:'raster-dem',tiles:['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],tileSize:256,maxzoom:14,encoding:'terrarium'});
   if(!map.getLayer('dem-preload'))map.addLayer({id:'dem-preload',type:'hillshade',source:'dem-cache',paint:{'hillshade-exaggeration':0}});
   setReady(true);
  });
  return()=>{markers.current.forEach(m=>m.remove());popup.current?.remove();map.remove();mapRef.current=null;};
 },[]);
 useEffect(()=>{const map=mapRef.current;if(!map||!ready)return;const t=props.territory;
  const open=!t||props.panelKey==='territory';const list=props.home?[]:territories.filter(z=>z.hazard===props.hazard&&(open||z.id===t!.id));
  (map.getSource('zones') as GeoJSONSource).setData({type:'FeatureCollection',features:list.map(t=>({type:'Feature',id:t.id,properties:{id:t.id,name:t.name,color:hazardInfo[t.hazard].color},geometry:t.geometry}))});
  markers.current.forEach(m=>m.remove());markers.current=[];
  for(const z of list){const el=document.createElement('button');const pill=true;const sel=!!t&&z.id===t.id;el.className='map-label v2-label'+(pill?' hover-only':'')+(sel?' pinned':'')+(z.hazard==='landslide'&&!t?' always show':'');el.dataset.id=z.id;if(pill){const sp=document.createElement('span');sp.textContent=z.name;el.append(sp);}else el.textContent=z.name;el.setAttribute('aria-label','Explorar '+z.name);el.style.setProperty('--label-color',hazardInfo[z.hazard].color);el.onclick=()=>latest.current.onSelect(z);el.onmouseenter=()=>{map.setFeatureState({source:'zones',id:z.id},{hover:true});if(!locked())tnetHover(map,z.id);};el.onmouseleave=()=>{map.setFeatureState({source:'zones',id:z.id},{hover:false});if(!locked())tnetHover(map,latest.current.territory?.id??null);};markers.current.push(new maplibregl.Marker({element:el,anchor:'center'}).setLngLat(sel?[z.focus[0],z.focus[1]+.003]:z.hazard==='flood'&&['tunjuelo','fucha','salitre','torca','bogota'].includes(z.id)?z.focus:z.center).addTo(map));}
  map.setPaintProperty('zones-fill','fill-opacity',t&&!open?.015:['case',['==',['id'],t?.id??'__none__'],.13,['boolean',['feature-state','hover'],false],.3,props.hazard==='landslide'?.16:.025]);
  // Movimientos en masa : les secteurs sélectionnables ressortent nettement de l'inventaire 2016 (atténué).
  map.setPaintProperty('zones-line','line-width',['case',['boolean',['feature-state','hover'],false],2.6,props.hazard==='landslide'?2:1]);
  map.setPaintProperty('inventory-fill','fill-opacity',['case',['boolean',['feature-state','hover'],false],.35,props.hazard==='landslide'?.07:.2]);map.setPaintProperty('inventory-line','line-opacity',.3);
  map.setPaintProperty('zones-line','line-opacity',t&&!open?.24:.5);
  map.setLayoutProperty('hydro-line','visibility',props.home||props.hazard==='landslide'?'none':'visible');
  const showNet=!props.home&&props.hazard!=='landslide';for(const id of ['tnet-glow','tnet-mapped','tnet-inferred','tnet-points','tnet-hit'])map.setLayoutProperty(id,'visibility',showNet?'visible':'none');
  map.setLayoutProperty('tnet-hit','visibility','none');map.setLayoutProperty('hydro-line','visibility','none');
  tnetHover(map,t?t.id:null);
  for(const id of ['inventory-fill','inventory-line'])map.setLayoutProperty(id,'visibility',props.hazard==='landslide'&&!props.home&&inventoryVisible?'visible':'none');
 },[ready,props.home,props.hazard,props.territory,inventoryVisible,props.panelKey]);
 useEffect(()=>{const map=mapRef.current;if(!map||!ready)return;
  // Stations des trois réseaux (IDIGER, Acueducto, CAR) dans le territoire et ses abords immédiats (≈ 600 m).
  const zone=props.territory&&stationsVisible&&!props.home?buffer(props.territory.geometry as Polygon,.6,{units:'kilometers'}):null;
  const visible=zone?netStations.filter(s=>booleanPointInPolygon(s.coordinates,zone)):[];
  setLegendNets(Object.keys(NET_COLOR).filter(n=>visible.some(s=>s.network===n)));(map.getSource('stations') as GeoJSONSource).setData({type:'FeatureCollection',features:visible.map(s=>({type:'Feature',properties:{name:s.name,network:s.network,category:s.category,sensors:s.sensors.map(x=>x.variable).join(' · '),color:NET_COLOR[s.network]},geometry:{type:'Point',coordinates:s.coordinates}}))});popup.current?.remove();
 },[ready,netStations,props.territory,props.home,stationsVisible]);
 // Installer le relief avant de calculer le mouvement : le changer pendant l'animation
 // invalide le repère de la caméra et provoque un saut au départ/retour.
 useEffect(()=>{const map=mapRef.current;if(!map||!ready)return;map.stop();map.resize();setTerrainOn(!props.home);},[ready,props.home]);
 useEffect(()=>{const map=mapRef.current;if(!map||!ready)return;const t=props.territory;setLayers(false);
  // Liste Buscar refermée d'un coup quand une cuenca est choisie : sinon la fiche remonte pendant que « Simular un evento » vole vers elle.
  {const f=document.querySelector<HTMLElement>('.map-search-disclosure .map-search-fold');if(f&&t){f.style.transition='none';window.setTimeout(()=>{f.style.transition='';},120);}}if(t)setFindOpen(false);
  const handlers=[map.scrollZoom,map.boxZoom,map.dragRotate,map.dragPan,map.keyboard,map.doubleClickZoom,map.touchZoomRotate,map.touchPitch];handlers.forEach(h=>props.home?h.disable():h.enable());
   if(props.home){map.stop();map.easeTo({center:[-74.055,4.64],zoom:11.75,pitch:35,bearing:0,padding:{left:0,right:0,top:0,bottom:0},duration:1200});return;}
  let cancelled=false;const go=()=>{if(cancelled)return;
  if(t&&t.hazard==='torrential'&&t.bounds){map.fitBounds(t.bounds,{padding:{left:window.innerWidth>900?360:40,right:window.innerWidth>900?200:40,top:120,bottom:window.innerWidth<760?200:70},pitch:dimRef.current==='3d'?55:0,bearing:0,duration:1500,linear:true});return;}
  map.easeTo({center:t?t.focus:START.center,zoom:t?t.zoom:START.zoom,pitch:dimRef.current==='3d'?(t?62:START.pitch):0,bearing:0,padding:{left:window.innerWidth>900&&t?320:0,right:0,top:0,bottom:window.innerWidth<760&&t?160:0},duration:1500,essential:false});};
  // Attendre que le relief soit réellement posé sous le centre avant d'animer : sinon la caméra
  // interpole depuis une altitude 0 et passe sous le sol (bande noire) pendant la bascule 3D.
  if(map.getTerrain()){let n=0;const wait=()=>{if(cancelled)return;const e=map.queryTerrainElevation(map.getCenter());if((e!=null&&e>100)||++n>45)go();else requestAnimationFrame(wait);};wait();}else go();
  return()=>{cancelled=true;};
 },[ready,props.home,props.hazard,props.territory]);
 // Page de garde : vue au-dessus de l'aire urbaine qui dérive lentement vers l'est ; à l'entrée, trajet vers la vue d'accueil (le voile s'assombrit en même temps).
 useEffect(()=>{const map=mapRef.current;if(!map||!ready||!props.home)return;
  if(props.landing){map.stop();map.jumpTo({center:[-74.16,4.635],zoom:12.3,pitch:42,bearing:-8});map.easeTo({center:[-74.07,4.645],bearing:4,duration:40000,easing:t=>t,essential:false});return;}
  map.stop();map.easeTo({center:[-74.055,4.64],zoom:11.75,pitch:35,bearing:0,duration:2200,easing:t=>1-Math.pow(1-t,3),essential:false});
 },[ready,props.landing]);
 // Mondes « Manejo de datos » / « Climatología » : la carte se transforme (lib/worlds.ts), l'accueil reste figé en dessous.
 useEffect(()=>{const map=mapRef.current;if(!map||!ready||!props.world)return;return applyWorld(map,props.world,i=>latest.current.onWorldInfo?.(i));},[ready,props.world]);
 // Movimientos en masa, sur la carte même : le carré de MDT extrait est dessiné, puis la masse glisse le long du couloir
 // de plus grande pente de ce MDT (même méthode que la vue 3D, illustrative, sans calcul physique).
 useEffect(()=>{const map=mapRef.current;if(!map||!ready)return;
  if(!map.getSource('extract')){map.addSource('extract',{type:'geojson',data:empty});map.addSource('slide',{type:'geojson',data:empty});
   map.addLayer({id:'extract-glow',type:'line',source:'extract',paint:{'line-color':'#e0a776','line-width':10,'line-blur':6,'line-opacity':.55}});
   map.addLayer({id:'extract-line',type:'line',source:'extract',paint:{'line-color':'#ffe2b8','line-width':2.4,'line-dasharray':[2,1.5],'line-opacity':1}});
   map.addLayer({id:'slide-fill',type:'fill',source:'slide',paint:{'fill-color':'#8a5a36','fill-opacity':.78}});
   map.addLayer({id:'slide-line',type:'line',source:'slide',paint:{'line-color':'#d79a63','line-width':1.4,'line-opacity':.9}});}
  const t=props.territory,on=!!t&&t.hazard==='landslide'&&!props.home;let cancelled=false;
  if(!on){(map.getSource('extract') as GeoJSONSource).setData(empty);(map.getSource('slide') as GeoJSONSource).setData(empty);return;}
  loadDem(t!.id).then(d=>{if(cancelled||!d)return;const [w,s0,e,n]=d.bounds;
   (map.getSource('extract') as GeoJSONSource).setData({type:'FeatureCollection',features:[{type:'Feature',properties:{},geometry:{type:'LineString',coordinates:[[w,s0],[e,s0],[e,n],[w,n],[w,s0]]}}]});
   if(!props.result||props.progress<=0){(map.getSource('slide') as GeoJSONSource).setData(empty);return;}
   const ll=([x,z]:[number,number]):[number,number]=>[w+(x+60)/120*(e-w),n-(z+50)/100*(n-s0)];
   const route=slideRoute(d).map(ll),k=Math.max(2,Math.ceil(props.progress*route.length));
   const sev=scenarioSeverity(props.scenario,'landslide'),poly=buffer({type:'Feature',properties:{},geometry:{type:'LineString',coordinates:route.slice(0,k)}},.018+.03*Math.min(1,sev)*Math.min(1,props.progress*1.4),{units:'kilometers'});
   (map.getSource('slide') as GeoJSONSource).setData({type:'FeatureCollection',features:poly?[poly]:[]});});
  return()=>{cancelled=true;};
 },[ready,props.home,props.territory,props.result,props.progress,props.scenario]);
 useEffect(()=>{const map=mapRef.current;if(!map||!ready||props.sceneOpen)return;const t=props.territory;
  if(!t){for(const s of ['buildings','water','selected-channel'])(map.getSource(s) as GeoJSONSource).setData(empty);return;}
  const severity=scenarioSeverity(props.scenario,t.hazard);
  const features=props.buildings.features.map(b=>{const d=props.result?damage(b.properties,severity,props.progress):'low';return{...b,properties:{...b.properties,color:props.view==='hazard'?'#d7dfd9':d==='high'?'#f17867':d==='medium'?'#efc369':'#97ceb5',damageLabel:!props.result?'Estado inicial':d==='high'?'Daño alto · ilustrativo':d==='medium'?'Daño medio · ilustrativo':'Sin afectación representada'}};});
  (map.getSource('buildings') as GeoJSONSource).setData({type:'FeatureCollection',features});
  (map.getSource('selected-channel') as GeoJSONSource).setData(channelGeometry(t));
  (map.getSource('water') as GeoJSONSource).setData(props.result?waterGeometry(t,severity,props.progress):empty);
  map.setPaintProperty('water-fill','fill-opacity',props.view==='hazard'?.65:.35);map.setPaintProperty('buildings-3d','fill-extrusion-opacity',props.view==='hazard'?.38:.88);
 },[ready,props.buildings,props.territory,props.result,props.progress,props.scenario,props.view,props.sceneOpen]);
 function setTerrainOn(on:boolean){const map=mapRef.current;if(!map||!ready)return;if(!on){map.setTerrain(null);setTerrain(false);return;}if(!map.getSource('dem'))map.addSource('dem',{type:'raster-dem',tiles:['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],tileSize:256,maxzoom:14,encoding:'terrarium'});map.setTerrain({source:'dem',exaggeration:1.25});setTerrain(true);}
 function switchDim(){const map=mapRef.current;if(!map||!ready)return;const next=dim==='3d'?'2d':'3d';dimRef.current=next;setDim(next);map.stop();map.easeTo({pitch:next==='3d'?60:0,duration:900});} // relief gardé en 2D (vue zénithale) : pas de saut de caméra en le réactivant
 const rotate=(delta:number)=>{const map=mapRef.current;if(map)map.easeTo({bearing:map.getBearing()+delta,duration:450});};
 return <div className={'map-system '+(props.home?'home-map':'risk-map')+(props.world?' world-map world-'+props.world:'')}><div ref={container} className="map-canvas" role="region" aria-label="Mapa satelital interactivo de Bogotá"/>{failed&&<div className="map-fallback"><img src="/data/bogota-satellite.jpg" alt="Bogotá · imagen satelital de contexto"/></div>}{!ready&&!failed&&<div className="map-loading"><span className="spinner"/>Preparando cartografía…</div>}
 {!props.home&&<>{(()=>{const capas=<div className="layers-menu"><button className={'map-menu-button '+(layers?'active':'')} onClick={()=>{props.onLayersOpen();setLayers(!layers);setFindOpen(false);}} aria-expanded={layers}><Layers size={15}/>Capas<ChevronDown size={13}/></button>{layers&&<div className="map-dropdown"><span className="eyebrow">CAPAS VISIBLES</span><button onClick={()=>setStationsVisible(!stationsVisible)}><span className={'checkbox '+(stationsVisible?'checked':'')}>{stationsVisible&&<Check size={11}/>}</span>Estaciones de medición</button><small>Las nueve redes de medición (IDIGER, Acueducto, CAR, IDEAM, SDA, SGC, Aerocivil, particulares y ciencia ciudadana), dentro del territorio y a menos de 600 m.</small>{props.hazard==='landslide'&&<button onClick={()=>setInventoryVisible(!inventoryVisible)}><span className={'checkbox '+(inventoryVisible?'checked':'')}>{inventoryVisible&&<Check size={11}/>}</span>Inventario IDIGER 2016</button>}<button onClick={()=>setDemVisible(!demVisible)}><span className={'checkbox '+(demVisible?'checked':'')}>{demVisible&&<Check size={11}/>}</span>Modelo digital de elevación</button><small>Relieve sombreado sin imagen satelital · Terrain Tiles (AWS / Mapzen), a partir de SRTM y otras fuentes, 10-30 m.</small></div>}</div>;const slot=topSlot;return slot?createPortal(capas,slot):capas;})()}
 <div className="map-camera-tools v3-camera"><div className="cam-rotate"><button aria-label="Girar a la izquierda" title="Girar a la izquierda" onClick={()=>rotate(-22.5)}><RotateCcw size={17}/></button><button aria-label="Girar a la derecha" title="Girar a la derecha" onClick={()=>rotate(22.5)}><RotateCw size={17}/></button></div><input aria-label="Inclinación de la vista" type="range" min="0" max="78" value={pitch} onChange={e=>{setPitch(Number(e.target.value));mapRef.current?.jumpTo({pitch:Number(e.target.value)});}}/><span/><button className="cam-north" aria-label="Restablecer norte" title="Restablecer norte" onClick={()=>mapRef.current?.easeTo({bearing:0,duration:600})}><Navigation2 size={18} style={{transform:`rotate(${-bearing}deg)`}}/><small>N</small></button><button className="cam-dim" aria-label={dim==='3d'?'Pasar a vista 2D':'Pasar a vista 3D'} title="Vista 2D / 3D" onClick={switchDim}><b className={dim==='2d'?'on':''}>2D</b><b className={dim==='3d'?'on':''}>3D</b></button></div>
 <div className="map-gesture-hint">Botón derecho: girar · Trackpad: zoom</div>
 {/* Plus de barre « Buscar cuenca » : « Simular un evento » se déplie sur la liste des zones, puis porte le nom de la zone choisie. */}
 {<div className={'map-left-stack'+(props.territoryPanel?' has-territory':'')}><div className={'map-search-disclosure sim-capsule'+(findOpen||props.territory?' open':'')+(props.territory?' has-territory':'')}>
  <button className="map-simulate sim-head" onClick={()=>{if(props.territory)return;setFindOpen(!findOpen);setLayers(false);}} aria-expanded={!!props.territory||findOpen}><Play size={13}/>Simular un evento{!props.territory&&<ChevronDown size={14} className="sim-chev"/>}</button>
  <div className="map-search-fold" aria-hidden={!findOpen&&!props.territory}><div className="map-search-inner">{props.territory?<div className="sim-zone"><strong>{props.territory.name}</strong><button className="map-clear-territory" aria-label="Volver a las cuencas" title={'Volver a '+(props.hazard==='landslide'?'los sectores':'las cuencas')} onClick={()=>{setFindOpen(true);props.onClearTerritory?.();}}><X size={14}/></button></div>
   :<div className="sim-pick"><p className="sim-pick-title"><MousePointerClick size={13}/>Haz clic sobre {props.hazard==='landslide'?'un sector':'una cuenca'} o elígela aquí</p><div className="map-search-list">{territories.filter(t=>t.hazard===props.hazard).map(t=><button key={t.id} tabIndex={findOpen?0:-1} onClick={()=>props.onSelect(t)} onMouseEnter={()=>previewZone(t.id)} onFocus={()=>previewZone(t.id)} onMouseLeave={()=>previewZone(null)} onBlur={()=>previewZone(null)}>{t.name}</button>)}</div></div>}</div></div>
  <div className={'map-territory-fold'+(props.territoryPanel?' open':'')}><div className="map-search-inner"><div className="map-panel-swap" key={props.panelKey}>{props.territoryPanel}</div></div></div></div></div>}
 {props.result&&<div className="map-mini-legend">{props.result?<><span><i className="dot red"/>Daño alto</span><span><i className="dot yellow"/>Medio</span><span><i className="dot green"/>Sin afectación</span></>:<><span><i className="legend-outline"/>{props.hazard==='landslide'?'Inventario 2016 / sectores':'Delimitación EAAB'}</span>{props.territory&&stationsVisible&&legendNets.map(n=><span key={n}><i className="dot" style={{background:NET_COLOR[n]}}/>{n}</span>)}{!props.territory&&props.hazard==='torrential'&&<span><i className="legend-dash"/>Tramo inferido hasta el río</span>}</>}</div>}
 </>}
 <div className="map-attribution"><Satellite size={10}/><a href="https://www.arcgis.com/home/item.html?id=10df2279f9684e4a9f6a7f08febac2a9" target="_blank" rel="noreferrer">Imágenes © Esri, Maxar, Earthstar Geographics</a>{!props.home&&<span> · Hidrografía © EAAB · Huellas: UDFJC/Catastro</span>}</div></div>;
}
