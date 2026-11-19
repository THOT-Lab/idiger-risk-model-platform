// Caractéristiques de chaque territoire (fiche de la quebrada) -> public/data/territory-stats.json
// · edificaciones : nombre de constructions du Catastro (Construcciones_Bogota_DC_vista) qui touchent le polygone
// · ríos : km de cours d'eau EAAB (hydrography.geojson) dans le polygone
// · vías : km de voies OpenStreetMap (highway=*) dans le polygone, via Overpass
// Usage : node scripts/import_v3_territory_stats.mjs
import fs from 'node:fs';
import pip from '@turf/boolean-point-in-polygon';
const ws = JSON.parse(fs.readFileSync('public/data/watersheds.geojson'));
const hydro = JSON.parse(fs.readFileSync('public/data/hydrography.geojson'));
const OUT = 'public/data/territory-stats.json';
const prev = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT)) : {};
const R = 6371.0088, rad = d => d * Math.PI / 180;
const dist = (a, b) => { const dl = rad(b[1] - a[1]), dg = rad(b[0] - a[0]); const h = Math.sin(dl / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dg / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };
// Longueur d'une ligne à l'intérieur du polygone (segments découpés à ~25 m, test du milieu).
function inside(coords, poly) { let km = 0; for (let i = 1; i < coords.length; i++) { const a = coords[i - 1], b = coords[i], d = dist(a, b), n = Math.max(1, Math.ceil(d / .025)); for (let k = 0; k < n; k++) { const t = (k + .5) / n; if (pip([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], poly)) km += d / n; } } return km; }
const lines = g => g.type === 'LineString' ? [g.coordinates] : g.type === 'MultiLineString' ? g.coordinates : [];
const bbox = g => { const c = (g.type === 'Polygon' ? [g.coordinates] : g.coordinates).flat(2); const xs = c.map(p => p[0]), ys = c.map(p => p[1]); return [Math.min(...ys), Math.min(...xs), Math.max(...ys), Math.max(...xs)]; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function buildings(g) {
  // Polygones simplifiés (≤ 400 sommets par anneau) : les grands bassins dépassent sinon la taille de requête du service.
  const rings = (g.type === 'Polygon' ? [g.coordinates] : g.coordinates).flat(1).map(r => { const k = Math.ceil(r.length / 400); return k > 1 ? [...r.filter((_, i) => i % k === 0), r[0]] : r; });
  const body = new URLSearchParams({ where: '1=1', geometry: JSON.stringify({ rings, spatialReference: { wkid: 4326 } }), geometryType: 'esriGeometryPolygon', inSR: '4326', spatialRel: 'esriSpatialRelIntersects', returnCountOnly: 'true', f: 'json' });
  const r = await fetch('https://services.arcgis.com/deQSb0Gn7gDPf3uV/arcgis/rest/services/Construcciones_Bogota_DC_vista/FeatureServer/0/query', { method: 'POST', body });
  const j = await r.json(); if (typeof j.count !== 'number') throw new Error(JSON.stringify(j).slice(0, 200)); return j.count;
}
// Repli pour les très grands bassins (le service refuse le polygone entier) : grille de rectangles ;
// chaque case compte ses constructions, pondérées par la part de la case qui tombe dans le bassin (estimation).
async function buildingsTiled(g) {
  const [s0, w0, n0, e0] = bbox(g), N = 12, dy = (n0 - s0) / N, dx = (e0 - w0) / N; let total = 0;
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const s = s0 + i * dy, w = w0 + j * dx; let inn = 0;
    for (let a = 0; a < 5; a++) for (let b = 0; b < 5; b++) if (pip([w + (b + .5) * dx / 5, s + (a + .5) * dy / 5], g)) inn++;
    if (!inn) continue;
    const body = new URLSearchParams({ where: '1=1', geometry: `${w},${s},${w + dx},${s + dy}`, geometryType: 'esriGeometryEnvelope', inSR: '4326', spatialRel: 'esriSpatialRelEnvelopeIntersects', returnCountOnly: 'true', f: 'json' });
    const j2 = await (await fetch('https://services.arcgis.com/deQSb0Gn7gDPf3uV/arcgis/rest/services/Construcciones_Bogota_DC_vista/FeatureServer/0/query', { method: 'POST', body })).json();
    total += (j2.count || 0) * inn / 25;
  }
  return Math.round(total);
}
async function roads(g) {
  const [s, w, n, e] = bbox(g);
  const q = `[out:json][timeout:90];way[highway][highway!~"^(proposed|construction|abandoned|razed)$"](${s},${w},${n},${e});out geom;`;
  for (let i = 0, wait = 5000; i < 6; i++, wait *= 2) {
    try { const r = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', headers: { 'User-Agent': 'idiger-risk-platform/1.0' }, body: new URLSearchParams({ data: q }) }); if (r.ok) { const j = await r.json(); return j.elements.reduce((km, el) => km + inside(el.geometry.map(p => [p.lon, p.lat]), g), 0); } } catch {}
    await sleep(wait);
  }
  return null;
}
const out = {};
for (const f of ws.features) {
  const { id, name } = f.properties, g = f.geometry, p = prev[id] || {};
  const rivers = hydro.features.reduce((km, h) => km + lines(h.geometry).reduce((k, c) => k + inside(c, g), 0), 0);
  let b = p.buildings ?? null, v = p.roadsKm ?? null;
  if (b == null) try { b = await buildings(g); } catch (e) { console.warn(id, 'edificaciones (grille)', e.message.slice(0, 60)); try { b = await buildingsTiled(g); p.estimated = true; } catch {} }
  if (v == null) { v = await roads(g); if (v != null) v = Math.round(v * 10) / 10; await sleep(1500); }
  out[id] = { ...(p.estimated ? { estimated: true } : {}), buildings: b, riversKm: Math.round(rivers * 10) / 10, roadsKm: v };
  console.log(name.padEnd(36), JSON.stringify(out[id]));
  fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
}
