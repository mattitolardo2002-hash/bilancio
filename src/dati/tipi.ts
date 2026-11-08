// Tipi dei dati salvati nel dispositivo.

/** Che cosa rappresenta una macro-area: è lei a dire il "segno" di un movimento. */
export type TipoArea = 'entrata' | 'spesa' | 'investimento';

/** Macro-area (es. "Spesa alimentare"), con la sua icona e il suo colore. */
export interface Area {
  id: string;
  nome: string;
  tipo: TipoArea;
  /** Chiave dell'icona (vedi componenti/IconaArea.tsx). */
  icona: string;
  /** Chiave del colore dell'icona (vedi COLORI_AREA). */
  colore: string;
  /** Budget mensile di partenza, copiato nei mesi quando serve. */
  budgetStandard: number;
  ordine: number;
  /** Solo per gli investimenti: il fondo (conto d'investimento) che questa area fa crescere. */
  fondoId?: string;
  /**
   * Solo per le spese: spesa fissa (affitto, abbonamenti…), di solito pagata
   * a inizio mese. Non conta nel "ritmo" delle spese di tutti i giorni.
   * Se manca vale il valore predefinito (vedi eFissa in logica/bilancio.ts).
   */
  fissa?: boolean;
}

/** Un movimento registrato. L'importo è sempre positivo: il tipo lo dà l'area. */
export interface Movimento {
  id: string;
  /** Data locale AAAA-MM-GG. */
  data: string;
  descrizione: string;
  areaId: string;
  importo: number;
  /** Conto da cui esce o su cui entra. Se manca vale il conto principale. */
  contoId?: string;
  /** Momento della registrazione (ISO), per ordinare i movimenti dello stesso giorno. */
  creato: string;
}

/** Budget di un'area per un anno: 12 importi, uno per mese. */
export interface Budget {
  /** "2026:a_spesa" */
  id: string;
  anno: number;
  areaId: string;
  mesi: number[];
}

/** Conto corrente, carta o investimento. */
export interface Conto {
  id: string;
  nome: string;
  tipo: 'liquidita' | 'investimento';
  ordine: number;
  /** Icona e colore, con le stesse chiavi delle macro-aree. */
  icona?: string;
  colore?: string;
}

/**
 * Valore vero di un conto in un giorno, letto sull'app della banca o del broker
 * (es. il valore degli ETF). Da quel giorno il saldo riparte da qui.
 */
export interface Valutazione {
  id: string;
  contoId: string;
  data: string;
  importo: number;
}

/** Saldo di un conto al 1° gennaio di un anno. */
export interface SaldoIniziale {
  /** "2026:p_rev" */
  id: string;
  anno: number;
  contoId: string;
  importo: number;
}
