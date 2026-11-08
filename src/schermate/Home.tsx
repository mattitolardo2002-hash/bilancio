import { useMemo, useState, type ReactNode } from 'react';
import {
  IconArrowDownRight, IconArrowUpRight, IconCloudUpload, IconChevronDown, IconChevronLeft, IconChevronRight, IconFileImport, IconPlus,
} from '@tabler/icons-react';
import type { Area, Budget, Conto, Movimento } from '../dati/tipi';
import type { DatiApp } from '../dati/usaDati';
import { andamentoFondo, patrimonioAl, saldoConto } from '../logica/conti';
import {
  chiaveMese, giorniNelMese, patrimonioPerMese, perArea, totali, budgetDi, ritmoMese,
} from '../logica/bilancio';
import {
  MESI, MESI_BREVI, dataLocale, euro, euroConSegno, euroTondo, giornoRelativo, percentuale,
} from '../logica/formato';
import { IconaArea, COLORI_AREA } from '../componenti/IconaArea';
import { MiniLinea } from '../componenti/Grafici';
import { ImportoGrande } from '../componenti/Importo';
import { Finestra } from '../componenti/Finestra';
import { apriNuovoMovimento, vai } from '../navigazione';

// Home: prima quanto puoi ancora spendere, poi patrimonio, aree da tenere d'occhio e ultimi movimenti.
export function Home({ dati }: { dati: DatiApp }) {
  const oggi = new Date();
  const [periodo, setPeriodo] = useState({ anno: oggi.getFullYear(), mese: oggi.getMonth() });
  const [sceltaMese, setSceltaMese] = useState(false);
  const { anno, mese } = periodo;
  const eMeseCorrente = anno === oggi.getFullYear() && mese === oggi.getMonth();

  const calcoli = useMemo(() => {
    const { aree } = dati;
    const dellAnno = dati.movimenti.filter((m) => m.data.startsWith(`${anno}-`));
    const delMese = dellAnno.filter((m) => m.data.startsWith(chiaveMese(anno, mese)));
    const budget = dati.budget.filter((b) => b.anno === anno);
    const t = totali(delMese, aree);
    const giorni = giorniNelMese(anno, mese);
    const ritmo = ritmoMese(delMese, aree, budget, mese, eMeseCorrente ? oggi.getDate() : giorni, giorni);
    // Patrimonio: dai saldi dei conti se ci sono, altrimenti solo dai movimenti dell'anno.
    let iniziale: number, fineMese: number[];
    if (dati.conti.length) {
      iniziale = patrimonioAl(`${anno - 1}-12-31`, dati);
      fineMese = Array.from({ length: 12 }, (_, i) => {
        const fine = dataLocale(new Date(anno, i + 1, 0));
        // Nel mese in corso conta la situazione di oggi.
        return patrimonioAl(anno === oggi.getFullYear() && i === oggi.getMonth() ? dataLocale() : fine, dati);
      });
    } else {
      ({ iniziale, fineMese } = patrimonioPerMese(anno, dati.saldiIniziali, dellAnno, aree));
    }
    return { delMese, budget, t, ritmo, giorni, pat: { iniziale, fineMese } };
  }, [dati, anno, mese]);

  const { delMese, budget, t, ritmo, giorni, pat } = calcoli;

  // Patrimonio a fine mese scelto (a oggi se è il mese corrente) e variazione nel mese.
  const patrimonio = pat.fineMese[mese];
  const variazione = patrimonio - (mese === 0 ? pat.iniziale : pat.fineMese[mese - 1]);
  const senzaSaldi = dati.saldiIniziali.length === 0 && dati.valutazioni.length === 0;
  const nome = MESI[mese][0].toUpperCase() + MESI[mese].slice(1);

  return (
    <>
      <header className="testata-home">
        <div>
          <span className="sopratitolo">Il tuo bilancio</span>
          <h1 className="titolo-pagina">{nome}</h1>
        </div>
        <button type="button" className="pillola-mese" onClick={() => setSceltaMese(true)} aria-label="Scegli il mese">
          {MESI_BREVI[mese][0].toUpperCase() + MESI_BREVI[mese].slice(1)} {anno}
          <IconChevronDown size={16} stroke={2} />
        </button>
      </header>

      <PromemoriaBackup dati={dati} />

      <RiquadroSpendere
        ritmo={ritmo}
        t={t}
        eMeseCorrente={eMeseCorrente}
        giorniRimasti={eMeseCorrente ? giorni - oggi.getDate() + 1 : 0}
      />

      <section className="riquadro" aria-label="Patrimonio stimato">
        <div className="patrimonio">
          <div className="patrimonio-testo">
            <span className="etichetta">Patrimonio stimato</span>
            <span className="importo-patrimonio">{euroTondo(patrimonio)}</span>
            <span className={`pastiglia ${variazione >= 0 ? 'positiva' : 'negativa'}`}>
              {variazione >= 0 ? <IconArrowUpRight size={14} stroke={2.2} /> : <IconArrowDownRight size={14} stroke={2.2} />}
              {euroConSegno(variazione)} {eMeseCorrente ? 'questo mese' : 'nel mese'}
            </span>
          </div>
          <MiniLinea valori={[pat.iniziale, ...pat.fineMese.slice(0, mese + 1)]} />
        </div>
        {dati.conti.length > 0 && <ContiInFila dati={dati} />}
        {senzaSaldi && (
          <button type="button" className="nota-azione" onClick={() => vai('altro', 'conti')}>
            Inserisci il saldo dei tuoi conti e fondi per un patrimonio preciso
            <IconChevronRight size={16} stroke={1.8} />
          </button>
        )}
      </section>

      {delMese.length === 0 ? (
        <MeseVuoto />
      ) : (
        <>
          <DaTenereDocchio movimenti={delMese} aree={dati.elencoAree} budget={budget} mese={mese} totaleSpese={t.spesa} />
          <UltimiMovimenti movimenti={delMese} aree={dati.aree} />
        </>
      )}

      {/* Montata solo quando serve: così riparte sempre dall'anno scelto. */}
      {sceltaMese && <SceltaMese
        aperta
        anno={anno}
        mese={mese}
        onScegli={(a, m) => {
          setPeriodo({ anno: a, mese: m });
          setSceltaMese(false);
        }}
        onChiudi={() => setSceltaMese(false)}
      />}
    </>
  );
}

