import { useState } from 'react';
import { IconChevronLeft, IconPlus, IconStar } from '@tabler/icons-react';
import { db, nuovoId, scriviImpostazione } from '../dati/db';
import type { Conto } from '../dati/tipi';
import type { DatiApp } from '../dati/usaDati';
import { saldoConto } from '../logica/conti';
import { dataLocale, euro, leggiImporto, dataBreve } from '../logica/formato';
import { Finestra, Conferma } from '../componenti/Finestra';
import { ICONE_AREA, COLORI_AREA } from '../componenti/IconaArea';
import { RigaConto } from './Home';
import { vai } from '../navigazione';

// Icone adatte a conti e fondi (sottoinsieme del catalogo delle aree).
const ICONE_CONTO = ['banca', 'carta', 'portafoglio', 'contanti', 'grafico', 'crescita', 'salvadanaio', 'scudo', 'monete', 'casa', 'auto', 'aereo'];

// Conti e fondi: saldi di partenza, valori aggiornati e collegamento degli investimenti.
export function Conti({ dati }: { dati: DatiApp }) {
  const [aperto, setAperto] = useState<Conto | 'nuovo' | null>(null);
  const oggi = dataLocale();
  const investimenti = dati.elencoAree.filter((a) => a.tipo === 'investimento');
  const fondi = dati.conti.filter((c) => c.tipo === 'investimento');

  return (
    <>
      <button type="button" className="indietro" onClick={() => vai('altro')}>
        <IconChevronLeft size={20} stroke={1.8} /> Altro
      </button>
      <h1 className="titolo-pagina">Conti e fondi</h1>

      <section className="riquadro">
        {dati.conti.length === 0 && <p className="testo-tenue">Aggiungi il tuo primo conto.</p>}
        {dati.conti.map((c) => (
          <RigaConto key={c.id} c={c} saldo={saldoConto(c.id, oggi, dati)} dati={dati} principale={c.id === dati.principaleId} onTocca={() => setAperto(c)} />
        ))}
        <button type="button" className="pulsante pieno" onClick={() => setAperto('nuovo')}>
          <IconPlus size={18} stroke={2} /> Aggiungi conto o fondo
        </button>
      </section>

      {investimenti.length > 0 && (
        <section className="riquadro">
          <h2 className="titolo-riquadro">Dove vanno gli investimenti</h2>
          <p className="testo-tenue piccolo spazio-sotto">
            Quando registri un investimento, i soldi escono dal conto e crescono nel fondo scelto qui.
          </p>
          {investimenti.map((a) => (
            <label key={a.id} className="riga-scelta">
              <span>{a.nome}</span>
              <select
                value={a.fondoId ?? ''}
                onChange={(e) => db.aree.update(a.id, { fondoId: e.target.value || undefined })}
              >
                <option value="">Nessun fondo</option>
                {fondi.map((f) => (
                  <option key={f.id} value={f.id}>{f.nome}</option>
                ))}
              </select>
            </label>
          ))}
        </section>
      )}

      <ModificaConto dati={dati} conto={aperto} onChiudi={() => setAperto(null)} />
    </>
  );
}

function ModificaConto({ dati, conto, onChiudi }: { dati: DatiApp; conto: Conto | 'nuovo' | null; onChiudi: () => void }) {
  const nuovo = conto === 'nuovo';
  const c = conto && conto !== 'nuovo' ? conto : undefined;
  const anno = new Date().getFullYear();
  const oggi = dataLocale();
  const saldoIniziale = c ? dati.saldiIniziali.find((s) => s.id === `${anno}:${c.id}`)?.importo : undefined;
  const ultimoValore = c
    ? dati.valutazioni.filter((v) => v.contoId === c.id).sort((x, y) => x.data.localeCompare(y.data)).pop()
    : undefined;

  // Lo stato del modulo si ricrea a ogni apertura grazie alla chiave sul componente interno.
  if (!conto) return null;
  return (
    <Modulo
      key={c?.id ?? 'nuovo'}
      dati={dati}
      c={c}
      nuovo={nuovo}
      anno={anno}
      oggi={oggi}
      saldoIniziale={saldoIniziale}
      ultimoValore={ultimoValore}
      onChiudi={onChiudi}
    />
  );
}

