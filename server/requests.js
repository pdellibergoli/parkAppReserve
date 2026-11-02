import { randomUUID } from 'node:crypto';
import {
  addToHistory, assignParking, checkOverbookingForDate, clearHistoryForDate, findBestCandidate,
  getAvailableSpacesForDate, getRequest, getSpace, isSpaceUsableOn, removeFromHistory, updateRequestStatus,
} from './assignment.js';
import { dayToIso, isWeekday, today, toDay } from './dates.js';
import {
  sendAdminCancellationEmail, sendAdminModificationEmail, sendDonationConfirmedEmail,
  sendRequestCreatedEmail, sendSuccessEmail,
} from './emails.js';
import { AppError } from './errors.js';
import { requestToApi } from './mappers.js';

export async function getRequestsForUser(ctx, { userId, fromDate }) {
  const { rows } = await ctx.db.query(
    `SELECT * FROM parking_requests
      WHERE ($1::text IS NULL OR user_id = $1) AND ($2::date IS NULL OR requested_date >= $2)
      ORDER BY requested_date, request_id`,
    [userId ?? null, fromDate ? toDay(fromDate) : null]
  );
  return rows.map(requestToApi);
}

const MAX_PAGE_SIZE = 100;

/** Una pagina delle richieste di un utente, dalla più recente. */
export async function getRequestsPage(ctx, { userId, page, pageSize }) {
  if (!userId) throw new AppError('ID utente non fornito.');

  const currentPage = Math.max(1, Math.trunc(Number(page)) || 1);
  const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.trunc(Number(pageSize)) || 20));

  const [{ rows }, { rows: countRows }] = await Promise.all([
    ctx.db.query(
      `SELECT * FROM parking_requests WHERE user_id = $1
        ORDER BY requested_date DESC, request_id
        LIMIT $2 OFFSET $3`,
      [userId, limit, (currentPage - 1) * limit]
    ),
    ctx.db.query('SELECT count(*)::int AS total FROM parking_requests WHERE user_id = $1', [userId]),
  ]);

  return { requests: rows.map(requestToApi), total: countRows[0].total, page: currentPage, pageSize: limit };
}

async function hasActiveRequest(db, userId, day, excludeRequestId = null) {
  const { rows } = await db.query(
    `SELECT 1 FROM parking_requests
      WHERE user_id = $1 AND requested_date = $2 AND status <> 'cancelled_by_user'
        AND request_id IS DISTINCT FROM $3 LIMIT 1`,
    [userId, day, excludeRequestId]
  );
  return rows.length > 0;
}

export async function createBatchRequests(ctx, { userId, dates, actorId }) {
  if (!userId || !Array.isArray(dates) || dates.length === 0) throw new AppError('Dati mancanti.');

  const currentDay = today();
  const created = [];

  for (const value of dates) {
    const day = toDay(value);
    if (!isWeekday(day) || day < currentDay) continue;
    if (await hasActiveRequest(ctx.db, userId, day)) continue;

    const { rows } = await ctx.db.query(
      `INSERT INTO parking_requests (request_id, user_id, requested_date, status)
       VALUES ($1, $2, $3, 'pending') RETURNING *`,
      [`req_${randomUUID()}`, userId, day]
    );
    created.push(rows[0]);
  }

  if (created.length === 0) throw new AppError('Nessuna richiesta creata.');

  if (actorId && actorId !== userId) {
    await sendRequestCreatedEmail(ctx, userId, created.map((r) => r.requested_date), actorId);
  }

  return { message: `Create ${created.length} richieste.`, requests: created.map(requestToApi) };
}

