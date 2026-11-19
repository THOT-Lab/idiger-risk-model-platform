"""Réseau hydrographique de chaque quebrada torrentielle, de la crête jusqu'à sa confluence avec le grand río.

Sortie : public/data/torrential-network.geojson
- kind=mapped   : tronçons EAAB de la microcuenca (même CODMCUE que le territoire), tels quels.
- kind=inferred : tronçon reconstitué entre la fin du réseau cartographié et la sortie du bassin,
                  là où la quebrada est canalisée ou absente de la cartographie EAAB (souvent en ville).
                  Chemin de moindre coût dans le polygone du bassin, qui suit son axe et descend la pente (DEM Terrarium z13).
- kind=outlet   : point de confluence (point le plus bas du contour du bassin) = fin du tramo torrencial.
- kind=crest    : point le plus haut du bassin.

Usage : python3 scripts/import_v3_torrential_network.py   (Python avec numpy, scipy, scikit-image, Pillow)
"""
import io
import json
import math
import pathlib
import subprocess

import numpy as np
from PIL import Image
from scipy import ndimage
from skimage.draw import polygon as fill_polygon
from skimage.graph import MCP_Geometric

ROOT = pathlib.Path(__file__).resolve().parent.parent
CACHE = ROOT / 'scripts' / '.cache' / 'terrarium13'
Z = 13
STEP = 0.00014  # ≈ 15 m
M_PER_DEG = 111_320


