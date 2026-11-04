import { useMemo, useState } from 'react';
import { IconChevronLeft, IconChevronRight, IconSearch, IconX } from '@tabler/icons-react';
import type { Movimento, TipoArea } from '../dati/tipi';
import type { DatiApp } from '../dati/usaDati';
import { chiaveMese, totali } from '../logica/bilancio';
import { euro, giornoRelativo, nomeMese } from '../logica/formato';
import { RigaMovimento } from './Home';
import { apriNuovoMovimento } from '../navigazione';

const FILTRI: { id: TipoArea | 'tutti'; etichetta: string }[] = [
  { id: 'tutti', etichetta: 'Tutti' },
  { id: 'spesa', etichetta: 'Spese' },
  { id: 'entrata', etichetta: 'Entrate' },
  { id: 'investimento', etichetta: 'Investimenti' },
];

// Elenco completo dei movimenti, mese per mese, con ricerca e filtri.
export function Movimenti({ dati }: { dati: DatiApp }) {
  const oggi = new Date();
  const [periodo, setPeriodo] = useState({ anno: oggi.getFullYear(), mese: oggi.getMonth() });
  const [filtro, setFiltro] = useState<TipoArea | 'tutti'>('tutti');
  const [areaId, setAreaId] = useState('');
  const [cerca, setCerca] = useState('');
  const sposta = (d: number) => {
    const t = new Date(periodo.anno, periodo.mese + d, 1);
    setPeriodo({ anno: t.getFullYear(), mese: t.getMonth() });
  };

  const elenco = useMemo(() => {
    const testo = cerca.trim().toLowerCase();
    return dati.movimenti
      .filter((m) => {
        const a = dati.aree.get(m.areaId);
        // Con la ricerca si cerca in tutti i mesi; senza, solo nel mese scelto.
        if (testo) {
          const importo = String(m.importo).replace('.', ',');
          if (!(m.descrizione.toLowerCase().includes(testo) || a?.nome.toLowerCase().includes(testo) || importo.startsWith(testo.replace('€', '').trim()))) return false;
        } else if (!m.data.startsWith(chiaveMese(periodo.anno, periodo.mese))) return false;
        if (filtro !== 'tutti' && a?.tipo !== filtro) return false;
        if (areaId && m.areaId !== areaId) return false;
        return true;
      })
      .sort((x, y) => y.data.localeCompare(x.data) || y.creato.localeCompare(x.creato));
  }, [dati, periodo, filtro, areaId, cerca]);

  const t = totali(elenco, dati.aree);
  // Raggruppa per giorno, con il totale del giorno.
  const giorni: { data: string; elenco: Movimento[] }[] = [];
  for (const m of elenco) {
    const g = giorni[giorni.length - 1];
    if (g && g.data === m.data) g.elenco.push(m);
    else giorni.push({ data: m.data, elenco: [m] });
  }
  const areeFiltrabili = dati.elencoAree.filter((a) => filtro === 'tutti' || a.tipo === filtro);

  return (
    <>
      <h1 className="titolo-pagina">Movimenti</h1>

      <label className="ricerca">
        <IconSearch size={18} stroke={1.8} />
        <input type="search" value={cerca} onChange={(e) => setCerca(e.target.value)} placeholder="Cerca descrizione, area o importo" />
        {cerca && (
          <button type="button" onClick={() => setCerca('')} aria-label="Cancella ricerca">
            <IconX size={16} stroke={2} />
          </button>
        )}
      </label>

      {!cerca && (
        <div className="barra-periodo">
          <button type="button" className="pulsante-tondo" onClick={() => sposta(-1)} aria-label="Mese precedente">
            <IconChevronLeft size={20} stroke={1.8} />
          </button>
          <strong>{nomeMese(periodo.anno, periodo.mese)}</strong>
          <button type="button" className="pulsante-tondo" onClick={() => sposta(1)} aria-label="Mese successivo">
            <IconChevronRight size={20} stroke={1.8} />
          </button>
        </div>
      )}

      <div className="scorri-conti filtri">
        {FILTRI.map((f) => (
          <button key={f.id} type="button" className="chip" aria-checked={filtro === f.id} role="radio" onClick={() => { setFiltro(f.id); setAreaId(''); }}>
            {f.etichetta}
          </button>
        ))}
        <select className="chip" value={areaId} onChange={(e) => setAreaId(e.target.value)} aria-label="Area">
          <option value="">Tutte le aree</option>
          {areeFiltrabili.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
        </select>
      </div>

      <div className="riquadro riassunto">
        <div><span className="etichetta">Entrate</span><span className="numero positivo">{euro(t.entrata)}</span></div>
        <div><span className="etichetta">Spese</span><span className="numero">{euro(t.spesa)}</span></div>
        <div><span className="etichetta">Investito</span><span className="numero accento">{euro(t.investimento)}</span></div>
      </div>

      {giorni.length === 0 ? (
        <div className="riquadro vuoto-grande">
          <h2>{cerca ? 'Nessun risultato' : 'Nessun movimento'}</h2>
          <p>{cerca ? 'Prova con un’altra parola o un importo.' : 'In questo periodo non ci sono movimenti con questi filtri.'}</p>
          {!cerca && (
            <button type="button" className="pulsante primario" onClick={() => apriNuovoMovimento()}>
              Registra un movimento
            </button>
          )}
        </div>
      ) : (
        <section className="riquadro">
          <p className="testo-tenue piccolo">{elenco.length} {elenco.length === 1 ? 'movimento' : 'movimenti'}{cerca ? (elenco.length === 1 ? ' trovato in tutti i mesi' : ' trovati in tutti i mesi') : ''}</p>
          {giorni.map((g) => {
            const netto = g.elenco.reduce((s, m) => {
              const tipo = dati.aree.get(m.areaId)?.tipo;
              return s + (tipo === 'entrata' ? m.importo : -m.importo);
            }, 0);
            return (
              <div key={g.data} className="gruppo-giorno">
                <div className="giorno giorno-con-totale">
                  <span>{giornoRelativo(g.data)}{cerca ? ` ${g.data.slice(0, 4)}` : ''}</span>
                  <span>{netto > 0 ? '+' : ''}{euro(netto)}</span>
                </div>
                {g.elenco.map((m) => <RigaMovimento key={m.id} m={m} area={dati.aree.get(m.areaId)} />)}
              </div>
            );
          })}
        </section>
      )}
    </>
  );
}
