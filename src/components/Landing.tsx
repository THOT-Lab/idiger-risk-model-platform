import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { IdigerLogo } from './ui';

// Page de garde : Bogotá en fond (carte d'accueil), titre d'entrée et mention « Prototipo ».
export function Landing({ onEnter }: { onEnter: () => void }) {
  // Deux mouvements : le bouton s'enfonce, puis la page de garde s'efface avant l'arrivée standard du tableau de bord.
  const [leaving, setLeaving] = useState(false);
  const go = () => { if (leaving) return; setLeaving(true); window.setTimeout(onEnter, 420); };
  return <section className={'landing' + (leaving ? ' leaving' : '')} aria-label="Portada">
    <div className="landing-logo"><IdigerLogo /></div>
    <div className="landing-center">
      <button className="landing-enter" onClick={go} autoFocus><span>Enter the Risk Model Platform</span><ArrowRight size={22} /></button>
      <p className="landing-proto">Prototipo</p>
    </div>
    <p className="landing-foot">Centro de Modelación de Riesgos · Bogotá D.C.</p>
  </section>;
}
