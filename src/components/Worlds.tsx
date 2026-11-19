import { useEffect, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { ArrowLeft, BookOpen, ChevronRight, History, Mountain, RadioTower, Telescope, Library, X } from 'lucide-react';
import { DataHub, type DataSection } from './DataHub';
import { Climate, type ClimateSection } from './Climate';
import type { World } from '../lib/worlds';

// Les trois grosses pastilles de chaque monde ; le contenu s'ouvre au-dessus de la carte transformée.
const SECTIONS: Record<World, [string, string, LucideIcon][]> = {
  data: [['maps', 'Mapas de los equipos de medición', RadioTower], ['dem', 'Modelos digitales de elevación', Mountain], ['lib', 'Biblioteca de fuentes', Library]],
  climate: [['past', 'Análisis retrospectivo', History], ['future', 'Análisis prospectivo', Telescope], ['sources', 'Fuentes', BookOpen]]
};

export function WorldSpace({ world, info, onBack }: { world: World; info: string; onBack: () => void }) {
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => { setOpen(null); }, [world]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key !== 'Escape') return; if (open) setOpen(null); else onBack(); };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  }, [open, onBack]);
  const current = SECTIONS[world].find(s => s[0] === open);
  return <main className={'world-space world-' + world + (open ? ' has-panel' : '')}>
    <div className="world-top">
      <button className="map-back" aria-label="Volver al inicio" onClick={onBack}><ArrowLeft size={19} /></button>
      <h1 className="world-title">{world === 'data' ? 'Manejo de datos' : <>Climatología <span>de Bogotá</span></>}</h1>
    </div>
    <nav className="world-pills" aria-label={world === 'data' ? 'Manejo de datos' : 'Climatología'}>
      {SECTIONS[world].map(([k, label, Icon], i) => <button key={k} className={'world-pill' + (open === k ? ' active' : '')} style={{ '--i': i } as React.CSSProperties} aria-expanded={open === k} onClick={() => setOpen(open === k ? null : k)}>
        <span className="world-pill-icon" aria-hidden="true"><Icon size={22} strokeWidth={1.4} /></span><span className="world-pill-label">{label}</span><ChevronRight className="world-pill-chev" size={17} aria-hidden="true" />
      </button>)}
    </nav>
    {current && <section className="world-panel" key={current[0]} role="region" aria-label={current[1]}>
      <header className="world-panel-head"><h2>{current[1]}</h2><button className="icon-button" aria-label="Cerrar" onClick={() => setOpen(null)}><X size={17} /></button></header>
      <div className="world-panel-body">{world === 'data' ? <DataHub only={current[0] as DataSection} /> : <Climate only={current[0] as ClimateSection} onOnly={setOpen} />}</div>
    </section>}
    {info && <div className="world-caption" role="status">{info}</div>}
  </main>;
}