/** Il numero più importante: quanto resta del budget, quanto al giorno e se sei in linea. */
function RiquadroSpendere({
  ritmo, t, eMeseCorrente, giorniRimasti,
}: { ritmo: ReturnType<typeof ritmoMese>; t: ReturnType<typeof totali>; eMeseCorrente: boolean; giorniRimasti: number }) {
  const { budget, spesoFisse, spesoLibere, resta, atteso, fisseDaPagare } = ritmo;
  const totaliMese = (
    <div className="tre-totali">
      <div><span className="etichetta">Entrate</span><span className="importo-medio positivo">{euroTondo(t.entrata)}</span></div>
      <div><span className="etichetta">Spese</span><span className="importo-medio">{euroTondo(t.spesa)}</span></div>
      <div><span className="etichetta">Investito</span><span className="importo-medio accento">{euroTondo(t.investimento)}</span></div>
    </div>
  );

  if (budget <= 0) {
    return (
      <section className="riquadro riquadro-eroe" aria-label="Spese del mese">
        <span className="etichetta">Spese del mese</span>
        <ImportoGrande valore={t.spesa} />
        <button type="button" className="nota-azione" onClick={() => vai('analisi')}>
          Imposta un budget di spesa per sapere ogni giorno quanto puoi ancora spendere
          <IconChevronRight size={16} stroke={1.8} />
        </button>
        {totaliMese}
      </section>
    );
  }

  const superato = resta < 0;
  const alGiorno = giorniRimasti > 0 ? Math.max(0, resta - fisseDaPagare) / giorniRimasti : 0;
  const avanti = spesoFisse + spesoLibere - atteso;
  // Sotto l'1% del budget non vale la pena segnalarlo.
  const sopraRitmo = eMeseCorrente && avanti > budget * 0.01;
  const scala = Math.max(budget, spesoFisse + spesoLibere);
  const quota = (v: number) => `${(v / scala) * 100}%`;

  return (
    <section className="riquadro riquadro-eroe" aria-label="Quanto puoi ancora spendere">
      <span className="etichetta">{superato ? 'Budget superato di' : eMeseCorrente ? 'Puoi ancora spendere' : 'Avanzato dal budget'}</span>
      <ImportoGrande valore={Math.abs(resta)} className={superato ? 'negativo' : ''} />
      {eMeseCorrente && !superato && giorniRimasti > 0 && (
        <p className="testo-tenue piccolo">
          circa <strong className="testo-chiaro">{euroTondo(alGiorno)} al giorno</strong> per {giorniRimasti} {giorniRimasti === 1 ? 'giorno' : 'giorni'}
          {fisseDaPagare > 0 && <> · {euroTondo(fisseDaPagare)} tenuti da parte per le fisse</>}
        </p>
      )}
      <div className="barra-ritmo" aria-hidden="true">
        <span className="fisse" style={{ width: quota(spesoFisse) }} />
        <span className={superato ? 'oltre' : 'libere'} style={{ width: quota(spesoLibere) }} />
        {eMeseCorrente && <i className="tacca-oggi" style={{ left: quota(atteso) }} />}
      </div>
      <div className="legenda-ritmo">
        <span><i className="fisse" />Fisse {euroTondo(spesoFisse)}</span>
        <span><i className="libere" />Altre {euroTondo(spesoLibere)}</span>
        <span className="spinta" />
        {eMeseCorrente && !superato && (
          <span className={`pastiglia ${sopraRitmo ? 'avviso' : 'positiva'}`}>
            {sopraRitmo ? `Avanti di ${euroTondo(avanti)}` : 'In linea'}
          </span>
        )}
      </div>
      {totaliMese}
    </section>
  );
}

