import { useCallback, useEffect, useState } from 'react';
import { db } from './dati/db';
import { leggiBlocco } from './dati/blocco';
import { Blocco } from './componenti/Blocco';
import { usePosizione, vai, useApriNuovoMovimento } from './navigazione';
import { BarraNavigazione } from './componenti/BarraNavigazione';
import { NuovoMovimento } from './componenti/NuovoMovimento';
import { useDati } from './dati/usaDati';
import type { Movimento } from './dati/tipi';
import { Home } from './schermate/Home';
import { Altro } from './schermate/Altro';
import { Conti } from './schermate/Conti';
import { Movimenti } from './schermate/Movimenti';
import { Analisi } from './schermate/Analisi';

// Struttura generale: contenuto della sezione scelta + barra in basso.
export function App() {
  const { sezione, dettaglio } = usePosizione();
  const dati = useDati();
  // Finestra del movimento: chiusa, nuova (null) oppure modifica di un movimento.
  const [finestra, setFinestra] = useState<{ m?: Movimento } | null>(null);
  useApriNuovoMovimento(useCallback((m?: Movimento) => setFinestra({ m }), []));

  // Se il browser non permette di salvare (es. navigazione privata) lo diciamo subito,
  // invece di lasciar credere che i dati vengano salvati.
  const [archivioKo, setArchivioKo] = useState(false);
  useEffect(() => {
    db.open().catch(() => setArchivioKo(true));
  }, []);
  // Blocco all'apertura e quando si torna nell'app dopo più di un minuto.
  const [bloccata, setBloccata] = useState<boolean | null>(null);
  useEffect(() => {
    leggiBlocco().then((cfg) => setBloccata(!!cfg));
    let uscita = 0;
    const cambio = () => {
      if (document.hidden) uscita = Date.now();
      else if (uscita && Date.now() - uscita > 60_000) leggiBlocco().then((cfg) => cfg && setBloccata(true));
    };
    document.addEventListener('visibilitychange', cambio);
    return () => document.removeEventListener('visibilitychange', cambio);
  }, []);

  if (archivioKo) {
    return (
      <main className="contenuto">
        <div className="riquadro vuoto-grande">
          <h2>Impossibile salvare i dati</h2>
          <p>Il browser non permette di salvare: esci dalla navigazione privata e riapri l'app.</p>
        </div>
      </main>
    );
  }

  // Finché non sappiamo se c'è il blocco non mostriamo niente: nessun dato visibile.
  if (bloccata === null) return null;
  if (bloccata) return <Blocco onSblocca={() => setBloccata(false)} />;

  return (
    <>
      <main className="contenuto">
        {/* La chiave cambia a ogni schermata: così parte la dissolvenza d'entrata. */}
        <div className="pagina" key={`${sezione}/${dettaglio ?? ''}`}>
          {dati && sezione === 'home' && <Home dati={dati} />}
          {dati && sezione === 'movimenti' && <Movimenti dati={dati} />}
          {dati && sezione === 'analisi' && <Analisi dati={dati} />}
          {dati && sezione === 'altro' && (dettaglio === 'conti' ? <Conti dati={dati} /> : <Altro esporta={dettaglio === 'esporta'} />)}
        </div>
      </main>
      <BarraNavigazione attiva={sezione} onScegli={(id) => vai(id)} onNuovo={() => setFinestra({})} />
      <NuovoMovimento aperta={!!finestra} movimento={finestra?.m} dati={dati} onChiudi={() => setFinestra(null)} />
    </>
  );
}
