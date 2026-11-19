"""Reproducible public EAAB hydrography, archived building footprints and local geology.
Only geospatial attributes are retained. Original queries cached under docs/research/v2.
"""
from pathlib import Path
import requests,json,urllib3,concurrent.futures,unicodedata,math,hashlib
from shapely.geometry import shape,mapping,box,Point,LineString
from shapely.ops import unary_union,transform,nearest_points
from pyproj import Transformer
ROOT=Path(__file__).resolve().parents[1];CACHE=ROOT/'docs/research/v2';OUT=ROOT/'public/data';OUT.mkdir(exist_ok=True)
urllib3.disable_warnings()
# EAAB's publicly readable endpoint has an incomplete TLS chain in this environment.
# Ingestion only: cached bytes are used locally; browsers do not disable TLS verification.
def fetch(name,url,params=None,verify=True):
 p=CACHE/(name+'.json')
 if p.exists():return json.loads(p.read_text())
 r=requests.post(url,data=params,timeout=55,verify=verify) if params and params.get('geometryType')=='esriGeometryPolygon' else requests.get(url,params=params,timeout=55,verify=verify);r.raise_for_status();d=r.json()
 if 'error' in d:raise RuntimeError(d['error'])
 p.write_text(json.dumps(d,ensure_ascii=False));return d

def write(path,data):path.write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')))
def slug(s):return ''.join(c for c in unicodedata.normalize('NFKD',s.lower()) if not unicodedata.combining(c)).replace(' ','-').replace('/','-')
project=Transformer.from_crs(4326,32618,always_xy=True).transform
unproject=Transformer.from_crs(32618,4326,always_xy=True).transform
ids=json.loads((CACHE/'stream-ids.json').read_text())['objectIds'];url='https://acueducto.com.co/wassigue/arcgis/rest/services/EAAB/corrienteagua/MapServer/0/query'
def chunk(i):return fetch(f'stream-part-{i}',url,{'objectIds':','.join(map(str,ids[i:i+400])),'f':'geojson','outSR':4326,'outFields':'OBJECTID,NOMBRE,TIPO,SECTOR,CODSCUE,SUBCUENCA,CODMCUE,MICROCUENCA,CODHIDRO'},False)['features']
with concurrent.futures.ThreadPoolExecutor(3) as pool:streams=[f for part in pool.map(chunk,range(0,len(ids),400)) for f in part]
for f in streams:f['geometry']=mapping(shape(f['geometry']).simplify(.000008));f['properties']['name']=f['properties'].get('NOMBRE') or 'Corriente sin nombre'
write(OUT/'hydrography.geojson',{'type':'FeatureCollection','features':streams})
print('Streams',len(streams),flush=True)
local=unary_union([shape(f['geometry']) for f in json.loads((OUT/'localities.geojson').read_text())['features']]);micro=json.loads((CACHE/'microcuenca.json').read_text())['features'];subs=json.loads((CACHE/'subcuencas.json').read_text())['features']
mainnames={212006:'tunjuelo',212020:'fucha',212021:'salitre',212022:'torca',212007:'bogota',212008:'teusaca'}
focuses={'chiguaza':[-74.107,4.554],'arzobispo':[-74.062,4.627],'delicias':[-74.054,4.645],'vieja':[-74.043,4.657],'yomasa':[-74.117,4.512],'limas':[-74.148,4.557],'tunjuelo':[-74.144,4.568],'fucha':[-74.125,4.612],'salitre':[-74.103,4.723],'torca':[-74.033,4.775],'bogota':[-74.209,4.636],'teusaca':[-74.006,4.636]}
shortids={21200612:'chiguaza',21202103:'arzobispo',21202104:'delicias',21202105:'vieja',21200611:'yomasa',21200602:'limas'}
territories=[]
def make(f,hazard):
 p=f['properties'];code=p['CODMC'] if hazard=='torrential' else p['CODSCH'];name=p['NOMBMC'] if hazard=='torrential' else p['NOMSCH'];id=shortids.get(code,'mc-'+str(code)) if hazard=='torrential' else mainnames.get(code,'sc-'+str(code));g=shape(f['geometry']).buffer(0)
 if hazard=='flood':g=g.intersection(local)
 if g.is_empty or g.area<.000004:return
 if g.geom_type=='GeometryCollection':g=unary_union([x for x in g.geoms if x.geom_type in ['Polygon','MultiPolygon']])
 relevant=[r for r in streams if str(r['properties'].get('CODMCUE' if hazard=='torrential' else 'CODSCUE'))==str(code)]
 target=name.lower().replace('río ','').replace('quebrada ','').replace('canal ','')
 priority=[r for r in relevant if target in (r['properties'].get('NOMBRE') or '').lower()]
 if id=='bogota':priority=[r for r in streams if (r['properties'].get('NOMBRE') or '').lower()=='río bogotá']
 if not priority:priority=sorted(relevant,key=lambda r:shape(r['geometry']).length,reverse=True)[:4]
 lines=unary_union([shape(r['geometry']) for r in priority]) if priority else g.boundary
 cent=g.representative_point();focus=nearest_points(lines,Point(focuses[id]))[0] if id in ['salitre','bogota'] else Point(focuses[id]) if id in focuses else nearest_points(lines,cent)[0]
 # Pick the urban downstream portion: nearest urban footprint concentration is selected later.
 bbox=list(g.bounds);g=g.simplify(.000035,preserve_topology=True)
 biggest=max(g.geoms,key=lambda x:x.area) if g.geom_type=='MultiPolygon' else g
 t={'id':id,'name':'Río Bogotá · drenaje directo' if id=='bogota' else name,'subtitle':p.get('NOMBSCH','Cuenca del río Bogotá'),'hazard':hazard,'center':[cent.x,cent.y],'focus':[focus.x,focus.y],'zoom':14.4 if hazard=='flood' else 15.1,'area':round(transform(project,g).area/1e6,2),'population':0,'description':'Geometría EAAB · código '+str(code),'polygon':list(biggest.exterior.coords),'geometry':mapping(g),'bounds':bbox,'river':list(max(list(lines.geoms),key=lambda x:x.length).coords) if lines.geom_type=='MultiLineString' else list(lines.coords) if lines.geom_type=='LineString' else [],'waterways':{'type':'FeatureCollection','features':priority},'hydroCode':str(code),'boundarySource':'EAAB','sourceIds':['EAAB-MICRO' if hazard=='torrential' else 'EAAB-SUB','EAAB-RED']}
 territories.append(t)
