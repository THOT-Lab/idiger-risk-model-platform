"""Construit public/data/networks.json : les trois redes de medición (IDIGER, Acueducto/EAAB, CAR) pour la fenêtre « Datos ».

- IDIGER : catalogue du projet (public/data/stations.json) enrichi des séries disponibles déclarées dans
  2026ER13100_Datos.xlsx (précipitation, température de l'air, niveau, avec la date du premier dato válido).
- EAAB et CAR : Catálogo Nacional de Estaciones de l'IDEAM (datos.gov.co, jeu hp9r-jxuu), filtré sur
  l'emprise des 19 localités, stations actives. Les capteurs sont déduits de la catégorie IDEAM.

Usage : python3 scripts/import_v3_networks.py
"""
import datetime as dt
import json
import pathlib
import urllib.parse

ROOT = pathlib.Path(__file__).resolve().parent.parent
XLSX = pathlib.Path('/Users/laurentpacoud/Desktop/IDIGER/EXE/Datas Idiger/2026ER13100_Datos.xlsx')
CNE = 'https://www.datos.gov.co/resource/hp9r-jxuu.json'

BY_CATEGORY = {
    'Pluviométrica': ['Precipitación · pluviómetro de lectura diaria'],
    'Pluviográfica': ['Precipitación · pluviógrafo de registro continuo'],
    'Climatológica Ordinaria': ['Precipitación', 'Temperatura máxima y mínima', 'Humedad relativa'],
    'Climatológica Principal': ['Precipitación', 'Temperatura', 'Humedad relativa', 'Viento', 'Brillo solar / radiación', 'Evaporación'],
    'Limnimétrica': ['Nivel del río · lectura de mira'],
    'Limnigráfica': ['Nivel del río · registro continuo'],
    'HidroMeteorológica': ['Precipitación', 'Nivel del río', 'Temperatura'],
    'HidroMeteorologica': ['Precipitación', 'Nivel del río', 'Temperatura'],
    'Sinóptica Secundaria': ['Presión', 'Temperatura', 'Humedad relativa', 'Viento', 'Precipitación'],
    'Meteorológica Especial': ['Variables meteorológicas según su propósito'],
    'Radio Sonda': ['Perfil vertical de la atmósfera'],
}
IDIGER_TYPES = {'PM': 'Pluviométrica automática', 'CO': 'Climatológica', 'HMT': 'Hidrometeorológica', 'HMT - SIN PM': 'Hidrometeorológica sin pluviómetro'}


def bbox():
    g = json.loads((ROOT / 'public/data/localities.geojson').read_text())
    xs, ys = [], []
    for f in g['features']:
        geom = f['geometry']
        polys = geom['coordinates'] if geom['type'] == 'MultiPolygon' else [geom['coordinates']]
        for poly in polys:
            for x, y in poly[0]:
                xs.append(x); ys.append(y)
    return min(xs), min(ys), max(xs), max(ys)


def idiger_series():
    import openpyxl
    out = {}
    labels = {'Precipitación': 'Precipitación', 'Temperatura_Aire': 'Temperatura del aire', 'Nivel': 'Nivel del río'}
    wb = openpyxl.load_workbook(XLSX, read_only=True)
    for ws in wb.worksheets:
        for row in list(ws.iter_rows(values_only=True))[2:]:
            if not row[0] or not str(row[0]).strip().isdigit():
                continue
            since = row[2].strftime('%Y-%m-%d') if isinstance(row[2], dt.datetime) else None
            out.setdefault(str(int(row[0])), []).append({'variable': labels.get(ws.title, ws.title), 'since': since, 'step': '10, 5 o 1 min'})
    return out


