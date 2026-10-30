import { invalidateData } from './dataStore';

const API_URL = '/api/rpc';

const REQUEST_TIMEOUT_MS = 30000;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const pendingRequests = new Map();

// Azioni in sola lettura: per queste il retry è sempre sicuro, rileggere non crea duplicati.
const READ_ONLY_ACTIONS = new Set([
  'login',
  'getReferenceData',
  'getMonthData',
  'getUsers',
  'getParkingSpaces',
  'getAssignmentHistory',
  'getUsersWithPriority',
  'getRequests',
  'getRequestsPage',
  'getTemporaryAvailabilities',
  'getTemporaryUnavailabilities',
  'getParkingStatusForDate',
  'getActiveCommunication'
]);

// Scritture che non toccano dati in cache
const ACTIONS_WITHOUT_CACHED_DATA = new Set([
  'signup',
  'resendVerificationEmail',
  'verifyEmailToken',
  'requestPasswordReset',
  'resetPassword'
]);

// Scritture che cambiano solo utenti, posti o comunicazioni
const REFERENCE_ONLY_ACTIONS = new Set(['sendAdminCommunication', 'deleteCommunication', 'updateParkingSpaceName']);

// Scritture sui posti che annullano anche assegnazioni e disponibilità
const SPACE_ACTIONS = new Set(['addParkingSpace', 'deleteParkingSpace', 'updateParkingSpaceFixedStatus']);

// Unico punto di invalidazione: ogni scrittura riuscita rende vecchi i dati che può aver cambiato,
// comprese le riassegnazioni fatte dal server che il frontend non può prevedere.
function invalidateAfterWrite(action) {
  if (READ_ONLY_ACTIONS.has(action) || ACTIONS_WITHOUT_CACHED_DATA.has(action)) return;

  if (REFERENCE_ONLY_ACTIONS.has(action)) invalidateData((key) => key === 'reference');
  else if (action === 'updateUserProfile') invalidateData((key) => key === 'reference' || key === 'priorities');
  else if (SPACE_ACTIONS.has(action)) invalidateData();
  else invalidateData((key) => key !== 'reference');
}

/**
 * Una singola chiamata con timeout.
 *
 * Imposta `retryable` sull'errore per dire al chiamante se è sicuro riprovare:
 *  - rete indisponibile -> la richiesta molto probabilmente non è mai arrivata
 *    al server, quindi si può riprovare;
 *  - timeout o risposta non JSON -> la POST potrebbe essere già stata ESEGUITA
 *    dal backend, quindi NON si riprova (rischio di creare richieste duplicate).
 */
async function fetchOnce(options) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(API_URL, { ...options, signal: controller.signal });
    return JSON.parse(await response.text());
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
 * Funzione principale API: tutte le azioni passano da un unico endpoint POST.
 */
export const callApi = async (action, payload = {}) => {
  const cacheKey = `${action}_${JSON.stringify(payload)}`;
  if (pendingRequests.has(cacheKey)) {
    return pendingRequests.get(cacheKey);
  }

  const requestOptions = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, payload }),
  };

  const requestPromise = (async () => {
    try {
      const result = await fetchWithRetry(action, requestOptions);

      if (result && result.status === 'error') {
        throw new Error(result.message || `Errore backend per ${action}`);
      }

      invalidateAfterWrite(action);

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
