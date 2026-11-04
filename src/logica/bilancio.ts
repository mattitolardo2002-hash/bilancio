import type { Area, Budget, Movimento, SaldoIniziale, TipoArea } from '../dati/tipi';
import { centesimi } from './formato';

// Calcoli del bilancio: totali del mese, budget, patrimonio stimato.
// Sono funzioni "pure": ricevono i dati e restituiscono numeri, senza leggere il database.

export interface Totali {
  entrata: number;
  spesa: number;
  investimento: number;
}

const zero = (): Totali => ({ entrata: 0, spesa: 0, investimento: 0 });

/** Mese (0–11) e anno di una data AAAA-MM-GG. */
export function meseDi(data: string): { anno: number; mese: number } {
  return { anno: Number(data.slice(0, 4)), mese: Number(data.slice(5, 7)) - 1 };
}

/** Prefisso delle date di un mese: "2026-11". */
export const chiaveMese = (anno: number, mese: number) => `${anno}-${String(mese + 1).padStart(2, '0')}`;

/** Somma i movimenti per tipo (entrate, spese, investimenti). */
export function totali(movimenti: Movimento[], aree: Map<string, Area>): Totali {
  const t = zero();
  for (const m of movimenti) {
    const a = aree.get(m.areaId);
    if (a) t[a.tipo] += m.importo;
  }
  return { entrata: centesimi(t.entrata), spesa: centesimi(t.spesa), investimento: centesimi(t.investimento) };
}

/** Somma per area: { areaId → importo }. */
export function perArea(movimenti: Movimento[]): Map<string, number> {
  const s = new Map<string, number>();
  for (const m of movimenti) s.set(m.areaId, (s.get(m.areaId) ?? 0) + m.importo);
  return s;
}

/** Budget di un'area in un mese (0 se non impostato). */
export function budgetDi(budget: Budget[], areaId: string, mese: number): number {
  return budget.find((b) => b.areaId === areaId)?.mesi[mese] ?? 0;
}

/** Budget totale del mese per tipo. */
export function totaliBudget(budget: Budget[], aree: Map<string, Area>, mese: number): Totali {
  const t = zero();
  for (const b of budget) {
    const a = aree.get(b.areaId);
    if (a) t[a.tipo] += b.mesi[mese] ?? 0;
  }
  return t;
}

/**
 * Patrimonio stimato a fine di ogni mese dell'anno: saldi al 1° gennaio
 * + entrate − spese accumulate. Gli investimenti non lo riducono: i soldi
 * passano dal conto all'investimento ma restano tuoi (valutati al costo).
 */
export function patrimonioPerMese(
  anno: number,
  saldi: SaldoIniziale[],
  movimentiAnno: Movimento[],
  aree: Map<string, Area>,
): { iniziale: number; fineMese: number[] } {
  const iniziale = centesimi(saldi.filter((s) => s.anno === anno).reduce((t, s) => t + s.importo, 0));
  const flussi = Array(12).fill(0);
  for (const m of movimentiAnno) {
    const a = aree.get(m.areaId);
    if (!a) continue;
    const { mese } = meseDi(m.data);
    if (a.tipo === 'entrata') flussi[mese] += m.importo;
    else if (a.tipo === 'spesa') flussi[mese] -= m.importo;
  }
  let corrente = iniziale;
  const fineMese = flussi.map((f) => (corrente = centesimi(corrente + f)));
  return { iniziale, fineMese };
}

/** Quanto pesa ogni tipo sul segno del saldo: entrate in più, spese e investimenti in meno. */
export const SEGNO: Record<TipoArea, 1 | -1> = { entrata: 1, spesa: -1, investimento: -1 };

/** Giorni in un mese. */
export const giorniNelMese = (anno: number, mese: number) => new Date(anno, mese + 1, 0).getDate();
