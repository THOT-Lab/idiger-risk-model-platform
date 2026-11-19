// Réseau hydrographique de chaque grande cuenca d'Inundaciones -> public/data/flood-network.geojson
// Tronçons EAAB (hydrography.geojson) découpés au polygone de la cuenca, même schéma que torrential-network.geojson
// (territory, kind:'mapped', name) pour réutiliser la surbrillance au survol.
import fs from 'node:fs';
import pip from '@turf/boolean-point-in-polygon';
const ws = JSON.parse(fs.readFileSync('public/data/watersheds.geojson'));
const hydro = JSON.parse(fs.readFileSync('public/data/hydrography.geojson'));
const lines = g => g.type === 'LineString' ? [g.coordinates] : g.type === 'MultiLineString' ? g.coordinates : [];
const features = [];
for (const w of ws.features.filter(f => f.properties.hazard === 'flood')) {
  let n = 0;
  for (const h of hydro.features) for (const c of lines(h.geometry)) {
    let run = [];
    const flush = () => { if (run.length > 1) { features.push({ type: 'Feature', properties: { territory: w.properties.id, kind: 'mapped', name: h.properties.NOMBRE || h.properties.name || '' }, geometry: { type: 'LineString', coordinates: run } }); n++; } run = []; };
    for (const p of c) { if (pip(p, w.geometry)) run.push(p); else flush(); }
    flush();
  }
  console.log(w.properties.name.padEnd(30), n, 'tramos');
}
fs.writeFileSync('public/data/flood-network.geojson', JSON.stringify({ type: 'FeatureCollection', features }));
