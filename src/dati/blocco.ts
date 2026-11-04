import { db, leggiImpostazione, scriviImpostazione } from './db';
import { casuali, daBase64, impronta, inBase64 } from './cifratura';

// Blocco all'apertura: Face ID (o Touch ID sul Mac) tramite le passkey del
// sistema, più un codice di 6 cifre di riserva se Face ID non va.
// Del codice si salva solo un'impronta: chi guarda i dati non può risalirci.

interface ConfigBlocco {
  /** Identificativo della passkey creata per l'app (assente se solo codice). */
  credenziale?: string;
  sale: string;
  impronta: string;
}

export async function leggiBlocco(): Promise<ConfigBlocco | null> {
  const t = await leggiImpostazione('blocco');
  return t ? (JSON.parse(t) as ConfigBlocco) : null;
}

/** Il dispositivo ha Face ID / Touch ID utilizzabile dal browser? */
export async function faceIdDisponibile(): Promise<boolean> {
  try {
    return !!(await window.PublicKeyCredential?.isUserVerifyingPlatformAuthenticatorAvailable?.());
  } catch {
    return false;
  }
}

/** Crea la passkey: il sistema chiede Face ID per confermare. Restituisce l'identificativo. */
export async function creaPasskey(): Promise<string> {
  const c = (await navigator.credentials.create({
    publicKey: {
      rp: { name: 'Bilancio' },
      user: { id: casuali(16), name: 'Bilancio', displayName: 'Bilancio personale' },
      challenge: casuali(32),
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },
        { type: 'public-key', alg: -257 },
      ],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'preferred' },
      timeout: 60_000,
    },
  })) as PublicKeyCredential | null;
  if (!c) throw new Error('Face ID non attivato');
  return inBase64(c.rawId);
}

/** Chiede Face ID. true se riconosciuto. */
export async function verificaFaceId(credenziale: string): Promise<boolean> {
  try {
    const r = await navigator.credentials.get({
      publicKey: {
        challenge: casuali(32),
        allowCredentials: [{ type: 'public-key', id: daBase64(credenziale) as BufferSource }],
        userVerification: 'required',
        timeout: 60_000,
      },
    });
    return !!r;
  } catch {
    return false;
  }
}

export async function verificaCodice(cfg: ConfigBlocco, codice: string): Promise<boolean> {
  return (await impronta(codice, daBase64(cfg.sale))) === cfg.impronta;
}

export async function attivaBlocco(codice: string, credenziale: string | undefined): Promise<void> {
  const sale = casuali(16);
  const cfg: ConfigBlocco = { credenziale, sale: inBase64(sale), impronta: await impronta(codice, sale) };
  await scriviImpostazione('blocco', JSON.stringify(cfg));
}

export async function disattivaBlocco(): Promise<void> {
  await db.impostazioni.delete('blocco');
}
