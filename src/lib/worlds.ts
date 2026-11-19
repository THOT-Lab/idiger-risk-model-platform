// « Mondes » de l'accueil : la carte se transforme au lieu d'ouvrir une fenêtre.
//  - data    : maillage filaire large du relief (lignes drapées sur le DEM), balayage lumineux, sans image satellite.
//  - climate : vue très éloignée (nord de l'Amérique du Sud) et flux d'air animés (vent réel Open-Meteo, sinon champ illustratif).
import * as maplibregl from 'maplibre-gl';
import type { FeatureCollection, LineString } from 'geojson';

export type World = 'data' | 'climate';
const HOME_VIEW = { center: [-74.055, 4.64] as [number, number], zoom: 11.75, pitch: 35, bearing: 0 };

// ---------- Maillage du relief ----------
const B = { x0: -74.28, y0: 4.36, x1: -73.95, y1: 4.87 } /* resserré sur la zone urbaine (rectangle allongé nord-sud) */, STEP = .0042; // ≈ 470 m : un seul maillage, fin et léger (Laurent)
const NY = Math.round((B.y1 - B.y0) / STEP), NX = Math.round((B.x1 - B.x0) / STEP);
function wireGrid(): FeatureCollection<LineString> {
  const features: FeatureCollection<LineString>['features'] = [];
  const line = (a: [number, number], b: [number, number], k: string, r: number, m: number) => features.push({ type: 'Feature', properties: { k, r, m }, geometry: { type: 'LineString', coordinates: [a, b] } });
  for (let j = 0; j <= NY; j++) { const y = B.y0 + j * STEP; line([B.x0, y], [B.x1, y], 'h', j, j % 5 === 0 ? 1 : 0); }
  for (let i = 0; i <= NX; i++) { const x = B.x0 + i * STEP; line([x, B.y0], [x, B.y1], 'v', i, i % 5 === 0 ? 1 : 0); }
  // Diagonales : on passe d'une grille à un maillage triangulé.
  for (let d = -NY; d <= NX; d++) { const j0 = Math.max(0, -d), j1 = Math.min(NY, NX - d); if (j1 <= j0) continue; line([B.x0 + (d + j0) * STEP, B.y0 + j0 * STEP], [B.x0 + (d + j1) * STEP, B.y0 + j1 * STEP], 'd', 0, 0); }
  return { type: 'FeatureCollection', features };
}
const WIRE_LAYERS = ['wire-minor', 'wire-scan', 'wire-localities', 'wire-fringe-glow', 'wire-fringe', 'wire-ray', 'wire-lights-glow', 'wire-lights'];
const NET_COLORS: Record<string, string> = { idiger: '#9ee3cc', eaab: '#71c7f5', car: '#e8c47d', ideam: '#c3a6f2', rmcab: '#f29bc1', sgc: '#f4876f', particulares: '#ffe08a', aerocivil: '#ffffff', ciudadana: '#b8f28a' };
function ensureWire(map: maplibregl.Map) {
  if (map.getSource('wire')) return;
  map.addSource('wire', { type: 'geojson', data: wireGrid() });
  map.addSource('wire-loc', { type: 'geojson', data: import.meta.env.BASE_URL+'data/localities.geojson' });
  const hidden = { visibility: 'none' as const };
  map.addLayer({ id: 'wire-diag', type: 'line', source: 'wire', filter: ['==', ['get', 'k'], 'd'], layout: hidden, paint: { 'line-color': '#3fb6a8', 'line-width': .5, 'line-opacity': 0 } });
  map.addLayer({ id: 'wire-minor', type: 'line', source: 'wire', filter: ['!=', ['get', 'k'], 'd'], layout: hidden, paint: { 'line-color': '#4fd0bf', 'line-width': .55, 'line-opacity': 0 } });
  map.addLayer({ id: 'wire-major', type: 'line', source: 'wire', filter: ['==', ['get', 'm'], 1], layout: hidden, paint: { 'line-color': '#9af3e2', 'line-width': 1.15, 'line-opacity': 0 } });
  map.addLayer({ id: 'wire-localities', type: 'line', source: 'wire-loc', layout: hidden, paint: { 'line-color': '#e8c47d', 'line-width': 1, 'line-dasharray': [2, 2], 'line-opacity': 0 } });
  // Franges urbaines : anneau vert + rayon lumineux qui le parcourt (enveloppe du drainage urbain EAAB).
  map.addSource('wire-fringe', { type: 'geojson', data: import.meta.env.BASE_URL+'data/urban-fringe.geojson', lineMetrics: true });
  map.addLayer({ id: 'wire-fringe-glow', type: 'line', source: 'wire-fringe', layout: { ...hidden, 'line-join': 'round' }, paint: { 'line-color': '#5be39a', 'line-width': 7, 'line-blur': 5, 'line-opacity': 0 } });
  map.addLayer({ id: 'wire-fringe', type: 'line', source: 'wire-fringe', layout: { ...hidden, 'line-join': 'round' }, paint: { 'line-color': '#7af0b0', 'line-width': 1.6, 'line-opacity': 0 } });
  map.addLayer({ id: 'wire-ray', type: 'line', source: 'wire-fringe', layout: { ...hidden, 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-width': 4, 'line-blur': 1.5, 'line-gradient': ['interpolate', ['linear'], ['line-progress'], 0, 'rgba(0,0,0,0)', 1, 'rgba(0,0,0,0)'] } });
  // Petites lumières : les stations de mesure, qui s'allument et s'éteignent chacune à son rythme.
  map.addSource('wire-lights', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  fetch(import.meta.env.BASE_URL+'data/networks.json').then(r => r.json()).then(d => { const feats = Object.entries(d.networks as Record<string, { stations: { coordinates: [number, number] }[] }>).flatMap(([k, n]) => n.stations.filter(s => s.coordinates[0] > B.x0 && s.coordinates[0] < B.x1 && s.coordinates[1] > B.y0 && s.coordinates[1] < B.y1).map(s => ({ type: 'Feature' as const, properties: { c: NET_COLORS[k] || '#ffffff', ph: Math.random() * 6.28, sp: .6 + Math.random() * 1.2 }, geometry: { type: 'Point' as const, coordinates: s.coordinates } }))); (map.getSource('wire-lights') as maplibregl.GeoJSONSource | undefined)?.setData({ type: 'FeatureCollection', features: feats }); }).catch(() => {});
  const blink = (t: number, k: number): maplibregl.ExpressionSpecification => ['*', k, ['max', 0, ['sin', ['+', ['*', t, ['get', 'sp']], ['get', 'ph']]]]];
  map.addLayer({ id: 'wire-lights-glow', type: 'circle', source: 'wire-lights', layout: hidden, paint: { 'circle-radius': 9, 'circle-blur': 1, 'circle-color': ['get', 'c'], 'circle-opacity': blink(0, .45), 'circle-pitch-alignment': 'map' } });
  map.addLayer({ id: 'wire-lights', type: 'circle', source: 'wire-lights', layout: hidden, paint: { 'circle-radius': 2.6, 'circle-color': ['get', 'c'], 'circle-opacity': blink(0, 1), 'circle-pitch-alignment': 'map' } });
  map.addLayer({ id: 'wire-scan', type: 'line', source: 'wire', filter: ['==', ['get', 'k'], 'h'], layout: hidden, paint: { 'line-color': '#d4fff6', 'line-width': 2.4, 'line-blur': 1.2, 'line-opacity': 0 } });
}
const WIRE_OPACITY: Record<string, number> = { 'wire-minor': .3, 'wire-localities': .45, 'wire-fringe-glow': .45, 'wire-fringe': .9 };

// Mémorise une propriété de peinture pour la remettre exactement à la sortie du monde.
function paintSaver(map: maplibregl.Map) {
  const saved: [string, string, unknown][] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const m = map as any;
  return {
    set(layer: string, prop: string, value: unknown) { if (!map.getLayer(layer)) return; saved.push([layer, prop, m.getPaintProperty(layer, prop)]); m.setPaintProperty(layer, prop, value); },
    restore() { for (const [l, p, v] of saved.reverse()) if (map.getLayer(l)) m.setPaintProperty(l, p, v ?? undefined); }
  };
}

function enterData(map: maplibregl.Map, info: (s: string) => void) {
  ensureWire(map);
  const paint = paintSaver(map);
  for (const id of ['satellite', 'fallback']) { paint.set(id, 'raster-opacity-transition', { duration: 1400, delay: 0 }); paint.set(id, 'raster-opacity', 0); }
  paint.set('background', 'background-color', '#040b10');
  if (map.getLayer('dem-preload')) { paint.set('dem-preload', 'hillshade-exaggeration', .55); paint.set('dem-preload', 'hillshade-shadow-color', '#01070b'); paint.set('dem-preload', 'hillshade-highlight-color', '#1d4a4a'); paint.set('dem-preload', 'hillshade-accent-color', '#0a2328'); }
  for (const id of WIRE_LAYERS) { map.setLayoutProperty(id, 'visibility', 'visible'); if (WIRE_OPACITY[id] != null) { map.setPaintProperty(id, 'line-opacity-transition', { duration: 1800, delay: 500 }); map.setPaintProperty(id, 'line-opacity', WIRE_OPACITY[id]); } }
  map.setTerrain({ source: 'dem', exaggeration: 1.7 });
  info('Malla del relieve · Terrain Tiles (AWS / Mapzen) · paso ≈ 470 m · exageración vertical ×1,7');
  for (const h of [map.dragRotate, map.dragPan, map.scrollZoom, map.touchZoomRotate]) h.enable();
  // Balayage : une bande claire remonte le maillage du sud au nord.
  // + rayon qui parcourt l'anneau, + clignotement des lumières (une seule horloge).
  let k = -12, ray = 0, t = 0; const scan = window.setInterval(() => {
    k += .8; if (k > NY + 12) k = -12; t += .09; ray = (ray + .0035) % 1;
    if (!map.getLayer('wire-scan')) return;
    map.setPaintProperty('wire-scan', 'line-opacity', ['max', 0, ['*', .85, ['-', 1, ['/', ['abs', ['-', ['get', 'r'], k]], 3.5]]]]);
    const a = Math.max(.001, ray - .06), b = Math.max(a + .0005, ray), c = Math.min(.9995, b + .004);
    map.setPaintProperty('wire-ray', 'line-gradient', ['interpolate', ['linear'], ['line-progress'], 0, 'rgba(0,0,0,0)', a, 'rgba(122,240,176,0)', b, 'rgba(235,255,245,1)', c, 'rgba(122,240,176,0)', 1, 'rgba(0,0,0,0)']);
    map.setPaintProperty('wire-lights', 'circle-opacity', ['*', 1, ['max', .08, ['sin', ['+', ['*', t, ['get', 'sp']], ['get', 'ph']]]]]);
    map.setPaintProperty('wire-lights-glow', 'circle-opacity', ['*', .45, ['max', 0, ['sin', ['+', ['*', t, ['get', 'sp']], ['get', 'ph']]]]]);
  }, 90);
  // Même garde que pour les risques : attendre que le relief soit posé avant de plonger (sinon bande noire).
  let cancelled = false, n = 0;
  const go = () => { if (cancelled) return; map.easeTo({ center: [-74.1, 4.64], zoom: 10.75, pitch: 62, bearing: 138, /* depuis le nord-ouest, vers le centre */ padding: { left: window.innerWidth > 900 ? 340 : 0, right: 0, top: 0, bottom: 0 }, duration: 2600, essential: false }); };
  const wait = () => { if (cancelled) return; const e = map.queryTerrainElevation(map.getCenter()); if ((e != null && e > 100) || ++n > 45) go(); else requestAnimationFrame(wait); };
  map.stop(); wait();
  return () => {
    cancelled = true; window.clearInterval(scan);
    for (const id of WIRE_LAYERS) if (map.getLayer(id)) { if (WIRE_OPACITY[id] != null) map.setPaintProperty(id, 'line-opacity', 0); map.setLayoutProperty(id, 'visibility', 'none'); }
    paint.restore(); map.setTerrain(null);
  };
}

// ---------- Flux d'air ----------
type Field = { lon0: number; lat0: number; step: number; nx: number; ny: number; u: Float32Array; v: Float32Array; live: boolean };
const F = { lon0: -98, lat1: 22, step: 3, nx: 18, ny: 14 }; // grille 3° : de -98 à -47 E, de 22 à -17 N
function syntheticField(): Field {
  const u = new Float32Array(F.nx * F.ny), v = new Float32Array(F.nx * F.ny);
  for (let j = 0; j < F.ny; j++) for (let i = 0; i < F.nx; i++) {
    const lat = F.lat1 - j * F.step, lon = F.lon0 + i * F.step, idx = j * F.nx + i;
    // Alizés d'est convergeant vers la ZCIT (~5°N), déviés par les Andes, jet du Chocó sur le Pacifique.
    const trade = -6 * Math.cos((lat - 5) / 22 * Math.PI / 2);
    u[idx] = trade + (lon < -78 && lat > 0 && lat < 8 ? 9 : 0) + 1.5 * Math.sin(lon / 6);
    v[idx] = -(lat - 5) * .35 + 1.8 * Math.cos(lon / 5 + lat / 7);
  }
  return { lon0: F.lon0, lat0: F.lat1, step: F.step, nx: F.nx, ny: F.ny, u, v, live: false };
}
async function liveField(signal: AbortSignal): Promise<Field> {
  const lats: number[] = [], lons: number[] = [];
  for (let j = 0; j < F.ny; j++) for (let i = 0; i < F.nx; i++) { lats.push(F.lat1 - j * F.step); lons.push(F.lon0 + i * F.step); }
  const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lats.join(',')}&longitude=${lons.join(',')}&current=wind_speed_10m,wind_direction_10m&wind_speed_unit=ms`, { signal });
  if (!r.ok) throw new Error('wind');
  const rows = await r.json() as { current: { wind_speed_10m: number; wind_direction_10m: number } }[];
  if (!Array.isArray(rows) || rows.length !== lats.length) throw new Error('wind');
  const u = new Float32Array(rows.length), v = new Float32Array(rows.length);
  rows.forEach((row, k) => { const s = row.current.wind_speed_10m, d = row.current.wind_direction_10m * Math.PI / 180; u[k] = -s * Math.sin(d); v[k] = -s * Math.cos(d); });
  return { lon0: F.lon0, lat0: F.lat1, step: F.step, nx: F.nx, ny: F.ny, u, v, live: true };
}
function sample(f: Field, lon: number, lat: number): [number, number] | null {
  const x = (lon - f.lon0) / f.step, y = (f.lat0 - lat) / f.step;
  if (x < 0 || y < 0 || x >= f.nx - 1 || y >= f.ny - 1) return null;
  const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j, a = j * f.nx + i, b = a + 1, c = a + f.nx, d = c + 1;
  const mix = (arr: Float32Array) => (arr[a] * (1 - fx) + arr[b] * fx) * (1 - fy) + (arr[c] * (1 - fx) + arr[d] * fx) * fy;
  return [mix(f.u), mix(f.v)];
}

function enterClimate(map: maplibregl.Map, info: (s: string) => void) {
  const paint = paintSaver(map);
  paint.set('satellite', 'raster-brightness-max', .5); paint.set('satellite', 'raster-saturation', -.55);
  paint.set('fallback', 'raster-opacity-transition', { duration: 800, delay: 0 }); paint.set('fallback', 'raster-opacity', 0);
  // Vue régionale oblique (pas de passage par la planète entière). Relief par ombrage seul : pas de relief 3D, donc pas de bathymétrie en creux sous les vents.
  const minZoom = map.getMinZoom(); map.setMinZoom(1.2); // la carte est bornée à z8 ailleurs
  try { map.setProjection({ type: 'globe' }); } catch { /* version sans globe */ }
  map.setTerrain(null);
  // Mer masquée (Natural Earth 1:50 m) : ni bathymétrie ni ombrage sous-marin, les vents glissent sur une mer unie.
  if (!map.getSource('ocean-mask')) { map.addSource('ocean-mask', { type: 'geojson', data: import.meta.env.BASE_URL+'data/ocean-mask.geojson' }); map.addLayer({ id: 'ocean-mask', type: 'fill', source: 'ocean-mask', layout: { visibility: 'none' }, paint: { 'fill-color': '#0b1923', 'fill-opacity': .94, 'fill-antialias': true } }); }
  map.setLayoutProperty('ocean-mask', 'visibility', 'visible');
  if (map.getLayer('dem-preload')) { paint.set('dem-preload', 'hillshade-exaggeration', 1); paint.set('dem-preload', 'hillshade-shadow-color', '#02080c'); paint.set('dem-preload', 'hillshade-highlight-color', '#d8e8e0'); }
  paint.set('background', 'background-color', '#02060a');
  const ctrl = new AbortController();
  let field = syntheticField(), cancelled = false, raf = 0, running = false;
  info('Cargando el viento actual…');
  liveField(ctrl.signal).then(f => { if (cancelled) return; field = f; info('Viento a 10 m en este momento · Open-Meteo'); }).catch(() => { if (!cancelled) info('Circulación ilustrativa · alisios y ZCIT (sin conexión al servicio de viento)'); });

  // Calque de particules posé dans le conteneur de la carte.
  const canvas = document.createElement('canvas'); canvas.className = 'world-wind'; map.getCanvasContainer().append(canvas);
  const ctx = canvas.getContext('2d')!;
  // Brumes et petits nuages : une même tache floue (sprite) dérivée par le vent, très transparente.
  const cloudCanvas = document.createElement('canvas'); cloudCanvas.className = 'world-wind world-clouds'; map.getCanvasContainer().append(cloudCanvas);
  const cctx = cloudCanvas.getContext('2d')!;
  const sprite = document.createElement('canvas'); sprite.width = 256; sprite.height = 150; { const g = sprite.getContext('2d')!; for (let i = 0; i < 9; i++) { const x = 50 + Math.random() * 156, y = 55 + Math.random() * 40, r = 30 + Math.random() * 38, rg = g.createRadialGradient(x, y, 0, x, y, r); rg.addColorStop(0, 'rgba(255,255,255,.55)'); rg.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = rg; g.fillRect(0, 0, 256, 150); } }
  const cloudSpawn = (edge = false) => ({ lon: edge ? F.lon0 + (F.nx - 1) * F.step - 1 : F.lon0 + Math.random() * (F.nx - 1) * F.step, lat: F.lat1 - 1 - Math.random() * (F.ny - 2) * F.step, w: 110 + Math.random() * 230, a: .08 + Math.random() * .14, life: 0, max: 900 + Math.random() * 900 });
  const clouds = Array.from({ length: window.innerWidth < 760 ? 8 : 16 }, () => cloudSpawn());
  const fit = () => { const c = map.getCanvas(), dpr = Math.min(2, window.devicePixelRatio || 1); for (const [cv, cx] of [[canvas, ctx], [cloudCanvas, cctx]] as const) { cv.width = c.clientWidth * dpr; cv.height = c.clientHeight * dpr; cv.style.width = c.clientWidth + 'px'; cv.style.height = c.clientHeight + 'px'; cx.setTransform(dpr, 0, 0, dpr, 0, 0); } };
  fit(); map.on('resize', fit);
  const N = window.innerWidth < 760 ? 1100 : 2600;
  const spawn = () => ({ lon: F.lon0 + Math.random() * (F.nx - 1) * F.step, lat: F.lat1 - Math.random() * (F.ny - 1) * F.step, age: Math.floor(Math.random() * 300) });
  const parts = Array.from({ length: N }, spawn);
  const COLORS = ['rgba(158,227,204,.22)', 'rgba(190,236,224,.34)', 'rgba(232,244,236,.46)', 'rgba(255,226,170,.55)'];
  const buckets: number[][] = COLORS.map(() => []);
  let last = performance.now();
  const frame = (now: number) => {
    if (cancelled) return;
    const dt = Math.min(3, (now - last) / 16.7); last = now;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    ctx.globalCompositeOperation = 'destination-out'; ctx.fillStyle = 'rgba(0,0,0,.035)'; ctx.fillRect(0, 0, w, h); ctx.globalCompositeOperation = 'source-over';
    buckets.forEach(b => b.length = 0);
    for (const p of parts) {
      const uv = sample(field, p.lon, p.lat);
      if (!uv || ++p.age > 320) { Object.assign(p, spawn(), { age: 0 }); continue; }
      const a = map.project([p.lon, p.lat]);
      const k = .0014 * dt; // 3× plus lent qu'avant (Laurent)
      p.lon += uv[0] * k / Math.cos(p.lat * Math.PI / 180); p.lat += uv[1] * k;
      const b = map.project([p.lon, p.lat]), s = Math.hypot(uv[0], uv[1]);
      buckets[s < 3 ? 0 : s < 6 ? 1 : s < 9 ? 2 : 3].push(a.x, a.y, b.x, b.y);
    }
    ctx.lineWidth = 1.4; ctx.lineCap = 'round';
    buckets.forEach((b, ci) => { if (!b.length) return; ctx.strokeStyle = COLORS[ci]; ctx.beginPath(); for (let q = 0; q < b.length; q += 4) { ctx.moveTo(b[q], b[q + 1]); ctx.lineTo(b[q + 2], b[q + 3]); } ctx.stroke(); });
    cctx.clearRect(0, 0, w, h);
    for (const c of clouds) {
      const uv = sample(field, c.lon, c.lat) || [-3, 0];
      c.lon += uv[0] * .0005 * dt; c.lat += uv[1] * .0005 * dt; c.life += dt;
      if (c.life > c.max || !sample(field, c.lon, c.lat)) { Object.assign(c, cloudSpawn(true)); continue; }
      const fade = Math.min(1, c.life / 160, (c.max - c.life) / 160), pt = map.project([c.lon, c.lat]);
      cctx.globalAlpha = c.a * fade; cctx.drawImage(sprite, pt.x - c.w / 2, pt.y - c.w * .3, c.w, c.w * .59);
    }
    cctx.globalAlpha = 1;
    raf = requestAnimationFrame(frame);
  };
  const start = () => { if (running || cancelled) return; running = true; canvas.classList.add('on'); cloudCanvas.classList.add('on'); last = performance.now(); raf = requestAnimationFrame(frame); };
  // La caméra bouge : on efface les traînées pour éviter qu'elles bavent.
  const clear = () => { ctx.clearRect(0, 0, canvas.width, canvas.height); };
  map.on('move', clear);

  // Repère pulsant sur Bogotá.
  const el = document.createElement('div'); el.className = 'world-bogota'; el.innerHTML = '<i></i><span>Bogotá · 2 600 m</span>';
  const marker = new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat([-74.08, 4.61]).addTo(map);

  map.stop();
  const pad = { left: window.innerWidth > 900 ? 340 : 0, right: 0, top: 0, bottom: 0 };
  // Une seule descente douce, depuis Bogotá vers la vue régionale (un peu plus proche que la précédente).
  const settle = () => { if (cancelled) return; map.easeTo({ center: [-74.1, 3.9], zoom: window.innerWidth < 760 ? 4.6 : 5.45, pitch: 46, bearing: -20, padding: pad, duration: 3600, easing: t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2, essential: false }); map.once('moveend', start); };
  const settleTimer = window.setTimeout(settle, 0);
  const fallbackStart = window.setTimeout(start, 4200);
  return () => {
    cancelled = true; ctrl.abort(); cancelAnimationFrame(raf); window.clearTimeout(fallbackStart); window.clearTimeout(settleTimer);
    map.off('resize', fit); map.off('move', clear); map.off('moveend', start);
    canvas.remove(); cloudCanvas.remove(); marker.remove(); paint.restore(); if (map.getLayer('ocean-mask')) map.setLayoutProperty('ocean-mask', 'visibility', 'none'); map.setTerrain(null); try { map.setProjection({ type: 'mercator' }); } catch { /* */ } window.setTimeout(() => { try { map.setMinZoom(minZoom); } catch { /* */ } }, 2000); // après le retour de caméra, sinon saut
  };
}

export function applyWorld(map: maplibregl.Map, world: World, info: (s: string) => void) {
  const leave = world === 'data' ? enterData(map, info) : enterClimate(map, info);
  return () => {
    try {
      leave();
      for (const h of [map.scrollZoom, map.boxZoom, map.dragRotate, map.dragPan, map.keyboard, map.doubleClickZoom, map.touchZoomRotate, map.touchPitch]) h.disable();
      map.stop(); map.easeTo({ ...HOME_VIEW, padding: { left: 0, right: 0, top: 0, bottom: 0 }, duration: 1800 });
    } catch { /* carte déjà détruite */ }
  };
}
