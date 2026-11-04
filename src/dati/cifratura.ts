// Cifratura con gli strumenti già presenti nel browser (Web Crypto):
// niente librerie esterne, algoritmi standard usati anche dalle banche.
//  - dalla password si ricava una chiave con PBKDF2-SHA256 (molte ripetizioni:
//    provare password a caso diventa lentissimo);
//  - i dati si cifrano con AES-GCM a 256 bit, che si accorge anche di ogni
//    modifica al file: una password sbagliata o un file alterato non si aprono.

const ITERAZIONI = 600_000;

export const inBase64 = (b: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(b instanceof Uint8Array ? b : new Uint8Array(b))));
export const daBase64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
export const casuali = (n: number) => crypto.getRandomValues(new Uint8Array(n));

async function chiave(password: string, sale: Uint8Array, iterazioni: number, usi: KeyUsage[]): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: sale as BufferSource, iterations: iterazioni },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    usi,
  );
}

export interface FileCifrato {
  app: 'bilancio';
  cifrato: true;
  versione: 1;
  iterazioni: number;
  sale: string;
  iv: string;
  dati: string;
}

/** Cifra un testo con una password. */
export async function cifra(testo: string, password: string): Promise<FileCifrato> {
  const sale = casuali(16);
  const iv = casuali(12);
  const k = await chiave(password, sale, ITERAZIONI, ['encrypt']);
  const dati = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, k, new TextEncoder().encode(testo));
  return { app: 'bilancio', cifrato: true, versione: 1, iterazioni: ITERAZIONI, sale: inBase64(sale), iv: inBase64(iv), dati: inBase64(dati) };
}

/** Decifra; lancia un errore chiaro se la password è sbagliata o il file è rovinato. */
export async function decifra(f: FileCifrato, password: string): Promise<string> {
  const k = await chiave(password, daBase64(f.sale), f.iterazioni, ['decrypt']);
  try {
    const chiaro = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: daBase64(f.iv) as BufferSource }, k, daBase64(f.dati) as BufferSource);
    return new TextDecoder().decode(chiaro);
  } catch {
    throw new Error('Password sbagliata (oppure il file è stato modificato).');
  }
}

export function eCifrato(o: unknown): o is FileCifrato {
  return !!o && typeof o === 'object' && (o as FileCifrato).cifrato === true && typeof (o as FileCifrato).dati === 'string';
}

/** Impronta di un codice (per il blocco): si salva questa, mai il codice. */
export async function impronta(codice: string, sale: Uint8Array, iterazioni = 300_000): Promise<string> {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(codice), 'PBKDF2', false, ['deriveBits']);
  const bit = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: sale as BufferSource, iterations: iterazioni }, base, 256);
  return inBase64(bit);
}