def cne(entity_like):
    x0, y0, x1, y1 = bbox()
    where = f"upper(entidad) like '{entity_like}' and estado='Activa'"
    q = urllib.parse.urlencode({'$limit': 5000, '$where': where})
    # curl plutôt qu'urllib : le Python d'python.org n'a pas toujours les certificats du système.
    import subprocess
    rows = json.loads(subprocess.run(['curl', '-s', '--max-time', '120', f'{CNE}?{q}'], check=True, capture_output=True).stdout)
    seen = {}
    for r in rows:
        lon, lat = float(r['longitud']), float(r['latitud'])
        if not (x0 <= lon <= x1 and y0 <= lat <= y1):
            continue
        name = r['nombre'].rsplit('[', 1)[0].replace(' - AUT', '').strip(' -')
        seen[r['codigo']] = {
            'id': r['codigo'], 'name': name.title(), 'coordinates': [round(lon, 5), round(lat, 5)],
            'elevation': r.get('altitud'), 'category': r['categoria'], 'technology': r['tecnologia'],
            'status': r['estado'], 'installed': r.get('fecha_instalacion'), 'subzone': r.get('subzona_hidrografica'),
            'sensors': [{'variable': v} for v in BY_CATEGORY.get(r['categoria'], ['Según categoría IDEAM'])],
            'sensorsInferred': True,
        }
    # Le catalogue répète une même station sous plusieurs codes (avec ou sans zéros, par type de sonde) :
    # on regroupe les fiches au même endroit (à ~10 m près) en un seul site, capteurs fusionnés.
    sites = {}
    for st in seen.values():
        key = (round(st['coordinates'][0], 4), round(st['coordinates'][1], 4))
        if key not in sites:
            sites[key] = {**st, 'codes': [st['id']]}
            continue
        site = sites[key]
        site['codes'].append(st['id'])
        if st['category'] not in site['category']:
            site['category'] += ' + ' + st['category']
        names = {x['variable'] for x in site['sensors']}
        site['sensors'] += [x for x in st['sensors'] if x['variable'] not in names]
        if 'Telemetría' in st['technology'] and 'Telemetría' not in site['technology']:
            site['technology'] = st['technology']
    return sorted(sites.values(), key=lambda s: s['name'])


def fetch_json(url):
    import subprocess
    return json.loads(subprocess.run(['curl', '-sL', '--max-time', '90', url], check=True, capture_output=True).stdout)


def rmcab():
    out = []
    for st in fetch_json('http://rmcab.ambientebogota.gov.co/ajax/getAllStations/'):
        if not st.get('display', True):
            continue
        mons = [m.get('Name') or m.get('name') for m in (st.get('monitors') or [])]
        out.append({'id': f"RMCAB-{st['serialCode']}", 'name': st['name'], 'coordinates': [round(float(st['longitude']), 5), round(float(st['latitude']), 5)], 'elevation': st.get('height'),
                    'category': 'Estación de calidad del aire', 'technology': 'Automática con telemetría', 'status': 'Activa', 'installed': None, 'subzone': (st.get('location') or '').strip(),
                    'sensors': [{'variable': m} for m in mons if m], 'sensorsInferred': False})
    return sorted(out, key=lambda s: s['name'])


def sgc():
    import subprocess
    x0, y0, x1, y1 = bbox()
    txt = subprocess.run(['curl', '-s', '--max-time', '60', f'http://sismo.sgc.gov.co:8080/fdsnws/station/1/query?minlatitude={y0}&maxlatitude={y1}&minlongitude={x0}&maxlongitude={x1}&level=station&format=text'], check=True, capture_output=True, text=True).stdout
    out = []
    for line in txt.splitlines()[1:]:
        net, sta, lat, lon, elev, site, start, end = (line.split('|') + [''] * 8)[:8]
        if end.strip():
            continue
        out.append({'id': f'{net}.{sta}', 'name': site.split(',')[0], 'coordinates': [round(float(lon), 5), round(float(lat), 5)], 'elevation': elev, 'category': 'Estación sismológica', 'technology': 'Banda ancha con telemetría',
                    'status': 'Activa', 'installed': start[:10], 'subzone': site, 'sensors': [{'variable': 'Velocidad del suelo (sismómetro)'}, {'variable': 'Aceleración (acelerógrafo)'}], 'sensorsInferred': True})
    return out


