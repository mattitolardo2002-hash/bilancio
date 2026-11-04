import { useLiveQuery } from 'dexie-react-hooks';
import { db, leggiImpostazione } from './db';
import type { DatiConti } from '../logica/conti';
import { contoPrincipale } from '../logica/conti';
import type { Budget } from './tipi';

export interface DatiApp extends DatiConti {
  /** Aree in ordine, per elenchi e scelte. */
  elencoAree: import('./tipi').Area[];
  budget: Budget[];
  ultimoBackup: string | undefined;
}

/**
 * Tutti i dati dell'app, aggiornati da soli quando cambiano nel database.
 * Per un bilancio personale sono pochi (qualche migliaio di movimenti al massimo):
 * leggerli tutti insieme è semplice e veloce.
 */
export function useDati(): DatiApp | undefined {
  return useLiveQuery(async () => {
    const [elencoAree, conti, movimenti, saldiIniziali, valutazioni, budget, scelto, ultimoBackup] = await Promise.all([
      db.aree.orderBy('ordine').toArray(),
      db.conti.orderBy('ordine').toArray(),
      db.movimenti.toArray(),
      db.saldiIniziali.toArray(),
      db.valutazioni.toArray(),
      db.budget.toArray(),
      leggiImpostazione('contoPrincipale'),
      leggiImpostazione('ultimoBackup'),
    ]);
    return {
      elencoAree,
      aree: new Map(elencoAree.map((a) => [a.id, a])),
      conti,
      movimenti,
      saldiIniziali,
      valutazioni,
      budget,
      principaleId: contoPrincipale(conti, scelto),
      ultimoBackup,
    };
  });
}
