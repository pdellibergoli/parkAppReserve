import { AppError } from './errors.js';
import { userToApi } from './mappers.js';

export const INITIAL_REGULATION_VERSION = '1.0';
export const INITIAL_REGULATION_TITLE = 'Regolamento per l’Utilizzo dei Parcheggi Aziendali – Sede di Chiasso';
export const INITIAL_REGULATION_CONTENT =
`Per garantire una gestione trasparente, equa ed efficiente degli stalli auto disponibili presso la sede di Chiasso, tutti i collaboratori sono tenuti a rispettare le seguenti linee guida operative.

1. Canale Unico di Prenotazione e Rispetto dell'Applicazione
Prenotazione Esclusiva via App: L'assegnazione dei posti auto avviene unicamente tramite l'applicazione Park App Reserve. Non sono ammesse occupazioni arbitrarie o accordi verbali non registrati.

Richieste alle Business Manager: Chi concorda eccezionalmente o richiede la disponibilità del parcheggio direttamente alle Business Manager/all'Amministrazione deve accertarsi che la prenotazione venga formalizzata e assegnata all'interno dell'app (tramite inserimento da parte dell'amministratore o registrazione della richiesta). Nessun posto può considerarsi garantito senza la corrispondente assegnazione a sistema.

2. Criteri di Idoneità alla Richiesta
Effettiva Presenza in Sede: La richiesta può essere inserita esclusivamente per i giorni in cui è prevista la reale presenza fisica presso gli uffici di Chiasso.

Utilizzo Effettivo dell'Auto: La prenotazione è riservata a chi si reca in ufficio con la propria automobile. È severamente vietato inserire richieste se si viaggia in treno, con i mezzi pubblici, a piedi, in bici o in moto. L'inserimento fittizio di richieste altera l'algoritmo di priorità e falsa le statistiche a discapito dei colleghi.

Cancellazione Tempestiva: Qualora la presenza in sede o l'uso dell'auto dovessero decadere (smart working, malattia, trasferta o cambio mezzo), la richiesta o l'assegnazione deve essere annullata tempestivamente all'interno dell'app per rimettere a disposizione il posto.

3. Soste Brevi (2–3 Ore)
Nessuna Registrazione Necessaria: Chi deve recarsi in sede per una sosta temporanea o di passaggio (massimo 2–3 ore nell'arco della giornata) non deve effettuare alcuna prenotazione sull'app.

Condotta: In caso di sosta breve, è opportuno verificare che lo stallo utilizzato non sia già stato regolarmente assegnato per l'intera giornata a un collega o concordare temporaneamente l'appoggio per evitare blocchi.

4. Urgenze e Casi Eccezionali
Flessibilità e Buonsenso: In caso di reali urgenze, necessità impreviste o motivate esigenze personali/lavorative, i collaboratori sono invitati al dialogo e alla collaborazione reciproca.

Accordo Diretto / Cessione: Chi si trova in difficoltà può contattare un collega assegnatario per concordare la cessione del posto (tramite l'apposita funzione di cessione in app) oppure rivolgersi all'amministrazione per valutare una gestione manuale della contingenza.

La disponibilità dei parcheggi è una risorsa condivisa e limitata: la correttezza di ciascuno nell'utilizzo dell'app assicura il corretto funzionamento dell'algoritmo e garantisce parità di trattamento per tutto il team.`;

export function regulationToApi(row) {
  if (!row) return null;
  return {
    version: String(row.version),
    title: row.title,
    content: row.content,
    isActive: Boolean(row.is_active),
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
  };
}

export async function getActiveRegulation(db) {
  const { rows } = await db.query(
    'SELECT * FROM company_regulations WHERE is_active = TRUE ORDER BY updated_at DESC LIMIT 1'
  );
  if (rows.length > 0) return regulationToApi(rows[0]);

  const { rows: latestRows } = await db.query(
    'SELECT * FROM company_regulations ORDER BY updated_at DESC LIMIT 1'
  );
  if (latestRows.length > 0) return regulationToApi(latestRows[0]);

  return {
    version: INITIAL_REGULATION_VERSION,
    title: INITIAL_REGULATION_TITLE,
    content: INITIAL_REGULATION_CONTENT,
    isActive: true,
    updatedAt: new Date().toISOString(),
  };
}

export async function acceptRules(ctx, { userId, version }) {
  if (!userId) throw new AppError('ID utente non fornito.');

  const activeReg = await getActiveRegulation(ctx.db);
  const targetVersion = String(version || activeReg.version || INITIAL_REGULATION_VERSION);

  const { rows } = await ctx.db.query(
    `UPDATE users
     SET accepted_rules_version = $1, rules_accepted_at = now()
     WHERE id = $2
     RETURNING *`,
    [targetVersion, userId]
  );

  if (rows.length === 0) throw new AppError('Utente non trovato.');

  return {
    message: 'Regolamento accettato con successo.',
    user: userToApi(rows[0]),
    acceptedVersion: targetVersion,
  };
}

export async function updateRegulation(ctx, { actorId, version, title, content, isActive }) {
  if (!actorId) throw new AppError('Utente non autorizzato.');

  const { rows: adminRows } = await ctx.db.query('SELECT is_admin FROM users WHERE id = $1', [actorId]);
  if (!adminRows[0]?.is_admin) {
    throw new AppError('Solo gli amministratori possono modificare o pubblicare il regolamento.');
  }

  if (!version || !title || !content) {
    throw new AppError('Versione, titolo e contenuto del regolamento sono obbligatori.');
  }

  const shouldBeActive = isActive !== false;

  if (shouldBeActive) {
    await ctx.db.query('UPDATE company_regulations SET is_active = FALSE WHERE version <> $1', [String(version)]);
  }

  const { rows } = await ctx.db.query(
    `INSERT INTO company_regulations (version, title, content, is_active, updated_at)
     VALUES ($1, $2, $3, $4, now())
     ON CONFLICT (version) DO UPDATE
     SET title = EXCLUDED.title, content = EXCLUDED.content, is_active = EXCLUDED.is_active, updated_at = EXCLUDED.updated_at
     RETURNING *`,
    [String(version), title, content, shouldBeActive]
  );

  return regulationToApi(rows[0]);
}
