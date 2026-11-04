import { db, leggiImpostazione, scriviImpostazione } from './db';
import { copiaCompleta } from './esportazione';
import type { Area, Budget, Conto, Movimento, SaldoIniziale, TipoArea, Valutazione } from './tipi';
import { AREE_INIZIALI, collegaFondi, stileConto } from './datiIniziali';
import { centesimi } from '../logica/formato';

// Importazione dei backup:
//  - il backup della vecchia app (file "bilancio-backup-AAAA-MM-GG.json"
//    creato con "Esporta backup" nella pagina HTML sul Mac);
//  - il backup di questa app (vedi esportazione.ts).
// Prima si legge il file e se ne mostra il contenuto, poi si sostituiscono i dati.

export interface ContenutoBackup {
  origine: 'vecchia app' | 'questa app';
  aree: Area[];
  movimenti: Movimento[];
  budget: Budget[];
  conti: Conto[];
  saldiIniziali: SaldoIniziale[];
  valutazioni: Valutazione[];
}

const TIPI_VECCHI: Record<string, TipoArea> = { in: 'entrata', out: 'spesa', inv: 'investimento' };

// Icona e colore per le aree create a mano nella vecchia app: si indovinano dal nome.
const INDOVINA: [RegExp, string, string][] = [
  [/stipend|salar/i, 'valigetta', 'verde'],
  [/affitt|casa|utenz|luce|gas/i, 'casa', 'ambra'],
  [/spesa|aliment|supermerc/i, 'carrello', 'corallo'],
  [/ristor|cena|pranz/i, 'ristorante', 'arancio'],
  [/auto|benzin|trasport/i, 'auto', 'azzurro'],
  [/telefon|abbonam|internet/i, 'telefono', 'viola'],
  [/sport|palestr/i, 'palestra', 'rosa'],
  [/salut|medic|farmac/i, 'farmacia', 'rosa'],
  [/viagg|vacanz/i, 'aereo', 'azzurro'],
  [/regal/i, 'regalo', 'corallo'],
  [/vestit|abbigl/i, 'maglietta', 'rosa'],
  [/etf|pac|invest|azion/i, 'grafico', 'blu'],
  [/fondo|risparm|accanton/i, 'salvadanaio', 'blu'],
];

function stileArea(id: string, nome: string, tipo: TipoArea): { icona: string; colore: string } {
  const nota = AREE_INIZIALI.find((a) => a.id === id);
  if (nota) return { icona: nota.icona, colore: nota.colore };
  const trovata = INDOVINA.find(([r]) => r.test(nome));
  if (trovata) return { icona: trovata[1], colore: trovata[2] };
  return tipo === 'entrata'
    ? { icona: 'contanti', colore: 'verde' }
    : tipo === 'investimento'
      ? { icona: 'crescita', colore: 'blu' }
      : { icona: 'puntini', colore: 'grigio' };
}

const numero = (x: unknown) => (typeof x === 'number' || typeof x === 'string' ? centesimi(Number(x)) || 0 : 0);
const dataValida = (d: unknown): d is string => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d);