/** Conti e fondi come schede che scorrono di lato. */
function ContiInFila({ dati }: { dati: DatiApp }) {
  const oggi = dataLocale();
  return (
    <div className="conti-in-fila">
      {dati.conti.map((c) => {
        const saldo = saldoConto(c.id, oggi, dati);
        const f = c.tipo === 'investimento' ? andamentoFondo(c.id, oggi, dati) : null;
        return (
          <button key={c.id} type="button" className="scheda-conto" onClick={() => vai('altro', 'conti')}>
            <span className="scheda-conto-nome">{c.nome}</span>
            <span className="numero">{euroTondo(saldo)}</span>
            {f?.ultimaValutazione && (
              <span className={`scheda-conto-sotto ${f.guadagno >= 0 ? 'positivo' : 'negativo'}`}>
                {f.rendimento >= 0 ? '+' : ''}{percentuale(f.rendimento)}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Finestra per scegliere il mese: anno con le frecce e i 12 mesi. */
function SceltaMese({
  aperta, anno, mese, onScegli, onChiudi,
}: { aperta: boolean; anno: number; mese: number; onScegli: (a: number, m: number) => void; onChiudi: () => void }) {
  const oggi = new Date();
  const [annoVisto, setAnnoVisto] = useState(anno);
  return (
    <Finestra aperta={aperta} titolo="Scegli il mese" onChiudi={onChiudi}>
      <div className="barra-periodo">
        <button type="button" className="pulsante-tondo" onClick={() => setAnnoVisto(annoVisto - 1)} aria-label="Anno precedente">
          <IconChevronLeft size={20} stroke={1.8} />
        </button>
        <strong>{annoVisto}</strong>
        <button type="button" className="pulsante-tondo" onClick={() => setAnnoVisto(annoVisto + 1)} disabled={annoVisto >= oggi.getFullYear()} aria-label="Anno successivo">
          <IconChevronRight size={20} stroke={1.8} />
        </button>
      </div>
      <div className="griglia-mesi">
        {MESI_BREVI.map((m, i) => (
          <button
            key={m}
            type="button"
            className="chip"
            aria-checked={annoVisto === anno && i === mese}
            disabled={annoVisto === oggi.getFullYear() && i > oggi.getMonth()}
            onClick={() => onScegli(annoVisto, i)}
          >
            {m}
          </button>
        ))}
      </div>
    </Finestra>
  );
}

export function RigaConto({ c, saldo, dati, principale, onTocca }: { c: Conto; saldo: number; dati: DatiApp; principale: boolean; onTocca?: () => void }) {
  let sotto: ReactNode = c.tipo === 'liquidita' ? (principale ? 'Conto principale' : 'Conto') : 'Fondo';
  if (c.tipo === 'investimento') {
    const f = andamentoFondo(c.id, dataLocale(), dati);
    sotto = f.ultimaValutazione ? (
      <>
        <span className={f.guadagno >= 0 ? 'positivo' : 'negativo'}>
          {f.guadagno >= 0 ? '+' : ''}
          {euroTondo(f.guadagno)} ({f.rendimento >= 0 ? '+' : ''}
          {percentuale(f.rendimento)})
        </span>{' '}
        · versati {euroTondo(f.versato)}
      </>
    ) : (
      `Versati ${euroTondo(f.versato)}`
    );
  }
  return (
    <button type="button" className="riga-movimento riga-conto" onClick={onTocca ?? (() => vai('altro', 'conti'))}>
      <IconaArea area={c} />
      <span className="riga-movimento-testo">
        <span className="riga-movimento-titolo">{c.nome}</span>
        <span className="riga-movimento-sotto">{sotto}</span>
      </span>
      <span className="numero importo-riga">{euro(saldo)}</span>
    </button>
  );
}

/** Ricorda di fare il backup se l'ultimo è di più di 14 giorni fa. */
function PromemoriaBackup({ dati }: { dati: DatiApp }) {
  if (!dati.movimenti.length) return null;
  const giorni = dati.ultimoBackup ? Math.floor((Date.now() - Date.parse(dati.ultimoBackup)) / 864e5) : null;
  if (giorni !== null && giorni <= 14) return null;
  return (
    <button type="button" className="promemoria" onClick={() => vai('altro', 'esporta')}>
      <IconCloudUpload size={20} stroke={1.7} />
      <span>
        <strong>{giorni === null ? 'Non hai ancora fatto un backup' : `Ultimo backup ${giorni} giorni fa`}</strong>
        <small>Tocca per salvare una copia su iCloud Drive</small>
      </span>
    </button>
  );
}

/** Prima le aree sforate o quasi al limite; le altre si aprono con "Tutte le aree". */
function DaTenereDocchio({
  movimenti, aree, budget, mese, totaleSpese,
}: { movimenti: Movimento[]; aree: Area[]; budget: Budget[]; mese: number; totaleSpese: number }) {
  const [tutte, setTutte] = useState(false);
  const somme = perArea(movimenti);
  const righe = aree
    .filter((a) => a.tipo === 'spesa' && (somme.get(a.id) ?? 0) > 0)
    .map((a) => {
      const speso = somme.get(a.id) ?? 0;
      const bud = budgetDi(budget, a.id, mese);
      return { a, speso, budget: bud, quota: bud > 0 ? speso / bud : -1 };
    })
    // Più vicine al limite per prime; quelle senza budget in fondo, per importo.
    .sort((x, y) => y.quota - x.quota || y.speso - x.speso);
  if (!righe.length) return null;
  const mostrate = tutte ? righe : righe.slice(0, 3);
  const massimo = Math.max(...righe.map((r) => r.speso));
  return (
    <section className="riquadro">
      <div className="testa-riquadro">
        <h2 className="titolo-riquadro">{tutte ? 'Spese per area' : 'Da tenere d\'occhio'}</h2>
        {righe.length > 3 && (
          <button type="button" className="pulsante-testo" onClick={() => setTutte(!tutte)}>
            {tutte ? 'Mostra meno' : `Tutte le aree (${righe.length})`}
          </button>
        )}
      </div>
      <ul className="elenco-aree">
        {mostrate.map(({ a, speso, budget: bud, quota }) => {
          const oltre = bud > 0 && speso > bud;
          const vicino = bud > 0 && !oltre && quota >= 0.9;
          const colore = oltre ? 'var(--negativo)' : vicino ? 'var(--avviso)' : COLORI_AREA[a.colore] ?? COLORI_AREA.grigio;
          return (
            <li key={a.id}>
              <IconaArea area={a} />
              <div className="elenco-aree-centro">
                <div className="elenco-aree-riga">
                  <span className="elenco-aree-nome">{a.nome}</span>
                  <span className={`numero ${oltre ? 'negativo' : ''}`}>{euro(speso)}</span>
                </div>
                <div className="progresso">
                  <span style={{ width: `${Math.min(100, (bud > 0 ? quota : speso / massimo) * 100)}%`, background: colore }} />
                </div>
                <span className="elenco-aree-sotto">
                  {bud > 0 ? (
                    oltre ? (
                      <span className="negativo">{euroTondo(speso - bud)} oltre il budget di {euroTondo(bud)}</span>
                    ) : (
                      <>restano <strong className={vicino ? 'avviso-testo' : 'testo-chiaro'}>{euro(bud - speso)}</strong> di {euroTondo(bud)}</>
                    )
                  ) : (
                    `${percentuale(speso / totaleSpese)} delle spese · senza budget`
                  )}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function UltimiMovimenti({ movimenti, aree }: { movimenti: Movimento[]; aree: Map<string, Area> }) {
  const ultimi = [...movimenti].sort((x, y) => y.data.localeCompare(x.data) || y.creato.localeCompare(x.creato)).slice(0, 3);
  return (
    <section className="riquadro">
      <div className="testa-riquadro">
        <h2 className="titolo-riquadro">Ultimi movimenti</h2>
        <button type="button" className="pulsante-testo" onClick={() => vai('movimenti')}>
          Vedi tutti
        </button>
      </div>
      {ultimi.map((m) => (
        <RigaMovimento key={m.id} m={m} area={aree.get(m.areaId)} conGiorno />
      ))}
    </section>
  );
}

export function RigaMovimento({ m, area, conGiorno = false }: { m: Movimento; area: Area | undefined; conGiorno?: boolean }) {
  const tipo = area?.tipo ?? 'spesa';
  const segno = tipo === 'entrata' ? '+' : '−';
  return (
    <button type="button" className="riga-movimento" onClick={() => apriNuovoMovimento(m)}>
      <IconaArea area={area} />
      <span className="riga-movimento-testo">
        <span className="riga-movimento-titolo">{m.descrizione || area?.nome || 'Movimento'}</span>
        <span className="riga-movimento-sotto">
          {conGiorno && `${giornoRelativo(m.data)} · `}
          {m.descrizione ? area?.nome : tipo === 'entrata' ? 'Entrata' : tipo === 'investimento' ? 'Investimento' : 'Spesa'}
        </span>
      </span>
      <span className={`numero importo-riga ${tipo === 'entrata' ? 'positivo' : tipo === 'investimento' ? 'accento' : ''}`}>
        {segno}
        {euro(m.importo)}
      </span>
    </button>
  );
}

function MeseVuoto() {
  return (
    <section className="riquadro vuoto-grande">
      <span className="vuoto-icona" aria-hidden="true">
        <IconPlus size={26} stroke={1.8} />
      </span>
      <h2>Nessun movimento in questo mese</h2>
      <p>Registra la prima spesa o entrata: qui vedrai budget, aree e ultimi movimenti.</p>
      <div className="fila-pulsanti">
        <button type="button" className="pulsante primario" onClick={() => apriNuovoMovimento()}>
          Registra un movimento
        </button>
        <button type="button" className="pulsante" onClick={() => vai('altro')}>
          <IconFileImport size={18} stroke={1.8} /> Importa backup
        </button>
      </div>
    </section>
  );
}

