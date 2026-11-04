import { useMemo, useRef, useState } from 'react';
import { IconCheck, IconChevronLeft, IconEyeOff, IconFileSpreadsheet, IconQuestionMark } from '@tabler/icons-react';
import { db, leggiImpostazione, scriviImpostazione } from '../dati/db';
import type { Movimento } from '../dati/tipi';
import type { DatiApp } from '../dati/usaDati';
import { chiaveNegozio, forseGiaPresente, indovinaArea, leggiEstratto, type RigaRevolut } from '../logica/revolut';
import { dataBreve, euro, euroTondo } from '../logica/formato';
import { Finestra } from '../componenti/Finestra';
import { IconaArea } from '../componenti/IconaArea';
import { vai } from '../navigazione';

interface Scelta {
  areaId?: string;
  ignora: boolean;
  /** Già importata in passato (stesso identificativo): non si importa di nuovo. */
  presente: boolean;
  /** Stessa data e importo di un movimento scritto a mano: forse è un doppione. */
  dubbio: boolean;
  /** Scelta fatta a mano in questa importazione: da ricordare per la prossima volta. */
  manuale: boolean;
}

// Importazione dell'estratto conto Revolut: l'app riconosce i negozi,
// salta i doppioni e chiede l'area solo per quello che non conosce.
export function Revolut({ dati }: { dati: DatiApp }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [righe, setRighe] = useState<RigaRevolut[] | null>(null);
  const [scelte, setScelte] = useState<Record<string, Scelta>>({});
  const [errore, setErrore] = useState('');
  const [aperta, setAperta] = useState<RigaRevolut | null>(null);
  const [soloDaFare, setSoloDaFare] = useState(true);
  const [fatto, setFatto] = useState<{ n: number; uscite: number } | null>(null);
  const contiLiquidi = dati.conti.filter((c) => c.tipo === 'liquidita');
  const [contoId, setContoId] = useState(
    () => contiLiquidi.find((c) => /revolut/i.test(c.nome))?.id ?? dati.principaleId ?? '',
  );

  const apriFile = async (f: File | undefined) => {
    if (!f) return;
    setErrore('');
    setFatto(null);
    try {
      const lette = leggiEstratto(await f.text());
      if (!lette.length) throw new Error('Nel file non ci sono operazioni completate.');
      const regole = JSON.parse((await leggiImpostazione('regoleRevolut')) ?? '{}') as Record<string, string>;
      const esistenti = new Set(dati.movimenti.map((m) => m.id));
      const s: Record<string, Scelta> = {};
      for (const r of lette) {
        const g = indovinaArea(r, regole, dati.aree);
        const presente = esistenti.has(r.id);
        const dubbio = !presente && forseGiaPresente(r, dati.movimenti);
        // Le operazioni in un'altra valuta si saltano: l'importo non sarebbe in euro.
        const estera = r.valuta !== 'EUR';
        s[r.id] = { ...g, ignora: g.ignora || dubbio || estera, presente, dubbio, manuale: false };
      }
      setRighe(lette);
      setScelte(s);
    } catch (e) {
      setErrore((e as Error).message);
    }
  };

  const conteggi = useMemo(() => {
    const c = { totali: 0, pronti: 0, daFare: 0, ignorati: 0, presenti: 0, uscite: 0 };
    for (const r of righe ?? []) {
      const s = scelte[r.id];
      c.totali++;
      if (s.presente) c.presenti++;
      else if (s.ignora) c.ignorati++;
      else if (s.areaId) {
        c.pronti++;
        if (r.importo < 0) c.uscite += -r.importo;
      } else c.daFare++;
    }
    return c;
  }, [righe, scelte]);

  const scegli = (r: RigaRevolut, s: Partial<Scelta>) => setScelte((p) => ({ ...p, [r.id]: { ...p[r.id], ...s, manuale: true } }));

  const importa = async () => {
    if (!righe) return;
    const nuovi: Movimento[] = [];
    const regole = JSON.parse((await leggiImpostazione('regoleRevolut')) ?? '{}') as Record<string, string>;
    const adesso = new Date().toISOString();
    for (const r of righe) {
      const s = scelte[r.id];
      // L'app impara: le scelte fatte a mano valgono per la prossima volta.
      if (s.manuale && !s.presente) regole[chiaveNegozio(r.descrizione)] = s.ignora ? 'ignora' : s.areaId ?? '';
      if (s.presente || s.ignora || !s.areaId) continue;
      nuovi.push({ id: r.id, data: r.data, descrizione: abbellisci(r.descrizione), areaId: s.areaId, importo: Math.abs(r.importo), contoId: contoId || undefined, creato: adesso });
    }
    // Tutto insieme: o si importano tutti, o nessuno.
    await db.transaction('rw', [db.movimenti, db.impostazioni], async () => {
      await db.movimenti.bulkPut(nuovi);
      await scriviImpostazione('regoleRevolut', JSON.stringify(regole));
    });
    setFatto({ n: nuovi.length, uscite: conteggi.uscite });
    setRighe(null);
  };

  const visibili = (righe ?? []).filter((r) => {
    const s = scelte[r.id];
    return !soloDaFare || (!s.presente && !s.ignora && !s.areaId) || s.dubbio;
  });

  return (
    <>
      <button type="button" className="indietro" onClick={() => vai('altro')}>
        <IconChevronLeft size={20} stroke={1.8} /> Altro
      </button>
      <h1 className="titolo-pagina">Importa da Revolut</h1>

      {fatto && (
        <section className="riquadro vuoto-grande">
          <span className="vuoto-icona"><IconCheck size={26} stroke={2} /></span>
          <h2>Importati {fatto.n} movimenti</h2>
          <p>La prossima volta i negozi che hai scelto oggi verranno riconosciuti da soli.</p>
          <button type="button" className="pulsante primario" onClick={() => vai('movimenti')}>Vedi i movimenti</button>
        </section>
      )}

      {!righe && (
        <section className="riquadro">
          <h2 className="titolo-riquadro">Come scaricare l'estratto</h2>
          <ol className="passi spazio-sopra">
            <li>Apri l'app <em>Revolut</em> e tocca il conto in euro.</li>
            <li>Tocca <em>⋯ Altro</em>, poi <em>Estratto conto</em>.</li>
            <li>Scegli il formato <em>Excel</em> (CSV) e il periodo, per esempio il mese scorso.</li>
            <li>Salva il file in <em>File</em> (o mandalo con AirDrop), poi scegli quel file qui sotto.</li>
          </ol>
          <button type="button" className="pulsante primario pieno" onClick={() => fileRef.current?.click()}>
            <IconFileSpreadsheet size={20} stroke={1.8} /> Scegli l'estratto conto
          </button>
          <p className="testo-tenue piccolo spazio-sopra">Il file viene letto solo qui sul telefono: non va da nessuna parte.</p>
          {errore && <p className="messaggio errore">{errore}</p>}
        </section>
      )}
      <input ref={fileRef} type="file" accept=".csv,text/csv,text/comma-separated-values,application/vnd.ms-excel" hidden onChange={(e) => { apriFile(e.target.files?.[0]); e.target.value = ''; }} />

      {righe && (
        <>
          <section className="riquadro">
            <div className="testa-riquadro">
              <h2 className="titolo-riquadro">{conteggi.totali} operazioni trovate</h2>
              <button type="button" className="pulsante-testo" onClick={() => fileRef.current?.click()}>Cambia file</button>
            </div>
            <div className="griglia-kpi">
              <div className="tessera-piccola"><span className="etichetta">Riconosciute</span><span className="importo-medio positivo">{conteggi.pronti}</span></div>
              <div className="tessera-piccola"><span className="etichetta">Da assegnare</span><span className={`importo-medio ${conteggi.daFare ? 'avviso-testo' : ''}`}>{conteggi.daFare}</span></div>
              <div className="tessera-piccola"><span className="etichetta">Già presenti</span><span className="importo-medio">{conteggi.presenti}</span></div>
              <div className="tessera-piccola"><span className="etichetta">Ignorate</span><span className="importo-medio testo-tenue">{conteggi.ignorati}</span></div>
            </div>
            {contiLiquidi.length > 0 && (
              <label className="riga-scelta spazio-sopra">
                <span>Conto</span>
                <select value={contoId} onChange={(e) => setContoId(e.target.value)}>
                  {contiLiquidi.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </label>
            )}
          </section>

          <div className="segmenti">
            <button type="button" aria-selected={soloDaFare} onClick={() => setSoloDaFare(true)}>Da controllare</button>
            <button type="button" aria-selected={!soloDaFare} onClick={() => setSoloDaFare(false)}>Tutte</button>
          </div>

          <section className="riquadro">
            {visibili.length === 0 && <p className="testo-tenue">Tutto a posto: non c'è niente da controllare.</p>}
            {visibili.map((r) => {
              const s = scelte[r.id];
              const area = s.areaId ? dati.aree.get(s.areaId) : undefined;
              const sotto = s.presente
                ? 'Già importata'
                : s.dubbio && s.ignora
                  ? 'Forse già registrata a mano: ignorata'
                  : r.valuta !== 'EUR'
                    ? `In ${r.valuta}: ignorata`
                    : s.ignora
                      ? 'Ignorata (es. ricarica o giroconto)'
                      : area
                        ? area.nome
                        : "Scegli l'area";
              return (
                <button key={r.id} type="button" className={`riga-movimento ${s.presente || s.ignora ? 'riga-spenta' : ''}`} onClick={() => !s.presente && setAperta(r)}>
                  {s.ignora || s.presente ? (
                    <span className="icona-area icona-neutra" style={{ width: 40, height: 40 }}><IconEyeOff size={18} stroke={1.7} /></span>
                  ) : area ? (
                    <IconaArea area={area} />
                  ) : (
                    <span className="icona-area icona-dubbio" style={{ width: 40, height: 40 }}><IconQuestionMark size={20} stroke={2} /></span>
                  )}
                  <span className="riga-movimento-testo">
                    <span className="riga-movimento-titolo">{abbellisci(r.descrizione)}</span>
                    <span className={`riga-movimento-sotto ${!area && !s.ignora && !s.presente ? 'avviso-testo' : ''}`}>{dataBreve(r.data)} · {sotto}</span>
                  </span>
                  <span className={`numero importo-riga ${r.importo > 0 ? 'positivo' : ''}`}>{r.importo > 0 ? '+' : '−'}{euro(Math.abs(r.importo))}</span>
                </button>
              );
            })}
          </section>

          <div className="barra-importa">
            <button type="button" className="pulsante primario grande" onClick={importa} disabled={!conteggi.pronti}>
              Importa {conteggi.pronti} movimenti{conteggi.uscite ? ` · ${euroTondo(conteggi.uscite)} di uscite` : ''}
            </button>
            {conteggi.daFare > 0 && <p className="testo-tenue piccolo centrato">Quelle senza area non vengono importate.</p>}
          </div>
        </>
      )}

      <Finestra aperta={!!aperta} titolo={aperta ? abbellisci(aperta.descrizione) : ''} onChiudi={() => setAperta(null)}>
        {aperta && (
          <>
            <p className="testo-tenue">
              {dataBreve(aperta.data)} · <span className={aperta.importo > 0 ? 'positivo' : ''}>{euro(aperta.importo)}</span>
            </p>
            <div className="griglia-aree griglia-aree-piena">
              {dati.elencoAree
                .filter((a) => (aperta.importo > 0 ? a.tipo === 'entrata' : a.tipo !== 'entrata'))
                .map((a) => (
                  <button key={a.id} type="button" role="radio" aria-checked={scelte[aperta.id]?.areaId === a.id && !scelte[aperta.id]?.ignora} className="scelta-area"
                    onClick={() => { scegli(aperta, { areaId: a.id, ignora: false }); setAperta(null); }}>
                    <IconaArea area={a} misura={36} />
                    <span>{a.nome}</span>
                  </button>
                ))}
            </div>
            <button type="button" className="pulsante" onClick={() => { scegli(aperta, { ignora: true }); setAperta(null); }}>
              <IconEyeOff size={18} stroke={1.8} /> Non importare (giroconto, ricarica…)
            </button>
            <p className="testo-tenue piccolo">La scelta viene ricordata per i prossimi estratti con lo stesso negozio.</p>
          </>
        )}
      </Finestra>
    </>
  );
}

/** "LIDL ITALIA S.R.L." → "Lidl Italia S.r.l.": più leggibile negli elenchi. */
function abbellisci(s: string): string {
  if (s !== s.toUpperCase()) return s;
  return s.toLowerCase().replace(/(^|[\s(-])(\p{L})/gu, (_, a, b) => a + b.toUpperCase());
}
