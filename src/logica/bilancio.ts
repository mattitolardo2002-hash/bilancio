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

/** Aree di partenza considerate spese fisse finché non si sceglie diversamente. */
const FISSE_PREDEFINITE = new Set(['a_casa', 'a_abb']);

/** Vero se l'area è una spesa fissa (affitto, bollette, abbonamenti). */
export function eFissa(a: Area): boolean {
  return a.tipo === 'spesa' && (a.fissa ?? FISSE_PREDEFINITE.has(a.id));
}

export interface RitmoMese {
  /** Budget di spesa del mese (tutte le aree). */
  budget: number;
  /** Parte del budget per le spese fisse. */
  budgetFisse: number;
  spesoFisse: number;
  spesoLibere: number;
  /** Quanto resta del budget (negativo se superato). */
  resta: number;
  /** Quanto si poteva aver speso fino a oggi andando a passo costante (fisse comprese). */
  atteso: number;
  /** Fisse previste ma non ancora pagate: vanno tenute da parte. */
  fisseDaPagare: number;
}

/**
 * Ritmo delle spese del mese. Le spese fisse si pagano tutte in una volta,
 * quindi contano per intero da subito; solo le altre si distribuiscono sui giorni.
 * `giorniPassati` comprende oggi (il 1° del mese vale 1).
 */
export function ritmoMese(
  movimentiMese: Movimento[], aree: Map<string, Area>, budget: Budget[], mese: number, giorniPassati: number, giorni: number,
): RitmoMese {
  let spesoFisse = 0, spesoLibere = 0, budgetTot = 0, budgetFisse = 0;
  for (const m of movimentiMese) {
    const a = aree.get(m.areaId);
    if (!a || a.tipo !== 'spesa') continue;
    if (eFissa(a)) spesoFisse += m.importo;
    else spesoLibere += m.importo;
  }
  for (const b of budget) {
    const a = aree.get(b.areaId);
    if (!a || a.tipo !== 'spesa') continue;
    const v = b.mesi[mese] ?? 0;
    budgetTot += v;
    if (eFissa(a)) budgetFisse += v;
  }
  const atteso = budgetFisse + ((budgetTot - budgetFisse) * Math.min(giorniPassati, giorni)) / giorni;
  return {
    budget: centesimi(budgetTot),
    budgetFisse: centesimi(budgetFisse),
    spesoFisse: centesimi(spesoFisse),
    spesoLibere: centesimi(spesoLibere),
    resta: centesimi(budgetTot - spesoFisse - spesoLibere),
    atteso: centesimi(atteso),
    fisseDaPagare: centesimi(Math.max(0, budgetFisse - spesoFisse)),
  };
}

/** Giorni in un mese. */
export const giorniNelMese = (anno: number, mese: number) => new Date(anno, mese + 1, 0).getDate();