AERO = [
    {'id': 'SKBO', 'name': 'Aeropuerto El Dorado', 'coordinates': [-74.1469, 4.7016], 'elevation': '2548', 'category': 'Meteorológica aeronáutica (METAR)', 'technology': 'Automática', 'status': 'Activa', 'installed': None, 'subzone': 'Fontibón',
     'sensors': [{'variable': v} for v in ['Viento', 'Visibilidad', 'Nubosidad', 'Temperatura y punto de rocío', 'Presión (QNH)', 'Precipitación y fenómenos']], 'sensorsInferred': True},
    {'id': 'SKGY', 'name': 'Aeródromo de Guaymaral', 'coordinates': [-74.0649, 4.8123], 'elevation': '2560', 'category': 'Meteorológica aeronáutica (METAR)', 'technology': 'Automática', 'status': 'Activa', 'installed': None, 'subzone': 'Suba',
     'sensors': [{'variable': v} for v in ['Viento', 'Visibilidad', 'Temperatura', 'Presión (QNH)']], 'sensorsInferred': True},
]


def opensensemap():
    x0, y0, x1, y1 = bbox()
    out = []
    for b in fetch_json(f'https://api.opensensemap.org/boxes?bbox={x0},{y0},{x1},{y1}'):
        lon, lat = b['currentLocation']['coordinates'][:2]
        out.append({'id': b['_id'], 'name': b['name'], 'coordinates': [round(lon, 5), round(lat, 5)], 'elevation': None, 'category': 'Sensor ciudadano', 'technology': 'Bajo costo, en línea', 'status': 'Activa' if b.get('lastMeasurementAt') else 'Sin datos recientes',
                    'installed': (b.get('createdAt') or '')[:10], 'subzone': 'openSenseMap', 'sensors': [{'variable': s['title']} for s in b.get('sensors', [])], 'sensorsInferred': False})
    return out


