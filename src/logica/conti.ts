import type { Area, Conto, Movimento, SaldoIniziale, Valutazione } from '../dati/tipi';
import { centesimi } from './formato';

// Saldi dei conti e dei fondi.
//
// Il saldo di un conto parte dal "punto fermo" più recente:
//  - il saldo al 1° gennaio di un anno, oppure
//  - un valore aggiornato a mano (es. il valore degli ETF letto sull'app del broker);
// poi si aggiungono i movimenti successivi:
//  - entrate sul conto: +   spese dal conto: −
//  - investimento: − dal conto da cui escono i soldi, + nel fondo dell'area.
// I movimenti senza conto valgono per il conto principale.

export interface DatiConti {
  conti: Conto[];
  movimenti: Movimento[];
  aree: Map<string, Area>;
  saldiIniziali: SaldoIniziale[];
  valutazioni: Valutazione[];
  principaleId: string | undefined;
}

/** Conto principale: quello scelto, altrimenti il primo conto di liquidità. */
export function contoPrincipale(conti: Conto[], scelto: string | undefined): string | undefined {
  if (scelto && conti.some((c) => c.id === scelto)) return scelto;
  return [...conti].sort((a, b) => a.ordine - b.ordine).find((c) => c.tipo === 'liquidita')?.id ?? conti[0]?.id;
}

/** Effetto di un movimento sul saldo di un conto (0 se non lo riguarda). */
export function effetto(m: Movimento, contoId: string, d: Pick<DatiConti, 'aree' | 'principaleId'>): number {
  const a = d.aree.get(m.areaId);
  if (!a) return 0;
  const da = m.contoId ?? d.principaleId;
  let e = 0;
  if (a.tipo === 'entrata' && da === contoId) e += m.importo;
  if (a.tipo === 'spesa' && da === contoId) e -= m.importo;
  if (a.tipo === 'investimento') {
    if (da === contoId) e -= m.importo;
    if (a.fondoId === contoId) e += m.importo;
  }
  return e;
}

interface PuntoFermo {
  /** I movimenti di questo giorno e precedenti sono già compresi. */
  data: string;
  importo: number;
}

function puntiFermi(contoId: string, d: DatiConti, conValutazioni: boolean): PuntoFermo[] {
  const p: PuntoFermo[] = d.saldiIniziali
    .filter((s) => s.contoId === contoId)
    .map((s) => ({ data: `${s.anno - 1}-12-31`, importo: s.importo }));
  if (conValutazioni) for (const v of d.valutazioni) if (v.contoId === contoId) p.push({ data: v.data, importo: v.importo });
  return p;
}

/** Saldo di un conto a fine giornata della data indicata (AAAA-MM-GG). */
export function saldoConto(contoId: string, finoA: string, d: DatiConti, conValutazioni = true): number {
  const base = puntiFermi(contoId, d, conValutazioni)
    .filter((p) => p.data <= finoA)
    .sort((x, y) => x.data.localeCompare(y.data))
    .pop() ?? { data: '0000-00-00', importo: 0 };
  let s = base.importo;
  for (const m of d.movimenti) if (m.data > base.data && m.data <= finoA) s += effetto(m, contoId, d);
  return centesimi(s);
}

/** Patrimonio a fine giornata: somma di tutti i conti e fondi. */
export function patrimonioAl(finoA: string, d: DatiConti): number {
  return centesimi(d.conti.reduce((t, c) => t + saldoConto(c.id, finoA, d), 0));
}

/**
 * Per un fondo d'investimento: quanto hai messo (saldo iniziale + versamenti)
 * e quanto vale oggi secondo l'ultimo valore aggiornato.
 */
export function andamentoFondo(contoId: string, oggi: string, d: DatiConti) {
  const versato = saldoConto(contoId, oggi, d, false);
  const valore = saldoConto(contoId, oggi, d, true);
  const ultimaValutazione = d.valutazioni
    .filter((v) => v.contoId === contoId && v.data <= oggi)
    .sort((x, y) => x.data.localeCompare(y.data))
    .pop();
  const guadagno = centesimi(valore - versato);
  return { versato, valore, guadagno, rendimento: versato ? guadagno / versato : 0, ultimaValutazione };
}
