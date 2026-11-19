import { useEffect, useState } from 'react';
import { Clock, Cpu } from 'lucide-react';
import type { Territory } from '../lib/types';
import { decimal } from '../lib/scenarios';

// Modèle de simulation affiché avant de lancer l'événement : quel logiciel, quelles hypothèses, quels temps.
type Model = { id: string; name: string; kind: string; lines: [string, string][] };
const MODELS: Record<'torrential' | 'flood' | 'landslide', Model[]> = {
  torrential: [
    { id: 'flo2d', name: 'FLO-2D', kind: 'Flujo de detritos 2D', lines: [['Hidrología', 'HEC-HMS · pérdidas SCS número de curva, hidrograma unitario SCS'], ['Flujo', 'Hiperconcentrado (reología de Bingham), concentración de sedimentos Cv 0,2–0,5'], ['Terreno', 'Malla 2D de 5–10 m sobre el MDT, n de Manning por cobertura']] },
    { id: 'hecras', name: 'HEC-RAS 2D', kind: 'Hidráulica 2D (USACE)', lines: [['Hidrología', 'HEC-HMS · SCS número de curva, hidrograma unitario SCS'], ['Flujo', 'Ecuaciones de onda difusiva o Saint-Venant 2D; módulo no newtoniano para lodos'], ['Terreno', 'Malla 2D refinada en el cauce, n de Manning por cobertura']] },
    { id: 'iber', name: 'Iber', kind: 'Hidráulica 2D (libre)', lines: [['Hidrología', 'Lluvia directa sobre la malla, pérdidas SCS'], ['Flujo', 'Saint-Venant 2D por volúmenes finitos; módulo de flujos no newtonianos'], ['Terreno', 'Malla no estructurada sobre el MDT']] }
  ],
  flood: [
    { id: 'hecras', name: 'HEC-RAS 2D', kind: 'Hidráulica 2D (USACE)', lines: [['Hidrología', 'HEC-HMS · SCS número de curva por subcuenca'], ['Flujo', 'Saint-Venant 2D; condición de borde: nivel del río Bogotá'], ['Drenaje', 'Acople con red de alcantarillado pluvial EAAB (SWMM), por integrar']] },
    { id: 'swmm', name: 'SWMM + 2D', kind: 'Drenaje urbano (EPA)', lines: [['Hidrología', 'Subcuencas urbanas, áreas impermeables del catastro'], ['Red', 'Colectores y canales EAAB, desbordamiento de pozos'], ['Superficie', 'Encharcamiento 2D sobre el MDT']] },
    { id: 'iber', name: 'Iber', kind: 'Hidráulica 2D (libre)', lines: [['Hidrología', 'Lluvia directa sobre la malla, pérdidas SCS'], ['Flujo', 'Saint-Venant 2D por volúmenes finitos'], ['Terreno', 'Malla no estructurada sobre el MDT']] }
  ],
  landslide: [
    { id: 'infinite', name: 'Talud infinito', kind: 'Factor de seguridad', lines: [['Método', 'Equilibrio límite celda por celda (Mohr-Coulomb)'], ['Insumos', 'Pendiente, espesor del suelo, cohesión, fricción, nivel freático'], ['Resultado', 'FS < 1: inestable · 1–1,3: marginal · > 1,3: estable']] },
    { id: 'trigrs', name: 'TRIGRS', kind: 'Infiltración transitoria (USGS)', lines: [['Método', 'Infiltración de la lluvia en el tiempo + talud infinito'], ['Insumos', 'Intensidad y duración de la lluvia, conductividad hidráulica, difusividad'], ['Resultado', 'Evolución del FS durante la tormenta']] },
    { id: 'shalstab', name: 'SHALSTAB', kind: 'Estado estacionario', lines: [['Método', 'Lluvia crítica que desestabiliza cada celda'], ['Insumos', 'Área drenada, pendiente, transmisividad, propiedades del suelo'], ['Resultado', 'Mapa de lluvia crítica (mm/día)']] }
  ]
};

type Net = { features: { properties: { territory: string; kind: string; elevation?: number }; geometry: { coordinates: [number, number] } }[] };
let netCache: Promise<Net> | null = null;
const dist = ([a, b]: [number, number], [c, d]: [number, number]) => { const k = Math.PI / 180, x = (c - a) * k * Math.cos((b + d) / 2 * k), y = (d - b) * k; return Math.hypot(x, y) * 6371000; };

// Temps de concentration (Kirpich) et temps de parcours de l'avenue, à partir du point haut et de la confluence.
function useTimes(t: Territory) {
  const [times, setTimes] = useState<{ tc: number; travel: [number, number]; L: number; dh: number } | null>(null);
  useEffect(() => {
    if (t.hazard !== 'torrential') { setTimes(null); return; }
    netCache ??= fetch(import.meta.env.BASE_URL+'data/torrential-network.geojson').then(r => r.json());
    netCache.then(n => {
      const pts = n.features.filter(f => f.properties.territory === t.id);
      const crest = pts.find(f => f.properties.kind === 'crest'), outlet = pts.find(f => f.properties.kind === 'outlet');
      if (!crest || !outlet || crest.properties.elevation == null || outlet.properties.elevation == null) { setTimes(null); return; }
      const L = dist(crest.geometry.coordinates, outlet.geometry.coordinates) * 1.25; // sinuosité du cauce
      const dh = crest.properties.elevation - outlet.properties.elevation, S = Math.max(.005, dh / L);
      const tc = .0195 * Math.pow(L, .77) * Math.pow(S, -.385);
      setTimes({ tc, travel: [L / 6 / 60, L / 3 / 60], L, dh });
    }).catch(() => setTimes(null));
  }, [t.id, t.hazard]);
  return times;
}

export function ModelBlock({ territory }: { territory: Territory }) {
  const list = MODELS[territory.hazard as keyof typeof MODELS] || MODELS.flood;
  const [id, setId] = useState(list[0].id), m = list.find(x => x.id === id) || list[0];
  const times = useTimes(territory);
  return <div className="model-block">
    <div className="model-head"><Cpu size={14} /><span>Modelo</span><small className="pending-chip">Módulo pendiente</small></div>
    <div className="model-pills" role="group" aria-label="Modelo de simulación">{list.map(x => <button key={x.id} className={x.id === m.id ? 'active' : ''} aria-pressed={x.id === m.id} onClick={() => setId(x.id)}>{x.name}</button>)}</div>
    <p className="model-kind">{m.kind}</p>
    <dl className="model-lines">{m.lines.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
    {territory.hazard !== 'landslide' && <div className="model-times"><Clock size={14} />{times ? <div>
      <p><b>Tiempo de concentración ≈ {Math.round(times.tc)} min</b> · Kirpich, cauce de {decimal(times.L / 1000)} km y {Math.round(times.dh)} m de desnivel</p>
      <p><b>Tiempo de viaje de la avenida ≈ {Math.round(times.travel[0])}–{Math.round(times.travel[1])} min</b> hasta la confluencia (3 a 6 m/s)</p>
    </div> : <div><p><b>Tiempos de concentración y de viaje</b> · se calcularán por subcuenca con el modelo hidrológico</p></div>}</div>}
  </div>;
}
