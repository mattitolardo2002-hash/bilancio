import { useEffect, useMemo, useRef, useState } from 'react';
import { IconArrowRight, IconBackspace, IconCalendar, IconDots, IconTrash } from '@tabler/icons-react';
import { db, leggiImpostazione, nuovoId, scriviImpostazione } from '../dati/db';
import type { Movimento, TipoArea } from '../dati/tipi';
import type { DatiApp } from '../dati/usaDati';
import { budgetDi, chiaveMese, meseDi } from '../logica/bilancio';
import { COLORI_AREA } from './IconaArea';
import { centesimi, dataLocale, euro, euroTondo, giornoRelativo, leggiImporto } from '../logica/formato';
import { Finestra, Conferma } from './Finestra';
import { IconaArea, ICONE_AREA } from './IconaArea';

const TIPI: { id: TipoArea; etichetta: string; verbo: string }[] = [
  { id: 'spesa', etichetta: 'Spesa', verbo: 'Registra spesa' },
  { id: 'entrata', etichetta: 'Entrata', verbo: 'Registra entrata' },
  { id: 'investimento', etichetta: 'Investimento', verbo: 'Registra investimento' },
];

/** Importo → cifre del tastierino: 66.4 → "66,40", 50 → "50". */
const cifreDa = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace('.', ','));

