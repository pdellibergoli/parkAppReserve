// Cache in memoria dei dati letti dal server. Non scrive mai su disco e si svuota al logout.
//
// Una voce già presente viene mostrata subito; se è scaduta o invalidata si riaggiorna in
// background. Così le pagine sono immediate senza far vedere a lungo dati vecchi.

const MAX_ENTRIES = 16;

const entries = new Map();

const getEntry = (key) => {
  let entry = entries.get(key);
  if (!entry) {
    entry = {
      state: { data: undefined, error: null },
      fetchedAt: 0,
      stale: false,
      // Cresce ad ogni modifica locale o invalidazione: scarta le risposte partite prima
      generation: 0,
      fetcher: null,
      ttl: 0,
      inFlight: null,
      listeners: new Set(),
    };
    entries.set(key, entry);
  }
  return entry;
};

const setState = (entry, patch) => {
  entry.state = { ...entry.state, ...patch };
  entry.listeners.forEach((listener) => listener());
};

// Rimuove le voci meno recenti che nessuna pagina sta mostrando
const evict = () => {
  for (const [key, entry] of entries) {
    if (entries.size <= MAX_ENTRIES) return;
    if (entry.listeners.size === 0 && !entry.inFlight) entries.delete(key);
  }
};

const needsFetch = (entry) => (
  entry.state.data === undefined || entry.stale || Date.now() - entry.fetchedAt > entry.ttl
);

function runFetch(entry) {
  if (entry.inFlight) return entry.inFlight;

  const generation = entry.generation;
  entry.inFlight = (async () => {
    try {
      const data = await entry.fetcher();
      if (entry.generation === generation) {
        entry.fetchedAt = Date.now();
        entry.stale = false;
        setState(entry, { data, error: null });
      }
    } catch (error) {
      if (entry.generation === generation) setState(entry, { error });
    } finally {
      entry.inFlight = null;
    }
    // Nel frattempo i dati sono cambiati: questa risposta non è affidabile
    if (entry.generation !== generation) return runFetch(entry);
    return entry.state.data;
  })();
  return entry.inFlight;
}

/** Garantisce che la voce sia fresca. Si risolve con i dati, subito se già validi. */
export function ensureData(key, fetcher, ttl) {
  const entry = getEntry(key);
  entry.fetcher = fetcher;
  entry.ttl = ttl;

  // Reinserita in coda alla Map: l'ordine di inserimento diventa quello di ultimo utilizzo
  entries.delete(key);
  entries.set(key, entry);
  evict();

  return needsFetch(entry) ? runFetch(entry) : Promise.resolve(entry.state.data);
}

export const peekData = (key) => entries.get(key)?.state.data;

export const getEntryState = (key) => getEntry(key).state;

export function subscribeToEntry(key, listener) {
  const entry = getEntry(key);
  entry.listeners.add(listener);
  return () => entry.listeners.delete(listener);
}

/** Modifica locale immediata; il server resta la fonte di verità alla prossima lettura. */
export function updateData(key, updater) {
  const entry = entries.get(key);
  if (entry?.state.data === undefined) return;
  entry.generation++;
  setState(entry, { data: updater(entry.state.data) });
}

export const cachedKeys = () => [...entries.keys()];

let refetchTimer = null;

/**
 * Marca come vecchie le voci scelte e riaggiorna a breve quelle mostrate a schermo.
 * L'attesa raccoglie in un'unica rilettura le scritture in sequenza e l'aggiornamento
 * ottimistico che il chiamante applica appena riceve la risposta.
 */
export function invalidateData(matches = () => true) {
  for (const [key, entry] of entries) {
    if (!matches(key)) continue;
    entry.generation++;
    entry.stale = true;
  }

  clearTimeout(refetchTimer);
  refetchTimer = setTimeout(() => {
    for (const entry of entries.values()) {
      if (entry.stale && entry.listeners.size > 0 && entry.fetcher) runFetch(entry);
    }
  }, 100);
}

export function clearDataStore() {
  entries.clear();
}

// Una scheda rimasta aperta si riallinea quando l'utente ci torna
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    for (const entry of entries.values()) {
      if (entry.listeners.size > 0 && entry.fetcher && needsFetch(entry)) runFetch(entry);
    }
  });
}