export async function updateRequestDate(ctx, { requestId, newDate, actorId }) {
  if (!requestId || !newDate) throw new AppError('Dati insufficienti per aggiornare la richiesta.');

  const request = await getRequest(ctx.db, requestId);
  if (!request) throw new AppError('Richiesta da aggiornare non trovata.');

  const currentDay = today();
  if (request.status !== 'pending') throw new AppError('Puoi modificare solo le richieste in attesa.');
  if (request.requested_date < currentDay) throw new AppError('Non puoi modificare una richiesta passata.');

  const targetDay = toDay(newDate);
  if (targetDay < currentDay) throw new AppError('Non puoi spostare una richiesta a una data passata.');

  if (await hasActiveRequest(ctx.db, request.user_id, targetDay, requestId)) {
    throw new AppError("L'utente ha già un'altra richiesta attiva per la nuova data selezionata.");
  }

  await ctx.db.query('UPDATE parking_requests SET requested_date = $2 WHERE request_id = $1', [requestId, targetDay]);

  if (actorId && actorId !== request.user_id) {
    await sendAdminModificationEmail(ctx, request.user_id, request.requested_date, targetDay);
  }

  return {
    message: 'Richiesta aggiornata con successo.',
    updatedRequest: {
      requestId,
      userId: request.user_id,
      requestedDate: dayToIso(targetDay),
      status: request.status,
    },
  };
}

export async function cancelMultipleRequests(ctx, { requestIds, actorId }) {
  if (!Array.isArray(requestIds) || requestIds.length === 0) throw new AppError('Nessun ID di richiesta fornito.');

  const currentDay = today();
  let processedCount = 0;
  const errors = [];

  for (const requestId of new Set(requestIds)) {
    const request = await getRequest(ctx.db, requestId);
    if (!request || request.requested_date < currentDay || request.status === 'cancelled_by_user') continue;

    try {
      if (request.status === 'assigned') {
        await cancelAssignmentAndReassign(ctx, { requestId });
      } else if (request.status === 'pending') {
        await ctx.db.query('DELETE FROM parking_requests WHERE request_id = $1', [requestId]);
      } else {
        await updateRequestStatus(ctx.db, requestId, 'cancelled_by_user');
      }
      if (actorId && actorId !== request.user_id) {
        await sendAdminCancellationEmail(ctx, request.user_id, request.requested_date);
      }
      processedCount++;
    } catch (err) {
      // Un errore SQL invalida l'intera transazione: solo quelli di dominio si possono saltare
      if (!(err instanceof AppError)) throw err;
      errors.push(`Errore processando ${requestId}: ${err.message}`);
    }
  }

  if (processedCount === 0 && errors.length === 0) {
    throw new AppError('Nessuna delle richieste selezionate poteva essere processata.');
  }

  let message = `${processedCount} richieste/assegnazioni processate con successo.`;
  if (errors.length > 0) message += ` Errori: ${errors.join('; ')}`;
  return { message };
}

export async function cancelAssignmentAndReassign(ctx, { requestId }) {
  if (!requestId) throw new AppError('ID della richiesta non fornito.');

  const request = await getRequest(ctx.db, requestId);
  if (!request) throw new AppError('Richiesta non trovata.');
  if (request.status !== 'assigned') throw new AppError('Puoi annullare solo un parcheggio assegnato.');

  const day = request.requested_date;
  if (day < today()) throw new AppError("Non puoi annullare un'assegnazione passata.");

  const spaceId = request.assigned_parking_space_id;
  const spaceNumber = request.assigned_parking_space_number;

  await removeFromHistory(ctx.db, request.user_id, day);
  await updateRequestStatus(ctx.db, requestId, 'cancelled_by_user');

  const space = await getSpace(ctx.db, spaceId);
  let reassigned = false;

  if (await isSpaceUsableOn(ctx.db, space, day)) {
    const recipient = await findBestCandidate(ctx.db, day, request.user_id);
    if (recipient) {
      await assignParking(ctx, recipient, { id: spaceId, number: spaceNumber });
      reassigned = true;
    }
  }

  let message = 'La tua assegnazione è stata annullata';
  if (reassigned) message += ' e il posto è stato riassegnato.';
  else if (!space) message += '. Il posto è stato rimosso dal sistema.';
  else message += '.';
  return { message };
}