/** Converte i dati della vecchia app (pagina HTML) nel formato nuovo. */
function daVecchiaApp(d: Record<string, any>): ContenutoBackup {
  const aree: Area[] = (d['config/aree']?.areas ?? [])
    .filter((a: any) => a && a.id && TIPI_VECCHI[a.kind])
    .map((a: any, i: number) => {
      const tipo = TIPI_VECCHI[a.kind];
      return { id: String(a.id), nome: String(a.name || 'Senza nome'), tipo, ...stileArea(a.id, a.name, tipo), budgetStandard: numero(a.std), ordine: i };
    });

  const movimenti: Movimento[] = [];
  const budget: Budget[] = [];
  const conti = new Map<string, Conto>();
  const saldiIniziali: SaldoIniziale[] = [];

  for (const [chiave, doc] of Object.entries(d)) {
    if (!doc || typeof doc !== 'object') continue;
    const [raccolta, quale] = chiave.split('/');
    if (raccolta === 'movimenti' && Array.isArray(doc.items)) {
      for (const it of doc.items) {
        if (!it || !dataValida(it.date) || !it.area) continue;
        movimenti.push({
          id: String(it.id || Math.random().toString(36).slice(2)),
          data: it.date,
          descrizione: String(it.desc ?? '').trim(),
          areaId: String(it.area),
          importo: numero(it.amount),
          creato: doc.updatedAt || new Date().toISOString(),
        });
      }
    } else if (raccolta === 'budget' && doc.values) {
      const anno = Number(quale);
      for (const [areaId, mesi] of Object.entries(doc.values as Record<string, unknown>)) {
        if (Array.isArray(mesi)) budget.push({ id: `${anno}:${areaId}`, anno, areaId, mesi: Array.from({ length: 12 }, (_, i) => numero(mesi[i])) });
      }
    } else if (raccolta === 'patrimonio' && Array.isArray(doc.items)) {
      const anno = Number(quale);
      for (const p of doc.items) {
        if (!p?.id) continue;
        if (!conti.has(p.id)) {
          const base = { id: String(p.id), nome: String(p.name || 'Conto'), tipo: (p.type === 'inv' ? 'investimento' : 'liquidita') as Conto['tipo'] };
          conti.set(p.id, { ...base, ...stileConto(base), ordine: conti.size });
        }
        saldiIniziali.push({ id: `${anno}:${p.id}`, anno, contoId: String(p.id), importo: numero(p.amount) });
      }
    }
  }
  // Collega le aree d'investimento ai loro fondi, se il fondo esiste.
  for (const a of aree) delete a.fondoId;
  collegaFondi(aree, [...conti.values()]);
  return { origine: 'vecchia app', aree, movimenti, budget, conti: [...conti.values()], saldiIniziali, valutazioni: [] };
}

/** Legge il testo di un file di backup. Lancia un errore con un messaggio chiaro se non va bene. */
export function leggiBackup(testo: string): ContenutoBackup {
  let o: any;
  try {
    o = JSON.parse(testo);
  } catch {
    throw new Error('Il file non è un backup: scegli il file .json esportato.');
  }
  if (o?.app === 'bilancio' && o.tabelle) {
    const t = o.tabelle;
    const lista = (x: unknown) => (Array.isArray(x) ? x.filter((v) => v && typeof v === 'object' && v.id) : []);
    // Controllo dei movimenti: si scartano solo righe rovinate, mai dati validi.
    const movimenti = lista(t.movimenti).filter((m: any) => dataValida(m.data) && m.areaId && isFinite(Number(m.importo)));
    if (!lista(t.aree).length) throw new Error('Il backup non contiene le macro-aree: il file sembra incompleto.');
    return {
      origine: 'questa app',
      aree: lista(t.aree),
      movimenti,
      budget: lista(t.budget),
      conti: lista(t.conti),
      saldiIniziali: lista(t.saldiIniziali),
      valutazioni: lista(t.valutazioni),
    };
  }
  const dati = o?.data ?? o;
  if (dati && typeof dati === 'object' && dati['config/aree']) return daVecchiaApp(dati);
  throw new Error('Questo file non sembra un backup del bilancio.');
}

/**
 * Sostituisce tutti i dati con quelli del backup (in un'unica operazione: o tutto o niente).
 * Prima mette da parte una copia dei dati attuali, per poter tornare indietro.
 */
export async function applicaBackup(c: ContenutoBackup): Promise<void> {
  const prima = await copiaCompleta();
  if (prima.tabelle.movimenti.length || prima.tabelle.conti.length) {
    await scriviImpostazione('copiaPrimaImportazione', JSON.stringify(prima));
  }
  await sostituisci(c);
}

/** Torna ai dati che c'erano prima dell'ultima importazione. */
export async function annullaImportazione(): Promise<boolean> {
  const testo = await leggiImpostazione('copiaPrimaImportazione');
  if (!testo) return false;
  await sostituisci(leggiBackup(testo));
  await db.impostazioni.delete('copiaPrimaImportazione');
  return true;
}

async function sostituisci(c: ContenutoBackup): Promise<void> {
  const tabelle = [db.aree, db.movimenti, db.budget, db.conti, db.saldiIniziali, db.valutazioni];
  await db.transaction('rw', tabelle, async () => {
    await Promise.all(tabelle.map((t) => t.clear()));
    await db.aree.bulkPut(c.aree);
    await db.movimenti.bulkPut(c.movimenti);
    await db.budget.bulkPut(c.budget);
    await db.conti.bulkPut(c.conti);
    await db.saldiIniziali.bulkPut(c.saldiIniziali);
    await db.valutazioni.bulkPut(c.valutazioni);
  });
}
