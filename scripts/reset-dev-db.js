// Uso: npm run db:reset. Ricrea da zero il database di sviluppo con dati di esempio.
import { closePool, getPool } from '../server/db.js';
import { assertLocalDatabase, runMigrations } from './lib/migrations.js';
import { DEMO_PASSWORD, seedDemoData } from './lib/seed.js';

try {
  assertLocalDatabase(process.env.DATABASE_URL);
  const pool = getPool();
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await runMigrations(pool);
  const nextDay = await seedDemoData(pool);
  console.log(`Database ricreato. Richieste in attesa per ${nextDay}.`);
  console.log(`Accesso: admin@parkapp.local oppure mario@parkapp.local, password ${DEMO_PASSWORD}`);
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
} finally {
  await closePool();
}
