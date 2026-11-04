import { db, scriviImpostazione } from './db';
import { dataLocale } from '../logica/formato';
import { cifra } from './cifratura';

/** Fotografia completa di tutti i dati, nel formato del backup. */
export async function copiaCompleta() {
  // Letti dentro un'unica transazione: la copia è coerente anche se nel frattempo si salva qualcosa.
  return db.transaction('r', [db.aree, db.movimenti, db.budget, db.conti, db.saldiIniziali, db.valutazioni], async () => ({
    app: 'bilancio',
    versione: 1,
    esportatoIl: new Date().toISOString(),
    tabelle: {
      aree: await db.aree.toArray(),
      movimenti: await db.movimenti.toArray(),
      budget: await db.budget.toArray(),
      conti: await db.conti.toArray(),
      saldiIniziali: await db.saldiIniziali.toArray(),
      valutazioni: await db.valutazioni.toArray(),
    },
  }));
}

// Backup completo in un file da conservare (iCloud Drive, AirDrop, email),
// cifrato con la password scelta: senza password il file è illeggibile.
export async function esportaBackup(password: string): Promise<void> {
  const contenuto = await cifra(JSON.stringify(await copiaCompleta()), password);
  const file = new Blob([JSON.stringify(contenuto)], { type: 'application/json' });
  const nome = `bilancio-backup-${dataLocale()}.json`;

  // Su iPhone si apre il menu Condividi (Salva su File, AirDrop…); sul Mac si scarica.
  const comeFile = new File([file], nome, { type: 'application/json' });
  if (navigator.canShare?.({ files: [comeFile] })) {
    try {
      await navigator.share({ files: [comeFile] });
      await scriviImpostazione('ultimoBackup', new Date().toISOString());
      return;
    } catch (e) {
      if ((e as Error).name === 'AbortError') return; // l'utente ha chiuso il menu
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file);
  a.download = nome;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  await scriviImpostazione('ultimoBackup', new Date().toISOString());
}
