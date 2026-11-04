import { useMemo, useState, type ReactNode } from 'react';
import {
  IconArrowDownRight, IconArrowUpRight, IconCloudUpload, IconChevronLeft, IconChevronRight, IconFileImport, IconPlus,
} from '@tabler/icons-react';
import type { Area, Budget, Conto, Movimento } from '../dati/tipi';
import type { DatiApp } from '../dati/usaDati';
import { andamentoFondo, patrimonioAl, saldoConto } from '../logica/conti';
import {
  chiaveMese, giorniNelMese, patrimonioPerMese, perArea, totali, totaliBudget, budgetDi,
} from '../logica/bilancio';
import {
  MESI_BREVI, dataLocale, euro, euroConSegno, euroTondo, giornoRelativo, nomeMese, percentuale,
} from '../logica/formato';
import { IconaArea, COLORI_AREA } from '../componenti/IconaArea';
import { Anello, LineaAndamento } from '../componenti/Grafici';
import { ImportoGrande } from '../componenti/Importo';
import { apriNuovoMovimento, vai } from '../navigazione';

// Home: la situazione del mese a colpo d'occhio.
export function Home({ dati }: { dati: DatiApp }) {
  const oggi = new Date();
  const [periodo, setPeriodo] = useState({ anno: oggi.getFullYear(), mese: oggi.getMonth() });
  const { anno, mese } = periodo;
  const spostaMese = (d: number) => {
    const t = new Date(anno, mese + d, 1);
    setPeriodo({ anno: t.getFullYear(), mese: t.getMonth() });
  };
  const eMeseCorrente = anno === oggi.getFullYear() && mese === oggi.getMonth();

  const calcoli = useMemo(() => {
    const { aree } = dati;
    const dellAnno = dati.movimenti.filter((m) => m.data.startsWith(`${anno}-`));
    const delMese = dellAnno.filter((m) => m.data.startsWith(chiaveMese(anno, mese)));
    const budget = dati.budget.filter((b) => b.anno === anno);
    const t = totali(delMese, aree);
    const b = totaliBudget(budget, aree, mese);
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
    return { aree, delMese, budget, t, b, pat: { iniziale, fineMese } };
  }, [dati, anno, mese]);

  const { aree, delMese, budget, t, b, pat } = calcoli;

  // Patrimonio a fine mese scelto (a oggi se è il mese corrente) e variazione nel mese.
  const finoA = mese;
  const patrimonio = pat.fineMese[finoA];
  const inizioMese = finoA === 0 ? pat.iniziale : pat.fineMese[finoA - 1];
  const variazione = patrimonio - inizioMese;
  const valoriGrafico = [pat.iniziale, ...pat.fineMese.slice(0, finoA + 1)];
  const etichetteGrafico = ['1 gen', ...MESI_BREVI.slice(0, finoA + 1)];
  const senzaSaldi = dati.saldiIniziali.length === 0 && dati.valutazioni.length === 0;

  return (
    <>
      <header className="testata-home">
        <div>
          <span className="sopratitolo">Il tuo bilancio</span>
          <h1 className="titolo-pagina">{nomeMese(anno, mese)}</h1>
        </div>
        <div className="scelta-mese">
          <button type="button" className="pulsante-tondo" onClick={() => spostaMese(-1)} aria-label="Mese precedente">
            <IconChevronLeft size={20} stroke={1.8} />
          </button>
          <button
            type="button"
            className="pulsante-tondo"
            onClick={() => spostaMese(1)}
            aria-label="Mese successivo"
            disabled={eMeseCorrente}
          >
            <IconChevronRight size={20} stroke={1.8} />
          </button>
        </div>
      </header>

      <PromemoriaBackup dati={dati} />

      {/* Patrimonio stimato con il suo andamento dall'inizio dell'anno */}
      <section className="riquadro riquadro-eroe" aria-label="Patrimonio stimato">
        <span className="etichetta">Patrimonio stimato</span>
        <ImportoGrande valore={patrimonio} />
        <div className="variazione">
          <span className={`pastiglia ${variazione >= 0 ? 'positiva' : 'negativa'}`}>
            {variazione >= 0 ? <IconArrowUpRight size={14} stroke={2.2} /> : <IconArrowDownRight size={14} stroke={2.2} />}
            {euroConSegno(variazione)}
          </span>
          <span className="testo-tenue">{eMeseCorrente ? 'questo mese' : 'nel mese'}</span>
        </div>
        <LineaAndamento valori={valoriGrafico} etichette={etichetteGrafico} />
        {senzaSaldi && (
          <button type="button" className="nota-azione" onClick={() => vai('altro', 'conti')}>
            Inserisci il saldo dei tuoi conti e fondi per un patrimonio preciso
            <IconChevronRight size={16} stroke={1.8} />
          </button>
        )}
      </section>

      {dati.conti.length > 0 && <ITuoiConti dati={dati} />}

      {/* Entrate, spese e investimenti del mese */}
      <section className="tre-tessere">
        <Tessera titolo="Entrate" valore={t.entrata} budget={b.entrata} classe="positivo" />
        <Tessera titolo="Spese" valore={t.spesa} budget={b.spesa} />
        <Tessera titolo="Investito" valore={t.investimento} budget={b.investimento} classe="accento" />
      </section>

      {delMese.length === 0 ? (
        <MeseVuoto />
      ) : (
        <>
          <RiquadroBudget speso={t.spesa} budget={b.spesa} anno={anno} mese={mese} eMeseCorrente={eMeseCorrente} />
          <DoveVanno movimenti={delMese} aree={dati.elencoAree} budget={budget} mese={mese} totaleSpese={t.spesa} />
          <UltimiMovimenti movimenti={delMese} aree={aree} />
        </>
      )}
    </>
  );
}

