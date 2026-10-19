const SCRIPT_URL = import.meta.env.VITE_GOOGLE_SCRIPT_URL;

if (!SCRIPT_URL) {
  console.error("CRITICO: La variabile d'ambiente per l'URL dello script non è impostata!");
}

// GAS può essere lento al cold start: un timeout evita richieste appese all'infinito
const REQUEST_TIMEOUT_MS = 30000;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const pendingRequests = new Map();

// Azioni in sola lettura (allineate a READ_ONLY_ACTIONS nel backend).
// Per queste il retry è sempre sicuro: rileggere non crea duplicati.
const READ_ONLY_ACTIONS = new Set([
  'getInitialData',
  'getUsers',
  'getParkingSpaces',
  'getAssignmentHistory',
  'getUsersWithPriority',
  'getRequests',
  'getTemporaryAvailabilities',
  'getTemporaryUnavailabilities',
  'getParkingStatusForDate',
  'getActiveCommunication'
]);

/**
 * Una singola chiamata con timeout.
 *
 * Imposta `retryable` sull'errore per dire al chiamante se è sicuro riprovare:
 *  - rete indisponibile / pagina HTML di errore di Google -> la richiesta molto
 *    probabilmente non è mai arrivata a doPost, quindi si può riprovare;
 *  - timeout o risposta non JSON -> la POST potrebbe essere già stata ESEGUITA
 *    dal backend, quindi NON si riprova (rischio di creare richieste duplicate).
 */
async function fetchOnce(options) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(SCRIPT_URL, { ...options, redirect: 'follow', signal: controller.signal });
    const text = await response.text();
    const trimmed = text.trim();

    // Scarta se la risposta è la pagina di errore/login HTML di Google
    if (trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<html')) {
      throw makeRetryableError(`Risposta HTML non valida da Google Apps Script`, true);
    }

    return JSON.parse(text);
  } catch (err) {
    if (err.name === 'AbortError') {
      throw makeRetryableError(`Richiesta superata dopo ${REQUEST_TIMEOUT_MS / 1000}s`, false);
    }
    if (err instanceof SyntaxError) {
      throw makeRetryableError('Risposta non JSON dal backend', false);
    }
    // Errore di rete (fetch non ha ricevuto risposta): di norma si può riprovare
    if (err.retryable === undefined) err.retryable = true;
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

function makeRetryableError(message, retryable) {
  const error = new Error(message);
  error.retryable = retryable;
  return error;
}

/**
 * Fetch con retry differenziato:
 *  - azioni di lettura: fino a 3 tentativi con backoff;
 *  - azioni di scrittura: al massimo UN tentativo extra, e solo se l'errore è
 *    chiaramente di rete (mai su timeout o risposta corrotta).
 */
async function fetchWithRetry(action, options) {
  const isReadOnly = READ_ONLY_ACTIONS.has(action);
  const maxAttempts = isReadOnly ? 3 : 2;
  const backoff = 1000;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fetchOnce(options);
    } catch (err) {
      console.warn(`[API Retry] Tentativo ${attempt}/${maxAttempts} per '${action}' fallito:`, err.message);
      if (!err.retryable || attempt === maxAttempts) throw err;
      await delay(backoff * attempt);
    }
  }
}

/**
 * Funzione principale API (Usa POST per compatibilità con doPost su Apps Script)
 */
export const callApi = async (action, payload = {}) => {
  const cacheKey = `${action}_${JSON.stringify(payload)}`;
  if (pendingRequests.has(cacheKey)) {
    return pendingRequests.get(cacheKey);
  }

  const requestOptions = {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, payload, data: payload }),
  };

  const requestPromise = (async () => {
    try {
      const result = await fetchWithRetry(action, requestOptions);

      if (result && Array.isArray(result.logs)) {
        console.groupCollapsed(`[API Logs per ${action}]`);
        result.logs.forEach((logMsg) => console.debug(logMsg));
        console.groupEnd();
      }

      if (result && result.status === 'error') {
        throw new Error(result.message || `Errore backend per ${action}`);
      }

      return result ? (result.data !== undefined ? result.data : result) : null;
    } finally {
      pendingRequests.delete(cacheKey);
    }
  })();

  pendingRequests.set(cacheKey, requestPromise);
  return requestPromise;
};

export const fetchData = (action, params) => callApi(action, params);
export const postData = (action, data) => callApi(action, data);
