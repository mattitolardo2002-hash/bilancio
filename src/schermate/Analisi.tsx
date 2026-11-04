import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { IconChevronLeft, IconChevronRight, IconCopy } from '@tabler/icons-react';
import { db } from '../dati/db';
import type { Area, TipoArea } from '../dati/tipi';
import type { DatiApp } from '../dati/usaDati';
import { budgetDi, meseDi, perArea, totali } from '../logica/bilancio';
import { MESI, MESI_BREVI, euro, euroTondo, leggiImporto, percentuale } from '../logica/formato';
import { COLORI_AREA, IconaArea } from '../componenti/IconaArea';

// Analisi: l'anno a colpo d'occhio, le spese per area e il budget mese per mese.
export function Analisi({ dati }: { dati: DatiApp }) {
  const oggi = new Date();
  const [anno, setAnno] = useState(oggi.getFullYear());
  const [meseScelto, setMeseScelto] = useState(anno === oggi.getFullYear() ? oggi.getMonth() : 0);

  const c = useMemo(() => {
    const dellAnno = dati.movimenti.filter((m) => m.data.startsWith(`${anno}-`));
    const perMese = Array.from({ length: 12 }, (_, i) => totali(dellAnno.filter((m) => meseDi(m.data).mese === i), dati.aree));
    const t = totali(dellAnno, dati.aree);
    const spese = dellAnno.filter((m) => dati.aree.get(m.areaId)?.tipo === 'spesa');
    const somme = perArea(spese);
    const aree = dati.elencoAree
      .filter((a) => a.tipo === 'spesa' && (somme.get(a.id) ?? 0) > 0)
      .map((a) => ({ a, v: somme.get(a.id)! }))
      .sort((x, y) => y.v - x.v);
    const mesiConDati = perMese.filter((m) => m.entrata || m.spesa || m.investimento).length;
    return { perMese, t, aree, mesiConDati };
  }, [dati, anno]);

  const risparmio = c.t.entrata ? (c.t.entrata - c.t.spesa) / c.t.entrata : NaN;

  return (
    <>
      <header className="testata-home">
        <div>
          <span className="sopratitolo">Analisi</span>
          <h1 className="titolo-pagina">Anno {anno}</h1>
        </div>
        <div className="scelta-mese">
          <button type="button" className="pulsante-tondo" onClick={() => setAnno(anno - 1)} aria-label="Anno precedente"><IconChevronLeft size={20} stroke={1.8} /></button>
          <button type="button" className="pulsante-tondo" onClick={() => setAnno(anno + 1)} aria-label="Anno successivo"><IconChevronRight size={20} stroke={1.8} /></button>
        </div>
      </header>

      <section className="griglia-kpi">
        <div className="riquadro tessera"><span className="etichetta">Entrate</span><span className="importo-medio positivo">{euroTondo(c.t.entrata)}</span></div>
        <div className="riquadro tessera"><span className="etichetta">Spese</span><span className="importo-medio">{euroTondo(c.t.spesa)}</span></div>
        <div className="riquadro tessera"><span className="etichetta">Investito</span><span className="importo-medio accento">{euroTondo(c.t.investimento)}</span></div>
        <div className="riquadro tessera">
          <span className="etichetta">Risparmio</span>
          <span className={`importo-medio ${risparmio >= 0 ? 'positivo' : 'negativo'}`}>{percentuale(risparmio)}</span>
          <span className="tessera-sotto">delle entrate</span>
        </div>
      </section>

      <section className="riquadro">
        <div className="testa-riquadro">
          <h2 className="titolo-riquadro">Mese per mese</h2>
          <div className="legenda"><span style={{ '--c': 'var(--positivo)' } as CSSProperties}>Entrate</span><span style={{ '--c': '#c9d1dc' } as CSSProperties}>Spese</span></div>
        </div>
        <GraficoMesi perMese={c.perMese} scelto={meseScelto} onScegli={setMeseScelto} />
        <div className="dettaglio-mese">
          <strong>{MESI[meseScelto][0].toUpperCase() + MESI[meseScelto].slice(1)}</strong>
          <span className="positivo numero">+{euro(c.perMese[meseScelto].entrata)}</span>
          <span className="numero">−{euro(c.perMese[meseScelto].spesa)}</span>
          <span className="testo-tenue numero">saldo {euro(c.perMese[meseScelto].entrata - c.perMese[meseScelto].spesa - c.perMese[meseScelto].investimento)}</span>
        </div>
        {c.mesiConDati > 0 && (
          <p className="testo-tenue piccolo">
            In media spendi <strong className="numero testo-chiaro">{euro(c.t.spesa / c.mesiConDati)}</strong> al mese.
          </p>
        )}
      </section>

      {c.aree.length > 0 && (
        <section className="riquadro">
          <h2 className="titolo-riquadro">Spese per area nel {anno}</h2>
          <div className="ciambella-riga">
            <Ciambella valori={c.aree.map(({ a, v }) => ({ v, colore: COLORI_AREA[a.colore] ?? COLORI_AREA.grigio }))} totale={c.t.spesa} />
            <ul className="legenda-aree">
              {c.aree.slice(0, 6).map(({ a, v }) => (
                <li key={a.id}><span className="pallino" style={{ background: COLORI_AREA[a.colore] }} /><span className="legenda-nome">{a.nome}</span><span className="numero">{percentuale(v / c.t.spesa)}</span></li>
              ))}
            </ul>
          </div>
          <ul className="elenco-aree">
            {c.aree.map(({ a, v }) => (
              <li key={a.id}>
                <IconaArea area={a} />
                <div className="elenco-aree-centro">
                  <div className="elenco-aree-riga"><span className="elenco-aree-nome">{a.nome}</span><span className="numero">{euro(v)}</span></div>
                  <span className="elenco-aree-sotto">{c.mesiConDati ? `${euroTondo(v / c.mesiConDati)} al mese in media` : ''}</span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <BudgetMese dati={dati} anno={anno} mese={meseScelto} onMese={setMeseScelto} />
    </>
  );
}

/** Barre affiancate entrate/spese per i 12 mesi; si tocca un mese per vederne i numeri. */
function GraficoMesi({ perMese, scelto, onScegli }: { perMese: { entrata: number; spesa: number }[]; scelto: number; onScegli: (m: number) => void }) {
  const L = 340, A = 150, basso = 18;
  const max = Math.max(1, ...perMese.flatMap((m) => [m.entrata, m.spesa]));
  const banda = L / 12, larga = Math.min(9, banda / 3);
  const h = (v: number) => (v / max) * (A - basso - 6);
  return (
    <svg className="grafico-mesi" viewBox={`0 0 ${L} ${A}`} role="img" aria-label="Entrate e spese per mese">
      {perMese.map((m, i) => {
        const x = i * banda + banda / 2;
        const attivo = i === scelto;
        return (
          <g key={i} onClick={() => onScegli(i)} style={{ cursor: 'pointer' }} opacity={attivo ? 1 : 0.55}>
            <rect x={i * banda} y={0} width={banda} height={A} fill="transparent" />
            {attivo && <rect x={i * banda + 2} y={2} width={banda - 4} height={A - basso} rx={8} fill="rgba(255,255,255,0.045)" />}
            <rect x={x - larga - 1} y={A - basso - h(m.entrata)} width={larga} height={h(m.entrata)} rx={2.5} fill="var(--positivo)" />
            <rect x={x + 1} y={A - basso - h(m.spesa)} width={larga} height={h(m.spesa)} rx={2.5} fill="#c9d1dc" />
            <text x={x} y={A - 4} textAnchor="middle" fontSize="10" fill={attivo ? 'var(--testo)' : 'var(--testo-spento)'}>{MESI_BREVI[i]}</text>
          </g>
        );
      })}
    </svg>
  );
}

/** Ciambella delle spese per area, con il totale al centro. */
function Ciambella({ valori, totale }: { valori: { v: number; colore: string }[]; totale: number }) {
  const r = 42, giro = 2 * Math.PI * r, stacco = valori.length > 1 ? 2 : 0;
  let inizio = 0;
  return (
    <div className="ciambella">
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--traccia)" strokeWidth="10" />
        {valori.map((x, i) => {
          const lungo = (x.v / totale) * giro;
          const el = (
            <circle key={i} cx="50" cy="50" r={r} fill="none" stroke={x.colore} strokeWidth="10"
              strokeDasharray={`${Math.max(0.5, lungo - stacco)} ${giro}`} strokeDashoffset={-inizio} transform="rotate(-90 50 50)" />
          );
          inizio += lungo;
          return el;
        })}
      </svg>
      <div className="ciambella-centro"><span className="etichetta">Totale</span><span className="numero">{euroTondo(totale)}</span></div>
    </div>
  );
}

const GRUPPI: { tipo: TipoArea; titolo: string }[] = [
  { tipo: 'spesa', titolo: 'Spese' },
  { tipo: 'entrata', titolo: 'Entrate' },
  { tipo: 'investimento', titolo: 'Investimenti' },
];

/** Budget di un mese, modificabile area per area, con speso e residuo. */
function BudgetMese({ dati, anno, mese, onMese }: { dati: DatiApp; anno: number; mese: number; onMese: (m: number) => void }) {
  const budget = dati.budget.filter((b) => b.anno === anno);
  const delMese = dati.movimenti.filter((m) => m.data.startsWith(`${anno}-${String(mese + 1).padStart(2, '0')}`));
  const somme = perArea(delMese);
  const [messaggio, setMessaggio] = useState('');
  // Il mese scelto resta sempre visibile nella fila dei mesi.
  const fila = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = fila.current?.children[mese] as HTMLElement | undefined;
    if (el && fila.current) fila.current.scrollTo({ left: el.offsetLeft - fila.current.clientWidth / 2 + el.clientWidth / 2, behavior: 'smooth' });
  }, [mese]);

  const salva = async (a: Area, valore: number, tuttiIMesi = false) => {
    const id = `${anno}:${a.id}`;
    const attuale = (await db.budget.get(id))?.mesi ?? Array(12).fill(0);
    const mesi = tuttiIMesi ? Array(12).fill(valore) : attuale.map((v, i) => (i === mese ? valore : v));
    await db.budget.put({ id, anno, areaId: a.id, mesi });
  };

  const copiaDalPrecedente = async () => {
    if (mese === 0) return;
    await db.transaction('rw', db.budget, async () => {
      for (const a of dati.elencoAree) {
        const prima = budgetDi(budget, a.id, mese - 1);
        if (prima || budgetDi(budget, a.id, mese)) await salva(a, prima);
      }
    });
    setMessaggio(`Budget copiato da ${MESI[mese - 1]}`);
  };

  const applicaATutti = async () => {
    await db.transaction('rw', db.budget, async () => {
      for (const a of dati.elencoAree) {
        const v = budgetDi(budget, a.id, mese);
        if (v || budget.some((b) => b.areaId === a.id)) await salva(a, v, true);
      }
    });
    setMessaggio(`Budget di ${MESI[mese]} applicato a tutti i mesi del ${anno}`);
  };

  return (
    <section className="riquadro">
      <div className="testa-riquadro">
        <h2 className="titolo-riquadro">Budget</h2>
      </div>
      <div className="mesi-chip scorri-conti" ref={fila}>
        {MESI_BREVI.map((m, i) => (
          <button key={m} type="button" className="chip" role="radio" aria-checked={i === mese} onClick={() => { onMese(i); setMessaggio(''); }}>
            {m}
          </button>
        ))}
      </div>
      {GRUPPI.map(({ tipo, titolo }) => {
        const aree = dati.elencoAree.filter((a) => a.tipo === tipo);
        if (!aree.length) return null;
        const totB = aree.reduce((s, a) => s + budgetDi(budget, a.id, mese), 0);
        const totS = aree.reduce((s, a) => s + (somme.get(a.id) ?? 0), 0);
        return (
          <div key={tipo} className="gruppo-budget">
            <div className="giorno giorno-con-totale"><span>{titolo}</span><span>{euroTondo(totS)} di {euroTondo(totB)}</span></div>
            {aree.map((a) => (
              <RigaBudget key={`${a.id}-${anno}-${mese}`} a={a} budget={budgetDi(budget, a.id, mese)} speso={somme.get(a.id) ?? 0} onSalva={(v) => salva(a, v)} />
            ))}
          </div>
        );
      })}
      {messaggio && <p className="messaggio">{messaggio}</p>}
      <div className="fila-pulsanti spazio-sopra">
        <button type="button" className="pulsante" onClick={copiaDalPrecedente} disabled={mese === 0}>
          <IconCopy size={18} stroke={1.8} /> Copia da {mese ? MESI_BREVI[mese - 1] : '—'}
        </button>
        <button type="button" className="pulsante" onClick={applicaATutti}>Applica a tutto l'anno</button>
      </div>
    </section>
  );
}

function RigaBudget({ a, budget, speso, onSalva }: { a: Area; budget: number; speso: number; onSalva: (v: number) => void }) {
  const [testo, setTesto] = useState(budget ? String(budget).replace('.', ',') : '');
  const oltre = a.tipo === 'spesa' && budget > 0 && speso > budget;
  const quota = budget > 0 ? Math.min(1, speso / budget) : 0;
  const conferma = () => {
    const v = testo.trim() === '' ? 0 : leggiImporto(testo);
    if (v === null || v < 0) return setTesto(budget ? String(budget).replace('.', ',') : '');
    if (v !== budget) onSalva(v);
  };
  return (
    <div className="riga-budget-area">
      <IconaArea area={a} misura={34} />
      <div className="elenco-aree-centro">
        <span className="elenco-aree-nome">{a.nome}</span>
        <div className="progresso"><span style={{ width: `${quota * 100}%`, background: oltre ? 'var(--negativo)' : COLORI_AREA[a.colore] }} /></div>
        <span className={`elenco-aree-sotto ${oltre ? 'negativo' : ''}`}>{euro(speso)}{budget ? (oltre ? ` · ${euroTondo(speso - budget)} oltre` : ` · restano ${euroTondo(budget - speso)}`) : ''}</span>
      </div>
      <input
        className="campo-budget"
        type="text"
        inputMode="decimal"
        value={testo}
        placeholder="0"
        onChange={(e) => setTesto(e.target.value)}
        onBlur={conferma}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        onFocus={(e) => e.target.select()}
        aria-label={`Budget ${a.nome}`}
      />
    </div>
  );
}