export async function fulfillParkingRequest(ctx, { requestId, donorUserId }) {
  if (!requestId || !donorUserId) throw new AppError('Dati insufficienti per cedere il parcheggio.');

  const request = await getRequest(ctx.db, requestId);
  if (!request) throw new AppError('Richiesta non trovata.');

  const day = request.requested_date;
  if (day !== today()) throw new AppError('Questo link di cessione è valido solo per il giorno stesso.');
  if (request.status === 'assigned') throw new AppError('Questa richiesta ha già un parcheggio assegnato.');
  if (request.status === 'cancelled_by_user') throw new AppError("Questa richiesta è stata annullata dall'utente.");

  const { rows: donorRows } = await ctx.db.query(
    `SELECT * FROM parking_requests WHERE user_id = $1 AND requested_date = $2 AND status = 'assigned' LIMIT 1`,
    [donorUserId, day]
  );
  const donorRequest = donorRows[0];
  if (!donorRequest) throw new AppError('Non è stato trovato un parcheggio assegnato al donatore per oggi.');

  const spaceId = donorRequest.assigned_parking_space_id;
  const spaceNumber = donorRequest.assigned_parking_space_number;
  const space = await getSpace(ctx.db, spaceId);
  if (!(await isSpaceUsableOn(ctx.db, space, day))) {
    throw new AppError('Il parcheggio che si sta tentando di cedere non è più disponibile.');
  }

  await updateRequestStatus(ctx.db, donorRequest.request_id, 'cancelled_by_user');
  await removeFromHistory(ctx.db, donorUserId, day);
  await assignParking(ctx, request, { id: spaceId, number: spaceNumber });

  // Senza overbooking quel giorno non pesa sulla priorità di nessuno
  if (!(await checkOverbookingForDate(ctx.db, day))) await clearHistoryForDate(ctx.db, day);

  await sendDonationConfirmedEmail(ctx, donorUserId, request.user_id, day, spaceNumber);

  const { rows } = await ctx.db.query('SELECT first_name, last_name FROM users WHERE id = $1', [request.user_id]);
  return { message: `Grazie! Il parcheggio è stato ceduto con successo a ${rows[0].first_name} ${rows[0].last_name}.` };
}

export async function adminUpdateUserRequestStatus(ctx, { requestId, newStatus, preventAutoLogic }) {
  if (!requestId || !newStatus) throw new AppError("Dati insufficienti per l'aggiornamento.");

  const request = await getRequest(ctx.db, requestId);
  if (!request) throw new AppError('Richiesta non trovata.');
  if (request.status === newStatus) return { message: 'Stato invariato.' };

  const { user_id: userId, requested_date: day } = request;

  if (request.status === 'assigned') {
    const spaceId = request.assigned_parking_space_id;
    const spaceNumber = request.assigned_parking_space_number;

    await updateRequestStatus(ctx.db, requestId, newStatus);
    await removeFromHistory(ctx.db, userId, day);
    await sendAdminCancellationEmail(ctx, userId, day);

    if (!preventAutoLogic && (await getSpace(ctx.db, spaceId))) {
      const candidate = await findBestCandidate(ctx.db, day, userId);
      if (candidate) await assignParking(ctx, candidate, { id: spaceId, number: spaceNumber });
    }
  } else if (newStatus === 'assigned') {
    if (!preventAutoLogic) {
      const freeSpaces = await getAvailableSpacesForDate(ctx.db, day);
      if (freeSpaces.length === 0) {
        throw new AppError("Nessun posto disponibile. (Seleziona 'Forza' per ignorare il limite)");
      }
      await assignParking(ctx, request, freeSpaces[0]);
    } else {
      // Overbooking: assegnata senza un posto reale
      await updateRequestStatus(ctx.db, requestId, 'assigned', 'forced', 'Forzato');
      await addToHistory(ctx.db, userId, day, 'forced');
      await sendSuccessEmail(ctx, userId, day, 'Forzato (Extra)');
    }
  } else {
    await ctx.db.query('UPDATE parking_requests SET status = $2 WHERE request_id = $1', [requestId, newStatus]);
  }

  return { message: 'Operazione completata con successo.' };
}
