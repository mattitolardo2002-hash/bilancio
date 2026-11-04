# Bilancio

Web app personale per il bilancio: movimenti, budget per macro-area, conti e fondi (con il rendimento del PAC), patrimonio stimato. Funziona sull'iPhone come un'app vera (dalla schermata Home) e sul Mac nel browser, **anche senza connessione**.

## Cosa fa

- **Home**: patrimonio stimato con andamento, i tuoi conti e fondi, entrate/spese/investito del mese, budget ad anello con quanto puoi spendere al giorno, dove vanno i soldi, ultimi movimenti.
- **+**: registra una spesa, un'entrata o un investimento con tastierino, area con icona, conto e data.
- **Movimenti**: elenco per giorno, ricerca in tutti i mesi, filtri per tipo e area.
- **Analisi**: riepilogo dell'anno, grafico mese per mese, spese per area, budget mensile modificabile.
- **Altro**: conti e fondi, backup cifrato con password, importazione (anche dalla vecchia pagina HTML), blocco con Face ID.

## Dove stanno i dati (e sicurezza)

Solo sul dispositivo, nel database del browser (IndexedDB). **Niente server, niente account**: questo repository contiene solo il programma, mai i dati.

- La versione pubblicata ha una Content Security Policy che impedisce all'app di inviare dati a qualunque altro sito.
- I backup sono cifrati (AES-GCM 256 bit, chiave ricavata dalla password con PBKDF2-SHA256).
- Blocco all'apertura con Face ID (passkey del sistema) e codice di 6 cifre di riserva.

> Fai un backup (Altro → Esporta backup → salva su iCloud Drive) almeno ogni due settimane: se perdi il telefono è l'unico modo per recuperare i dati. Annota la password del backup.

## Avviarla sul Mac (per provarla o modificarla)

```bash
npm install
npm run dev
```

## Pubblicarla

```bash
npm run pubblica
```

Costruisce l'app e la carica sul ramo `gh-pages` (GitHub Pages).
