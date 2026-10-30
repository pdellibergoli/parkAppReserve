import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MIGRATIONS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'db', 'migrations');

/** Applica in ordine i file di db/migrations non ancora eseguiti su questo database. */
export async function runMigrations(pool) {
  await pool.query(
    'CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())'
  );
  const { rows } = await pool.query('SELECT name FROM schema_migrations');
  const applied = new Set(rows.map((row) => row.name));

  const files = (await readdir(MIGRATIONS_DIR)).filter((file) => file.endsWith('.sql')).sort();
  const executed = [];

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = await readFile(path.join(MIGRATIONS_DIR, file), 'utf8');

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
      await client.query('COMMIT');
      executed.push(file);
    } catch (err) {
      await client.query('ROLLBACK');
      throw new Error(`Migrazione ${file} fallita: ${err.message}`);
    } finally {
      client.release();
    }
  }
  return executed;
}

/** Protegge i comandi distruttivi: agiscono solo su database in esecuzione su questa macchina. */
export function assertLocalDatabase(connectionString) {
  const { hostname } = new URL(connectionString);
  if (!['localhost', '127.0.0.1', '::1', '[::1]'].includes(hostname)) {
    throw new Error(`Operazione consentita solo su un database locale (host: ${hostname}).`);
  }
}
