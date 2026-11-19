import json,sys
from shapely.geometry import MultiPoint,shape,mapping
from shapely import concave_hull
d=json.load(open(sys.argv[1]))
pts=[]
for f in d['features']:
  if f['properties'].get('SECTOR')!='URBANO':continue
  g=shape(f['geometry'])
  for part in getattr(g,'geoms',[g]):
    pts+=list(part.coords)
print(len(pts))
h=concave_hull(MultiPoint(pts),ratio=float(sys.argv[3]))
h=h.buffer(.014).buffer(-.012).simplify(.0008)
if h.geom_type!='Polygon':h=max(h.geoms,key=lambda g:g.area)
print(h.area, h.bounds, len(h.exterior.coords))
json.dump({'type':'FeatureCollection','features':[{'type':'Feature','properties':{'name':'Franja urbana (aprox.)','source':'Envolvente de la red de drenaje urbana EAAB'},'geometry':{'type':'LineString','coordinates':[[round(x,5),round(y,5)] for x,y in h.exterior.coords]}}]},open(sys.argv[2],'w'))
