import { useEffect, useState } from 'react';
import { IconFaceId, IconLock, IconLockOpen } from '@tabler/icons-react';
import { esportaBackup } from '../dati/esportazione';
import { attivaBlocco, creaPasskey, disattivaBlocco, faceIdDisponibile, leggiBlocco, verificaCodice } from '../dati/blocco';
import { Finestra } from './Finestra';

// Finestre legate alla sicurezza: backup con password e blocco dell'app.

/** Chiede la password e salva il backup cifrato. */
export function FinestraEsporta({ aperta, onChiudi }: { aperta: boolean; onChiudi: (fatto: boolean) => void }) {
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [errore, setErrore] = useState('');
  const [lavoro, setLavoro] = useState(false);
  useEffect(() => {
    if (aperta) setPw(''), setPw2(''), setErrore('');
  }, [aperta]);

  const esporta = async () => {
    if (pw.length < 8) return setErrore('Usa almeno 8 caratteri');
    if (pw !== pw2) return setErrore('Le due password non coincidono');
    setLavoro(true);
    try {
      await esportaBackup(pw);
      onChiudi(true);
    } catch {
      setErrore('Backup non riuscito: riprova');
    }
    setLavoro(false);
  };

  return (
    <Finestra aperta={aperta} titolo="Backup protetto" onChiudi={() => onChiudi(false)}>
      <p className="testo-tenue">
        Il file viene cifrato con questa password: senza, nessuno può leggerlo. Annotala in un posto sicuro (anche le
        Password dell'iPhone vanno bene): senza password il backup non si può più aprire.
      </p>
      <label className="campo">
        <span>Password del backup</span>
        <input type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
      </label>
      <label className="campo">
        <span>Ripeti la password</span>
        <input type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && esporta()} />
      </label>
      {errore && <p className="messaggio errore">{errore}</p>}
      <button type="button" className="pulsante primario" onClick={esporta} disabled={lavoro}>
        {lavoro ? 'Cifratura…' : 'Esporta backup'}
      </button>
    </Finestra>
  );
}

/** Chiede la password di un backup cifrato. onPassword deve lanciare un errore se è sbagliata. */
export function FinestraPassword({
  aperta,
  onChiudi,
  onPassword,
}: {
  aperta: boolean;
  onChiudi: () => void;
  onPassword: (pw: string) => Promise<void>;
}) {
  const [pw, setPw] = useState('');
  const [errore, setErrore] = useState('');
  const [lavoro, setLavoro] = useState(false);
  useEffect(() => {
    if (aperta) setPw(''), setErrore('');
  }, [aperta]);
  const apri = async () => {
    setLavoro(true);
    try {
      await onPassword(pw);
    } catch (e) {
      setErrore((e as Error).message);
    }
    setLavoro(false);
  };
  return (
    <Finestra aperta={aperta} titolo="Backup protetto da password" onChiudi={onChiudi}>
      <label className="campo">
        <span>Password del backup</span>
        <input type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && apri()} />
      </label>
      {errore && <p className="messaggio errore">{errore}</p>}
      <button type="button" className="pulsante primario" onClick={apri} disabled={lavoro}>
        {lavoro ? 'Apertura…' : 'Apri backup'}
      </button>
    </Finestra>
  );
}

/** Riga "Blocco con Face ID" nella sezione sicurezza, con attivazione e disattivazione. */
export function ImpostazioneBlocco() {
  const [attivo, setAttivo] = useState<boolean | null>(null);
  const [conFaceId, setConFaceId] = useState(false);
  const [finestra, setFinestra] = useState<'attiva' | 'disattiva' | null>(null);
  const [codice, setCodice] = useState('');
  const [codice2, setCodice2] = useState('');
  const [errore, setErrore] = useState('');

  const aggiorna = () =>
    leggiBlocco().then((c) => {
      setAttivo(!!c);
      setConFaceId(!!c?.credenziale);
    });
  useEffect(() => {
    aggiorna();
  }, []);

  const apri = (f: 'attiva' | 'disattiva') => {
    setCodice('');
    setCodice2('');
    setErrore('');
    setFinestra(f);
  };

  const attiva = async () => {
    if (!/^\d{6}$/.test(codice)) return setErrore('Il codice deve avere 6 cifre');
    if (codice !== codice2) return setErrore('I due codici non coincidono');
    let credenziale: string | undefined;
    if (await faceIdDisponibile()) {
      try {
        credenziale = await creaPasskey();
      } catch {
        // Face ID rifiutato o non disponibile: resta il blocco con il codice.
      }
    }
    await attivaBlocco(codice, credenziale);
    setFinestra(null);
    aggiorna();
  };

  const disattiva = async () => {
    const cfg = await leggiBlocco();
    if (!cfg || !(await verificaCodice(cfg, codice))) return setErrore('Codice sbagliato');
    await disattivaBlocco();
    setFinestra(null);
    aggiorna();
  };

  if (attivo === null) return null;
  return (
    <>
      <button type="button" className="azione" onClick={() => apri(attivo ? 'disattiva' : 'attiva')}>
        <span className="azione-icona">{attivo ? <IconLock size={20} stroke={1.7} /> : <IconLockOpen size={20} stroke={1.7} />}</span>
        <span>
          <strong>{attivo ? (conFaceId ? 'Blocco con Face ID attivo' : 'Blocco con codice attivo') : 'Attiva il blocco dell’app'}</strong>
          <small>{attivo ? 'Tocca per disattivarlo' : 'Face ID all’apertura, con codice di riserva'}</small>
        </span>
      </button>

      <Finestra aperta={finestra === 'attiva'} titolo="Blocco dell'app" onChiudi={() => setFinestra(null)}>
        <p className="testo-tenue">
          Scegli un codice di 6 cifre di riserva, da usare se Face ID non funziona. Poi l'iPhone ti chiederà Face ID per
          collegarlo all'app.
        </p>
        <label className="campo">
          <span>Codice di 6 cifre</span>
          <input type="password" inputMode="numeric" autoComplete="off" maxLength={6} value={codice} onChange={(e) => setCodice(e.target.value.replace(/\D/g, ''))} />
        </label>
        <label className="campo">
          <span>Ripeti il codice</span>
          <input type="password" inputMode="numeric" autoComplete="off" maxLength={6} value={codice2} onChange={(e) => setCodice2(e.target.value.replace(/\D/g, ''))} />
        </label>
        {errore && <p className="messaggio errore">{errore}</p>}
        <button type="button" className="pulsante primario" onClick={attiva}>
          <IconFaceId size={20} stroke={1.7} /> Attiva blocco
        </button>
      </Finestra>

      <Finestra aperta={finestra === 'disattiva'} titolo="Disattivare il blocco?" onChiudi={() => setFinestra(null)}>
        <label className="campo">
          <span>Inserisci il codice di 6 cifre</span>
          <input type="password" inputMode="numeric" autoComplete="off" maxLength={6} value={codice} onChange={(e) => setCodice(e.target.value.replace(/\D/g, ''))} />
        </label>
        {errore && <p className="messaggio errore">{errore}</p>}
        <button type="button" className="pulsante pericolo" onClick={disattiva}>
          Disattiva blocco
        </button>
      </Finestra>
    </>
  );
}
