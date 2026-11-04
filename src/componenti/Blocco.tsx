import { useEffect, useState } from 'react';
import { IconBackspace, IconFaceId, IconLock } from '@tabler/icons-react';
import { leggiBlocco, verificaCodice, verificaFaceId } from '../dati/blocco';

// Schermata di blocco: copre tutta l'app finché non si sblocca.
export function Blocco({ onSblocca }: { onSblocca: () => void }) {
  const [codice, setCodice] = useState('');
  const [errore, setErrore] = useState('');
  const [faceId, setFaceId] = useState<string | undefined>();
  const [errori, setErrori] = useState(0);
  const [attesa, setAttesa] = useState(0);

  const provaFaceId = async (cred = faceId) => {
    if (cred && (await verificaFaceId(cred))) onSblocca();
  };

  useEffect(() => {
    leggiBlocco().then((cfg) => {
      setFaceId(cfg?.credenziale);
      // Si prova subito Face ID; se il sistema chiede un tocco, c'è il pulsante.
      if (cfg?.credenziale) provaFaceId(cfg.credenziale);
    });
  }, []);

  // Dopo 5 codici sbagliati si aspetta, sempre di più: indovinare diventa impossibile.
  useEffect(() => {
    if (attesa <= 0) return;
    const t = setTimeout(() => setAttesa(attesa - 1), 1000);
    return () => clearTimeout(t);
  }, [attesa]);

  const premi = async (t: string) => {
    if (attesa > 0) return;
    setErrore('');
    const nuovo = t === '⌫' ? codice.slice(0, -1) : (codice + t).slice(0, 6);
    setCodice(nuovo);
    if (nuovo.length === 6) {
      const cfg = await leggiBlocco();
      if (cfg && (await verificaCodice(cfg, nuovo))) return onSblocca();
      const n = errori + 1;
      setErrori(n);
      setCodice('');
      setErrore('Codice sbagliato');
      if (n >= 5) setAttesa(30 * 2 ** (n - 5));
    }
  };

  return (
    <div className="blocco">
      <span className="blocco-icona"><IconLock size={28} stroke={1.7} /></span>
      <h1>Bilancio bloccato</h1>
      <p className="testo-tenue">{attesa > 0 ? `Troppi tentativi: riprova tra ${attesa} s` : 'Inserisci il codice'}</p>
      <div className="pallini" aria-label={`${codice.length} cifre su 6`}>
        {Array.from({ length: 6 }, (_, i) => <span key={i} className={i < codice.length ? 'pieno' : ''} />)}
      </div>
      <p className="messaggio errore centrato" role="alert">{errore}</p>
      <div className="tastierino blocco-tasti">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'faceid', '0', '⌫'].map((t) =>
          t === 'faceid' ? (
            faceId ? (
              <button key={t} type="button" onClick={() => provaFaceId()} aria-label="Sblocca con Face ID">
                <IconFaceId size={28} stroke={1.6} />
              </button>
            ) : (
              <span key={t} />
            )
          ) : (
            <button key={t} type="button" onClick={() => premi(t)} aria-label={t === '⌫' ? 'Cancella' : t}>
              {t === '⌫' ? <IconBackspace size={24} stroke={1.6} /> : t}
            </button>
          ),
        )}
      </div>
    </div>
  );
}