def tile_xy(lon, lat):
    n = 2 ** Z
    x = (lon + 180) / 360 * n
    y = (1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n
    return x, y


def tile(tx, ty):
    CACHE.mkdir(parents=True, exist_ok=True)
    path = CACHE / f'{tx}_{ty}.png'
    if not path.exists():
        data = subprocess.run(['curl', '-sf', '--max-time', '40', f'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{Z}/{tx}/{ty}.png'], check=True, capture_output=True).stdout
        path.write_bytes(data)
    a = np.asarray(Image.open(io.BytesIO(path.read_bytes())).convert('RGB')).astype(np.float64)
    return a[..., 0] * 256 + a[..., 1] + a[..., 2] / 256 - 32768


_tiles = {}


def elevation(lons, lats):
    x, y = tile_xy(lons, lats) if np.isscalar(lons) else np.vectorize(tile_xy)(lons, lats)
    x, y = np.asarray(x), np.asarray(y)
    out = np.zeros(x.shape)
    tx, ty = np.floor(x).astype(int), np.floor(y).astype(int)
    for key in set(zip(tx.ravel(), ty.ravel())):
        if key not in _tiles:
            _tiles[key] = tile(*key)
        sel = (tx == key[0]) & (ty == key[1])
        px = np.clip(((x[sel] - key[0]) * 256).astype(int), 0, 255)
        py = np.clip(((y[sel] - key[1]) * 256).astype(int), 0, 255)
        out[sel] = _tiles[key][py, px]
    return out


def lines_of(f):
    g = f['geometry']
    return [g['coordinates']] if g['type'] == 'LineString' else g['coordinates']


def douglas(points, tol):
    if len(points) < 3:
        return points
    a, b = np.array(points[0]), np.array(points[-1])
    ab = b - a
    norm = np.hypot(*ab) or 1e-12
    d = [abs(ab[0] * (p[1] - a[1]) - ab[1] * (p[0] - a[0])) / norm for p in points[1:-1]]
    i = int(np.argmax(d)) + 1
    if d[i - 1] > tol:
        return douglas(points[:i + 1], tol)[:-1] + douglas(points[i:], tol)
    return [points[0], points[-1]]


def main():
    territories = json.loads((ROOT / 'src/data/geography.json').read_text())
    hydro = json.loads((ROOT / 'public/data/hydrography.geojson').read_text())
    features = []
    for t in [t for t in territories if t['hazard'] == 'torrential']:
        code = t['hydroCode']
        own = [f for f in hydro['features'] if f['properties']['CODMCUE'] == code]
        x0, y0, x1, y1 = t['bounds']
        x0 -= .004; y0 -= .004; x1 += .004; y1 += .004
        nx, ny = int((x1 - x0) / STEP) + 1, int((y1 - y0) / STEP) + 1
        lon = x0 + np.arange(nx) * STEP
        lat = y1 - np.arange(ny) * STEP
        LON, LAT = np.meshgrid(lon, lat)
        ring = np.array(t['geometry']['coordinates'][0])
        rr, cc = fill_polygon((y1 - ring[:, 1]) / STEP, (ring[:, 0] - x0) / STEP, (ny, nx))
        mask = np.zeros((ny, nx), bool)
        mask[rr, cc] = True
        dem = ndimage.uniform_filter(elevation(LON, LAT), 3)
        inside = np.where(mask, dem, np.nan)
        border = mask & ~ndimage.binary_erosion(mask)
        oy, ox = np.unravel_index(np.nanargmin(np.where(border, dem, np.nan)), dem.shape)
        cy, cx = np.unravel_index(np.nanargmax(inside), dem.shape)
        outlet, crest = [float(lon[ox]), float(lat[oy])], [float(lon[cx]), float(lat[cy])]
        for f in own:
            for l in lines_of(f):
                features.append({'type': 'Feature', 'properties': {'territory': t['id'], 'kind': 'mapped', 'name': f['properties']['NOMBRE'], 'sector': f['properties']['SECTOR']}, 'geometry': {'type': 'LineString', 'coordinates': [[round(x, 6), round(y, 6)] for x, y in l]}})
        # Fin du réseau cartographié : l'extrémité la plus basse de sa composante principale
        # (tronçons reliés entre eux, à 20 m près), pour ne pas partir d'un bout de canal isolé en aval.
        segs = [l for f in own for l in lines_of(f)]
        parent = list(range(len(segs)))
        def find(i):
            while parent[i] != i:
                parent[i] = parent[parent[i]]; i = parent[i]
            return i
        tol = 20 / M_PER_DEG
        pts = [(i, c) for i, l in enumerate(segs) for c in l[::max(1, len(l) // 12)] + [l[-1]]]
        for a in range(len(pts)):
            for b in range(a + 1, len(pts)):
                if pts[a][0] != pts[b][0] and abs(pts[a][1][0] - pts[b][1][0]) < tol and abs(pts[a][1][1] - pts[b][1][1]) < tol:
                    parent[find(pts[a][0])] = find(pts[b][0])
        length = {}
        for i, l in enumerate(segs):
            length[find(i)] = length.get(find(i), 0) + sum(math.hypot(l[k + 1][0] - l[k][0], l[k + 1][1] - l[k][1]) for k in range(len(l) - 1))
        main_c = None  # composante choisie plus bas : celle qui monte le plus haut vers la crête
        # On descend de proche en proche : depuis l'extrémité la plus basse de la composante courante, on rejoint par le
        # chemin de moindre coût soit un tronçon cartographié plus bas d'une autre composante, soit la confluence.
        dist = ndimage.distance_transform_edt(mask) * STEP * M_PER_DEG
        rel = (dem - np.nanmin(inside)) / max(np.nanmax(inside) - np.nanmin(inside), 1)
        cost = np.where(mask, 1 + 5 * np.exp(-dist / 60) + 2 * rel, 1e4)
        cell = lambda c: (int(np.clip(round((y1 - c[1]) / STEP), 0, ny - 1)), int(np.clip(round((c[0] - x0) / STEP), 0, nx - 1)))
        comp_pts = {}
        for i, l in enumerate(segs):
            comp_pts.setdefault(find(i), []).extend(l)
        elev_of = lambda c: float(dem[cell(c)])
        if comp_pts:
            main_c = max(comp_pts, key=lambda k: (max(elev_of(c) for c in comp_pts[k][::3]), length[k]))
        inferred_m, current, visited = 0, main_c, set()
        while current is not None and current not in visited:
            visited.add(current)
            start = min(comp_pts[current], key=elev_of)
            gap = math.hypot((start[0] - outlet[0]) * M_PER_DEG * math.cos(math.radians(4.6)), (start[1] - outlet[1]) * M_PER_DEG)
            if gap <= 150:
                break
            mcp = MCP_Geometric(cost)
            cum, _ = mcp.find_costs([cell(start)])
            targets = [((oy, ox), None)] + [(cell(c), k) for k, cs in comp_pts.items() if k not in visited for c in cs if elev_of(c) < elev_of(start) - 3]
            target, nxt = min(targets, key=lambda tk: cum[tk[0]])
            path = mcp.traceback(target)
            pts = douglas([[float(lon[c]), float(lat[r])] for r, c in path], STEP * 1.2)
            if len(pts) > 1:
                features.append({'type': 'Feature', 'properties': {'territory': t['id'], 'kind': 'inferred', 'name': t['name'] + ' · tramo inferido'}, 'geometry': {'type': 'LineString', 'coordinates': [[round(x, 6), round(y, 6)] for x, y in pts]}})
                inferred_m += round(len(path) * STEP * M_PER_DEG)
            current = nxt
        features.append({'type': 'Feature', 'properties': {'territory': t['id'], 'kind': 'outlet', 'name': 'Confluencia con el ' + t['subtitle'], 'elevation': round(float(dem[oy, ox]))}, 'geometry': {'type': 'Point', 'coordinates': [round(outlet[0], 6), round(outlet[1], 6)]}})
        features.append({'type': 'Feature', 'properties': {'territory': t['id'], 'kind': 'crest', 'name': 'Parte alta de la cuenca', 'elevation': round(float(dem[cy, cx]))}, 'geometry': {'type': 'Point', 'coordinates': [round(crest[0], 6), round(crest[1], 6)]}})
        print(f"{t['id']:14} tronçons={len(own):3}  crête={dem[cy, cx]:.0f} m  confluence={dem[oy, ox]:.0f} m  tronçon inféré≈{inferred_m} m")
    out = {'type': 'FeatureCollection', 'source': 'EAAB red hídrica por microcuenca + tramo inferido (DEM Terrarium z13)', 'features': features}
    (ROOT / 'public/data/torrential-network.geojson').write_text(json.dumps(out, ensure_ascii=False, separators=(',', ':')))


if __name__ == '__main__':
    main()
