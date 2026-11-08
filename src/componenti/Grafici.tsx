import { useId, type ReactNode } from 'react';

// Grafici disegnati a mano in SVG: leggeri e sempre coerenti con il tema.

/** Percorso morbido che passa per tutti i punti (curve di Catmull-Rom, senza "scavalcamenti"). */
function curva(p: [number, number][]): string {
  if (p.length === 0) return '';
  let d = `M${p[0][0]},${p[0][1]}`;
  for (let i = 0; i < p.length - 1; i++) {
    const [x0, y0] = p[Math.max(0, i - 1)];
    const [x1, y1] = p[i];
    const [x2, y2] = p[i + 1];
    const [x3, y3] = p[Math.min(p.length - 1, i + 2)];
    const t = 0.18; // tensione: più basso = più dritto
    // I punti di controllo restano tra y1 e y2: la curva non esce dai valori reali.
    const lim = (y: number) => Math.min(Math.max(y, Math.min(y1, y2)), Math.max(y1, y2));
    d += ` C${x1 + (x2 - x0) * t},${lim(y1 + (y2 - y0) * t)} ${x2 - (x3 - x1) * t},${lim(y2 - (y3 - y1) * t)} ${x2},${y2}`;
  }
  return d;
}

/** Linea con area sfumata sotto, per l'andamento del patrimonio. */
export function LineaAndamento({ valori, etichette }: { valori: number[]; etichette: string[] }) {
  const id = useId();
  const L = 320, A = 96, alto = 8, basso = 6;
  if (valori.length < 2) valori = [valori[0] ?? 0, valori[0] ?? 0];
  const min = Math.min(...valori), max = Math.max(...valori);
  // Se i valori sono tutti uguali la linea sta a metà altezza.
  const spazio = max - min || Math.abs(max) || 1;
  const y = (v: number) => (max === min ? A / 2 : alto + (1 - (v - min) / spazio) * (A - alto - basso));
  const passo = L / (valori.length - 1);
  const punti = valori.map((v, i) => [i * passo, y(v)] as [number, number]);
  const linea = curva(punti);
  const ultimo = punti[punti.length - 1];
  return (
    <div className="grafico-linea">
      <svg viewBox={`0 0 ${L} ${A}`} preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--accento)" stopOpacity="0.4" />
            <stop offset="1" stopColor="var(--accento)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={`${linea} L${L},${A} L0,${A} Z`} fill={`url(#${id})`} />
        <path d={linea} fill="none" stroke="var(--accento)" strokeWidth="2.2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
      {/* Il punto finale è in HTML: in SVG verrebbe schiacciato insieme al grafico. */}
      <span className="grafico-punto" style={{ left: `${(ultimo[0] / L) * 100}%`, top: `${(ultimo[1] / A) * 100}%` }} />
      <div className="grafico-etichette">
        {/* Con molti mesi si mostra un'etichetta sì e una no, per non affollare. */}
        {etichette.map((e, i) => (
          <span key={i} style={etichette.length > 7 && i % 2 === 1 && i !== etichette.length - 1 ? { visibility: 'hidden' } : undefined}>
            {e}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Piccolo grafico senza etichette, da affiancare a un numero (es. il patrimonio). */
export function MiniLinea({ valori }: { valori: number[] }) {
  const id = useId();
  const L = 110, A = 54, m = 5;
  if (valori.length < 2) valori = [valori[0] ?? 0, valori[0] ?? 0];
  const min = Math.min(...valori), max = Math.max(...valori);
  const y = (v: number) => (max === min ? A / 2 : m + (1 - (v - min) / (max - min)) * (A - 2 * m));
  const passo = (L - m) / (valori.length - 1);
  const punti = valori.map((v, i) => [i * passo, y(v)] as [number, number]);
  const linea = curva(punti);
  const [ux, uy] = punti[punti.length - 1];
  return (
    <svg className="mini-linea" viewBox={`0 0 ${L} ${A}`} aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--accento)" stopOpacity="0.35" />
          <stop offset="1" stopColor="var(--accento)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${linea} L${ux},${A} L0,${A} Z`} fill={`url(#${id})`} />
      <path d={linea} fill="none" stroke="var(--accento)" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={ux} cy={uy} r="3.5" fill="var(--accento)" />
    </svg>
  );
}

/** Anello di avanzamento (es. budget usato). Oltre il 100% diventa rosso. */
export function Anello({ quota, misura = 76, children }: { quota: number; misura?: number; children?: ReactNode }) {
  const r = 30, c = 2 * Math.PI * r;
  const q = Math.max(0, Math.min(1, quota));
  const oltre = quota > 1;
  return (
    <div className="anello" style={{ width: misura, height: misura }}>
      <svg viewBox="0 0 76 76" aria-hidden="true">
        <circle cx="38" cy="38" r={r} fill="none" stroke="var(--traccia)" strokeWidth="7" />
        <circle
          cx="38" cy="38" r={r} fill="none"
          stroke={oltre ? 'var(--negativo)' : 'var(--accento)'}
          strokeWidth="7" strokeLinecap="round"
          strokeDasharray={`${q * c} ${c}`}
          transform="rotate(-90 38 38)"
          className="anello-arco"
        />
      </svg>
      <div className="anello-centro">{children}</div>
    </div>
  );
}
