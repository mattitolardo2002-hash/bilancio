import type { Area, Movimento } from '../dati/tipi';
import { centesimi } from './formato';

// Lettura dell'estratto conto di Revolut in formato CSV (Excel).
// Il file ha una riga per operazione con colonne tipo:
//   Type, Product, Started Date, Completed Date, Description, Amount, Fee, Currency, State, Balance
// (anche con i nomi in italiano). Si leggono solo le operazioni completate.

export interface RigaRevolut {
  /** Identificativo stabile: reimportando lo stesso file non si creano doppioni. */
  id: string;
  data: string;
  descrizione: string;
  /** Positivo = soldi entrati, negativo = usciti (commissioni comprese). */
  importo: number;
  tipo: string;
  valuta: string;
}

// Nomi possibili di ogni colonna (inglese e italiano), in minuscolo.
const COLONNE: Record<string, string[]> = {
  tipo: ['type', 'tipo'],
  prodotto: ['product', 'prodotto'],
  inizio: ['started date', 'data di inizio', 'data inizio'],
  fine: ['completed date', 'data di completamento', 'data completamento'],
  descrizione: ['description', 'descrizione'],
  importo: ['amount', 'importo'],
  commissione: ['fee', 'commissione', 'commissioni'],
  valuta: ['currency', 'valuta'],
  stato: ['state', 'stato'],
  saldo: ['balance', 'saldo'],
};

/** Divide il testo CSV in righe e celle, rispettando le virgolette. */
function leggiCsv(testo: string): string[][] {
  const t = testo.replace(/^﻿/, '');
  const primaRiga = t.slice(0, t.indexOf('\n') === -1 ? undefined : t.indexOf('\n'));
  const conta = (c: string) => primaRiga.split(c).length;
  const sep = conta(';') > conta(',') ? ';' : conta('\t') > conta(',') ? '\t' : ',';
  const righe: string[][] = [];
  let riga: string[] = [], cella = '', virgolette = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (virgolette) {
      if (c === '"' && t[i + 1] === '"') (cella += '"'), i++;
      else if (c === '"') virgolette = false;
      else cella += c;
    } else if (c === '"') virgolette = true;
    else if (c === sep) riga.push(cella), (cella = '');
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && t[i + 1] === '\n') i++;
      riga.push(cella), (cella = '');
      if (riga.some((x) => x.trim())) righe.push(riga);
      riga = [];
    } else cella += c;
  }
  riga.push(cella);
  if (riga.some((x) => x.trim())) righe.push(riga);
  return righe;
}

/** "−1.234,56", "-1234.56", "12,5" → numero. */
function numero(s: string): number {
  let v = (s ?? '').replace(/[\s€]/g, '').replace('−', '-');
  if (!v) return 0;
  const ultimaVirgola = v.lastIndexOf(','), ultimoPunto = v.lastIndexOf('.');
  if (ultimaVirgola > ultimoPunto) v = v.replace(/\./g, '').replace(',', '.');
  else v = v.replace(/,/g, '');
  const n = Number(v);
  return isFinite(n) ? n : 0;
}

/** "2026-10-03 14:22:11" oppure "03/10/2026 14:22" → "2026-10-03". */
function data(s: string): string | null {
  const v = (s ?? '').trim();
  let m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = v.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return null;
}

/** Impronta breve di un testo (FNV-1a), per gli identificativi. */
function impronta(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
}

/** Legge il file. Lancia un errore chiaro se non è un estratto Revolut. */
export function leggiEstratto(testo: string): RigaRevolut[] {
  const righe = leggiCsv(testo);
  if (righe.length < 1) throw new Error('Il file è vuoto.');
  const intest = righe[0].map((x) => x.trim().toLowerCase());
  const col = (k: string) => intest.findIndex((h) => COLONNE[k].includes(h));
  const ix = Object.fromEntries(Object.keys(COLONNE).map((k) => [k, col(k)]));
  if (ix.importo < 0 || ix.descrizione < 0 || (ix.inizio < 0 && ix.fine < 0)) {
    throw new Error("Questo file non sembra un estratto conto Revolut in formato CSV (Excel).");
  }
  const fuori: RigaRevolut[] = [];
  for (const r of righe.slice(1)) {
    const stato = (r[ix.stato] ?? '').trim().toUpperCase();
    // Solo operazioni concluse: niente rifiutate, annullate o ancora in sospeso.
    if (ix.stato >= 0 && !['COMPLETED', 'COMPLETATO', 'COMPLETATA'].includes(stato)) continue;
    // Data dell'operazione (quando hai pagato), non quella di contabilizzazione.
    const d = data(r[ix.inizio] || r[ix.fine] || '');
    if (!d) continue;
    const lordo = numero(r[ix.importo]);
    const commissione = ix.commissione >= 0 ? Math.abs(numero(r[ix.commissione])) : 0;
    const importo = centesimi(lordo - commissione);
    if (!importo) continue;
    const descrizione = (r[ix.descrizione] ?? '').trim();
    const chiave = [r[ix.inizio], r[ix.importo], descrizione, r[ix.saldo] ?? ''].join('|');
    fuori.push({
      id: 'rv' + impronta(chiave),
      data: d,
      descrizione,
      importo,
      tipo: (r[ix.tipo] ?? '').trim().toUpperCase(),
      valuta: (r[ix.valuta] ?? 'EUR').trim().toUpperCase() || 'EUR',
    });
  }
  return fuori.sort((a, b) => b.data.localeCompare(a.data));
}

