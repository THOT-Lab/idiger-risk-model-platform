import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpRight, ChevronDown, Loader2, MapPin, Maximize2, Minus, Plus, X } from 'lucide-react';
import { type Source } from '../data/catalog';
import { SourceLibrary } from './SourceLibrary';

type Sensor = { variable: string; since?: string | null; step?: string };
type NetStation = { id: string; name: string; coordinates: [number, number]; elevation?: string; category: string; technology: string; status: string; installed?: string; locality?: string; subzone?: string; sensors: Sensor[]; sensorsInferred: boolean };
type Network = { name: string; full: string; owner: string; theme: string; source: string; openData: string | null; stations: NetStation[] };
type Unmapped = { name: string; full: string; owner: string; count: string; note: string };
type NetKey = 'idiger' | 'eaab' | 'car' | 'ideam' | 'rmcab' | 'sgc' | 'particulares' | 'aerocivil' | 'ciudadana';
type Networks = { generated: string; networks: Record<NetKey, Network>; unmapped: Unmapped[] };
type Ring = [number, number][];

const NET_KEYS: NetKey[] = ['idiger', 'eaab', 'car', 'ideam', 'rmcab', 'sgc', 'particulares', 'aerocivil', 'ciudadana'];
const FAMILIES = { lluvia: { label: 'Lluvia', color: '#71c7f5' }, clima: { label: 'Clima', color: '#9ee3cc' }, nivel: { label: 'Nivel de ríos', color: '#e8c47d' }, mixta: { label: 'Hidrometeorológica', color: '#c3a6f2' }, aire: { label: 'Calidad del aire', color: '#f29bc1' }, sismo: { label: 'Sismología', color: '#f4876f' } } as const;
type Family = keyof typeof FAMILIES;
function family(s: NetStation): Family {
  const c = s.category.toLowerCase(), v = s.sensors.map(x => x.variable).join(' ').toLowerCase();
  if (c.includes('sism')) return 'sismo';
  if (c.includes('aire') || /pm2|pm10/.test(v)) return 'aire';
  if (c.includes('hidromet')) return 'mixta';
  if (c.includes('limni')) return 'nivel';
  if (c.includes('pluvi')) return 'lluvia';
  return 'clima';
}
// Tout le district (19 localités) d'office, dans un cadre paysage où l'on peut zoomer et se déplacer.
const DISTRICT = { x0: -74.26, x1: -73.98, y0: 4.16, y1: 4.84 };
const ASPECT = 1.7; // largeur / hauteur du cadre
const K = Math.cos(4.6 * Math.PI / 180);

