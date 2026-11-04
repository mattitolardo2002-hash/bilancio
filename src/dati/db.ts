import Dexie, { type EntityTable } from 'dexie';
import type { Area, Budget, Conto, Movimento, SaldoIniziale, Valutazione } from './tipi';
import { AREE_INIZIALI, CONTI_INIZIALI } from './datiIniziali';

// Database locale (IndexedDB) gestito con Dexie: più solido del localStorage
// usato dalla vecchia app e senza limiti pratici di spazio.
// Le stringhe in `stores` elencano solo i campi su cui si fanno ricerche:
// gli altri campi vengono salvati comunque.
export const db = new Dexie('bilancio') as Dexie & {
  aree: EntityTable<Area, 'id'>;
  movimenti: EntityTable<Movimento, 'id'>;
  budget: EntityTable<Budget, 'id'>;
  conti: EntityTable<Conto, 'id'>;
  saldiIniziali: EntityTable<SaldoIniziale, 'id'>;
  impostazioni: EntityTable<{ chiave: string; valore: string }, 'chiave'>;
  valutazioni: EntityTable<Valutazione, 'id'>;
};

// Versione 1 della struttura. Se in futuro cambia, si aggiunge una
// `db.version(2)` con le istruzioni per convertire i dati esistenti:
// così gli aggiornamenti dell'app non cancellano niente.
db.version(1).stores({
  aree: 'id, ordine',
  movimenti: 'id, data, areaId',
  budget: 'id, anno',
  conti: 'id, ordine',
  saldiIniziali: 'id, anno',
  impostazioni: 'chiave',
});

// Versione 2: valori aggiornati a mano dei conti (es. valore attuale degli ETF).
db.version(2).stores({
  valutazioni: 'id, contoId, data',
});

// Al primissimo avvio crea le macro-aree della vecchia app.
db.on('populate', async (tx) => {
  await tx.table('aree').bulkAdd(AREE_INIZIALI);
  await tx.table('conti').bulkAdd(CONTI_INIZIALI);
});

/** Legge un'impostazione salvata (undefined se non c'è). */
export async function leggiImpostazione(chiave: string): Promise<string | undefined> {
  return (await db.impostazioni.get(chiave))?.valore;
}

export async function scriviImpostazione(chiave: string, valore: string): Promise<void> {
  await db.impostazioni.put({ chiave, valore });
}

/** Crea un identificativo univoco (funziona anche senza HTTPS, a differenza di crypto.randomUUID). */
export function nuovoId(prefisso = ''): string {
  return prefisso + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
