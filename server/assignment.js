import { CONFIG } from './config.js';
import { addDays, currentHour, formatDay, today, windowStartDay } from './dates.js';
import { sendFailureEmail, sendSuccessEmail } from './emails.js';

/**
 * Statistiche di priorità per utente, nella finestra degli ultimi N giorni lavorativi.
 *  - Richieste conteggiate: 'assigned', 'not_assigned', 'pending'
 *  - Assegnazioni conteggiate: righe di assignment_history nella stessa finestra
 *  - successRate = assegnazioni / richieste (0 se non ci sono richieste)
 */
export async function computePriorityStats(db) {
  const { rows } = await db.query(
    `SELECT u.id,
            (SELECT count(*)::int FROM assignment_history h
              WHERE h.user_id = u.id AND h.assignment_date BETWEEN $1 AND $2) AS assignments,
            (SELECT count(*)::int FROM parking_requests r
              WHERE r.user_id = u.id AND r.requested_date BETWEEN $1 AND $2
                AND r.status IN ('assigned', 'not_assigned', 'pending')) AS requests
       FROM users u`,
    [windowStartDay(), today()]
  );

  const stats = new Map();
  for (const { id, assignments, requests } of rows) {
    stats.set(id, {
      successRate: requests > 0 ? assignments / requests : 0,
      recentAssignments: assignments,
      recentRequests: requests,
    });
  }
  return stats;
}

function shuffle(items) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** successRate più basso = priorità più alta; a parità, ordine casuale. */
export async function sortByPriority(db, requests) {
  const stats = await computePriorityStats(db);
  const rate = (req) => stats.get(req.user_id)?.successRate ?? 0;
  return shuffle(requests).sort((a, b) => rate(a) - rate(b));
}

export async function getSpace(db, spaceId) {
  const { rows } = await db.query('SELECT * FROM parking_spaces WHERE id = $1', [spaceId]);
  return rows[0];
}

export async function getRequest(db, requestId) {
  const { rows } = await db.query('SELECT * FROM parking_requests WHERE request_id = $1', [requestId]);
  return rows[0];
}

/** Il posto è utilizzabile quel giorno? Fissi: salvo disabilitazioni. Non fissi: solo se resi disponibili. */
export async function isSpaceUsableOn(db, space, day) {
  if (!space) return false;
  const { rows } = await db.query(
    `SELECT EXISTS (SELECT 1 FROM temporary_availability WHERE parking_space_id = $1 AND available_date = $2) AS avail,
            EXISTS (SELECT 1 FROM temporary_unavailability WHERE parking_space_id = $1 AND unavailable_date = $2) AS unavail`,
    [space.id, day]
  );
  return space.is_fixed ? !rows[0].unavail : rows[0].avail;
}

export async function getAvailableSpacesForDate(db, day) {
  const { rows } = await db.query(
    `SELECT s.* FROM parking_spaces s
      WHERE (s.is_fixed OR EXISTS (
              SELECT 1 FROM temporary_availability a
               WHERE a.parking_space_id = s.id AND a.available_date = $1))
        AND NOT EXISTS (
              SELECT 1 FROM temporary_unavailability u
               WHERE u.parking_space_id = s.id AND u.unavailable_date = $1)
        AND NOT EXISTS (
              SELECT 1 FROM parking_requests r
               WHERE r.assigned_parking_space_id = s.id AND r.requested_date = $1 AND r.status = 'assigned')
      ORDER BY s.is_fixed DESC, s.seq`,
    [day]
  );
  return rows;
}

export async function updateRequestStatus(db, requestId, status, spaceId = null, spaceNumber = null) {
  await db.query(
    `UPDATE parking_requests
        SET status = $2, assigned_parking_space_id = $3, assigned_parking_space_number = $4
      WHERE request_id = $1`,
    [requestId, status, spaceId, spaceNumber]
  );
}

