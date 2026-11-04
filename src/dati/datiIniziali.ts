import type { Area, Conto, TipoArea } from './tipi';

// Le macro-aree della vecchia app, con gli stessi identificativi: così
// importando il vecchio backup ogni movimento ritrova la sua area.
const ELENCO: [string, string, TipoArea, string, string][] = [
  // id, nome, tipo, icona, colore
  ['a_stip', 'Stipendio netto', 'entrata', 'valigetta', 'verde'],
  ['a_mens', '13ª e 14ª', 'entrata', 'monete', 'verde'],
  ['a_altre', 'Altre entrate', 'entrata', 'contanti', 'verde'],
  ['a_casa', 'Casa e utenze', 'spesa', 'casa', 'ambra'],
  ['a_spesa', 'Spesa alimentare', 'spesa', 'carrello', 'corallo'],
  ['a_auto', 'Auto e trasporti', 'spesa', 'auto', 'azzurro'],
  ['a_abb', 'Telefono e abbonamenti', 'spesa', 'telefono', 'viola'],
  ['a_sport', 'Sport e salute', 'spesa', 'cuore', 'rosa'],
  ['a_svago', 'Uscite e svago', 'spesa', 'bicchiere', 'arancio'],
  ['a_abbigl', 'Abbigliamento e cura personale', 'spesa', 'maglietta', 'rosa'],
  ['a_viaggi', 'Viaggi e vacanze', 'spesa', 'aereo', 'azzurro'],
  ['a_regali', 'Regali', 'spesa', 'regalo', 'corallo'],
  ['a_varie', 'Varie', 'spesa', 'puntini', 'grigio'],
  ['a_pac', 'PAC ETF', 'investimento', 'grafico', 'blu'],
  ['a_fauto', 'Fondo auto (accantonamento)', 'investimento', 'salvadanaio', 'blu'],
  ['a_emerg', 'Fondo emergenza', 'investimento', 'scudo', 'blu'],
];

// Quale fondo di partenza fa crescere ogni area d'investimento.
const FONDI_INIZIALI: Record<string, string> = { a_pac: 'c_etf', a_fauto: 'c_auto', a_emerg: 'c_emergenza' };

export const AREE_INIZIALI: Area[] = ELENCO.map(([id, nome, tipo, icona, colore], i) => ({
  id,
  nome,
  tipo,
  icona,
  colore,
  budgetStandard: 0,
  ordine: i,
  fondoId: FONDI_INIZIALI[id],
}));

// Conti di partenza, con nomi generici: il codice è pubblico, quindi qui non
// ci sono i nomi delle banche. I conti veri arrivano dal backup o si creano in
// Altro › Conti e fondi (e si rinominano quando si vuole).
export const CONTI_INIZIALI: Conto[] = [
  { id: 'c_conto', nome: 'Conto corrente', tipo: 'liquidita', ordine: 0, icona: 'banca', colore: 'verde' },
  { id: 'c_emergenza', nome: 'Fondo emergenza', tipo: 'investimento', ordine: 1, icona: 'scudo', colore: 'ambra' },
  { id: 'c_auto', nome: 'Fondo auto', tipo: 'investimento', ordine: 2, icona: 'salvadanaio', colore: 'rosa' },
  { id: 'c_etf', nome: 'ETF / PAC', tipo: 'investimento', ordine: 3, icona: 'grafico', colore: 'blu' },
];

/** Icona e colore di un conto creato senza (es. dalla vecchia app), indovinati dal nome. */
export function stileConto(c: Pick<Conto, 'nome' | 'tipo'>): { icona: string; colore: string } {
  if (/etf|pac|broker|azion|trad/i.test(c.nome)) return { icona: 'grafico', colore: 'blu' };
  if (/emergen/i.test(c.nome)) return { icona: 'scudo', colore: 'ambra' };
  if (/auto/i.test(c.nome)) return { icona: 'salvadanaio', colore: 'rosa' };
  if (/fondo|risparm|salvadan/i.test(c.nome)) return { icona: 'salvadanaio', colore: 'viola' };
  if (/carta|card|prepagat/i.test(c.nome)) return { icona: 'carta', colore: 'azzurro' };
  return c.tipo === 'investimento' ? { icona: 'crescita', colore: 'blu' } : { icona: 'banca', colore: 'verde' };
}

/**
 * Collega le aree d'investimento della vecchia app ai fondi, cercando il fondo
 * dal nome (es. "PAC ETF" → il conto d'investimento con "ETF" nel nome).
 */
export function collegaFondi(aree: Area[], conti: Conto[]): void {
  const fondi = conti.filter((c) => c.tipo === 'investimento');
  const regole: Record<string, RegExp> = { a_pac: /etf|pac|broker|azion|trad/i, a_fauto: /auto/i, a_emerg: /emergen/i };
  for (const a of aree) {
    if (a.tipo !== 'investimento' || a.fondoId) continue;
    const parola = a.nome.split(/\s+/)[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const r = regole[a.id] ?? new RegExp(parola, 'i');
    a.fondoId = fondi.find((f) => r.test(f.nome))?.id;
  }
}
