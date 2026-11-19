import { useMemo, useState } from 'react';
import { sources, type Source, type SourceTopic } from '../data/catalog';
import { EXTRA, href } from './DataHub';
import '../library.css';

export type Tab = 'all' | 'torrential' | 'flood' | 'landslide' | 'climate' | 'platform';
const TABS: { id: Tab; label: string }[] = [
  { id: 'all', label: 'Todas' }, { id: 'torrential', label: 'Avenidas torrenciales' }, { id: 'flood', label: 'Inundaciones' },
  { id: 'landslide', label: 'Movimientos en masa' }, { id: 'climate', label: 'Climatología' }, { id: 'platform', label: 'Plataforma y exposición' },
];
const EXTRA_TOPICS: SourceTopic[] = ['torrential', 'flood', 'climate'];
const DATA_TYPES = new Set(['Datos integrados', 'Catálogo de datos', 'Servicio geográfico', 'Cartografía de contexto', 'Manifiesto']);
const PLATFORM: SourceTopic[] = ['home', 'impact', 'multirisk'];

// Calcul paresseux : DataHub importe ce module (import circulaire), EXTRA n'est pas encore défini au chargement.
let allCache: Source[] | null = null;
const allSources = (): Source[] => allCache ??= [...EXTRA.map(s => ({ ...s, topics: s.topics ?? EXTRA_TOPICS })), ...sources].filter((s, i, a) => a.findIndex(x => x.id === s.id) === i);
const forTab = (t: Tab) => t === 'all' ? allSources() : allSources().filter(s => s.topics?.some(x => t === 'platform' ? PLATFORM.includes(x) : x === t));

function Row({ s, n }: { s: Source; n: number }) {
  const url = href(s);
  const body = <><span className="ref-n">{n}</span><span className="ref-text"><span className="ref-main"><span className="ref-owner">{s.owner}.</span> <cite>{s.name}</cite></span><span className="ref-use">{s.use}</span></span>{!url && <em className="ref-local">documento interno</em>}</>;
  return <li>{url ? <a href={url} target="_blank" rel="noreferrer">{body}</a> : <div>{body}</div>}</li>;
}

export function SourceLibrary({ initialTab }: { initialTab?: Tab }) {
  const [tab, setTab] = useState<Tab>(initialTab ?? 'all');
  const [q, setQ] = useState('');
  const counts = useMemo(() => Object.fromEntries(TABS.map(t => [t.id, forTab(t.id).length])) as Record<Tab, number>, []);
  let list = forTab(tab);
  const query = q.trim().toLowerCase();
  if (tab === 'all' && query) list = list.filter(s => `${s.name} ${s.owner} ${s.use} ${s.type}`.toLowerCase().includes(query));
  const grouped = tab !== 'all' && tab !== 'platform';
  const groups = grouped ? [{ h: 'Datos', items: list.filter(s => DATA_TYPES.has(s.type)) }, { h: 'Documentos y estudios', items: list.filter(s => !DATA_TYPES.has(s.type)) }].filter(g => g.items.length) : [{ h: '', items: list }];
  let n = 0;
  return <div className="source-library">
    <div className="lib-tabs" role="tablist">{TABS.map(t => <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>{t.label} <span className="lib-count">{counts[t.id]}</span></button>)}</div>
    {tab === 'all' && <input className="lib-filter" type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar en la biblioteca…" aria-label="Buscar en la biblioteca" />}
    {groups.map(g => <section key={g.h || 'x'}>{g.h && <h4 className="lib-group">{g.h}</h4>}<ol className="library-raw">{g.items.map(s => <Row key={s.id} s={s} n={++n} />)}</ol></section>)}
    {!list.length && <p className="lib-empty">Sin resultados.</p>}
  </div>;
}
