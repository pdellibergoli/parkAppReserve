import pg from 'pg';

// Le colonne DATE restano stringhe 'yyyy-MM-dd': il parser di default le convertirebbe
// in Date a mezzanotte del fuso del server, spostando il giorno.
pg.types.setTypeParser(pg.types.builtins.DATE, (value) => value);

// Tutte le scritture passano da qui, una alla volta: in un'app di queste dimensioni
// evita senza costi percepibili che due operazioni assegnino lo stesso posto.
const WRITE_LOCK_ID = 727001;

export function isLocalDatabase(connectionString) {
  return ['localhost', '127.0.0.1', '::1', '[::1]'].includes(new URL(connectionString).hostname);
}

function connectionConfig() {
  const ca = process.env.DATABASE_CA_CERT;
  // I database locali non usano TLS: il certificato vale solo per quelli remoti
  if (!ca || isLocalDatabase(process.env.DATABASE_URL)) return { connectionString: process.env.DATABASE_URL };

  // I parametri SSL dell'URL prevarrebbero sull'opzione ssl, quindi vanno tolti
  const url = new URL(process.env.DATABASE_URL);
  for (const param of ['ssl', 'sslmode', 'sslrootcert', 'sslcert', 'sslkey', 'uselibpqcompat']) {
    url.searchParams.delete(param);
  }
  return {
    connectionString: url.toString(),
    // Alcuni pannelli salvano il certificato su una riga sola, con \n letterali
    ssl: { ca: ca.replace(/\\n/g, '\n'), rejectUnauthorized: true },
  };
}

export function getPool() {
  // Su globalThis perché in sviluppo Vite ricarica i moduli del server ad ogni modifica
  if (!globalThis.__parkAppPool) {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL non impostata.');
    const pool = new pg.Pool({
      ...connectionConfig(),
      max: Number(process.env.PG_POOL_MAX) || 5,
    });
    // Senza listener, una connessione inattiva chiusa dal server farebbe terminare il processo
    pool.on('error', (err) => console.error('Errore connessione Postgres inattiva:', err.message));
    globalThis.__parkAppPool = pool;
  }
  return globalThis.__parkAppPool;
}

export async function closePool() {
  if (globalThis.__parkAppPool) {
    await globalThis.__parkAppPool.end();
    globalThis.__parkAppPool = undefined;
  }
}

export async function withWriteTransaction(fn) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock($1)', [WRITE_LOCK_ID]);
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
