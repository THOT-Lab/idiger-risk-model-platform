from import_v2_geography import ROOT,CACHE,OUT,fetch,write,project,unproject
import json,concurrent.futures,math,sys,hashlib
from shapely.geometry import shape,mapping,Point,box
from shapely.ops import transform,unary_union,nearest_points
from pathlib import Path
# Footprints are a public university-hosted 2022 copy, not the current cadastral register.
URL='https://services.arcgis.com/deQSb0Gn7gDPf3uV/arcgis/rest/services/Construcciones_Bogota_DC_vista/FeatureServer/0/query'
territories=json.loads((ROOT/'src/data/geography.json').read_text());(OUT/'buildings').mkdir(exist_ok=True)
def run(t):
 try:
  x,y=t['focus'];r=.014 if t['hazard']=='flood' else .007
  # Keep broad urban corridor footprints, then retain close river buffers.
  params={'where':'1=1','outFields':'FID,OBJECTID,CONNPISOS,CONALTURA','f':'geojson','outSR':4326,'geometry':f'{x-r},{y-r},{x+r},{y+r}','geometryType':'esriGeometryEnvelope','inSR':4326,'spatialRel':'esriSpatialRelIntersects','resultRecordCount':2000,'orderByFields':'FID'}
  if t['id']=='tunjuelo':
   from shapely.geometry.polygon import orient
   lines_query=unary_union([shape(f['geometry']) for f in t['waterways']['features']])
   corridor=transform(unproject,transform(project,lines_query).buffer(480)).intersection(box(x-r,y-r,x+r,y+r))
   polys=list(corridor.geoms) if corridor.geom_type=='MultiPolygon' else [corridor]
   rings=[]
   for poly in polys:
    poly=orient(poly,sign=-1);rings.append(list(poly.exterior.coords));rings.extend(list(r.coords) for r in poly.interiors)
   params['geometry']=json.dumps({'rings':rings,'spatialReference':{'wkid':4326}});params['geometryType']='esriGeometryPolygon'
  allfeatures=[]
  for off in range(0,24000 if t['id'] in ['salitre','bogota','tunjuelo'] else 8000,2000):
   d=fetch('buildings-'+t['id']+('-corridor' if t['id']=='tunjuelo' else '')+('-'+hashlib.md5(str(t['focus']).encode()).hexdigest()[:8] if t['id'] in ['salitre','bogota'] else '')+'-'+str(off),URL,params|{'resultOffset':off});allfeatures+=d.get('features',[])
   if len(d.get('features',[]))<2000:break
  lines=unary_union([shape(f['geometry']) for f in t['waterways']['features']])
  l=transform(project,lines) if not lines.is_empty else None
  origin=Point(*project(x,y));region=shape(t['geometry']);features=[]
  maxdist=480 if t['hazard']=='flood' else 240
  for f in allfeatures:
   if not f.get('geometry'):continue
   g=shape(f['geometry']);g=g.buffer(0);c=g.representative_point()
   if t['id']!='bogota' and not region.buffer(.00002).covers(c):continue
   gp=transform(project,g);cp=gp.representative_point();dist=l.distance(cp) if l else abs(cp.x-origin.x-0.12*(cp.y-origin.y))
   if t['hazard']!='landslide' and dist>maxdist:continue
   if gp.area<12 or gp.area>25000:continue
   floors=f['properties'].get('CONNPISOS');height=f['properties'].get('CONALTURA');height=height if height and 2<height<150 else max(3,min(45,(floors or 2)*3))
   features.append({'type':'Feature','id':f['properties']['FID'],'geometry':mapping(g.simplify(.000002)),'properties':{'sourceId':str(f['properties'].get('OBJECTID')),'height':height,'area':round(gp.area,1),'distanceToWater':round(dist,1),'footprintSource':'Catastro · copia UDFJC 2022'}})
  # Deterministic display cap; this remains a non-exhaustive spatial sample.
  if len(features)>4500:features=features[::math.ceil(len(features)/4500)]
  write(OUT/'buildings'/(t['id']+'.json'),{'type':'FeatureCollection','features':features})
  print(t['id'],len(allfeatures),'->',len(features),flush=True)
  return {'territory':t['id'],'count':len(features),'queryCenter':[x,y],'queryRadiusDegrees':r,'source':URL,'limited':len(allfeatures)>=8000}
 except Exception as e:print(t['id'],str(e),flush=True);return {'territory':t['id'],'error':str(e)}
selected=[t for t in territories if not sys.argv[1:] or t['id'] in sys.argv[1:]]
previous=json.loads((OUT/'building-provenance.json').read_text()) if (OUT/'building-provenance.json').exists() else []
with concurrent.futures.ThreadPoolExecutor(3) as pool:manifest=list(pool.map(run,selected))
manifest += [m for m in previous if m['territory'] not in [t['id'] for t in selected]]
write(OUT/'building-provenance.json',manifest)
