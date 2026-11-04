import { useEffect, useMemo, useRef, useState } from 'react';
import { IconArrowRight, IconBackspace, IconCalendar, IconTrash } from '@tabler/icons-react';
import { db, leggiImpostazione, nuovoId, scriviImpostazione } from '../dati/db';
import type { Movimento, TipoArea } from '../dati/tipi';
import type { DatiApp } from '../dati/usaDati';
import { dataLocale, giornoRelativo, leggiImporto } from '../logica/formato';
import { Finestra, Conferma } from './Finestra';
import { IconaArea } from './IconaArea';

const TIPI: { id: TipoArea; etichetta: string; verbo: string }[] = [
  { id: 'spesa', etichetta: 'Spesa', verbo: 'Registra spesa' },
  { id: 'entrata', etichetta: 'Entrata', verbo: 'Registra entrata' },
  { id: 'investimento', etichetta: 'Investimento', verbo: 'Registra investimento' },
];

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
  const dataRef = useRef<HTMLInputElement>(null);

  // A ogni apertura: valori del movimento da modificare, oppure quelli dell'ultima volta.
  useEffect(() => {
    if (!aperta || !dati) return;
    setErrore('');
    if (movimento) {
      const a = dati.aree.get(movimento.areaId);
      setTipo(a?.tipo ?? 'spesa');
      setCifre(String(movimento.importo).replace('.', ','));
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

  const [intero, decimali] = (cifre || '0').split(',');
  const verbo = movimento ? 'Salva modifiche' : TIPI.find((t) => t.id === tipo)!.verbo;

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

        <div className="griglia-aree" role="radiogroup" aria-label="Area">
          {aree.map((a) => (
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
        </div>

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
