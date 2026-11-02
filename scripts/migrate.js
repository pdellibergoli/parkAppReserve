// Uso: npm run db:migrate. Per un altro ambiente: DATABASE_URL=... node scripts/migrate.js
import { closePool, getPool } from '../server/db.js';
import { runMigrations } from './lib/migrations.js';

try {
  const executed = await runMigrations(getPool());
  console.log(executed.length > 0 ? `Migrazioni applicate: ${executed.join(', ')}` : 'Database già aggiornato.');
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
} finally {
  await closePool();
}