function Modulo({
  dati, c, nuovo, anno, oggi, saldoIniziale, ultimoValore, onChiudi,
}: {
  dati: DatiApp;
  c: Conto | undefined;
  nuovo: boolean;
  anno: number;
  oggi: string;
  saldoIniziale: number | undefined;
  ultimoValore: { data: string; importo: number } | undefined;
  onChiudi: () => void;
}) {
  const [nome, setNome] = useState(c?.nome ?? '');
  const [tipo, setTipo] = useState<Conto['tipo']>(c?.tipo ?? 'liquidita');
  const [icona, setIcona] = useState(c?.icona ?? 'banca');
  const [colore, setColore] = useState(c?.colore ?? 'blu');
  const [iniziale, setIniziale] = useState(saldoIniziale !== undefined ? String(saldoIniziale).replace('.', ',') : '');
  const [valoreOggi, setValoreOggi] = useState('');
  const [errore, setErrore] = useState('');
  const [eliminare, setEliminare] = useState(false);
  const usato = c ? dati.movimenti.some((m) => m.contoId === c.id) || dati.elencoAree.some((a) => a.fondoId === c.id) : false;

  const salva = async () => {
    if (!nome.trim()) return setErrore('Scrivi il nome');
    const ini = iniziale.trim() === '' ? null : leggiImporto(iniziale);
    const val = valoreOggi.trim() === '' ? null : leggiImporto(valoreOggi);
    if (iniziale.trim() !== '' && ini === null) return setErrore('Saldo iniziale non valido');
    if (valoreOggi.trim() !== '' && val === null) return setErrore('Valore di oggi non valido');
    const id = c?.id ?? nuovoId('c');
    // Tutto insieme: o si salva tutto o niente.
    await db.transaction('rw', [db.conti, db.saldiIniziali, db.valutazioni], async () => {
      await db.conti.put({ id, nome: nome.trim(), tipo, icona, colore, ordine: c?.ordine ?? dati.conti.length });
      if (ini !== null) await db.saldiIniziali.put({ id: `${anno}:${id}`, anno, contoId: id, importo: ini });
      else await db.saldiIniziali.delete(`${anno}:${id}`);
      if (val !== null) await db.valutazioni.put({ id: `${id}:${oggi}`, contoId: id, data: oggi, importo: val });
    });
    onChiudi();
  };

  const elimina = async () => {
    if (!c) return;
    await db.transaction('rw', [db.conti, db.saldiIniziali, db.valutazioni], async () => {
      await db.conti.delete(c.id);
      await db.saldiIniziali.filter((s) => s.contoId === c.id).delete();
      await db.valutazioni.where('contoId').equals(c.id).delete();
    });
    setEliminare(false);
    onChiudi();
  };

  const saldoCalcolato = c ? saldoConto(c.id, oggi, dati) : 0;

  return (
    <>
      <Finestra aperta titolo={nuovo ? 'Nuovo conto o fondo' : c!.nome} onChiudi={onChiudi}>
        <label className="campo">
          <span>Nome</span>
          <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Conto corrente" />
        </label>
        <div className="segmenti">
          <button type="button" aria-selected={tipo === 'liquidita'} onClick={() => setTipo('liquidita')}>Conto o carta</button>
          <button type="button" aria-selected={tipo === 'investimento'} onClick={() => setTipo('investimento')}>Fondo o investimento</button>
        </div>
        <div className="scelta-icone" role="radiogroup" aria-label="Icona">
          {ICONE_CONTO.map((k) => {
            const Ic = ICONE_AREA[k];
            return (
              <button key={k} type="button" role="radio" aria-checked={icona === k} onClick={() => setIcona(k)}
                style={{ color: COLORI_AREA[colore], background: icona === k ? `color-mix(in srgb, ${COLORI_AREA[colore]} 18%, transparent)` : undefined }}>
                <Ic size={20} stroke={1.7} />
              </button>
            );
          })}
        </div>
        <div className="scelta-colori" role="radiogroup" aria-label="Colore">
          {Object.entries(COLORI_AREA).map(([k, v]) => (
            <button key={k} type="button" role="radio" aria-checked={colore === k} aria-label={k} onClick={() => setColore(k)} style={{ background: v }} />
          ))}
        </div>
        <label className="campo">
          <span>Saldo al 1° gennaio {anno}</span>
          <input type="text" inputMode="decimal" value={iniziale} onChange={(e) => setIniziale(e.target.value)} placeholder="0,00" />
        </label>
        {!nuovo && (
          <label className="campo">
            <span>
              {tipo === 'investimento' ? 'Valore di oggi (lo leggi sull’app del broker)' : 'Saldo vero di oggi (se non torna)'}
            </span>
            <input type="text" inputMode="decimal" value={valoreOggi} onChange={(e) => setValoreOggi(e.target.value)} placeholder={euro(saldoCalcolato)} />
            <small>
              Calcolato dall'app: {euro(saldoCalcolato)}
              {ultimoValore && ` · ultimo aggiornamento ${dataBreve(ultimoValore.data)}`}
            </small>
          </label>
        )}
        {!nuovo && tipo === 'liquidita' && c!.id !== dati.principaleId && (
          <button type="button" className="pulsante" onClick={() => scriviImpostazione('contoPrincipale', c!.id)}>
            <IconStar size={18} stroke={1.8} /> Rendi conto principale
          </button>
        )}
        {errore && <p className="messaggio errore">{errore}</p>}
        <div className="fila-pulsanti">
          {!nuovo && (
            <button type="button" className="pulsante pericolo" onClick={() => (usato ? setErrore('Ci sono movimenti o investimenti collegati: non si può eliminare.') : setEliminare(true))}>
              Elimina
            </button>
          )}
          <button type="button" className="pulsante primario" onClick={salva}>
            Salva
          </button>
        </div>
      </Finestra>
      <Conferma aperta={eliminare} titolo="Eliminare il conto?" testo="Si cancellano anche i suoi saldi salvati." etichetta="Elimina" onConferma={elimina} onAnnulla={() => setEliminare(false)} />
    </>
  );
}
