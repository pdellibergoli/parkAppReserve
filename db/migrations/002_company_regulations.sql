-- Tabella per il regolamento aziendale e relative versioni
CREATE TABLE IF NOT EXISTS company_regulations (
  version TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Colonne utente per tracciare l'accettazione del regolamento
ALTER TABLE users ADD COLUMN IF NOT EXISTS accepted_rules_version TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS rules_accepted_at TIMESTAMPTZ;

-- Inserimento del regolamento iniziale v1.0
INSERT INTO company_regulations (version, title, content, is_active, updated_at)
VALUES (
  '1.0',
  'Regolamento per l’Utilizzo dei Parcheggi Aziendali – Sede di Chiasso',
  'Per garantire una gestione trasparente, equa ed efficiente degli stalli auto disponibili presso la sede di Chiasso, tutti i collaboratori sono tenuti a rispettare le seguenti linee guida operative.

1. Canale Unico di Prenotazione e Rispetto dell''Applicazione
Prenotazione Esclusiva via App: L''assegnazione dei posti auto avviene unicamente tramite l''applicazione Park App Reserve. Non sono ammesse occupazioni arbitrarie o accordi verbali non registrati.

Richieste alle Business Manager: Chi concorda eccezionalmente o richiede la disponibilità del parcheggio direttamente alle Business Manager/all''Amministrazione deve accertarsi che la prenotazione venga formalizzata e assegnata all''interno dell''app (tramite inserimento da parte dell''amministratore o registrazione della richiesta). Nessun posto può considerarsi garantito senza la corrispondente assegnazione a sistema.

2. Criteri di Idoneità alla Richiesta
Effettiva Presenza in Sede: La richiesta può essere inserita esclusivamente per i giorni in cui è prevista la reale presenza fisica presso gli uffici di Chiasso.

Utilizzo Effettivo dell''Auto: La prenotazione è riservata a chi si reca in ufficio con la propria automobile. È severamente vietato inserire richieste se si viaggia in treno, con i mezzi pubblici, a piedi, in bici o in moto. L''inserimento fittizio di richieste altera l''algoritmo di priorità e falsa le statistiche a discapito dei colleghi.

Cancellazione Tempestiva: Qualora la presenza in sede o l''uso dell''auto dovessero decadere (smart working, malattia, trasferta o cambio mezzo), la richiesta o l''assegnazione deve essere annullata tempestivamente all''interno dell''app per rimettere a disposizione il posto.

3. Soste Brevi (2–3 Ore)
Nessuna Registrazione Necessaria: Chi deve recarsi in sede per una sosta temporanea o di passaggio (massimo 2–3 ore nell''arco della giornata) non deve effettuare alcuna prenotazione sull''app.

Condotta: In caso di sosta breve, è opportuno verificare che lo stallo utilizzato non sia già stato regolarmente assegnato per l''intera giornata a un collega o concordare temporaneamente l''appoggio per evitare blocchi.

4. Urgenze e Casi Eccezionali
Flessibilità e Buonsenso: In caso di reali urgenze, necessità impreviste o motivate esigenze personali/lavorative, i collaboratori sono invitati al dialogo e alla collaborazione reciproca.

Accordo Diretto / Cessione: Chi si trova in difficoltà può contattare un collega assegnatario per concordare la cessione del posto (tramite l''apposita funzione di cessione in app) oppure rivolgersi all''amministrazione per valutare una gestione manuale della contingenza.

La disponibilità dei parcheggi è una risorsa condivisa e limitata: la correttezza di ciascuno nell''utilizzo dell''app assicura il corretto funzionamento dell''algoritmo e garantisce parità di trattamento per tutto il team.',
  TRUE,
  now()
)
ON CONFLICT (version) DO NOTHING;
