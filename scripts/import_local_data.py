"""Import read-only project sources; retain provenance and original feature IDs.
Run: .venv/bin/python scripts/import_local_data.py
Dependencies: pyshp, pyproj, shapely. No private source document is served by the app.
"""
from pathlib import Path
import csv,json,hashlib
import shapefile
from pyproj import CRS,Transformer
from shapely.geometry import shape,mapping
from shapely.ops import transform
ROOT=Path(__file__).resolve().parents[1]
BASE=Path('/Users/laurentpacoud/Desktop/IDIGER/EXE')
OUT=ROOT/'public/data';OUT.mkdir(exist_ok=True,parents=True)
manifest=[]
def save(name,data,source,note):
 text=json.dumps(data,ensure_ascii=False,separators=(',',':'),default=str)
 (OUT/name).write_text(text)
 manifest.append(dict(file=name,source=str(source.relative_to(BASE)),sha256=hashlib.sha256(source.read_bytes()).hexdigest(),note=note,imported='2026-11-15'))
 print(name,len(data.get('features',[])) if isinstance(data,dict) else len(data),len(text),'bytes')
p=BASE/'Datas Idiger/2026ER13100_Catalogo/Catalogo Estaciones Hidrome.csv'
rows=list(csv.reader(p.read_text(encoding='cp1252').splitlines(),delimiter=';'))
st=[]
for r in rows[1:]:
 if len(r)<10:continue
 try:
  lat=float(r[5].replace(',','.'));lon=float(r[6].replace(',','.'))
 except ValueError:continue
 if not (-74.6<lon<-73.5 and 3.5<lat<5.5):continue
 st.append(dict(id=r[4].strip() or 'catalog-'+r[0],name=r[3].strip().replace('Estación ',''),type=r[2].strip(),coordinates=[lon,lat],elevation=r[7],operator=r[8].strip(),locality=r[9].strip(),catalogStatus=r[10].strip(),installed=r[11].strip(),provenance='Catálogo RHB IDIGER · archivo del proyecto',live=False))
save('stations.json',st,p,'Coordenadas y códigos del catálogo recibido; estado histórico, NO telemetría en vivo. La fecha de actualización del CSV requiere confirmación.')
p=BASE/'Entregables/E2/Rapport Diana/Mallas_y_Datos/idf_eaab.csv'
rows=list(csv.DictReader(p.read_text().splitlines()))
idf=[dict(point=int(r['punto_id']),returnPeriod=int(r['tr_anios']),c1=float(r['C1']),x0=float(r['Xo']),c2=float(r['C2'])) for r in rows]
save('idf.json',idf,p,'Coeficientes del corpus E2 EAAB. Fórmula i=C1*(d+Xo)^C2; minutos y mm/h. Punto 0 de referencia, asignación territorial NO validada.')
for filename,encoding,out,keys in [('localidadsinsumapaz.shp','utf-8','localities.geojson',['LocNombre','LocCodigo']),('Inventario_PG.shp','latin1','landslide-inventory.geojson',['OBJECTID','COD_LOC','BARRIO','TIPO','NOMBRE','ESCALA','FECHA_ELAB'])]:
 p=next((BASE/'Entregables/E2').rglob(filename))
 reader=shapefile.Reader(str(p),encoding=encoding)
 transformer=Transformer.from_crs(CRS.from_wkt(p.with_suffix('.prj').read_text()),CRS.from_epsg(4326),always_xy=True)
 features=[]
 for sr in reader.iterShapeRecords():
  props=sr.record.as_dict(); geom=transform(transformer.transform,shape(sr.shape.__geo_interface__))
  if not geom.is_valid:geom=geom.buffer(0)
  geom=geom.simplify(.000035 if 'inventory' in out else .00012,preserve_topology=True)
  feat=dict(type='Feature',id=int(props.get('OBJECTID',len(features))),properties={k:props[k] for k in keys},geometry=mapping(geom))
  feat['properties']['source']='IDIGER · inventario 2016' if 'inventory' in out else 'IDECA · archivo del diagnóstico E2'
  features.append(feat)
 save(out,dict(type='FeatureCollection',features=features),p,'Inventario histórico; TIPO/NOMBRE conservados sin interpretar sus códigos. Transformación desde WKT original; validar precisión geodésica antes de uso operativo.' if 'inventory' in out else '19 localidades, Sumapaz excluido en el archivo original. No representa la extensión distrital completa.')
(OUT/'provenance.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