def main():
    series = idiger_series()
    idiger = []
    for s in json.loads((ROOT / 'public/data/stations.json').read_text()):
        sensors = series.get(str(int(s['id'])), []) if s['id'].isdigit() else []
        idiger.append({'id': s['id'], 'name': s['name'], 'coordinates': s['coordinates'], 'elevation': s.get('elevation'),
                       'category': IDIGER_TYPES.get(s['type'], s['type']), 'technology': 'Automática con telemetría',
                       'status': s['catalogStatus'], 'installed': s.get('installed'), 'locality': s.get('locality'),
                       'sensors': sensors, 'sensorsInferred': False})
    CNE_SRC = 'IDEAM · Catálogo Nacional de Estaciones (datos.gov.co, hp9r-jxuu) · estaciones activas en Bogotá y alrededores'
    out = {
        'generated': dt.date.today().isoformat(),
        'networks': {
            'idiger': {'name': 'IDIGER', 'full': 'Red Hidrometeorológica de Bogotá (RHB)', 'owner': 'IDIGER', 'theme': 'Hidrometeorología', 'source': 'Catálogo RHB IDIGER (2024) y radicado 2026ER13100 · series declaradas', 'openData': 'datos.gov.co · s54a-sgyg', 'stations': idiger},
            'eaab': {'name': 'Acueducto', 'full': 'Red hidrometeorológica de la EAAB-ESP', 'owner': 'Empresa de Acueducto y Alcantarillado de Bogotá', 'theme': 'Hidrometeorología', 'source': CNE_SRC, 'openData': None, 'stations': cne('EMPRESA DE ACUEDUCTO%')},
            'car': {'name': 'CAR', 'full': 'Red hidrometeorológica de la CAR', 'owner': 'Corporación Autónoma Regional de Cundinamarca', 'theme': 'Hidrometeorología', 'source': CNE_SRC, 'openData': 'datosgeograficos.car.gov.co', 'stations': cne('CORPORACION AUTONOMA REGIONAL DE CUNDINAMARCA%')},
            'ideam': {'name': 'IDEAM', 'full': 'Red nacional del IDEAM', 'owner': 'Instituto de Hidrología, Meteorología y Estudios Ambientales', 'theme': 'Hidrometeorología', 'source': CNE_SRC, 'openData': 'datos.gov.co · DHIME', 'stations': cne('INSTITUTO DE HIDROLOG%')},
            'rmcab': {'name': 'SDA · aire', 'full': 'Red de Monitoreo de Calidad del Aire de Bogotá (RMCAB)', 'owner': 'Secretaría Distrital de Ambiente', 'theme': 'Calidad del aire', 'source': 'RMCAB · rmcab.ambientebogota.gov.co (catálogo de estaciones y monitores)', 'openData': 'rmcab.ambientebogota.gov.co', 'stations': rmcab()},
            'sgc': {'name': 'SGC', 'full': 'Red Sismológica Nacional', 'owner': 'Servicio Geológico Colombiano', 'theme': 'Sismología', 'source': 'SGC · servicio FDSN (sismo.sgc.gov.co) · estaciones activas', 'openData': 'sismo.sgc.gov.co', 'stations': sgc()},
            'particulares': {'name': 'Particulares', 'full': 'Estaciones particulares (universidades, colegios, empresas)', 'owner': 'Varios operadores privados', 'theme': 'Hidrometeorología', 'source': CNE_SRC, 'openData': None, 'stations': cne('ESTACIONES PARTICULARES%')},
            'aerocivil': {'name': 'Aerocivil', 'full': 'Estaciones meteorológicas aeronáuticas', 'owner': 'Aeronáutica Civil', 'theme': 'Meteorología aeronáutica', 'source': 'Ubicación deducida de los aeródromos (OACI SKBO, SKGY); observaciones METAR públicas', 'openData': 'METAR SKBO / SKGY', 'stations': AERO},
            'ciudadana': {'name': 'Ciencia ciudadana', 'full': 'Sensores ciudadanos y de bajo costo', 'owner': 'Particulares, ONG y cooperación (openSenseMap)', 'theme': 'Calidad del aire y clima', 'source': 'openSenseMap · API pública; otros sensores (CanAirIO, PurpleAir, estaciones personales) sin ubicación abierta', 'openData': 'opensensemap.org', 'stations': opensensemap()},
        },
        # Redes conocidas cuya ubicación no está publicada en datos abiertos : listées sans points sur la carte.
        'unmapped': [
            {'name': 'SDA · calidad hídrica', 'full': 'Red de Calidad Hídrica de Bogotá (RCHB)', 'owner': 'Secretaría Distrital de Ambiente', 'count': '30 puntos (red tradicional) + red ampliada', 'note': 'Puntos sobre Torca, Salitre, Fucha, Tunjuelo y río Bogotá; ubicación solo en los informes PDF del Observatorio Ambiental.'},
            {'name': 'SDA · microsensores', 'full': 'Red de microsensores de calidad del aire', 'owner': 'Secretaría Distrital de Ambiente', 'count': '20 microsensores', 'note': 'PM1, PM2.5 y PM10 en tiempo real; complementa la RMCAB. Ubicación no publicada en datos abiertos.'},
            {'name': 'IDIGER · acelerógrafos', 'full': 'Red de Acelerógrafos de Bogotá (RAB)', 'owner': 'IDIGER', 'count': '≈ 29 acelerógrafos', 'note': 'Registro de movimiento fuerte del suelo; coordenadas por solicitar a IDIGER.'},
            {'name': 'Rayos', 'full': 'Detección de descargas eléctricas', 'owner': 'Operadores privados y del sector eléctrico', 'count': 'Cobertura regional', 'note': 'Redes de detección de rayos; datos comerciales, sin ubicación pública de sensores. Deducido.'},
        ],
    }
    (ROOT / 'public/data/networks.json').write_text(json.dumps(out, ensure_ascii=False, separators=(',', ':')))
    for k, n in out['networks'].items():
        print(k, len(n['stations']))


if __name__ == '__main__':
    main()
