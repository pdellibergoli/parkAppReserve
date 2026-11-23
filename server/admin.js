import { randomUUID } from 'node:crypto';
import {
  addToHistory, clearHistoryForDate, getSpace, processRequestsForDate, removeFromHistory, updateRequestStatus,
} from './assignment.js';
import { formatDay, toDay, today } from './dates.js';
import { sendAdminCancellationEmail, sendSuccessEmail } from './emails.js';
import { AppError } from './errors.js';
import { requestToApi } from './mappers.js';
import { getActiveRegulation } from './regulations.js';
import { cancelAssignmentAndReassign } from './requests.js';

export async function adminCancelAllRequestsForDate(ctx, { date }) {
  if (!date) throw new AppError('Data non fornita.');
  const day = toDay(date);

  const { rows } = await ctx.db.query(
    'DELETE FROM parking_requests WHERE requested_date = $1 RETURNING user_id',
    [day]
  );
  if (rows.length > 0) await clearHistoryForDate(ctx.db, day);

  for (const userId of new Set(rows.map((r) => r.user_id))) {
    await sendAdminCancellationEmail(ctx, userId, day);
  }

  return { message: `Eliminate ${rows.length} richieste per il ${formatDay(day)} e storico aggiornato.` };
}

/** Riporta a 'pending' assegnate e non assegnate del giorno, svuota lo storico, avvisa chi perde il posto. */
export async function adminResetAssignmentsForDate(ctx, { date }) {
  if (!date) throw new AppError('Data non fornita.');
  const day = toDay(date);

  const { rows } = await ctx.db.query(
    `SELECT request_id, user_id, status FROM parking_requests
      WHERE requested_date = $1 AND status IN ('assigned', 'not_assigned', 'rules_not_accepted')`,
    [day]
  );

  for (const { request_id: requestId } of rows) {
    await updateRequestStatus(ctx.db, requestId, 'pending');
  }

  if (rows.length > 0) {
    await clearHistoryForDate(ctx.db, day);
    const revoked = new Set(rows.filter((r) => r.status === 'assigned').map((r) => r.user_id));
    for (const userId of revoked) await sendAdminCancellationEmail(ctx, userId, day);
  }

  return { message: `${rows.length} richieste resettate a 'In attesa' per il ${formatDay(day)}.` };
}

export async function adminManuallyAssignForDate(ctx, { date }) {
  if (!date) throw new AppError('Data non fornita.');
  const day = toDay(date);

  const result = await processRequestsForDate(ctx, day);
  return {
    message: `Assegnazione manuale completata per il ${formatDay(day)}. ${result.assigned} assegnati, ${result.failed} non assegnati.`,
  };
}

export async function adminAssignParckingForDate(ctx, { date, userId, spaceId }) {
  if (!date || !userId || !spaceId) throw new AppError('Dati insufficienti (data, utente o posto mancanti).');
  const day = toDay(date);

  const activeReg = await getActiveRegulation(ctx.db);
  const { rows: userRows } = await ctx.db.query('SELECT accepted_rules_version FROM users WHERE id = $1', [userId]);
  if (!userRows[0] || userRows[0].accepted_rules_version !== activeReg?.version) {
    throw new AppError("L'utente non ha ancora accettato il regolamento aziendale e non può ricevere un'assegnazione.");
  }

  const space = await getSpace(ctx.db, spaceId);
  if (!space) throw new AppError('Parcheggio non trovato.');

  // Si riusa la richiesta esistente del giorno, preferendo una ancora attiva a una annullata
  const { rows: existing } = await ctx.db.query(
    `SELECT request_id FROM parking_requests WHERE user_id = $1 AND requested_date = $2
      ORDER BY (status = 'cancelled_by_user'), request_id LIMIT 1`,
    [userId, day]
  );

  let requestId;
  if (existing.length > 0) {
    requestId = existing[0].request_id;
    await updateRequestStatus(ctx.db, requestId, 'assigned', spaceId, space.number);
  } else {
    requestId = `req_${randomUUID()}`;
    await ctx.db.query(
      `INSERT INTO parking_requests
         (request_id, user_id, requested_date, status, assigned_parking_space_id, assigned_parking_space_number)
       VALUES ($1, $2, $3, 'assigned', $4, $5)`,
      [requestId, userId, day, spaceId, space.number]
    );
  }

  await removeFromHistory(ctx.db, userId, day);
  await addToHistory(ctx.db, userId, day, spaceId);
  await sendSuccessEmail(ctx, userId, day, space.number);

  return {
    message: `Posto ${space.number} assegnato a ${userId} per il ${formatDay(day)}.`,
    request: requestToApi({
      request_id: requestId,
      user_id: userId,
      requested_date: day,
      status: 'assigned',
      assigned_parking_space_id: spaceId,
      assigned_parking_space_number: space.number,
    }),
  };
}

export async function deleteUser(ctx, { userId, actorId }) {
  if (!userId) throw new AppError('ID utente non fornito.');

  const adminId = actorId || ctx.user?.id;
  if (!adminId) throw new AppError('Azione riservata agli amministratori.');

  const { rows: adminRows } = await ctx.db.query('SELECT is_admin FROM users WHERE id = $1', [adminId]);
  if (!adminRows[0]?.is_admin) throw new AppError('Azione riservata agli amministratori.');

  if (userId === adminId) {
    throw new AppError('Non puoi eliminare il tuo stesso account.');
  }

  const { rows: targetRows } = await ctx.db.query(
    'SELECT id, first_name, last_name, mail FROM users WHERE id = $1',
    [userId]
  );
  if (targetRows.length === 0) throw new AppError('Utente non trovato.');
  const targetUser = targetRows[0];

  // 1. Riassegna o cancella eventuali posti già assegnati per date future (>= oggi)
  const { rows: futureAssigned } = await ctx.db.query(
    `SELECT request_id FROM parking_requests WHERE user_id = $1 AND requested_date >= $2 AND status = 'assigned'`,
    [userId, today()]
  );
  for (const { request_id: reqId } of futureAssigned) {
    try {
      await cancelAssignmentAndReassign(ctx, { requestId: reqId });
    } catch {
      // Ignora errori minori se l'assegnazione è già stata modificata
    }
  }

  // 2. Elimina lo storico delle assegnazioni dell'utente
  await ctx.db.query('DELETE FROM assignment_history WHERE user_id = $1', [userId]);

  // 3. Elimina tutte le richieste di parcheggio dell'utente
  await ctx.db.query('DELETE FROM parking_requests WHERE user_id = $1', [userId]);

  // 4. Elimina definitivamente l'utente
  await ctx.db.query('DELETE FROM users WHERE id = $1', [userId]);

  const fullName = `${targetUser.first_name} ${targetUser.last_name || ''}`.trim();
  return {
    message: `Utente ${fullName} (${targetUser.mail}) eliminato con successo.`,
    deletedUserId: userId,
  };
}

export { deleteUser as adminDeleteUser };
