"""Audit manifest of the geospatial/climate assets shipped with V2, no private documents."""
from pathlib import Path
import json,hashlib,datetime
ROOT=Path(__file__).resolve().parents[1];data=ROOT/'public/data'
files=[p for p in data.rglob('*') if p.is_file() and p.name!='provenance-v2.json']
manifest={'version':'V2','generatedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'scope':'Datos empaquetados para demostración. No certifica exactitud ni vigencia institucional.','sources':[
 {'id':'EAAB-MICRO/SUB/RED','endpoint':'https://acueducto.com.co/wassigue/arcgis/rest/services/EAAB/','consulted':'2026-11-15','rawCache':'docs/research/v2','coverage':'19 localidades del corpus, sin Sumapaz; ver geography-validation.json'},
 {'id':'EXP-HUELLAS','endpoint':'https://services.arcgis.com/deQSb0Gn7gDPf3uV/arcgis/rest/services/Construcciones_Bogota_DC_vista/FeatureServer/0/query','sourceVersion':'Copia pública UDFJC, agosto 2022','scope':'Muestras, no catastro exhaustivo; límites de consulta 8.000/24.000 registros y tope de visualización 4.500; incluye corredor receptor del río Bogotá fuera del drenaje directo.'},
 {'id':'CL-NORMALES','original':json.loads((data/'climate-normals.json').read_text())['sourceFile'],'sha256':json.loads((data/'climate-normals.json').read_text())['sha256'],'scope':'265 registros originales. El Dorado: códigos 21205790/21205791, continuidad por verificar.'},
 {'id':'S16','endpoint':'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png','scope':'Zoom 13, DEM regional; cinco recortes de 65×65 muestras. Sin propiedades de suelo inferidas.'}],
 'files':[{'path':str(p.relative_to(ROOT/'public')),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in sorted(files)]}
(data/'provenance-v2.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2));print(f'Manifest: {len(files)} files.')
