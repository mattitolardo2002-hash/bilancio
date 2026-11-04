import { useState } from 'react';
import { IconArrowDown, IconArrowUp, IconChevronLeft, IconChevronRight, IconPlus } from '@tabler/icons-react';
import { db, nuovoId } from '../dati/db';
import type { Area, TipoArea } from '../dati/tipi';
import type { DatiApp } from '../dati/usaDati';
import { Finestra } from '../componenti/Finestra';
import { COLORI_AREA, ICONE_AREA, IconaArea } from '../componenti/IconaArea';
import { vai } from '../navigazione';

const GRUPPI: { tipo: TipoArea; titolo: string; etichetta: string }[] = [
  { tipo: 'spesa', titolo: 'Spese', etichetta: 'Spesa' },
  { tipo: 'entrata', titolo: 'Entrate', etichetta: 'Entrata' },
  { tipo: 'investimento', titolo: 'Investimenti', etichetta: 'Investimento' },
];

// Macro-aree: crearle, rinominarle, cambiarne icona e colore, eliminarle.
export function Aree({ dati }: { dati: DatiApp }) {
  const [aperta, setAperta] = useState<Area | { nuova: TipoArea } | null>(null);
  const conteggio = new Map<string, number>();
  for (const m of dati.movimenti) conteggio.set(m.areaId, (conteggio.get(m.areaId) ?? 0) + 1);

  return (
    <>
      <button type="button" className="indietro" onClick={() => vai('altro')}>
        <IconChevronLeft size={20} stroke={1.8} /> Altro
      </button>
      <h1 className="titolo-pagina">Macro-aree</h1>

      {GRUPPI.map(({ tipo, titolo }) => (
        <section key={tipo} className="riquadro">
          <h2 className="titolo-riquadro spazio-sotto">{titolo}</h2>
          {dati.elencoAree
            .filter((a) => a.tipo === tipo)
            .map((a) => (
              <button key={a.id} type="button" className="riga-movimento" onClick={() => setAperta(a)}>
                <IconaArea area={a} />
                <span className="riga-movimento-testo">
                  <span className="riga-movimento-titolo">{a.nome}</span>
                  <span className="riga-movimento-sotto">
                    {conteggio.get(a.id) ?? 0} {conteggio.get(a.id) === 1 ? 'movimento' : 'movimenti'}
                    {a.tipo === 'investimento' && a.fondoId ? ` · va in ${dati.conti.find((c) => c.id === a.fondoId)?.nome ?? '—'}` : ''}
                  </span>
                </span>
                <IconChevronRight size={18} stroke={1.8} className="testo-tenue" />
              </button>
            ))}
          <button type="button" className="pulsante pieno" onClick={() => setAperta({ nuova: tipo })}>
            <IconPlus size={18} stroke={2} /> Nuova area
          </button>
        </section>
      ))}

      {aperta && (
        <ModificaArea
          key={'id' in aperta ? aperta.id : 'nuova'}
          dati={dati}
          area={'id' in aperta ? aperta : undefined}
          tipoNuova={'nuova' in aperta ? aperta.nuova : undefined}
          movimenti={'id' in aperta ? conteggio.get(aperta.id) ?? 0 : 0}
          onChiudi={() => setAperta(null)}
        />
      )}
    </>
  );
}

