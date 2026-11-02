import { getSpace } from './assignment.js';
import { today, toDay } from './dates.js';
import { AppError } from './errors.js';
import { spaceToApi } from './mappers.js';

export async function getParkingSpaces(db) {
  const { rows } = await db.query('SELECT * FROM parking_spaces ORDER BY seq');
  return rows.map(spaceToApi);
}

export async function addParkingSpace(ctx, { number }) {
  if (!number || number.trim() === '') throw new AppError('Il nome/numero del parcheggio è obbligatorio.');

  const { rows } = await ctx.db.query(
    'INSERT INTO parking_spaces (id, number, is_fixed) VALUES ($1, $2, FALSE) RETURNING *',
    [`space_${Date.now()}`, number.trim()]
  );
  return { message: 'Parcheggio aggiunto con successo.', space: spaceToApi(rows[0]) };
}

const removeFutureAvailabilities = (db, spaceId) => db.query(
  'DELETE FROM temporary_availability WHERE parking_space_id = $1 AND available_date >= $2',
  [spaceId, today()]
);

const removeFutureUnavailabilities = (db, spaceId) => db.query(
  'DELETE FROM temporary_unavailability WHERE parking_space_id = $1 AND unavailable_date >= $2',
  [spaceId, today()]
);

export async function deleteParkingSpace(ctx, { spaceId }) {
  if (!spaceId) throw new AppError("ID del parcheggio non fornito per l'eliminazione.");
  if (!(await getSpace(ctx.db, spaceId))) throw new AppError('Parcheggio non trovato.');

  await removeFutureAvailabilities(ctx.db, spaceId);
  await removeFutureUnavailabilities(ctx.db, spaceId);
  await ctx.db.query(
    `UPDATE parking_requests
        SET status = 'not_assigned', assigned_parking_space_id = NULL, assigned_parking_space_number = NULL
      WHERE assigned_parking_space_id = $1 AND status = 'assigned' AND requested_date >= $2`,
    [spaceId, today()]
  );
  await ctx.db.query('DELETE FROM parking_spaces WHERE id = $1', [spaceId]);

  return {
    deletedSpaceId: spaceId,
    message: 'Parcheggio rimosso. Le assegnazioni future sono state annullate ma lo storico è stato preservato.',
  };
}

export async function updateParkingSpaceFixedStatus(ctx, { spaceId, isFixed }) {
  if (!spaceId) throw new AppError('ID del parcheggio non fornito.');
  if (!(await getSpace(ctx.db, spaceId))) throw new AppError('Parcheggio non trovato.');

  // Disponibilità e disabilitazioni future hanno senso solo per il tipo precedente
  if (isFixed) await removeFutureAvailabilities(ctx.db, spaceId);
  else await removeFutureUnavailabilities(ctx.db, spaceId);

  await ctx.db.query('UPDATE parking_spaces SET is_fixed = $2 WHERE id = $1', [spaceId, Boolean(isFixed)]);
  return { spaceId, isFixed };
}

export async function updateParkingSpaceName(ctx, { spaceId, number }) {
  if (!spaceId || !number || number.trim() === '') {
    throw new AppError('ID e nuovo nome del parcheggio sono obbligatori.');
  }

  const { rowCount } = await ctx.db.query(
    'UPDATE parking_spaces SET number = $2 WHERE id = $1',
    [spaceId, number.trim()]
  );
  if (rowCount === 0) throw new AppError('Parcheggio non trovato.');

  return { message: 'Nome del parcheggio aggiornato con successo.', spaceId, number: number.trim() };
}

export async function getParkingStatusForDate(ctx, { date }) {
  if (!date) throw new AppError('Data non fornita.');
  const day = toDay(date);

  const { rows } = await ctx.db.query(
    `SELECT
       (SELECT count(*)::int FROM parking_spaces s
         WHERE s.is_fixed AND NOT EXISTS (
           SELECT 1 FROM temporary_unavailability u
            WHERE u.parking_space_id = s.id AND u.unavailable_date = $1)) AS fixed,
       (SELECT count(DISTINCT parking_space_id)::int FROM temporary_availability
         WHERE available_date = $1) AS temp,
       (SELECT count(*)::int FROM parking_requests
         WHERE requested_date = $1 AND status = 'assigned') AS assigned`,
    [day]
  );
  const { fixed, temp, assigned } = rows[0];
  const total = fixed + temp;
  return { total, assigned, available: Math.max(0, total - assigned) };
}