export async function addToHistory(db, userId, day, spaceId) {
  await db.query(
    'INSERT INTO assignment_history (user_id, assignment_date, parking_space_id) VALUES ($1, $2, $3)',
    [userId, day, spaceId]
  );
}

export async function removeFromHistory(db, userId, day) {
  await db.query(
    `DELETE FROM assignment_history WHERE id = (
       SELECT id FROM assignment_history
        WHERE user_id = $1 AND assignment_date = $2 ORDER BY id DESC LIMIT 1)`,
    [userId, day]
  );
}

export async function clearHistoryForDate(db, day) {
  await db.query('DELETE FROM assignment_history WHERE assignment_date = $1', [day]);
}

/** Aggiorna la richiesta, registra nello storico, invia l'email. */
export async function assignParking(ctx, request, space) {
  await updateRequestStatus(ctx.db, request.request_id, 'assigned', space.id, space.number);
  await addToHistory(ctx.db, request.user_id, request.requested_date, space.id);
  await sendSuccessEmail(ctx, request.user_id, request.requested_date, space.number);
}

export async function checkOverbookingForDate(db, day) {
  const { rows } = await db.query(
    `SELECT
       (SELECT count(*)::int FROM parking_requests
         WHERE requested_date = $1 AND status <> 'cancelled_by_user') AS requests,
       (SELECT count(*)::int FROM parking_spaces s
         WHERE s.is_fixed AND NOT EXISTS (
           SELECT 1 FROM temporary_unavailability u
            WHERE u.parking_space_id = s.id AND u.unavailable_date = $1)) AS fixed,
       (SELECT count(DISTINCT parking_space_id)::int FROM temporary_availability
         WHERE available_date = $1) AS temp`,
    [day]
  );
  const { requests, fixed, temp } = rows[0];
  return requests > fixed + temp;
}

export async function findBestCandidate(db, day, excludeUserId = null) {
  const { rows } = await db.query(
    `SELECT * FROM parking_requests
      WHERE requested_date = $1 AND status IN ('not_assigned', 'pending')
        AND user_id IS DISTINCT FROM $2`,
    [day, excludeUserId]
  );
  if (rows.length === 0) return null;
  return (await sortByPriority(db, rows))[0];
}

/** Motore di assegnazione: richieste pending del giorno, in ordine di priorità. */
export async function processRequestsForDate(ctx, day) {
  const { rows: pending } = await ctx.db.query(
    `SELECT * FROM parking_requests WHERE status = 'pending' AND requested_date = $1`,
    [day]
  );
  if (pending.length === 0) {
    console.log(`Nessuna richiesta 'pending' per ${formatDay(day)}.`);
    return { assigned: 0, failed: 0 };
  }

  const spaces = await getAvailableSpacesForDate(ctx.db, day);
  const ordered = await sortByPriority(ctx.db, pending);

  let assigned = 0;
  let failed = 0;
  for (const [i, request] of ordered.entries()) {
    if (i < spaces.length) {
      await assignParking(ctx, request, spaces[i]);
      assigned++;
    } else {
      await updateRequestStatus(ctx.db, request.request_id, 'not_assigned');
      await sendFailureEmail(ctx, request.user_id, day);
      failed++;
    }
  }
  console.log(`Assegnazione ${formatDay(day)}: ${assigned} assegnati, ${failed} non assegnati.`);
  return { assigned, failed };
}

export async function assignToBestCandidate(ctx, spaceId, day) {
  const candidate = await findBestCandidate(ctx.db, day);
  if (!candidate) return;
  const space = await getSpace(ctx.db, spaceId);
  if (space) await assignParking(ctx, candidate, space);
}

/** Dopo l'orario di assegnazione, un posto reso disponibile per domani va subito a chi è in attesa. */
export async function handleInstantReassignment(ctx, spaceId, day) {
  if (currentHour() < CONFIG.ASSIGNMENT_HOUR) return;
  if (day !== addDays(today(), 1)) return;
  await assignToBestCandidate(ctx, spaceId, day);
}