// Volet qui s'ouvre et se referme en douceur (hauteur animée via grid 0fr → 1fr, contenu gardé monté).
export function Fold({ title, open, onToggle, children }: { title: string; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return <section className={'data-fold' + (open ? ' open' : '')}><button className="data-fold-head" aria-expanded={open} onClick={onToggle}><span>{title}</span><ChevronDown size={18} /></button><div className="data-fold-wrap" aria-hidden={!open}><div className="data-fold-inner"><div className="data-fold-body">{children}</div></div></div></section>;
}

export type DataSection = 'maps' | 'dem' | 'lib';
// only : une seule section, sans volet (affichée dans le panneau du monde « Manejo de datos »).
export function DataHub({ only }: { only?: DataSection } = {}) {
  const [data, setData] = useState<Networks | null>(null), [rings, setRings] = useState<Ring[]>([]), [failed, setFailed] = useState(false);
  const [net, setNet] = useState<NetKey>('idiger');
  const [view, setView] = useState({ cx: 0, cy: 0, s: 1 }), drag = useRef<{ x: number; y: number; cx: number; cy: number; moved: boolean } | null>(null), svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHoverRaw] = useState<{ s: NetStation; x: number; y: number; out?: boolean } | null>(null), hoverTimer = useRef(0), [selected, setSelected] = useState<NetStation | null>(null);
  // Bulle de station : sort du point au survol, y rentre quand la souris s'en va.
  const setHover = (h: { s: NetStation; x: number; y: number } | null) => { window.clearTimeout(hoverTimer.current); if (h) { setHoverRaw(h); return; } setHoverRaw(v => v ? { ...v, out: true } : v); hoverTimer.current = window.setTimeout(() => setHoverRaw(null), 200); };
  const [open, setOpen] = useState<'maps' | 'lib' | 'dem' | null>(null);
  useEffect(() => {
    Promise.all([fetch(import.meta.env.BASE_URL+'data/networks.json').then(r => r.json()), fetch(import.meta.env.BASE_URL+'data/localities.geojson').then(r => r.json())]).then(([n, g]) => {
      setData(n);
      const out: Ring[] = [];
      for (const f of g.features) { const geom = f.geometry; const polys = geom.type === 'MultiPolygon' ? geom.coordinates : [geom.coordinates]; for (const p of polys) out.push(p[0]); }
      setRings(out);
    }).catch(() => setFailed(true));
  }, []);
  const f = DISTRICT, W = 1000, H = Math.round(W * (f.y1 - f.y0) / ((f.x1 - f.x0) * K));
  const px = ([x, y]: [number, number]) => [((x - f.x0) / (f.x1 - f.x0)) * W, ((f.y1 - y) / (f.y1 - f.y0)) * H];
  const paths = useMemo(() => rings.map(r => 'M' + r.map(c => px(c).map(v => v.toFixed(1)).join(',')).join('L') + 'Z'), [rings]);
  // Cadre de départ : tout le district en hauteur, centré ; s = facteur de zoom (1 = district entier).
  const h0 = H * 1.04, w0 = h0 * ASPECT, cx = view.s === 1 ? W / 2 : view.cx, cy = view.s === 1 ? H / 2 : view.cy;
  const vw = w0 / view.s, vh = h0 / view.s, vx = cx - vw / 2, vy = cy - vh / 2, u = vw / 1000 * .72;
  // Garde le district dans le cadre : centré tant qu'il tient, sinon bords bloqués (petite marge).
  const fit = (c: number, d: number, visible: number) => visible >= d ? d / 2 : Math.min(Math.max(c, visible / 2 - d * .03), d - visible / 2 + d * .03);
  const zoomAt = (factor: number, fx = .5, fy = .5) => setView(v => { const s = Math.min(Math.max(v.s * factor, 1), 14); if (s === 1) return { cx: W / 2, cy: H / 2, s: 1 }; const ocx = v.s === 1 ? W / 2 : v.cx, ocy = v.s === 1 ? H / 2 : v.cy; const ax = ocx + (fx - .5) * w0 / v.s, ay = ocy + (fy - .5) * h0 / v.s; return { cx: fit(ax - (fx - .5) * w0 / s, W, w0 / s), cy: fit(ay - (fy - .5) * h0 / s, H, h0 / s), s }; });
  useEffect(() => { const el = svgRef.current; if (!el) return; const onWheel = (e: WheelEvent) => { e.preventDefault(); const r = el.getBoundingClientRect(); setHover(null); zoomAt(Math.exp(-e.deltaY * .006), (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height); }; el.addEventListener('wheel', onWheel, { passive: false }); return () => el.removeEventListener('wheel', onWheel); });
  const network = data?.networks[net];
  const within = (s: NetStation) => s.coordinates[0] >= f.x0 && s.coordinates[0] <= f.x1 && s.coordinates[1] >= f.y0 && s.coordinates[1] <= f.y1;
  const inFrame = (network?.stations || []).filter(within);
  const counts = inFrame.reduce((a, s) => { a[family(s)] = (a[family(s)] || 0) + 1; return a; }, {} as Record<string, number>);
  const pick = (k: NetKey) => { setNet(k); setSelected(null); setHover(null); };

  const sec = (k: DataSection, title: string, body: React.ReactNode) => only ? (only === k ? <div className="world-section" key={k}>{body}</div> : null) : <Fold title={title} open={open === k} onToggle={() => setOpen(open === k ? null : k)}>{body}</Fold>;
  return <div className="data-hub data-hub-compact">
    {sec('maps', 'Mapas de los equipos de medición', <>
      <div className="net-layout">
        <nav className="net-list" aria-label="Redes de medición">
          {data && NET_KEYS.map(k => { const n = data.networks[k]; return <button key={k} className={'net-item' + (net === k ? ' active' : '')} onClick={() => pick(k)}><span className="net-item-text"><strong>{n.name}</strong><small>{n.owner}</small></span><span className="net-item-count">{n.stations.filter(within).length}</span></button>; })}
          {data && <div className="net-unmapped"><h5>Sin ubicación publicada</h5>{data.unmapped.map(u => <div key={u.name} className="net-item ghost" title={u.note}><span className="net-item-text"><strong>{u.name}</strong><small>{u.count}</small></span></div>)}</div>}
        </nav>
        <div className="net-stage">
          <header className="net-stage-head"><h4>{network?.full || 'Redes de medición'}</h4><p>{network ? <>{network.theme} · Fuente: {network.source}</> : 'Pase el cursor sobre un punto para ver sus sensores; haga clic para abrir su ficha.'}</p></header>
          <div className="net-map">
            {failed ? <p className="net-empty">No se pudo cargar el catálogo de estaciones.</p> : <svg ref={svgRef} className={view.s > 1 ? 'zoomed' : ''} viewBox={`${vx.toFixed(1)} ${vy.toFixed(1)} ${vw.toFixed(1)} ${vh.toFixed(1)}`} role="img" aria-label={`Mapa de estaciones ${network?.name || ''}`} onMouseLeave={() => { setHover(null); drag.current = null; }}
              onPointerDown={e => { if (view.s > 1) drag.current = { x: e.clientX, y: e.clientY, cx, cy, moved: false }; }}
              onPointerMove={e => { const d = drag.current; if (!d) return; const r = e.currentTarget.getBoundingClientRect(); const dx = (e.clientX - d.x) / r.width * vw, dy = (e.clientY - d.y) / r.height * vh; if (Math.abs(e.clientX - d.x) + Math.abs(e.clientY - d.y) > 3) { d.moved = true; setHover(null); } setView(v => ({ ...v, cx: fit(d.cx - dx, W, w0 / v.s), cy: fit(d.cy - dy, H, h0 / v.s) })); }}
              onPointerUp={() => { setTimeout(() => { drag.current = null; }, 0); }}>
              <g className="net-localities">{paths.map((d, i) => <path key={i} d={d} />)}</g>
              {inFrame.map((s, idx) => { const [x, y] = px(s.coordinates); const fam = family(s); const on = selected === s; return <g key={s.id + idx} className={'net-dot' + (on ? ' on' : '')} transform={`translate(${x.toFixed(1)},${y.toFixed(1)}) scale(${u.toFixed(3)})`} onMouseEnter={e => { if (drag.current?.moved) return; const r = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect(); setHover({ s, x: ((x - vx) / vw) * r.width, y: ((y - vy) / vh) * r.height }); }} onMouseLeave={() => setHover(null)} onClick={() => { if (drag.current?.moved) return; setSelected(s); setHover(null); }} tabIndex={0} role="button" aria-label={s.name} onKeyDown={e => { if (e.key === 'Enter') setSelected(s); }}><circle r={on ? 30 : 20} className="halo" fill={FAMILIES[fam].color} /><circle r={on ? 15 : 11} fill={FAMILIES[fam].color} /></g>; })}
            </svg>}
            {!failed && <div className="net-zoom"><button aria-label="Acercar" onClick={() => zoomAt(2)}><Plus size={15} /></button><button aria-label="Alejar" onClick={() => zoomAt(.5)}><Minus size={15} /></button><button aria-label="Ver todo el distrito" disabled={view.s === 1} onClick={() => setView({ cx: W / 2, cy: H / 2, s: 1 })}><Maximize2 size={13} /></button></div>}
            {hover && <div className={'net-tip' + (hover.out ? ' out' : '')} key={hover.s.id} style={{ left: hover.x, top: hover.y }}><strong>{hover.s.name}</strong><span>{hover.s.category} · {hover.s.technology}</span><ul>{hover.s.sensors.map((x, i) => <li key={i}>{x.variable}{x.since && <em> · desde {x.since.slice(0, 4)}</em>}</li>)}{!hover.s.sensors.length && <li>Sensores no documentados</li>}</ul>{hover.s.sensorsInferred && <small>Sensores deducidos de la categoría de estación</small>}</div>}
            {selected && <div className="net-card"><StationSheet s={selected} net={net} onClose={() => setSelected(null)} /></div>}
          </div>
          <div className="net-map-foot"><div className="net-legend">{(Object.keys(FAMILIES) as Family[]).filter(k => counts[k]).map(k => <span key={k}><i style={{ background: FAMILIES[k].color }} />{FAMILIES[k].label} <b>{counts[k]}</b></span>)}</div>
            <span className="net-zoom-hint">Rueda o botones para acercarse · arrastre para desplazarse</span></div>
        </div>
      </div>
    </>)}
    {sec('dem', 'Modelos digitales de elevación', <DemList />)}
    {sec('lib', 'Biblioteca de fuentes', <Library />)}
  </div>;
}

const NET_NAME: Record<NetKey, string> = { idiger: 'IDIGER', eaab: 'Acueducto · EAAB', car: 'CAR Cundinamarca', ideam: 'IDEAM', rmcab: 'SDA · RMCAB', sgc: 'Servicio Geológico Colombiano', particulares: 'Estación particular', aerocivil: 'Aerocivil', ciudadana: 'Ciencia ciudadana' };
function DataLink({ s, net }: { s: NetStation; net: NetKey }) {
  const links: Partial<Record<NetKey, [string, string, string]>> = {
    rmcab: ['Datos horarios en tiempo real en el portal de la RMCAB.', 'http://rmcab.ambientebogota.gov.co/', 'Abrir RMCAB'],
    car: ['Las series de la CAR no están en el conjunto abierto consultado.', 'https://datosgeograficos.car.gov.co/datasets/CARCundinamarca::red-hidrometeorológica-car', 'Red Hidrometeorológica CAR'],
    sgc: ['Formas de onda y sismos registrados en los servicios abiertos del SGC.', 'http://sismo.sgc.gov.co/', 'Abrir SGC'],
    aerocivil: ['Observaciones METAR de este aeródromo, cada 30 a 60 minutos.', `https://aviationweather.gov/data/metar/?ids=${s.id}&hours=24`, `METAR ${s.id}`],
    ciudadana: ['Mediciones publicadas por el sensor en openSenseMap.', `https://opensensemap.org/explore/${s.id}`, 'Abrir en openSenseMap'],
  };
  const l = links[net];
  if (!l) return <p className="small">Series no publicadas en datos abiertos: requieren una solicitud al operador.</p>;
  return <p className="small">{l[0]} <a className="inline-link" href={l[1]} target="_blank" rel="noreferrer">{l[2]}<ArrowUpRight size={12} /></a></p>;
}
function StationSheet({ s, net, onClose }: { s: NetStation; net: NetKey; onClose: () => void }) {
  const place = s.locality ? s.locality.toLowerCase().replace(/\b\p{L}/gu, c => c.toUpperCase()) : s.subzone;
  const meta = [s.category, place, s.elevation ? `${s.elevation} m` : undefined].filter(Boolean).join(' · ');
  return <div className="station-sheet compact" key={s.id}>
    <header><span className="data-kicker"><MapPin size={12} />{NET_NAME[net]}</span><button className="net-card-close" aria-label="Cerrar ficha" onClick={onClose}><X size={14} /></button></header>
    <h4>{s.name}</h4>{meta && <p className="station-meta">{meta}</p>}
    <ul className="sensor-chips">{s.sensors.map((x, i) => <li key={i} title={x.since ? `desde ${x.since}` : undefined}>{x.variable}</li>)}{!s.sensors.length && <li>Sensores no documentados</li>}</ul>
    {net === 'idiger' || net === 'ideam' ? <RainSeries id={s.id} /> : net === 'eaab' || net === 'car' || net === 'particulares' ? <LiveSeries id={s.id} fallback={<DataLink s={s} net={net} />} /> : <DataLink s={s} net={net} />}
  </div>;
}

type Day = { dia: string; mm: number };
const API = 'https://www.datos.gov.co/resource/s54a-sgyg.json';
// Observaciones casi en tiempo real del IDEAM y de terceros (datos.gov.co 57sv-p2fu) : EAAB, CAR, particulares.
// Ventana móvil de unas horas : no es una serie histórica.
type Obs = { fechaobservacion: string; valorobservado: string; descripcionsensor: string; unidadmedida: string };
function LiveSeries({ id, fallback }: { id: string; fallback: React.ReactNode }) {
  const [state, setState] = useState<{ status: 'loading' | 'ok' | 'empty' | 'error'; groups: [string, Obs[]][] }>({ status: 'loading', groups: [] });
  useEffect(() => {
    let alive = true; const code = id.padStart(10, '0');
    const q = new URLSearchParams({ $where: `codigoestacion='${code}'`, $order: 'fechaobservacion DESC', $limit: '400' });
    fetch('https://www.datos.gov.co/resource/57sv-p2fu.json?' + q).then(r => r.json()).then((rows: Obs[]) => {
      if (!alive) return; const m = new Map<string, Obs[]>(); for (const r of rows) { const k = r.descripcionsensor; if (!m.has(k)) m.set(k, []); m.get(k)!.push(r); }
      setState({ status: rows.length ? 'ok' : 'empty', groups: [...m.entries()].slice(0, 4) });
    }).catch(() => alive && setState({ status: 'error', groups: [] }));
    return () => { alive = false; };
  }, [id]);
  if (state.status === 'loading') return <p className="small muted"><Loader2 size={12} className="spin" /> Consultando datos.gov.co…</p>;
  if (state.status !== 'ok') return <>{state.status === 'error' && <p className="small muted">No se pudo consultar datos.gov.co.</p>}{fallback}</>;
  const fmtTime = (t: string) => new Date(t).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  return <div className="live-series">{state.groups.map(([name, rows]) => { const vals = rows.slice().reverse().map(r => Number(r.valorobservado)); const max = Math.max(...vals), min = Math.min(...vals), span = max - min || 1; const last = rows[0];
    return <div key={name} className="live-row"><div><span>{name}</span><strong>{Number(last.valorobservado).toLocaleString('es-CO', { maximumFractionDigits: 1 })} <small>{last.unidadmedida}</small></strong></div>
      <svg viewBox="0 0 120 26" preserveAspectRatio="none" aria-hidden="true"><polyline fill="none" stroke="currentColor" strokeWidth="1.4" points={vals.map((v, i) => `${(i / Math.max(1, vals.length - 1) * 120).toFixed(1)},${(24 - (v - min) / span * 22).toFixed(1)}`).join(' ')} /></svg></div>; })}
    <p className="small muted">Ventana móvil del IDEAM · última observación {fmtTime(state.groups[0][1][0].fechaobservacion)} · <a className="inline-link" href={`https://www.datos.gov.co/resource/57sv-p2fu.json?codigoestacion=${id.padStart(10, '0')}`} target="_blank" rel="noreferrer">datos.gov.co<ArrowUpRight size={11} /></a></p></div>;
}

function RainSeries({ id }: { id: string }) {
  const [state, setState] = useState<{ status: 'loading' | 'ok' | 'empty' | 'error'; days: Day[]; last?: string }>({ status: 'loading', days: [] });
  useEffect(() => {
    let alive = true; setState({ status: 'loading', days: [] });
    const q = (p: Record<string, string>) => fetch(API + '?' + new URLSearchParams(p)).then(r => { if (!r.ok) throw new Error(); return r.json(); });
    (async () => {
      try {
        // Une seule requête : les cumuls quotidiens des 150 derniers jours, dont on garde les 60 derniers jours renseignés.
        const daily = (from: string) => q({ $select: 'date_trunc_ymd(fechaobservacion) as dia,sum(valorobservado) as mm', $where: `codigoestacion='${id}' and fechaobservacion>='${from}T00:00:00'`, $group: 'dia', $order: 'dia', $limit: '400' });
        let rows = await daily(new Date(Date.now() - 150 * 864e5).toISOString().slice(0, 10));
        if (!rows.length) {
          const [m] = await q({ $select: 'fechaobservacion', $where: `codigoestacion='${id}'`, $order: 'fechaobservacion DESC', $limit: '1' });
          if (!m) { if (alive) setState({ status: 'empty', days: [] }); return; }
          rows = await daily(new Date(new Date(m.fechaobservacion).getTime() - 59 * 864e5).toISOString().slice(0, 10));
        }
        const days = rows.map((r: { dia: string; mm: string }) => ({ dia: r.dia.slice(0, 10), mm: Number(r.mm) || 0 })).slice(-60);
        if (alive) setState(days.length ? { status: 'ok', days, last: days[days.length - 1].dia } : { status: 'empty', days: [] });
      } catch { if (alive) setState({ status: 'error', days: [] }); }
    })();
    return () => { alive = false; };
  }, [id]);
  if (state.status === 'loading') return <p className="small series-loading"><Loader2 size={14} className="spin" />Consultando datos abiertos (datos.gov.co), unos segundos…</p>;
  if (state.status === 'error') return <p className="small">Sin conexión con datos.gov.co. Inténtelo de nuevo más tarde.</p>;
  if (state.status === 'empty') return <p className="small">Esta estación no tiene registros de precipitación en el conjunto abierto.</p>;
  const max = Math.max(1, ...state.days.map(d => d.mm)), total = state.days.reduce((a, d) => a + d.mm, 0), bw = 300 / Math.max(state.days.length, 1);
  return <div className="rain-series"><div className="rain-head"><span>Precipitación diaria · {state.days.length} días con registro</span><b>{total.toLocaleString('es-CO', { maximumFractionDigits: 1 })} mm</b></div>
    <svg viewBox="0 0 300 90" preserveAspectRatio="none" role="img" aria-label="Precipitación diaria">{state.days.map((d, i) => <rect key={d.dia} x={i * bw + .5} width={Math.max(bw - 1, .8)} y={88 - (d.mm / max) * 84} height={(d.mm / max) * 84 + .5} rx="1"><title>{d.dia} · {d.mm.toFixed(1)} mm</title></rect>)}</svg>
    <div className="rain-axis"><span>{state.days[0]?.dia}</span><span>máx. {max.toFixed(1)} mm/día</span><span>{state.last}</span></div>
    <a className="inline-link small" href={`https://www.datos.gov.co/resource/s54a-sgyg.csv?$where=codigoestacion='${id}'&$order=fechaobservacion DESC&$limit=50000`} target="_blank" rel="noreferrer">Descargar la serie (CSV)<ArrowUpRight size={12} /></a></div>;
}

export const EXTRA: Source[] = [
  { id: 'CNE', name: 'Catálogo Nacional de Estaciones (CNE)', owner: 'IDEAM · datos.gov.co', type: 'Catálogo de datos', use: 'Estaciones de la EAAB y de la CAR: ubicación, categoría, tecnología y estado.', status: 'Integrado', link: 'https://www.datos.gov.co/d/hp9r-jxuu' },
  { id: 'PREC', name: 'Datos hidrometeorológicos crudos · precipitación', owner: 'IDEAM · datos.gov.co', type: 'Catálogo de datos', use: 'Series de precipitación de las estaciones IDIGER, consultadas en directo desde la ficha de cada estación.', status: 'Integrado', link: 'https://www.datos.gov.co/d/s54a-sgyg' },
  { id: 'CAR-RED', name: 'Red Hidrometeorológica CAR', owner: 'CAR Cundinamarca', type: 'Servicio geográfico', use: 'Más de 400 estaciones en la jurisdicción de la CAR.', status: 'Referencia', link: 'https://datosgeograficos.car.gov.co/datasets/CARCundinamarca::red-hidrometeorológica-car' },
];
export const href = (s: Source) => s.link || s.local || null;
function Library() {
  return <SourceLibrary />;
}

// Modelos digitales de elevación disponibles para Bogotá (verificados en catálogo, nov. 2026).
const DEMS: { name: string; who: string; res: string; year: string; cover: string; licence: string; url: string; note?: string }[] = [
  { name: 'Modelo Digital de Terreno de Bogotá 2025', who: 'UAECD · IDECA', res: '1 m (urbano y expansión) · 5 m (Cerros Orientales)', year: '2025', cover: '≈ 44 500 ha urbanas + 15 215 ha de cerros', licence: 'CC BY 4.0', url: 'https://www.datos.gov.co/d/ac23-ixix', note: 'Terreno desnudo, error vertical ≈ 0,10 m. La mejor base para inundaciones urbanas.' },
  { name: 'Modelo Digital de Terreno rural (LiDAR 2020)', who: 'UAECD · IDECA', res: '0,5 m', year: '2020', cover: '≈ 87 800 ha rurales (parcial)', licence: 'CC BY-NC-SA 4.0', url: 'https://www.datos.gov.co/d/8867-z27p', note: 'Uso no comercial.' },
  { name: 'Modelo Digital de Terreno de Bogotá 2014', who: 'UAECD · IDECA', res: '5 m', year: '2014', cover: 'Distrito', licence: 'CC BY-SA 4.0', url: 'https://www.datos.gov.co/d/jemw-temc' },
  { name: 'Copernicus DEM GLO-30', who: 'ESA · Copernicus', res: '30 m (modelo de superficie)', year: '2011-2015', cover: 'Mundial (teselas N04 W075 y N04 W074)', licence: 'Copernicus, libre', url: 'https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_N04_00_W075_00_DEM/Copernicus_DSM_COG_10_N04_00_W075_00_DEM.tif', note: 'Incluye edificios y vegetación.' },
  { name: 'ALOS PALSAR RTC', who: 'JAXA · ASF', res: '12,5 m', year: '2006-2011', cover: 'Mundial', licence: 'Libre con cuenta Earthdata', url: 'https://search.asf.alaska.edu/' },
  { name: 'NASADEM (SRTM reprocesado)', who: 'NASA', res: '30 m', year: '2000', cover: 'Mundial', licence: 'Libre con cuenta Earthdata', url: 'https://www.earthdata.nasa.gov/data/catalog/lpcloud-nasadem-hgt-001' },
  { name: 'Terrarium (AWS Terrain Tiles)', who: 'Mapzen · AWS', res: '≈ 10-30 m según zona', year: '—', cover: 'Mundial', licence: 'Libre', url: 'https://registry.opendata.aws/terrain-tiles/', note: 'Relieve usado hoy en el mapa 3D de la plataforma.' },
];
function DemList() {
  return <div className="dem-list"><p className="small muted">No se encontró un MDT publicado por la EAAB ni por la CAR: habría que solicitarlos directamente a cada entidad.</p><ol className="library-raw">{DEMS.map((d, i) => <li key={d.name}><a href={d.url} target="_blank" rel="noreferrer"><span className="ref-n">{i + 1}</span><span><strong>{d.name}</strong><small>{d.who} · {d.res} · {d.year} · {d.cover} · {d.licence}</small>{d.note && <em>{d.note}</em>}</span></a></li>)}</ol></div>;
}
