# Park App Reserve 🚗

Park App Reserve è un'applicazione web full-stack progettata per la gestione e la prenotazione di parcheggi aziendali. Consente agli utenti di richiedere un posto auto per giorni specifici e a un sistema automatizzato di assegnare i posti disponibili in modo equo e trasparente.

## Caratteristiche Principali

* **Autenticazione Utente:** Registrazione sicura con hashing password e salt, verifica via e-mail e recupero password.
* **Sistema di Richieste:** Gli utenti possono inviare richieste singole o multiple per date future, visualizzarle, modificarle o cancellarle.
* **Assegnazione Automatica & Algoritmo di Priorità:** Esecuzione automatica programmata la sera prima del giorno richiesto (es. alle 19:00). La priorità favorisce chi ha avuto meno assegnazioni negli ultimi 30 giorni lavorativi (*success rate* più basso).
* **Riassegnazione Istantanea:** Se un utente cancella un posto già assegnato, il sistema lo riassegna automaticamente al primo candidato in attesa.
* **Vista Calendario & Dashboard:** Calendario interattivo con conteggio richieste, indicatori di stato (Assegnata, In Attesa, Non Assegnata), stima percentuale di probabilità di assegnazione per l'indomani e banner di comunicazioni.
* **Gestione Amministratore:**
  * Aggiunta, ridenominazione ed eliminazione di posti auto.
  * Posti **Fissi**: disponibili di default, con possibilità di **disabilitarli temporaneamente** per giorni specifici (es. assenze, manutenzione).
  * Posti **Non Fissi**: non disponibili di default, con possibilità di impostare **disponibilità temporanee** per giorni specifici.
  * Assegnazione manuale forzata di un posto ad un utente per una o più date.
  * Gestione richieste del giorno dalla modale: cambio stato manuale, logica automatica o overbooking forzato, cancellazione massiva e reset assegnazioni.
  * Invio comunicazioni broadcast a tutti gli utenti (via email e/o tramite banner persistenti con intervallo di date in Homepage).
* **Statistiche:** Storico delle assegnazioni e conteggi aggregati per utente con filtri temporali personalizzati e dettaglio prenotazioni.
* **Profilo Utente:** Personalizzazione di avatar, colore primario dell'interfaccia e tema (chiaro/scuro).

---

## Stack Tecnologico

