import { IconChartPie, IconDots, IconListDetails, IconPlus, IconSmartHome, type Icon } from '@tabler/icons-react';
import { SEZIONI, type IdSezione } from '../navigazione';

const ICONE: Record<IdSezione, Icon> = {
  home: IconSmartHome,
  movimenti: IconListDetails,
  analisi: IconChartPie,
  altro: IconDots,
};

// Barra in basso: due sezioni a sinistra, il "+" al centro, due a destra.
export function BarraNavigazione({
  attiva,
  onScegli,
  onNuovo,
}: {
  attiva: IdSezione;
  onScegli: (id: IdSezione) => void;
  onNuovo: () => void;
}) {
  const voce = (s: (typeof SEZIONI)[number]) => {
    const Ic = ICONE[s.id];
    return (
      <button
        key={s.id}
        type="button"
        className="voce-nav"
        aria-current={s.id === attiva ? 'page' : undefined}
        onClick={() => onScegli(s.id)}
      >
        <Ic size={24} stroke={1.6} aria-hidden="true" />
        <span>{s.etichetta}</span>
      </button>
    );
  };
  return (
    <nav className="barra-nav" aria-label="Sezioni">
      <div className="barra-nav-interno">
        {SEZIONI.slice(0, 2).map(voce)}
        <button type="button" className="nav-piu" onClick={onNuovo} aria-label="Nuovo movimento">
          <IconPlus size={26} stroke={2.2} aria-hidden="true" />
        </button>
        {SEZIONI.slice(2).map(voce)}
      </div>
    </nav>
  );
}
