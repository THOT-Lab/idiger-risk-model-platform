import json,sys
from shapely.geometry import shape,box,mapping
from shapely.ops import unary_union
d=json.load(open(sys.argv[1]))
B=box(-112,-36,-28,32)
land=unary_union([shape(f['geometry']) for f in d['features']]).intersection(B).simplify(.03)
ocean=B.difference(land).buffer(0)
json.dump({'type':'FeatureCollection','features':[{'type':'Feature','properties':{'source':'Natural Earth 1:50m (dominio público)'},'geometry':mapping(ocean)}]},open(sys.argv[2],'w'),separators=(',',':'))
