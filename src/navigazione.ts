import { useEffect, useState } from 'react';
import type { Movimento } from './dati/tipi';

// Le sezioni principali della barra in basso (il "+" centrale non è una sezione:
// apre la finestra per registrare un movimento).
export const SEZIONI = [
  { id: 'home', etichetta: 'Home' },
  { id: 'movimenti', etichetta: 'Movimenti' },
  { id: 'analisi', etichetta: 'Analisi' },
  { id: 'altro', etichetta: 'Altro' },
] as const;

export type IdSezione = (typeof SEZIONI)[number]['id'];

export interface Posizione {
  sezione: IdSezione;
  /** Elemento aperto dentro la sezione, se c'è. */
  dettaglio: string | null;
}

// Legge la posizione dall'indirizzo (es. ...#/altro). Usare l'indirizzo permette
// di ricaricare la pagina restando nello stesso punto e di usare il tasto Indietro.
function posizioneDaIndirizzo(): Posizione {
  const [id, dettaglio] = location.hash.replace(/^#\/?/, '').split('/');
  const sezione = SEZIONI.some((s) => s.id === id) ? (id as IdSezione) : 'home';
  return { sezione, dettaglio: dettaglio ? decodeURIComponent(dettaglio) : null };
}

export function vai(sezione: IdSezione, dettaglio?: string) {
  location.hash = `/${sezione}` + (dettaglio ? `/${encodeURIComponent(dettaglio)}` : '');
  window.scrollTo(0, 0);
}

export function usePosizione(): Posizione {
  const [posizione, setPosizione] = useState(posizioneDaIndirizzo);
  useEffect(() => {
    const aggiorna = () => setPosizione(posizioneDaIndirizzo());
    window.addEventListener('hashchange', aggiorna);
    return () => window.removeEventListener('hashchange', aggiorna);
  }, []);
  return posizione;
}

// Apertura della finestra "Nuovo movimento" da qualunque punto dell'app.
// Se si passa un movimento, la finestra si apre per modificarlo.
const ascoltatori = new Set<(m?: Movimento) => void>();
export function apriNuovoMovimento(m?: Movimento) {
  ascoltatori.forEach((f) => f(m));
}
export function useApriNuovoMovimento(f: (m?: Movimento) => void) {
  useEffect(() => {
    ascoltatori.add(f);
    return () => void ascoltatori.delete(f);
  }, [f]);
}