// Finestra per registrare (o modificare) un movimento: importo grande con
// tastierino, scelta dell'area con le icone, conto e data già pronti.
export function NuovoMovimento({
  aperta,
  movimento,
  dati,
  onChiudi,
}: {
  aperta: boolean;
  movimento: Movimento | undefined;
  dati: DatiApp | undefined;
  onChiudi: () => void;
}) {
  const [tipo, setTipo] = useState<TipoArea>('spesa');
  const [cifre, setCifre] = useState('');
  const [descrizione, setDescrizione] = useState('');
  const [areaId, setAreaId] = useState<string>('');
  const [contoId, setContoId] = useState<string>('');
  const [data, setData] = useState(dataLocale());
  const [errore, setErrore] = useState('');
  const [eliminare, setEliminare] = useState(false);
  const [tutteLeAree, setTutteLeAree] = useState(false);
  const dataRef = useRef<HTMLInputElement>(null);

  // A ogni apertura: valori del movimento da modificare, oppure quelli dell'ultima volta.
  useEffect(() => {
    if (!aperta || !dati) return;
    setErrore('');
    setTutteLeAree(false);
    if (movimento) {
      const a = dati.aree.get(movimento.areaId);
      setTipo(a?.tipo ?? 'spesa');
      setCifre(cifreDa(movimento.importo));
      setDescrizione(movimento.descrizione);
      setAreaId(movimento.areaId);
      setContoId(movimento.contoId ?? dati.principaleId ?? '');
      setData(movimento.data);
    } else {
      setTipo('spesa');
      setCifre('');
      setDescrizione('');
      setAreaId('');
      setData(dataLocale());
      leggiImpostazione('ultimoConto').then((c) =>
        setContoId(c && dati.conti.some((x) => x.id === c) ? c : dati.principaleId ?? ''),
      );
    }
    // Solo all'apertura: non vogliamo azzerare mentre si scrive.
  }, [aperta, movimento]);

  // Aree del tipo scelto, le più usate negli ultimi 3 mesi per prime.
  const aree = useMemo(() => {
    if (!dati) return [];
    const da = dataLocale(new Date(Date.now() - 90 * 864e5));
    const uso = new Map<string, number>();
    for (const m of dati.movimenti) if (m.data >= da) uso.set(m.areaId, (uso.get(m.areaId) ?? 0) + 1);
    return dati.elencoAree
      .filter((a) => a.tipo === tipo)
      .sort((x, y) => (uso.get(y.id) ?? 0) - (uso.get(x.id) ?? 0) || x.ordine - y.ordine);
  }, [dati, tipo]);

  // "Rapidi": le spese che ripeti (stessa descrizione e area) negli ultimi 4 mesi.
  // Un tocco compila area, descrizione, conto e l'importo dell'ultima volta.
  const rapidi = useMemo(() => {
    if (!dati || movimento) return [];
    const da = dataLocale(new Date(Date.now() - 120 * 864e5));
    const gruppi = new Map<string, { m: Movimento; volte: number }>();
    for (const m of dati.movimenti) {
      if (m.data < da || !m.descrizione || dati.aree.get(m.areaId)?.tipo !== tipo) continue;
      const k = m.descrizione.trim().toLowerCase() + '|' + m.areaId;
      const g = gruppi.get(k);
      if (!g) gruppi.set(k, { m, volte: 1 });
      else {
        g.volte++;
        if (m.data > g.m.data || (m.data === g.m.data && m.creato > g.m.creato)) g.m = m;
      }
    }
    return [...gruppi.values()]
      .sort((x, y) => y.volte - x.volte || y.m.data.localeCompare(x.m.data))
      .slice(0, 6)
      .map((g) => g.m);
  }, [dati, tipo, movimento]);

  const usaRapido = (m: Movimento) => {
    setAreaId(m.areaId);
    setDescrizione(m.descrizione);
    setCifre(cifreDa(m.importo));
    if (m.contoId && dati?.conti.some((c) => c.id === m.contoId)) setContoId(m.contoId);
    setErrore('');
  };

  // Griglia: le 7 aree più usate + "Altre". L'area scelta resta sempre visibile.
  const MAX = 7;
  let areeVisibili = aree;
  if (!tutteLeAree && aree.length > MAX + 1) {
    areeVisibili = aree.slice(0, MAX);
    const scelta = aree.find((a) => a.id === areaId);
    if (scelta && !areeVisibili.includes(scelta)) areeVisibili = [...areeVisibili.slice(0, MAX - 1), scelta];
  }

  const contiLiquidi = dati?.conti.filter((c) => c.tipo === 'liquidita') ?? [];
  const area = areaId ? dati?.aree.get(areaId) : undefined;
  const fondo = area?.fondoId ? dati?.conti.find((c) => c.id === area.fondoId) : undefined;

  // Tastierino: cifre, virgola, cancella. Massimo 2 decimali e 7 cifre intere.
  const premi = (t: string) => {
    setErrore('');
    setCifre((c) => {
      if (t === '⌫') return c.slice(0, -1);
      if (t === ',') return c.includes(',') ? c : (c || '0') + ',';
      const [intero, dec] = c.split(',');
      if (dec !== undefined && dec.length >= 2) return c;
      if (dec === undefined && intero.replace(/^0/, '').length >= 7) return c;
      return c === '0' ? t : c + t;
    });
  };

  // Sul Mac si può scrivere l'importo anche con la tastiera.
  useEffect(() => {
    if (!aperta) return;
    const tasto = (e: KeyboardEvent) => {
      const dove = (e.target as HTMLElement).tagName;
      if (dove === 'INPUT' || dove === 'TEXTAREA') return;
      if (/^\d$/.test(e.key)) premi(e.key);
      else if (e.key === ',' || e.key === '.') premi(',');
      else if (e.key === 'Backspace') premi('⌫');
      else if (e.key === 'Enter') salva();
    };
    window.addEventListener('keydown', tasto);
    return () => window.removeEventListener('keydown', tasto);
  });

  const salva = async () => {
    const importo = leggiImporto(cifre);
    if (!importo || importo <= 0) return setErrore("Scrivi l'importo");
    if (!area) return setErrore("Scegli un'area");
    const m: Movimento = {
      id: movimento?.id ?? nuovoId('m'),
      data,
      descrizione: descrizione.trim(),
      areaId: area.id,
      importo,
      contoId: contoId || undefined,
      creato: movimento?.creato ?? new Date().toISOString(),
    };
    try {
      await db.movimenti.put(m);
    } catch {
      return setErrore('Non salvato: riprova. Se succede ancora, fai un backup da Altro.');
    }
    if (contoId) await scriviImpostazione('ultimoConto', contoId);
    onChiudi();
  };

  const elimina = async () => {
    if (movimento) await db.movimenti.delete(movimento.id);
    setEliminare(false);
    onChiudi();
  };

  // Quanto resta nell'area scelta nel mese della data, tenendo conto dell'importo scritto.
  const infoBudget = (() => {
    if (!dati || !area || area.tipo !== 'spesa') return null;
    const { anno, mese } = meseDi(data);
    const budget = budgetDi(dati.budget.filter((b) => b.anno === anno), area.id, mese);
    if (budget <= 0) return null;
    const prefisso = chiaveMese(anno, mese);
    const speso = dati.movimenti
      .filter((m) => m.areaId === area.id && m.data.startsWith(prefisso) && m.id !== movimento?.id)
      .reduce((t, m) => t + m.importo, 0);
    const questo = leggiImporto(cifre) ?? 0;
    return { budget, speso: centesimi(speso), resta: centesimi(budget - speso - questo), conQuesto: questo > 0 };
  })();

  const [intero, decimali] = (cifre || '0').split(',');
  const importoScritto = leggiImporto(cifre);
  const verbo = movimento
    ? 'Salva modifiche'
    : importoScritto && importoScritto > 0
      ? `Registra ${euro(importoScritto)}`
      : TIPI.find((t) => t.id === tipo)!.verbo;

  return (
    <>
      <Finestra aperta={aperta} titolo={movimento ? 'Modifica movimento' : 'Nuovo movimento'} onChiudi={onChiudi}>
        <div className="segmenti" role="tablist" aria-label="Tipo di movimento">
          {TIPI.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tipo === t.id}
              onClick={() => {
                setTipo(t.id);
                if (area && area.tipo !== t.id) setAreaId('');
              }}
            >
              {t.etichetta}
            </button>
          ))}
        </div>

        <div className="importo-inserito" aria-live="polite">
          <span className={`importo-grande ${cifre ? '' : 'spento'} ${tipo === 'entrata' ? 'positivo' : ''}`}>
            {intero.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
            <span className="importo-decimali">
              {decimali !== undefined ? ',' + decimali : ''} €
            </span>
          </span>
          <input
            className="campo-descrizione"
            type="text"
            value={descrizione}
            onChange={(e) => setDescrizione(e.target.value)}
            placeholder="Aggiungi una descrizione"
            enterKeyHint="done"
            aria-label="Descrizione"
          />
        </div>

        {rapidi.length > 0 && (
          <div className="rapidi" aria-label="Spese che ripeti">
            {rapidi.map((m) => {
              const a = dati?.aree.get(m.areaId);
              const Ic = a ? ICONE_AREA[a.icona] ?? IconDots : IconDots;
              const scelto = m.areaId === areaId && m.descrizione.trim().toLowerCase() === descrizione.trim().toLowerCase();
              return (
                <button key={m.id} type="button" className="chip" aria-checked={scelto} onClick={() => usaRapido(m)}>
                  <Ic size={16} stroke={1.8} style={{ color: (a && COLORI_AREA[a.colore]) ?? COLORI_AREA.grigio }} />
                  {m.descrizione}
                </button>
              );
            })}
          </div>
        )}

        <div className="griglia-aree griglia-aree-piena" role="radiogroup" aria-label="Area">
          {areeVisibili.map((a) => (
            <button
              key={a.id}
              type="button"
              role="radio"
              aria-checked={a.id === areaId}
              className="scelta-area"
              onClick={() => {
                setAreaId(a.id);
                setErrore('');
              }}
            >
              <IconaArea area={a} misura={36} />
              <span>{a.nome}</span>
            </button>
          ))}
          {areeVisibili.length < aree.length && (
            <button type="button" className="scelta-area" onClick={() => setTutteLeAree(true)}>
              <IconaArea area={{ icona: 'puntini', colore: 'grigio' }} misura={36} />
              <span>Altre ({aree.length - areeVisibili.length})</span>
            </button>
          )}
        </div>

        {infoBudget && (
          <div className="info-budget">
            <div className="info-budget-riga">
              <span className="info-budget-nome">{area?.nome}</span>
              {infoBudget.resta >= 0 ? (
                <span>
                  {infoBudget.conQuesto ? 'dopo questa restano' : 'restano'} <strong>{euro(infoBudget.resta)}</strong> di {euroTondo(infoBudget.budget)}
                </span>
              ) : (
                <span className="negativo">
                  {infoBudget.conQuesto ? 'superi il budget di' : 'oltre il budget di'} <strong>{euro(-infoBudget.resta)}</strong>
                </span>
              )}
            </div>
            <div className="progresso">
              <span
                style={{
                  width: `${Math.min(100, ((infoBudget.budget - infoBudget.resta) / infoBudget.budget) * 100)}%`,
                  background: infoBudget.resta < 0 ? 'var(--negativo)' : 'var(--accento)',
                }}
              />
            </div>
          </div>
        )}

        <div className="riga-dettagli">
          {contiLiquidi.length > 0 && (
            <div className="scorri-conti" role="radiogroup" aria-label={tipo === 'entrata' ? 'Su quale conto' : 'Da quale conto'}>
              {contiLiquidi.map((c) => (
                <button key={c.id} type="button" role="radio" aria-checked={c.id === contoId} className="chip" onClick={() => setContoId(c.id)}>
                  {c.nome}
                </button>
              ))}
            </div>
          )}
          <label className="chip chip-data">
            <IconCalendar size={16} stroke={1.8} />
            {giornoRelativo(data)}
            <input ref={dataRef} type="date" value={data} onChange={(e) => e.target.value && setData(e.target.value)} aria-label="Data" />
          </label>
        </div>
        {tipo === 'investimento' && area && (
          <p className="nota-fondo">
            {dati?.conti.find((c) => c.id === contoId)?.nome ?? 'Conto'} <IconArrowRight size={14} stroke={2} />{' '}
            {fondo ? fondo.nome : 'nessun fondo collegato (si sceglie in Altro › Conti e fondi)'}
          </p>
        )}

        <div className="tastierino">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '0', '⌫'].map((t) => (
            <button key={t} type="button" onClick={() => premi(t)} aria-label={t === '⌫' ? 'Cancella' : t}>
              {t === '⌫' ? <IconBackspace size={24} stroke={1.6} /> : t}
            </button>
          ))}
        </div>

        {errore && <p className="messaggio errore centrato">{errore}</p>}
        <div className="fila-pulsanti">
          {movimento && (
            <button type="button" className="pulsante pericolo stretto" onClick={() => setEliminare(true)} aria-label="Elimina movimento">
              <IconTrash size={20} stroke={1.8} />
            </button>
          )}
          <button type="button" className="pulsante primario grande" onClick={salva}>
            {verbo}
          </button>
        </div>
      </Finestra>
      <Conferma
        aperta={eliminare}
        titolo="Eliminare il movimento?"
        testo="Non si può annullare."
        etichetta="Elimina"
        onConferma={elimina}
        onAnnulla={() => setEliminare(false)}
      />
    </>
  );
}