# All named mountain quebrada/river microcatchments available in the urban study window.
for f in micro:
 n=f['properties']['NOMBMC']
 if n.startswith('Quebrada') or n in ['Río Arzobispo','Río San Francisco','Río Palo Blanco']:make(f,'torrential')
for f in subs:
 if shape(f['geometry']).intersects(local):make(f,'flood')
# Slopes retain presentation sectors, explicitly separate from the historical inventory.
slopes=[('estancia','Altos de la Estancia',[-74.181,4.581]),('esperanza','Nueva Esperanza',[-74.107,4.546]),('codito','El Codito',[-74.018,4.763]),('cristobal','San Cristóbal oriental',[-74.071,4.557]),('paraiso','El Paraíso',[-74.160,4.548])]
for id,name,xy in slopes:
 g=box(xy[0]-.0045,xy[1]-.004,xy[0]+.0045,xy[1]+.004)
 territories.append({'id':id,'name':name,'subtitle':'Sector de ladera','hazard':'landslide','center':xy,'focus':xy,'zoom':15.4,'area':round(transform(project,g).area/1e6,2),'population':0,'description':'Sector de exploración · inventario histórico IDIGER disponible','polygon':list(g.exterior.coords),'geometry':mapping(g),'bounds':list(g.bounds),'river':[],'waterways':{'type':'FeatureCollection','features':[]},'boundarySource':'Sector de presentación','sourceIds':['S05','SGC-GEO','IGAC-SUELOS']})
# Keep main urban basins first; marginal rural catchments remain geographically represented.
order={'chiguaza':0,'tunjuelo':0,'fucha':1,'salitre':2,'torca':3,'bogota':4,'teusaca':5}
territories.sort(key=lambda t:(['torrential','flood','landslide'].index(t['hazard']),order.get(t['id'],20),t['name']))
write(ROOT/'src/data/geography.json',territories)
write(OUT/'watersheds.geojson',{'type':'FeatureCollection','features':[{'type':'Feature','id':t['id'],'geometry':t['geometry'],'properties':{k:t[k] for k in ['id','name','hazard','hydroCode','boundarySource'] if k in t}} for t in territories if t['hazard']!='landslide']})
coverage=unary_union([shape(t['geometry']) for t in territories if t['hazard']=='flood']);missing=local.difference(coverage)
report={'source':'EAAB services, geographic queries 2026-11-15','streams':len(streams),'microcatchments':sum(t['hazard']=='torrential' for t in territories),'floodCatchments':sum(t['hazard']=='flood' for t in territories),'coverageOf19LocalitiesPercent':round(100*(1-transform(project,missing).area/transform(project,local).area),5),'uncoveredAreaKm2':transform(project,missing).area/1e6,'scope':'19 localidades del corpus. Sumapaz no incluido. Diferencias de borde no se rellenan con geometrías inventadas.'}
write(OUT/'geography-validation.json',report);print(report,flush=True)
