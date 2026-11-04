// Numeri, importi e date in formato italiano.

// Separatore delle migliaia sempre presente ("1.250"): di default l'italiano
// lo omette sotto 10.000. Il tipo è allargato perché 'always' è recente.
const GRUPPI = 'always' as unknown as boolean;
const formatoEuro = new Intl.NumberFormat('it-IT', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  useGrouping: GRUPPI,
});
const formatoIntero = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 0, useGrouping: GRUPPI });

/** Arrotonda ai centesimi, evitando errori come 0,1 + 0,2 = 0,30000000000000004. */
export const centesimi = (n: number) => Math.round(n * 100) / 100;

/** 1250.5 → "1.250,50 €"; i negativi hanno il vero segno meno "−". */
export function euro(n: number): string {
  const v = centesimi(n);
  return (v < 0 ? '−' : '') + formatoEuro.format(Math.abs(v)) + ' €';
}

/** Come euro() ma senza decimali: "1.251 €". Per grafici e riquadri piccoli. */
export function euroTondo(n: number): string {
  const v = Math.round(n);
  return (v < 0 ? '−' : '') + formatoIntero.format(Math.abs(v)) + ' €';
}

/** Importo diviso in parte intera e decimali, per mostrarli con pesi diversi. */
export function euroDiviso(n: number): { segno: string; intero: string; decimali: string } {
  const v = centesimi(n);
  const [intero, decimali] = formatoEuro.format(Math.abs(v)).split(',');
  return { segno: v < 0 ? '−' : '', intero, decimali: decimali ?? '00' };
}

/** Variazione con segno: "+612,30 €" oppure "−40,00 €". */
export function euroConSegno(n: number): string {
  const v = centesimi(n);
  return (v > 0 ? '+' : '') + euro(v);
}

/** 0.694 → "69%". */
export function percentuale(n: number): string {
  return isFinite(n) ? Math.round(n * 100) + '%' : '—';
}

/**
 * Legge un importo scritto dall'utente: accetta "23,50", "23.50", "1.250,00" e "€ 12".
 * Restituisce null se il testo non è un importo valido.
 */
export function leggiImporto(testo: string): number | null {
  let s = String(testo ?? '').replace(/[€\s]/g, '');
  if (s === '') return null;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  if (!/^-?\d*\.?\d+$/.test(s)) return null;
  return centesimi(Number(s));
}

export const MESI = [
  'gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre',
];
export const MESI_BREVI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];

/** "Novembre 2026" */
export function nomeMese(anno: number, mese: number): string {
  const n = MESI[mese];
  return n[0].toUpperCase() + n.slice(1) + ' ' + anno;
}

/** Data locale in formato AAAA-MM-GG (non UTC: alle 00:30 è già oggi, non ieri). */
export function dataLocale(d: Date = new Date()): string {
  const due = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${due(d.getMonth() + 1)}-${due(d.getDate())}`;
}

function daTesto(data: string): Date {
  const [a, m, g] = data.split('-').map(Number);
  return new Date(a, m - 1, g);
}

/** "Oggi", "Ieri" oppure "lunedì 3 novembre". */
export function giornoRelativo(data: string): string {
  const oggi = dataLocale();
  const ieri = dataLocale(new Date(Date.now() - 864e5));
  if (data === oggi) return 'Oggi';
  if (data === ieri) return 'Ieri';
  const t = daTesto(data).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
  return t[0].toUpperCase() + t.slice(1);
}

/** "2026-11-03" → "3 nov". */
export function dataBreve(data: string): string {
  return daTesto(data).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
}