/** Saldo di oggi di ogni conto e fondo; per i fondi anche guadagno o perdita. */
function ITuoiConti({ dati }: { dati: DatiApp }) {
  const oggi = dataLocale();
  const righe = dati.conti.map((c) => ({ c, saldo: saldoConto(c.id, oggi, dati) }));
  const liquidita = righe.filter((r) => r.c.tipo === 'liquidita').reduce((t, r) => t + r.saldo, 0);
  const investito = righe.filter((r) => r.c.tipo === 'investimento').reduce((t, r) => t + r.saldo, 0);
  return (
    <section className="riquadro">
      <div className="testa-riquadro">
        <h2 className="titolo-riquadro">I tuoi conti</h2>
        <button type="button" className="pulsante-testo" onClick={() => vai('altro', 'conti')}>
          Gestisci
        </button>
      </div>
      <div className="due-totali">
        <div>
          <span className="etichetta">Liquidità</span>
          <span className="importo-medio">{euroTondo(liquidita)}</span>
        </div>
        <div>
          <span className="etichetta">Investimenti</span>
          <span className="importo-medio accento">{euroTondo(investito)}</span>
        </div>
      </div>
      {righe.map(({ c, saldo }) => (
        <RigaConto key={c.id} c={c} saldo={saldo} dati={dati} principale={c.id === dati.principaleId} />
      ))}
    </section>
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

function Tessera({ titolo, valore, budget, classe = '' }: { titolo: string; valore: number; budget: number; classe?: string }) {
  return (
    <div className="riquadro tessera">
      <span className="etichetta">{titolo}</span>
      <span className={`importo-medio ${classe}`}>{euroTondo(valore)}</span>
      <span className="tessera-sotto">{budget > 0 ? `di ${euroTondo(budget)}` : 'senza budget'}</span>
    </div>
  );
}

function RiquadroBudget({
  speso, budget, anno, mese, eMeseCorrente,
}: { speso: number; budget: number; anno: number; mese: number; eMeseCorrente: boolean }) {
  if (budget <= 0) {
    return (
      <section className="riquadro riga-budget">
        <Anello quota={0}>
          <span className="anello-testo">—</span>
        </Anello>
        <div>
          <h2 className="titolo-riquadro">Budget del mese</h2>
          <p className="testo-tenue">Imposta un budget di spesa per sapere ogni giorno quanto puoi ancora spendere.</p>
        </div>
      </section>
    );
  }
  const quota = speso / budget;
  const resta = budget - speso;
  const giorni = giorniNelMese(anno, mese);
  const giorniRimasti = eMeseCorrente ? giorni - new Date().getDate() + 1 : 0;
  // Ritmo: quanto avresti dovuto spendere fino a oggi andando a passo costante.
  const ritmo = eMeseCorrente ? (budget * (giorni - giorniRimasti + 1)) / giorni : budget;
  const sopraRitmo = eMeseCorrente && speso > ritmo;
  return (
    <section className="riquadro riga-budget">
      <Anello quota={quota}>
        <span className="anello-testo">{percentuale(quota)}</span>
      </Anello>
      <div className="riga-budget-testo">
        <h2 className="titolo-riquadro">Budget del mese</h2>
        {resta >= 0 ? (
          <p>
            Restano <strong className="numero">{euro(resta)}</strong>
            {eMeseCorrente && giorniRimasti > 0 && (
              <>
                <br />
                <span className="testo-tenue">
                  circa {euroTondo(resta / giorniRimasti)} al giorno per {giorniRimasti} {giorniRimasti === 1 ? 'giorno' : 'giorni'}
                </span>
              </>
            )}
          </p>
        ) : (
          <p>
            Superato di <strong className="numero negativo">{euro(-resta)}</strong>
          </p>
        )}
        {eMeseCorrente && resta >= 0 && (
          <span className={`pastiglia ${sopraRitmo ? 'avviso' : 'positiva'}`}>
            {sopraRitmo ? 'Sopra il ritmo previsto' : 'In linea con il budget'}
          </span>
        )}
      </div>
    </section>
  );
}

function DoveVanno({
  movimenti, aree, budget, mese, totaleSpese,
}: { movimenti: Movimento[]; aree: Area[]; budget: Budget[]; mese: number; totaleSpese: number }) {
  const [tutte, setTutte] = useState(false);
  const somme = perArea(movimenti);
  const righe = aree
    .filter((a) => a.tipo === 'spesa' && (somme.get(a.id) ?? 0) > 0)
    .map((a) => ({ a, speso: somme.get(a.id) ?? 0, budget: budgetDi(budget, a.id, mese) }))
    .sort((x, y) => y.speso - x.speso);
  if (!righe.length) return null;
  const mostrate = tutte ? righe : righe.slice(0, 5);
  const massimo = righe[0].speso;
  return (
    <section className="riquadro">
      <div className="testa-riquadro">
        <h2 className="titolo-riquadro">Dove vanno i soldi</h2>
        <span className="testo-tenue piccolo">{euro(totaleSpese)}</span>
      </div>
      {/* Barra unica divisa per area: la composizione delle spese in un colpo d'occhio */}
      <div className="barra-composizione" aria-hidden="true">
        {righe.map(({ a, speso }) => (
          <span key={a.id} style={{ flexGrow: speso, background: COLORI_AREA[a.colore] ?? COLORI_AREA.grigio }} />
        ))}
      </div>
      <ul className="elenco-aree">
        {mostrate.map(({ a, speso, budget: bud }) => {
          const oltre = bud > 0 && speso > bud;
          const quota = bud > 0 ? speso / bud : speso / massimo;
          return (
            <li key={a.id}>
              <IconaArea area={a} />
              <div className="elenco-aree-centro">
                <div className="elenco-aree-riga">
                  <span className="elenco-aree-nome">{a.nome}</span>
                  <span className={`numero ${oltre ? 'negativo' : ''}`}>{euro(speso)}</span>
                </div>
                <div className="progresso">
                  <span
                    style={{
                      width: `${Math.min(100, quota * 100)}%`,
                      background: oltre ? 'var(--negativo)' : COLORI_AREA[a.colore] ?? COLORI_AREA.grigio,
                    }}
                  />
                </div>
                <span className="elenco-aree-sotto">
                  {bud > 0
                    ? oltre
                      ? `${euroTondo(speso - bud)} oltre il budget di ${euroTondo(bud)}`
                      : `${percentuale(speso / bud)} di ${euroTondo(bud)}`
                    : `${percentuale(speso / totaleSpese)} delle spese`}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
      {righe.length > 5 && (
        <button type="button" className="pulsante-testo" onClick={() => setTutte(!tutte)}>
          {tutte ? 'Mostra meno' : `Mostra tutte (${righe.length})`}
        </button>
      )}
    </section>
  );
}

function UltimiMovimenti({ movimenti, aree }: { movimenti: Movimento[]; aree: Map<string, Area> }) {
  const ordinati = [...movimenti].sort((x, y) => y.data.localeCompare(x.data) || y.creato.localeCompare(x.creato)).slice(0, 6);
  // Raggruppa per giorno, come nell'estratto conto della banca.
  const giorni: { data: string; elenco: Movimento[] }[] = [];
  for (const m of ordinati) {
    const g = giorni[giorni.length - 1];
    if (g && g.data === m.data) g.elenco.push(m);
    else giorni.push({ data: m.data, elenco: [m] });
  }
  return (
    <section className="riquadro">
      <div className="testa-riquadro">
        <h2 className="titolo-riquadro">Ultimi movimenti</h2>
        <button type="button" className="pulsante-testo" onClick={() => vai('movimenti')}>
          Vedi tutti
        </button>
      </div>
      {giorni.map((g) => (
        <div key={g.data} className="gruppo-giorno">
          <span className="giorno">{giornoRelativo(g.data)}</span>
          {g.elenco.map((m) => (
            <RigaMovimento key={m.id} m={m} area={aree.get(m.areaId)} />
          ))}
        </div>
      ))}
    </section>
  );
}

export function RigaMovimento({ m, area }: { m: Movimento; area: Area | undefined }) {
  const tipo = area?.tipo ?? 'spesa';
  const segno = tipo === 'entrata' ? '+' : '−';
  return (
    <button type="button" className="riga-movimento" onClick={() => apriNuovoMovimento(m)}>
      <IconaArea area={area} />
      <span className="riga-movimento-testo">
        <span className="riga-movimento-titolo">{m.descrizione || area?.nome || 'Movimento'}</span>
        <span className="riga-movimento-sotto">{m.descrizione ? area?.nome : tipo === 'entrata' ? 'Entrata' : tipo === 'investimento' ? 'Investimento' : 'Spesa'}</span>
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

