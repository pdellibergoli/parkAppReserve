# Park App Reserve 🚗

Park App Reserve è un'applicazione web full-stack progettata per la gestione e la prenotazione di parcheggi aziendali. Consente agli utenti di richiedere un posto auto per giorni specifici e a un sistema automatizzato di assegnare i posti disponibili in modo equo e trasparente.

## Caratteristiche Principali

* **Autenticazione Utente:** Registrazione sicura con hashing password e salt, verifica via e-mail e recupero password.
* **Sistema di Richieste:** Gli utenti possono inviare richieste singole o multiple per date future, visualizzarle, modificarle o cancellarle.
* **Assegnazione Automatica & Algoritmo di Priorità:** Esecuzione automatica programmata la sera prima del giorno richiesto (alle 19:00). La priorità favorisce chi ha avuto meno assegnazioni negli ultimi 30 giorni lavorativi (*success rate* più basso).
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

* **Frontend:** React 19 con Vite, React Router 7, React Big Calendar, React Day Picker, date-fns, react-icons, CSS con variabili per temi chiaro e scuro.
* **Backend:** funzioni serverless Node nella cartella `api/`, logica in `server/`.
* **Database:** PostgreSQL, con il driver `pg`.
* **Email:** SMTP con Nodemailer.
* **Assegnazione serale:** Vercel Cron.

```
api/            Endpoint HTTP: /api/rpc (tutte le azioni) e /api/cron/assign
server/         Logica di business, accesso al database, email
db/migrations/  Schema del database in file SQL numerati
scripts/        Migrazioni, dati di sviluppo, assegnazione manuale
src/            Applicazione React
tests/          Test del backend su Postgres
```

Il browser chiama `POST /api/rpc` con `{ action, payload }`. Le credenziali del database e dell'SMTP restano sul server: nessuna variabile ha il prefisso `VITE_`, quindi non finiscono nel bundle.

---

## Sviluppo in locale

Servono Node 22 e Docker Desktop in esecuzione.

```bash
npm install
cp .env.example .env.local   # i valori predefiniti puntano ai servizi Docker locali
npm run db:up                # avvia Postgres (porta 5434) e Mailpit
npm run db:reset             # crea lo schema e carica i dati di esempio
npm run dev                  # app e API su http://localhost:5173
```

Accesso con `admin@parkapp.local` (amministratore) o `mario@parkapp.local`, password `Password123!`.

Le email non vengono recapitate: finiscono in Mailpit, su http://localhost:8025. I link di verifica e di recupero password si aprono da lì.

| Comando | Cosa fa |
|---|---|
| `npm run dev` | Avvia app e API |
| `npm test` | Esegue i test del backend sul database `parkapp_test`, che viene azzerato |
| `npm run test:e2e` | Esegue i test end-to-end nel browser sulla build di produzione, con il database `parkapp_e2e` |
| `npm run test:e2e:dates` | Ripete i test end-to-end con l'orologio simulato su date critiche: fine mese, fine anno, cambio d'ora |
| `npm run test:e2e:ui` | Come sopra, con l'interfaccia di Playwright per seguire i test passo passo |
| `npm run db:up` / `db:down` | Avvia o ferma i servizi Docker, i dati restano nel volume |
| `npm run db:migrate` | Applica le migrazioni mancanti |
| `npm run db:reset` | Cancella e ricrea il database di sviluppo. Funziona solo su un database locale |
| `npm run assign` | Esegue l'assegnazione serale per domani, in locale non c'è il cron. Accetta una data: `npm run assign -- 2026-11-02` |

I test end-to-end sono in `tests/e2e/` e richiedono Postgres e Mailpit attivi (`npm run db:up`). La prima volta installa il browser con `npx playwright install chromium`. Il report di un'esecuzione si apre con `npx playwright show-report`.

Per modificare lo schema aggiungi un file numerato in `db/migrations/`, ad esempio `002_nome.sql`, ed esegui `npm run db:migrate`. `npm run preview` serve solo il frontend: per le API usa `npm run dev`.

Il primo amministratore di un database nuovo si imposta dal database:

```sql
UPDATE users SET is_admin = TRUE WHERE mail = 'nome@azienda.it';
```

---

## Produzione

Il progetto si pubblica su Vercel così com'è: `api/` diventa funzioni serverless, `vercel.json` definisce i cron. Servono un database Postgres raggiungibile da Vercel (ad esempio Neon) e un servizio SMTP.

Variabili da impostare su Vercel:

| Variabile | Valore |
|---|---|
| `DATABASE_URL` | Stringa di connessione al database di produzione, con pooling se disponibile |
| `APP_BASE_URL` | Indirizzo pubblico dell'app, usato nei link delle email |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_SECURE` | Accesso al servizio SMTP |
| `MAIL_FROM`, `MAIL_REPLY_TO` | Mittente e indirizzo di risposta |
| `CRON_SECRET` | Stringa casuale lunga: Vercel la invia al cron, che senza di essa rifiuta la chiamata |

Lo schema si applica dalla propria macchina prima del deploy:

```bash
DATABASE_URL="<stringa di produzione>" node scripts/migrate.js
```

I cron di Vercel sono in UTC: `vercel.json` ne pianifica due, alle 17 e alle 18 UTC, e `/api/cron/assign` procede solo se a Roma sono le 19, così l'orario resta giusto con ora legale e solare.

---

## Logica dell'Algoritmo di Assegnazione

L'assegnazione automatica giornaliera si basa su un principio di **equità distributiva**:

1. **Calcolo della Priorità:**
   Per ogni utente con richieste in sospeso (`pending`), il sistema analizza gli ultimi 30 giorni lavorativi (`CONFIG.LOOK_BACK_DAYS`):
   $$\text{Success Rate} = \frac{\text{Posti Assegnati}}{\text{Richieste Effettuate}}$$
   Gli utenti con il tasso di successo più basso hanno la priorità più alta. A parità di punteggio, l'ordine è casuale.
2. **Capacità Disponibile:**
   $$\text{Posti Disponibili} = (\text{Posti Fissi} - \text{Disabilitazioni del giorno}) + \text{Disponibilità Temporanee del giorno}$$
3. **Assegnazione o Rifiuto:**
   I posti disponibili vengono assegnati in ordine di priorità. Agli utenti a cui non è stato possibile assegnare un posto viene impostato lo stato `not_assigned` e inviata una notifica email.
4. **Riassegnazione Dinamica:**
   Se un utente assegnato cancella la propria prenotazione, il sistema la riassegna automaticamente e immediatamente al primo utente in attesa (`pending` o `not_assigned`) per quella data con la priorità più alta.

I calcoli su giorni e orari usano sempre il fuso `Europe/Rome`, indipendentemente da dove gira il server.