1. **Frontend:**
   * [**React 19**](https://reactjs.org/) (con [Vite](https://vitejs.dev/))
   * [**React Router 7**](https://reactrouter.com/) per la navigazione
   * [**React Big Calendar**](https://github.com/jquense/react-big-calendar) per la vista calendario
   * [**React Day Picker**](https://daypicker.dev/) per la selezione date nelle modali
   * [**date-fns**](https://date-fns.org/) per la manipolazione delle date
   * [**react-icons**](https://react-icons.github.io/react-icons/) per la grafica
   * CSS personalizzato con variabili per temi chiaro e scuro

2. **Backend:**
   * [**Google Apps Script (GAS)**](https://developers.google.com/apps-script) come API REST serverless
   * [**Google Sheets**](https://www.google.com/sheets/about/) come database

---

## Configurazione del Progetto

Il progetto richiede la configurazione del backend su Google Sheets/Apps Script e successivamente del frontend React.

### 1. Configurazione del Backend (Google Apps Script)

Il backend gira interamente sul tuo account Google e utilizza un Google Sheet come database.

#### A. Crea il Google Sheet e le schede (Tab)
Crea un nuovo foglio Google e aggiungi le seguenti schede con i nomi esatti e le relative colonne nella prima riga (intestazioni):

| Nome Scheda | Colonne Richieste (Riga 1) | Note |
|---|---|---|
| **`Users`** | `id`, `firstName`, `lastName`, `mail`, `password`, `salt`, `isVerified`, `verificationToken`, `resetToken`, `resetTokenExpiry`, `isAdmin`, `avatarColor`, `createdAt` | Contiene gli account utente. |
| **`ParkingSpaces`** | `id`, `number`, `isFixed` | Elenco posti auto. `isFixed` è booleano (`TRUE`/`FALSE`). |
| **`ParkingRequests`** | `requestId`, `userId`, `requestedDate`, `status`, `assignedParkingSpaceId`, `assignedParkingSpaceNumber` | Richieste inviate (`status`: `pending`, `assigned`, `not_assigned`, `cancelled_by_user`). |
| **`AssignmentHistory`** | `userId`, `assignmentDate`, `parkingSpaceId` | Storico assegnazioni per il calcolo della priorità. |
| **`TemporaryAvailability`** | `availabilityId`, `parkingSpaceId`, `availableDate` | Date in cui un posto **non fisso** è reso disponibile. |
| **`TemporaryUnavailability`** | `unavailabilityId`, `parkingSpaceId`, `unavailableDate` | Date in cui un posto **fisso** è temporaneamente disabilitato (creata anche in automatico dallo script se assente). |
| **`Communications`** | `id`, `message`, `isPersistent`, `startDate`, `endDate`, `createdAt` | Banner persistenti e comunicazioni admin. |

> [!NOTE]
> La scheda `Bookings` presente in vecchie note era legacy: il sistema attuale utilizza esclusivamente `ParkingRequests`.

#### B. Crea il Progetto Apps Script
1. Dal foglio Google, vai su **Estensioni** > **Apps Script**.
2. Sostituisci il codice presente incollando l'intero contenuto di [`src/services/back-end.gs`](src/services/back-end.gs).
3. **Importante:** In cima allo script, nella costante `CONFIG`, imposta `BASE_URL` con l'indirizzo pubblico del tuo frontend (o `http://localhost:5173/` durante lo sviluppo locale):
   ```javascript
   BASE_URL: "https://il-tuo-dominio.vercel.app/", // o "http://localhost:5173/"
   ```
   Questo garantisce che i link inviati via email (verifica account e recupero password) puntino correttamente alla tua applicazione.

#### C. Configura il Trigger Giornaliero (Assegnazione Automatica)
1. Nella barra laterale di Apps Script, clicca sull'icona **Trigger** (sveglia).
2. Clicca su **Aggiungi trigger** in basso a destra.
3. Imposta i parametri:
   * **Funzione da eseguire:** `processPendingRequests`
   * **Distribuzione da eseguire:** `Head`
   * **Origine dell'evento:** `Basato sull'ora`
   * **Tipo di trigger basato sull'ora:** `Timer giornaliero`
   * **Ora del giorno:** Seleziona l'intervallo desiderato (es. *19:00 - 20:00*, coerente con `CONFIG.ASSIGNMENT_HOUR = 19`).
4. Salva il trigger e concedi i permessi richiesti.

#### D. Esegui il Deploy come Web App
1. In alto a destra, clicca su **Distribuisci** > **Nuova distribuzione**.
2. Clicca sull'icona a ingranaggio e seleziona **Applicazione web**.
3. Configura:
   * **Descrizione:** es. `Park App Backend v1`
   * **Esegui come:** `Me (il tuo indirizzo email)`
   * **Chi ha accesso:** `Chiunque` (necessario affinché il frontend possa dialogare con l'API).
4. Clicca su **Distribuisci** e copia l'**URL dell'applicazione web** (termina con `/exec`).

#### E. Creazione del Primo Utente Amministratore
Tutti i nuovi utenti registrati hanno `isAdmin` impostato su `FALSE`. Per creare il primo amministratore:
1. Registrati normalmente tramite l'applicazione e conferma l'email.
2. Apri il tuo foglio Google, vai nella scheda **`Users`**.
3. Trova la riga del tuo account e imposta la cella nella colonna **`isAdmin`** a **`TRUE`** (o `true`).
4. Ricarica l'applicazione: vedrai comparire gli strumenti amministratore.

---

### 2. Configurazione del Frontend (React)

1. **Installa le dipendenze:**
   ```bash
   npm install
   ```

2. **Crea il file delle variabili d'ambiente (`.env`):**
   Nella root del progetto crea un file `.env` e incolla l'URL dell'applicazione web ottenuto dal deploy di Apps Script:
   ```env
   VITE_GOOGLE_SCRIPT_URL=https://script.google.com/macros/s/IL_TUO_ID_DISTRIBUZIONE/exec
   ```

3. **Avvia in modalità sviluppo:**
   ```bash
   npm run dev
   ```
   L'app sarà disponibile su `http://localhost:5173`.

4. **Build per la Produzione:**
   ```bash
   npm run build
   ```
   I file ottimizzati per la distribuzione verranno generati nella cartella `dist/`.

---

## Logica dell'Algoritmo di Assegnazione

L'assegnazione automatica giornaliera si basa su un principio di **equità distributiva**:

1. **Calcolo della Priorità:**
   Per ogni utente con richieste in sospeso (`pending`), il sistema analizza gli ultimi 30 giorni lavorativi (`CONFIG.LOOK_BACK_DAYS = 30`):
   $$\text{Success Rate} = \frac{\text{Posti Assegnati}}{\text{Richieste Effettuate}}$$
   Gli utenti con il tasso di successo più basso hanno la priorità più alta. A parità di punteggio, l'ordine è casuale.
2. **Capacità Disponibile:**
   $$\text{Posti Disponibili} = (\text{Posti Fissi} - \text{Disabilitazioni del giorno}) + \text{Disponibilità Temporanee del giorno}$$
3. **Assegnazione o Rifiuto:**
   I posti disponibili vengono assegnati in ordine di priorità. Agli utenti a cui non è stato possibile assegnare un posto viene impostato lo stato `not_assigned` e inviata una notifica email.
4. **Riassegnazione Dinamica:**
   Se un utente assegnato cancella la propria prenotazione, il sistema la riassegna automaticamente e immediatamente al primo utente in attesa (`pending` o `not_assigned`) per quella data con la priorità più alta.