/** Nome del negozio "pulito", usato per ricordare l'area scelta: "LIDL 1234 MILANO" → "lidl milano". */
export function chiaveNegozio(descrizione: string): string {
  return descrizione
    .toLowerCase()
    .replace(/[0-9*#.,:;/\\_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .slice(0, 3)
    .join(' ');
}

// Negozi e servizi comuni in Italia → area di partenza (identificativi delle aree iniziali).
const NOTI: [RegExp, string][] = [
  [/esselunga|lidl|coop|conad|carrefour|eurospin|aldi|\bpam\b|iper|penny|\bmd\b|despar|tigros|bennet|naturasi|crai|sigma/i, 'a_spesa'],
  [/\beni\b|\bq8\b|\bip\b|tamoil|esso|shell|benzin|carburant|autostrad|telepass|trenitalia|italo|\batm\b|\batac\b|uber|bolt|free ?now|parchegg|easypark|mooney/i, 'a_auto'],
  [/netflix|spotify|disney|prime video|amazon prime|apple\.com|icloud|google (one|storage)|youtube|dazn|now tv|iliad|\btim\b|vodafone|windtre|wind tre|fastweb|ho\.? mobile|very mobile|kena|chatgpt|openai/i, 'a_abb'],
  [/farmaci|decathlon|palestr|mcfit|virgin active|fitness|\bgym\b|medic|dentist|ottic/i, 'a_sport'],
  [/ristorant|pizzer|trattori|osteria|\bbar\b|caff[eè]|mcdonald|burger|kfc|sushi|deliveroo|glovo|just ?eat|starbucks|pub\b|birreri|gelat|cinema|ticketone|steam|playstation/i, 'a_svago'],
  [/zara|h&m|\bh ?& ?m\b|primark|bershka|pull ?& ?bear|nike|adidas|zalando|sephora|douglas|kiko|barbier|parrucch|uniqlo|ovs|foot ?locker/i, 'a_abbigl'],
  [/ryanair|easyjet|wizz|ita airways|booking|airbnb|expedia|hotel|trivago|vueling/i, 'a_viaggi'],
  [/enel|a2a|hera|iren|acea|edison|eon\b|condomin|affitt/i, 'a_casa'],
];

/**
 * Indovina l'area di una riga: prima le scelte che hai fatto tu in passato,
 * poi i negozi noti. Le ricariche del conto non sono né spese né entrate:
 * vengono proposte come "da ignorare".
 */
export function indovinaArea(
  r: RigaRevolut,
  regole: Record<string, string>,
  aree: Map<string, Area>,
): { areaId?: string; ignora: boolean } {
  const ricordata = regole[chiaveNegozio(r.descrizione)];
  if (ricordata === 'ignora') return { ignora: true };
  if (ricordata && aree.has(ricordata)) return { areaId: ricordata, ignora: false };
  if (/TOPUP|EXCHANGE|RICARICA|CAMBIO/.test(r.tipo) || /^(top-?up|ricarica)/i.test(r.descrizione)) return { ignora: true };
  if (r.importo < 0) {
    const nota = NOTI.find(([re]) => re.test(r.descrizione))?.[1];
    if (nota && aree.has(nota) && aree.get(nota)!.tipo === 'spesa') return { areaId: nota, ignora: false };
  }
  return { ignora: false };
}

/** Un movimento uguale (stessa data e stesso importo) è già stato registrato a mano? */
export function forseGiaPresente(r: RigaRevolut, movimenti: Movimento[]): boolean {
  const imp = Math.abs(r.importo);
  return movimenti.some((m) => m.data === r.data && Math.abs(m.importo - imp) < 0.005 && !m.id.startsWith('rv'));
}
