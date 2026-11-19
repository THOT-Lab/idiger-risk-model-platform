"""Extract the original Bogotá station normals without averaging or filling missing values."""
from pathlib import Path
import csv,json,hashlib,unicodedata
ROOT=Path(__file__).resolve().parents[1]
BASE=ROOT.parent/'IDIGER/EXE/Entregables/E2/Rapport Diana/Descargas'
source=next(BASE.glob('Normales_Climatolo*gicas_de_Colombia_20260610.csv'))
def number(value):
 try:return float(value.replace(',','').strip())
 except (ValueError,AttributeError):return None
rows=[]
with source.open(encoding='utf-8-sig') as f:
 for r in csv.DictReader(f):
  municipality=''.join(c for c in unicodedata.normalize('NFKD',r['MUNICIPIO']) if not unicodedata.combining(c)).lower()
  if not municipality.startswith('bogota'):continue
  rows.append({'period':r['PERIODO'],'parameter':r['PARÁMETRO'],'code':r['CÓDIGO'].replace(',',''),'station':r['ESTACIÓN'],'coordinates':[number(r['LONGITUD']),number(r['LATITUD'])],'altitude':number(r['ALTITUD (m)']),'months':[number(r[m]) for m in ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC']],'annual':number(r['ANUAL'])})
output={'source':'IDEAM · Normales Climatológicas de Colombia · archivo del corpus E2','sourceFile':source.name,'sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'scope':'Municipio Bogotá. Estaciones, no promedios espaciales de localidad. Normales solapadas, no años independientes.','rows':rows}
previous=ROOT/'public/data/climate-normals.json'
if previous.exists():
 old=json.loads(previous.read_text());assert old['rows']==rows,'Extraction differs from existing reviewed values; inspect before overwriting.'
assert len(rows)==265
previous.write_text(json.dumps(output,ensure_ascii=False,separators=(',',':')))
print(f'{len(rows)} station/variable/period records; original values preserved.')
