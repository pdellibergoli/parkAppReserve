// In locale non c'è Vercel Cron: esegue a mano l'assegnazione serale.
// Uso: npm run assign (richieste di domani) oppure npm run assign -- 2026-11-02
import { toDay } from '../server/dates.js';
import { closePool } from '../server/db.js';
import { processPendingRequests } from '../server/router.js';

try {
  const [dateArg] = process.argv.slice(2);
  const result = await processPendingRequests(dateArg ? toDay(dateArg) : undefined);
  console.log(`Assegnati: ${result.assigned}, non assegnati: ${result.failed}`);
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
} finally {
  await closePool();
}
