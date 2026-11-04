import { euroDiviso } from '../logica/formato';

/** Importo grande: parte intera piena, decimali e simbolo più tenui (come nelle app delle banche). */
export function ImportoGrande({ valore, className = '' }: { valore: number; className?: string }) {
  const { segno, intero, decimali } = euroDiviso(valore);
  return (
    <span className={`importo-grande ${className}`}>
      {segno}
      {intero}
      <span className="importo-decimali">,{decimali} €</span>
    </span>
  );
}
