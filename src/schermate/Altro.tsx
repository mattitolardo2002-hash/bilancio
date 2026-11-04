import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { IconArrowBackUp, IconBuildingBank, IconChevronRight, IconCloudUpload, IconDownload, IconFileImport, IconFileSpreadsheet, IconInfoCircle, IconLock } from '@tabler/icons-react';
import { db, leggiImpostazione } from '../dati/db';
import { FinestraEsporta, FinestraPassword, ImpostazioneBlocco } from '../componenti/Sicurezza';
import { decifra, eCifrato, type FileCifrato } from '../dati/cifratura';
import { annullaImportazione, applicaBackup, leggiBackup, type ContenutoBackup } from '../dati/importazione';
import { vai } from '../navigazione';
import { Finestra } from '../componenti/Finestra';
import { euro } from '../logica/formato';
import { totali } from '../logica/bilancio';

// Altro: backup, importazione e informazioni sull'app.
export function Altro({ esporta = false }: { esporta?: boolean }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [finestraEsporta, setFinestraEsporta] = useState(esporta);
  const [cifrato, setCifrato] = useState<FileCifrato | null>(null);
  const [anteprima, setAnteprima] = useState<ContenutoBackup | null>(null);
  const [errore, setErrore] = useState('');
  const [esito, setEsito] = useState('');

  const stato = useLiveQuery(async () => ({
    movimenti: await db.movimenti.count(),
    ultimoBackup: await leggiImpostazione('ultimoBackup'),
    copiaPrima: !!(await leggiImpostazione('copiaPrimaImportazione')),
  }));
  // Il browser conferma di non cancellare mai l'archivio? (iPhone: sì quando l'app è sulla schermata Home)
  const [protetto, setProtetto] = useState<boolean | null>(null);
  useEffect(() => {
    navigator.storage?.persist?.().then(setProtetto, () => setProtetto(false));
  }, []);

  const scegliFile = async (f: File | undefined) => {
    if (!f) return;
    try {
      const testo = await f.text();
      let o: unknown = null;
      try {
        o = JSON.parse(testo);
      } catch {
        /* il messaggio chiaro lo dà leggiBackup */
      }
      setErrore('');
      setEsito('');
      // Backup protetto: prima la password, poi l'anteprima.
      if (eCifrato(o)) setCifrato(o);
      else setAnteprima(leggiBackup(testo));
    } catch (e) {
      setErrore((e as Error).message);
    }
  };

  const conferma = async () => {
    if (!anteprima) return;
    try {
      await applicaBackup(anteprima);
      setEsito(`Importati ${anteprima.movimenti.length} movimenti.`);
    } catch {
      // La sostituzione è "tutto o niente": se fallisce, i dati di prima restano intatti.
      setErrore('Importazione non riuscita: i tuoi dati sono rimasti com\'erano.');
    }
    setAnteprima(null);
  };

  const giorniDalBackup = stato?.ultimoBackup
    ? Math.floor((Date.now() - new Date(stato.ultimoBackup).getTime()) / 864e5)
    : null;

  return (
    <>
      <h1 className="titolo-pagina">Altro</h1>

      <button type="button" className="riquadro azione-grande" onClick={() => vai('altro', 'conti')}>
        <span className="azione-icona"><IconBuildingBank size={20} stroke={1.7} /></span>
        <span><strong>Conti e fondi</strong><small>Saldi, valore del PAC e degli altri investimenti</small></span>
        <IconChevronRight size={18} stroke={1.8} className="testo-tenue" />
      </button>

      <button type="button" className="riquadro azione-grande" onClick={() => vai('altro', 'revolut')}>
        <span className="azione-icona"><IconFileSpreadsheet size={20} stroke={1.7} /></span>
        <span><strong>Importa da Revolut</strong><small>Estratto conto CSV: le spese si registrano da sole</small></span>
        <IconChevronRight size={18} stroke={1.8} className="testo-tenue" />
      </button>

      <section className="riquadro">
        <div className="testa-riquadro">
          <h2 className="titolo-riquadro">Backup</h2>
          <span className={`pastiglia ${giorniDalBackup !== null && giorniDalBackup <= 14 ? 'positiva' : 'avviso'}`}>
            {giorniDalBackup === null ? 'Mai fatto' : giorniDalBackup === 0 ? 'Fatto oggi' : `${giorniDalBackup} giorni fa`}
          </span>
        </div>
        <p className="testo-tenue">
          I dati restano solo in questo dispositivo. Ogni tanto salva una copia su iCloud Drive: se cambi telefono o
          cancelli i dati del browser, la ritrovi lì.
        </p>
        <div className="elenco-azioni">
          <button type="button" className="azione" onClick={() => setFinestraEsporta(true)}>
            <span className="azione-icona"><IconCloudUpload size={20} stroke={1.7} /></span>
            <span><strong>Esporta backup</strong><small>{stato?.movimenti ?? 0} movimenti in un file protetto da password</small></span>
          </button>
          <button type="button" className="azione" onClick={() => fileRef.current?.click()}>
            <span className="azione-icona"><IconFileImport size={20} stroke={1.7} /></span>
            <span><strong>Importa backup</strong><small>Da questa app o dalla vecchia pagina sul Mac</small></span>
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={(e) => {
            scegliFile(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
        {errore && <p className="messaggio errore">{errore}</p>}
        {esito && <p className="messaggio">{esito}</p>}
        {stato?.copiaPrima && (
          <button
            type="button"
            className="pulsante-testo"
            onClick={async () => setEsito((await annullaImportazione()) ? 'Ripristinati i dati di prima dell\'importazione.' : '')}
          >
            <IconArrowBackUp size={16} stroke={1.8} /> Ripristina i dati di prima dell'ultima importazione
          </button>
        )}
      </section>

      <section className="riquadro">
        <div className="testa-riquadro">
          <h2 className="titolo-riquadro">Sicurezza dei dati</h2>
          <IconLock size={18} stroke={1.7} className="testo-tenue" />
        </div>
        <ImpostazioneBlocco />
        <ul className="elenco-sicurezza spazio-sopra">
          <li><span className={protetto ? 'punto ok' : 'punto avviso'} />{protetto ? 'Archivio protetto: il telefono non lo cancella da solo' : 'Protezione dell\'archivio non ancora attiva: aggiungi l\'app alla schermata Home'}</li>
          <li><span className="punto ok" />I dati restano solo su questo dispositivo: nessun server, nessun account</li>
          <li><span className="punto ok" />L'app non può inviare dati ad altri siti: il browser lo impedisce</li>
          <li><span className="punto ok" />I backup sono cifrati con la tua password (AES a 256 bit)</li>
          <li><span className="punto ok" />Ogni salvataggio è completo o non avviene: niente dati a metà</li>
          <li><span className="punto ok" />Prima di ogni importazione si conserva una copia dei dati attuali</li>
          <li><span className={giorniDalBackup !== null && giorniDalBackup <= 14 ? 'punto ok' : 'punto avviso'} />Backup su iCloud Drive: {giorniDalBackup === null ? 'mai fatto' : giorniDalBackup === 0 ? 'fatto oggi' : `${giorniDalBackup} giorni fa`}</li>
        </ul>
      </section>

      <section className="riquadro">
        <div className="testa-riquadro">
          <h2 className="titolo-riquadro">Dalla vecchia app</h2>
          <IconInfoCircle size={18} stroke={1.7} className="testo-tenue" />
        </div>
        <ol className="passi">
          <li>Sul Mac apri la vecchia app <em>Bilancio personale</em> (si apre in Safari).</li>
          <li>In alto a destra tocca <em>Esporta backup</em>: il file finisce in Download.</li>
          <li>Qui tocca <em>Importa backup</em> e scegli quel file.</li>
        </ol>
      </section>

      <p className="versione">
        <IconDownload size={14} stroke={1.7} /> Bilancio · versione {__VERSIONE__}
      </p>

      <FinestraEsporta
        aperta={finestraEsporta}
        onChiudi={(fatto) => {
          setFinestraEsporta(false);
          if (fatto) setEsito('Backup esportato.');
        }}
      />
      <FinestraPassword
        aperta={!!cifrato}
        onChiudi={() => setCifrato(null)}
        onPassword={async (pw) => {
          const testo = await decifra(cifrato!, pw);
          setCifrato(null);
          setAnteprima(leggiBackup(testo));
        }}
      />

      <Finestra aperta={!!anteprima} titolo="Importare questo backup?" onChiudi={() => setAnteprima(null)}>
        {anteprima && <Riepilogo c={anteprima} />}
        <p className="testo-tenue">I dati attuali in questo dispositivo verranno sostituiti da quelli del file.</p>
        <div className="fila-pulsanti">
          <button type="button" className="pulsante" onClick={() => setAnteprima(null)}>
            Annulla
          </button>
          <button type="button" className="pulsante primario" onClick={conferma}>
            Importa
          </button>
        </div>
      </Finestra>
    </>
  );
}

// Che cosa c'è nel file, prima di importarlo.
function Riepilogo({ c }: { c: ContenutoBackup }) {
  const aree = new Map(c.aree.map((a) => [a.id, a]));
  const t = totali(c.movimenti, aree);
  const date = c.movimenti.map((m) => m.data).sort();
  return (
    <dl className="riepilogo">
      <div><dt>Origine</dt><dd>{c.origine === 'vecchia app' ? 'Vecchia app sul Mac' : 'Questa app'}</dd></div>
      <div><dt>Movimenti</dt><dd>{c.movimenti.length}{date.length ? ` · dal ${date[0].split('-').reverse().join('/')}` : ''}</dd></div>
      <div><dt>Macro-aree</dt><dd>{c.aree.length}</dd></div>
      <div><dt>Conti</dt><dd>{c.conti.length}</dd></div>
      <div><dt>Entrate</dt><dd>{euro(t.entrata)}</dd></div>
      <div><dt>Spese</dt><dd>{euro(t.spesa)}</dd></div>
    </dl>
  );
}
