import { toDay, today } from './dates.js';
import { AppError } from './errors.js';
import { countWorkingDays, getQuarterBounds } from './holidays.js';

export const DEFAULT_TOKEN_START_DATE = '2026-01-01';

/**
 * Legge la data di partenza del sistema a gettoni impostata dall'amministratore.
 */
export async function getTokenSystemStartDate(db) {
  const { rows } = await db.query(
    "SELECT value FROM system_settings WHERE key = 'token_system_start_date'"
  );
  return rows[0]?.value || DEFAULT_TOKEN_START_DATE;
}

/**
 * Aggiorna la data di partenza del sistema a gettoni.
 */
export async function setTokenSystemStartDate(db, startDate) {
  if (!startDate) throw new AppError('Data di partenza non valida.');
  const validatedDay = toDay(startDate);

  await db.query(
    `INSERT INTO system_settings (key, value, updated_at)
     VALUES ('token_system_start_date', $1, now())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [validatedDay]
  );
  return validatedDay;
}

/**
 * Restituisce i dettagli del periodo trimestrale attivo e il totale dei giorni lavorativi.
 */
export async function getTokenPeriodInfo(db, referenceDay = today()) {
  const day = toDay(referenceDay);
  const bounds = getQuarterBounds(day);
  const configuredStartDate = await getTokenSystemStartDate(db);

  // La data di inizio effettiva è la più recente tra inizio trimestre e data di partenza impostata
  const effectiveStart = configuredStartDate > bounds.start ? configuredStartDate : bounds.start;

  let totalWorkingDays = 0;
  if (effectiveStart <= bounds.end) {
    totalWorkingDays = countWorkingDays(effectiveStart, bounds.end);
  }

  return {
    referenceDay: day,
    startDate: configuredStartDate,
    configuredStartDate,
    quarterStart: bounds.start,
    quarterEnd: bounds.end,
    effectiveStart,
    quarterNumber: bounds.quarter,
    year: bounds.year,
    totalWorkingDays,
  };
}

/**
 * Calcola le statistiche dei gettoni per tutti gli utenti nel trimestre di riferimento.
 */
export async function computeUserTokenStats(db, referenceDay = today()) {
  const period = await getTokenPeriodInfo(db, referenceDay);

  const { rows } = await db.query(
    `SELECT u.id,
            (SELECT count(*)::int FROM parking_requests r
              WHERE r.user_id = u.id
                AND r.requested_date BETWEEN $1 AND $2
                AND r.status = 'assigned') AS used_tokens,
            (SELECT count(*)::int FROM parking_requests r
              WHERE r.user_id = u.id
                AND r.requested_date BETWEEN $1 AND $2
                AND r.status IN ('assigned', 'not_assigned', 'pending')) AS total_requests
       FROM users u`,
    [period.effectiveStart, period.quarterEnd]
  );

  const stats = new Map();
  for (const { id, used_tokens, total_requests } of rows) {
    const totalTokens = period.totalWorkingDays;
    const usedTokens = used_tokens || 0;
    const remainingTokens = Math.max(0, totalTokens - usedTokens);
    const totalRequests = total_requests || 0;
    const assignmentPercentage = totalRequests > 0 ? (usedTokens / totalRequests) * 100 : 0;

    stats.set(id, {
      totalTokens,
      usedTokens,
      remainingTokens,
      totalRequests,
      totalAssignments: usedTokens,
      assignmentPercentage: Math.round(assignmentPercentage * 10) / 10,
      quarterNumber: period.quarterNumber,
      year: period.year,
      effectiveStart: period.effectiveStart,
      quarterEnd: period.quarterEnd,
    });
  }

  return { period, stats };
}

/**
 * Calcola quante richieste personali consecutive precedenti a targetDay
 * l'utente ha ottenuto con stato 'assigned' (senza un 'not_assigned' in mezzo).
 */
export async function getUserConsecutiveAssignedDays(db, userId, targetDay) {
  const day = toDay(targetDay);
  const bounds = getQuarterBounds(day);

  const { rows } = await db.query(
    `SELECT status, requested_date
       FROM parking_requests
      WHERE user_id = $1
        AND requested_date < $2
        AND requested_date >= $3
        AND status IN ('assigned', 'not_assigned')
      ORDER BY requested_date DESC, request_id DESC
      LIMIT 10`,
    [userId, day, bounds.start]
  );

  let consecutive = 0;
  for (const row of rows) {
    if (row.status === 'assigned') {
      consecutive++;
    } else {
      break;
    }
  }
  return consecutive;
}
