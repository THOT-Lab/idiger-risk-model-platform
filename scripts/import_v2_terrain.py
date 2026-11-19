from pathlib import Path
import json,math,requests,io,concurrent.futures
import pymupdf
ROOT=Path(__file__).resolve().parents[1];out=ROOT/'public/data/terrain';out.mkdir(exist_ok=True);cache=ROOT/'docs/research/v2/dem';cache.mkdir(exist_ok=True)
def pixel(lon,lat,z=13):return (lon+180)/360*2**z*256,(1-math.asinh(math.tan(math.radians(lat)))/math.pi)/2*2**z*256
territories=json.loads((ROOT/'src/data/geography.json').read_text());tiles={}
def sample(lon,lat):
 px,py=pixel(lon,lat);tx,ty=int(px//256),int(py//256);key=(tx,ty)
 if key not in tiles:
  path=cache/f'13-{tx}-{ty}.png'
  if not path.exists():
   r=requests.get(f'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/13/{tx}/{ty}.png',timeout=25);r.raise_for_status();path.write_bytes(r.content)
  tiles[key]=pymupdf.Pixmap(str(path))
 p=tiles[key];x,y=int(px%256),int(py%256);rgb=p.pixel(x,y);return rgb[0]*256+rgb[1]+rgb[2]/256-32768
for t in territories:
 if t['hazard']!='landslide':continue
 x,y=t['focus'];bbox=[x-.0054,y-.0045,x+.0054,y+.0045];n=65;h=[]
 for j in range(n):
  for i in range(n):h.append(round(sample(bbox[0]+i/(n-1)*(bbox[2]-bbox[0]),bbox[3]-j/(n-1)*(bbox[3]-bbox[1])),1))
 (out/(t['id']+'.json')).write_text(json.dumps({'bounds':bbox,'size':n,'heights':h,'source':'Mapzen Terrain Tiles / AWS Terrarium, zoom 13. DEM regional, no MDT geotécnico.'},separators=(',',':')))
 print(t['id'],min(h),max(h),flush=True)