function ModificaArea({
  dati, area, tipoNuova, movimenti, onChiudi,
}: { dati: DatiApp; area: Area | undefined; tipoNuova: TipoArea | undefined; movimenti: number; onChiudi: () => void }) {
  const [nome, setNome] = useState(area?.nome ?? '');
  const [tipo, setTipo] = useState<TipoArea>(area?.tipo ?? tipoNuova ?? 'spesa');
  const [icona, setIcona] = useState(area?.icona ?? 'puntini');
  const [colore, setColore] = useState(area?.colore ?? 'blu');
  const [fondoId, setFondoId] = useState(area?.fondoId ?? '');
  const [errore, setErrore] = useState('');
  const [elimina, setElimina] = useState(false);
  const [destinazione, setDestinazione] = useState('');
  const fondi = dati.conti.filter((c) => c.tipo === 'investimento');
  const stessoTipo = dati.elencoAree.filter((a) => a.tipo === tipo);
  const posizione = area ? stessoTipo.findIndex((a) => a.id === area.id) : -1;

  const salva = async () => {
    const n = nome.trim();
    if (!n) return setErrore("Scrivi il nome dell'area");
    if (dati.elencoAree.some((a) => a.id !== area?.id && a.nome.toLowerCase() === n.toLowerCase())) return setErrore('Esiste già un’area con questo nome');
    // Se l'area cambia tipo i suoi movimenti cambiano segno (l'avviso è mostrato sopra).
    await db.aree.put({
      id: area?.id ?? nuovoId('a'),
      nome: n,
      tipo,
      icona,
      colore,
      budgetStandard: area?.budgetStandard ?? 0,
      ordine: area?.ordine ?? Math.max(0, ...dati.elencoAree.map((a) => a.ordine)) + 1,
      fondoId: tipo === 'investimento' ? fondoId || undefined : undefined,
    });
    onChiudi();
  };

  // Sposta l'area di un posto tra quelle dello stesso tipo (scambiando l'ordine).
  const sposta = async (d: -1 | 1) => {
    const altra = stessoTipo[posizione + d];
    if (!area || !altra) return;
    await db.transaction('rw', db.aree, async () => {
      await db.aree.update(area.id, { ordine: altra.ordine });
      await db.aree.update(altra.id, { ordine: area.ordine });
    });
    onChiudi();
  };

  // Elimina: i movimenti dell'area (se ci sono) passano a un'altra area. Niente va perso.
  const eliminaArea = async () => {
    if (!area) return;
    if (movimenti && !destinazione) return setErrore('Scegli dove spostare i movimenti');
    await db.transaction('rw', [db.aree, db.movimenti, db.budget], async () => {
      if (movimenti) await db.movimenti.where('areaId').equals(area.id).modify({ areaId: destinazione });
      await db.budget.filter((b) => b.areaId === area.id).delete();
      await db.aree.delete(area.id);
    });
    onChiudi();
  };

  if (elimina && area) {
    return (
      <Finestra aperta titolo={`Eliminare ${area.nome}?`} onChiudi={onChiudi}>
        {movimenti > 0 ? (
          <>
            <p className="testo-tenue">Quest'area ha {movimenti} {movimenti === 1 ? 'movimento' : 'movimenti'}: scegli in quale area spostarli. Il suo budget viene cancellato.</p>
            <label className="riga-scelta">
              <span>Sposta in</span>
              <select value={destinazione} onChange={(e) => { setDestinazione(e.target.value); setErrore(''); }}>
                <option value="">Scegli…</option>
                {dati.elencoAree.filter((a) => a.id !== area.id && a.tipo === area.tipo).map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
              </select>
            </label>
          </>
        ) : (
          <p className="testo-tenue">Non ha movimenti: si elimina e basta.</p>
        )}
        {errore && <p className="messaggio errore">{errore}</p>}
        <div className="fila-pulsanti">
          <button type="button" className="pulsante" onClick={() => setElimina(false)}>Annulla</button>
          <button type="button" className="pulsante pericolo" onClick={eliminaArea}>Elimina</button>
        </div>
      </Finestra>
    );
  }

  return (
    <Finestra aperta titolo={area ? 'Modifica area' : 'Nuova area'} onChiudi={onChiudi}>
      <div className="anteprima-area">
        <IconaArea area={{ icona, colore }} misura={52} />
        <input type="text" value={nome} onChange={(e) => { setNome(e.target.value); setErrore(''); }} placeholder="Nome dell'area" aria-label="Nome" />
      </div>
      <div className="segmenti">
        {GRUPPI.map((g) => (
          <button key={g.tipo} type="button" aria-selected={tipo === g.tipo} onClick={() => setTipo(g.tipo)}>{g.etichetta}</button>
        ))}
      </div>
      {area && tipo !== area.tipo && movimenti > 0 && (
        <p className="messaggio avviso-testo">I suoi {movimenti} movimenti diventeranno {GRUPPI.find((g) => g.tipo === tipo)!.titolo.toLowerCase()}.</p>
      )}
      <div className="scelta-icone tutte" role="radiogroup" aria-label="Icona">
        {Object.entries(ICONE_AREA).map(([k, Ic]) => (
          <button key={k} type="button" role="radio" aria-checked={icona === k} aria-label={k} onClick={() => setIcona(k)}
            style={{ color: COLORI_AREA[colore], background: icona === k ? `color-mix(in srgb, ${COLORI_AREA[colore]} 18%, transparent)` : undefined }}>
            <Ic size={20} stroke={1.7} />
          </button>
        ))}
      </div>
      <div className="scelta-colori" role="radiogroup" aria-label="Colore">
        {Object.entries(COLORI_AREA).map(([k, v]) => (
          <button key={k} type="button" role="radio" aria-checked={colore === k} aria-label={k} onClick={() => setColore(k)} style={{ background: v }} />
        ))}
      </div>
      {tipo === 'investimento' && (
        <label className="riga-scelta">
          <span>I soldi vanno in</span>
          <select value={fondoId} onChange={(e) => setFondoId(e.target.value)}>
            <option value="">Nessun fondo</option>
            {fondi.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
          </select>
        </label>
      )}
      {area && (
        <div className="fila-pulsanti">
          <button type="button" className="pulsante" onClick={() => sposta(-1)} disabled={posizione <= 0}><IconArrowUp size={18} stroke={1.8} /> Su</button>
          <button type="button" className="pulsante" onClick={() => sposta(1)} disabled={posizione >= stessoTipo.length - 1}><IconArrowDown size={18} stroke={1.8} /> Giù</button>
        </div>
      )}
      {errore && <p className="messaggio errore">{errore}</p>}
      <div className="fila-pulsanti">
        {area && <button type="button" className="pulsante pericolo" onClick={() => { setErrore(''); setElimina(true); }}>Elimina</button>}
        <button type="button" className="pulsante primario" onClick={salva}>Salva</button>
      </div>
    </Finestra>
  );
}
