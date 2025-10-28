# Park App Reserve 🚗

Park App Reserve è un'applicazione web full-stack progettata per la gestione e la prenotazione di parcheggi aziendali. Consente agli utenti di richiedere un posto auto per giorni specifici e a un sistema automatizzato di assegnare i posti disponibili.

## Caratteristiche Principali

* **Autenticazione Utente:** Registrazione sicura, login, verifica e-mail e recupero password.
* **Sistema di Richieste:** Gli utenti possono inviare, visualizzare, modificare e cancellare richieste di parcheggio per date future.
* **Assegnazione Automatica:** Un backend (su Google Apps Script) gestisce l'assegnazione dei posti in base alla disponibilità e a una logica di priorità.
* **Vista Calendario:** Una dashboard principale (Homepage) che mostra le richieste totali e lo stato delle richieste dell'utente.
* **Gestione Admin:** Gli utenti amministratori possono aggiungere/rimuovere posti auto, impostare posti come "fissi" e gestire le disponibilità temporanee.
* **Statistiche:** Una pagina per visualizzare la cronologia delle assegnazioni e le statistiche per utente.
* **Profilo Utente:** Gli utenti possono personalizzare il proprio profilo, inclusi avatar, tema (chiaro/scuro) e colore primario dell'app.

## Stack Tecnologico

Questo progetto è diviso in due parti principali:

1.  **Frontend:**
    * [**React**](https://reactjs.org/) (con Vite)
    * [**React Router**](https://reactrouter.com/) per la navigazione
    * [**React Big Calendar**](https://github.com/jquense/react-big-calendar) per la vista calendario
    * [**date-fns**](https://date-fns.org/) per la manipolazione delle date
    * CSS personalizzato per lo styling

2.  **Backend:**
    * [**Google Apps Script (GAS)**](https://developers.google.com/apps-script)
    * [**Google Sheets**](https://www.google.com/sheets/about/) come database

## Configurazione del Progetto

Per far funzionare questo progetto, devi configurare separatamente il Backend (Google Apps Script) e il Frontend (React).

### 1. Configurazione del Backend (Google Apps Script)

Il backend gira interamente sul tuo account Google e utilizza un Google Sheet come database.

1.  **Crea un Google Sheet:**
    * Crea un nuovo foglio Google.
    * Al suo interno, crea i seguenti fogli (schede/tab) con i nomi esatti (come da `back-end.gs`):
        * `Users`
        * `Bookings` (Anche se `back-end.gs` lo elenca, sembra usare `ParkingRequests` per le richieste)
        * `ParkingSpaces`
        * `ParkingRequests`
        * `AssignmentHistory`
        * `TemporaryAvailability`
    * **Importante:** Devi configurare le colonne (intestazioni) in ciascun foglio affinché corrispondano a ciò che lo script `back-end.gs` cerca di leggere e scrivere (es. in `Users` servono `id`, `firstName`, `mail`, `password`, `salt`, `isVerified`, ecc.).

2.  **Crea il Progetto Apps Script:**
    * Apri il tuo Google Sheet, vai su `Estensioni` > `Apps Script`.
    * Si aprirà un nuovo editor di script.
    * Copia l'intero contenuto del file `src/services/back-end.gs` e incollalo nell'editor di Apps Script (di solito in un file chiamato `Codice.gs`), sostituendo qualsiasi contenuto predefinito.

3.  **Configura i Trigger (per assegnazioni automatiche):**
    * Nell'editor di Apps Script, vai sulla sinistra sull'icona "Trigger" (sveglia).
    * Clicca su "Aggiungi trigger".
    * Configura un trigger per eseguire la funzione `processPendingRequests`:
        * **Funzione da eseguire:** `processPendingRequests`
        * **Tipo di evento:** `Basato sull'ora`
        * **Tipo di timer:** `Timer giornaliero`
        * **Ora del giorno:** Seleziona l'ora in cui vuoi che avvenga l'assegnazione (es. 19:00 - 20:00, come suggerito dalla variabile `ASSIGNMENT_HOUR`).

4.  **Esegui il Deploy come Web App:**
    * Clicca su `Distribuisci` > `Nuova distribuzione`.
    * **Tipo:** Seleziona `Applicazione web`.
    * **Descrizione:** Dai un nome (es. "Park App Backend v1").
    * **Esegui come:** `Me (il tuo indirizzo email)`.
    * **Chi ha accesso:** `Chiunque` (Questo è necessario affinché il frontend possa chiamare l'API. I dati sono comunque protetti dalla logica dell'app).
    * Clicca su `Distribuisci`.
    * **Importante:** Copia l'**URL dell'applicazione web** fornito. Ti servirà per il frontend.

### 2. Configurazione del Frontend (React)

1.  **Clona/Scarica il Progetto:**
    * Assicurati di avere tutti i file del frontend sul tuo computer.

2.  **Installa le Dipendenze:**
    * Apri un terminale nella cartella principale del progetto ed esegui:
    ```bash
    npm install
    ```

3.  **Crea il File Ambiente (.env):**
    * Nella cartella principale del progetto, crea un file chiamato `.env`.
    * Aprilo e aggiungi la variabile d'ambiente `VITE_GOOGLE_SCRIPT_URL`, incollando l'URL che hai copiato dal deploy di Apps Script:
    ```
    VITE_GOOGLE_SCRIPT_URL=[https://script.google.com/macros/s/IL_TUO_ID_DISTRIBUZIONE/exec](https://script.google.com/macros/s/IL_TUO_ID_DISTRIBUZIONE/exec)
    ```
    * Sostituisci l'URL con il tuo.

4.  **Avvia l'App in Sviluppo:**
    * Esegui:
    ```bash
    npm run dev
    ```
    * L'applicazione sarà ora in esecuzione su `http://localhost:5173` (o un'altra porta indicata dal terminale) e comunicherà con il tuo backend su Google Apps Script.

## Build per la Produzione

Per creare una versione ottimizzata del frontend per il deploy:

```bash
npm run build