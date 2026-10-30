import { randomUUID } from 'node:crypto';
import {
  addToHistory, assignToBestCandidate, checkOverbookingForDate, clearHistoryForDate, getAvailableSpacesForDate,
  handleInstantReassignment, removeFromHistory, updateRequestStatus,
} from './assignment.js';
import { dayToIso, today, toDay } from './dates.js';
import { sendFailureEmail, sendSuccessEmail } from './emails.js';
import { AppError } from './errors.js';
import { availabilityToApi, unavailabilityToApi } from './mappers.js';

async function findAssignmentOnSpace(db, spaceId, day) {
  const { rows } = await db.query(
    `SELECT * FROM parking_requests
      WHERE status = 'assigned' AND assigned_parking_space_id = $1 AND requested_date = $2
      LIMIT 1`,
    [spaceId, day]
  );
  return rows[0];
}

export async function addTemporaryAvailability(ctx, { spaceId, date }) {
  if (!spaceId || !date) throw new AppError('ID del parcheggio e data sono obbligatori.');

  const day = toDay(date);
  const availabilityId = `avail_${randomUUID()}`;
  await ctx.db.query(
    'INSERT INTO temporary_availability (availability_id, parking_space_id, available_date) VALUES ($1, $2, $3)',
    [availabilityId, spaceId, day]
  );

  if (day === today()) await assignToBestCandidate(ctx, spaceId, day);
  await handleInstantReassignment(ctx, spaceId, day);

  return {
    message: 'Disponibilità temporanea aggiunta.',
    availability: { availabilityId, parkingSpaceId: spaceId, availableDate: dayToIso(day) },
  };
}

export async function getTemporaryAvailabilities(ctx, { spaceId }) {
  if (!spaceId) throw new AppError('ID del parcheggio non fornito.');
  const { rows } = await ctx.db.query(
    `SELECT * FROM temporary_availability
      WHERE parking_space_id = $1 AND available_date >= $2 ORDER BY available_date`,
    [spaceId, today()]
  );
  return rows.map(availabilityToApi);
}

export async function removeTemporaryAvailability(ctx, { availabilityId }) {
  if (!availabilityId) throw new AppError('ID della disponibilità non fornito.');

  const { rows } = await ctx.db.query(
    'DELETE FROM temporary_availability WHERE availability_id = $1 RETURNING *',
    [availabilityId]
  );
  if (rows.length === 0) throw new AppError('Disponibilità non trovata.');

  const { parking_space_id: spaceId, available_date: day } = rows[0];

  const assignment = await findAssignmentOnSpace(ctx.db, spaceId, day);
  if (assignment) {
    await updateRequestStatus(ctx.db, assignment.request_id, 'not_assigned');
    await removeFromHistory(ctx.db, assignment.user_id, day);
    if (!(await checkOverbookingForDate(ctx.db, day))) await clearHistoryForDate(ctx.db, day);
  }

  return {
    message: 'Disponibilità rimossa con successo.' + (assignment ? " L'assegnazione collegata è stata annullata." : ''),
  };
}

export async function addTemporaryUnavailability(ctx, { spaceId, date }) {
  if (!spaceId || !date) throw new AppError('ID del parcheggio e data sono obbligatori.');

  const day = toDay(date);
  const unavailabilityId = `unavail_${randomUUID()}`;
  await ctx.db.query(
    'INSERT INTO temporary_unavailability (unavailability_id, parking_space_id, unavailable_date) VALUES ($1, $2, $3)',
    [unavailabilityId, spaceId, day]
  );

  // Se quel giorno il posto era già assegnato, si sposta l'utente o si annulla l'assegnazione
  let message = 'Disabilitazione temporanea aggiunta.';
  const assignment = await findAssignmentOnSpace(ctx.db, spaceId, day);
  if (assignment) {
    const [replacement] = await getAvailableSpacesForDate(ctx.db, day);
    await removeFromHistory(ctx.db, assignment.user_id, day);

    if (replacement) {
      await updateRequestStatus(ctx.db, assignment.request_id, 'assigned', replacement.id, replacement.number);
      await addToHistory(ctx.db, assignment.user_id, day, replacement.id);
      await sendSuccessEmail(ctx, assignment.user_id, day, replacement.number);
      message += ` L'assegnazione esistente per questa data è stata trasferita al posto ${replacement.number}.`;
    } else {
      await updateRequestStatus(ctx.db, assignment.request_id, 'not_assigned');
      await sendFailureEmail(ctx, assignment.user_id, day);
      if (!(await checkOverbookingForDate(ctx.db, day))) await clearHistoryForDate(ctx.db, day);
      message += " L'assegnazione esistente per questa data è stata annullata.";
    }
  }

  return {
    message,
    unavailability: { unavailabilityId, parkingSpaceId: spaceId, unavailableDate: dayToIso(day) },
  };
}

export async function getTemporaryUnavailabilities(ctx, { spaceId }) {
  if (!spaceId) throw new AppError('ID del parcheggio non fornito.');
  const { rows } = await ctx.db.query(
    `SELECT * FROM temporary_unavailability
      WHERE parking_space_id = $1 AND unavailable_date >= $2 ORDER BY unavailable_date`,
    [spaceId, today()]
  );
  return rows.map(unavailabilityToApi);
}

export async function removeTemporaryUnavailability(ctx, { unavailabilityId }) {
  if (!unavailabilityId) throw new AppError('ID della disabilitazione non fornito.');

  const { rows } = await ctx.db.query(
    'DELETE FROM temporary_unavailability WHERE unavailability_id = $1 RETURNING *',
    [unavailabilityId]
  );
  if (rows.length === 0) throw new AppError('Disabilitazione non trovata.');

  const { parking_space_id: spaceId, unavailable_date: day } = rows[0];

  if (day === today()) await assignToBestCandidate(ctx, spaceId, day);
  await handleInstantReassignment(ctx, spaceId, day);

  return { message: 'Disabilitazione rimossa con successo. Il parcheggio è nuovamente disponibile.' };
}
