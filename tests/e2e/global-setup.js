import pg from 'pg';
import { assertLocalDatabase, runMigrations } from '../../scripts/lib/migrations.js';

/** Crea se serve il database dei test e ci applica lo schema da zero. */
export default async function globalSetup() {
  const connectionString = process.env.E2E_DATABASE_URL;
  if (!connectionString) throw new Error('E2E_DATABASE_URL non impostata: aggiungila a .env.local (vedi .env.example).');
  assertLocalDatabase(connectionString);

  const url = new URL(connectionString);
  const dbName = url.pathname.slice(1);
  if (!dbName.includes('e2e')) throw new Error('Il database dei test E2E deve avere "e2e" nel nome.');

  url.pathname = '/postgres';
  const admin = new pg.Client({ connectionString: url.toString() });
  await admin.connect();
  const { rowCount } = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
  if (rowCount === 0) await admin.query(`CREATE DATABASE "${dbName}"`);
  await admin.end();

  const pool = new pg.Pool({ connectionString });
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await runMigrations(pool);
  await pool.end();
}
