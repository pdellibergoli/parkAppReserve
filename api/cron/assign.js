import { CONFIG } from '../../server/config.js';
import { currentHour } from '../../server/dates.js';
import { sendJson } from '../../server/http.js';
import { processPendingRequests } from '../../server/router.js';

/**
 * Chiamato da Vercel Cron. I cron sono in UTC, quindi vercel.json ne pianifica due (17 e 18 UTC)
 * e qui gira solo quello che cade nell'ora di assegnazione italiana, con ora legale o solare.
 */
export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.authorization !== `Bearer ${secret}`) {
    return sendJson(res, 401, { status: 'error', message: 'Non autorizzato.' });
  }

  if (currentHour() !== CONFIG.ASSIGNMENT_HOUR) {
    return sendJson(res, 200, { status: 'skipped' });
  }

  try {
    const data = await processPendingRequests();
    return sendJson(res, 200, { status: 'success', data });
  } catch (err) {
    console.error('Errore assegnazione automatica:', err);
    return sendJson(res, 500, { status: 'error', message: 'Errore interno del server.' });
  }
}
